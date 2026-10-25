import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';

const url = `https://ganhhangrong.vn/nhan-diem/${'a'.repeat(64)}`;
const prints = [];
const calls = [];
const context = vm.createContext({ console, Date, Set, Map, Promise, AbortController, setTimeout, clearTimeout,
  require: () => ({ supabase: { rpc: (name, input) => { calls.push({ name, input }); return { abortSignal: async () => ({ data: url }) }; } } })
});
const mock = (values) => new vm.SyntheticModule(Object.keys(values), function () {
  for (const [key, value] of Object.entries(values)) this.setExport(key, value);
}, { context });
const printerDeps = {
  './posStampReceipt': mock({ placeStampsAfterLoyaltyQr: (text, footerText) => ({ text, footerText }) }),
  'react-native': mock({ Platform: { OS: 'android' }, NativeModules: { PosPrinter: { printReceipt: async (value) => { prints.push(value); } } } }),
  './posCashBreakdownService': mock({ getCashBreakdownEntries: () => [] }),
  '../../utils/format': mock({ formatMoney: (value) => `${value}đ` })
};
const printer = new vm.SourceTextModule(fs.readFileSync(new URL('../ghr-pos-mobile-native/src/services/pos/posPrinterService.js', import.meta.url), 'utf8'), { context });
await printer.link((name) => printerDeps[name]); await printer.evaluate();
const paidText = printer.namespace.buildPosCustomerBillText({
  order: { id: 'canonical-order-id', displayOrderCode: 'GHR-123' }, cart: [], totals: { total: 30000 },
  paymentConfirmed: { paid: true, method: 'cash', amount: 30000 }
});
assert.match(paidText, /@@RECEIPTORDER:canonical-order-id/);
await printer.namespace.printLocalReceipt({ text: paidText, sourceType: 'customer_bill' });
assert.equal(calls.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(calls[0].input)), { p_source: 'ORDER', p_id: 'canonical-order-id' });
assert.equal(prints[0].footerQrUrl, url);
assert(!prints[0].text.includes('@@RECEIPTORDER'), 'internal marker must never reach paper');
await printer.namespace.printLocalReceipt({ text: '@@CENTER:PHIẾU LÀM MÓN\n@@RECEIPTORDER:fake', sourceType: 'preparation_ticket' });
assert.equal(calls.length, 1, 'preparation tickets cannot issue reward links');
assert.equal(prints[1].footerQrUrl, '');
await printer.namespace.printLocalReceipt({ text: paidText, sourceType: 'customer_bill', footerQrUrl: url });
assert.equal(calls.length, 1, 'a server-issued link must be preserved without another request');

const fixture = { orderCode: 'GHR-123', branchName: 'Gánh Hàng Rong', createdAt: new Date().toISOString(),
  totalAmount: 30000, pointsBaseAmount: 30000, points: 3000, source: 'POS', expiresAt: new Date().toISOString() };
const pageSource = fs.readFileSync(new URL('../src/pages/ReceiptLoyaltyPage.jsx', import.meta.url), 'utf8');
const compiled = transformSync(pageSource, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
function render(status) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'react') return { ...React, useEffect() {}, useState: () => ['claim', () => {}] };
    if (name === 'react-router-dom') return {
      Link: ({ to, children, ...props }) => React.createElement('a', { ...props, href: to }, children),
      useParams: () => ({ token: 'a'.repeat(64) })
    };
    if (name.endsWith('.css')) return {};
    if (name.includes('useReceiptLoyalty')) return { __esModule: true, default: () => ({
      receipt: { ...fixture, status, maskedPhone: '•••••••123' }, phone: '', loading: false,
      review() {}, refresh() {}, setPhone() {}, setConfirmPhone() {}
    }) };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
const available = render('available');
assert(available.includes('Số điện thoại nhận điểm'));
assert(!available.includes('<footer') && !available.includes('bottom-nav'));
assert(available.includes('href="/profile"') && available.includes('href="/review-rewards"'));
assert(available.includes('THƯỞNG ĐIỂM ĐÁNH GIÁ'));
const claimed = render('claimed');
assert(claimed.includes('•••••••123') && !claimed.includes('id="receipt-phone"'));
assert(render('cancelled').includes('không được nhận điểm'));
assert(render('waiting_data').includes('Điểm đang chờ đối soát'));
console.log('Receipt tests passed: paid QR, canonical identity, preparation exclusion, existing link, claimed/blocked UI, banner and account routes.');
