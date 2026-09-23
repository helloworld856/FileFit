/// <reference lib="webworker" />
import encode,{init} from '@jsquash/avif/encode';
import wasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
import mtWasmUrl from '@jsquash/avif/codec/enc/avif_enc_mt.wasm?url';
const codec=init({locateFile:(name:string)=>name.includes('_mt')?mtWasmUrl:wasmUrl});
self.onmessage=async(event:MessageEvent<{data:ImageData;quality:number}>)=>{
 try{await codec;const result=await encode(event.data.data,{quality:event.data.quality,speed:8});self.postMessage({result},[result]);}
 catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
