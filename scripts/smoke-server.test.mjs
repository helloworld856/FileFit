import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('production smoke rejects a PDF module worker served as plain text',async()=>{
 let moduleType='text/plain';
 const server=createServer((req,res)=>{
  const url=req.url;
  if(url==='/'){res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/assets/app.js"></script>');}
  else if(url==='/asset-manifest.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:{file:'assets/app.js',assets:['assets/pdf.worker.mjs']}}));}
  else if(url==='/assets/app.js'){res.setHeader('Content-Type','application/javascript');res.end('import("./worker-url.js");');}
  else if(url==='/assets/worker-url.js'){res.setHeader('Content-Type','application/javascript');res.end('const worker="/assets/pdf.worker.mjs";');}
  else if(url==='/assets/pdf.worker.mjs'){res.setHeader('Content-Type',moduleType);res.end('export {};');}
  else{res.setHeader('Content-Type',url.endsWith('.wasm')?'application/wasm':url.endsWith('.js')?'application/javascript':'application/octet-stream');res.end('fixture');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const args=['scripts/smoke-server.mjs',`http://127.0.0.1:${server.address().port}`];
  await assert.rejects(promisify(execFile)(process.execPath,args),error=>/pdf.worker.mjs.*wrong Content-Type/s.test(error.stderr));
  moduleType='application/javascript';
  const result=await promisify(execFile)(process.execPath,args);
  assert.match(result.stdout,/PASS \/assets\/pdf.worker.mjs/);
 }finally{server.closeAllConnections();server.close();}
});
