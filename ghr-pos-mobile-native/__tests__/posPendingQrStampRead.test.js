/* global jest, beforeEach, test, expect */
jest.mock('../src/services/supabase/client', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../src/services/pos/posCustomerService', () => ({ ensurePosGuestProfile: jest.fn() }));
jest.mock('../src/services/pos/posStampService', () => ({ invalidatePosStamps: jest.fn(), readPosStamps: jest.fn() }));
jest.mock('../src/services/pos/posLoyaltyService', () => ({ applyPosOrderLoyaltyMobile: jest.fn() }));
jest.mock('../src/services/pos/posOfflineOrderQueueService', () => ({ isLikelyPosNetworkError: () => false, queuePosOfflineOrder: jest.fn() }));

import { supabase } from '../src/services/supabase/client';
import { ensurePosGuestProfile } from '../src/services/pos/posCustomerService';
import { readPosStamps } from '../src/services/pos/posStampService';
import { applyPosOrderLoyaltyMobile } from '../src/services/pos/posLoyaltyService';
import { createPosTakeawayOrderMobile } from '../src/services/pos/posOrderService';

const bill = {
  cart: [{ id: 'product-test', name: 'Món thử', price: 25000, quantity: 1 }],
  totals: { subtotal: 25000, total: 25000 }, pagerNumber: '1', customerPhone: '0901234567',
  orderIdentity: { orderCode: 'test-order', displayOrderCode: 'TEST' },
  paymentMethod: 'bank_qr', paymentStatus: 'pending_payment'
};
beforeEach(() => {
  jest.clearAllMocks();
  ensurePosGuestProfile.mockResolvedValue({ ok: true });
  readPosStamps.mockResolvedValue({ enabled: true, available: 3 });
  applyPosOrderLoyaltyMobile.mockResolvedValue({ ok: true });
  supabase.rpc.mockResolvedValue({ data: {}, error: null });
  supabase.from.mockImplementation(() => {
    const q = { then: (resolve, reject) => Promise.resolve({ error: null }).then(resolve, reject) };
    ['upsert', 'delete', 'eq', 'insert'].forEach((key) => { q[key] = () => q; });
    return q;
  });
});

test('pending QR saves order/items without waiting for display stamps or awarding points', async () => {
  readPosStamps.mockImplementation(() => new Promise(() => {}));
  const result = await createPosTakeawayOrderMobile(bill);
  expect(result.ok).toBe(true);
  expect(result.order.stampSummary).toBeNull();
  expect(supabase.from).toHaveBeenCalledWith('orders');
  expect(supabase.from).toHaveBeenCalledWith('order_items');
  expect(readPosStamps).not.toHaveBeenCalled();
  expect(applyPosOrderLoyaltyMobile).not.toHaveBeenCalled();
});

test('phone order uses atomic RPC, stays pending and neither writes separate items nor awards points', async () => {
  const result = await createPosTakeawayOrderMobile({ ...bill, phoneOrder: true, paymentMethod: 'cash', paymentStatus: 'unpaid' });
  expect(result.ok).toBe(true);
  expect(supabase.rpc).toHaveBeenCalledWith('create_pos_phone_order', expect.objectContaining({
    p_order: expect.objectContaining({ status: 'pending_payment', metadata: expect.objectContaining({ deviceMode: 'phone', paymentStatus: 'unpaid', paidAt: '' }) }),
    p_items: expect.any(Array), p_print_text: expect.any(String)
  }));
  expect(supabase.from).not.toHaveBeenCalled();
  expect(applyPosOrderLoyaltyMobile).not.toHaveBeenCalled();
  expect(readPosStamps).not.toHaveBeenCalled();
});

test('paid cash still reads stamps and applies loyalty', async () => {
  const result = await createPosTakeawayOrderMobile({ ...bill, paymentMethod: 'cash', paymentStatus: 'paid' });
  expect(result.ok).toBe(true);
  expect(result.order.stampSummary).toEqual({ enabled: true, available: 3 });
  expect(readPosStamps).toHaveBeenCalledWith(bill.customerPhone);
  expect(applyPosOrderLoyaltyMobile).toHaveBeenCalledTimes(1);
});

test('pending QR with a gift still uses authoritative stamp checkout', async () => {
  const result = await createPosTakeawayOrderMobile({ ...bill, cart: [
    ...bill.cart,
    { id: 'gift', name: 'Quà thử', price: 0, quantity: 1, metadata: { stampGift: true, stampPhone: bill.customerPhone } }
  ] });
  expect(result.ok).toBe(true);
  expect(supabase.rpc).toHaveBeenCalledWith('checkout_stamp_order', expect.objectContaining({ p_order: expect.any(Object), p_items: expect.any(Array) }));
  expect(readPosStamps).not.toHaveBeenCalled();
});
