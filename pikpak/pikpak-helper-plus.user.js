// ==UserScript==
// @name         PikPak 助手 plus 安全修复版
// @namespace    https://github.com/richardlzs/TampermonkeyScripts/pikpak
// @version      2.1.0
// @author       Richard (based on jdysya)
// @description  PikPak 文件与分享页推送 aria2，隔离 RPC 凭据、限制传输地址并校验下载路径
// @license      MIT
// @homepageURL  https://github.com/richardlzs/TampermonkeyScripts/tree/main/pikpak
// @supportURL   https://github.com/richardlzs/TampermonkeyScripts/issues
// @source       https://github.com/richardlzs/TampermonkeyScripts/blob/main/pikpak/pikpak-helper-plus.user.js
// @match        https://mypikpak.com/*
// @require      https://cdn.jsdelivr.net/npm/vue@3.4.37/dist/vue.global.prod.js
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @connect      api-drive.mypikpak.com
// @connect      localhost
// @connect      127.0.0.1
// @connect      ::1
// @run-at       document-start
// @noframes
// @downloadURL  https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/pikpak/pikpak-helper-plus.user.js
// @updateURL    https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/pikpak/pikpak-helper-plus.user.js
// ==/UserScript==

/*
 * Derived from pikpakHelpr-plus 2.0.1 by jdysya (MIT).
 * Upstream: https://github.com/jdysya/pikpakHelpr-plus
 * Security modifications Copyright (c) 2026 Richard.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(a=>{const inject=()=>{const t=document.createElement("style");t.dataset.source="vite-plugin-monkey";t.innerText=a;document.head.appendChild(t)};if(document.head)inject();else document.addEventListener("DOMContentLoaded",inject,{once:true})})(' .lbl-m[data-v-220666cb]{display:none}.lbl-d[data-v-220666cb]{display:inline}.summary[data-v-220666cb]{margin-bottom:16px;padding:16px 20px;background:linear-gradient(135deg,rgba(99,102,241,.05) 0%,rgba(168,85,247,.05) 100%);border-radius:12px;border:1px solid rgba(99,102,241,.1)}.summary-stats[data-v-220666cb]{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}.stat-badge[data-v-220666cb]{display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}.folder-badge[data-v-220666cb]{background:rgba(251,191,36,.15);color:#b45309;border:1px solid rgba(251,191,36,.3)}.file-badge[data-v-220666cb]{background:rgba(99,102,241,.1);color:#4f46e5;border:1px solid rgba(99,102,241,.2)}.unknown-badge[data-v-220666cb]{background:rgba(107,114,128,.1);color:#6b7280;border:1px solid rgba(107,114,128,.2)}.summary-size[data-v-220666cb]{font-size:14px;color:#6b7280;font-weight:500}.file-list[data-v-220666cb]{min-height:120px;max-height:420px;overflow-y:auto;overflow-x:hidden;border:2px solid #f1f5f9;border-radius:16px;padding:0;margin:0;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);box-shadow:inset 0 2px 4px #0000000f;list-style:none}.file-list[data-v-220666cb]::-webkit-scrollbar{width:8px}.file-list[data-v-220666cb]::-webkit-scrollbar-track{background:#f1f5f9;border-radius:8px}.file-list[data-v-220666cb]::-webkit-scrollbar-thumb{background:linear-gradient(135deg,#cbd5e1 0%,#94a3b8 100%);border-radius:8px}.file-list[data-v-220666cb]::-webkit-scrollbar-thumb:hover{background:linear-gradient(135deg,#94a3b8 0%,#64748b 100%)}.file-item[data-v-220666cb]{display:flex;align-items:center;padding:12px 20px;border-bottom:1px solid rgba(226,232,240,.6);font-size:14px;color:#334155;transition:background .2s ease}.file-item[data-v-220666cb]:last-child{border-bottom:none}.file-item[data-v-220666cb]:hover{background:rgba(99,102,241,.03)}.file-item .icon[data-v-220666cb]{margin-right:12px;font-size:1.4em;filter:drop-shadow(0 1px 2px rgba(0,0,0,.1));flex-shrink:0}.file-item .file-name[data-v-220666cb]{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-grow:1}.file-item .unknown-name[data-v-220666cb]{color:#9ca3af;font-family:monospace;font-size:12px}.file-item .file-size[data-v-220666cb]{margin-left:auto;color:#64748b;font-size:12px;font-weight:500;padding:4px 8px;background:rgba(248,250,252,.8);border-radius:6px;border:1px solid rgba(226,232,240,.5);white-space:nowrap;flex-shrink:0}.file-item .file-tag[data-v-220666cb]{margin-left:auto;color:#92400e;font-size:11px;font-weight:600;padding:3px 10px;background:rgba(251,191,36,.1);border-radius:12px;border:1px solid rgba(251,191,36,.25);white-space:nowrap;flex-shrink:0}.file-item .unknown-tag[data-v-220666cb]{color:#6b7280;background:rgba(107,114,128,.08);border-color:#6b728026}.folder-item[data-v-220666cb]{background:rgba(251,191,36,.02)}.folder-size[data-v-220666cb]{color:#b45309!important;background:rgba(251,191,36,.08)!important;border-color:#fbbf2433!important}.unmatched-item[data-v-220666cb]{background:rgba(107,114,128,.02)}.loading-spinner[data-v-220666cb]{width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:spin-220666cb .8s linear infinite;margin-bottom:16px}@keyframes spin-220666cb{to{transform:rotate(360deg)}}.empty-state[data-v-220666cb]{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;padding:32px 20px;margin-bottom:16px;border:2px dashed #e2e8f0;border-radius:16px;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)}.empty-icon[data-v-220666cb]{font-size:3em;margin-bottom:12px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.1))}.empty-title[data-v-220666cb]{font-size:16px;font-weight:600;color:#374151;text-align:center;margin-bottom:8px}.empty-guide[data-v-220666cb]{font-size:14px;color:#6b7280;text-align:center;max-width:320px;line-height:1.6}.progress-section[data-v-220666cb]{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:240px;padding:32px 20px}.progress-icon[data-v-220666cb]{margin-bottom:16px}.progress-title[data-v-220666cb]{font-size:18px;font-weight:700;color:#1e293b;margin-bottom:20px}.progress-bar-track[data-v-220666cb]{width:100%;max-width:400px;height:10px;background:#e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:12px}.progress-bar-fill[data-v-220666cb]{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:10px;transition:width .3s ease;box-shadow:0 0 8px #6366f166}.progress-stats[data-v-220666cb]{display:flex;gap:16px;align-items:center;font-size:14px;color:#475569;margin-bottom:12px;flex-wrap:wrap;justify-content:center}.progress-stats .stat-progress[data-v-220666cb]{font-weight:700;color:#4f46e5}.progress-stats .stat-pct[data-v-220666cb]{font-weight:600;color:#6366f1}.progress-stats .stat-result[data-v-220666cb]{font-size:13px}.progress-detail[data-v-220666cb]{font-size:13px;color:#64748b;max-width:360px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media (max-width: 768px){.summary-stats[data-v-220666cb]{flex-direction:column;gap:6px}}@media (max-width: 480px){.file-list[data-v-220666cb]{max-height:none}.lbl-d[data-v-220666cb]{display:none}.lbl-m[data-v-220666cb]{display:inline}.summary[data-v-220666cb]{padding:12px 14px;margin-bottom:12px}.file-item[data-v-220666cb]{padding:10px 14px;font-size:13px}.file-item .icon[data-v-220666cb]{font-size:1.2em;margin-right:8px}.file-item .file-size[data-v-220666cb],.file-item .file-tag[data-v-220666cb]{font-size:11px;padding:2px 6px}}.dialog[data-v-7e65647b]{max-width:500px}.config-list[data-v-7e65647b]{margin-top:20px}.config-list li[data-v-7e65647b]{margin-bottom:15px}.config-list li .label[data-v-7e65647b]{font-weight:700;margin-bottom:5px;display:block;color:#555}.config-list li input[type=text][data-v-7e65647b]{width:100%;padding:10px;border:1px solid #dcdfe6;border-radius:4px;box-sizing:border-box;font-size:14px;transition:border-color .3s ease}.config-list li input[type=text][data-v-7e65647b]:focus{border-color:#409eff;outline:none}.footer[data-v-7e65647b]{justify-content:flex-end}.guidance[data-v-7e65647b]{font-size:12px;color:#909399;margin-top:5px;line-height:1.5}.aria2-tip[data-v-ef33c69b]{padding:15px 20px;position:absolute;top:30px;left:50%;transform:translate(-50%);color:#fff;border-radius:8px;box-shadow:0 4px 12px #00000026;font-size:14px;z-index:10001;min-width:300px;text-align:center;display:flex;align-items:center;gap:10px}.aria2-tip--success[data-v-ef33c69b]{background:rgba(103,194,58,.9)}.aria2-tip--error[data-v-ef33c69b]{background:rgba(245,108,108,.9)}.aria2-tip--warning[data-v-ef33c69b]{background:rgba(230,162,60,.9)}.aria2-tip--info[data-v-ef33c69b]{background:rgba(64,158,255,.9)}.aria2-tip__icon[data-v-ef33c69b]{font-size:18px;font-weight:700;flex-shrink:0}.aria2-tip__content[data-v-ef33c69b]{flex:1}.floating-window[data-v-d0fff8dd]{position:fixed;z-index:9999;-webkit-user-select:none;user-select:none;transition:all .2s ease}.floating-window.dragging[data-v-d0fff8dd]{transition:none}.download-button[data-v-d0fff8dd]{display:flex;align-items:center;justify-content:center;width:50px;height:50px;padding:0;background:linear-gradient(135deg,#409eff,#66b1ff);border-radius:50%;cursor:pointer;box-shadow:0 4px 12px #409eff4d;color:#fff;transition:all .3s ease}.download-button[data-v-d0fff8dd]:hover{transform:scale(1.05);box-shadow:0 6px 16px #409eff66}.download-button[data-v-d0fff8dd]:active{transform:scale(.95)}.dialog-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background-color:#0009;z-index:3000}.dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);z-index:10000;padding:32px;box-shadow:0 25px 50px -12px #00000040,0 0 0 1px #ffffff0d;border-radius:20px;width:90vw;max-width:800px;min-width:320px;max-height:90vh;box-sizing:border-box;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.2);animation:dialogFadeIn .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;overflow:hidden}@keyframes dialogFadeIn{0%{opacity:0;transform:translate(-50%,-50%) scale(.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}.dialog h2{text-align:center;color:#1e293b;margin-bottom:24px;font-size:24px;font-weight:700;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.dialog .close{position:absolute;right:20px;top:20px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;color:#64748b;background:rgba(248,250,252,.8);border-radius:50%;transition:all .3s cubic-bezier(.4,0,.2,1);border:1px solid rgba(226,232,240,.5)}.dialog .close:hover{color:#ef4444;background:rgba(254,226,226,.8);border-color:#f871714d;transform:scale(1.05)}.btn.el-button{padding:14px 28px;border:none;border-radius:12px;cursor:pointer;font-size:16px;font-weight:600;transition:all .3s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}.btn.el-button:before{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);transition:left .5s}.btn.el-button:hover:before{left:100%}.btn.el-button--primary{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#fff;box-shadow:0 4px 14px #6366f14d}.btn.el-button--primary:hover{background:linear-gradient(135deg,#5b21b6 0%,#7c3aed 100%);box-shadow:0 8px 25px #6366f166;transform:translateY(-2px)}.btn.el-button--secondary{background:linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%);color:#475569;border:2px solid #cbd5e1;box-shadow:0 2px 8px #4755691a}.btn.el-button--secondary:hover{background:linear-gradient(135deg,#e2e8f0 0%,#cbd5e1 100%);border-color:#94a3b8;box-shadow:0 4px 12px #47556926;transform:translateY(-2px)}.btn.el-button:active{transform:translateY(0);box-shadow:0 4px 14px #6366f14d}.footer{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-top:20px;border-top:1px solid rgba(226,232,240,.6);flex-shrink:0;margin-top:auto}.dialog-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden}.dialog-body::-webkit-scrollbar{width:6px}.dialog-body::-webkit-scrollbar-track{background:transparent}.dialog-body::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:6px}.dialog-body::-webkit-scrollbar-thumb:hover{background:#94a3b8}.connection-status{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;margin:16px 0;background:linear-gradient(135deg,rgba(99,102,241,.05) 0%,rgba(168,85,247,.05) 100%);border-radius:12px;border:1px solid rgba(99,102,241,.1);flex-shrink:0}.status-indicator{display:flex;align-items:center;gap:8px}.status-dot{width:10px;height:10px;border-radius:50%;transition:all .3s ease}.status-dot.connected{background:#10b981;box-shadow:0 0 0 2px #10b98133;animation:pulse 2s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 2px #ef444433}.status-dot.testing{background:#f59e0b;box-shadow:0 0 0 2px #f59e0b33;animation:pulse 1s infinite}.status-dot.unknown{background:#6b7280;box-shadow:0 0 0 2px #6b728033}.status-text{font-size:14px;font-weight:500;color:#374151}.test-btn{padding:6px 14px;font-size:13px;border:1px solid #d9d9d9;border-radius:8px;background:white;color:#666;cursor:pointer;transition:all .2s ease;font-weight:500}.test-btn:hover:not(:disabled){border-color:#409eff;color:#409eff}.test-btn:disabled{opacity:.6;cursor:not-allowed}@keyframes pulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.2);opacity:.7}to{transform:scale(1);opacity:1}}@media (max-width: 768px){.dialog{width:95vw;padding:24px;border-radius:16px}}@media (max-width: 480px){.dialog{width:100vw;height:100dvh;height:-webkit-fill-available;max-height:100dvh;max-height:-webkit-fill-available;border-radius:0;padding:20px}.dialog h2{font-size:20px;margin-bottom:20px}.btn.el-button{width:100%;padding:16px;font-size:18px}.footer{flex-direction:row;gap:8px;padding:12px 0 0}.footer .btn.el-button{width:auto;flex:1;padding:12px;font-size:15px}.connection-status{flex-direction:row;align-items:center;gap:6px;padding:6px 10px;margin:8px 0}.connection-status .status-indicator{width:auto;justify-content:flex-start;flex-shrink:0}.connection-status .status-text{font-size:12px}.connection-status .status-dot{width:8px;height:8px}.connection-status .test-btn{width:auto;padding:4px 10px;font-size:12px;flex-shrink:0;margin-left:auto}} ');

(function(vue) {
  "use strict";
  var monkeyWindow = window;
  var unsafeWindow = /* @__PURE__ */ (() => {
    return monkeyWindow.unsafeWindow;
  })();
  var GM_xmlhttpRequest = /* @__PURE__ */ (() => monkeyWindow.GM_xmlhttpRequest)();
  // Capture capabilities in the userscript closure; never publish them on unsafeWindow.
  const privateGM = Object.freeze({
    getValue: monkeyWindow.GM_getValue,
    setValue: monkeyWindow.GM_setValue,
    request: monkeyWindow.GM_xmlhttpRequest,
    menu: monkeyWindow.GM_registerMenuCommand,
    info: monkeyWindow.GM_info
  });
  const nativePrompt = typeof window.prompt === "function" ? window.prompt.bind(window) : null;
  const nativeAlert = typeof window.alert === "function" ? window.alert.bind(window) : () => {};
  const nativeConfirm = typeof window.confirm === "function" ? window.confirm.bind(window) : () => false;
  const CONFIG_KEY = "pikpakSecureRpcConfig.v1";
  const DEFAULT_RPC = "http://127.0.0.1:6800/jsonrpc";
  const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;
  const EXTRA_OPTIONS = new Set([
    "split", "max-connection-per-server", "min-split-size", "continue",
    "max-tries", "retry-wait", "timeout", "connect-timeout", "max-download-limit",
    "user-agent", "referer", "header", "all-proxy", "http-proxy", "https-proxy"
  ]);

  function requirePrivateGM() {
    const info = privateGM.info;
    const version = String(info && info.version || "");
    const match = /^(\d+)\.(\d+)\.(\d+)(?:\.|$)/.exec(version);
    const parts = match ? match.slice(1).map(Number) : [];
    const recent = parts.length === 3 && (parts[0] > 5 ||
      parts[0] === 5 && (parts[1] > 5 || parts[1] === 5 && parts[2] >= 1));
    if (!info || info.scriptHandler !== "Tampermonkey" || !recent ||
        ![privateGM.getValue, privateGM.setValue, privateGM.request, privateGM.menu].every(fn => typeof fn === "function")) {
      throw new Error("安全 RPC 需要 Tampermonkey 5.5.1 或以上及完整 GM 权限，请升级或检查脚本授权。");
    }
  }

  function normalizeRpcEndpoint(raw) {
    if (typeof raw !== "string" || !raw.trim() || CONTROL_CHARS.test(raw))
      throw new Error("RPC 地址无效。");
    let endpoint;
    try { endpoint = new URL(raw.trim()); } catch (_) { throw new Error("RPC 地址必须是完整 HTTP(S) URL。"); }
    if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
      throw new Error("RPC 地址只允许 HTTP(S)，不能包含账号密码、查询参数或片段。");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname.toLowerCase());
    if (endpoint.protocol === "http:" && !loopback)
      throw new Error("非本机 RPC 必须使用 HTTPS；局域网地址也不允许明文 HTTP。");
    return endpoint.href;
  }

  function validateRemoteName(name, style) {
    if (typeof name !== "string" || !name || name === "." || name === ".." || /[\\/]/.test(name) || CONTROL_CHARS.test(name))
      throw new Error("文件或目录名称包含不安全的路径段。");
    if (style === "windows") {
      const deviceBase = name.split(".")[0].replace(/[ .]+$/, "");
      if (/[<>:\"|?*]/.test(name) || /[. ]$/.test(name) || /^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])$/i.test(deviceBase))
        throw new Error("文件或目录名称不符合 Windows 安全命名规则。");
    }
    return name;
  }

  function normalizeDownloadRoot(raw) {
    if (typeof raw !== "string" || !raw.trim() || CONTROL_CHARS.test(raw))
      throw new Error("请配置绝对下载根目录。");
    const value = raw.trim();
    if (/^[\\/]{2}/.test(value)) throw new Error("不支持 UNC 或设备路径。");
    let style, prefix, rest;
    if (/^[A-Za-z]:[\\/]/.test(value)) {
      style = "windows";
      prefix = value[0].toUpperCase() + ":/";
      rest = value.slice(3).replace(/\\/g, "/");
    } else if (value.startsWith("/") && !value.includes("\\")) {
      style = "posix";
      prefix = "/";
      rest = value.slice(1);
    } else {
      throw new Error("下载目录须使用 Windows 盘符绝对路径或 POSIX 绝对路径。");
    }
    const segments = rest.split("/").filter(segment => segment !== "");
    for (const segment of segments) validateRemoteName(segment, style);
    return { style, path: prefix + segments.join("/") };
  }

  function isWithinRoot(root, candidate) {
    const actual = normalizeDownloadRoot(candidate);
    if (actual.style !== root.style) return false;
    const base = root.style === "windows" ? root.path.toLowerCase() : root.path;
    const target = root.style === "windows" ? actual.path.toLowerCase() : actual.path;
    return target === base || target.startsWith(base.endsWith("/") ? base : base + "/");
  }

  function checkExtraValue(key, value) {
    if (!EXTRA_OPTIONS.has(key)) throw new Error("不允许此 aria2 参数：" + key);
    if (typeof value !== "string" || !value.trim() || CONTROL_CHARS.test(value))
      throw new Error("aria2 参数值为空或含控制字符。");
    return value;
  }

  function parseExtraParams(raw) {
    if (typeof raw !== "string" || CONTROL_CHARS.test(raw)) throw new Error("额外参数格式无效。");
    const options = {};
    if (!raw.trim()) return options;
    const parts = raw.split(";");
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      if (!part.trim()) {
        if (index === parts.length - 1) continue;
        throw new Error("额外参数不能包含空项。");
      }
      const separator = part.indexOf("=");
      if (separator < 1) throw new Error("额外参数须使用 key=value 格式。");
      const key = part.slice(0, separator).trim();
      const value = checkExtraValue(key, part.slice(separator + 1).trim());
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        if (key !== "header") throw new Error("额外参数重复：" + key);
        options.header = [].concat(options.header, value);
      } else {
        options[key] = value;
      }
    }
    return options;
  }

  function normalizeDownloadUrl(raw) {
    if (typeof raw !== "string" || !raw || CONTROL_CHARS.test(raw)) throw new Error("下载地址无效。");
    let url;
    try { url = new URL(raw); } catch (_) { throw new Error("下载地址必须是 HTTP(S) URL。"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash)
      throw new Error("不允许此下载地址。");
    return url.href;
  }

  function buildDownloadOptions(config, item, fileInfo) {
    const root = normalizeDownloadRoot(config.path);
    const segments = item.directorySegments === undefined ? [] : item.directorySegments;
    if (!Array.isArray(segments) || item.directorySegments === undefined && item.path)
      throw new Error("缺少安全的目录层级信息。");
    for (const segment of segments) validateRemoteName(segment, root.style);
    const out = validateRemoteName(fileInfo.name, root.style);
    const dir = root.path + (segments.length ? (root.path.endsWith("/") ? "" : "/") + segments.join("/") : "");
    if (!isWithinRoot(root, dir)) throw new Error("下载目录超出配置的根目录。");
    normalizeDownloadUrl(fileInfo.web_content_link);
    return { ...parseExtraParams(config.params || ""), dir, out };
  }

  function readPrivateConfig() {
    const stored = typeof privateGM.getValue === "function" ? privateGM.getValue(CONFIG_KEY, null) : null;
    const value = stored && typeof stored === "object" ? stored : {};
    return {
      host: typeof value.host === "string" ? value.host : DEFAULT_RPC,
      path: typeof value.path === "string" ? value.path : "",
      params: typeof value.params === "string" ? value.params : "",
      token: typeof value.token === "string" ? value.token : "",
      tokenEndpoint: typeof value.tokenEndpoint === "string" ? value.tokenEndpoint : ""
    };
  }

  function getAriaConfig() {
    const config = readPrivateConfig();
    let hasToken = false;
    try { hasToken = Boolean(config.token && config.tokenEndpoint === normalizeRpcEndpoint(config.host)); } catch (_) {}
    return { host: config.host, path: config.path, params: config.params, hasToken };
  }

  function saveAriaConfig(input) {
    requirePrivateGM();
    const host = normalizeRpcEndpoint(input.host);
    const path = normalizeDownloadRoot(input.path).path;
    const params = input.params || "";
    parseExtraParams(params);
    const previous = readPrivateConfig();
    const keepToken = previous.tokenEndpoint === host;
    privateGM.setValue(CONFIG_KEY, {
      host, path, params,
      token: keepToken ? previous.token : "",
      tokenEndpoint: keepToken ? host : ""
    });
    return getAriaConfig();
  }

  function setRpcToken(token) {
    requirePrivateGM();
    if (typeof token !== "string" || CONTROL_CHARS.test(token)) throw new Error("RPC 密钥不能包含控制字符。");
    const config = readPrivateConfig();
    const host = normalizeRpcEndpoint(config.host);
    privateGM.setValue(CONFIG_KEY, { ...config, host, token, tokenEndpoint: token ? host : "" });
  }

  function clearRpcToken() { setRpcToken(""); }

  function clearLegacyRpcConfig() {
    for (const key of ["ariaHost", "ariaPath", "ariaToken", "ariaParams"]) window.localStorage.removeItem(key);
  }

  function validateRpcParams(method, params, config) {
    if (!Array.isArray(params)) throw new Error("RPC 参数无效。");
    if (method === "aria2.getVersion") {
      if (params.length) throw new Error("连接测试不接受附加参数。");
      return [];
    }
    if (method !== "aria2.addUri" || params.length !== 2 || !Array.isArray(params[0]) || params[0].length !== 1)
      throw new Error("不允许此 RPC 方法或参数。");
    const root = normalizeDownloadRoot(config.path);
    const options = params[1];
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("下载选项无效。");
    const safe = {};
    for (const [key, value] of Object.entries(options)) {
      if (key === "dir" || key === "out") continue;
      if (key === "header" && Array.isArray(value)) {
        if (!value.length) throw new Error("Header 不能为空。");
        safe.header = value.map(entry => checkExtraValue(key, entry));
      } else {
        safe[key] = checkExtraValue(key, value);
      }
    }
    const dir = normalizeDownloadRoot(options.dir).path;
    if (!isWithinRoot(root, dir)) throw new Error("下载目录超出配置的根目录。");
    safe.dir = dir;
    safe.out = validateRemoteName(options.out, root.style);
    return [[normalizeDownloadUrl(params[0][0])], safe];
  }

  function callAria2(method, params = []) {
    // All preflight checks finish before a key is placed in a request body.
    try {
      requirePrivateGM();
      const config = readPrivateConfig();
      const endpoint = normalizeRpcEndpoint(config.host);
      const safeParams = validateRpcParams(method, params, config);
      if (config.token && config.tokenEndpoint !== endpoint) throw new Error("RPC 地址已变化，请重新设置密钥。");
      const authenticated = config.token ? ["token:" + config.token, ...safeParams] : safeParams;
      const body = JSON.stringify(buildAria2Payload(method, authenticated));
      return new Promise((resolve, reject) => {
        let settled = false, handle;
        const finish = (error, result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (error) reject(new Error(error)); else resolve(result);
        };
        // fetch-mode GM requests need their own timer on Chromium.
        const timer = setTimeout(() => {
          finish("RPC 请求超时。");
          if (handle && typeof handle.abort === "function") handle.abort();
        }, 15000);
        try {
          handle = privateGM.request({
            method: "POST", url: endpoint,
            headers: { "Content-Type": "application/json" },
            data: body, responseType: "json", anonymous: true, fetch: true, redirect: "error",
            onload: response => {
              if (!response || response.status < 200 || response.status >= 300) return finish("RPC HTTP 请求失败。");
              if (response.finalUrl && response.finalUrl !== endpoint) return finish("RPC 重定向已拒绝。");
              let payload;
              try { payload = response.response || JSON.parse(response.responseText); }
              catch (_) { return finish("RPC 返回的 JSON 无效。"); }
              if (!payload || payload.error || !Object.prototype.hasOwnProperty.call(payload, "result"))
                return finish("RPC 调用失败，请检查地址、密钥及下载选项。");
              finish(null, { result: payload.result });
            },
            onerror: () => finish("RPC 连接失败或重定向已拒绝。"),
            onabort: () => finish("RPC 请求已取消。"),
            ontimeout: () => finish("RPC 请求超时。")
          });
        } catch (_) { finish("RPC 请求无法发送，请检查油猴域名授权。"); }
      });
    } catch (error) { return Promise.reject(error); }
  }

  function registerConfigMenus() {
    if (typeof privateGM.menu !== "function") return;
    const run = action => () => {
      try {
        requirePrivateGM();
        if (!nativePrompt) throw new Error("浏览器原生输入对话框不可用。");
        action();
      } catch (error) { nativeAlert(error.message); }
    };
    privateGM.menu("配置 aria2 地址、目录与参数", run(() => {
      const config = getAriaConfig();
      const host = nativePrompt("aria2 RPC 地址（非回环地址必须 HTTPS）", config.host);
      if (host === null) return;
      const path = nativePrompt("下载根目录（Windows 盘符绝对路径或 POSIX 绝对路径）", config.path);
      if (path === null) return;
      const params = nativePrompt("额外参数（白名单，key=value；用英文分号分隔，可留空）", config.params);
      if (params === null) return;
      const hadToken = config.hasToken;
      const next = saveAriaConfig({ host, path, params });
      nativeAlert(hadToken && !next.hasToken ? "配置已保存。地址改变，旧密钥已清除，请重新设置。" : "配置已保存。请在页面主动测试连接。");
    }));
    privateGM.menu("设置或更换 aria2 RPC 密钥", run(() => {
      const host = normalizeRpcEndpoint(getAriaConfig().host);
      const token = nativePrompt("为以下地址设置密钥：\n" + host + "\n不会显示已有密钥；留空将清除。", "");
      if (token === null) return;
      setRpcToken(token);
      nativeAlert(token ? "RPC 密钥已保存到油猴独立存储。" : "RPC 密钥已清除。");
    }));
    privateGM.menu("清除 aria2 RPC 密钥", run(() => {
      if (nativeConfirm("清除本修复版保存的 RPC 密钥？")) { clearRpcToken(); nativeAlert("RPC 密钥已清除。"); }
    }));
    privateGM.menu("清除旧版 RPC 配置", () => {
      if (nativeConfirm("请先停用旧版助手。清除 PikPak 网页中旧版保存的地址、路径、密钥和参数？")) {
        clearLegacyRpcConfig(); nativeAlert("旧版四项 RPC 配置已清除，本修复版配置不受影响。");
      }
    });
  }
  function isSharePage() {
    return location.pathname.startsWith("/s/");
  }
  function getShareId() {
    return location.pathname.split("/")[2];
  }
  function getSharePageData() {
    var _a;
    try {
      const nuxt = unsafeWindow.useNuxtApp();
      if ((_a = nuxt == null ? void 0 : nuxt.$pinia) == null ? void 0 : _a.state) {
        const state = nuxt.$pinia.state.value;
        if (state == null ? void 0 : state.share)
          return state.share;
      }
      return null;
    } catch (e) {
      console.warn("[pikpakHelpr] getSharePageData error:", e);
      return null;
    }
  }
  function isPluginPage() {
    return isSharePage() || location.pathname.startsWith("/drive");
  }
  function getSelectedIds() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    if (isSharePage()) {
      const shareStore = (_d = (_c = (_b = (_a = unsafeWindow.useNuxtApp()) == null ? void 0 : _a.$pinia) == null ? void 0 : _b.state) == null ? void 0 : _c.value) == null ? void 0 : _d.share;
      return (shareStore == null ? void 0 : shareStore.selectedIds) || [];
    }
    const pinia = (_h = (_g = (_f = (_e = document.getElementById("app")) == null ? void 0 : _e.__vue_app__) == null ? void 0 : _f.config) == null ? void 0 : _g.globalProperties) == null ? void 0 : _h.$pinia;
    return ((_k = (_j = (_i = pinia == null ? void 0 : pinia.state) == null ? void 0 : _i.value) == null ? void 0 : _j.file) == null ? void 0 : _k.selectedIds) || [];
  }
  function request(url, options = {}) {
    const { method = "GET", data = null, headers = {}, responseType = "json" } = options;
    if (typeof GM_xmlhttpRequest === "function") {
      return gmRequest(url, { method, data, headers, responseType });
    }
    return fetchRequest(url, { method, data, headers });
  }
  function gmRequest(url, { method, data, headers, responseType }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data: data ? JSON.stringify(data) : void 0,
        responseType,
        onload: (res) => {
          if (responseType === "blob")
            return resolve(res);
          if (res.response || res.responseText) {
            resolve(res.response || res.responseText);
          } else {
            reject(res);
          }
        },
        onerror: reject
      });
    });
  }
  async function fetchRequest(url, { method, data, headers }) {
    const fetchHeaders = { "Content-Type": "application/json", ...headers };
    const opts = {
      method,
      mode: "cors",
      cache: "no-cache",
      credentials: "same-origin",
      headers: fetchHeaders,
      redirect: "follow",
      referrerPolicy: "no-referrer"
    };
    if (method !== "GET" && data) {
      opts.body = JSON.stringify(data);
    }
    const response = await fetch(url, opts);
    return response.json();
  }
  function getHeader() {
    let token = "";
    let captcha = "";
    let clientId = "";
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key)
        continue;
      if (key.startsWith("credentials")) {
        const tokenData = JSON.parse(storage.getItem(key) || "{}");
        token = tokenData.token_type + " " + tokenData.access_token;
        continue;
      }
      if (key.startsWith("captcha")) {
        const tokenData = JSON.parse(storage.getItem(key) || "{}");
        captcha = tokenData.captcha_token;
        const match = key.match(/captcha_(.+)/);
        clientId = match && match[1] || "";
      }
    }
    const deviceId = storage.getItem("deviceid") || "";
    const parts = deviceId.split(".");
    const xDeviceId = parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1].substring(0, 32)}` : deviceId;
    const headers = {
      Authorization: token,
      "x-device-id": xDeviceId,
      "x-client-id": clientId,
      "x-captcha-token": captcha
    };
    if (isSharePage()) {
      headers.Referer = location.href;
    }
    return headers;
  }
  async function getList(parentId) {
    const url = parentId === "recent" ? "https://api-drive.mypikpak.com/drive/v1/events?thumbnail_size=SIZE_MEDIUM&limit=100" : `https://api-drive.mypikpak.com/drive/v1/files?thumbnail_size=SIZE_MEDIUM&limit=500&parent_id=${parentId}&with_audit=true&filters=%7B%22phase%22%3A%7B%22eq%22%3A%22PHASE_TYPE_COMPLETE%22%7D%2C%22trashed%22%3A%7B%22eq%22%3Afalse%7D%7D`;
    const result = await request(url, { headers: getHeader() });
    if (parentId === "recent") {
      return { files: (result.events || []).map((event) => event.reference_resource).filter(Boolean) };
    }
    return result;
  }
  async function getDownload(id) {
    var _a, _b;
    if (isSharePage()) {
      const shareId = getShareId();
      if (!shareId)
        throw new Error("无法获取下载链接：缺少 shareId");
      const data = getSharePageData();
      const passCodeToken = ((_a = data == null ? void 0 : data.data) == null ? void 0 : _a.pass_code_token) || "";
      if (!passCodeToken)
        throw new Error("无法获取下载链接：缺少 pass_code_token");
      const url = `https://api-drive.mypikpak.com/drive/v1/share/file_info?share_id=${shareId}&file_id=${id}&pass_code_token=${encodeURIComponent(passCodeToken)}`;
      const headers = getHeader();
      try {
        const res = await request(url, { headers });
        const fileInfo = res.file_info;
        if (!fileInfo)
          throw new Error("无法获取下载链接：file_info 为空");
        if (!fileInfo.web_content_link && ((_b = fileInfo.medias) == null ? void 0 : _b.length) > 0) {
          fileInfo.web_content_link = fileInfo.medias[0].link.url;
        }
        if (!fileInfo.web_content_link)
          throw new Error("无法获取下载链接：web_content_link 为空");
        return fileInfo;
      } catch (error) {
        console.error("[pikpakHelpr] 获取分享文件下载链接失败:", error);
        throw error;
      }
    }
    return request(`https://api-drive.mypikpak.com/drive/v1/files/${id}?`, { headers: getHeader() });
  }
  let shareObserverInstalled = false;
  let currentShareParentId = void 0;
  function installShareObserver() {
    if (shareObserverInstalled)
      return;
    shareObserverInstalled = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/drive/v1/share/detail")) {
        try {
          const urlObj = new URL(url, location.origin);
          const parentId = urlObj.searchParams.get("parent_id") || null;
          if (currentShareParentId !== parentId) {
            console.log("[pikpakHelpr] intercepted share/detail, parent_id:", parentId);
            currentShareParentId = parentId;
          }
        } catch (e) {
        }
      }
      return originalFetch(input, init);
    };
  }
  function initShareParentIdFromPinia() {
    var _a, _b;
    const data = getSharePageData();
    if (!data)
      return;
    const pathParts = location.pathname.split("/").filter(Boolean);
    if (pathParts.length <= 2) {
      currentShareParentId = null;
      return;
    }
    const files = Array.isArray(data.curDirFiles) ? data.curDirFiles : (_a = data.curDirFiles) == null ? void 0 : _a.files;
    const dirs = data.dirs || [];
    const detail = data.detail || {};
    const detailKeys = Object.keys(detail);
    currentShareParentId = ((_b = files == null ? void 0 : files[0]) == null ? void 0 : _b.parent_id) || (dirs.length && detail[dirs[dirs.length - 1]] ? dirs[dirs.length - 1] : null) || detailKeys[detailKeys.length - 1] || void 0;
  }
  async function fetchShareFiles(shareId, parentId, passCodeToken) {
    let url = `https://api-drive.mypikpak.com/drive/v1/share/detail?share_id=${shareId}&limit=100&thumbnail_size=SIZE_LARGE&order=6&folders_first=true`;
    if (parentId)
      url += `&parent_id=${parentId}`;
    if (passCodeToken)
      url += `&pass_code_token=${encodeURIComponent(passCodeToken)}`;
    return request(url, { headers: getHeader() });
  }
  async function getShareCurrentFiles() {
    var _a, _b, _c;
    const data = getSharePageData();
    if (!data) {
      console.warn("[pikpakHelpr] getShareCurrentFiles: no share data");
      return { files: [], error: "no_share_data", message: "无法读取 Pinia store 数据，页面可能未完全加载" };
    }
    if (!shareObserverInstalled)
      installShareObserver();
    const shareId = getShareId();
    const passCodeToken = ((_a = data == null ? void 0 : data.data) == null ? void 0 : _a.pass_code_token) || "";
    if (!passCodeToken) {
      return { files: [], error: "no_pass_code_token", message: "缺少 pass_code_token，可能需要输入提取码" };
    }
    if (currentShareParentId === void 0) {
      initShareParentIdFromPinia();
    }
    let apiError = null;
    if (currentShareParentId !== void 0) {
      try {
        const res = await fetchShareFiles(shareId, currentShareParentId, passCodeToken);
        if (((_b = res == null ? void 0 : res.files) == null ? void 0 : _b.length) > 0)
          return { files: res.files };
      } catch (e) {
        console.error("[pikpakHelpr] getShareCurrentFiles API failed:", e);
        apiError = e;
      }
    }
    const curDir = data.curDirFiles;
    const fallbackFiles = Array.isArray(curDir) ? curDir : (curDir == null ? void 0 : curDir.files) || ((_c = data.data) == null ? void 0 : _c.files) || [];
    if (fallbackFiles.length > 0)
      return { files: fallbackFiles };
    if (apiError) {
      return { files: [], error: "api_failed", message: `API 请求失败: ${apiError.message || "网络错误"}` };
    }
    if (currentShareParentId === void 0) {
      return { files: [], error: "no_parent_id", message: "无法确定当前文件夹 ID，请刷新页面后重试" };
    }
    return { files: [], error: "empty_result", message: "文件夹为空或数据未同步" };
  }
  function getShareFolderDetail(folderId) {
    const data = getSharePageData();
    if (!(data == null ? void 0 : data.detail))
      return null;
    return data.detail[folderId] || null;
  }
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0)
      return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
  function buildAria2Payload(method, params) {
    return {
      jsonrpc: "2.0",
      method,
      id: (/* @__PURE__ */ new Date()).getTime(),
      params
    };
  }
  function useAria2Connection(emits) {
    const connectionState = vue.ref("unknown");
    const isTestingConnection = vue.ref(false);
    const connectionStatus = vue.computed(() => {
      switch (connectionState.value) {
        case "connected":
          return { class: "connected", text: "Aria2连接正常" };
        case "disconnected":
          return { class: "disconnected", text: "Aria2连接失败" };
        case "testing":
          return { class: "testing", text: "正在测试连接..." };
        default:
          return { class: "unknown", text: "Aria2连接状态未知" };
      }
    });
    const testConnection = async () => {
      if (isTestingConnection.value)
        return;
      isTestingConnection.value = true;
      connectionState.value = "testing";
      try {
        const response = await callAria2("aria2.getVersion");
        if (response && response.result) {
          connectionState.value = "connected";
        } else {
          connectionState.value = "disconnected";
          emits == null ? void 0 : emits("msg", "Aria2连接失败，请检查配置", "error");
        }
      } catch (error) {
        connectionState.value = "disconnected";
        emits == null ? void 0 : emits("msg", `连接失败: ${error.message || "请检查RPC地址和密钥"}`, "error");
      } finally {
        isTestingConnection.value = false;
      }
    };
    return { connectionState, isTestingConnection, connectionStatus, testConnection };
  }
  const AriaDownloadDialog_vue_vue_type_style_index_0_scoped_220666cb_lang = "";
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _withScopeId$2 = (n) => (vue.pushScopeId("data-v-220666cb"), n = n(), vue.popScopeId(), n);
  const _hoisted_1$3 = { class: "dialog" };
  const _hoisted_2$3 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("h2", null, "推送到 Aria2", -1));
  const _hoisted_3$2 = { class: "dialog-body" };
  const _hoisted_4$2 = {
    key: 0,
    class: "progress-section"
  };
  const _hoisted_5$2 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("div", { class: "progress-icon" }, [
    /* @__PURE__ */ vue.createElementVNode("div", { class: "loading-spinner" })
  ], -1));
  const _hoisted_6$2 = { class: "progress-title" };
  const _hoisted_7$1 = {
    key: 0,
    class: "progress-bar-track"
  };
  const _hoisted_8$1 = {
    key: 1,
    class: "progress-stats"
  };
  const _hoisted_9$1 = { class: "stat-progress" };
  const _hoisted_10$1 = { class: "stat-pct" };
  const _hoisted_11$1 = { class: "stat-result" };
  const _hoisted_12$1 = { class: "progress-detail" };
  const _hoisted_13$1 = {
    key: 0,
    class: "empty-state"
  };
  const _hoisted_14$1 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("div", { class: "loading-spinner" }, null, -1));
  const _hoisted_15$1 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("div", { class: "empty-title" }, "正在获取文件信息...", -1));
  const _hoisted_16$1 = [
    _hoisted_14$1,
    _hoisted_15$1
  ];
  const _hoisted_17 = { class: "summary" };
  const _hoisted_18 = { class: "summary-stats" };
  const _hoisted_19 = {
    key: 0,
    class: "stat-badge folder-badge"
  };
  const _hoisted_20 = {
    key: 1,
    class: "stat-badge file-badge"
  };
  const _hoisted_21 = {
    key: 2,
    class: "stat-badge unknown-badge"
  };
  const _hoisted_22 = {
    key: 0,
    class: "summary-size"
  };
  const _hoisted_23 = { class: "file-list" };
  const _hoisted_24 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("span", { class: "icon" }, "📁", -1));
  const _hoisted_25 = { class: "file-name" };
  const _hoisted_26 = {
    key: 0,
    class: "file-size folder-size"
  };
  const _hoisted_27 = {
    key: 1,
    class: "file-tag"
  };
  const _hoisted_28 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("span", { class: "icon" }, "📄", -1));
  const _hoisted_29 = { class: "file-name" };
  const _hoisted_30 = { class: "file-size" };
  const _hoisted_31 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("span", { class: "icon" }, "❓", -1));
  const _hoisted_32 = { class: "file-name unknown-name" };
  const _hoisted_33 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("span", { class: "file-tag unknown-tag" }, "未匹配详情", -1));
  const _hoisted_34 = {
    key: 2,
    class: "empty-state"
  };
  const _hoisted_35 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("div", { class: "empty-icon" }, "📂", -1));
  const _hoisted_36 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("div", { class: "empty-title" }, "未选择文件", -1));
  const _hoisted_37 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("div", { class: "empty-guide" }, "请先在页面上勾选要下载的文件或文件夹，然后再点击推送按钮", -1));
  const _hoisted_38 = [
    _hoisted_35,
    _hoisted_36,
    _hoisted_37
  ];
  const _hoisted_39 = { class: "connection-status" };
  const _hoisted_40 = { class: "status-indicator" };
  const _hoisted_41 = { class: "status-text" };
  const _hoisted_42 = ["disabled"];
  const _hoisted_43 = { class: "footer" };
  const _hoisted_44 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("span", { class: "lbl-d" }, "配置aria2", -1));
  const _hoisted_45 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ vue.createElementVNode("span", { class: "lbl-m" }, "配置", -1));
  const _hoisted_46 = [
    _hoisted_44,
    _hoisted_45
  ];
  const _hoisted_47 = ["disabled"];
  const _hoisted_48 = { class: "lbl-d" };
  const _hoisted_49 = { class: "lbl-m" };
  const _sfc_main$4 = {
    __name: "AriaDownloadDialog",
    props: { show: Boolean },
    emits: ["close", "msg", "openConfig"],
    setup(__props, { emit: __emit }) {
      const props = __props;
      const emits = __emit;
      const selectedFiles = vue.ref([]);
      const selectedFolders = vue.ref([]);
      const unmatchedIds = vue.ref([]);
      const totalSize = vue.ref(0);
      const isPushing = vue.ref(false);
      const loading = vue.ref(false);
      const progress = vue.reactive({
        show: false,
        mode: "",
        // 'scan' | 'push'
        current: 0,
        total: 0,
        success: 0,
        fail: 0,
        text: ""
      });
      const progressPercent = vue.computed(() => {
        if (progress.total === 0)
          return 0;
        return Math.round(progress.current / progress.total * 100);
      });
      const shareId = vue.ref("");
      const passCodeToken = vue.ref("");
      let shareFileCache = [];
      let shareFetchedFolderIds = /* @__PURE__ */ new Set();
      let shareCachedEntryIds = /* @__PURE__ */ new Set();
      const hasSelection = vue.computed(
        () => selectedFiles.value.length > 0 || selectedFolders.value.length > 0 || unmatchedIds.value.length > 0
      );
      const { connectionStatus, isTestingConnection, testConnection } = useAria2Connection(emits);
      const handleTestConnection = () => testConnection();
      vue.watch(
        () => props.show,
        (val) => {
          if (!val)
            return;
          loadSelection();
        }
      );
      const loadSelection = async () => {
        var _a;
        selectedFiles.value = [];
        selectedFolders.value = [];
        unmatchedIds.value = [];
        totalSize.value = 0;
        if (isSharePage()) {
          shareId.value = getShareId();
          const data = getSharePageData();
          passCodeToken.value = ((_a = data == null ? void 0 : data.data) == null ? void 0 : _a.pass_code_token) || "";
        }
        const ids = getSelectedIds();
        if (ids.length === 0)
          return;
        loading.value = true;
        emits("msg", `正在匹配 ${ids.length} 个选中项...`, "info");
        try {
          let apiFiles = [];
          if (isSharePage()) {
            const res = await getShareCurrentFiles();
            apiFiles = res.files || [];
          } else {
            let parentId = window.location.href.split("/").pop();
            if (parentId === "all")
              parentId = "";
            const res = await getList(parentId);
            apiFiles = (res == null ? void 0 : res.files) || [];
          }
          const result = matchSelectedIds(ids, apiFiles);
          selectedFiles.value = result.files;
          selectedFolders.value = result.folders;
          unmatchedIds.value = result.unmatched;
          totalSize.value = result.totalSize;
          if (isSharePage() && selectedFolders.value.length > 0) {
            const newFolders = selectedFolders.value.filter((f) => !shareFetchedFolderIds.has(f.id));
            const allCached = newFolders.length === 0;
            if (!allCached) {
              emits("msg", `正在扫描 ${newFolders.length} 个新文件夹（已缓存 ${selectedFolders.value.length - newFolders.length} 个）...`, "info");
              try {
                await buildShareFileCache(newFolders);
              } catch (e) {
                console.error("[pikpakHelpr] buildShareFileCache failed:", e);
              }
            }
            const { total, folderSizes } = calcTotalSizeFromIndex(shareFileCache, ids, selectedFiles.value);
            totalSize.value = total;
            for (const folder of selectedFolders.value) {
              if (folderSizes[folder.id] !== void 0) {
                folder._folderSize = folderSizes[folder.id];
              }
            }
            emits("msg", `已匹配 ${selectedFiles.value.length} 个文件，${selectedFolders.value.length} 个文件夹${allCached ? "（缓存命中）" : ""}`, "success");
          } else if (result.files.length + result.folders.length > 0) {
            emits("msg", `已匹配 ${result.files.length} 个文件，${result.folders.length} 个文件夹`, "success");
          }
        } catch (e) {
          console.error("[pikpakHelpr] loadSelection failed:", e);
          unmatchedIds.value = [...ids];
          emits("msg", `文件信息获取失败，将尝试直接推送 ${ids.length} 个选中项`, "warning");
        } finally {
          loading.value = false;
        }
      };
      const matchSelectedIds = (ids, apiFiles) => {
        var _a, _b, _c, _d;
        const idSet = new Set(ids);
        const matchedFiles = [];
        const matchedFolders = [];
        const matchedIds = /* @__PURE__ */ new Set();
        for (const file of apiFiles) {
          if (file.id && idSet.has(file.id) && !matchedIds.has(file.id)) {
            matchedIds.add(file.id);
            if (file.kind === "drive#folder") {
              matchedFolders.push(file);
            } else {
              matchedFiles.push(file);
            }
          }
        }
        let size = 0;
        if (isSharePage()) {
          const shareStore = (_d = (_c = (_b = (_a = unsafeWindow.useNuxtApp()) == null ? void 0 : _a.$pinia) == null ? void 0 : _b.state) == null ? void 0 : _c.value) == null ? void 0 : _d.share;
          size = (shareStore == null ? void 0 : shareStore.selectedFilesSize) || 0;
        } else {
          const dbIndex = getDriveDbIndex();
          if (dbIndex) {
            const { total: dbTotal, folderSizes } = calcTotalSizeFromIndex(dbIndex, ids, matchedFiles);
            size = dbTotal;
            for (const folder of matchedFolders) {
              if (folderSizes[folder.id] !== void 0) {
                folder._folderSize = folderSizes[folder.id];
              }
            }
          }
        }
        if (size <= 0) {
          size = [...matchedFiles, ...matchedFolders].reduce((sum, f) => sum + (parseInt(f.size) || 0), 0);
        }
        const unmatched = ids.filter((id) => !matchedIds.has(id));
        return { files: matchedFiles, folders: matchedFolders, totalSize: size, unmatched };
      };
      const getDriveDbIndex = () => {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
          const pinia = (_d = (_c = (_b = (_a = document.getElementById("app")) == null ? void 0 : _a.__vue_app__) == null ? void 0 : _b.config) == null ? void 0 : _c.globalProperties) == null ? void 0 : _d.$pinia;
          return ((_g = (_f = (_e = pinia == null ? void 0 : pinia.state) == null ? void 0 : _e.value) == null ? void 0 : _f.file) == null ? void 0 : _g.dbIndex) || null;
        } catch (e) {
          return null;
        }
      };
      const buildShareFileCache = async (folders) => {
        const queue = [...folders];
        while (queue.length > 0) {
          const folder = queue.shift();
          if (shareFetchedFolderIds.has(folder.id))
            continue;
          shareFetchedFolderIds.add(folder.id);
          if (!shareCachedEntryIds.has(folder.id)) {
            shareFileCache.push({
              id: folder.id,
              parent_id: folder.parent_id || "",
              name: folder.name,
              kind: folder.kind,
              size: folder.size || "0"
            });
            shareCachedEntryIds.add(folder.id);
          }
          try {
            const res = await fetchShareFiles(shareId.value, folder.id, passCodeToken.value);
            const files = (res == null ? void 0 : res.files) || [];
            for (const file of files) {
              if (!shareCachedEntryIds.has(file.id)) {
                shareFileCache.push({
                  id: file.id,
                  parent_id: file.parent_id || folder.id,
                  name: file.name,
                  kind: file.kind,
                  size: file.size || "0"
                });
                shareCachedEntryIds.add(file.id);
              }
              if (file.kind === "drive#folder" && !shareFetchedFolderIds.has(file.id)) {
                queue.push(file);
              }
            }
          } catch (e) {
            console.error(`[pikpakHelpr] buildShareFileCache: failed for ${folder.name}:`, e);
          }
        }
      };
      const calcTotalSizeFromIndex = (fileIndex, selectedIds, matchedFiles) => {
        const byParent = {};
        const byId = {};
        for (const entry of fileIndex) {
          byId[entry.id] = entry;
          const pid = entry.parent_id || "";
          if (!byParent[pid])
            byParent[pid] = [];
          byParent[pid].push(entry);
        }
        const calcFolderSize = (folderId) => {
          let total = 0;
          const queue = [folderId];
          const visited = /* @__PURE__ */ new Set();
          while (queue.length > 0) {
            const pid = queue.shift();
            if (visited.has(pid))
              continue;
            visited.add(pid);
            const children = byParent[pid] || [];
            for (const child of children) {
              if (child.kind === "drive#folder") {
                queue.push(child.id);
              } else {
                total += parseInt(child.size) || 0;
              }
            }
          }
          return total;
        };
        let totalSize2 = matchedFiles.reduce((sum, f) => sum + (parseInt(f.size) || 0), 0);
        const folderSizes = {};
        const selectedIdSet = new Set(selectedIds);
        for (const id of selectedIdSet) {
          const entry = byId[id];
          if (!entry || entry.kind !== "drive#folder")
            continue;
          const fs = calcFolderSize(id);
          folderSizes[id] = fs;
          totalSize2 += fs;
        }
        return { total: totalSize2, folderSizes };
      };
      const close = () => {
        emits("close");
      };
      const openConfig = () => emits("openConfig");
      const getAllList = async () => {
        var _a;
        emits("msg", "开始获取文件内容", "info");
        const allFiles = [];
        const foldersToProcess = [];
        selectedFiles.value.forEach((file) => {
          allFiles.push({ ...file, directorySegments: [] });
        });
        unmatchedIds.value.forEach((id) => {
          allFiles.push({ id, name: id, directorySegments: [] });
        });
        if (isSharePage() && shareFileCache.length > 0 && selectedFolders.value.length > 0) {
          progress.mode = "scan";
          progress.total = selectedFolders.value.length;
          progress.current = 0;
          progress.text = "正在从缓存读取...";
          const byParent = {};
          for (const entry of shareFileCache) {
            const pid = entry.parent_id || "";
            if (!byParent[pid])
              byParent[pid] = [];
            byParent[pid].push(entry);
          }
          const collectWithPath = (parentId, directorySegments) => {
            const children = byParent[parentId] || [];
            for (const child of children) {
              if (child.kind === "drive#folder") {
                collectWithPath(child.id, [...directorySegments, child.name]);
              } else {
                allFiles.push({ ...child, directorySegments });
              }
            }
          };
          for (const folder of selectedFolders.value) {
            progress.current++;
            progress.text = `缓存读取: ${folder.name}`;
            collectWithPath(folder.id, [folder.name]);
          }
          emits("msg", `文件获取完毕（缓存命中），共 ${allFiles.length} 个文件`, "success");
          progress.show = false;
          return allFiles;
        }
        selectedFolders.value.forEach((folder) => {
          foldersToProcess.push({ id: folder.id, name: folder.name, directorySegments: [folder.name] });
        });
        progress.total = foldersToProcess.length;
        progress.text = `开始扫描 ${foldersToProcess.length} 个文件夹...`;
        let processedCount = 0;
        while (foldersToProcess.length > 0) {
          const currentFolder = foldersToProcess.shift();
          processedCount++;
          progress.current = processedCount;
          progress.text = `正在扫描: ${currentFolder.name}`;
          try {
            let result = null;
            if (isSharePage()) {
              const detail = getShareFolderDetail(currentFolder.id);
              if (detail == null ? void 0 : detail.files) {
                result = detail;
              } else {
                try {
                  result = await fetchShareFiles(shareId.value, currentFolder.id, passCodeToken.value);
                  if (!((_a = result == null ? void 0 : result.files) == null ? void 0 : _a.length)) {
                    emits("msg", `文件夹 "${currentFolder.name}" 内容为空`, "warning");
                    continue;
                  }
                } catch (e) {
                  console.error("[pikpakHelpr] getAllList API failed:", e);
                  emits("msg", `获取文件夹 "${currentFolder.name}" 内容失败: ${e.message || "网络错误"}`, "error");
                  continue;
                }
              }
            } else {
              result = await getList(currentFolder.id);
            }
            if (result.files) {
              for (const file of result.files) {
                if (file.kind === "drive#folder") {
                  foldersToProcess.push({ id: file.id, name: file.name, directorySegments: [...currentFolder.directorySegments, file.name] });
                } else {
                  allFiles.push({ ...file, directorySegments: currentFolder.directorySegments });
                }
              }
            }
          } catch (e) {
            emits("msg", `获取文件夹 ${currentFolder.name} 内容失败`, "error");
            console.error(e);
          }
        }
        emits("msg", `文件获取完毕，共 ${allFiles.length} 个文件`, "success");
        return allFiles;
      };
      const pushBefore = async () => {
        if (isPushing.value) {
          emits("msg", "已经开始推送了", "warning");
          return;
        }
        isPushing.value = true;
        progress.show = true;
        progress.mode = "scan";
        progress.current = 0;
        progress.total = 0;
        progress.success = 0;
        progress.fail = 0;
        progress.text = "准备扫描文件...";
        try {
          const config = getAriaConfig();
          normalizeRpcEndpoint(config.host);
          normalizeDownloadRoot(config.path);
          parseExtraParams(config.params);
          const allFiles = await getAllList();
          if (allFiles.length > 0) {
            await push(allFiles);
          } else {
            progress.show = false;
            emits("msg", "没有可推送的文件", "warning");
          }
        } catch (error) {
          emits("msg", error.message || "推送未完成，请检查安全配置。", "error");
        } finally {
          progress.show = false;
          isPushing.value = false;
        }
      };
      const push = async (items) => {
        const config = getAriaConfig();
        progress.show = true;
        progress.mode = "push";
        progress.current = 0;
        progress.total = items.length;
        progress.success = 0;
        progress.fail = 0;
        progress.text = `开始推送 ${items.length} 个文件...`;
        console.log(`[pikpakHelpr] 共${items.length}个项目`);
        const MAX_CONCURRENT = 15;
        const queue = [...items];
        let currentIndex = 0;
        let errorMSG = "";
        const processOne = async () => {
          var _a, _b;
          while (currentIndex < queue.length) {
            const i = currentIndex++;
            const item = queue[i];
            progress.current = i + 1;
            progress.text = `正在处理: ${item.name}`;
            try {
              const res = await getDownload(item.id);
              if (res.error_description) {
                progress.fail++;
                progress.text = `获取链接失败: ${item.name} - ${res.error_description}`;
                continue;
              }
              const options = buildDownloadOptions(config, item, res);
              const ariares = await callAria2("aria2.addUri", [[res.web_content_link], options]);
              const resoj = typeof ariares === "string" ? JSON.parse(ariares) : ariares;
              if (resoj.result) {
                progress.success++;
              } else {
                errorMSG = ((_a = resoj.error) == null ? void 0 : _a.message) === "Unauthorized" ? "密钥不对" : ((_b = resoj.error) == null ? void 0 : _b.message) || "推送失败";
                progress.fail++;
                progress.text = `推送失败: ${item.name}`;
              }
            } catch (e) {
              progress.fail++;
              progress.text = `处理失败: ${item.name} - ${e.message || "未知错误"}`;
              errorMSG = e.message;
            }
          }
        };
        const workers = Array.from({ length: MAX_CONCURRENT }, () => processOne());
        await Promise.all(workers);
        const resultType = progress.fail === 0 ? "success" : progress.success === 0 ? "error" : "warning";
        emits("msg", `推送完成 - 成功: ${progress.success}, 失败: ${progress.fail}${progress.fail ? " (" + errorMSG + ")" : ""}`, resultType);
        console.info(`[pikpakHelpr] 推送完成 - 成功: ${progress.success}, 失败: ${progress.fail}`);
        close();
      };
      return (_ctx, _cache) => {
        return __props.show ? (vue.openBlock(), vue.createElementBlock("div", {
          key: 0,
          onClick: _cache[0] || (_cache[0] = vue.withModifiers(() => {
          }, ["stop"])),
          onMousedown: _cache[1] || (_cache[1] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("div", {
            class: "dialog-overlay",
            onClick: vue.withModifiers(close, ["stop"])
          }),
          vue.createElementVNode("div", _hoisted_1$3, [
            _hoisted_2$3,
            vue.createElementVNode("div", {
              class: "close",
              onClick: vue.withModifiers(close, ["stop"])
            }, "×"),
            vue.createElementVNode("div", _hoisted_3$2, [
              progress.show ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_4$2, [
                _hoisted_5$2,
                vue.createElementVNode("div", _hoisted_6$2, vue.toDisplayString(progress.mode === "scan" ? "正在扫描文件..." : "正在推送文件..."), 1),
                progress.mode === "push" ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_7$1, [
                  vue.createElementVNode("div", {
                    class: "progress-bar-fill",
                    style: vue.normalizeStyle({ width: progressPercent.value + "%" })
                  }, null, 4)
                ])) : vue.createCommentVNode("", true),
                progress.mode === "push" ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_8$1, [
                  vue.createElementVNode("span", _hoisted_9$1, vue.toDisplayString(progress.current) + "/" + vue.toDisplayString(progress.total), 1),
                  vue.createElementVNode("span", _hoisted_10$1, vue.toDisplayString(progressPercent.value) + "%", 1),
                  vue.createElementVNode("span", _hoisted_11$1, "✅ " + vue.toDisplayString(progress.success) + " ❌ " + vue.toDisplayString(progress.fail), 1)
                ])) : vue.createCommentVNode("", true),
                vue.createElementVNode("div", _hoisted_12$1, vue.toDisplayString(progress.text), 1)
              ])) : (vue.openBlock(), vue.createElementBlock(vue.Fragment, { key: 1 }, [
                loading.value ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_13$1, _hoisted_16$1)) : hasSelection.value ? (vue.openBlock(), vue.createElementBlock(vue.Fragment, { key: 1 }, [
                  vue.createElementVNode("div", _hoisted_17, [
                    vue.createElementVNode("div", _hoisted_18, [
                      selectedFolders.value.length > 0 ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_19, vue.toDisplayString(selectedFolders.value.length) + " 个文件夹 ", 1)) : vue.createCommentVNode("", true),
                      selectedFiles.value.length > 0 ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_20, vue.toDisplayString(selectedFiles.value.length) + " 个文件 ", 1)) : vue.createCommentVNode("", true),
                      unmatchedIds.value.length > 0 ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_21, vue.toDisplayString(unmatchedIds.value.length) + " 个未知 ", 1)) : vue.createCommentVNode("", true)
                    ]),
                    totalSize.value > 0 ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_22, " 预估大小：" + vue.toDisplayString(vue.unref(formatBytes)(totalSize.value)), 1)) : vue.createCommentVNode("", true)
                  ]),
                  vue.createElementVNode("ul", _hoisted_23, [
                    (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(selectedFolders.value, (item) => {
                      return vue.openBlock(), vue.createElementBlock("li", {
                        key: item.id,
                        class: "file-item folder-item"
                      }, [
                        _hoisted_24,
                        vue.createElementVNode("span", _hoisted_25, vue.toDisplayString(item.name), 1),
                        item._folderSize ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_26, vue.toDisplayString(vue.unref(formatBytes)(item._folderSize)), 1)) : (vue.openBlock(), vue.createElementBlock("span", _hoisted_27, "文件夹"))
                      ]);
                    }), 128)),
                    (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(selectedFiles.value, (item) => {
                      return vue.openBlock(), vue.createElementBlock("li", {
                        key: item.id,
                        class: "file-item"
                      }, [
                        _hoisted_28,
                        vue.createElementVNode("span", _hoisted_29, vue.toDisplayString(item.name), 1),
                        vue.createElementVNode("span", _hoisted_30, vue.toDisplayString(item.size ? vue.unref(formatBytes)(parseInt(item.size)) : ""), 1)
                      ]);
                    }), 128)),
                    (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(unmatchedIds.value, (id) => {
                      return vue.openBlock(), vue.createElementBlock("li", {
                        key: id,
                        class: "file-item unmatched-item"
                      }, [
                        _hoisted_31,
                        vue.createElementVNode("span", _hoisted_32, vue.toDisplayString(id), 1),
                        _hoisted_33
                      ]);
                    }), 128))
                  ])
                ], 64)) : (vue.openBlock(), vue.createElementBlock("div", _hoisted_34, _hoisted_38))
              ], 64))
            ]),
            vue.createElementVNode("div", _hoisted_39, [
              vue.createElementVNode("div", _hoisted_40, [
                vue.createElementVNode("div", {
                  class: vue.normalizeClass(["status-dot", vue.unref(connectionStatus).class])
                }, null, 2),
                vue.createElementVNode("span", _hoisted_41, vue.toDisplayString(vue.unref(connectionStatus).text), 1)
              ]),
              vue.createElementVNode("button", {
                class: "test-btn",
                onClick: handleTestConnection,
                disabled: vue.unref(isTestingConnection)
              }, vue.toDisplayString(vue.unref(isTestingConnection) ? "测试中..." : "测试连接"), 9, _hoisted_42)
            ]),
            vue.createElementVNode("div", _hoisted_43, [
              vue.createElementVNode("div", {
                class: "btn el-button el-button--secondary",
                onClick: openConfig
              }, _hoisted_46),
              hasSelection.value ? (vue.openBlock(), vue.createElementBlock("div", {
                key: 0,
                class: "btn el-button el-button--primary",
                onClick: pushBefore,
                disabled: isPushing.value
              }, [
                vue.createElementVNode("span", _hoisted_48, vue.toDisplayString(isPushing.value ? "推送中..." : "推送到aria2"), 1),
                vue.createElementVNode("span", _hoisted_49, vue.toDisplayString(isPushing.value ? "推送中..." : "推送"), 1)
              ], 8, _hoisted_47)) : (vue.openBlock(), vue.createElementBlock("div", {
                key: 1,
                class: "btn el-button el-button--primary",
                onClick: close
              }, "关闭"))
            ])
          ])
        ], 32)) : vue.createCommentVNode("", true);
      };
    }
  };
  const AriaDownloadDialog = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-220666cb"]]);
  // This dialog is read-only. Private configuration is edited only through GM menus.
  const AriaConfigDialog = _export_sfc({
    __name: "SecureAriaConfigDialog",
    props: { show: Boolean },
    emits: ["close", "msg"],
    setup(props, { emit }) {
      const summary = vue.ref({ host: "", path: "", hasToken: false, parameterNames: "" });
      const refresh = () => {
        const config = getAriaConfig();
        let parameterNames;
        try { parameterNames = Object.keys(parseExtraParams(config.params)).join(", ") || "无"; }
        catch (_) { parameterNames = "配置无效，请通过油猴菜单重新设置"; }
        summary.value = { host: config.host, path: config.path, hasToken: config.hasToken, parameterNames };
      };
      const { connectionStatus, isTestingConnection, testConnection } = useAria2Connection(emit);
      vue.watch(() => props.show, visible => { if (visible) refresh(); });
      vue.onMounted(refresh);
      const close = () => emit("close");
      return () => {
        if (!props.show) return vue.createCommentVNode("", true);
        const row = (label, value) => vue.createElementVNode("li", null, [
          vue.createElementVNode("div", { class: "label" }, label),
          vue.createElementVNode("p", { class: "guidance", style: { overflowWrap: "anywhere" } }, value)
        ]);
        return vue.createElementVNode("div", { onClick: event => event.stopPropagation() }, [
          vue.createElementVNode("div", { class: "dialog-overlay", onClick: close }),
          vue.createElementVNode("div", { class: "dialog" }, [
            vue.createElementVNode("h2", null, "aria2 安全配置摘要"),
            vue.createElementVNode("div", { class: "close", onClick: close }, "×"),
            vue.createElementVNode("div", { class: "dialog-body" }, [
              vue.createElementVNode("p", { class: "guidance" }, "请打开浏览器油猴菜单设置地址、目录、参数和密钥。页面不提供密钥输入或回显。设置后重新打开此窗口查看。"),
              vue.createElementVNode("ul", { class: "config-list" }, [
                row("RPC 地址", summary.value.host),
                row("下载根目录", summary.value.path || "未配置，推送前必须设置绝对路径"),
                row("RPC 密钥", summary.value.hasToken ? "已设置" : "未设置"),
                row("额外参数（仅名称）", summary.value.parameterNames)
              ])
            ]),
            vue.createElementVNode("div", { class: "connection-status" }, [
              vue.createElementVNode("span", null, connectionStatus.value.text),
              vue.createElementVNode("button", { class: "test-btn", disabled: isTestingConnection.value, onClick: () => testConnection() }, "测试连接")
            ]),
            vue.createElementVNode("div", { class: "footer" }, [
              vue.createElementVNode("button", { class: "btn el-button el-button--primary", onClick: close }, "关闭")
            ])
          ])
        ]);
      };
    }
  }, [["__scopeId", "data-v-7e65647b"]]);
  const Aria2Toast_vue_vue_type_style_index_0_scoped_ef33c69b_lang = "";
  const _hoisted_1$1 = { class: "aria2-tip__icon" };
  const _hoisted_2$1 = { key: 0 };
  const _hoisted_3 = { key: 1 };
  const _hoisted_4 = { key: 2 };
  const _hoisted_5 = { key: 3 };
  const _hoisted_6 = { class: "aria2-tip__content" };
  const _sfc_main$2 = {
    __name: "Aria2Toast",
    setup(__props, { expose: __expose }) {
      const show = vue.ref(false);
      const type = vue.ref("info");
      let timer = null;
      const open = (toastType = "info") => {
        if (timer) {
          clearTimeout(timer);
        }
        type.value = toastType;
        show.value = true;
        timer = setTimeout(() => {
          show.value = false;
        }, 3e3);
      };
      __expose({ open });
      return (_ctx, _cache) => {
        return show.value ? (vue.openBlock(), vue.createElementBlock("div", {
          key: 0,
          class: vue.normalizeClass(["aria2-tip", `aria2-tip--${type.value}`])
        }, [
          vue.createElementVNode("div", _hoisted_1$1, [
            type.value === "success" ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_2$1, "✓")) : type.value === "error" ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_3, "✕")) : type.value === "warning" ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_4, "⚠")) : type.value === "info" ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_5, "ℹ")) : vue.createCommentVNode("", true)
          ]),
          vue.createElementVNode("div", _hoisted_6, [
            vue.renderSlot(_ctx.$slots, "default", {}, void 0, true)
          ])
        ], 2)) : vue.createCommentVNode("", true);
      };
    }
  };
  const Aria2Toast = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-ef33c69b"]]);
  const FloatingWindow_vue_vue_type_style_index_0_scoped_d0fff8dd_lang = "";
  const _withScopeId = (n) => (vue.pushScopeId("data-v-d0fff8dd"), n = n(), vue.popScopeId(), n);
  const _hoisted_1 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ vue.createElementVNode("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, [
    /* @__PURE__ */ vue.createElementVNode("path", { d: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" })
  ], -1));
  const _hoisted_2 = [
    _hoisted_1
  ];
  const _sfc_main$1 = {
    __name: "FloatingWindow",
    props: {
      show: {
        type: Boolean,
        default: true
      }
    },
    emits: ["download"],
    setup(__props, { emit: __emit }) {
      const emit = __emit;
      const floatingWindow = vue.ref(null);
      const isDragging = vue.ref(false);
      const dragOffset = vue.ref({ x: 0, y: 0 });
      const position = vue.ref({ x: 0, y: 150 });
      const hasDragged = vue.ref(false);
      const startDrag = (e) => {
        isDragging.value = true;
        hasDragged.value = false;
        const rect = floatingWindow.value.getBoundingClientRect();
        dragOffset.value = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        document.addEventListener("mousemove", onDrag);
        document.addEventListener("mouseup", stopDrag);
        e.preventDefault();
      };
      const onDrag = (e) => {
        if (!isDragging.value)
          return;
        hasDragged.value = true;
        const newX = e.clientX - dragOffset.value.x;
        const newY = e.clientY - dragOffset.value.y;
        const maxX = window.innerWidth - floatingWindow.value.offsetWidth;
        const maxY = window.innerHeight - floatingWindow.value.offsetHeight;
        position.value.x = Math.max(0, Math.min(newX, maxX));
        position.value.y = Math.max(0, Math.min(newY, maxY));
      };
      const stopDrag = () => {
        isDragging.value = false;
        document.removeEventListener("mousemove", onDrag);
        document.removeEventListener("mouseup", stopDrag);
      };
      const handleDownload = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!hasDragged.value && !isDragging.value) {
          emit("download");
        }
      };
      const adjustPosition = () => {
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        position.value.x = Math.max(0, Math.min(position.value.x, maxX));
        position.value.y = Math.max(0, Math.min(position.value.y, maxY));
      };
      const handleResize = () => {
        adjustPosition();
      };
      vue.onMounted(() => {
        position.value.x = window.innerWidth - 80;
        position.value.y = 150;
        adjustPosition();
        window.addEventListener("resize", handleResize);
      });
      vue.onUnmounted(() => {
        document.removeEventListener("mousemove", onDrag);
        document.removeEventListener("mouseup", stopDrag);
        window.removeEventListener("resize", handleResize);
      });
      return (_ctx, _cache) => {
        return __props.show ? (vue.openBlock(), vue.createElementBlock("div", {
          key: 0,
          ref_key: "floatingWindow",
          ref: floatingWindow,
          class: vue.normalizeClass(["floating-window", { dragging: isDragging.value }]),
          style: vue.normalizeStyle({ left: position.value.x + "px", top: position.value.y + "px" })
        }, [
          vue.createElementVNode("div", {
            class: "download-button",
            onClick: handleDownload,
            onMousedown: vue.withModifiers(startDrag, ["stop"])
          }, _hoisted_2, 32)
        ], 6)) : vue.createCommentVNode("", true);
      };
    }
  };
  const FloatingWindow = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-d0fff8dd"]]);
  const _sfc_main = {
    __name: "App",
    setup(__props) {
      const downloadShow = vue.ref(false);
      const configShow = vue.ref(false);
      const tip = vue.ref("");
      const toastRef = vue.ref(null);
      const showPlugin = vue.ref(isPluginPage());
      const showToast = (val, type = "info") => {
        tip.value = val;
        toastRef.value.open(type);
      };
      return (_ctx, _cache) => {
        return vue.openBlock(), vue.createElementBlock(vue.Fragment, null, [
          showPlugin.value ? (vue.openBlock(), vue.createBlock(FloatingWindow, {
            key: 0,
            onDownload: _cache[0] || (_cache[0] = ($event) => downloadShow.value = true)
          })) : vue.createCommentVNode("", true),
          vue.createVNode(AriaDownloadDialog, {
            show: downloadShow.value,
            onClose: _cache[1] || (_cache[1] = ($event) => downloadShow.value = false),
            onOpenConfig: _cache[2] || (_cache[2] = ($event) => configShow.value = true),
            onMsg: showToast
          }, null, 8, ["show"]),
          vue.createVNode(AriaConfigDialog, {
            show: configShow.value,
            onClose: _cache[3] || (_cache[3] = ($event) => configShow.value = false),
            onMsg: showToast
          }, null, 8, ["show"]),
          vue.createVNode(Aria2Toast, {
            ref_key: "toastRef",
            ref: toastRef
          }, {
            default: vue.withCtx(() => [
              vue.createTextVNode(vue.toDisplayString(tip.value), 1)
            ]),
            _: 1
          }, 512)
        ], 64);
      };
    }
  };
  const common = "";
  if (isSharePage()) {
    installShareObserver();
  }
  registerConfigMenus();
  document.cookie = "pp_access_to_visit=true";
  function mountApp() {
    const pikpakContainer = document.getElementById("app");
    const app = document.createElement("div");
    document.body.insertBefore(app, pikpakContainer);
    vue.createApp(_sfc_main).mount(app);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(mountApp, 500));
  } else {
    setTimeout(mountApp, 500);
  }
})(Vue);
