import {defineConfig,devices} from '@playwright/test';

const crossBrowser=process.env.FILEFIT_CROSS_BROWSER==='1';
export default defineConfig({
 testDir:'./tests',
 testMatch:'*.browser.spec.ts',
 timeout:120_000,
 workers:2,
 expect:{timeout:15_000},
 use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},
 projects:[
  {name:'chromium',use:{...devices['Desktop Chrome'],channel:process.env.FILEFIT_LOCAL_CHROME==='1'?'chrome':undefined}},
  ...(crossBrowser?[{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}]:[])
 ],
 webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:120_000}
});
