import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { buildPrintJobPayload } from '../src/services/receiptRenderCore.js';
import { applyReceiptTemplate, normalizeReceiptTemplate } from '../ghr-pos-mobile-native/src/services/pos/receiptTemplate.js';
import partnerReceiptOrder from '../src/services/partnerReceiptOrder.js';
import { dispatchPartnerAutoBills } from '../supabase/functions/nexpos-order-shadow-sync/autoPrint.mjs';

test('server/browser renderer preserves the released bill contract byte for byte', async () => {
  const source = execFileSync('git', ['show', 'b865a7c:src/services/printerService.js'], { encoding: 'utf8' });
  const ctx = createContext({ Date, console });
  const module = new SourceTextModule(source, { context: ctx, initializeImportMeta(meta) { meta.env = {}; } });
  await module.link(specifier => {
    const values = specifier.includes('receiptTemplate.js') ? { applyReceiptTemplate, normalizeReceiptTemplate }
      : specifier.includes('receiptTemplateService') ? { getReceiptTemplate: () => normalizeReceiptTemplate(), loadReceiptTemplate: async () => {} }
      : specifier.includes('receiptTemplateHtml') ? { default: () => '' }
      : specifier.includes('stampProgram') ? { readStampSummary: async () => {} }
      : { prepareReceiptLoyaltyUrl: async () => '' };
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context: ctx });
  });
  await module.evaluate();
  for (const source of ['grabfood', 'shopeefood', 'xanhngon', 'website']) {
    const order = { id: 'synthetic', sourceType: source === 'website' ? source : 'partner', partnerSource: source,
      platform: source, displayOrderCode: 'GF-1234F', createdAt: '2026-10-30T04:00:00Z',
      totalAmount: 0, expectedEarnPoints: 0, items: [{ name: 'Bánh tráng', quantity: 2,
        lineTotal: 0, options: ['Không cay', { label: 'Thêm trứng' }], note: 'Gói riêng' }] };
    for (const receiptWidthMm of [58, 80]) {
      const options = { receiptWidthMm, receiptTemplate: { brand: 'GÁNH HÀNG RONG', showCustomer: false } };
      assert.equal(JSON.stringify(buildPrintJobPayload(order, options)),
        JSON.stringify(module.namespace.buildPrintJobPayload(order, options)));
    }
  }
});

test('partner projection keeps line totals, nested options, codes and points', () => {
  const mapped = partnerReceiptOrder({ id: 'source', partner_source: 'grabfood', display_order_code: 'GF-113F',
    expected_earn_points: 3200, total_amount: 64000 }, [{ partner_item_name: 'Món', quantity: 2,
    unit_price: 10000, line_total: 16000, options: [{ name: 'Nhóm', items: [{ name: 'Không cay' }] }] }]);
  const payload = buildPrintJobPayload(mapped);
  assert.equal(payload.order.orderCode, 'GF-113F');
  assert.equal(payload.order.items[0].total, 16000);
  assert.equal(payload.order.items[0].price, 10000);
  assert.deepEqual(payload.order.items[0].options, ['Nhóm', 'Không cay']);
  assert.equal(payload.order.expectedEarnPoints, 3200);
});

test('renderer failure keeps the durable intent retryable and does not claim success', async () => {
  const calls = [];
  const client = { rpc: async (name, args) => {
    calls.push(name);
    if (name.endsWith('claim')) return { data: [{ order: { id: 'fake' }, items: [], printer_options: {} }] };
    return { data: null };
  } };
  assert.deepEqual(await dispatchPartnerAutoBills(client, 'owner'), { claimed: 1, enqueued: 0, failed: 1 });
  assert.deepEqual(calls, ['partner_auto_bill_claim', 'partner_auto_bill_retry']);
});
