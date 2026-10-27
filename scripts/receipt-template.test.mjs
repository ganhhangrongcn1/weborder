import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base = new URL('../', import.meta.url);
const context = vm.createContext({ console, Date, Map, Set, Promise, setTimeout, clearTimeout,
  AbortController: globalThis.AbortController, require: () => ({ supabase: { rpc: () => ({ abortSignal: async () => ({ data: token }) }) } }) });
function mock(values) { return new vm.SyntheticModule(Object.keys(values), function () {
  for (const [key, value] of Object.entries(values)) this.setExport(key, value);
}, { context }); }
async function module(path, deps = {}) {
  const value = new vm.SourceTextModule(fs.readFileSync(new URL(path, base), 'utf8'), { context });
  await value.link((name) => { assert(deps[name], `Missing mock ${name}`); return deps[name]; });
  await value.evaluate(); return value;
}
const compact = await module('ghr-pos-mobile-native/src/services/pos/compactReceiptLayout.js');
const engine = await module('ghr-pos-mobile-native/src/services/pos/receiptTemplate.js', { './compactReceiptLayout.js': compact });
const { applyReceiptTemplate, normalizeReceiptTemplate } = engine.namespace;
const template = normalizeReceiptTemplate({ enabled: true });
const stamps = await module('ghr-pos-mobile-native/src/services/pos/posStampReceipt.js');
const token = 'https://ganhhangrong.vn/nhan-diem/' + 'a'.repeat(64);
const printed = [];
let activeTemplate = template;
const native = await module('ghr-pos-mobile-native/src/services/pos/posPrinterService.js', {
  './receiptTemplate': engine,
  './posReceiptTemplateService': mock({ loadPosReceiptTemplate: async () => activeTemplate }),
  './posStampReceipt': stamps,
  'react-native': mock({ Platform: { OS: 'android' }, NativeModules: { PosPrinter: { printReceipt: async (value) => printed.push(value) } } }),
  './posCashBreakdownService': mock({ getCashBreakdownEntries: () => [] }),
  '../../utils/format': mock({ formatMoney: (value) => Number(value).toLocaleString('vi-VN') })
});
const svg = mock({ default: () => '<svg aria-label="tem"></svg>' });
const html = await module('src/services/receiptTemplateHtml.js', { './stampReceiptService.js': svg });
const web = await module('src/services/printerService.js', {
  './stampReceiptService.js': svg,
  './stampProgramService.js': mock({ readStampSummary: async () => ({}) }),
  './receiptLoyaltyService.js': mock({ prepareReceiptLoyaltyUrl: async () => token }),
  './receiptTemplateService.js': mock({ getReceiptTemplate: () => activeTemplate, loadReceiptTemplate: async () => activeTemplate }),
  '../../ghr-pos-mobile-native/src/services/pos/receiptTemplate.js': engine,
  './receiptTemplateHtml.js': html
});
const samples = await module('src/data/receiptTemplateSamples.js');
for (const type of ['pos', 'web', 'partner', 'kitchen']) {
  const sample = samples.namespace.createReceiptSample(type, true, true);
  const text = web.namespace.buildReceiptText(sample, { receiptTemplate: template });
  assert.equal((text.match(/@@BOLDCENTER:GÁNH HÀNG RONG/g) || []).length, type === 'kitchen' ? 0 : 1);
  assert(text.includes('Bánh tráng cuốn') && text.includes('Thêm trứng') && text.includes('Không hành'));
  assert(text.includes('Ít cay, để riêng nước sốt'));
  assert.equal((text.match(/^@@QR$/gm) || []).length, type === 'kitchen' ? 0 : 1);
  if (['pos', 'web'].includes(type)) {
    assert(text.includes('70.000') && !text.includes('CÒN PHẢI THU\t0'));
    assert.equal((text.match(/ĐÃ THANH TOÁN/g) || []).length, 1);
  }
  if (type === 'partner') assert(!text.includes('70.000') && !text.includes('80.000'), 'do not expose reconciliation amounts');
  if (type !== 'kitchen') {
    assert(text.includes('@@CENTER:Quét để nhận 7000\n@@QR'), 'reward caption has no currency, grouping or suffix');
    assert(!/7000(?:đ| điểm)/.test(text) && !text.includes('đã tích cho'));
    assert(text.indexOf('@@QR') > text.indexOf('Bánh tráng cuốn'));
    assert(text.indexOf('@@STAMPS:3') > text.indexOf('@@QR'));
    assert(text.includes('Còn 7 tem nữa để nhận quà') && !text.includes('3/10 tem'));
    assert.equal(applyReceiptTemplate(text, template), text, 'template must be idempotent across web/print station');
  }
  const document = web.namespace.buildReceiptHtml(sample, { receiptTemplate: template, loyaltyQrImage: 'data:image/png;base64,TEST' });
  assert(document.includes('lang="vi"') && !document.includes('@@BOLDROW:'));
}
const order = { id: 'canonical', orderCode: 'POS-152', stampSummary: { enabled: true, available: 3 } };
const paid = native.namespace.buildPosCustomerBillText({ order,
  cart: [{ name: 'Bánh tráng', quantity: 2, lineTotal: 70000, selectedOptions: [{ name: 'Thêm trứng' }] }],
  totals: { subtotal: 80000, voucherDiscount: 10000, total: 70000 },
  paymentConfirmed: { paid: true, method: 'cash', amount: 70000, received: 100000, change: 30000 }
});
await native.namespace.printLocalReceipt({ text: paid, sourceType: 'pos', footerQrUrl: token });
assert.equal(printed[0].footerQrUrl, token);
assert(printed[0].footerText.includes('@@QR') && !printed[0].text.includes('@@QR'), 'Android rasterizer must receive the complete QR through its dedicated footer');
assert(printed[0].text.includes('Khách đưa\t100.000') && printed[0].text.includes('Tiền thối\t30.000'));
assert.equal((printed[0].footerText.match(/@@STAMPS:3/g) || []).length, 1);
assert(!printed[0].text.includes('@@RECEIPTORDER:'));
const preparation = native.namespace.buildPosPreparationBillText({ order, cart: [{ name: 'Trà', quantity: 2, note: 'Ít đá' }] });
await native.namespace.printLocalReceipt({ text: preparation, sourceType: 'qr_order_preparation' });
assert(!printed[1].text.includes('@@QR') && !printed[1].text.includes('@@STAMPS'));
const bank = native.namespace.buildPosQrReceiptText({ amount: 70000 });
await native.namespace.printLocalReceipt({ text: bank, qrUrl: 'bank://payment', sourceType: 'pos_payment_qr' });
assert.equal(printed[2].text, bank);
assert.equal(printed[2].qrUrl, 'bank://payment');
activeTemplate = normalizeReceiptTemplate();
await native.namespace.printLocalReceipt({ text: paid, sourceType: 'pos', footerQrUrl: token });
assert.equal(printed[3].footerQrUrl, token, 'missing config preserves token and uses approved layout');
assert(printed[3].footerText.includes('ĐỪNG BỎ LỠ ĐIỂM ĐƠN NÀY'));
assert.equal(normalizeReceiptTemplate({ enabled: false }).enabled, true, 'legacy disable flag must not restore old layout');
assert(!normalizeReceiptTemplate({ brand: 'x\n@@QR\x1b' }).brand.includes('@@'));
const hidden = web.namespace.buildReceiptText(samples.namespace.createReceiptSample('pos', true, true), {
  receiptTemplate: { ...template, showCustomer: false, showLoyalty: false, showStamps: false }
});
assert(!hidden.includes('0900000000') && !hidden.includes('@@QR') && !hidden.includes('@@STAMPS'));
for (const type of ['pos', 'web', 'partner']) {
  const noPhone = web.namespace.buildReceiptText(samples.namespace.createReceiptSample(type, true, false), { receiptTemplate: template });
  assert(noPhone.includes('@@STAMPS:0\n@@CENTER:Quét mã bên trên để tích tem đổi quà'));
  assert.equal(applyReceiptTemplate(noPhone, template), noPhone, 'empty stamp invitation stays stable on reprint');
  assert(!noPhone.includes('0/10 tem'), 'empty invitation must not pretend to be a retrieved balance');
}
assert(!html.namespace.renderReceiptTemplateBody('@@CENTER:<img src=x onerror=alert(1)>').includes('<img'));
const remaining = compact.namespace.default(['@@ROW:CÒN PHẢI THU\t30.000', '@@ROW:Giảm điểm\t-10.000']);
assert(remaining.includes('@@ROW:CÒN PHẢI THU\t30.000') && remaining.includes('@@ROW:Giảm điểm\t-10.000'));
const fullStampSample = samples.namespace.createReceiptSample('pos', true, true);
fullStampSample.stampSummary.available = 10;
const fullStampText = web.namespace.buildReceiptText(fullStampSample, { receiptTemplate: template });
assert(fullStampText.includes('Đã đủ tem để nhận quà') && !fullStampText.includes('Còn 0 tem'));
const station = await module('ghr-pos-mobile-native/src/services/pos/posPrintStationService.js', {
  './posOrderAlertService': mock({ playPosOrderAlert: async () => false, isWebsiteOrderPaid: (order) => order.paymentStatus === 'paid' || Boolean(order.paidAt) }),
  './posStampReceipt': stamps,
  './posStampService': mock({ withPosStampSummary: async (order) => order }),
  'react-native': mock({ AppState: { currentState: 'active' } }),
  '../supabase/client': mock({ supabase: null }),
  './posPrinterService': native
});
for (const type of ['web', 'partner']) {
  const sample = { ...samples.namespace.createReceiptSample(type, true, false), id: `${type}-canonical` };
  const payload = station.namespace.buildPrintPayload({ source_type: type === 'partner' ? 'partner' : 'website', job_type: 'customer_bill',
    payload: { order: sample, text: 'OLD-QUEUED-LAYOUT', receiptLoyaltyUrl: token, footerQrUrl: token } });
  assert(!payload.text.includes('OLD-QUEUED-LAYOUT'), 'structured order data must replace stale queued text');
  if (type === 'partner') assert(!payload.text.includes('70.000') && !payload.text.includes('80.000'));
  await native.namespace.printLocalReceipt(payload);
  const raster = printed[printed.length - 1];
  assert(raster.footerText.includes('ĐỪNG BỎ LỠ ĐIỂM ĐƠN NÀY') && raster.footerText.includes('Quét để nhận 7000'));
  assert.equal(raster.footerQrUrl, token);
  assert(!raster.text.includes('@@QR') && raster.footerText.includes('@@STAMPS:0'));
}
console.log('Receipt template passed: 4 previews, web/native financial preservation, one QR/stamp block, token, preparation/payment exclusions, disabled fallback, escaping.');
