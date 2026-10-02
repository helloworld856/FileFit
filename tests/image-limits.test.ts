import {expect,it} from 'vitest';
import {checkImageInput,heicDisplayImages,readImageDimensions} from '../src/engines/image-helpers';
import {processImage} from '../src/engines/image';
import {DEFAULT_OPTIONS} from '../src/core/types';
import {readFileSync} from 'node:fs';
import {heicFixture} from './heic-fixture';

it('reads dimensions from PNG and rejects oversized pixels before browser decoding', async()=>{
  const png=new Uint8Array(24);
  png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  new DataView(png.buffer).setUint32(16,6000);
  new DataView(png.buffer).setUint32(20,5000);
  expect(readImageDimensions(png)).toEqual({width:6000,height:5000});
  const file=new File([png],'large.png',{type:'image/png'});
  await expect(processImage(file,DEFAULT_OPTIONS,()=>{},new AbortController().signal)).rejects.toThrow(/像素|尺寸/);
});

it('reads JPEG frame dimensions without decoding pixel data',()=>{
  const jpeg=new Uint8Array([255,216,255,192,0,17,8,0,100,0,200,3,1,17,0,2,17,0,3,17,0,255,217]);
  expect(readImageDimensions(jpeg)).toEqual({width:200,height:100});
});

it('reads WebP and ISO BMFF dimensions and rejects missing dimensions',()=>{
  const webp=new Uint8Array(30);
  webp.set([82,73,70,70,22,0,0,0,87,69,66,80,86,80,56,88,10,0,0,0]);
  webp[24]=255;webp[25]=1;webp[27]=43;webp[28]=2;
  expect(readImageDimensions(webp)).toEqual({width:512,height:556});
  const box=(type:string,payload:Uint8Array)=>{
    const out=new Uint8Array(payload.length+8);new DataView(out.buffer).setUint32(0,out.length);
    out.set(new TextEncoder().encode(type),4);out.set(payload,8);return out;
  };
  const ispe=new Uint8Array(12);new DataView(ispe.buffer).setUint32(4,4000);new DataView(ispe.buffer).setUint32(8,3000);
  const inner=box('meta',new Uint8Array([0,0,0,0,...box('iprp',box('ipco',box('ispe',ispe)))]));
  const bmff=new Uint8Array([...box('ftyp',new TextEncoder().encode('avif\0\0\0\0')),...inner]);
  expect(readImageDimensions(bmff)).toEqual({width:4000,height:3000});
  const tiny=new Uint8Array(12);new DataView(tiny.buffer).setUint32(4,100);new DataView(tiny.buffer).setUint32(8,100);
  const multiple=new Uint8Array([...box('ftyp',new TextEncoder().encode('heic\0\0\0\0')),...box('meta',new Uint8Array([0,0,0,0,...box('iprp',box('ipco',new Uint8Array([...box('ispe',tiny),...box('ispe',ispe)])))]))]);
  expect(readImageDimensions(multiple)).toEqual({width:4000,height:3000});
  expect(readImageDimensions(new Uint8Array([1,2,3]))).toBeUndefined();
});

it('recognizes dimensions in a real HEIC container',()=>{
 const bytes=new Uint8Array(readFileSync(new URL('./fixtures/libheif-example.heic',import.meta.url)));
 expect(readImageDimensions(bytes)).toEqual({width:1280,height:854});
});

it('rejects multiple visible HEIC images before invoking any decoder',async()=>{
 await expect(checkImageInput(new Blob([new Uint8Array(heicFixture())]))).rejects.toThrow(/多张|multiple/);
 await expect(checkImageInput(new Blob([new Uint8Array(heicFixture(true))]))).resolves.toMatchObject({format:'heic',width:1280,height:854});
});

it('counts a HEIC grid once without treating tiles, thumbnails or auxiliary images as display images',()=>{
 const box=(type:string,payload:number[])=>{const b=Buffer.alloc(payload.length+8);b.writeUInt32BE(b.length);b.write(type,4);b.set(payload,8);return [...b];};
 const item=(id:number,type:string)=>box('infe',[2,0,0,0,0,id,0,0,...new TextEncoder().encode(type),0]);
 const items=box('iinf',[0,0,0,0,0,4,...item(1,'grid'),...item(2,'hvc1'),...item(3,'hvc1'),...item(4,'hvc1')]);
 const ref=(type:string,from:number,to:number)=>box(type,[0,from,0,1,0,to]);
 const refs=box('iref',[0,0,0,0,...ref('dimg',1,2),...ref('thmb',3,1),...ref('auxl',4,1)]);
 const bytes=new Uint8Array(box('meta',[0,0,0,0,...items,...refs]));
 expect(heicDisplayImages(bytes)).toBe(1);
 expect(heicDisplayImages(bytes.subarray(0,bytes.length-1))).toBeUndefined();
});
