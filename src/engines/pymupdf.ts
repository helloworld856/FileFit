/** Cancellable same-origin bridge. Each job owns its worker and Python runtime. */
export function runPyMuPDF(action:'compress'|'encrypt'|'decrypt',file:Blob,options:Record<string,unknown>,signal:AbortSignal):Promise<Blob>{
  if(signal.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./pymupdf.worker.ts',import.meta.url),{type:'module'});
    const finish=()=>{signal.removeEventListener('abort',cancel);worker.terminate();};
    const cancel=()=>{finish();reject(new DOMException('Cancelled','AbortError'));};
    signal.addEventListener('abort',cancel,{once:true});
    worker.onmessage=({data})=>{finish();if(data.error)reject(new Error(data.error));else resolve(data.blob);};
    worker.onerror=e=>{finish();reject(new Error(e.message||'PDF optimization engine failed to load.'));};
    worker.postMessage({action,file,options});
  });
}
