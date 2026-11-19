# IPinfo AS 全部 IP 段导出

在 `https://ipinfo.io/AS数字` 页面的 **IP Ranges** 标题右侧添加“**导出全部IP段**”按钮。

## 安装和使用

1. 在 Tampermonkey 中新建脚本，将 [`ipinfo-export-ranges.user.js`](./ipinfo-export-ranges.user.js) 的完整内容粘贴进去并保存。
2. 刷新 IPinfo 的 AS 页面，例如 [AS36002](https://ipinfo.io/AS36002)。
3. 点击“导出全部IP段”，下载 `AS36002_all_ip_ranges.csv`。

## 导出内容

- 自动切换 IPv4、IPv6，点击 IP Ranges 区域内的“Show more IP Ranges”直到全部展开，包含默认折叠的条目。
- 两类网段合并为一个 CSV，只有一列，无表头，每行一个 CIDR；完全相同的网段去重，保留彼此包含或重叠但 CIDR 不同的网段。
- 使用 UTF-8 BOM 和 Windows 换行，可直接用 Excel 或文本编辑器打开。
- 导出结束后恢复原来的 IP 类型和展开状态；导出期间暂时阻止手动切换、折叠，以免数据混淆。
- 加载超时、展开无响应或无法读取列表时显示错误，不下载不完整结果；可重新点击按钮重试。

脚本使用 `@grant none`，复用网页上的切换和展开操作，无需 API Token 或额外跨域权限。范围为该页面公开展示和正常展开可获取的数据。只在 AS 首页添加按钮，不在单个网段详情页添加。
