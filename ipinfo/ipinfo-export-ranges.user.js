// ==UserScript==
// @name         IPinfo AS 全部 IP 段导出
// @namespace    https://ipinfo.io/
// @version      1.0.0
// @description  在 AS 页面的 IP Ranges 标题右侧添加按钮，自动展开并合并导出全部 IPv4、IPv6 网段为单列 CSV
// @author       Richard
// @homepageURL  https://github.com/richardlzs/TampermonkeyScripts
// @match        https://ipinfo.io/AS*
// @match        https://www.ipinfo.io/AS*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_ID = 'tm-ipinfo-export-ranges';
    const STYLE_ID = 'tm-ipinfo-export-ranges-style';
    const TIMEOUT_MS = 20000;
    const BUTTON_LABEL = '导出全部IP段';

    function getAsn() {
        return location.pathname.match(/^\/(AS\d+)\/?$/i)?.[1].toUpperCase() || null;
    }

    // @match 的通配符也会匹配网段详情页，实际只在 AS 首页运行。
    if (!getAsn() || document.getElementById(STYLE_ID)) return;

    function findButton(section, pattern) {
        return Array.from(section.querySelectorAll('button')).find(button =>
            pattern.test(button.textContent.trim())
        );
    }

    function familyButtons(section) {
        return Array.from(section.querySelectorAll('button')).filter(button =>
            /^IPv[46]$/.test(button.textContent.trim())
        );
    }

    function activeFamily(section) {
        return familyButtons(section).find(button =>
            button.getAttribute('aria-pressed') === 'true'
        )?.textContent.trim() || null;
    }

    function readRanges(section) {
        const ranges = new Set();
        // 只读 IP Ranges 表格首列，避免混入 WHOIS、Peers 或公司名称中的地址。
        for (const cell of section.querySelectorAll('tbody tr td:first-child')) {
            const text = (cell.querySelector('a') || cell).textContent.trim();
            const match = text.match(/^((?:\d{1,3}\.){3}\d{1,3}|[\da-f]*:[\da-f:]+)\/(\d{1,3})$/i);
            if (!match) continue;
            const ipv6 = match[1].includes(':');
            if (Number(match[2]) > (ipv6 ? 128 : 32)) continue;
            if (!ipv6 && match[1].split('.').some(part => Number(part) > 255)) continue;
            ranges.add(text.toLowerCase());
        }
        return Array.from(ranges);
    }

    function isLoading(section) {
        return Boolean(section.querySelector('[aria-busy="true"]')) ||
            /\bloading\b/i.test(section.textContent);
    }

    function assertCurrentPage(section, asn) {
        if (!section.isConnected || getAsn() !== asn) {
            throw new Error('页面已切换，请在当前 AS 页面重新导出。');
        }
    }

    async function waitFor(section, asn, predicate, message) {
        const deadline = Date.now() + TIMEOUT_MS;
        while (true) {
            assertCurrentPage(section, asn);
            if (predicate()) return;
            if (Date.now() >= deadline) throw new Error(message);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async function waitUntilReady(section, asn) {
        await waitFor(section, asn, () => !isLoading(section), 'IP Ranges 加载超时，未导出文件。');
    }

    async function selectFamily(section, asn, family) {
        const button = familyButtons(section).find(item => item.textContent.trim() === family);
        if (!button) throw new Error(`未找到 ${family} 切换按钮，未导出文件。`);
        if (activeFamily(section) !== family) {
            if (button.disabled) throw new Error(`${family} 切换按钮不可用，未导出文件。`);
            button.click();
            await waitFor(section, asn, () => activeFamily(section) === family,
                `切换 ${family} 超时，未导出文件。`);
        }
        await waitUntilReady(section, asn);
    }

    async function expandAll(section, asn, onProgress = () => {}) {
        const ranges = new Set();
        while (true) {
            assertCurrentPage(section, asn);
            await waitUntilReady(section, asn);
            readRanges(section).forEach(range => ranges.add(range));
            onProgress(ranges.size);

            const more = findButton(section, /^show more(?:\s+ip ranges)?$/i);
            if (!more) return ranges;

            await waitFor(section, asn, () => !more.disabled && !isLoading(section),
                'Show more IP Ranges 不可用，未导出文件。');
            const before = readRanges(section).join('\n');
            more.click();
            // 同时支持一次性展开和多次追加；按钮无响应时必须报错，不能下载前十条。
            await waitFor(section, asn, () => !isLoading(section) &&
                readRanges(section).join('\n') !== before,
            'Show more IP Ranges 未加载出更多网段，未导出文件。');
            if (findButton(section, /^show more(?:\s+ip ranges)?$/i) &&
                readRanges(section).every(range => ranges.has(range))) {
                throw new Error('Show more IP Ranges 未返回新网段，未导出文件。');
            }
        }
    }

    function downloadCsv(asn, ranges) {
        // 无表头、每行一个 CIDR；BOM 和 CRLF 便于 Excel 直接打开。
        const blob = new Blob(['\uFEFF', Array.from(ranges).join('\r\n'), '\r\n'], {
            type: 'text/csv;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${asn}_all_ip_ranges.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    async function exportAll(section, button, status) {
        const asn = getAsn();
        const originalFamily = activeFamily(section);
        const originallyExpanded = Boolean(findButton(section, /^show less$/i));
        button.disabled = true;
        button.textContent = '正在导出…';
        status.dataset.error = 'false';
        status.textContent = '正在读取全部 IP 段…';

        // 导出期间阻止手动切换筛选或折叠；脚本触发的 click 不受影响。
        const blockManualChanges = event => {
            if (event.isTrusted && event.target.closest('button')) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };
        section.addEventListener('click', blockManualChanges, true);
        try {
            assertCurrentPage(section, asn);
            if (!originalFamily && familyButtons(section).length) {
                throw new Error('无法确认当前 IP 类型，请等待页面加载后重试。');
            }
            const families = familyButtons(section).map(item => item.textContent.trim());
            const allRanges = new Set();
            for (const family of families.length ? families : [null]) {
                if (family) await selectFamily(section, asn, family);
                const ranges = await expandAll(section, asn, count => {
                    status.textContent = `正在读取 ${family || 'IP'}：${count} 段…`;
                });
                // 空列表可以是没有 IPv6；结构变化或错误页面则不能默认为空列表。
                if (!ranges.size && !/\bno\b[^.\n]*(?:ranges|netblocks|prefixes)\b/i.test(section.textContent)) {
                    throw new Error(`${family || 'IP'} 列表未就绪或结构已变化，未导出文件。`);
                }
                ranges.forEach(range => allRanges.add(range));
            }
            if (!allRanges.size) throw new Error('此 AS 没有可导出的 IP 段。');
            assertCurrentPage(section, asn);
            downloadCsv(asn, allRanges);
            status.textContent = `已导出 ${allRanges.size} 个 IP 段`;
        } catch (error) {
            console.error('[IPinfo IP 段导出]', error);
            status.dataset.error = 'true';
            status.textContent = error.message || '导出失败，请重试。';
        } finally {
            try {
                if (section.isConnected && getAsn() === asn && originalFamily) {
                    await selectFamily(section, asn, originalFamily);
                    if (originallyExpanded) {
                        await expandAll(section, asn);
                    } else {
                        findButton(section, /^show less$/i)?.click();
                    }
                }
            } catch (error) {
                console.warn('[IPinfo IP 段导出] 恢复页面筛选失败', error);
            }
            section.removeEventListener('click', blockManualChanges, true);
            button.disabled = false;
            button.textContent = BUTTON_LABEL;
        }
    }

    function mountButton() {
        if (!getAsn() || document.getElementById(BUTTON_ID)) return;
        const section = document.querySelector('section#ranges');
        const heading = section?.querySelector('h2');
        if (!heading || !/^IP Ranges$/i.test(heading.textContent.trim())) return;

        const controls = document.createElement('div');
        controls.className = 'tm-ipinfo-export-controls';
        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';
        button.textContent = BUTTON_LABEL;
        button.title = '自动展开并导出此 AS 的全部 IPv4 和 IPv6 网段';
        const status = document.createElement('span');
        status.className = 'tm-ipinfo-export-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        controls.append(button);
        heading.insertAdjacentElement('afterend', controls);
        heading.parentElement.appendChild(status);
        button.addEventListener('click', () => {
            if (!button.disabled) void exportAll(section, button, status);
        });
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #ranges h2 { flex-shrink: 0; }
        #ranges h2:has(+ .tm-ipinfo-export-controls) { margin-right: 0; }
        #ranges div:has(> .tm-ipinfo-export-controls) { flex-wrap: wrap; }
        .tm-ipinfo-export-controls { display: flex; align-items: center; margin-left: auto; }
        #${BUTTON_ID} { background: #2563eb; color: #fff; border: 0; border-radius: 6px;
            padding: 7px 12px; font-size: 13px; font-weight: 600; line-height: 1.5;
            white-space: nowrap; cursor: pointer; }
        #${BUTTON_ID}:hover { background: #1d4ed8; }
        #${BUTTON_ID}:focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
        #${BUTTON_ID}:disabled { opacity: .6; cursor: wait; }
        .tm-ipinfo-export-status { flex-basis: 100%; order: 1; color: #475569; font-size: 12px; }
        .tm-ipinfo-export-status[data-error="true"] { color: #b91c1c; }
        .tm-ipinfo-export-status:empty { display: none; }
    `;
    document.head.appendChild(style);
    mountButton();
    // 兼容客户端初次渲染、重新挂载以及站内切换 AS 后的列表。
    let mountScheduled = false;
    new MutationObserver(() => {
        if (mountScheduled) return;
        mountScheduled = true;
        setTimeout(() => {
            mountScheduled = false;
            mountButton();
        }, 100);
    }).observe(document.body, { childList: true, subtree: true });
})();
