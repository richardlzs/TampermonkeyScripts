// ==UserScript==
// @name         智慧中小学 · 下载教材 PDF
// @namespace    TampermonkeyScripts/smartedu
// @version      1.0.1
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
    const titleRequest = 'smartedu-pdf:request-title';

    // 教材页与阅读器不同源，由教材页把标题发给自己的阅读器。
    if (location.origin === textbookOrigin) {
        if (location.pathname !== '/tchMaterial/detail') return;
        window.addEventListener('message', (event) => {
            const reply = event.ports[0];
            if (event.origin !== viewerOrigin || event.data !== titleRequest || !reply) return;
            const frames = document.querySelectorAll(`iframe[src^="${viewerOrigin}${viewerPath}?"]`);
            if (!Array.from(frames).some((frame) => frame.contentWindow === event.source)) return;
            reply.postMessage(document.querySelector('h3')?.textContent.trim() || '');
            reply.close();
        });
        return;
    }

    if (location.origin !== viewerOrigin || location.pathname !== viewerPath ||
        window.top === window.self || !document.referrer ||
        new URL(document.referrer).origin !== textbookOrigin ||
        !new URLSearchParams(location.search).has('file') ||
        document.getElementById('smartedu-pdf-download')) return;

    const host = document.createElement('div');
    host.id = 'smartedu-pdf-download';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        :host { position: fixed; right: 16px; bottom: 16px; z-index: 9999;
            max-width: calc(100% - 32px); text-align: right; }
        button, .status { font: 14px/1.45 system-ui, sans-serif; border-radius: 8px; }
        button { padding: 8px 14px; border: 1px solid #164da8; background: #185ac8;
            color: #fff; cursor: pointer; box-shadow: 0 2px 8px #0004; }
        button:hover:not(:disabled) { background: #154a9f; }
        button:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
        button:disabled { opacity: .8; cursor: wait; }
        .status { display: block; margin-bottom: 6px; padding: 6px 10px;
            background: #222; color: #fff; }
        .status:empty { display: none; }
    `;
    const status = document.createElement('span');
    status.className = 'status';
    status.setAttribute('role', 'status');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '下载教材 PDF';
    root.append(style, status, button);
    document.body.append(host);

    function readTextbookTitle() {
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            const timeout = setTimeout(finish, 500);

            function finish(title = '') {
                clearTimeout(timeout);
                channel.port1.close();
                resolve(title);
            }

            channel.port1.onmessage = (event) => finish(typeof event.data === 'string' ? event.data : '');
            try {
                window.parent.postMessage(titleRequest, textbookOrigin, [channel.port2]);
            } catch {
                channel.port2.close();
                finish();
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

    function savePdf(data, filename) {
        const blob = new Blob([data], { type: 'application/pdf' });
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
        const viewer = unsafeWindow.PDFViewerApplication;
        const pdf = viewer?.pdfDocument;
        if (typeof pdf?.getData !== 'function') {
            status.textContent = '请等教材页面显示后再试。';
            return;
        }

        button.disabled = true;
        status.textContent = '正在读取整本教材，请稍候…';
        try {
            // 让当前 PDF.js 文档通过自身的加载流程补齐尚未加载的内容。
            const [data, title] = await Promise.all([pdf.getData(), readTextbookTitle()]);
            if (viewer.pdfDocument !== pdf) {
                status.textContent = '教材已切换，请重新点击下载。';
                return;
            }
            if (!data || !new TextDecoder().decode(data.subarray(0, 1024)).includes('%PDF-')) {
                status.textContent = '阅读器未返回有效的 PDF。';
                return;
            }
            const filename = pdfFilename(title) || pdfFilename(viewer._docFilename) || '教材.pdf';
            savePdf(data, filename);
            status.textContent = '已发起下载，请查看浏览器的下载列表。';
        } catch {
            status.textContent = '无法读取完整 PDF，请刷新教材页后重试。';
        } finally {
            button.disabled = false;
        }
    });
}());
