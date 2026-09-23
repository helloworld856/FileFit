export type FileFormat = 'original'|'jpeg'|'png'|'webp'|'avif'|'pdf';
export interface FitOptions {
 maxBytes: number; format: FileFormat; width: number; height: number;
 fit: 'contain'|'cover'|'stretch'; allowResize: boolean; minQuality: number;
 rotate: number; flipX: boolean; flipY: boolean; grayscale: boolean;
 stripMetadata: boolean; dpi: number; filename: string;
 maxPages: number; paper: 'original'|'a4'|'letter';
 pdfMode: 'preserve'|'raster'; pages: string; watermark: string; pageNumbers: boolean;
 password: string; outputPassword: string; ocrLanguage: string;
}
export interface FileInfo { format: string; width?:number; height?:number; pages?:number; dpi?:number; encrypted?:boolean; }
export interface Check { label:string; passed:boolean; detail:string; }
export interface ProcessResult { blob:Blob; name:string; info:FileInfo; warnings:string[]; checks?:Check[]; }
export type Progress = (value:number, message:string)=>void;
export const DEFAULT_OPTIONS:FitOptions={maxBytes:200000,format:'original',width:0,height:0,fit:'contain',allowResize:true,minQuality:0.45,rotate:0,flipX:false,flipY:false,grayscale:false,stripMetadata:false,dpi:0,filename:'',maxPages:0,paper:'original',pdfMode:'preserve',pages:'',watermark:'',pageNumbers:false,password:'',outputPassword:'',ocrLanguage:'chi_sim+eng'};
