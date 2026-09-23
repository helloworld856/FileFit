# 文件达标助手 · FileFit

浏览器本地处理图片和 PDF，按实际输出大小、格式、尺寸和页数检查上传要求。原文件不覆盖，未达标结果明确标记。中文优先，支持英文界面。

首版包括批量图片压缩与 JPEG/PNG/WebP/AVIF 转换、可选 PNG 调色板压缩、HEIC 输入、尺寸/DPI/毫米换算、长图拼接、图片转 PDF、PDF 保留文字压缩与可选图片化压缩、合并/拆分/页面整理与自定义纸张、PDF 转图片与文字、中文和英文 OCR、加密解密、预设、逐项验收及 JSON/可读 HTML 报告。实际验证范围和限制见[验收记录](docs/verification.md)。

[English](README.en.md) · [第三方声明](THIRD_PARTY_NOTICES.md) · [验收记录](docs/verification.md)

## 本地运行

安装 Node.js 22 或更高版本，在项目目录执行：

```sh
npm ci
node scripts/prepare-assets.mjs
npm run dev
```

打开终端显示的本机地址（通常是 http://127.0.0.1:5173）。Windows 可双击 `scripts/start-windows.cmd`。首次安装需要联网下载 npm 依赖、中英文 OCR 模型和字体。脚本将引擎与模型复制到 `public/`，运行时从同一站点获取，不上传用户文件。大型 WASM、OCR 模型和字体是构建时生成资源，不纳入 Git 提交；新克隆仓库必须先运行资源准备脚本。

```sh
npm test
npm run build
npm run preview
```

部署时将 `dist/` 完整放到静态服务器的站点根路径。不要直接双击 HTML；Worker、WASM 和 PWA 需要 HTTP localhost 或 HTTPS。不要只拷贝 index.html。

## Docker

```sh
docker build -t filefit .
docker run --rm -p 8080:8080 filefit
```

访问 http://localhost:8080。镜像构建需要网络；运行仅提供静态文件。公网部署需另配 HTTPS，并提供所部署版本的源码链接。Docker 构建尚未在此交付环境验证。

## 使用及边界

添加文件，设置体积与格式要求，运行处理，再检查报告并下载。KB/MB 使用十进制。PDF 保留内容与图片化压缩是不同模式；图片化会丢失可选择文字、链接和表单。OCR 识别可能错误，需要人工复核。PDF 修改会影响数字签名，保留原件。

现代桌面 Chromium 是主要验证目标；HEIC/AVIF、超大文件、移动设备内存及特殊 PDF 的实际支持以验收记录为准。不能保证任意体积、像素和质量组合均可达到。功能范围以已实现界面和验收结果为准，设计文档不是完成声明。

## 隐私与离线

文件内容和密码只用于当前页面处理，不写入静态资源缓存。设置和预设可以保存在浏览器本地。刷新后需要重新添加文件。PWA 按需缓存成功获取的同源静态资源：首次使用某个功能仍可能需要下载，浏览器也可能清除缓存，不能保证首次打开或所有功能完全离线。缓存设有数量和单项体积上限。可通过界面的缓存清除操作或浏览器站点数据设置清除。

## 开源

AGPL-3.0-only，详见 LICENSE。复用 BentoPDF 相关 PDF 引擎，保留上游版权。公开部署前将源码入口指向该部署版本的完整对应源码，并检查第三方打包声明。此项目尚未自动创建或发布 GitHub 仓库。
