'use strict';

// Offline only: the userscript is evaluated in an isolated VM with synthetic
// storage, a small Vue stub, and an HTTP stub that never opens a connection.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { inspect } = require('node:util');

const SCRIPT_PATH = path.join(__dirname, 'pikpak-helper-plus.user.js');
const CONFIG_KEY = 'pikpakSecureRpcConfig.v1';
const SECRET = 'synthetic-aria2-secret-never-render';
const PIKPAK_SECRET = 'synthetic-pikpak-access-token';
const RPC = 'http://127.0.0.1:6800/jsonrpc';
const DOWNLOAD_URL = 'https://cdn.example.test/file?signature=a=b';
const source = fs.readFileSync(SCRIPT_PATH, 'utf8');

const hookNames = [
  'normalizeRpcEndpoint', 'normalizeDownloadRoot', 'validateRemoteName',
  'buildDownloadOptions', 'parseExtraParams', 'getAriaConfig', 'saveAriaConfig',
  'setRpcToken', 'clearRpcToken', 'clearLegacyRpcConfig', 'callAria2',
  'request', 'getDownload',
];
const hookExpression = hookNames.map(name => `${name}: typeof ${name} === 'undefined' ? undefined : ${name}`).join(',\n');
assert.match(source, /\}\)\(Vue\);\s*$/, 'The upstream IIFE must remain recognizable for test-only instrumentation.');
const instrumented = source.replace(/\}\)\(Vue\);\s*$/, `
  globalThis.__testHooks = {
    ${hookExpression},
    configComponent: typeof AriaConfigDialog === 'undefined' ? undefined : AriaConfigDialog
  };
})(Vue);`);

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createRuntime(options = {}) {
  const privateStore = new Map(Object.entries(options.privateStore || {}));
  const pageStore = new Map(Object.entries(options.pageStore || {}));
  const requests = [];
  const pageFetches = [];
  const logs = [];
  const dialogs = [];
  const menus = [];
  const elements = [];
  const mounted = [];
  const timers = [];
  const events = [];
  const pageReads = [];
  const promptValues = [...(options.promptValues || [])];
  const location = new URL(options.location || 'https://mypikpak.com/drive/all');
  const localStorage = {
    get length() { return pageStore.size; },
    key(index) { return [...pageStore.keys()][index] ?? null; },
    getItem(key) { pageReads.push(key); return pageStore.get(key) ?? null; },
    setItem(key, value) { pageStore.set(key, String(value)); },
    removeItem(key) { pageStore.delete(key); },
  };
  const vnode = (tag, props, children) => ({ tag, props: props || {}, children });
  const Vue = {
    pushScopeId() {}, popScopeId() {}, openBlock() {},
    ref(value) { return { value }; }, reactive(value) { return value; },
    computed(fn) { return { get value() { return fn(); } }; },
    watch() {}, onMounted(fn) { mounted.push(fn); }, onUnmounted() {},
    createApp() { return { mount() { throw new Error('Offline test must not mount the application.'); } }; },
    createElementVNode: vnode, createElementBlock: vnode, createVNode: vnode,
    createBlock: vnode,
    createTextVNode(value) { return { text: String(value) }; },
    createCommentVNode(value) { return { comment: value }; },
    withCtx(fn) { return fn; }, withModifiers(fn) { return fn; },
    withDirectives(node) { return node; },
    normalizeStyle(value) { return value; }, normalizeClass(value) { return value; },
    unref(value) { return value && typeof value === 'object' && 'value' in value ? value.value : value; },
    toDisplayString(value) { return value == null ? '' : String(value); },
    renderList(items, render) { return Array.from(items || [], render); },
    renderSlot() { return null; }, Fragment: 'fragment', vModelText: {},
  };
  const document = {
    readyState: 'loading', cookie: '',
    head: { appendChild(node) { elements.push(node); } },
    body: { insertBefore(node) { elements.push(node); } },
    createElement(tag) { return { tagName: tag, dataset: {}, innerText: '', style: {} }; },
    getElementById() { return null; },
    addEventListener(name, fn) { events.push({ name, fn }); },
    removeEventListener() {},
  };
  const sandbox = {
    URL, URLSearchParams, Request, document, location, localStorage, Vue,
    innerWidth: 1200, innerHeight: 800,
    console: Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map(level => [level, (...args) => logs.push({ level, args })])),
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
    clearTimeout() {}, setInterval() { throw new Error('Unexpected polling.'); }, clearInterval() {},
    addEventListener() {}, removeEventListener() {},
    alert(...args) { dialogs.push({ type: 'alert', args }); },
    confirm(...args) { dialogs.push({ type: 'confirm', args }); return false; },
    prompt(...args) { dialogs.push({ type: 'prompt', args }); return promptValues.length ? promptValues.shift() : null; },
    fetch(...args) { pageFetches.push(args); return Promise.reject(new Error('Page fetch is forbidden in offline tests.')); },
    GM_info: options.gmInfo || { scriptHandler: 'Tampermonkey', version: '5.5.1' },
    GM_getValue(key, fallback) { return privateStore.has(key) ? structuredClone(privateStore.get(key)) : fallback; },
    GM_setValue(key, value) { privateStore.set(key, structuredClone(value)); },
    GM_deleteValue(key) { privateStore.delete(key); },
    GM_registerMenuCommand(label, callback) { menus.push({ label, callback }); return menus.length; },
    GM_notification(...args) { dialogs.push({ type: 'notification', args }); },
    GM_xmlhttpRequest(details) {
      requests.push(details);
      const pending = { abort() {} };
      queueMicrotask(() => {
        if (options.networkError) {
          details.onerror?.({ message: options.networkError, responseText: options.networkError });
          return;
        }
        const body = details.data ? JSON.parse(details.data) : undefined;
        const result = options.respond
          ? options.respond(details, body)
          : { jsonrpc: '2.0', id: body?.id, result: body?.method === 'aria2.addUri' ? '0123456789abcdef' : { version: '1.37.0' } };
        details.onload?.({ status: 200, response: result, responseText: JSON.stringify(result), finalUrl: details.url, responseHeaders: '', ...options.responseOverride });
      });
      return pending;
    },
  };
  if (options.omitGmHttp) delete sandbox.GM_xmlhttpRequest;
  sandbox.window = sandbox;
  sandbox.unsafeWindow = sandbox;
  const context = vm.createContext(sandbox);
  let initializationError;
  try {
    vm.runInContext(instrumented, context, { filename: SCRIPT_PATH, timeout: 2000 });
  } catch (error) {
    initializationError = error;
  }
  if (!options.allowInitFailure) {
    assert.ifError(initializationError);
    assert.ok(context.__testHooks, 'Test instrumentation must execute for a supported environment.');
    for (const name of hookNames.slice(0, 11)) assert.equal(typeof context.__testHooks[name], 'function', `Missing test contract: ${name}`);
  }
  return { hooks: context.__testHooks, context, privateStore, pageStore, requests, pageFetches, logs, dialogs, menus, elements, mounted, timers, events, pageReads, initializationError };
}

function configured(options = {}, config = {}) {
  const runtime = createRuntime(options);
  runtime.hooks.saveAriaConfig({ host: RPC, path: '/downloads', params: '', ...config });
  runtime.hooks.setRpcToken(SECRET);
  return runtime;
}

test('metadata declares private-storage and menu capabilities; no runtime code evaluation', () => {
  const header = source.slice(0, source.indexOf('// ==/UserScript=='));
  for (const grant of ['GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', 'GM_registerMenuCommand', 'GM_info']) {
    assert.match(header, new RegExp(`@grant\\s+${grant}\\s*(?:\\r?\\n|$)`));
  }
  assert.match(header, /@match\s+https:\/\/mypikpak\.com\/\*/);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
});

test('fork metadata identifies version 2.1.0 and uses only its own repository update links', () => {
  const header = source.slice(0, source.indexOf('// ==/UserScript=='));
  const metadata = Object.fromEntries([...header.matchAll(/^\/\/[ \t]+@(\S+)[ \t]+([^\r\n]+)\r?$/gm)].map(match => [match[1], match[2].trim()]));
  assert.equal(metadata.version, '2.1.0');
  assert.equal(metadata.namespace, 'https://github.com/richardlzs/TampermonkeyScripts/pikpak');
  assert.equal(metadata.homepageURL, 'https://github.com/richardlzs/TampermonkeyScripts/tree/main/pikpak');
  assert.equal(metadata.supportURL, 'https://github.com/richardlzs/TampermonkeyScripts/issues');
  assert.equal(metadata.source, 'https://github.com/richardlzs/TampermonkeyScripts/blob/main/pikpak/pikpak-helper-plus.user.js');
  for (const key of ['updateURL', 'downloadURL']) {
    assert.match(metadata[key], /^https:\/\/raw\.githubusercontent\.com\/richardlzs\/TampermonkeyScripts\/main\/pikpak\/pikpak-helper-plus\.(?:user|meta)\.js$/);
  }
  assert.doesNotMatch(header, /greasyfork\.org|sleazyfork\.org|google\.com/i);
});

test('initialization does not make requests or run mount callbacks', () => {
  const runtime = configured();
  assert.equal(runtime.requests.length, 0);
  assert.equal(runtime.pageFetches.length, 0);
  assert.ok(runtime.events.some(event => event.name === 'DOMContentLoaded'));
  assert.ok(runtime.menus.length >= 3, 'Sensitive operations should be available through script-manager menus.');
});

test('RPC endpoint accepts HTTPS and explicit loopback HTTP', () => {
  const { hooks } = createRuntime();
  for (const input of [RPC, 'http://localhost:6800/jsonrpc', 'http://[::1]:6800/jsonrpc', 'https://aria.example.test/jsonrpc', 'HTTPS://ARIA.EXAMPLE.TEST:443/jsonrpc']) {
    assert.equal(hooks.normalizeRpcEndpoint(input), new URL(input).href);
  }
});

test('RPC endpoint rejects remote HTTP, credentials, query, fragment, controls and other protocols', () => {
  const { hooks } = createRuntime();
  for (const input of ['', 'aria.example.test', '//aria.example.test/jsonrpc', 'http://aria.example.test/jsonrpc', 'http://192.168.1.2:6800/jsonrpc', 'http://localhost.example.test/jsonrpc', 'http://127.0.0.1.example.test/jsonrpc', 'https://user:password@aria.example.test/jsonrpc', `${RPC}?x=1`, `${RPC}#fragment`, 'file:///tmp/rpc', 'javascript:alert(1)', `${RPC}\n`]) {
    assert.throws(() => hooks.normalizeRpcEndpoint(input), undefined, input);
  }
});

test('download roots normalize absolute POSIX and drive-letter paths', () => {
  const { hooks } = createRuntime();
  for (const [input, expected] of [
    ['/downloads/', { style: 'posix', path: '/downloads' }],
    ['/', { style: 'posix', path: '/' }],
    ['D:\\Downloads\\', { style: 'windows', path: 'D:/Downloads' }],
    ['C:/', { style: 'windows', path: 'C:/' }],
  ]) assert.deepEqual(plain(hooks.normalizeDownloadRoot(input)), expected);
});

test('download roots reject relative, UNC, device and dot-segment paths', () => {
  const { hooks } = createRuntime();
  for (const input of ['', 'downloads', './downloads', 'C:Downloads', '\\\\server\\share', '//server/share', '\\\\?\\C:\\Downloads', '\\\\.\\C:\\Downloads', '/downloads/../outside', '/downloads/./child', 'D:\\Downloads\\..\\outside', '/downloads\u0000bad']) {
    assert.throws(() => hooks.normalizeDownloadRoot(input), undefined, JSON.stringify(input));
  }
});

test('remote names preserve valid Unicode and reject path/control characters', () => {
  const { hooks } = createRuntime();
  for (const style of ['posix', 'windows']) {
    for (const name of ['文件 01.mkv', 'A-B_2.txt', 'emoji-😀.txt']) assert.equal(hooks.validateRemoteName(name, style), name);
    for (const name of ['', '.', '..', '../escape', 'folder/file', 'folder\\file', 'bad\nname', 'bad\u0000name', 123, null]) assert.throws(() => hooks.validateRemoteName(name, style));
  }
  assert.equal(hooks.validateRemoteName('合法:文件?.txt', 'posix'), '合法:文件?.txt');
});

test('Windows names reject device names, reserved characters and ambiguous suffixes', () => {
  const { hooks } = createRuntime();
  for (const name of ['CON', 'con.txt', 'PRN.log', 'AUX', 'NUL.txt', 'COM1.txt', 'LPT1.log', 'x:y', 'x<y', 'x>y', 'x"y', 'x|y', 'x?y', 'x*y', 'trailing.', 'trailing ']) {
    assert.throws(() => hooks.validateRemoteName(name, 'windows'), undefined, name);
  }
});

test('console device aliases and C1 controls are rejected across security boundaries', () => {
  const { hooks } = createRuntime();
  for (const name of ['CONIN$', 'CONOUT$', 'conin$.txt', 'conout$.log']) {
    assert.throws(() => hooks.validateRemoteName(name, 'windows'), undefined, name);
  }
  for (const style of ['posix', 'windows']) assert.throws(() => hooks.validateRemoteName('bad\u0085name', style));
  assert.throws(() => hooks.normalizeRpcEndpoint(`${RPC}\u0085`));
  assert.throws(() => hooks.normalizeDownloadRoot('/downloads\u0085'));
  assert.throws(() => hooks.parseExtraParams('user-agent=bad\u0085value'));
  assert.throws(() => hooks.buildDownloadOptions({ path: '/downloads', params: '' }, { directorySegments: ['bad\u0085folder'] }, { name: 'safe.bin', web_content_link: DOWNLOAD_URL }));
});

test('extra parameters use the approved whitelist and retain equals signs in values', () => {
  const { hooks } = createRuntime();
  const parsed = plain(hooks.parseExtraParams('split=4;max-connection-per-server=2;min-split-size=20M;continue=true;max-tries=5;retry-wait=3;timeout=60;connect-timeout=10;max-download-limit=2M;user-agent=UA=a=b;referer=https://example.test/?a=b;all-proxy=http://proxy.test:8080;http-proxy=http://proxy.test:8081;https-proxy=http://proxy.test:8082;header=X-One: a=b;header=X-Two: c;'));
  assert.equal(parsed['user-agent'], 'UA=a=b');
  assert.equal(parsed.referer, 'https://example.test/?a=b');
  assert.deepEqual(parsed.header, ['X-One: a=b', 'X-Two: c']);
  assert.equal(parsed.split, '4');
  assert.equal(Object.keys(parsed).length, 15);
  assert.deepEqual(plain(hooks.parseExtraParams('')), {});
});

test('extra parameters reject unknown, duplicate, empty and CRLF entries', () => {
  const { hooks } = createRuntime();
  for (const input of ['dir=/outside', 'out=../outside', 'allow-overwrite=true', 'on-download-complete=bad', '__proto__=bad', 'constructor=bad', 'split=2;split=4', 'split=2;;timeout=3', '=value', 'split=', 'header=X-One: a\r\nX-Two: b', 'user-agent=bad\u0000value']) {
    assert.throws(() => hooks.parseExtraParams(input), undefined, JSON.stringify(input));
  }
});

test('download options preserve directory segments and prevent legacy-path flattening', () => {
  const { hooks } = createRuntime();
  const config = { host: RPC, path: '/downloads', params: 'split=2' };
  const file = { name: '视频.mkv', web_content_link: DOWNLOAD_URL };
  assert.deepEqual(plain(hooks.buildDownloadOptions(config, { directorySegments: ['分享目录', '子目录'], path: '../../ignored' }, file)), { split: '2', dir: '/downloads/分享目录/子目录', out: '视频.mkv' });
  assert.throws(() => hooks.buildDownloadOptions(config, { path: 'legacy/subfolder' }, file));
  assert.deepEqual(plain(hooks.buildDownloadOptions({ ...config, path: 'D:\\Downloads\\' }, { directorySegments: ['Folder'] }, { ...file, name: 'safe.bin' })), { split: '2', dir: 'D:/Downloads/Folder', out: 'safe.bin' });
});

test('download option construction rejects unsafe segments, names and URLs', () => {
  const { hooks } = createRuntime();
  const config = { host: RPC, path: '/downloads', params: '' };
  const file = { name: 'safe.bin', web_content_link: DOWNLOAD_URL };
  for (const segment of ['..', '.', 'sub/escape', 'sub\\escape', 'bad\nname', 123]) assert.throws(() => hooks.buildDownloadOptions(config, { directorySegments: [segment] }, file));
  assert.throws(() => hooks.buildDownloadOptions(config, { directorySegments: [] }, { ...file, name: '../outside' }));
  for (const url of ['file:///tmp/file', 'javascript:alert(1)', 'data:text/plain,hello', 'https://user:password@cdn.example.test/file', `${DOWNLOAD_URL}#fragment`, `${DOWNLOAD_URL}\n`]) {
    assert.throws(() => hooks.buildDownloadOptions(config, { directorySegments: [] }, { ...file, web_content_link: url }));
  }
});

test('RPC configuration and secrets use private GM storage; public configuration never contains the token', () => {
  const runtime = configured();
  const record = runtime.privateStore.get(CONFIG_KEY);
  assert.equal(record.token, SECRET);
  assert.equal(record.tokenEndpoint, RPC);
  assert.equal(record.host, RPC);
  assert.deepEqual(Object.keys(plain(runtime.hooks.getAriaConfig())).sort(), ['hasToken', 'host', 'params', 'path']);
  assert.equal(runtime.hooks.getAriaConfig().hasToken, true);
  assert.equal(runtime.pageStore.size, 0);
  for (const value of [runtime.hooks.getAriaConfig(), runtime.logs, runtime.dialogs, runtime.elements, runtime.menus.map(menu => menu.label)]) assert.ok(!inspect(value, { depth: 10 }).includes(SECRET));
});

test('configuration DOM does not receive the private RPC token', () => {
  const runtime = configured();
  const component = runtime.hooks.configComponent;
  assert.equal(typeof component?.setup, 'function');
  const render = component.setup({ show: true }, { emit() {}, expose() {} });
  assert.equal(typeof render, 'function');
  for (const mounted of runtime.mounted) mounted();
  const tree = render({}, []);
  assert.ok(!inspect(tree, { depth: 30 }).includes(SECRET));
  assert.equal(runtime.requests.length, 0, 'Opening/rendering configuration must not send the secret automatically.');
});

test('menu-based secret changes do not prefill or echo an existing secret', () => {
  const replacement = 'new-synthetic-secret';
  const runtime = configured({ promptValues: [replacement] });
  const menu = runtime.menus.find(item => /设置|更换/.test(item.label) && /密钥/.test(item.label));
  assert.ok(menu, 'A private secret-entry menu must be registered.');
  menu.callback();
  assert.equal(runtime.privateStore.get(CONFIG_KEY).token, replacement);
  const prompts = runtime.dialogs.filter(dialog => dialog.type === 'prompt');
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].args[1], '', 'The previous secret must not be a prompt default.');
  for (const value of [runtime.logs, runtime.dialogs, runtime.elements, runtime.hooks.getAriaConfig()]) {
    const visible = inspect(value, { depth: 10 });
    assert.ok(!visible.includes(SECRET));
    assert.ok(!visible.includes(replacement));
  }
  assert.equal(runtime.requests.length, 0);
});

test('changing the RPC endpoint clears credentials while a path-only change retains them', () => {
  const runtime = configured();
  runtime.hooks.saveAriaConfig({ host: RPC, path: '/other-downloads', params: 'split=2' });
  assert.equal(runtime.hooks.getAriaConfig().hasToken, true);
  runtime.hooks.saveAriaConfig({ host: 'https://other.example.test/jsonrpc', path: '/downloads', params: '' });
  assert.equal(runtime.hooks.getAriaConfig().hasToken, false);
  assert.ok(!inspect(runtime.privateStore.get(CONFIG_KEY)).includes(SECRET));
  runtime.hooks.setRpcToken('different-synthetic-secret');
  runtime.hooks.clearRpcToken();
  assert.equal(runtime.hooks.getAriaConfig().hasToken, false);
  assert.ok(!inspect(runtime.privateStore.get(CONFIG_KEY)).includes('different-synthetic-secret'));
});

test('legacy origin storage is removed without migrating its host or secret', () => {
  const original = { ariaHost: 'https://attacker.example.test/jsonrpc', ariaPath: '/outside', ariaToken: 'legacy-secret', ariaParams: 'dir=/outside', unrelated: 'keep-me' };
  const runtime = createRuntime({ pageStore: original });
  runtime.hooks.clearLegacyRpcConfig();
  for (const key of ['ariaHost', 'ariaPath', 'ariaToken', 'ariaParams']) assert.equal(runtime.pageStore.has(key), false, key);
  assert.equal(runtime.pageStore.get('unrelated'), 'keep-me');
  assert.ok(!inspect(runtime.hooks.getAriaConfig()).includes('attacker.example.test'));
  assert.ok(!inspect([...runtime.privateStore]).includes('legacy-secret'));
  assert.equal(runtime.requests.length, 0);
});

test('normal dispatch uses the bound secret and restricted GM request options', async () => {
  const runtime = configured();
  const version = await runtime.hooks.callAria2('aria2.getVersion');
  assert.equal(version.result.version, '1.37.0');
  const options = runtime.hooks.buildDownloadOptions(runtime.hooks.getAriaConfig(), { directorySegments: ['Folder'] }, { name: 'safe.bin', web_content_link: DOWNLOAD_URL });
  const result = await runtime.hooks.callAria2('aria2.addUri', [[DOWNLOAD_URL], options]);
  assert.equal(result.result, '0123456789abcdef');
  assert.equal(runtime.requests.length, 2);
  for (const request of runtime.requests) {
    assert.equal(request.url, RPC);
    assert.equal(request.redirect, 'error');
    assert.equal(request.anonymous, true);
    assert.equal(request.fetch, true);
    assert.equal(JSON.parse(request.data).params[0], `token:${SECRET}`);
    assert.ok(!inspect(request.headers).includes(PIKPAK_SECRET));
  }
  assert.equal(runtime.pageFetches.length, 0);
});

test('page storage and post-initialization API overrides cannot redirect private RPC dispatch', async () => {
  const runtime = configured();
  runtime.pageStore.set('ariaHost', 'https://attacker.example.test/jsonrpc');
  runtime.pageStore.set('ariaToken', 'page-controlled-token');
  runtime.pageStore.set('ariaParams', 'dir=/outside');
  runtime.context.GM_getValue = () => ({ host: 'https://attacker.example.test/jsonrpc', token: SECRET });
  runtime.context.GM_xmlhttpRequest = () => { throw new Error('A page-replaced GM function must not be used.'); };
  await runtime.hooks.callAria2('aria2.getVersion');
  assert.equal(runtime.requests.length, 1);
  assert.equal(runtime.requests[0].url, RPC);
  assert.equal(JSON.parse(runtime.requests[0].data).params[0], `token:${SECRET}`);
  assert.equal(runtime.pageReads.includes('ariaHost'), false);
  assert.equal(runtime.pageReads.includes('ariaToken'), false);
});

test('PikPak credentials go only to its API and are never attached to aria2 requests', async () => {
  const runtime = configured({
    pageStore: {
      credentials_synthetic: JSON.stringify({ token_type: 'Bearer', access_token: PIKPAK_SECRET }),
      captcha_synthetic: JSON.stringify({ captcha_token: 'synthetic-captcha' }),
      deviceid: 'synthetic-device',
    },
    respond: (details, body) => new URL(details.url).hostname === 'api-drive.mypikpak.com'
      ? { id: 'file-id', name: 'safe.bin', web_content_link: DOWNLOAD_URL }
      : { jsonrpc: '2.0', id: body?.id, result: { version: '1.37.0' } },
  });
  const file = await runtime.hooks.getDownload('file-id');
  assert.equal(file.name, 'safe.bin');
  await runtime.hooks.callAria2('aria2.getVersion');
  assert.equal(runtime.requests.length, 2);
  const [apiRequest, rpcRequest] = runtime.requests;
  assert.equal(new URL(apiRequest.url).origin, 'https://api-drive.mypikpak.com');
  assert.equal(apiRequest.headers.Authorization, `Bearer ${PIKPAK_SECRET}`);
  assert.ok(!inspect(apiRequest, { depth: 5 }).includes(SECRET));
  assert.ok(!inspect(rpcRequest, { depth: 5 }).includes(PIKPAK_SECRET));
  assert.equal(rpcRequest.redirect, 'error');
  assert.equal(rpcRequest.anonymous, true);
  assert.equal(rpcRequest.fetch, true);
  assert.equal(runtime.pageFetches.length, 0);
});

test('RPC dispatch rejects unapproved methods and caller-injected authorization', async () => {
  const runtime = configured();
  for (const [method, params] of [
    ['aria2.remove', ['gid']], ['system.multicall', [[]]],
    ['aria2.getVersion', [`token:${SECRET}`]],
    ['aria2.addUri', [`token:${SECRET}`, [DOWNLOAD_URL], { dir: '/downloads', out: 'safe.bin' }]],
  ]) await assert.rejects(async () => runtime.hooks.callAria2(method, params));
  assert.equal(runtime.requests.length, 0);
});

test('RPC dispatch revalidates directory containment, output names, parameters and URLs', async () => {
  const runtime = configured();
  const options = { dir: '/downloads/Folder', out: 'safe.bin' };
  for (const [url, mutated] of [
    [DOWNLOAD_URL, { ...options, dir: '/outside' }],
    [DOWNLOAD_URL, { ...options, dir: '/downloads2/Folder' }],
    [DOWNLOAD_URL, { ...options, dir: '/downloads/../outside' }],
    [DOWNLOAD_URL, { ...options, out: '../escape' }],
    [DOWNLOAD_URL, { ...options, 'on-download-complete': 'bad' }],
    ['file:///etc/passwd', options],
    ['https://user:password@cdn.example.test/file', options],
  ]) await assert.rejects(async () => runtime.hooks.callAria2('aria2.addUri', [[url], mutated]));
  assert.equal(runtime.requests.length, 0);
});

test('Windows RPC dispatch checks drive roots and segment boundaries', async () => {
  const runtime = configured({}, { path: 'D:/Downloads' });
  await runtime.hooks.callAria2('aria2.addUri', [[DOWNLOAD_URL], { dir: 'd:/downloads/Folder', out: 'safe.bin' }]);
  for (const dir of ['C:/Downloads/Folder', 'D:/DownloadsSibling', 'D:/Downloads/../outside']) {
    await assert.rejects(async () => runtime.hooks.callAria2('aria2.addUri', [[DOWNLOAD_URL], { dir, out: 'safe.bin' }]));
  }
  assert.equal(runtime.requests.length, 1);
});

test('RPC rejects redirect and HTTP-failure response envelopes', async () => {
  for (const responseOverride of [{ status: 302 }, { status: 403 }, { finalUrl: 'https://attacker.example.test/jsonrpc' }]) {
    const runtime = configured({ responseOverride });
    await assert.rejects(() => runtime.hooks.callAria2('aria2.getVersion'));
    assert.equal(runtime.requests[0].redirect, 'error');
    assert.ok(!inspect(runtime.logs, { depth: 10 }).includes(SECRET));
  }
});

test('mismatched secret binding cannot disclose a previous endpoint token', async () => {
  const runtime = configured();
  const record = runtime.privateStore.get(CONFIG_KEY);
  record.host = 'https://other.example.test/jsonrpc';
  runtime.privateStore.set(CONFIG_KEY, record);
  try { await runtime.hooks.callAria2('aria2.getVersion'); } catch {}
  for (const request of runtime.requests) assert.ok(!request.data.includes(SECRET));
});

test('RPC failures never echo server text, request objects or secrets', async () => {
  const runtime = configured({ respond: () => ({ error: { code: -1, message: `untrusted-server-echo:${SECRET}` } }) });
  await assert.rejects(() => runtime.hooks.callAria2('aria2.getVersion'), error => {
    const visible = inspect(error, { depth: 10 });
    return !visible.includes(SECRET) && !visible.includes('untrusted-server-echo');
  });
  assert.ok(!inspect(runtime.logs, { depth: 10 }).includes(SECRET));
  const failedNetwork = configured({ networkError: `network-echo:${SECRET}` });
  await assert.rejects(() => failedNetwork.hooks.callAria2('aria2.getVersion'), error => !inspect(error, { depth: 10 }).includes(SECRET));
  assert.ok(!inspect(failedNetwork.logs, { depth: 10 }).includes(SECRET));
});

test('missing GM HTTP or unsupported Tampermonkey versions fail closed without page fetch', async () => {
  for (const options of [
    { omitGmHttp: true },
    { gmInfo: { scriptHandler: 'Tampermonkey', version: '5.5.0' } },
    { gmInfo: { scriptHandler: 'Violentmonkey', version: '99.0.0' } },
  ]) {
    const runtime = createRuntime({ ...options, allowInitFailure: true });
    if (runtime.hooks?.callAria2) {
      try {
        runtime.hooks.saveAriaConfig({ host: RPC, path: '/downloads', params: '' });
        runtime.hooks.setRpcToken(SECRET);
      } catch {}
      await assert.rejects(async () => runtime.hooks.callAria2('aria2.getVersion'));
    }
    assert.equal(runtime.pageFetches.length, 0);
    assert.equal(runtime.requests.length, 0);
  }
});
