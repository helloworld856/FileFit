# FileFit verification ledger

Latest hardening checks: 2026-10-02, local Windows workspace, Node.js 24.12.0, desktop Chrome and Playwright WebKit. GitHub CI uses Node.js 22 on Linux. Historical observations from 2026-09-23 are retained below.

## Automated checks

- `npm test`: 30 Vitest tests and 3 Node tests passed. Coverage includes output rules, image headers/pixel limits, HEIC display-image classification, pre-allocation PDF size rejection, geometry/DPI/animation detection, PDF page operations, escaped readable reports, download fallback/checksum rejection and module-worker MIME rejection.
- `npm run build`: TypeScript and Vite production build passed. Vite reports large optional PDF/HEIC chunks; these are dynamically loaded.
- `npm audit --audit-level=moderate`: 0 vulnerabilities at the historical 2026-09-23 check; not a continuous security audit.
- The same-origin asset preparation script copied pinned PyMuPDF, Ghostscript, PDF.js, Tesseract, OCR model and font files. Source revisions and SHA-256 checksums for downloaded model/font assets are recorded by `scripts/prepare-assets.mjs` and in the generated `public/asset-provenance.json`.
- All four commit-pinned jsDelivr fallback assets were downloaded and matched their expected SHA-256. Cache reuse passed. Downloads have a 30-second timeout per attempt, two attempts per source and atomic writes after verification; no unverified download is accepted.
- `node scripts/smoke-server.mjs http://127.0.0.1:4173` passed 19 resource checks: HTML/build manifest, service worker, OCR worker, two WASM engines, PDF engine loader, OCR model/font and emitted modules listed in the build manifest, including the PDF.js `.mjs` worker. Nginx explicitly maps `.mjs` to JavaScript.
- GitHub Actions runs the unit suite, production build, Playwright Chromium/Firefox/WebKit checks and a separate Docker build/run job. The Docker smoke check additionally requires missing engine resources to return 404.

## Browser checks

- Automated command: `FILEFIT_LOCAL_CHROME=1 FILEFIT_CROSS_BROWSER=1 npx playwright test --project=chromium --project=webkit`: 21 passed, 5 Chromium-only engine cases explicitly skipped on WebKit. Environment assignments use shell-specific syntax on Windows.
- Chromium: a real pinned HEIC fixture with its secondary image hidden converted to JPEG and PDF; the unmodified multiple-image fixture was rejected before decoding. AVIF encoding returned a compliant output; PDF compression/encryption, wrong-password rejection, worker cancellation and English OCR/searchable PDF passed.
- Both Chrome and WebKit: oversized images were rejected before thumbnail/preview decoding, damaged PDFs produced a recoverable error, generated sample image processing completed, missing APIs disabled processing with an explanation, controls had the tested accessible names, and modal Escape/focus restoration passed. Four representative small-text selectors met 4.5:1 contrast against white. This is targeted coverage, not a complete WCAG audit.
- Local Firefox could not start: its installed Playwright runtime failed with a Windows side-by-side assembly error before opening the application. Firefox coverage is configured in Linux CI; local failure is not counted as a passed browser check.

Historical manual observations (2026-09-23):

- The default 200 KB image flow compressed the generated 1.07 MB PNG sample to 195.1 KB and marked it compliant. With a 2 MB limit and “keep original”, the same sample was returned at 1.07 MB without re-encoding.
- AVIF conversion produced a 166.7 KB file from the sample after explicitly locating the codec WASM, and the result passed actual-byte and format checks.
- Optional 216-colour indexed PNG compression produced a 23.3 KB file from the 1.07 MB sample, passed byte/format checks, and both original and output decoded in Chromium at 1600 × 1000 pixels. It deliberately reduces colours and converts partial alpha to a binary transparency mask.
- At 300 DPI, entering 35 mm in the width converter set 413 pixels. The custom PDF paper width/height controls appeared when selected; an automated generated-PDF test confirmed the point dimensions.
- The PDF browser harness (`tests/pdf-browser.html`) generated a PDF, compressed it in preserve-content mode, and reopened the result. Page dimensions, link annotation and extractable text survived. AES encryption, wrong-password rejection, decryption with quote/backslash in the password, and active worker cancellation passed.
- The same browser harness produced an English OCR text file and searchable PDF, recognized the generated sample text, and retained page dimensions.
- The 390 × 844 responsive viewport had no horizontal overflow in the tested screen. The main interface, mobile menu and result controls remained in the accessibility tree.

## Scope limits to address before a public release

- Local Docker daemon was unavailable, so local Docker build/run is not claimed; the added GitHub job performs it. Installed PWA/offline engine caching, actual Safari and mobile memory pressure still need device testing. Browser WebKit testing is not a Safari-device certification.
- Input limits are shared: 100 MB per image/PDF, 16 million pixels per image/output canvas, 40 million combined input pixels for stitching/image-to-PDF. The first 1 MiB of image metadata must expose dimensions. Conservative header checks may reject valid files with unusually large metadata. Limits reduce allocation risk and do not guarantee freedom from out-of-memory failures.
- OCR has been exercised with generated English text; Chinese OCR and scan quality need real-document testing.
- PNG palette compression is opt-in because it can visibly change colours and transparency. Keep-original behavior avoids re-encoding compliant inputs.
- A complete third-party source and license audit for the bundled Pyodide/PyMuPDF wheels, codecs and native libraries is still needed before redistribution. See `THIRD_PARTY_NOTICES.md`.
- Source is published at [helloworld856/FileFit](https://github.com/helloworld856/FileFit). This task does not deploy a public site or publish a Docker image.
- Workers remain isolated per job so cancellation can terminate a job without corrupting later tasks. Worker pooling and dependency-version changes are deferred until profiling or regression evidence warrants them. Reproducible installs use the committed lockfile and `npm ci`.
- Whole-change independent review found two important issues, both fixed with red-to-green regressions: production `.mjs` MIME coverage and HEIC multiple-image truncation/allocation. One minor remains deferred: rapid overlapping preview requests can replace one another and retain a replaced object URL until the page closes.
