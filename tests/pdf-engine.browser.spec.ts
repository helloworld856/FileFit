import {expect,test} from '@playwright/test';

test('PDF compression, encryption, wrong password and cancellation work in a browser',async({page,browserName})=>{
 test.skip(browserName!=='chromium');
 await page.goto('/tests/pdf-browser.html');
 await page.locator('#run').click();
 await expect(page.locator('#results')).toContainText('ALL PDF CHECKS PASSED',{timeout:120_000});
});

test('OCR assets produce searchable PDF and text',async({page,browserName})=>{
 test.skip(browserName!=='chromium');
 await page.goto('/tests/pdf-browser.html');
 await page.locator('#ocr').click();
 await expect(page.locator('#results')).toContainText('ALL OCR CHECKS PASSED',{timeout:120_000});
});
