import {PDFDocument, PDFName, StandardFonts, degrees, rgb} from 'pdf-lib';
import type {FileInfo, FitOptions, ProcessResult, Progress} from '../core/types';
import {pageSelection} from './pdf-pages';
import {runPyMuPDF} from './pymupdf';
import {checkImageInput,MAX_BATCH_PIXELS} from './image-helpers';
import {assertInputSize} from '../core/input-limits';
import {decodeImage} from './image';

const abort = (signal?:AbortSignal)=>{if(signal?.aborted) throw new DOMException('Cancelled','AbortError');};
const pdfBlob = (bytes:Uint8Array)=>new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
const stem = (name:string)=>name.replace(/\.[^.]+$/,'');
const nameFor = (file:File,o:FitOptions,suffix='')=>`${stem(o.filename||file.name)}${suffix}.pdf`;
const paperSize=(o:FitOptions):[number,number]|null=>o.paper==='a4'?[595.276,841.89]:o.paper==='letter'?[612,792]:o.paper==='custom'?[o.paperWidthMm*72/25.4,o.paperHeightMm*72/25.4]:null;

async function openJs(file:Blob,password='',signal?:AbortSignal) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  abort(signal);
  const task = pdfjs.getDocument({data:await file.arrayBuffer(),password,cMapUrl:'/engines/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/engines/pdfjs/standard_fonts/'});
  const cancel=()=>{void task.destroy();}; signal?.addEventListener('abort',cancel,{once:true});
  try { const doc=await task.promise; abort(signal); return {doc,close:async()=>{signal?.removeEventListener('abort',cancel);await task.destroy();}}; }
  catch(e) {signal?.removeEventListener('abort',cancel);abort(signal);throw e;}
}

export async function inspectPdf(file:File,password=''):Promise<FileInfo> {
   assertInputSize(file,'pdf');
  try { const doc=await PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});
    const p=doc.getPage(0);return {format:'pdf',pages:doc.getPageCount(),width:p.getWidth(),height:p.getHeight(),encrypted:false};
  } catch(e) { if(!String(e).includes('encrypted')) throw e; }
  if(!password) return {format:'pdf',encrypted:true};
  const {doc,close}=await openJs(file,password);try{const p=await doc.getPage(1);const v=p.getViewport({scale:1});return {format:'pdf',pages:doc.numPages,width:v.width,height:v.height,encrypted:true};}finally{await close();}
}

async function unlocked(file:Blob,o:FitOptions,signal:AbortSignal):Promise<Blob> {
  abort(signal);
  assertInputSize(file,'pdf');
  try{const doc=await PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});if(doc.getPageCount()>200)throw new Error('PDF limit: 200 pages.');return file;}
  catch(e){if(!String(e).includes('encrypted'))throw e;if(!o.password)throw new Error('This PDF requires its current password.');return await runPyMuPDF('decrypt',file,{password:o.password},signal);}
}

async function edited(file:Blob,o:FitOptions,signal:AbortSignal):Promise<Blob>{
  const source=await PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});abort(signal);
  let doc=source;
  if(o.pages.trim()) {doc=await PDFDocument.create();for(const index of pageSelection(o.pages,source.getPageCount())){abort(signal);if(index===null)doc.addPage([source.getPage(0).getWidth(),source.getPage(0).getHeight()]);else doc.addPage((await doc.copyPages(source,[index]))[0]);}}
  let font=await doc.embedFont(StandardFonts.Helvetica);
  if(o.watermark && /[^\x00-\xff]/.test(o.watermark)) {
    const fontkit=await import('@pdf-lib/fontkit');doc.registerFontkit(fontkit.default);
    const response=await fetch('/fonts/NotoSansCJKsc-Regular.otf',{signal});if(!response.ok)throw new Error('Chinese watermark font is unavailable.');font=await doc.embedFont(await response.arrayBuffer(),{subset:true});
  }
  for(const [i,p] of doc.getPages().entries()) {
    abort(signal);
    if(o.rotate)p.setRotation(degrees((p.getRotation().angle+o.rotate)%360));
    const paper=paperSize(o);
    if(paper){const [w,h]=paper;const scale=Math.min(w/p.getWidth(),h/p.getHeight());p.scaleContent(scale,scale);p.scaleAnnotations(scale,scale);p.setSize(w,h);}
    if(o.watermark){const size=Math.min(36,p.getWidth()/Math.max(4,o.watermark.length));p.drawText(o.watermark,{font,size,x:24,y:p.getHeight()/2,color:rgb(.5,.5,.5),opacity:.3,rotate:degrees(30)});}
    if(o.pageNumbers)p.drawText(`${i+1} / ${doc.getPageCount()}`,{font,size:10,x:p.getWidth()/2-15,y:16,color:rgb(.3,.3,.3)});
  }
  if(o.stripMetadata){doc.context.trailerInfo.Info=undefined;doc.catalog.delete(PDFName.of('Metadata'));}
  return pdfBlob(await doc.save({useObjectStreams:true}));
}

async function result(blob:Blob,name:string,warnings:string[]=[]):Promise<ProcessResult>{
  const info=await inspectPdf(new File([blob],name));return {blob,name,info,warnings};
}

async function canvasPage(doc:Awaited<ReturnType<typeof openJs>>['doc'],n:number,scale:number,signal:AbortSignal){
  abort(signal);const page=await doc.getPage(n);const viewport=page.getViewport({scale});
  if(viewport.width*viewport.height>40_000_000)throw new Error('Rendered page exceeds 40 million pixels. Reduce DPI.');
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const task=page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport});const cancel=()=>task.cancel();signal.addEventListener('abort',cancel,{once:true});
  try{await task.promise;abort(signal);return canvas;}finally{signal.removeEventListener('abort',cancel);page.cleanup();}
}
const canvasBlob=(canvas:HTMLCanvasElement,type='image/jpeg',quality=.85)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Page encoding failed.')),type,quality));

async function raster(file:Blob,o:FitOptions,quality:number,progress:Progress,signal:AbortSignal){
  const {doc,close}=await openJs(file,'',signal);const output=await PDFDocument.create();
  try{for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);const v=p.getViewport({scale:1});const canvas=await canvasPage(doc,i,(o.dpi||144)/72,signal);const image=await output.embedJpg(await (await canvasBlob(canvas,'image/jpeg',quality)).arrayBuffer());output.addPage([v.width,v.height]).drawImage(image,{x:0,y:0,width:v.width,height:v.height});canvas.width=canvas.height=0;progress(i/doc.numPages*.85,`Page ${i}/${doc.numPages}`);}return pdfBlob(await output.save());}finally{await close();}
}

export async function processPdf(file:File,o:FitOptions,progress:Progress,signal:AbortSignal):Promise<ProcessResult>{
  const input=await unlocked(file,o,signal);const info=await inspectPdf(new File([input],file.name));if((info.pages||0)>200)throw new Error('PDF limit: 200 pages.');
  const changes=o.pages||o.rotate||o.watermark||o.pageNumbers||o.paper!=='original'||o.stripMetadata;
  if(!changes&&!o.grayscale&&o.pdfMode==='preserve'&&(!o.maxBytes||input.size<=o.maxBytes)&&!o.outputPassword)return result(input,nameFor(file,o));
  let best=changes?await edited(input,o,signal):input;const warnings:string[]=[];
  if(new TextDecoder('latin1').decode(await input.arrayBuffer()).includes('/ByteRange'))warnings.push('Editing this signed PDF invalidates its digital signatures.');
  if(o.pdfMode==='raster') {best=await raster(best,o,Math.max(o.minQuality,.85),progress,signal);warnings.push('Rasterized PDF: original text, links and forms were replaced by page images.');if(o.maxBytes&&best.size>o.maxBytes&&o.minQuality<.85)best=await raster(changes?await edited(input,o,signal):input,o,o.minQuality,progress,signal);}
  else if(o.grayscale||(o.maxBytes&&best.size>o.maxBytes)){
    const base=best;const qualities=[.9,.75,.6,o.minQuality].filter((v,i,a)=>v>=o.minQuality&&a.indexOf(v)===i);
    for(let i=0;i<qualities.length;i++){abort(signal);progress(.1+i/qualities.length*.75,'Optimizing PDF content');const candidate=await runPyMuPDF('compress',base,{quality:Math.round(qualities[i]*100),dpi:o.dpi||(o.allowResize?Math.max(72,144-i*24):100000),stripMetadata:o.stripMetadata,grayscale:o.grayscale},signal);if(candidate.size<best.size||(o.grayscale&&i===0))best=candidate;if(!o.maxBytes||best.size<=o.maxBytes)break;}
  }
  if(o.maxBytes&&best.size>o.maxBytes)warnings.push('The size target cannot be reached within the selected quality constraints.');
  if(o.maxPages&&(await inspectPdf(new File([best],file.name))).pages!>o.maxPages)warnings.push('Page count exceeds the limit. Select pages explicitly; no pages were removed automatically.');
  let output=await result(best,nameFor(file,o),warnings);
  if(o.outputPassword){output.blob=await runPyMuPDF('encrypt',best,{password:o.outputPassword},signal);output.info.encrypted=true;}
  abort(signal);progress(1,'Done');return output;
}

export async function imageToPdf(files:File[],o:FitOptions,progress:Progress,signal:AbortSignal):Promise<ProcessResult>{
  if(!files.length||files.length>50)throw new Error('Choose 1 to 50 images.');
  let totalPixels=0;const checked:Awaited<ReturnType<typeof checkImageInput>>[]=[];
  for(const file of files){abort(signal);const info=await checkImageInput(file);totalPixels+=info.width*info.height;if(totalPixels>MAX_BATCH_PIXELS)throw new Error('图片转 PDF 总像素超过 4000 万像素安全上限');checked.push(info);}
  const doc=await PDFDocument.create();
  for(const [i,file] of files.entries()){
    abort(signal);const bitmap=await decodeImage(file,signal,checked[i]);const canvas=document.createElement('canvas');
    try{
      canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);
      const image=await doc.embedJpg(await(await canvasBlob(canvas,'image/jpeg',Math.max(.85,o.minQuality))).arrayBuffer());
      const factor=72/(o.dpi||96),w=canvas.width*factor,h=canvas.height*factor,size=paperSize(o)||[w,h],scale=Math.min(size[0]/w,size[1]/h);
      doc.addPage(size as [number,number]).drawImage(image,{x:(size[0]-w*scale)/2,y:(size[1]-h*scale)/2,width:w*scale,height:h*scale});
    }finally{bitmap.close();canvas.width=canvas.height=0;}
    progress((i+1)/files.length*.8,'Adding image');
  }
  const blob=pdfBlob(await doc.save());return processPdf(new File([blob],nameFor(files[0],o)),{...o,width:0,height:0,paper:'original'},progress,signal);
}

export async function pdfTool(files:File[],action:string,o:FitOptions,progress:Progress,signal:AbortSignal):Promise<ProcessResult[]>{
  if(!files.length)throw new Error('Choose at least one PDF.');abort(signal);
  if(action==='merge'){const merged=await PDFDocument.create();for(const [i,file]of files.entries()){const src=await PDFDocument.load(await(await unlocked(file,o,signal)).arrayBuffer());for(const p of await merged.copyPages(src,src.getPageIndices()))merged.addPage(p);progress((i+1)/files.length*.5,'Merging');}return [await processPdf(new File([pdfBlob(await merged.save())],'merged.pdf'),o,progress,signal)];}
  const outputs:ProcessResult[]=[];
  for(const file of files){const input=await unlocked(file,o,signal);
    if(action==='encrypt'||action==='decrypt'){if(action==='encrypt'&&!o.outputPassword)throw new Error('Enter an output password.');const out=await result(input,nameFor(file,o));if(action==='encrypt'){out.blob=await runPyMuPDF('encrypt',input,{password:o.outputPassword},signal);out.info.encrypted=true;}outputs.push(out);continue;}
    if(action==='split'){const src=await PDFDocument.load(await input.arrayBuffer());for(const index of pageSelection(o.pages,src.getPageCount())){if(index===null)continue;abort(signal);const d=await PDFDocument.create();d.addPage((await d.copyPages(src,[index]))[0]);outputs.push(await result(await edited(pdfBlob(await d.save()),{...o,pages:''},signal),nameFor(file,o,`-page-${index+1}`)));}continue;}
    if(action==='text'||action==='images'||action==='ocr'){
      const {doc,close}=await openJs(input,'',signal);let text='';
      try{if(action==='ocr'){outputs.push(...await ocrPdf(doc,file,o,progress,signal));continue;}
        for(const index of pageSelection(o.pages,doc.numPages)){if(index===null)continue;abort(signal);const page=await doc.getPage(index+1);
          if(action==='text'){const content=await page.getTextContent();text+=content.items.map(item=>'str'in item?item.str+('hasEOL'in item&&item.hasEOL?'\n':' '):'').join('')+'\n\n';}
          else {const canvas=await canvasPage(doc,index+1,(o.dpi||144)/72,signal);const blob=await canvasBlob(canvas,'image/png');outputs.push({blob,name:`${stem(o.filename||file.name)}-page-${index+1}.png`,info:{format:'png',width:canvas.width,height:canvas.height},warnings:[]});canvas.width=canvas.height=0;}progress((index+1)/doc.numPages,'Reading pages');}
        if(action==='text')outputs.push({blob:new Blob([text],{type:'text/plain;charset=utf-8'}),name:`${stem(file.name)}.txt`,info:{format:'txt'},warnings:[]});
      }finally{await close();}continue;
    }
    if(!['extract','organize','compress'].includes(action))throw new Error(`Unknown PDF action: ${action}`);
    outputs.push(await processPdf(new File([input],file.name),o,progress,signal));
  }abort(signal);progress(1,'Done');return outputs;
}

async function ocrPdf(doc:Awaited<ReturnType<typeof openJs>>['doc'],file:File,o:FitOptions,progress:Progress,signal:AbortSignal):Promise<ProcessResult[]>{
  const indices=pageSelection(o.pages,doc.numPages).filter((n):n is number=>n!==null);if(indices.length>30)throw new Error('OCR limit: 30 pages.');
  const {createWorker}=await import('tesseract.js');const worker=await createWorker(o.ocrLanguage||'chi_sim+eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')progress(m.progress*.9,'Recognizing text');}});
  const stop=()=>{void worker.terminate();};signal.addEventListener('abort',stop,{once:true});const output=await PDFDocument.create();let text='';
  try{abort(signal);for(const index of indices){const canvas=await canvasPage(doc,index+1,2,signal);const {data}=await worker.recognize(canvas,{}, {pdf:true,text:true});abort(signal);if(!data.pdf)throw new Error('OCR engine did not return a searchable PDF.');const searchable=await PDFDocument.load(new Uint8Array(data.pdf));const pages=await output.copyPages(searchable,searchable.getPageIndices());const original=await doc.getPage(index+1);const viewport=original.getViewport({scale:1});for(const page of pages){const sx=viewport.width/page.getWidth(),sy=viewport.height/page.getHeight();page.scale(sx,sy);output.addPage(page);}text+=data.text+'\n\n';canvas.width=canvas.height=0;}
    return [await result(pdfBlob(await output.save()),nameFor(file,o,'-ocr'),['OCR can misread characters. Review the recognized text.']),{blob:new Blob([text],{type:'text/plain;charset=utf-8'}),name:`${stem(file.name)}-ocr.txt`,info:{format:'txt'},warnings:['Review OCR recognition errors.']}];
  }finally{signal.removeEventListener('abort',stop);await worker.terminate();}
}
