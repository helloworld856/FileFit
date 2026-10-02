import {assertInputSize,MAX_IMAGE_PIXELS} from '../core/input-limits';
export {MAX_IMAGE_PIXELS,MAX_BATCH_PIXELS} from '../core/input-limits';
export function imageGeometry(sw:number,sh:number,w:number,h:number,fit:'contain'|'cover'|'stretch') {
 if (![sw,sh,w,h].every(Number.isFinite)||sw<=0||sh<=0||w<0||h<0) throw new Error('图片尺寸无效');
 const width=Math.max(1,Math.round(w|| (h?sw*h/sh:sw))),height=Math.max(1,Math.round(h||(w?sh*w/sw:sh)));
  if(width*height>MAX_IMAGE_PIXELS||width>32767||height>32767) throw new Error('图片超过 1600 万像素或浏览器尺寸限制');
 const scale=fit==='cover'?Math.max(width/sw,height/sh):Math.min(width/sw,height/sh);
 const drawWidth=fit==='stretch'?width:sw*scale,drawHeight=fit==='stretch'?height:sh*scale;
 return {width,height,x:(width-drawWidth)/2,y:(height-drawHeight)/2,drawWidth,drawHeight};
}
const ascii=(b:Uint8Array,start:number,len:number)=>String.fromCharCode(...b.subarray(start,start+len));
export function sniffImage(b:Uint8Array):string {
 if(b[0]===255&&b[1]===216) return 'jpeg';
 if(b[0]===137&&ascii(b,1,3)==='PNG') return 'png';
 if(ascii(b,0,3)==='GIF')return 'gif';
 if(ascii(b,0,4)==='RIFF'&&ascii(b,8,4)==='WEBP')return 'webp';
 if(ascii(b,4,4)==='ftyp'){const brands=ascii(b,8,40);if(/avif|avis/.test(brands))return 'avif';if(/heic|heix|hevc|hevx|mif1|msf1/.test(brands))return 'heic';}
 return 'unknown';
}
export function readImageDimensions(b:Uint8Array):{width:number;height:number}|undefined {
 const f=sniffImage(b),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const valid=(width:number,height:number)=>width>0&&height>0?{width,height}:undefined;
 if(f==='png'&&b.length>=24&&ascii(b,12,4)==='IHDR')return valid(v.getUint32(16),v.getUint32(20));
 if(f==='jpeg'){
  for(let p=2;p+4<=b.length;){
   if(b[p]!==255)return undefined;
   while(b[p]===255)p++;
   const marker=b[p++];if(marker===216||marker===1)continue;
   if(marker===217||marker===218||p+2>b.length)return undefined;
   const size=v.getUint16(p);if(size<2||p+size>b.length)return undefined;
   if((marker>=192&&marker<=195)||(marker>=197&&marker<=199)||(marker>=201&&marker<=203)||(marker>=205&&marker<=207)){
    return size>=7?valid(v.getUint16(p+5),v.getUint16(p+3)):undefined;
   }
   p+=size;
  }
 }
 if(f==='webp'&&b.length>=30){
  const kind=ascii(b,12,4);
  if(kind==='VP8X')return valid(1+b[24]+(b[25]<<8)+(b[26]<<16),1+b[27]+(b[28]<<8)+(b[29]<<16));
  if(kind==='VP8 '&&b.length>=30&&b[23]===157&&b[24]===1&&b[25]===42)return valid(v.getUint16(26,true)&16383,v.getUint16(28,true)&16383);
  if(kind==='VP8L'&&b[20]===47)return valid(1+(((b[22]&63)<<8)|b[21]),1+(((b[24]&15)<<10)|(b[23]<<2)|(b[22]>>6)));
 }
 if((f==='avif'||f==='heic')&&b.length>=16){
  const boxes=(start:number,end:number,depth:number):{width:number;height:number}|undefined=>{
   if(depth>8)return undefined;
   let largest:{width:number;height:number}|undefined;
   const include=(dimensions:{width:number;height:number}|undefined)=>{if(dimensions)largest={width:Math.max(largest?.width||0,dimensions.width),height:Math.max(largest?.height||0,dimensions.height)};};
   for(let p=start;p+8<=end;){
    let size=v.getUint32(p),header=8;if(size===1){if(p+16>end)return undefined;const high=v.getUint32(p+8),low=v.getUint32(p+12);if(high)return undefined;size=low;header=16;}
    if(size===0)size=end-p;
    const kind=ascii(b,p+4,4);
    if(size<header)return undefined;
    if(p+size>end){if(kind==='mdat'&&depth===0)break;return undefined;}
    if(kind==='ispe'&&size>=header+12)include(valid(v.getUint32(p+header+4),v.getUint32(p+header+8)));
    if(['meta','iprp','ipco'].includes(kind)){
     include(boxes(p+header+(kind==='meta'?4:0),p+size,depth+1));
    }
    p+=size;
   }
   return largest;
  };
  return boxes(0,b.length,0);
 }
 return undefined;
}
export function heicDisplayImages(b:Uint8Array):number|undefined {
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const children=(start:number,end:number,root=false)=>{
  const result:{kind:string;start:number;end:number}[]=[];
  for(let p=start;p<end;){
   if(p+8>end)throw new Error('Truncated HEIC box');
   let size=v.getUint32(p),header=8;const kind=ascii(b,p+4,4);
   if(size===1){if(p+16>end||v.getUint32(p+8)!==0)throw new Error('Invalid HEIC box');size=v.getUint32(p+12);header=16;}
   if(size===0)size=end-p;
   if(size<header)throw new Error('Invalid HEIC box');
   if(p+size>end){if(root&&kind==='mdat')break;throw new Error('Truncated HEIC metadata');}
   result.push({kind,start:p+header,end:p+size});p+=size;
  }
  return result;
 };
 try{
  const items=new Map<number,{hidden:boolean;type:string}>(),excluded=new Set<number>();
  for(const meta of children(0,b.length,true).filter(box=>box.kind==='meta')){
   if(meta.start+4>meta.end)return undefined;
   for(const box of children(meta.start+4,meta.end)){
    if(box.kind==='iinf'){
     if(box.start+6>box.end)return undefined;
     const version=b[box.start],countBytes=version===0?2:version===1?4:0;if(!countBytes||box.start+4+countBytes>box.end)return undefined;
     const entries=children(box.start+4+countBytes,box.end);
     const count=countBytes===2?v.getUint16(box.start+4):v.getUint32(box.start+4);
     if(entries.length!==count)return undefined;
     for(const entry of entries){
      if(entry.kind!=='infe'||entry.start+4>entry.end)return undefined;
      const version=b[entry.start],idBytes=version===2?2:version===3?4:0;
      if(!idBytes||entry.start+4+idBytes+6>entry.end)return undefined;
      const id=idBytes===2?v.getUint16(entry.start+4):v.getUint32(entry.start+4);
      if(items.has(id))return undefined;
      items.set(id,{hidden:!!(b[entry.start+3]&1),type:ascii(b,entry.start+4+idBytes+2,4)});
     }
    }else if(box.kind==='iref'){
     if(box.start+4>box.end||b[box.start]>1)return undefined;
     const idBytes=b[box.start]===0?2:4;
     for(const ref of children(box.start+4,box.end)){
      if(ref.start+idBytes+2>ref.end)return undefined;
      const idAt=(offset:number)=>idBytes===2?v.getUint16(offset):v.getUint32(offset);
      const from=idAt(ref.start),count=v.getUint16(ref.start+idBytes);
      if(ref.start+idBytes+2+count*idBytes!==ref.end)return undefined;
      if(ref.kind==='thmb'||ref.kind==='auxl')excluded.add(from);
      if(ref.kind==='dimg')for(let i=0;i<count;i++)excluded.add(idAt(ref.start+idBytes+2+i*idBytes));
     }
    }
   }
  }
  if(!items.size)return undefined;
  return [...items].filter(([id,item])=>!item.hidden&&!excluded.has(id)&&['hvc1','grid','iden','jpeg','av01'].includes(item.type)).length;
 }catch{return undefined;}
}
export async function checkImageInput(file:Blob):Promise<{format:string;width:number;height:number}>{
 assertInputSize(file,'image');
 const header=new Uint8Array(await file.slice(0,1_048_576).arrayBuffer());
 const format=sniffImage(header),dimensions=readImageDimensions(header);
 if(format==='unknown')throw new Error('无法识别图片；支持 JPEG、PNG、WebP、AVIF 和 HEIC');
 if(!dimensions)throw new Error('无法在图片头部读取尺寸，文件可能损坏或元数据过大');
 if(format==='heic'){
  const images=heicDisplayImages(header);
  if(images===undefined||images===0)throw new Error('无法安全读取 HEIC 图片数量，文件可能损坏或元数据过大');
  if(images!==1)throw new Error('HEIC 包含多张图片，不能静默丢弃页面；请先导出单张图片');
 }
 if(dimensions.width>32767||dimensions.height>32767||dimensions.width*dimensions.height>MAX_IMAGE_PIXELS)throw new Error(`图片尺寸 ${dimensions.width} × ${dimensions.height} 超过 1600 万像素安全上限`);
 return {format,...dimensions};
}
export function isAnimated(b:Uint8Array):boolean {
 const f=sniffImage(b);if(f==='gif')return true;
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(f==='png'){for(let p=8;p+12<=b.length;){const n=v.getUint32(p);if(ascii(b,p+4,4)==='acTL')return true;p+=12+n;}}
 if(f==='webp'){for(let p=12;p+8<=b.length;){const n=v.getUint32(p+4,true);if(ascii(b,p,4)==='ANIM')return true;p+=8+n+(n%2);}}
 return f==='avif'&&ascii(b,8,40).includes('avis');
}
export function readDpi(b:Uint8Array):number|undefined {
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),f=sniffImage(b);
 if(f==='jpeg')for(let p=2;p+4<=b.length;){if(b[p]!==255||b[p+1]===218||b[p+1]===217)break;const n=v.getUint16(p+2);if(n<2||p+2+n>b.length)break;if(b[p+1]===224&&n>=16&&ascii(b,p+4,5)==='JFIF\0'){const unit=b[p+11],d=v.getUint16(p+12);return unit===1?d:unit===2?d*2.54:undefined;}p+=n+2;}
 if(f==='png')for(let p=8;p+12<=b.length;){const n=v.getUint32(p);if(n>b.length-p-12)break;if(ascii(b,p+4,4)==='pHYs'&&n===9&&b[p+16]===1)return v.getUint32(p+8)*0.0254;p+=n+12;}
 return undefined;
}
function crc32(b:Uint8Array){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
export function writeDpi(b:Uint8Array,format:string,dpi:number):Uint8Array {
 if(!Number.isFinite(dpi)||dpi<1||dpi>65535)throw new Error('DPI 必须介于 1 和 65535');
 if(format==='jpeg'){
  const header=new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,0,0,0,0,0,0]);const v=new DataView(header.buffer);v.setUint16(12,Math.round(dpi));v.setUint16(14,Math.round(dpi));
  const out=new Uint8Array(b.length+header.length);out.set(b.subarray(0,2));out.set(header,2);out.set(b.subarray(2),20);return out;
 }
 if(format==='png'){
  const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);v.setUint32(0,9);chunk.set([112,72,89,115],4);v.setUint32(8,Math.round(dpi/0.0254));v.setUint32(12,Math.round(dpi/0.0254));chunk[16]=1;v.setUint32(17,crc32(chunk.subarray(4,17)));
  const pieces:Uint8Array[]=[b.subarray(0,8)];const source=new DataView(b.buffer,b.byteOffset,b.byteLength);let inserted=false;
  for(let p=8;p+12<=b.length;){const n=source.getUint32(p);if(n>b.length-p-12)throw new Error('PNG 数据不完整');const tag=ascii(b,p+4,4);if(tag!=='pHYs')pieces.push(b.subarray(p,p+n+12));if(tag==='IHDR'){pieces.push(chunk);inserted=true;}p+=n+12;}
  if(!inserted)throw new Error('PNG 缺少尺寸数据');const out=new Uint8Array(pieces.reduce((n,x)=>n+x.length,0));let p=0;for(const piece of pieces){out.set(piece,p);p+=piece.length;}return out;
 }
 throw new Error('此格式不支持写入 DPI；请选择 JPEG 或 PNG');
}
