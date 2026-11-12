// ==UserScript==
// @name         智慧中小学 · 下载教材 PDF
// @namespace    TampermonkeyScripts/smartedu
// @version      1.1.0
// @description  保存国家中小学智慧教育平台教材阅读器中当前打开的原始 PDF。
// @match        https://basic.smartedu.cn/tchMaterial/detail*
// @match        https://x-edu-pdfjs.ykt.eduyun.cn/generic/web/viewer.html*
// @run-at       document-idle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    const textbookOrigin = 'https://basic.smartedu.cn';
    const viewerOrigin = 'https://x-edu-pdfjs.ykt.eduyun.cn';
    const viewerPath = '/generic/web/viewer.html';
    const localViewerPath = '/pdfjs/2.15/web/viewer.html';
    const downloadRequest = 'smartedu-pdf:read-document';
    const readError = '无法读取完整 PDF，请刷新教材页后重试。';
    const switchedError = '教材已切换，请重新点击下载。';

    // 跨域阅读器只响应它所在的教材页，读取当前已打开的文档。
    if (location.origin === viewerOrigin && location.pathname === viewerPath) {
        if (window.parent === window || !new URLSearchParams(location.search).has('file')) return;
        window.addEventListener('message', async (event) => {
            const reply = event.ports[0];
            if (event.origin !== textbookOrigin || event.source !== window.parent ||
                event.data !== downloadRequest || !reply) return;
            try {
                reply.postMessage({ reading: true });
                reply.postMessage(await readPdf(unsafeWindow));
            } catch {
                reply.postMessage({ error: readError });
            } finally {
                reply.close();
            }
        });
        return;
    }

    if (location.origin !== textbookOrigin || location.pathname !== '/tchMaterial/detail' ||
        window.top !== window.self || document.getElementById('smartedu-pdf-download')) return;

    const host = document.createElement('span');
    host.id = 'smartedu-pdf-download';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        :host { position: relative; display: inline-flex; align-items: center; flex: none; }
        button, .status { font: 14px/1.45 system-ui, sans-serif; border-radius: 6px; }
        button { padding: 5px 10px; border: 1px solid #164da8; background: #185ac8;
            color: #fff; cursor: pointer; white-space: nowrap; }
        button:hover:not(:disabled) { background: #154a9f; }
        button:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
        button:disabled { opacity: .8; cursor: wait; }
        .status { position: absolute; z-index: 2; top: calc(100% + 6px); right: 0;
            width: max-content; max-width: min(260px, 75vw); padding: 6px 10px;
            background: #222; color: #fff; pointer-events: none; }
        .status:empty { display: none; }
    `;
    const status = document.createElement('span');
    status.className = 'status';
    status.setAttribute('role', 'status');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '下载教材 PDF';
    root.append(style, button, status);

    function mountButton() {
        if (host.isConnected || document.getElementById(host.id)) return;
        const toolbar = document.querySelector('[class*="index-module_header-to-teach_"]');
        const teach = toolbar && Array.from(toolbar.children)
            .find((item) => item.textContent.trim() === '全屏授课');
        if (teach) teach.after(host);
    }

    mountButton();
    new MutationObserver(mountButton).observe(document.body, { childList: true, subtree: true });

    async function readPdf(readerWindow) {
        const viewer = readerWindow?.PDFViewerApplication;
        const pdf = viewer?.pdfDocument;
        if (typeof pdf?.getData !== 'function') return { error: '请等教材页面显示后再试。' };

        // 让当前 PDF.js 文档通过自身的加载流程补齐尚未加载的内容。
        const data = await pdf.getData();
        if (viewer.pdfDocument !== pdf) return { error: switchedError };
        if (!data || !new TextDecoder().decode(data.subarray(0, 1024)).includes('%PDF-')) {
            return { error: '阅读器未返回有效的 PDF。' };
        }
        return { blob: new Blob([data], { type: 'application/pdf' }), filename: viewer._docFilename };
    }

    function readRemotePdf(readerWindow) {
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            let timeout = setTimeout(() => finish({
                error: '阅读器未响应。请刷新页面，并检查 Tampermonkey 是否获准在阅读器域名运行。',
            }), 3000);

            function finish(result) {
                clearTimeout(timeout);
                channel.port1.close();
                resolve(result);
            }

            channel.port1.onmessage = (event) => {
                if (event.data?.reading === true) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => finish({ error: readError }), 120_000);
                    return;
                }
                finish(event.data);
            };
            try {
                readerWindow.postMessage(downloadRequest, viewerOrigin, [channel.port2]);
            } catch {
                channel.port2.close();
                finish({ error: readError });
            }
        });
    }

    function pdfFilename(name) {
        const clean = String(name || '').trim().replace(/\.pdf$/i, '')
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim()
            .replace(/^\.+|[. ]+$/g, '');
        const stem = Array.from(clean).slice(0, 60).join('').replace(/[. ]+$/g, '');
        const reserved = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;
        return !stem || reserved.test(stem) ? '' : `${stem}.pdf`;
    }

    function savePdf(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        try {
            link.click();
        } finally {
            link.remove();
            // 留出时间让浏览器接管对象 URL。
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
    }

    button.addEventListener('click', async () => {
        if (button.disabled) return;
        const frame = Array.from(unsafeWindow.document.querySelectorAll('iframe[src]')).find((item) =>
            item.src.startsWith(`${textbookOrigin}${localViewerPath}?`) ||
            item.src.startsWith(`${viewerOrigin}${viewerPath}?`));
        const readerWindow = frame?.contentWindow;
        if (!readerWindow) {
            status.textContent = '请等教材页面显示后再试。';
            return;
        }

        const pageUrl = location.href;
        const frameUrl = frame.src;
        const title = document.querySelector('h3')?.textContent;
        button.disabled = true;
        status.textContent = '正在读取整本教材，请稍候…';
        try {
            const result = frameUrl.startsWith(`${textbookOrigin}/`)
                ? await readPdf(readerWindow)
                : await readRemotePdf(readerWindow);
            if (location.href !== pageUrl || !frame.isConnected || frame.src !== frameUrl) {
                status.textContent = switchedError;
                return;
            }
            if (!(result?.blob instanceof Blob) || result.blob.type !== 'application/pdf') {
                status.textContent = result?.error || readError;
                return;
            }
            const filename = pdfFilename(title) || pdfFilename(result.filename) || '教材.pdf';
            savePdf(result.blob, filename);
            status.textContent = '已发起下载，请查看浏览器的下载列表。';
        } catch {
            status.textContent = readError;
        } finally {
            button.disabled = false;
        }
    });
}());
