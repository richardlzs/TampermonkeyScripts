# PikPak 助手 plus 安全修复版

版本 **2.1.0**。基于 [jdysya/pikpakHelpr-plus](https://github.com/jdysya/pikpakHelpr-plus) 的 2.0.1 修改，保留原作者署名和 MIT 许可。用于在 PikPak 网盘页、分享页将选中文件或文件夹推送到 aria2，支持按文件设置下载目录。

本次主要修复 RPC 配置与网页的隔离、连接地址校验、重定向处理和下载路径约束。保留上游 Vue 3.4.37 依赖，不需要本地构建。

## 安装与配置

需要 **Tampermonkey 5.5.1 或更新版本**，以及已经开启 JSON-RPC 的 aria2。

1. **先禁用旧版 PikPak 助手脚本**，避免同时运行。
2. 安装 [pikpak-helper-plus.user.js](https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/pikpak/pikpak-helper-plus.user.js)。该地址也是本修复版的更新地址；当前修改尚未发布，链接须待推送到 GitHub 后才能使用。
3. 打开 `https://mypikpak.com/drive` 或 PikPak 分享页，从 Tampermonkey 菜单配置 RPC 地址、下载根目录和可选参数，再通过单独的菜单设置 RPC 密钥。
4. 在网页选中文件或文件夹，打开助手，测试连接后推送。

尚未推送时，可以在 Tampermonkey 中新建脚本，粘贴本目录 `pikpak-helper-plus.user.js` 的完整内容并保存。网页中的“配置 aria2”按钮只打开摘要；实际配置使用以下油猴菜单：

- `配置 aria2 地址、目录与参数`
- `设置或更换 aria2 RPC 密钥`
- `清除 aria2 RPC 密钥`
- `清除旧版 RPC 配置`

整套 RPC 配置保存到 Tampermonkey 的脚本存储，键名为 `pikpakSecureRpcConfig.v1`。页面仅显示配置摘要，不保存或展示完整 RPC 配置、密钥。密钥可通过单独菜单清除。

密钥绑定完整 RPC 地址；更换地址会清除已有密钥，需重新设置。设置后重新打开网页配置摘要查看最新状态。RPC 只在主动测试或推送时发送。

**首次使用不会自动读取或迁移旧配置。** 如需删除旧版遗留信息，可使用清理菜单移除当前 PikPak 网站 localStorage 中的 `ariaHost`、`ariaPath`、`ariaToken`、`ariaParams` 四个键。清理后，其他仍依赖这些键的旧脚本也会失去配置。

## RPC 地址与下载路径

- `localhost`、`127.0.0.1`、`[::1]` 回环地址允许 HTTP，例如 `http://127.0.0.1:6800/jsonrpc`。
- 其他地址必须使用 HTTPS，包括局域网 IP。RPC 服务应配置自己的密钥；下载路径指 **aria2 所在机器** 的路径。
- RPC 请求禁止 HTTP 重定向；不支持重定向控制或请求失败时，不回退到网页 `fetch`。
- 仅声明 PikPak API 和本机连接权限；远程 HTTPS RPC 需要在 Tampermonkey 中授权对应主机。遇到域名阻止时，只添加你的 RPC 主机到允许列表，无需允许所有域名。
- 下载根目录支持 Windows 盘符绝对路径和 POSIX 绝对路径，例如 `D:/Downloads/`、`/downloads/`；拒绝相对路径、UNC 网络路径和 Windows 设备路径。
- 来自远端的目录名、文件名须通过校验：拒绝路径分隔符、`.` / `..` 点段、控制字符和 Windows 保留名称等不安全内容。

路径限制是字符串层面的约束，**不是操作系统文件沙箱**；不能防止 aria2 主机上已有的符号链接、目录联接或其他文件系统映射改变实际落盘位置。

## 自定义 aria2 参数

参数采用 `键=值;键=值` 格式，例如 `split=4;max-connection-per-server=4;continue=true`。值中允许保留 `=`。

仅接受脚本白名单内的分段/连接数、续传、重试、超时、限速、User-Agent、Referer、请求头及代理参数；不在白名单中的参数会被拒绝。`dir`、`out` 不允许通过自定义参数覆盖，下载路径由脚本统一生成。

具体白名单：`split`、`max-connection-per-server`、`min-split-size`、`continue`、`max-tries`、`retry-wait`、`timeout`、`connect-timeout`、`max-download-limit`、`user-agent`、`referer`、`header`、`all-proxy`、`http-proxy`、`https-proxy`。`header` 可重复，其他键不能重复；拒绝控制字符及中间空项，允许末尾分号。

## 保留的上游限制

- 分享目录接口仍是单次最多 100 条，**尚未补充分页**；大目录可能漏项。
- 缺少 `web_content_link` 时仍会使用 `medias[0]`，**未验证是否为原文件**。推送成功不等于文件已下载完毕，也不代表视频与原文件字节一致。
- 未新增直链过期后的自动重取或恢复机制。
- 未新增登录、转存或绕过分享权限的能力；非视频文件没有可用直链时仍可能失败。

## 验证与反馈

离线测试命令（从仓库根目录运行）：

```sh
node pikpak/pikpak-helper-plus.test.cjs
```

29 项离线测试全部通过，仓库原有 EFTarkov 测试通过。另在真实浏览器中使用上游 Vue、合成 PikPak 数据和模拟 GM 接口验证了配置摘要无密钥回显、无自动 RPC、手动测试、单文件推送、分享及网盘两条多层目录分支；记录的嵌套任务路径为 `/downloads/资料/第一章/说明.txt`。受控 302 端点在浏览器 Fetch 模拟层被拒绝，没有追加下载任务。

上述浏览器检查没有安装或运行真实 Tampermonkey，也未调用用户账号、真实 aria2 或 CDN 下载。实际 GM 沙箱、域名授权与 `redirect: error` 的扩展层行为尚未实机联调，仍需安装后验证；模拟接口通过不等于真实扩展已经验证。

[项目主页](https://github.com/richardlzs/TampermonkeyScripts/tree/main/pikpak) · [问题反馈](https://github.com/richardlzs/TampermonkeyScripts/issues)

反馈时请说明 Tampermonkey 版本、操作步骤和错误信息；移除 RPC 密钥、账号 token、完整签名下载链接及其他私人信息。

## 来源与许可

原作者：**jdysya**。原项目及脚本声明采用 MIT 许可。本目录保留其作者署名；安全修复版延续 MIT 许可。

本次修改所依据的原始 2.0.1 用户脚本 SHA-256：

```text
93c42f373b4d376fb737aac7e933d24321244dddd4eda2080f68aaa0d93ab885
```

该摘要用于标识审计和修改的输入文件，不代表未来上游版本或 CDN 内容已被验证。

```text
MIT License

Copyright (c) jdysya
Copyright (c) 2026 Richard

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
