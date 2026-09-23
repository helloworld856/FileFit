/**
 * Loader/options adapted from BentoPDF (AGPL-3.0-only),
 * https://github.com/alam00000/bentopdf/blob/main/src/js/utils/pymupdf-loader.ts
 * https://github.com/alam00000/bentopdf/blob/main/src/js/utils/compress.ts
 * FileFit changes: same-origin assets, isolated cancellable workers, explicit quality floor.
 */
/// <reference lib="webworker" />
declare const self:DedicatedWorkerGlobalScope;
export {};
self.onmessage=async({data})=>{
  let doc:any;
  try{
    const url=new URL('/engines/pymupdf/dist/index.js',self.location.origin).href;
    const {PyMuPDF}=await import(/* @vite-ignore */ url);
    const engine=new PyMuPDF({assetPath:new URL('/engines/pymupdf/assets/',self.location.origin).href,ghostscriptUrl:new URL('/engines/ghostscript/',self.location.origin).href});
    await engine.load();let blob:Blob;
    const {file,options:o,action}=data;
    if(action==='compress'){
      const output=await engine.compressPdf(file,{images:{enabled:true,quality:o.quality,dpiTarget:o.dpi,dpiThreshold:o.dpi+10,convertToGray:o.grayscale},scrub:{metadata:o.stripMetadata,xmlMetadata:o.stripMetadata,thumbnails:true},subsetFonts:true,save:{garbage:4,deflate:true,clean:true,useObjstms:true}});blob=output.blob;
    }else{
      doc=await engine.open(file);
      // Upstream interpolates password strings into Python: escape every code point.
      const pythonSafe=(password:string)=>Array.from(password,c=>'\\U'+c.codePointAt(0)!.toString(16).padStart(8,'0')).join('');
      if(doc.needsPass&&!doc.authenticate(pythonSafe(o.password||'')))throw new Error('Incorrect PDF password.');
      const options=action==='encrypt'?{garbage:4,deflate:true,encryption:{ownerPassword:pythonSafe(crypto.randomUUID()),userPassword:pythonSafe(o.password)}}:{garbage:4,deflate:true};
      blob=new Blob([new Uint8Array(doc.save(options))],{type:'application/pdf'});
    }
    self.postMessage({blob});
  }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
  finally{doc?.close();}
};
