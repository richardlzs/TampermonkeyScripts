// No browser or network access: run the guard and optional captured scripts in a mock DOM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const guard = fs.readFileSync(path.join(__dirname, 'cosplaytele-guard.user.js'), 'utf8');
let checks = 0;
function check(label, callback) {
    callback();
    checks += 1;
    console.log(`PASS ${label}`);
}

function environment() {
    const context = vm.createContext({ URL, console: { info() {}, log() {}, warn() {} } });
    vm.runInContext(`
        const records = { listeners: [], inserted: [], opens: [], timers: [] };
        class EventTarget {
            addEventListener(type, callback, options) {
                if (options && typeof options === 'object') void options.once;
                records.listeners.push({ target: this, type, callback });
            }
            removeEventListener() {}
            dispatchEvent(event) {
                for (const item of records.listeners.slice()) {
                    if (item.target === this && item.type === event.type && item.callback) {
                        item.callback.call(this, event);
                    }
                }
            }
        }
        class Node extends EventTarget {
            constructor() { super(); this._text = ''; }
            get textContent() { return this._text; }
            set textContent(value) { this._text = value; }
        }
        class Element extends Node {
            attrs = new Map();
            getAttribute(name) { return this.attrs.get(name.toLowerCase()) ?? null; }
            setAttribute(name, value) { this.attrs.set(name.toLowerCase(), String(value)); }
            matches() { return false; }
            closest() { return null; }
            getElementsByTagName() { return []; }
            appendChild(node) { records.inserted.push(node.src); return node; }
            insertBefore(node) { records.inserted.push(node.src); return node; }
        }
        class HTMLScriptElement extends Element {
            constructor(text = '') {
                super(); this.localName = 'script'; this.nodeName = 'SCRIPT';
                this.textContent = text; this.parentNode = new Element();
            }
            get src() { return this.getAttribute('src') ?? ''; }
            set src(value) { this.attrs.set('src', String(value)); }
            hasAttribute(name) { return this.getAttribute(name) !== null; }
        }
        class Document extends Node {
            constructor() {
                super(); this.currentScript = null; this.scripts = [];
                this.baseURI = 'https://cosplaytele.com/robin-2/';
                this.body = new Element(); this.documentElement = new Element();
                this.readyState = 'complete'; this.cookie = ''; this.anchors = [];
            }
            createElement(name) {
                return name.toLowerCase() === 'script' ? new HTMLScriptElement() : new Element();
            }
            getElementsByTagName(name) { return name === 'script' ? this.scripts : []; }
            querySelectorAll() { return this.anchors; }
        }
        class Window extends EventTarget {}
        Object.setPrototypeOf(globalThis, Window.prototype);
        Object.assign(globalThis, { EventTarget, Node, Element, HTMLScriptElement, Document, Window });
        globalThis.window = globalThis;
        globalThis.document = new Document();
        globalThis.location = new URL(document.baseURI);
        globalThis.navigator = { userAgent: 'Mozilla/5.0 Chrome/130.0 AppleWebKit/537.36', platform: 'Win32', appVersion: '5.0' };
        globalThis.screen = { width: 1280, height: 900, availHeight: 900 };
        globalThis.setInterval = (...args) => { records.timers.push(args); return records.timers.length; };
        globalThis.clearInterval = () => {};
        globalThis.setTimeout = (...args) => { records.timers.push(args); return records.timers.length; };
        globalThis.open = (...args) => { records.opens.push(args); return {}; };
        globalThis.navigation = new EventTarget();
        globalThis.parent = globalThis.top = globalThis.self = globalThis;
        globalThis.records = records;
    `, context);
    return context;
}

function execute(context, code, src = '') {
    context.scriptText = code;
    context.scriptSrc = src;
    vm.runInContext(`document.currentScript = new HTMLScriptElement(scriptText);
        if (scriptSrc) document.currentScript.attrs.set('src', scriptSrc);
        document.scripts.push(document.currentScript);`, context);
    try {
        return vm.runInContext(code, context, { timeout: 3000, filename: src || 'inline-script.js' });
    } finally {
        vm.runInContext('document.currentScript = null;', context);
    }
}

function install(context) { execute(context, guard); }
function evaluate(context, code) { return vm.runInContext(code, context); }

check('guard does not abort its own inline installation', () => install(environment()));
check('ordinary listeners register and run', () => {
    const context = environment(); install(context);
    execute(context, `window.addEventListener('click', () => { window.clicked = true; });`);
    evaluate(context, `window.dispatchEvent({ type: 'click' });`);
    assert.equal(context.clicked, true);
});
check('unrelated inline scripts, element creation and window.open are preserved', () => {
    const context = environment(); install(context);
    execute(context, `document.createElement('div'); window.open('https://gofile.io/d/example', '_blank');`);
    assert.equal(context.records.opens.length, 1);
});
check('inherited listener overrides affect only their own instance', () => {
    const context = environment(); install(context);
    assert.equal(evaluate(context, `(() => {
        const first = new Element(); const second = new Element();
        const original = second.addEventListener;
        first.addEventListener = () => 123;
        return first.addEventListener() === 123 && second.addEventListener === original;
    })()`), true);
});
check('known inline loader is stopped before installing a handler', () => {
    const context = environment(); install(context);
    assert.throws(() => execute(context, `function load1spAndCustomPops() {}
        window.addEventListener('mousedown', () => window.open('https://sore-war.com/'));`),
    /CosplayteleGuard: advertising script aborted/);
    assert.equal(context.records.listeners.filter(item => item.type === 'mousedown').length, 0);
});
check('element-creation checkpoint stops loader variants without the listener probe', () => {
    const context = environment(); install(context);
    assert.throws(() => execute(context, `function load1spAndCustomPops() {}
        document.createElement('script'); window.afterAd = true;`),
    /CosplayteleGuard: advertising script aborted/);
    assert.equal(context.afterAd, undefined);
});
check('unrelated third-party scripts can still register listeners', () => {
    const context = environment(); install(context);
    execute(context, `document.addEventListener('DOMContentLoaded', () => {});`, 'https://cdn.example.com/gallery.js');
    assert.equal(context.records.listeners.filter(item => item.type === 'DOMContentLoaded').length, 1);
});
check('only the exact ouo.io script host and path are blocked', () => {
    const context = environment(); install(context);
    assert.throws(() => execute(context, `document.addEventListener('DOMContentLoaded', () => {});`,
        'https://cdn.ouo.io/js/full-page-script.js'), /advertising script aborted/);
    execute(context, `document.addEventListener('DOMContentLoaded', () => {});`,
        'https://cdn.ouo.io.example.org/js/full-page-script.js');
    assert.equal(context.records.listeners.filter(item => item.type === 'DOMContentLoaded').length, 1);
});
check('unknown and blank popups are blocked while site and download destinations reach the native method', () => {
    const context = environment(); install(context);
    evaluate(context, `
        for (const url of [undefined, '', '  ', 'about:blank#next', 'javascript:void(0)',
            '//unknown-ads.example/start', 'https://gofile.io.example/', 'https://gofile.io@fake.example/']) {
            if (open(url, '_blank') !== null) throw new Error('Unexpected popup');
        }
        open('/robin-2/', '_blank', 'noopener');
        open('https://www.mediafire.com/f/example', '_blank');
        open('https://gofile.io/d/example', '_blank');
    `);
    assert.deepEqual(structuredClone(context.records.opens), [
        ['https://cosplaytele.com/robin-2/', '_blank', 'noopener'],
        ['https://www.mediafire.com/f/example', '_blank'],
        ['https://gofile.io/d/example', '_blank'],
    ]);
});
check('a different loader cannot attach a new third-party script by src or setAttribute', () => {
    const context = environment(); install(context);
    assert.equal(evaluate(context, `(() => {
        const badProperty = document.createElement('script');
        const badAttribute = document.createElement('script');
        const sameSite = document.createElement('script');
        const analytics = document.createElement('script');
        const image = document.createElement('img');
        badProperty.src = '//unseen-ad.example/loader.js';
        badAttribute.setAttribute('SRC', 'https://cosplaytele.com.fake.example/loader.js');
        sameSite.src = '/assets/site.js';
        analytics.src = 'https://www.googletagmanager.com/gtm.js';
        image.setAttribute('src', 'https://cdn.example/gallery.jpg');
        return !badProperty.src && !badAttribute.src && sameSite.src === '/assets/site.js'
            && analytics.src.endsWith('/gtm.js') && image.getAttribute('src').endsWith('/gallery.jpg');
    })()`), true);
});
check('external link guard distinguishes script clicks from real clicks', () => {
    const context = environment(); install(context);
    assert.equal(evaluate(context, `(() => {
        const link = new Element();
        const child = new Element();
        child.closest = () => link;
        function canceled(url, isTrusted, type = 'click') {
            link.setAttribute('href', url);
            let stopped = false;
            const event = { type, target: child, isTrusted,
                preventDefault() { this.defaultPrevented = true; },
                stopImmediatePropagation() { stopped = true; } };
            window.dispatchEvent(event);
            return event.defaultPrevented && stopped;
        }
        return canceled('https://unseen-ad.example/', false)
            && canceled('https://unseen-ad.example/', false, 'auxclick')
            && !canceled('https://unseen-ad.example/', true)
            && !canceled('https://gofile.io/d/example', false)
            && !canceled('/robin-2/', false);
    })()`), true);
});
check('same-tab guard preserves user navigation, history and approved download URLs', () => {
    const context = environment(); install(context);
    assert.equal(evaluate(context, `(() => {
        function canceled(url, userInitiated, navigationType = 'push', cancelable = true) {
            const event = { type: 'navigate', destination: { url }, userInitiated, navigationType, cancelable,
                preventDefault() { this.defaultPrevented = true; } };
            window.navigation.dispatchEvent(event);
            return event.defaultPrevented;
        }
        const outside = 'https://unseen-ad.example/';
        return canceled(outside, false) && !canceled(outside, true) && !canceled(outside, false, 'traverse')
            && !canceled(outside, false, 'push', false) && !canceled('https://gofile.io/d/example', false)
            && !canceled('/robin-2/', false);
    })()`), true);
});

(async () => {
    const snapshotDirectory = process.argv[2];
    if (snapshotDirectory) {
        const adguardModule = await import(pathToFileURL(path.resolve(snapshotDirectory, 'package/dist/index.js')));
        const rules = fs.readFileSync(path.join(__dirname, 'adguard-rules.txt'), 'utf8');
        const snippets = new Map();
        for (const [, name, property, marker] of rules.matchAll(/scriptlet\('([^']+)', '([^']+)', '([^']+)'\)/g)) {
            snippets.set(marker, adguardModule.scriptlets.invoke({ name, args: [property, marker],
                engine: 'extension', version: adguardModule.SCRIPTLETS_VERSION, verbose: false }));
        }
        const legacyCode = snippets.get('load1spAndCustomPops');
        const currentCode = snippets.get('s.settings = ulgt');
        assert.equal(typeof legacyCode, 'string');
        assert.equal(typeof currentCode, 'string');
        for (const filename of ['popunder.js', 'article-popunder.js']) {
            const ad = fs.readFileSync(path.join(snapshotDirectory, filename), 'utf8');
            check(`captured ${filename}: baseline inserts an advertising script`, () => {
                const context = environment(); execute(context, ad);
                assert.ok(context.records.inserted.some(url => url.includes('sore-war.com')));
            });
            check(`captured ${filename}: userscript stops it before any advertising request or listener`, () => {
                const context = environment(); install(context);
                const listeners = context.records.listeners.length;
                assert.throws(() => execute(context, ad), /advertising script aborted/);
                assert.equal(context.records.inserted.length, 0);
                assert.equal(context.records.listeners.length, listeners);
            });
            check(`captured ${filename}: official AdGuard scriptlet stops it`, () => {
                const context = environment(); execute(context, legacyCode);
                assert.throws(() => execute(context, ad), error => error.name === 'ReferenceError');
                assert.equal(context.records.inserted.length, 0);
                assert.equal(context.records.listeners.length, 0);
            });
        }
        const currentSnapshotDirectory = process.argv[3];
        if (currentSnapshotDirectory) {
            for (const filename of ['category.html', 'robin.html']) {
                const html = fs.readFileSync(path.join(currentSnapshotDirectory, filename), 'utf8');
                const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
                const loaders = scripts.filter(([, source]) => source.includes('s.settings = ulgt'));
                assert.equal(loaders.length, 1, filename);
                const [, loader] = loaders[0];
                check(`current ${filename}: legacy rule misses the new loader`, () => {
                    const context = environment(); execute(context, legacyCode);
                    execute(context, loader);
                    assert.match(context.records.inserted[0], /^\/\/zesty-career\.com\//);
                });
                check(`current ${filename}: AdGuard aborts the loader and preserves ordinary scripts`, () => {
                    const context = environment(); execute(context, currentCode);
                    assert.throws(() => execute(context, loader), error => error.name === 'ReferenceError');
                    assert.equal(context.records.inserted.length, 0);
                    assert.equal(execute(context, `document.createElement('div') instanceof Element`), true);
                });
                check(`current ${filename}: userscript aborts the loader even after an ad-domain change`, () => {
                    const context = environment(); install(context);
                    const rotated = loader.replaceAll('zesty-career.com', 'rotated.example');
                    assert.notEqual(rotated, loader);
                    assert.throws(() => execute(context, rotated), /advertising script aborted/);
                    assert.equal(context.records.inserted.length, 0);
                });
            }
        }
        const ouo = fs.readFileSync(path.join(snapshotDirectory, 'ouo.js'), 'utf8');
        for (const enabled of [false, true]) {
            check(`captured ouo.io script: ${enabled ? 'guard preserves' : 'baseline rewrites'} Gofile URL`, () => {
                const context = environment();
                evaluate(context, `window.ouo_token = 'example'; window.domains = ['gofile.io'];
                    document.anchors = [{ nodeName: 'A', href: 'https://gofile.io/d/example',
                        setAttribute(name, value) { this[name] = value; } }];`);
                if (enabled) install(context);
                if (enabled) {
                    assert.throws(() => execute(context, ouo, 'https://cdn.ouo.io/js/full-page-script.js'),
                        /advertising script aborted/);
                } else {
                    execute(context, ouo, 'https://cdn.ouo.io/js/full-page-script.js');
                }
                evaluate(context, `document.dispatchEvent({ type: 'DOMContentLoaded' });`);
                const href = evaluate(context, 'document.anchors[0].href');
                assert.ok(enabled ? href === 'https://gofile.io/d/example' : href.startsWith('http://ouo.io/st/'));
            });
        }
    }
    console.log(`${checks} checks passed${snapshotDirectory ? ' (including captured scripts and official AdGuard code)' : ''}.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
