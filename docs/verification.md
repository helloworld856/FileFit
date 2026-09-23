# FileFit verification ledger

Executed on 2026-09-23 in the local Windows workspace, Node.js 22, desktop Chromium.

## Automated checks

- `npm test`: 22 tests passed across output rules, image geometry/DPI/animation detection, PDF page operations including custom paper dimensions, and escaped readable reports.
- `npm run build`: TypeScript and Vite production build passed. Vite reports large optional PDF/HEIC chunks; these are dynamically loaded.
- `npm audit --audit-level=moderate`: 0 vulnerabilities at the check time.
- The same-origin asset preparation script copied pinned PyMuPDF, Ghostscript, PDF.js, Tesseract, OCR model and font files. Source revisions and SHA-256 checksums for downloaded model/font assets are recorded by `scripts/prepare-assets.mjs` and in the generated `public/asset-provenance.json`.

## Browser checks

- The default 200 KB image flow compressed the generated 1.07 MB PNG sample to 195.1 KB and marked it compliant. With a 2 MB limit and “keep original”, the same sample was returned at 1.07 MB without re-encoding.
- AVIF conversion produced a 166.7 KB file from the sample after explicitly locating the codec WASM, and the result passed actual-byte and format checks.
- Optional 216-colour indexed PNG compression produced a 23.3 KB file from the 1.07 MB sample, passed byte/format checks, and both original and output decoded in Chromium at 1600 × 1000 pixels. It deliberately reduces colours and converts partial alpha to a binary transparency mask.
- At 300 DPI, entering 35 mm in the width converter set 413 pixels. The custom PDF paper width/height controls appeared when selected; an automated generated-PDF test confirmed the point dimensions.
- The PDF browser harness (`tests/pdf-browser.html`) generated a PDF, compressed it in preserve-content mode, and reopened the result. Page dimensions, link annotation and extractable text survived. AES encryption, wrong-password rejection, decryption with quote/backslash in the password, and active worker cancellation passed.
- The same browser harness produced an English OCR text file and searchable PDF, recognized the generated sample text, and retained page dimensions.
- The 390 × 844 responsive viewport had no horizontal overflow in the tested screen. The main interface, mobile menu and result controls remained in the accessibility tree.

## Scope limits to address before a public release

- Docker build/run, installed PWA/offline engine caching, Safari and Firefox, mobile memory pressure, real HEIC inputs, and damaged or unusually large PDFs have not been tested in this environment.
- OCR has been exercised with generated English text; Chinese OCR and scan quality need real-document testing.
- PNG palette compression is opt-in because it can visibly change colours and transparency. Very large images skip it and fall back to normal PNG encoding. Keep-original behavior avoids re-encoding compliant inputs.
- A complete third-party source and license audit for the bundled Pyodide/PyMuPDF wheels, codecs and native libraries is still needed before redistribution. See `THIRD_PARTY_NOTICES.md`.
- This local task has not yet published a GitHub repository or deployed a public site.
