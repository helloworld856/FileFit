import {expect,it} from 'vitest';
import {readableReport} from '../src/core/report';

it('escapes untrusted filenames and warnings in the offline report',()=>{
 const html=readableReport({createdAt:'2026-09-23',files:[{source:'<script>alert(1)</script>.png',output:'a&b.png',size:1200,info:{format:'png'},checks:[{label:'size',passed:false,detail:'1200 / 1000'}],warnings:['<img src=x onerror=alert(1)>']}]});
 expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
 expect(html).toContain('a&amp;b.png');
 expect(html).not.toContain('<img src=x');
 expect(html).toContain('class="fail"');
});
