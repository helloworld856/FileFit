import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {downloadAsset} from './download-asset.mjs';

test('falls back after primary failure and replaces a corrupt cached file only with verified bytes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'filefit-asset-'));
 const good=Buffer.from('verified fixture');
 const hash=createHash('sha256').update(good).digest('hex');
 const requests=[];
 const server=createServer((req,res)=>{
  requests.push(req.url);
  if(req.url==='/primary'){res.writeHead(503);res.end('unavailable');return;}
  res.writeHead(200);res.end(good);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const destination=path.join(dir,'model.gz');
  await writeFile(destination,'bad cache');
  const base=`http://127.0.0.1:${server.address().port}`;
  const result=await downloadAsset({destination,urls:[base+'/primary',base+'/mirror'],expected:hash},{retries:1,timeoutMs:1000});
  assert.deepEqual(await readFile(destination),good);
  assert.equal(result.sha256,hash);
  assert.deepEqual(requests,['/primary','/mirror']);
 }finally{server.close();await rm(dir,{recursive:true,force:true});}
});

test('a checksum mismatch never becomes a cached asset',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'filefit-asset-'));
 const server=createServer((_req,res)=>res.end('tampered'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const destination=path.join(dir,'model.gz');
  const expected=createHash('sha256').update('expected').digest('hex');
  await assert.rejects(downloadAsset({destination,urls:[`http://127.0.0.1:${server.address().port}/model`],expected},{retries:1,timeoutMs:1000}),/checksum/i);
  await assert.rejects(readFile(destination),{code:'ENOENT'});
 }finally{server.close();await rm(dir,{recursive:true,force:true});}
});
