import {readFileSync} from 'node:fs';

export function heicFixture(single=false){
 const bytes=readFileSync(new URL('./fixtures/libheif-example.heic',import.meta.url));
 // This pinned sample has primary image 20004 and secondary image 20006.
 // Hide only the secondary item; keep its pixels and both thumbnail references intact.
 if(single){
  const secondary=253;
  if(bytes.toString('ascii',secondary+4,secondary+8)!=='infe'||bytes.readUInt16BE(secondary+12)!==20006)throw new Error('Unexpected fixture metadata');
  bytes[secondary+11]|=1;
 }
 return bytes;
}
