import assert from "node:assert/strict";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const executablePath = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
].find(existsSync);
assert.ok(executablePath, "Set CHROME_PATH to run browser layout checks");
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "jsx",
    contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import Sidebar from './src/pages/admin/AdminSidebar.jsx';
      import './src/styles/admin/admin.css';
      const items = [
        {id:'reports',label:'Tồn kho',icon:'wallet'},
        {id:'lots',label:'Lô & hạn sử dụng',icon:'clock'},
        {id:'alerts',label:'Cảnh báo kho',icon:'warning'}
      ];
      const groups=[{id:'inventory',title:'Quản lý kho',icon:'store',items,
        subgroups:[{id:'reporting',title:'Báo cáo & cảnh báo',icon:'warning',items}]}];
      createRoot(document.getElementById('root')).render(<div className="admin-shell">
        <Sidebar navGroups={groups} navIconMap={{}} activeAdminNav="reports"
          notificationCounts={{reports:60,lots:1}} isMobileOpen
          onMobileClose={()=>document.body.dataset.closed='true'}
          onActivateNav={item=>document.body.dataset.selected=item.id}/>
      </div>);`
  },
  bundle: true, write: false, outdir: ".tmp/nav-check", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".woff2": "dataurl", ".woff": "dataurl", ".svg": "dataurl", ".png": "dataurl" }
});
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: bundle.outputFiles.find((file) => file.path.endsWith(".css")).text });
  await page.addScriptTag({ content: bundle.outputFiles.find((file) => file.path.endsWith(".js")).text });
  for (const width of [320, 390, 640]) {
    await page.setViewport({ width, height: 844 });
    await page.waitForSelector('.admin-nav-subgroup-items > button');
    const layout = await page.evaluate(() => {
      const selectors = ['.admin-nav-group-toggle', '.admin-nav-subgroup-toggle', '.admin-nav-subgroup-items > button'];
      return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const badge = element.querySelector('.admin-nav-badge, .admin-nav-group-badge, .admin-nav-subgroup-badge');
        return { selector, direction: style.flexDirection, height: box.height,
          fits: element.scrollWidth <= element.clientWidth,
          badgePosition: badge ? getComputedStyle(badge).position : 'static' };
      }));
    });
    for (const row of layout) {
      assert.equal(row.direction, 'row', `${width}px ${row.selector}: horizontal`);
      assert.ok(row.height >= 44 && row.height <= 64, `${width}px: compact touch target`);
      assert.ok(row.fits, `${width}px: no clipped content`);
      assert.equal(row.badgePosition, 'static', `${width}px: inline badge`);
    }
    console.log(`Mobile menu ${width}px: passed`);
    if (width === 390 && process.env.NAV_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.NAV_SCREENSHOT_PATH });
    }
  }
  await page.click('.admin-nav-subgroup-toggle');
  assert.equal(await page.$eval('.admin-nav-subgroup-items', (element) => getComputedStyle(element).display), 'none');
  await page.click('.admin-nav-subgroup-toggle');
  await page.click('.admin-nav-subgroup-items > button:nth-child(2)');
  assert.equal(await page.$eval('body', (element) => element.dataset.selected), 'lots');
  await page.click('.admin-mobile-sidebar-close');
  assert.equal(await page.$eval('body', (element) => element.dataset.closed), 'true');
  await page.setViewport({width: 1440, height: 900});
  assert.equal(await page.$eval('.admin-mobile-sidebar-head', (element) => getComputedStyle(element).display), 'none');
  assert.deepEqual(errors, []);
  console.log('Collapse, navigation, close, desktop and browser errors: passed');
} finally {
  await browser.close();
}
