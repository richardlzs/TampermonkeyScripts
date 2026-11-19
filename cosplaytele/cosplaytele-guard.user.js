// ==UserScript==
// @name         Cosplaytele 点击广告修复
// @namespace    https://github.com/richardlzs/TampermonkeyScripts
// @version      1.2.1
// @description  拦截 Cosplaytele 的点击弹窗、脚本外跳和动态加载的广告代码。
// @match        *://cosplaytele.com/*
// @match        *://www.cosplaytele.com/*
// @updateURL    https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/cosplaytele/cosplaytele-guard.user.js
// @downloadURL  https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/cosplaytele/cosplaytele-guard.user.js
// @run-at       document-start
// @sandbox      raw
// @grant        none
// @noframes
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    // 必须在页面的 MAIN_WORLD 中提前运行；隔离世界的原型拦截对页面无效。
    const ownScript = document.currentScript;
    const blockedMessage = 'CosplayteleGuard: advertising script aborted';
    const reported = new Set();
    const siteHost = 'cosplaytele.com';
    const popupHosts = [siteHost, 't.me', 'sorafolder.com', 'gofile.io', 'mediafire.com', 'x.com'];

    function parseUrl(value) {
        try {
            return new URL(value, document.baseURI);
        } catch {
            return null;
        }
    }

    function isWebUrl(url) {
        return url?.protocol === 'https:' || url?.protocol === 'http:';
    }

    function hostMatches(hostname, domain) {
        const host = hostname.replace(/\.$/, '');
        return host === domain || host.endsWith(`.${domain}`);
    }

    function isAllowedDestination(url) {
        return isWebUrl(url) && popupHosts.some(host => hostMatches(url.hostname, host));
    }

    function report(reason, host = '') {
        const message = host ? `${reason} (${host})` : reason;
        if (reported.has(message)) return;
        reported.add(message);
        console.info(`[Cosplaytele Guard] 已阻止：${message}`);
    }

    function advertisingScript() {
        const script = document.currentScript;
        if (!script || script === ownScript || script.localName !== 'script') return '';

        if (!script.hasAttribute('src')) {
            // 识别两版加载器的代码特征，外部广告服务器换域名时仍可匹配。
            const source = script.textContent || '';
            const legacyLoader = /\bload1spAndCustomPops\s*\(/.test(source);
            const externalLoader = /\bs\.settings\s*=\s*ulgt\b/.test(source)
                && source.includes('insertBefore(s, l)');
            return legacyLoader || externalLoader ? '点击弹窗广告' : '';
        }

        const url = parseUrl(script.src);
        return url?.hostname === 'cdn.ouo.io' && url.pathname === '/js/full-page-script.js'
            ? 'ouo.io 下载链接改写' : '';
    }

    function abortAdvertisingScript() {
        const reason = advertisingScript();
        if (!reason) return;
        report(reason);
        throw new ReferenceError(blockedMessage);
    }

    // 只隐藏本脚本主动抛出的中止异常，其他页面错误照常报告。
    window.addEventListener('error', (event) => {
        if (event.error instanceof ReferenceError && event.error.message === blockedMessage) {
            event.preventDefault();
        }
    });

    function guardMethod(owner, property) {
        const descriptor = Object.getOwnPropertyDescriptor(owner, property);
        if (!descriptor?.configurable || typeof descriptor.value !== 'function') return;
        let method = descriptor.value;

        Object.defineProperty(owner, property, {
            configurable: true,
            enumerable: descriptor.enumerable,
            get() {
                abortAdvertisingScript();
                return method;
            },
            set(value) {
                abortAdvertisingScript();
                if (this === owner) {
                    method = value;
                } else {
                    // 保留普通对象覆盖继承方法的原生语义，不影响其他实例。
                    Object.defineProperty(this, property, {
                        value, writable: true, enumerable: true, configurable: true,
                    });
                }
            },
        });
    }

    function blockDynamicScript(value) {
        // 仅检查由脚本设置的 <script src>，普通图片、样式和视频加载不经过这里。
        const url = parseUrl(value);
        if (!isWebUrl(url) || hostMatches(url.hostname, siteHost)
            || url.origin === 'https://www.googletagmanager.com') return false;
        report('动态第三方脚本', url.hostname);
        return true;
    }

    function guardDynamicScripts() {
        const prototype = HTMLScriptElement.prototype;
        const src = Object.getOwnPropertyDescriptor(prototype, 'src');
        if (src?.configurable && src.set) {
            Object.defineProperty(prototype, 'src', {
                ...src,
                set(value) {
                    if (!(this instanceof HTMLScriptElement) || !blockDynamicScript(value)) {
                        Reflect.apply(src.set, this, [value]);
                    }
                },
            });
        }

        const nativeSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function setAttribute(name, value) {
            if (typeof name === 'string' && name.toLowerCase() === 'src'
                && this instanceof HTMLScriptElement && blockDynamicScript(value)) return;
            return Reflect.apply(nativeSetAttribute, this, arguments);
        };
    }

    function guardNavigation() {
        const nativeOpen = window.open;
        window.open = function open(destination, ...options) {
            // 广告可以先开出空白标签页，随后再写入实际地址。
            const address = destination == null ? '' : String(destination).trim();
            const url = address ? parseUrl(address) : null;
            if (!isAllowedDestination(url)) {
                report('脚本弹窗', url?.hostname);
                return null;
            }
            return Reflect.apply(nativeOpen, this, [url.href, ...options]);
        };

        function blockSyntheticLink(event) {
            if (event.isTrusted) return;
            const target = event.target instanceof Element ? event.target : event.target?.parentElement;
            const link = target?.closest('a[href], area[href]');
            if (!link) return;
            const url = parseUrl(link.getAttribute('href'));
            if (!isWebUrl(url) || isAllowedDestination(url)) return;
            report('脚本触发的外部链接', url.hostname);
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        window.addEventListener('click', blockSyntheticLink, true);
        window.addEventListener('auxclick', blockSyntheticLink, true);

        // 支持 Navigation API 的浏览器可以取消一部分同标签页的脚本外跳。
        window.navigation?.addEventListener('navigate', (event) => {
            if (!event.cancelable || event.userInitiated || event.navigationType === 'traverse') return;
            const url = parseUrl(event.destination.url);
            if (!isWebUrl(url) || isAllowedDestination(url)) return;
            report('同标签页脚本外跳', url.hostname);
            event.preventDefault();
        });
    }

    // 旧版先探测事件监听功能，新版一开始就创建外部 script 元素。
    guardMethod(EventTarget.prototype, 'addEventListener');
    guardMethod(Document.prototype, 'createElement');
    guardDynamicScripts();
    guardNavigation();
    console.info('[Cosplaytele Guard] 已启用');
})();
