# 智慧中小学教材 PDF 下载

1. 在 Tampermonkey 里新建脚本，将 [`smartedu-pdf.user.js`](./smartedu-pdf.user.js) 的全部内容粘贴进去并保存。
2. 用装有 Tampermonkey 的浏览器打开或刷新[教材详情页](https://basic.smartedu.cn/tchMaterial/detail?contentType=assets_document&contentId=454dfc04-1259-20fe-cfa2-108408618de7&catalogType=tchMaterial&subCatalog=dzjc)。
3. 等教材加载后，点击阅读区域右下角的 **下载教材 PDF**。整本教材可能需要等一会儿，下载结果请在浏览器的下载列表查看。

下载文件优先以教材详情页显示的标题命名。找不到标题时，使用阅读器提供的文件名。

脚本保存当前阅读器打开的原始 PDF，保留原页和文字层。它只在 `basic.smartedu.cn` 内嵌的指定阅读器中显示按钮，不读取登录凭据或另外请求 PDF 地址。

如果按钮没出现，检查脚本是否启用，以及 Tampermonkey 是否获准在 `x-edu-pdfjs.ykt.eduyun.cn` 运行。页面若无法正常打开教材，请先解决页面的登录或加载问题，再尝试保存。
