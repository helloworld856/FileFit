export function imageGeometry(sw:number,sh:number,w:number,h:number,fit:'contain'|'cover'|'stretch') {
 if (![sw,sh,w,h].every(Number.isFinite)||sw<=0||sh<=0||w<0||h<0) throw new Error('图片尺寸无效');
 const width=Math.max(1,Math.round(w|| (h?sw*h/sh:sw))),height=Math.max(1,Math.round(h||(w?sh*w/sw:sh)));
 if(width*height>40_000_000||width>32767||height>32767) throw new Error('图片超过 4000 万像素或浏览器尺寸限制');
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
