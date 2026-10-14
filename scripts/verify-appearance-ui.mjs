// Isolated UI checks: all persistence is stubbed; external requests are blocked.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import puppeteer from "puppeteer-core";

const root = resolve(new URL("..", import.meta.url).pathname);
const output = process.env.ADMIN_SETTINGS_SCREENSHOTS || "/workspace/artifacts/admin-settings";
mkdirSync(output, { recursive: true });
const html = `<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root" class="admin-shell" style="display:block"></div><script type="module">
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import AppearanceSettings from '/src/pages/admin/store/AppearanceSettings.jsx';
import '/src/styles.css';import '/src/styles/base/reset.css';import '/src/styles/base/typography.css';import '/src/styles/admin/admin.css';
window.__writes=[];window.__updates=0;
const initial=[{id:'siteBrand',active:false,title:'GHR fixture'},{id:'categorySection',title:'legacy category',active:true},{id:'featuredProducts',title:'legacy featured',active:false},{id:'cashback',active:true,title:'legacy cashback'},{id:'deliveryApps',subtitle:'GrabFood,ShopeeFood',active:true},{id:'popupCampaign',subtitle:'legacy popup',active:false},{id:'reviewRewards',title:'legacy review',subtitle:'Review fixture',active:true}];
window.__initial=initial;
function App(){const [content,setContent]=useState(initial);const [dirty,setDirty]=useState(false);window.__content=content;
return <div className="admin-content" style={{padding:20}}><AppearanceSettings homeContent={content} setHomeContent={next=>{window.__updates++;setContent(next);}} uiDirty={dirty} onDirtyChange={setDirty}/></div>;}
createRoot(document.getElementById('root')).render(<App/>);
</script></body></html>`;
const fixtureEntry = html.split('<script type="module">')[1].split('</script>')[0];
const fixtureHtml = html.replace(/<script type="module">[\s\S]*?<\/script>/, '<script type="module" src="/__admin-settings-entry.jsx"></script>');
const fixturePlugin = {
  name: "isolated-admin-settings", enforce: "pre",
  resolveId(source, importer) {
    if (source === "/__admin-settings-entry.jsx") return `${root}/__admin-settings-entry.jsx`;
    if (importer?.endsWith('/AppearanceSettings.jsx') && source.endsWith('catalogConfigRepository.js')) return "\0appearance-fixture";
  },
  load(id) {
    if (id === `${root}/__admin-settings-entry.jsx`) return fixtureEntry;
    if (id === "\0appearance-fixture") return `export const CATALOG_CONFIG_KEYS={homeContent:'home',banners:'banners'};export const catalogConfigRepository={set:()=>{}};export const syncAppearanceCatalogToSupabase=async value=>{window.__writes.push(value);};`;
  },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url.startsWith("/__admin-settings-fixture") || req.url.includes("html-proxy")) return next();
      res.setHeader("Content-Type", "text/html");
      res.end(await server.transformIndexHtml("/__admin-settings-fixture", fixtureHtml));
    });
  }
};
const server = await createServer({ root, configFile: false, plugins: [fixturePlugin, react()], server: { host: "127.0.0.1", port: 5184, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => request.url().startsWith("http://127.0.0.1:5184/") || request.url().startsWith("data:") ? request.continue() : request.abort());
  await page.setViewport({ width: 1280, height: 900 });
  const open = async (view) => { await page.goto(`http://127.0.0.1:5184/__admin-settings-fixture?view=${view}`, { waitUntil: "networkidle0" }); };
  const click = async (text) => page.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === label);
    if (!button) throw Error(`Button missing: ${label}`);
    button.click();
  }, text);
  await open("appearance");
  await page.waitForSelector('.admin-appearance-fixed-item');
  assert.equal(await page.$$eval('.admin-appearance-fixed-item',items=>items.length),8);
  assert.equal(await page.evaluate(()=>window.__updates),0,'Opening must not add default blocks');
  assert.equal(await page.evaluate(()=>window.__writes.length),0);
  assert.equal(await page.$('[aria-label="Bật Thương hiệu / Logo"]'),null);
  assert.equal(await page.$$eval('.admin-appearance-fixed-item[draggable="true"]',items=>items.length),0);
  const select=async label=>page.evaluate(text=>[...document.querySelectorAll('.admin-appearance-row-main')].find(button=>button.textContent.includes(text)).click(),label);
  await select('Banner mua trên app');
  assert.equal(await page.evaluate(()=>window.__content.find(item=>item.id==='deliveryApps').subtitle),'GrabFood,ShopeeFood');
  assert.equal(await page.evaluate(()=>window.__updates),0,'Selecting app editor must not clear legacy fallback');
  await select('Thương hiệu / Logo');
  await page.waitForSelector('.admin-appearance-editor input[type="text"]').catch(()=>{});
  const inputs=await page.$$('input[type="text"]');
  const title=await Promise.all(inputs.map(async input=>({input,value:await input.evaluate(el=>el.value)})));
  const brand=title.find(item=>item.value==='GHR fixture');
  assert.ok(brand,'Brand title remains editable');
  await brand.input.evaluate(input=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'GHR changed');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await click('Lưu thay đổi');
  await page.waitForFunction(()=>window.__writes.length===1);
  const state=await page.evaluate(()=>({saved:window.__writes[0].homeContent,initial:window.__initial}));
  for(const id of ['categorySection','featuredProducts','cashback','popupCampaign','deliveryApps'])assert.deepEqual(state.saved.find(item=>item.id===id),state.initial.find(item=>item.id===id));
  await page.screenshot({path:`${output}/appearance-cleanup.png`,fullPage:true});
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Appearance must fit mobile');
  assert.deepEqual(errors,[]);
  console.log('PASS: eight current controls; brand always visible; no ineffective block drag; no writes on open/select; explicit save preserves legacy configuration; mobile fits.');

} finally {
  await browser?.close();
  await server.close();
}
