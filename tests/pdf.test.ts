import {describe,it,expect} from 'vitest';
import {PDFDocument,StandardFonts,PDFName} from 'pdf-lib';
import {DEFAULT_OPTIONS} from '../src/core/types';
import {inspectPdf,processPdf,pdfTool} from '../src/engines/pdf';
import {pageSelection} from '../src/engines/pdf-pages';

async function fixture(){const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([300,500]).drawText('Text survives',{font});pdf.addPage([500,300]).drawText('Second page',{font});pdf.setTitle('Private metadata');return new File([new Uint8Array(await pdf.save())],'sample.pdf',{type:'application/pdf'});}
const signal=()=>new AbortController().signal;
const progress=()=>{};
describe('PDF page selection',()=>{
 it('supports descending order, duplicates, exclusions and inserted blank pages',()=>{expect(pageSelection('2,1,2,blank',2)).toEqual([1,0,1,null]);expect(pageSelection('-2',3)).toEqual([0,2]);expect(pageSelection('3-1',3)).toEqual([2,1,0]);});
 it('rejects silent page truncation and malformed ranges',()=>{expect(()=>pageSelection('4',3)).toThrow();expect(()=>pageSelection('1x',3)).toThrow();expect(()=>pageSelection('-1-3',3)).toThrow();});
});
describe('PDF operations on generated real PDFs',()=>{
 it('inspects page dimensions and preserves original compliant bytes',async()=>{const file=await fixture();expect(await inspectPdf(file)).toMatchObject({format:'pdf',pages:2,width:300,height:500});const out=await processPdf(file,{...DEFAULT_OPTIONS,stripMetadata:false},progress,signal());expect(new Uint8Array(await out.blob.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()));});
 it('reorders mixed page dimensions and strips metadata without rasterization',async()=>{const out=await processPdf(await fixture(),{...DEFAULT_OPTIONS,pages:'2,blank,1',maxPages:1,stripMetadata:true},progress,signal());const doc=await PDFDocument.load(await out.blob.arrayBuffer(),{updateMetadata:false});expect(doc.getPageCount()).toBe(3);expect(doc.getPage(0).getWidth()).toBe(500);expect(doc.getPage(2).getWidth()).toBe(300);expect(doc.context.trailerInfo.Info).toBeUndefined();expect(doc.getPage(0).node.get(PDFName.of('Contents'))).toBeDefined();expect(out.warnings.join()).toContain('Page count exceeds');});
 it('splits, merges, rotates and retains every requested page',async()=>{const file=await fixture();const split=await pdfTool([file],'split',{...DEFAULT_OPTIONS,pages:'2,1'},progress,signal());expect(split.length).toBe(2);expect(split[0].info.width).toBe(500);const merged=await pdfTool(split.map(r=>new File([r.blob],r.name)),'merge',{...DEFAULT_OPTIONS,rotate:90},progress,signal());const doc=await PDFDocument.load(await merged[0].blob.arrayBuffer());expect(doc.getPageCount()).toBe(2);expect(doc.getPage(0).getRotation().angle).toBe(90);});
 it('aborts before processing',async()=>{const controller=new AbortController();controller.abort();await expect(processPdf(await fixture(),DEFAULT_OPTIONS,progress,controller.signal)).rejects.toMatchObject({name:'AbortError'});});
 it('applies custom paper dimensions in millimetres',async()=>{const out=await processPdf(await fixture(),{...DEFAULT_OPTIONS,paper:'custom',paperWidthMm:100,paperHeightMm:150,maxBytes:5000000},progress,signal());const doc=await PDFDocument.load(await out.blob.arrayBuffer());expect(doc.getPage(0).getWidth()).toBeCloseTo(100*72/25.4,2);expect(doc.getPage(0).getHeight()).toBeCloseTo(150*72/25.4,2);});
});
