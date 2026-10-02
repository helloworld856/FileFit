import type { Check,FileInfo,FitOptions } from './types';
import {MAX_IMAGE_PIXELS} from './input-limits';
export function formatSize(bytes:number):string {return bytes>=1e6?`${(bytes/1e6).toFixed(2)} MB`:bytes>=1000?`${(bytes/1000).toFixed(1)} KB`:`${bytes} B`;}
export function validateResult(blob:Blob,info:FileInfo,options:FitOptions,name:string):Check[]{
 const checks:Check[]=[{label:'size',passed:blob.size<=options.maxBytes,detail:`${formatSize(blob.size)} / ${formatSize(options.maxBytes)}`}];
 if(options.format!=='original')checks.push({label:'format',passed:info.format===options.format,detail:info.format.toUpperCase()});
 if(info.format!=='pdf'&&(options.width||options.height))checks.push({label:'dimensions',passed:(!options.width||info.width===options.width)&&(!options.height||info.height===options.height),detail:`${info.width} × ${info.height} px`});
 if(options.dpi&&info.format!=='pdf')checks.push({label:'dpi',passed:Math.abs((info.dpi||0)-options.dpi)<1,detail:info.dpi?`${info.dpi} DPI`:'DPI metadata missing'});
 if(options.maxPages&&info.format==='pdf')checks.push({label:'pages',passed:!!info.pages&&info.pages<=options.maxPages,detail:`${info.pages} / ${options.maxPages}`});
 checks.push({label:'filename',passed:!!name&&name.length<=180&&!/[<>:"/\\|?*\u0000-\u001f]/.test(name),detail:name});
 return checks;
}
export function validateOptions(o:FitOptions):string[]{
 const errors:string[]=[];
 if(!Number.isFinite(o.maxBytes)||o.maxBytes<1)errors.push('请填写大于 0 的文件大小');
 for(const key of ['width','height','dpi','maxPages'] as const)if(!Number.isInteger(o[key])||o[key]<0)errors.push(`${key} 必须为非负整数`);
 if(o.width>20000||o.height>20000||o.width*o.height>MAX_IMAGE_PIXELS)errors.push('图片尺寸超过 1600 万像素或 20000 像素边长');
 if(!Number.isFinite(o.minQuality)||o.minQuality<0.1||o.minQuality>1)errors.push('清晰度下限应在 10% 到 100% 之间');
 if(o.paper==='custom'&&(!Number.isFinite(o.paperWidthMm)||!Number.isFinite(o.paperHeightMm)||o.paperWidthMm<10||o.paperHeightMm<10||o.paperWidthMm>1200||o.paperHeightMm>1200))errors.push('自定义纸张宽高应为 10–1200 毫米');
 return errors;
}
export function outputName(name:string,format:string,template=''):string{
 const ext=format==='jpeg'?'jpg':format;
 let base=(template.trim()||name).replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,150)||'file';
 if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base))base='_'+base;
 return `${base}.${ext}`;
}
export function parsePages(input:string,count:number):number[]{
 if(!input.trim())return Array.from({length:count},(_,i)=>i);
 const pages:number[]=[];
 for(const chunk of input.split(/[,，]/)){
 const match=chunk.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!match)throw new Error('页码格式应为 1-3,5');
 const start=Number(match[1]),end=Number(match[2]||match[1]);
 if(start<1||end<1||start>count||end>count)throw new Error(`页码必须在 1 到 ${count} 之间`);
 const step=start<=end?1:-1;for(let p=start;;p+=step){pages.push(p-1);if(p===end)break;}
 }return pages;
}
