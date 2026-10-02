import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function downloadAsset({destination,urls,expected},{retries=2,timeoutMs=30_000}={}){
 if(!expected||!urls?.length)throw new Error('Asset checksum and source URLs are required.');
 await mkdir(path.dirname(destination),{recursive:true});
 try{
  const cached=await readFile(destination);
  if(digest(cached)===expected)return {bytes:cached.length,sha256:expected,source:'cache'};
  await rm(destination);
 }catch(error){if(error.code!=='ENOENT')throw error;}
 let lastError;
 for(const url of urls){
  for(let attempt=0;attempt<retries;attempt++){
   try{
    const response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(digest(bytes)!==expected)throw new Error('Checksum mismatch');
    const temporary=`${destination}.${process.pid}.${randomUUID()}.tmp`;
    try{await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,destination);}
    finally{await rm(temporary,{force:true});}
    return {bytes:bytes.length,sha256:expected,source:url};
   }catch(error){lastError=error;if(attempt+1<retries)await delay(300*(attempt+1));}
  }
 }
 throw new Error(`Unable to download verified asset ${path.basename(destination)}: ${lastError?.message||'unknown error'}`);
}
