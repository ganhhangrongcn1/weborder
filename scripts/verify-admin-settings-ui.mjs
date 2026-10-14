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
const kitchenGroups = [
  { id: "spice", source: "xanhngon", groupName: "Tùy chọn", optionName: "Không Cay", kitchenLabel: "Mức Độ Cay", enabled: false, groupEnabled: false, kitchenType: "other", sortOrder: 0 },
  { id: "topping", source: "xanhngon", groupName: "Tùy chọn", optionName: "5 Trứng Cút Luộc", kitchenLabel: "Ngon Hơn Khi Ăn Cùng", enabled: true, groupEnabled: false, kitchenType: "topping", sortOrder: 1 },
  { id: "grab", source: "grabfood", groupName: "Ngon Hơn Khi Ăn Cùng", optionName: "Hành Phi", kitchenLabel: "Ngon Hơn Khi Ăn Cùng", enabled: true, groupEnabled: true, kitchenType: "topping", sortOrder: 2 }
];
const html = `<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><div id="root" class="admin-shell" style="display:block"></div><script type="module">
import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import BranchSettings from '/src/pages/admin/store/BranchSettings.jsx';
import ShippingSettings from '/src/pages/admin/store/ShippingSettings.jsx';
import KitchenSettings from '/src/pages/admin/menu/components/KitchenOptionSettingsPanel.jsx';
import '/src/styles.css';
import '/src/styles/base/reset.css';
import '/src/styles/base/typography.css';
import '/src/styles/admin/admin.css';
window.__branchRequests=[];window.__shippingRequests=[];window.__kitchenRequests=[];
window.__kitchenGroups=${JSON.stringify(kitchenGroups)};
function App(){
 const [branches,setBranches]=useState([{id:'fixture-1',branch_uuid:'fixture-uuid',branch_code:'CN01',name:'Chi nhánh thử',address:'Địa chỉ thử',openTime:'09:00',closeTime:'21:00',paymentSettings:{provider:'vietqr',webMomoEnabled:true,webCounterPaymentEnabled:false,webBankQrEnabled:false}}]);
 const [shipping,setShipping]=useState({baseFeeFirst3Km:15000,feePerNextKm:5000,maxRadiusKm:15,customerNote:'Giao hàng thử',freeShipThreshold:123456,supportShippingEnabled:true,maxSupportShipFee:7000,sourceBranchId:'preserve-me'});
 const view=new URLSearchParams(location.search).get('view');
 return React.createElement('div',{className:'admin-content',style:{padding:20}},view==='shipping'
  ?React.createElement(ShippingSettings,{shippingConfig:shipping,onSave:async next=>{window.__shippingRequests.push(next);if(window.__shippingFail)throw Error('fixture');setShipping(next);}})
  :view==='kitchen'?React.createElement(KitchenSettings,{optionGroupPresets:[]})
  :React.createElement(BranchSettings,{branches,setBranches:next=>{window.__savedBranches=next;setBranches(next);}}));
}
createRoot(document.getElementById('root')).render(<App/>);
</script></body></html>`;
const fixtureEntry = html.split('<script type="module">')[1].split('</script>')[0];
const fixtureHtml = html.replace(/<script type="module">[\s\S]*?<\/script>/, '<script type="module" src="/__admin-settings-entry.jsx"></script>');
const fixturePlugin = {
  name: "isolated-admin-settings", enforce: "pre",
  resolveId(source, importer) {
    if (source === "/__admin-settings-entry.jsx") return `${root}/__admin-settings-entry.jsx`;
    if (importer?.endsWith("/KitchenOptionSettingsPanel.jsx") && source.endsWith("kitchenOptionGroupSettingsService.js")) return "\0kitchen-fixture";
  },
  load(id) {
    if (id === `${root}/__admin-settings-entry.jsx`) return fixtureEntry;
    if (id === "\0kitchen-fixture") return `
      export const buildInternalKitchenOptionGroups=()=>[];
      export const shouldAutoEnablePartnerKitchenOption=()=>false;
      export const loadKitchenOptionGroupSettings=async()=>({version:3,partnerDefaultsApplied:true,groupDefaultsApplied:true,groups:window.__kitchenGroups});
      export const discoverPartnerOptionGroups=async()=>({groups:window.__kitchenGroups});
      export const saveKitchenOptionGroupSettings=async value=>{window.__kitchenRequests.push(value);return value;};`;
  },
  transform(code, id) {
    if (id.endsWith("/BranchSettings.jsx")) return code.replace(/import \{ syncBranchesToSupabase \} from [^;]+;/,
      `const syncBranchesToSupabase=async value=>{window.__branchRequests.push(value);if(window.__branchFail)throw Error('fixture');return {ok:!window.__branchNotSaved};};`);
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
  const fill = async (selector, value) => page.$eval(selector, (input, text) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  }, value);
  await open("branches");
  await page.waitForSelector(".admin-branch-summary", { timeout: 10000 }).catch(async error => { console.error("Fixture browser errors:", errors); console.error(await page.evaluate(() => document.body.textContent.slice(0, 400))); throw error; });
  await page.click(".admin-branch-summary");
  await fill('input[name="branch-name-fixture-1"]', "Chi nhánh đã sửa");
  await click("Thanh toán");
  await page.waitForSelector('[aria-label="Cho phép MoMo trên website tại Chi nhánh đã sửa"]');
  assert.equal(await page.$eval('[aria-label="Cho phép MoMo trên website tại Chi nhánh đã sửa"]', (input) => input.disabled), true);
  await click("Bán hàng & QR");
  await click("Thông tin");
  assert.equal(await page.$eval('input[name="branch-name-fixture-1"]', (input) => input.value), "Chi nhánh đã sửa");
  await page.evaluate(() => { window.__branchFail = true; });
  await click("Lưu cấu hình chi nhánh");
  await page.waitForFunction(() => document.body.textContent.includes("Chưa lưu được cấu hình chi nhánh"));
  assert.equal(await page.evaluate(() => window.__savedBranches), undefined);
  await page.evaluate(() => { window.__branchFail = false; window.__branchNotSaved = true; });
  await click("Lưu cấu hình chi nhánh");
  await page.waitForFunction(() => window.__branchRequests.length === 2);
  assert.equal(await page.evaluate(() => window.__savedBranches), undefined);
  await page.evaluate(() => { window.__branchNotSaved = false; });
  await click("Lưu cấu hình chi nhánh");
  await page.waitForFunction(() => window.__savedBranches?.[0]?.name === "Chi nhánh đã sửa");
  await click("Thanh toán");
  await page.waitForFunction(() => document.querySelector('.admin-ui-tabs button.active')?.textContent.trim() === "Thanh toán");
  await new Promise((resolve) => setTimeout(resolve, 250));
  await page.screenshot({ path: `${output}/branch-payment.png`, fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Branch tabs overflow mobile viewport");
  await page.screenshot({ path: `${output}/branch-mobile.png`, fullPage: true });
  await open("shipping");
  await click("Khôi phục phí ship mặc định");
  await click("Lưu phí giao hàng");
  await page.waitForFunction(() => window.__shippingRequests.length === 1);
  const saved = await page.evaluate(() => window.__shippingRequests[0]);
  assert.equal(saved.freeShipThreshold, 123456);
  assert.equal(saved.supportShippingEnabled, true);
  assert.equal(saved.maxSupportShipFee, 7000);
  assert.equal(saved.sourceBranchId, "preserve-me");
  await fill('input[type="number"]', "19000");
  await page.evaluate(() => { window.__shippingFail = true; });
  await click("Lưu phí giao hàng");
  await page.waitForFunction(() => document.body.textContent.includes("Chưa lưu được phí giao hàng"));
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/shipping-mobile.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Shipping page overflows mobile viewport");
  await page.screenshot({ path: `${output}/shipping-mobile.png`, fullPage: true });
  await page.setViewport({ width: 1280, height: 900 });
  await open("kitchen");
  await page.waitForSelector(".admin-kitchen-option-group");
  assert.equal(await page.$$eval(".admin-kitchen-option-group", (items) => items.length), 3);
  await page.evaluate(() => [...document.querySelectorAll('.admin-kitchen-option-group')].find((group) => group.textContent.includes('Xanh Ngon') && group.textContent.includes('Ngon Hơn Khi Ăn Cùng')).querySelector('input[type="checkbox"]').click());
  await click("Lưu thiết lập");
  await page.waitForFunction(() => window.__kitchenRequests.length === 1);
  const groups = await page.evaluate(() => window.__kitchenRequests[0].groups);
  assert.equal(groups.find((group) => group.id === "spice").enabled, false);
  assert.equal(groups.find((group) => group.id === "topping").enabled, false);
  assert.equal(groups.find((group) => group.id === "grab").enabled, true);
  assert.equal(groups.find((group) => group.id === "topping").groupEnabled, false);
  await page.screenshot({ path: `${output}/kitchen-groups.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: branch tabs retain drafts; sole web payment stays enabled; failed branch saves retain drafts; shipping reset preserves hidden settings; mobile shipping fits; Xanh Ngon toggle leaves spice/Grab unchanged; no uncaught browser errors.");
} finally {
  await browser?.close();
  await server.close();
}
