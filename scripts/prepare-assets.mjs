import { cp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {downloadAsset} from './download-asset.mjs';

const root = process.cwd();
const out = path.join(root, 'public');
const copy = async (from, to) => { await mkdir(path.dirname(to), { recursive: true }); await cp(from, to, { recursive: true }); };
for (const [name, target] of [['pymupdf-wasm', 'pymupdf'], ['gs-wasm', 'ghostscript']]) {
  const base = `node_modules/@bentopdf/${name}`;
  for (const dir of ['dist', 'assets']) {
    try { await stat(`${base}/${dir}`); } catch { continue; }
    await copy(`${base}/${dir}`, `${out}/engines/${target}/${dir}`);
  }
}
await copy('node_modules/tesseract.js/dist/worker.min.js', `${out}/ocr/worker.min.js`);
await copy('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt', `${out}/ocr/worker.min.js.LICENSE.txt`);
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (/\.(?:js|wasm)$/.test(file) || file === 'LICENSE') await copy(`node_modules/tesseract.js-core/${file}`, `${out}/ocr/core/${file}`);
}
for (const dir of ['cmaps', 'standard_fonts']) await copy(`node_modules/pdfjs-dist/${dir}`, `${out}/engines/pdfjs/${dir}`);
const revision = '806cd9adc8c6e8abc11c782db1818c990576bebc';
const hashes = { eng: '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91', chi_sim: 'b8a23f10c7de500891eb458a8adc9cc58ab7f242f08b7d149f5e9aea4ad5db7c' };
const notoRevision='f8d157532fbfaeda587e826d4cd5b21a49186f7c';
const sources=(repository,commit,file)=>[
 `https://raw.githubusercontent.com/${repository}/${commit}/${file}`,
 `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${file}`
];
const downloads = ['eng', 'chi_sim'].map(lang => ({ dest: `ocr/lang/${lang}.traineddata.gz`, urls:sources('naptha/tessdata',revision,`4.0.0_best_int/${lang}.traineddata.gz`), expected: hashes[lang] }));
downloads.push({ dest: 'fonts/NotoSansCJKsc-Regular.otf', urls:sources('notofonts/noto-cjk',notoRevision,'Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf'), expected: '2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b' });
downloads.push({ dest: 'fonts/OFL.txt', urls:sources('notofonts/noto-cjk',notoRevision,'Sans/LICENSE'), expected: '6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2' });
const records = [];
for (const item of downloads) {
  const destination = path.join(out, item.dest);
  console.log(`Verifying ${item.dest}`);
  const verified=await downloadAsset({destination,urls:item.urls,expected:item.expected});
  records.push({dest:item.dest,urls:item.urls,bytes:verified.bytes,sha256:verified.sha256,source:verified.source});
}
await writeFile(`${out}/asset-provenance.json`, JSON.stringify({ generated: new Date().toISOString(), models: records }, null, 2));
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const dependencyNotices = [];
for (const name of Object.keys(manifest.dependencies)) {
  const directory = `node_modules/${name}`;
  const metadata = JSON.parse(await readFile(`${directory}/package.json`, 'utf8'));
  const licenses = (await readdir(directory)).filter(file => /^(license|copying|notice)/i.test(file));
  for (const file of licenses) await copy(`${directory}/${file}`, `${out}/licenses/${name}/${file}`);
  dependencyNotices.push({ name, version: metadata.version, license: metadata.license, repository: metadata.repository, licenseFiles: licenses });
}
await writeFile(`${out}/licenses/dependencies.json`, JSON.stringify(dependencyNotices, null, 2));
await copy('LICENSE', `${out}/licenses/FileFit-LICENSE.txt`);
await copy('THIRD_PARTY_NOTICES.md', `${out}/licenses/THIRD_PARTY_NOTICES.md`);
console.log('Same-origin engine assets prepared.');
