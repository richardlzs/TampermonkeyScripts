# IPinfo AS 全部 IP 段导出

在 `https://ipinfo.io/AS数字` 页面的 **IP Ranges** 标题右侧添加“**导出全部IP段**”按钮。

## 安装和使用

1. 在 Tampermonkey 中新建脚本，将 [`ipinfo-export-ranges.user.js`](./ipinfo-export-ranges.user.js) 的完整内容粘贴进去并保存。
2. 刷新 IPinfo 的 AS 页面，例如 [AS49304](https://ipinfo.io/AS49304#ip-ranges)。
3. 点击“导出全部IP段”，下载 `AS49304_all_ip_ranges.csv`。

## 导出内容

- 从 [RIPEstat RIS Prefixes](https://stat.ripe.net/docs/data-api/api-endpoints/ris-prefixes) 读取最新 BGP 快照，导出由当前 ASN 发起、被 RIPE RIS 观测到的全部 IPv4 和 IPv6 前缀。导出数量独立于 IPinfo 网页表格的展示上限，两者可能因采集时间和覆盖范围而有差异。
- 两类网段合并为一个 CSV，只有一列，无表头，每行一个 CIDR；完全相同的网段去重，保留彼此包含或重叠但 CIDR 不同的网段。
- 使用 UTF-8 BOM 和 Windows 换行，可直接用 Excel 或文本编辑器打开。
- 接口请求失败或返回的前缀列表不完整时，页面会提示错误，可以重新点击按钮重试。

脚本只在 AS 首页添加按钮。点击后向 RIPEstat 查询当前 ASN，无需登录、API Token 或额外的 Tampermonkey 权限。
