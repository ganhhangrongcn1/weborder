import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the real service bodies with fake adapters, without native device setup.
function loadService(file, dependencies, exports) {
  const source = fs.readFileSync(new URL(`../ghr-pos-mobile-native/src/services/pos/${file}`, import.meta.url), 'utf8')
    .replace(/^import\s+[\s\S]*?;\s*/gm, '')
    .replace(/export (async function|function)/g, '$1');
  const context = vm.createContext({ ...dependencies, Date, console });
  return vm.runInContext(`${source}\n;({${exports.join(',')}})`, context);
}

let rows;
let tables = [];
let summaryError = false;
const phone = '0901234567';
const supabase = {
  from(table) {
    tables.push(table);
    const query = { then: (resolve, reject) => Promise.resolve({ data: rows[table], error: null }).then(resolve, reject) };
    for (const key of ['select', 'in', 'eq', 'order', 'limit', 'maybeSingle', 'upsert', 'delete', 'insert']) query[key] = () => query;
    return query;
  },
  async rpc(name) {
    if (name === 'checkout_stamp_order') { giftWrites++; return { data: {}, error: null }; }
    return { data: [{ total_orders: 4, total_spent: 200000, claimed_points: 20, pending_points: 10 }], error: summaryError ? { code: '57014' } : null };
  }
};
const { lookupPosCustomerByPhone } = loadService('posCustomerService.js', { supabase }, ['lookupPosCustomerByPhone']);
rows = { profiles: [{ phone, name: 'Khách thử', registered: true }], loyalty_accounts: { total_points: 150, vouchers: [] }, app_configs: { value: { maxRedemptionPercent: 30 } }, orders: [], partner_orders: [], loyalty_ledger: [] };
let result = await lookupPosCustomerByPhone('84901234567');
assert.deepEqual(tables, ['profiles', 'loyalty_accounts', 'app_configs']);
assert.equal(result.phone, phone);
assert.equal(result.customerName, 'Khách thử');
assert.equal(result.stats.totalOrders, 4);
assert.equal(result.loyalty.totalPoints, 150);
assert.equal(result.loyaltyRule.maxRedemptionPercent, 30);
tables = [];
rows.profiles = [{ phone, registered: true }];
rows.orders = [{ id: 'web', customer_name: 'Tên cũ', created_at: '2026-10-01' }];
rows.partner_orders = [{ id: 'partner', customer_name: 'Tên mới', order_time: '2026-10-02' }];
result = await lookupPosCustomerByPhone(phone);
assert.equal(result.customerName, 'Tên mới');
assert.equal(tables.filter(x => x === 'partner_orders').length, 2);
assert.equal(tables.includes('loyalty_ledger'), false);
summaryError = true;
rows.orders = [{ id: 'web', status: 'completed', total_amount: 100000, points_earned: 10, created_at: new Date().toISOString() }];
rows.partner_orders = [];
result = await lookupPosCustomerByPhone(phone);
assert.equal(result.stats.totalOrders, 1);
assert.equal(result.stats.totalSpent, 100000);
assert.equal(tables.includes('loyalty_ledger'), true);
summaryError = false;
rows.loyalty_accounts = { total_points: 0, vouchers: [{ code: 'USED', used: true }] };
result = await lookupPosCustomerByPhone(phone);
assert.equal(result.loyalty.totalPoints, 0);
assert.equal(result.availableVouchers.length, 0);
tables = [];
assert.equal((await lookupPosCustomerByPhone('123')).ok, false);
assert.equal(tables.length, 0);

let stampReads = 0;
let loyaltyWrites = 0;
let giftWrites = 0;
const { createPosTakeawayOrderMobile } = loadService('posOrderService.js', {
  supabase, invalidatePosStamps() {},
  async readPosStamps() { stampReads++; return { enabled: true, available: 3 }; },
  async ensurePosGuestProfile() { return { ok: true }; },
  async applyPosOrderLoyaltyMobile() { loyaltyWrites++; },
  isLikelyPosNetworkError() { return false; },
  async queuePosOfflineOrder() {},
  createPosOrderIdentity() { throw new Error('Test must preserve supplied order identity'); }
}, ['createPosTakeawayOrderMobile']);
const bill = { cart: [{ id: 'test-product', name: 'Món thử', price: 25000, quantity: 1 }], totals: { subtotal: 25000, total: 25000 }, pagerNumber: '1', customerPhone: phone, orderIdentity: { orderCode: 'test-order', displayOrderCode: 'TEST' }, paymentMethod: 'bank_qr', paymentStatus: 'pending_payment' };
result = await createPosTakeawayOrderMobile(bill);
assert.equal(result.ok, true);
assert.equal(result.order.stampSummary, null);
assert.equal(stampReads, 0);
assert.equal(loyaltyWrites, 0);
result = await createPosTakeawayOrderMobile({ ...bill, paymentMethod: 'cash', paymentStatus: 'paid' });
assert.equal(result.ok, true);
assert.equal(result.order.stampSummary.available, 3);
assert.equal(stampReads, 1);
assert.equal(loyaltyWrites, 1);
result = await createPosTakeawayOrderMobile({ ...bill, cart: [...bill.cart, { id: 'gift', name: 'Quà thử', price: 0, quantity: 1, metadata: { stampGift: true, stampPhone: phone } }] });
assert.equal(result.ok, true);
assert.equal(giftWrites, 1);
assert.equal(stampReads, 1);
console.log('PASS: 8 POS service regression scenarios; no live requests or writes.');
