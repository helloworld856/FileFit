import {describe,it,expect} from 'vitest';
import {validateResult,validateOptions,outputName,parsePages} from '../src/core/rules';
import {DEFAULT_OPTIONS} from '../src/core/types';
describe('output compliance',()=>{
 it('rejects output over actual byte budget',()=>{expect(validateResult(new Blob(['123456']),{format:'jpeg'},{...DEFAULT_OPTIONS,maxBytes:5},'photo.jpg').find(x=>x.label==='size')?.passed).toBe(false)});
 it('does not accept the wrong format despite matching extension',()=>{expect(validateResult(new Blob(['a']),{format:'png'},{...DEFAULT_OPTIONS,format:'jpeg'},'photo.jpg').find(x=>x.label==='format')?.passed).toBe(false)});
 it('requires exact user dimensions',()=>{expect(validateResult(new Blob(['a']),{format:'jpeg',width:799,height:600},{...DEFAULT_OPTIONS,width:800,height:600},'a.jpg').find(x=>x.label==='dimensions')?.passed).toBe(false)});
 it('rejects missing DPI when required',()=>{expect(validateResult(new Blob(['a']),{format:'jpeg'},{...DEFAULT_OPTIONS,dpi:300},'a.jpg').find(x=>x.label==='dpi')?.passed).toBe(false)});
 it('rejects negative and non finite sizes',()=>{expect(validateOptions({...DEFAULT_OPTIONS,maxBytes:-1})).not.toHaveLength(0);expect(validateOptions({...DEFAULT_OPTIONS,maxBytes:NaN})).not.toHaveLength(0)});
 it('requires bounded custom paper dimensions',()=>{expect(validateOptions({...DEFAULT_OPTIONS,paper:'custom',paperWidthMm:210,paperHeightMm:297})).toHaveLength(0);expect(validateOptions({...DEFAULT_OPTIONS,paper:'custom',paperWidthMm:0,paperHeightMm:297})).not.toHaveLength(0)});
 it('rejects output dimensions above the canvas pixel budget',()=>{expect(validateOptions({...DEFAULT_OPTIONS,width:5000,height:4000})).not.toHaveLength(0)});
 it('sanitizes filenames and does not double extensions',()=>{expect(outputName('photo.png','jpeg','my:photo.png')).toBe('my_photo.jpg')});
 it('supports explicit page ordering and catches invalid pages',()=>{expect(parsePages('3,1-2',3)).toEqual([2,0,1]);expect(()=>parsePages('0,7',3)).toThrow()});
});
