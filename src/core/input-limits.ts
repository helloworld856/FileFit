export const MAX_FILE_BYTES=100_000_000;
export const MAX_IMAGE_PIXELS=16_000_000;
export const MAX_BATCH_PIXELS=40_000_000;
export function assertInputSize(file:Blob,kind:'image'|'pdf'){
 if(!file.size||file.size>MAX_FILE_BYTES)throw new Error(kind==='image'?'图片为空或超过 100 MB':'PDF is empty or exceeds 100 MB.');
}
