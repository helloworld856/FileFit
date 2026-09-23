const signature=new Uint8Array([137,80,78,71,13,10,26,10]);
function u32(value:number){const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,value);return bytes;}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type:string,data:Uint8Array){const name=new TextEncoder().encode(type);const body=new Uint8Array(name.length+data.length);body.set(name);body.set(data,name.length);return [u32(data.length),body,u32(crc32(body))];}

/** Optional 216-colour indexed PNG. Transparency is reduced to a binary mask. */
export async function encodePalettePng(canvas:HTMLCanvasElement):Promise<Blob>{
 const {width,height}=canvas;
 if(!width||!height||width*height>16_000_000)throw new Error('调色板 PNG 限制为 1600 万像素');
 if(typeof CompressionStream==='undefined')throw new Error('此浏览器不支持调色板 PNG 压缩');
 const rgba=canvas.getContext('2d')!.getImageData(0,0,width,height).data;
 const raw=new Uint8Array(height*(width+1));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=(y*width+x)*4,a=rgba[p+3];
  raw[y*(width+1)+x+1]=a<128?0:1+Math.round(rgba[p]/51)*36+Math.round(rgba[p+1]/51)*6+Math.round(rgba[p+2]/51);
 }
 const palette=new Uint8Array(217*3);
 for(let r=0;r<6;r++)for(let g=0;g<6;g++)for(let b=0;b<6;b++){
  const p=(1+r*36+g*6+b)*3;palette[p]=r*51;palette[p+1]=g*51;palette[p+2]=b*51;
 }
 const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 const header=new Uint8Array(13);header.set(u32(width));header.set(u32(height),4);header[8]=8;header[9]=3;
 const parts=[signature,...chunk('IHDR',header),...chunk('PLTE',palette),...chunk('tRNS',new Uint8Array([0])),...chunk('IDAT',compressed),...chunk('IEND',new Uint8Array())];
 return new Blob(parts,{type:'image/png'});
}
