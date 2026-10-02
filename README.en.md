# FileFit

A browser-local image and PDF workspace that checks upload requirements against actual output bytes, format, dimensions and page count. Originals are preserved. Failed requirements are not reported as successful.

The first release includes batch image fitting and JPEG/PNG/WebP/AVIF conversion, optional PNG palette compression, HEIC input, resizing and DPI/millimetre conversion, image stitching, image-to-PDF, content-preserving and explicitly rasterized PDF compression, PDF page tools with custom paper sizes, text/image extraction, Chinese/English OCR, encryption, presets, and JSON plus readable HTML reports. See the [verification ledger](docs/verification.md) for exercised paths and limits.

[中文](README.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Verification](docs/verification.md)

Use Node.js 22+:

```sh
npm ci
node scripts/prepare-assets.mjs
npm run dev
```

Open the localhost URL shown by Vite. Windows users may run `scripts/start-windows.cmd`. Initial installation needs internet access for dependencies, pinned OCR language models and fonts. Runtime engines are served from the same origin; document content is processed locally.

Large WASM engines, OCR models and fonts are generated build assets and are not committed to Git. Run `node scripts/prepare-assets.mjs` in every fresh checkout before starting or building.

```sh
npm test
npm run build
npm run preview
```

Serve the complete `dist/` directory at your site's root. Workers, WebAssembly and service workers require an HTTP localhost or HTTPS server, not a file URL.

```sh
docker build -t filefit .
docker run --rm -p 8080:8080 filefit
```

The container serves static files at port 8080. Configure HTTPS separately for public hosting. GitHub Actions builds and starts the image, then checks engine resources and MIME types. See the verification ledger for actual results.

FileFit uses decimal KB/MB. Rasterized PDF compression loses selectable text, links and forms; choose that mode explicitly. OCR needs human review. PDF edits affect signatures. Arbitrary size, quality and pixel constraints cannot always be satisfied.

Inputs are limited to 100 MB each. Images and output canvases are limited to 16 million pixels; stitching and image-to-PDF inputs have a combined limit of 40 million pixels. Header dimensions are checked before decoding or previewing. Unreadable dimensions are rejected. HEIC supports one display image; multiple-image files are rejected before decoding. These limits reduce memory pressure but cannot guarantee success on every mobile device.

Chromium exercises the full engine flows. WebKit exercises basic image processing, invalid inputs and keyboard interactions; Linux CI also checks Firefox. Actual Safari and mobile devices still need testing.

```sh
npx playwright install chromium firefox webkit
npm run test:browser
```

Set `FILEFIT_CROSS_BROWSER=1` to run all three browsers (PowerShell: `$env:FILEFIT_CROSS_BROWSER='1'`). Chromium is the default. Asset downloads use timeouts, retries and commit-pinned mirrors; only files matching the expected SHA-256 enter the cache.

Files and passwords are not stored in the static-resource cache. Preferences may persist locally; files must be added again after refresh. PWA caching is opportunistic and bounded: a feature must first download its resources, and the browser may evict them. Full first-use offline support is not promised. Clear caches through the app or browser site-data settings.

Source: [helloworld856/FileFit](https://github.com/helloworld856/FileFit). Licensed under AGPL-3.0-only. Before public deployment, provide a visible link to the complete Corresponding Source for the exact deployed version. Review the bundled dependency notices and source obligations.
