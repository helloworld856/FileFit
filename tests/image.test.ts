import { describe,it,expect } from 'vitest';
import { imageGeometry,readDpi,writeDpi,sniffImage,isAnimated } from '../src/engines/image-helpers';
describe('image geometry and metadata',()=>{
 it('contains an image without distortion and centers the padding',()=>{expect(imageGeometry(400,200,100,100,'contain')).toEqual({width:100,height:100,x:0,y:25,drawWidth:100,drawHeight:50});});
 it('covers the required rectangle by centered cropping',()=>{expect(imageGeometry(400,200,100,100,'cover').x).toBe(-50);});
 it('derives an unspecified dimension and rejects excessive allocations',()=>{expect(imageGeometry(400,200,100,0,'contain').height).toBe(50);expect(()=>imageGeometry(400,200,100000,100000,'contain')).toThrow();});
 it('writes and reads JPEG resolution independently of filename',()=>{const bytes=new Uint8Array([255,216,255,217]);const result=writeDpi(bytes,'jpeg',300);expect(readDpi(result)).toBe(300);expect(sniffImage(result)).toBe('jpeg');});
 it('writes PNG physical resolution with a valid bounded chunk',()=>{const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,...new Array(17).fill(0),0,0,0,0,73,69,78,68,174,66,96,130]);expect(readDpi(writeDpi(bytes,'png',300))).toBeCloseTo(300,1);});
 it('recognizes GIF animation risk and rejects random bytes',()=>{expect(isAnimated(new TextEncoder().encode('GIF89a'))).toBe(true);expect(sniffImage(new Uint8Array([1,2,3]))).toBe('unknown');});
});
