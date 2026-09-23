# Third-party notices

FileFit is distributed under **AGPL-3.0-only**, with the full terms in LICENSE. Components retain their own copyrights and licenses. This project is independent of BentoPDF and Artifex; their names are attribution, not endorsement.

## PDF processing lineage

The PDF adapter uses the approaches and browser engines studied in [BentoPDF](https://github.com/alam00000/bentopdf), pinned reference commit `044b2eae998dc5bbd97b1441f3189858a64d7f34`. Reference files: `src/js/utils/compress.ts`, `src/js/utils/pymupdf-loader.ts`, `src/js/utils/wasm-provider.ts`, and `src/js/logic/compress-pdf-page.ts`. FileFit adds its own rules, byte-size checking, queue and UI; it does not represent the upstream UI or brand.

| Component | Version/source | License |
| --- | --- | --- |
| BentoPDF reference | Commit above | AGPL-3.0-only |
| PyMuPDF browser wrapper | [@bentopdf/pymupdf-wasm 0.11.16](https://github.com/alam00000/bentopdf-pymupdf-wasm) | AGPL-3.0-only |
| PyMuPDF / MuPDF | PyMuPDF 1.26.3, bundled wheel; [source](https://github.com/pymupdf/PyMuPDF) | AGPL-3.0; Artifex copyright |
| Ghostscript browser wrapper | [@bentopdf/gs-wasm 0.1.1](https://github.com/alam00000/bentopdf-gs-wasm) | AGPL-3.0-only; underlying Ghostscript AGPL |
| PDF.js | Installed exact version in package-lock.json; [source](https://github.com/mozilla/pdf.js) | Apache-2.0; bundled fonts carry additional notices |
| pdf-lib, fontkit | Exact versions in lockfile; [source](https://github.com/Hopding/pdf-lib) | MIT |

Engine package `build_scripts/` and linked repositories provide upstream build instructions. PyMuPDF also bundles Pyodide/CPython and Python wheels; wheel `.dist-info` license records and the engine package must remain available when redistributing. Pyodide's exact version is recorded in `assets/pyodide-lock.json`. Do not describe all of those bundled dependencies as AGPL.

## Images, OCR and application libraries

| Component | Source | License |
| --- | --- | --- |
| jSquash AVIF/JPEG/PNG/WebP | [jSquash](https://github.com/jamsinclair/jSquash), exact package versions in lockfile | Apache-2.0 wrappers; codecs retain upstream notices |
| heic2any | [heic2any](https://github.com/alexcorvi/heic2any) | MIT wrapper; bundled libheif/libde265 retain upstream licenses |
| Tesseract.js / Tesseract core | [Tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 |
| English / Simplified Chinese OCR models | [naptha/tessdata](https://github.com/naptha/tessdata), commit `806cd9adc8c6e8abc11c782db1818c990576bebc`, `4.0.0_best_int` | Apache-2.0 |
| Noto Sans CJK SC | [noto-cjk](https://github.com/notofonts/noto-cjk), commit `f8d157532fbfaeda587e826d4cd5b21a49186f7c` | SIL Open Font License 1.1; `public/fonts/OFL.txt` |
| React / React DOM | [React](https://github.com/facebook/react) | MIT |
| Lucide icons | [Lucide](https://github.com/lucide-icons/lucide) | ISC |
| JSZip | [JSZip](https://github.com/Stuk/jszip) | MIT or GPL-3.0-or-later; FileFit uses MIT option |

`scripts/prepare-assets.mjs` copies installed direct-dependency licenses into `public/licenses/` and records their exact versions. `public/asset-provenance.json` records pinned model/font URLs, byte counts and SHA-256 hashes. npm archive integrity is recorded by package-lock.json. To update an engine, explicitly update the pinned package version, regenerate assets, review notices, and rerun the relevant browser output tests.

When serving a modified AGPL application to network users, provide the Corresponding Source for that deployed version, including build scripts and changes, through a visible source link. A generic upstream link alone does not identify your modified source. No public FileFit repository has been assigned in this local delivery; set that link to your own published source before public service. Distribution packaging and bundled codec source/license completeness need review before a public release.
