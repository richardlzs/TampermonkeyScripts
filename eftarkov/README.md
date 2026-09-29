# EFTarkov 物价天梯增强

适用于 [EFTarkov 物资物价天梯](https://www.eftarkov.com/news/web_210.html) 的 Tampermonkey 脚本，支持 PvE、PvP 和 PvP Season（原站显示为“赛季”）。

## 安装

脚本发布到仓库的 `main` 分支后，可打开 [GitHub Raw 安装链接](https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/eftarkov/eft-price.user.js)，在 Tampermonkey 中安装。首次安装前须确保该文件已经提交并推送到 `main`，否则链接不可用。

也可以在 Tampermonkey 中新建脚本，将 [`eft-price.user.js`](./eft-price.user.js) 的内容粘贴进去并保存，然后刷新天梯页面。脚本使用 `@grant none`，无需额外跨域权限。

脚本的 `@updateURL` 和 `@downloadURL` 都指向上述 Raw 文件。发布新版本时递增 `@version` 并将脚本推送到 `main`，Tampermonkey 才能检测并下载更新。

## 功能

- 沿用原站“跳蚤价格与最高商人收购价取较高值，再除以格子数”的算法。
- 在原站的 50,000 ₽/格以上五档之后增加 40,000、30,000、20,000、10,000 ₽/格起始的四档；50,000 ₽/格及以上物品仍由原站渲染。
- 从当前模式 API 的 `handbookCategories` 动态生成官方顶级和下级分类，筛选覆盖原站和新增的所有档位。
- 顶级和下级分类都可多选。一个已选顶级分类没有勾选下级分类时，显示该顶级分类的全部物品。“全部”取消限制，“清空”不显示任何物品。
- 原站会在本机浏览器的 `localStorage.currentMode` 中记住上次选择的模式；脚本不会覆盖已有值。当前页面以本页发起的模式请求为准，其他标签页切换模式后，本页刷新时才会跟随。每种模式的筛选条件也分别保存在 `localStorage`，切换模式并刷新后会恢复。

## 数据与限制

脚本优先读取原站对 `boss.php?id=9/10/16` 的 `fetch` 响应；未捕获到时用页面原生 `fetch` 请求当前模式的数据。请求失败时，原站已有天梯仍可使用，新增档位及分类会显示错误状态。分类缺失的物品列在“未分类（接口无分类）”。

原站首次访问且尚未保存模式时，右下角显示“赛季”，价格页却默认请求 PvP。脚本在页面脚本运行前将首次模式设为 `season`，使原站和新增档位使用同一模式；已有的 `currentMode` 不会被改写。

此脚本是独立增强脚本，不是 EFTarkov 官方提供的脚本。无需也不应把原站 JavaScript 或完整 API 响应复制到本仓库。

## 开发验证

使用 Node.js 运行 `node eftarkov/eft-price.test.cjs`，检查模式记忆、跨标签页隔离、三模式响应隔离、乱序响应、价格下限和异常字段的 HTML 安全。实际页面仍需在 Tampermonkey 中验证。
