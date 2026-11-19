// ==UserScript==
// @name         IPinfo AS 全部 IP 段导出
// @namespace    https://ipinfo.io/
// @version      1.1.0
// @description  在 IPinfo AS 页导出 RIPEstat 最新 BGP 快照中的 IPv4、IPv6 前缀为单列 CSV
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
    const SECTION_SELECTOR = 'section:is(#ip-ranges, #ranges)';
    const TIMEOUT_MS = 20000;
    const BUTTON_LABEL = '导出全部IP段';

    function getAsn() {
        return location.pathname.match(/^\/(AS\d+)\/?$/i)?.[1].toUpperCase() || null;
    }

    // @match 的通配符也会匹配网段详情页，实际只在 AS 首页运行。
    if (!getAsn() || document.getElementById(STYLE_ID)) return;

    function isCidr(value, family) {
        const match = typeof value === 'string' && value.match(/^([\da-f:.]+)\/(\d{1,3})$/i);
        if (!match) return false;
        const [, address, length] = match;
        if (family === 'v6') {
            return Number(length) <= 128 && URL.canParse(`http://[${address}]/`);
        }
        return Number(length) <= 32 && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(address) &&
            address.split('.').every(part => Number(part) <= 255);
    }

    function readFamily(data, family) {
        const ranges = data.prefixes?.[family]?.originating;
        const count = data.counts?.[family]?.originating;
        if (!Array.isArray(ranges) || ranges.length !== count ||
            !ranges.every(range => isCidr(range, family))) {
            throw new Error(`RIPEstat 的 IP${family} 列表不完整或格式异常，未导出文件。`);
        }
        return ranges.map(range => range.toLowerCase());
    }

    async function fetchRanges(asn) {
        // 最新 RIS 快照。types=o 只取当前 ASN 发起的路由，list_prefixes=true 返回完整列表。
        const query = new URLSearchParams({ resource: asn, list_prefixes: 'true', types: 'o' });
        const response = await fetch(`https://stat.ripe.net/data/ris-prefixes/data.json?${query}`, {
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!response.ok) throw new Error(`RIPEstat 请求失败（HTTP ${response.status}），未导出文件。`);

        const { status, data } = await response.json();
        if (status !== 'ok' || String(data?.resource) !== String(Number(asn.slice(2)))) {
            throw new Error('RIPEstat 未返回当前 AS 的有效数据，未导出文件。');
        }

        return new Set([...readFamily(data, 'v4'), ...readFamily(data, 'v6')]);
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
        if (!asn) return;

        button.disabled = true;
        button.textContent = '正在导出…';
        status.dataset.error = 'false';
        status.textContent = '正在读取 RIPEstat BGP 快照…';

        try {
            const ranges = await fetchRanges(asn);
            if (!section.isConnected || getAsn() !== asn) {
                throw new Error('页面已切换，请在当前 AS 页面重新导出。');
            }
            if (!ranges.size) throw new Error('RIPEstat 最新快照中没有此 AS 发起的路由前缀。');
            downloadCsv(asn, ranges);
            status.textContent = `已导出 ${ranges.size} 个 IP 段（RIPEstat）`;
        } catch (error) {
            console.error('[IPinfo IP 段导出]', error);
            status.dataset.error = 'true';
            if (error.name === 'TimeoutError') {
                status.textContent = 'RIPEstat 请求超时，未导出文件。';
            } else if (error.name === 'TypeError' || error.name === 'SyntaxError') {
                status.textContent = '无法读取 RIPEstat 数据，请检查网络后重试。';
            } else {
                status.textContent = error.message || '导出失败，请重试。';
            }
        } finally {
            button.disabled = false;
            button.textContent = BUTTON_LABEL;
        }
    }

    function mountButton() {
        if (!getAsn() || document.getElementById(BUTTON_ID)) return;
        const section = document.querySelector(SECTION_SELECTOR);
        const heading = section?.querySelector('h2');
        if (!heading || !/^IP Ranges$/i.test(heading.textContent.trim())) return;

        const controls = document.createElement('div');
        controls.className = 'tm-ipinfo-export-controls';
        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';
        button.textContent = BUTTON_LABEL;
        button.title = '导出 RIPEstat 最新 BGP 快照中此 AS 发起的 IPv4 和 IPv6 前缀';
        const status = document.createElement('span');
        status.className = 'tm-ipinfo-export-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        controls.append(button);
        heading.parentElement.append(controls, status);
        button.addEventListener('click', () => {
            if (!button.disabled) void exportAll(section, button, status);
        });
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        ${SECTION_SELECTOR} h2 { flex-shrink: 0; }
        ${SECTION_SELECTOR} div:has(> .tm-ipinfo-export-controls) { flex-wrap: wrap; }
        ${SECTION_SELECTOR} div:has(> .tm-ipinfo-export-controls) > h2 { margin-right: 0; }
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
