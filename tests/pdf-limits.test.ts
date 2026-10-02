import {expect,it} from 'vitest';
import {inspectPdf} from '../src/engines/pdf';

it('rejects oversized PDFs before allocating their bytes',async()=>{
  const file={size:100_000_001,arrayBuffer:()=>{throw new Error('read should not happen')}} as unknown as File;
  await expect(inspectPdf(file)).rejects.toThrow(/100 MB/);
});
