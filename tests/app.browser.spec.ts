import {expect,test} from '@playwright/test';
import {heicFixture} from './heic-fixture';

test('oversized image is blocked before thumbnail or preview decode',async({page})=>{
 await page.goto('/');
 const bytes=Buffer.alloc(24);
 bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
 bytes.writeUInt32BE(6000,16);bytes.writeUInt32BE(5000,20);
 await page.locator('input[type=file]').first().setInputFiles({name:'huge.png',mimeType:'image/png',buffer:bytes});
 await expect(page.locator('.file-thumb img')).toHaveCount(0);
 await page.getByRole('button',{name:'Preview huge.png'}).click();
 await expect(page.getByRole('alert')).toContainText('1600 万像素');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('presets dialog has a named close control and restores focus',async({page})=>{
 await page.goto('/');
 const opener=page.getByRole('button',{name:'我的模板',exact:true});
 await opener.click();
 const dialog=page.getByRole('dialog',{name:'Presets'});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'关闭'})).toBeVisible();
 await expect(dialog.locator(':focus')).toHaveCount(1);
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(opener).toBeFocused();
});

test('PDF settings expose accessible names for mode, pages and passwords',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'合并 PDF'}).click();
 await expect(page.getByRole('combobox',{name:'压缩方式'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'页码 / 排序'})).toBeVisible();
 await page.getByRole('button',{name:'更多设置'}).click();
 await expect(page.getByRole('textbox',{name:'原文件密码'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'新密码（加密工具）'})).toBeVisible();
});

test('small explanatory text has readable contrast on light surfaces',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.field-help').first()).toBeVisible();
 const ratios=await page.evaluate(()=>{
  const luminance=(channel:number)=>{const c=channel/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;};
  return ['.page-heading p','.field-help','.bottom-notes','.workspace-label'].map(selector=>{
   const color=getComputedStyle(document.querySelector(selector)!).color.match(/\d+/g)!.slice(0,3).map(Number);
   const l=.2126*luminance(color[0])+.7152*luminance(color[1])+.0722*luminance(color[2]);
   return (1.05)/(l+.05);
  });
 });
 for(const ratio of ratios)expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('real HEIC input can be converted to JPEG',async({page,browserName})=>{
 test.skip(browserName!=='chromium');
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({name:'single.heic',mimeType:'image/heic',buffer:heicFixture(true)});
 await page.getByRole('button',{name:'开始处理'}).click();
 await expect(page.locator('.file-row .result')).toBeVisible({timeout:120_000});
 await expect(page.locator('.file-row .error-message')).toHaveCount(0);
});

test('HEIC input uses the same safe decoder when converted to PDF',async({page,browserName})=>{
 test.skip(browserName!=='chromium');
 await page.goto('/');
 await page.getByRole('button',{name:'图片转 PDF',exact:true}).click();
 await page.locator('input[type=file]').first().setInputFiles({name:'single.heic',mimeType:'image/heic',buffer:heicFixture(true)});
 await page.getByRole('button',{name:'开始处理'}).click();
 await expect(page.locator('.file-row .result')).toBeVisible({timeout:120_000});
 await expect(page.locator('.file-row .error-message')).toHaveCount(0);
});

test('AVIF encoding worker returns an actual compliant image',async({page,browserName})=>{
 test.skip(browserName!=='chromium');
 await page.goto('/');
 await page.getByRole('button',{name:'添加示例图片'}).click();
 await expect(page.locator('.file-row')).toHaveCount(1);
 await page.locator('#output-format').selectOption('avif');
 await page.getByRole('button',{name:'开始处理'}).click();
 await expect(page.locator('.file-row .result')).toBeVisible({timeout:120_000});
 await expect(page.locator('.file-row .result-badge')).toContainText('已达标');
});

test('multiple-image HEIC is rejected with an explanation',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({name:'multiple.heic',mimeType:'image/heic',buffer:heicFixture()});
 await page.getByRole('button',{name:'开始处理'}).click();
 await expect(page.locator('.error-message')).toContainText('多张图片');
});

test('damaged PDF returns a recoverable error',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({name:'damaged.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
 await page.getByRole('button',{name:'开始处理'}).click();
 await expect(page.locator('.error-message')).toBeVisible();
 await expect(page.getByRole('button',{name:'开始处理'})).toBeEnabled();
});

test('generated sample can be fitted in every supported browser',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'添加示例图片'}).click();
 await expect(page.locator('.file-row')).toHaveCount(1);
 await page.getByRole('button',{name:'开始处理'}).click();
 await expect(page.locator('.file-row .result')).toBeVisible({timeout:120_000});
});

test('missing required browser APIs are explained before processing',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'createImageBitmap',{value:undefined,configurable:true}));
 await page.goto('/');
 await expect(page.getByRole('alert')).toContainText('浏览器缺少');
 await expect(page.getByRole('button',{name:'开始处理'})).toBeDisabled();
});
