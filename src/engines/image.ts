import type { FileInfo,FitOptions,Progress,ProcessResult } from '../core/types';
import {imageGeometry,isAnimated,readDpi,sniffImage,writeDpi} from './image-helpers';

function cancelled(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('任务已取消','AbortError');}
function canvas(w:number,h:number){imageGeometry(w,h,0,0,'contain');const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
async function decode(file:Blob,signal?:AbortSignal):Promise<ImageBitmap>{
 cancelled(signal);if(!file.size||file.size>100_000_000)throw new Error('图片为空或超过 100 MB');
 const bytes=new Uint8Array(await file.arrayBuffer()),format=sniffImage(bytes);
 if(format==='unknown')throw new Error('无法识别图片；支持 JPEG、PNG、WebP、AVIF 和 HEIC');
 if(isAnimated(bytes))throw new Error('检测到动画图片：当前处理会丢失动画，因此未进行转换');
 let input=file;
 if(format==='heic'){const {default:heic2any}=await import('heic2any');const converted=await heic2any({blob:file,toType:'image/png'});if(Array.isArray(converted)&&converted.length!==1)throw new Error('HEIC 包含多张图片，不能静默丢弃页面');input=Array.isArray(converted)?converted[0]:converted;}
 cancelled(signal);
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(input,{imageOrientation:'from-image'});}catch{throw new Error('浏览器无法解码此图片，文件可能损坏或编码不受支持');}
 try{cancelled(signal);imageGeometry(bitmap.width,bitmap.height,0,0,'contain');}catch(e){bitmap.close();throw e;}return bitmap;
}
export async function inspectImage(file:File):Promise<FileInfo>{if(!file.size||file.size>100_000_000)throw new Error('图片为空或超过 100 MB');const bytes=new Uint8Array(await file.arrayBuffer());const bitmap=await decode(file);const info={format:sniffImage(bytes),width:bitmap.width,height:bitmap.height,dpi:readDpi(bytes)};bitmap.close();return info;}

async function encode(c:HTMLCanvasElement,format:string,quality:number,dpi:number,signal?:AbortSignal):Promise<Blob>{
 let blob:Blob;
 if(format==='avif'){
  const data=c.getContext('2d')!.getImageData(0,0,c.width,c.height);
  const encoded=await new Promise<ArrayBuffer>((resolve,reject)=>{
   cancelled(signal);const worker=new Worker(new URL('./image-avif.worker.ts',import.meta.url),{type:'module'});
   const clean=()=>{worker.terminate();signal?.removeEventListener('abort',abort);};
   const abort=()=>{clean();reject(new DOMException('任务已取消','AbortError'));};
   signal?.addEventListener('abort',abort,{once:true});
   worker.onmessage=event=>{clean();event.data.error?reject(new Error(event.data.error)):resolve(event.data.result);};
   worker.onerror=event=>{clean();reject(new Error(event.message||'AVIF 编码失败'));};
   worker.postMessage({data,quality:Math.round(quality*100)},[data.data.buffer]);
  });blob=new Blob([encoded],{type:'image/avif'});
 }else{
  blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('图片编码失败')),'image/'+format,quality));
  if(blob.type!=='image/'+format)throw new Error('此浏览器不支持输出 '+format.toUpperCase());
 }
 if(dpi){const data=writeDpi(new Uint8Array(await blob.arrayBuffer()),format,dpi);blob=new Blob([data as Uint8Array<ArrayBuffer>],{type:blob.type});}
 return blob;
}
function outputName(name:string,options:FitOptions,format:string){const base=(options.filename||name.replace(/\.[^.]+$/,'')).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/\.(jpe?g|png|webp|avif)$/i,'');return (base||'filefit')+'.'+(format==='jpeg'?'jpg':format);}
async function finish(source:HTMLCanvasElement,name:string,format:string,options:FitOptions,progress:Progress,signal:AbortSignal,warnings:string[]):Promise<ProcessResult>{
 if(!['jpeg','png','webp','avif'].includes(format))throw new Error('请选择图片输出格式');
 if(options.dpi&&!['jpeg','png'].includes(format))throw new Error('DPI 写入仅支持 JPEG 和 PNG');
 const floor=Math.max(0.01,Math.min(1,options.minQuality));let best:Blob|undefined,bestW=source.width,bestH=source.height,work=source;
 const qualities=format==='png'?[1]:Array.from({length:9},(_,i)=>1-(1-floor)*i/8);
 try{
  for(let scale=0;scale<9;scale++){
   for(let i=0;i<qualities.length;i++){
    cancelled(signal);progress(Math.min(94,15+scale*8+i),'正在按实际体积搜索图片质量');
    const candidate=await encode(work,format,qualities[i],options.dpi,signal);cancelled(signal);
    if(!best||candidate.size<best.size){best=candidate;bestW=work.width;bestH=work.height;}
    if(!options.maxBytes||candidate.size<=options.maxBytes){best=candidate;bestW=work.width;bestH=work.height;break;}
   }
   if(best&&(!options.maxBytes||best.size<=options.maxBytes))break;
   if(!options.allowResize||options.width>0||options.height>0||work.width<32||work.height<32)break;
   const smaller=canvas(Math.max(1,Math.floor(work.width*.8)),Math.max(1,Math.floor(work.height*.8)));smaller.getContext('2d')!.drawImage(source,0,0,smaller.width,smaller.height);if(work!==source){work.width=1;work.height=1;}work=smaller;
  }
  if(!best)throw new Error('没有生成图片');
  if(options.maxBytes&&best.size>options.maxBytes)warnings.push('在指定像素尺寸和质量下限内无法达到目标体积；保留最小候选供检查。');
  if(bestW!==source.width||bestH!==source.height)warnings.push('已按允许缩小设置降低像素尺寸。');
  const info:FileInfo={format,width:bestW,height:bestH,dpi:readDpi(new Uint8Array(await best.arrayBuffer()))};
  progress(100,'图片处理完成');return {blob:best,name:outputName(name,options,format),info,warnings};
 }finally{if(work!==source){work.width=1;work.height=1;}}
}
export async function processImage(file:File,options:FitOptions,progress:Progress,signal:AbortSignal):Promise<ProcessResult>{
 cancelled(signal);if(!file.size||file.size>100_000_000)throw new Error('图片为空或超过 100 MB');
 if(![options.minQuality,options.rotate,options.width,options.height,options.maxBytes,options.dpi].every(Number.isFinite)||options.minQuality<0||options.minQuality>1||options.maxBytes<0)throw new Error('图片处理参数无效');
 progress(2,'正在读取图片');const bytes=new Uint8Array(await file.arrayBuffer());const inputFormat=sniffImage(bytes);
 const format=options.format==='original'?(inputFormat==='heic'?'jpeg':inputFormat):options.format;
 const bitmap=await decode(file,signal);const warnings:string[]=[];
 let rotated:HTMLCanvasElement|undefined,out:HTMLCanvasElement|undefined;
 try{
  if(!options.stripMetadata)warnings.push('重新编码可能移除原始 EXIF/GPS 等元数据；如需完整保留，请使用符合要求的原文件。');
  const angle=((options.rotate%360)+360)%360,rad=angle*Math.PI/180;
  const rw=Math.max(1,Math.round(Math.abs(bitmap.width*Math.cos(rad))+Math.abs(bitmap.height*Math.sin(rad)))),rh=Math.max(1,Math.round(Math.abs(bitmap.width*Math.sin(rad))+Math.abs(bitmap.height*Math.cos(rad))));
  if(!options.stripMetadata&&!options.width&&!options.height&&!angle&&!options.flipX&&!options.flipY&&!options.grayscale&&!options.dpi&&format===inputFormat&&(!options.maxBytes||file.size<=options.maxBytes))return {blob:file,name:outputName(file.name,options,format),info:{format,width:bitmap.width,height:bitmap.height,dpi:readDpi(bytes)},warnings:[]};
  rotated=canvas(rw,rh);const rc=rotated.getContext('2d')!;rc.translate(rw/2,rh/2);rc.rotate(rad);rc.scale(options.flipX?-1:1,options.flipY?-1:1);rc.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);
  const g=imageGeometry(rw,rh,options.width,options.height,options.fit);out=canvas(g.width,g.height);const ctx=out.getContext('2d')!;
  if(format==='jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,g.width,g.height);}ctx.drawImage(rotated,g.x,g.y,g.drawWidth,g.drawHeight);
  if(options.grayscale){const pixels=ctx.getImageData(0,0,out.width,out.height);for(let i=0;i<pixels.data.length;i+=4){const gray=Math.round(.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2]);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;}ctx.putImageData(pixels,0,0);}
  return await finish(out,file.name,format,options,progress,signal,warnings);
 }finally{bitmap.close();if(rotated){rotated.width=1;rotated.height=1;}if(out){out.width=1;out.height=1;}}
}
export async function stitchImages(files:File[],options:FitOptions,progress:Progress,signal:AbortSignal):Promise<ProcessResult>{
 if(!files.length||files.length>50)throw new Error('请选择 1 至 50 张图片');
 const bitmaps:ImageBitmap[]=[];let out:HTMLCanvasElement|undefined;
 try{
  for(let i=0;i<files.length;i++){cancelled(signal);progress(i/files.length*12,'读取拼接图片');bitmaps.push(await decode(files[i],signal));}
  const width=options.width||Math.max(...bitmaps.map(b=>b.width));const heights=bitmaps.map(b=>Math.max(1,Math.round(b.height*width/b.width))),height=heights.reduce((a,b)=>a+b,0);
  out=canvas(width,height);const ctx=out.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,width,height);let y=0;bitmaps.forEach((b,i)=>{ctx.drawImage(b,0,y,width,heights[i]);y+=heights[i];});
  const blob=await encode(out,'png',1,0,signal);return await processImage(new File([blob],'stitched.png',{type:'image/png'}),options,progress,signal);
 }finally{bitmaps.forEach(b=>b.close());if(out){out.width=1;out.height=1;}}
}
