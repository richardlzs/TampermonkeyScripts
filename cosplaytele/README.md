# Cosplaytele 点击广告修复

2026-11-19 复查了首页、[分类页](https://cosplaytele.com/category/cosplay/)、分类分页和多篇文章。网站至少换过一次广告加载器，现有样本无法判断更换频率。

Tampermonkey 1.2.0 增加了按行为拦截，可应对广告域名或加载器特征变化。AdGuard 规则也覆盖了已确认的两版加载器。

## 调查结果

当前 HTML 含一段短加载器，先用 `document.createElement('script')` 创建脚本元素，再写入 `s.settings = ulgt` 和 `zesty-career.com` 的地址。内置浏览器实际收到了该脚本的 HTTP 200 响应，随后又加载了 `unlinedsound.com` 的二级脚本。广告代码会绑定 `mousedown`，启用新标签页和背后弹窗，频率配置为每小时最多 3 次。

2026-10-26 的旧版是约 89 KB 的混淆内联代码，使用 `load1spAndCustomPops` 和 `sore-war.com`。上次点击分类页文章时，正文和广告标签页分别打开。11 月抓取的页面没有这两个旧标记，本次内置浏览器点击进入了正文，未再观察到广告标签页。广告脚本的来源和拦截结果由请求记录确认。

另有一条独立路径：`https://cdn.ouo.io/js/full-page-script.js` 会改写下载链接。页面连续声明了 `domains = ['mediafire.com']` 和 `domains = ['gofile.io']`，后者覆盖前者，因此本次配置实际匹配 Gofile。文章 HTML 中原本为 Gofile 的直链，执行脚本后变成 `http://ouo.io/st/…/?s=编码后的原链接`。这与点击文章触发弹窗是两个不同机制。

## AdGuard 使用方法（优先）

在 AdGuard 的「用户规则」中追加这两行，保存后重新加载网站。

```adblock
||zesty-career.com^$script,domain=cosplaytele.com
cosplaytele.com#%#//scriptlet('abort-current-inline-script', 'Document.prototype.createElement', 's.settings = ulgt')
```

第一条拦截 Cosplaytele 发出的广告脚本请求。第二条按代码特征中止加载器，只换域名时仍能命中。旧规则可以保留，用于仍下发 10 月版本的页面。

如果也希望 Gofile 下载按钮保持原来的直链，可以加上现有的可选规则。

```adblock
||cdn.ouo.io/js/full-page-script.js$script,domain=cosplaytele.com
```

新版、旧版和可选下载链接规则都在 [adguard-rules.txt](./adguard-rules.txt)。这些规则的作用域是 Cosplaytele。

建议在 AdGuard 过滤日志里搜索 `zesty-career.com`，刷新后查看脚本请求是否被拦截。如果第二条已提前中止内联加载器，可能没有这条请求。Chrome 138 及以上使用 AdGuard 5.2 或更新的 MV3 扩展时，可在扩展详情检查「允许用户脚本」开关，以便执行第二条。Windows 客户端需要能过滤这个 HTTPS 页面。纯 DNS 过滤无法应用这两条网页规则。 [AdGuard 用户脚本权限说明](https://adguard.com/kb/adguard-browser-extension/user-scripts-api/)

规则语法见 [AdGuard 自定义规则与支持范围](https://adguard.com/kb/general/ad-filtering/create-own-filters/) 和 [abort-current-inline-script](https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/about-scriptlets.md#abort-current-inline-script)。

## Tampermonkey 使用方法

在 Tampermonkey 中新建脚本，用 [cosplaytele-guard.user.js](./cosplaytele-guard.user.js) 的完整内容替换默认模板，保存后重新加载网站。

脚本推送到 GitHub 的 `main` 分支后，也可以通过 [Raw 安装链接](https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/cosplaytele/cosplaytele-guard.user.js) 安装。`@updateURL` 和 `@downloadURL` 都使用这个地址。发布新版时递增 `@version`，并将新版推送到 `main`。

脚本在页面上下文的 `document-start` 执行。它可以提前中止已确认的两版加载器和 `ouo.io` 下载链接改写。1.2.0 参考了 [Criogaid 的域名白名单思路](https://gist.github.com/Criogaid/9fa9c54ef608ee8a7b3fce83c373218b)，补充以下检查。

- 取消空白 `window.open()` 和脚本发起的白名单外弹窗。站内地址、Telegram、SoraFolder、Gofile、MediaFire 和 X 可由脚本正常打开。
- 取消脚本模拟点击白名单外链接。支持 Navigation API 的浏览器也会尝试取消可取消的同标签页脚本外跳。用户直接点击的链接和浏览器历史操作由浏览器处理。
- 检查脚本通过 `script.src` 或 `setAttribute('src', …)` 设置的外部脚本地址。允许站内脚本和采样页面使用的 Google Tag Manager。图片、字体、样式、视频和普通网络请求继续由页面加载。

保护范围是这个站点的顶层页面。网页里本来就存在的广告链接仍可手动点击。浏览器无法取消的导航、服务器返回的重定向和外部页面自身的广告可能仍会出现。如果网站新增了合法的外站脚本，可以按脚本控制台记录的主机名补充例外。

页面中的拦截脚本无远程依赖，也不申请跨域、剪贴板、下载或存储权限。更新检查和下载由 Tampermonkey 处理。

如果现有安装没有更新地址，先在 Tampermonkey 编辑器里用 1.2.1 或更新版本的内容覆盖旧版，再刷新。浏览器控制台会显示 `[Cosplaytele Guard] 已启用` 和命中时拦截的行为。用这些日志确认页面实际执行了脚本。

## 验证与边界

- 在内置浏览器的临时标签页阻止 `zesty-career.com` 后，主脚本请求被拦截，二级脚本请求没有出现，分类页仍能打开 `/robin-2/`。浏览器阻止请求的测试状态已清理。
- 隔离执行分类页和文章页的实际加载器时，旧版规则会漏过新版加载器。新版 AdGuard scriptlet 和油猴脚本会在插入广告脚本前中止。普通内联脚本仍可创建元素。
- 使用真实的 10 月广告代码和 `ouo.io` 脚本验证了兼容旧版和保留 Gofile 原链接的功能。没有在用户自己的 AdGuard 或 Tampermonkey 配置中安装或验证。
- 1.2.0 共通过 26 项隔离检查，新增覆盖未知域名弹窗、空白弹窗、动态脚本、模拟点击和同标签页外跳，包含正常导航和图片属性的对照。站点样本仍是 11 月版本。内置浏览器不能在测试标签页预注入新版，尚无 Tampermonkey 实装回归。

安装后应重新加载原网页；已经注册的旧事件处理器和已经打开的广告页不会因添加规则自动消失。仅凭连续几次没有广告不能证明修复成功，因为原广告有频率限制；结合过滤日志或上述脚本日志判断。可另外检查 Gofile 按钮地址是否仍为 `https://gofile.io/…`。

基础检查可用 Node.js 运行，无需安装依赖：

```powershell
node cosplaytele/cosplaytele-guard.test.cjs
```

真实脚本测试使用本地 `research/` 中的网页快照及 AdGuard 官方测试包。该目录已忽略。目录存在时可重跑。

```powershell
node cosplaytele/cosplaytele-guard.test.cjs cosplaytele/research cosplaytele/research/2026-11-19
```
