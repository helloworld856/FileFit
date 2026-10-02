const base=process.argv[2];
if(!base)throw new Error('Usage: node scripts/smoke-server.mjs http://127.0.0.1:8080');

const checks=[
 ['/',/text\/html/i],
 ['/asset-manifest.json',/application\/json/i],
 ['/sw.js',/javascript/i],
 ['/ocr/worker.min.js',/javascript/i],
 ['/ocr/core/tesseract-core.wasm',/application\/wasm/i],
 ['/engines/pymupdf/assets/pyodide.asm.wasm',/application\/wasm/i],
 ['/engines/pymupdf/dist/index.js',/javascript/i],
 ['/ocr/lang/eng.traineddata.gz',null],
 ['/fonts/NotoSansCJKsc-Regular.otf',null]
];
const visited=new Set();
for(let index=0;index<checks.length;index++){
 const [path,contentType]=checks[index];
 if(visited.has(path))continue;
 visited.add(path);
 const response=await fetch(new URL(path,base));
 if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
 if(contentType&&!contentType.test(response.headers.get('content-type')||''))throw new Error(`${path}: wrong Content-Type ${response.headers.get('content-type')}`);
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(!bytes.length)throw new Error(`${path}: empty body`);
 console.log(`PASS ${path} ${bytes.length} bytes`);
 if(path==='/asset-manifest.json'){
  const manifest=JSON.parse(new TextDecoder().decode(bytes));
  for(const entry of Object.values(manifest)){
   for(const name of [entry.file,...(entry.assets||[])]){
    if(typeof name!=='string'||!/^assets\/[A-Za-z0-9_.-]+\.(?:m?js|wasm)$/.test(name))continue;
    const asset='/'+name;
    checks.push([asset,asset.endsWith('.wasm')?/application\/wasm/i:/javascript/i]);
   }
  }
 }
}
if(process.argv.includes('--expect-engine-404')){
 const missing=await fetch(new URL('/engines/filefit-missing.wasm',base));
 if(missing.status!==404)throw new Error(`Missing engine asset must return 404, got ${missing.status}`);
 console.log('PASS missing engine asset returns 404');
}
