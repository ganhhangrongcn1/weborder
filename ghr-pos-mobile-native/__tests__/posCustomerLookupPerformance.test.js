jest.mock('../src/services/supabase/client', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
import { supabase } from '../src/services/supabase/client';
import { lookupPosCustomerByPhone } from '../src/services/pos/posCustomerService';

let rows;
const phone = '0901234567';
beforeEach(() => {
  jest.clearAllMocks();
  rows = {
    profiles: [{ phone, name: 'Khách thử', registered: true }],
    loyalty_accounts: { total_points: 150, vouchers: [] },
    app_configs: { value: { maxRedemptionPercent: 30 } },
    orders: [], partner_orders: [], loyalty_ledger: []
  };
  supabase.from.mockImplementation((table) => {
    const query = { then: (resolve, reject) => Promise.resolve({ data: rows[table], error: null }).then(resolve, reject) };
    ['select', 'in', 'eq', 'order', 'limit', 'maybeSingle'].forEach((key) => { query[key] = () => query; });
    return query;
  });
  supabase.rpc.mockResolvedValue({ data: [{ total_orders: 4, total_spent: 200000, claimed_points: 20, pending_points: 10 }], error: null });
});

test('complete profile and summary skip all history without changing balance, name or rule', async () => {
  const result = await lookupPosCustomerByPhone('84901234567');
  expect(supabase.from.mock.calls.map(([table]) => table)).toEqual(['profiles', 'loyalty_accounts', 'app_configs']);
  expect(supabase.rpc).toHaveBeenCalledWith('get_customer_order_count_summary', { p_phone: phone });
  expect(result).toMatchObject({ ok: true, phone, customerName: 'Khách thử', registeredCustomer: true,
    loyalty: { totalPoints: 150 }, loyaltyRule: { maxRedemptionPercent: 30 },
    stats: { totalOrders: 4, totalSpent: 200000, claimedPoints: 20, pendingPoints: 10 } });
});

test('missing profile name still uses latest order name and avoids ledger when summary works', async () => {
  rows.profiles = [{ phone, registered: true }];
  rows.orders = [{ id: 'web', customer_name: 'Tên cũ', created_at: '2026-10-01' }];
  rows.partner_orders = [{ id: 'partner', customer_name: 'Tên mới', order_time: '2026-10-02' }];
  expect((await lookupPosCustomerByPhone(phone)).customerName).toBe('Tên mới');
  expect(supabase.from.mock.calls.filter(([table]) => table === 'partner_orders')).toHaveLength(2);
  expect(supabase.from).not.toHaveBeenCalledWith('loyalty_ledger');
});

test('summary failure retains legacy history and ledger fallback', async () => {
  supabase.rpc.mockResolvedValue({ data: null, error: { code: '57014' } });
  rows.orders = [{ id: 'web', status: 'completed', total_amount: 100000, points_earned: 10, created_at: new Date().toISOString() }];
  const result = await lookupPosCustomerByPhone(phone);
  expect(result.stats.totalOrders).toBe(1);
  expect(result.stats.totalSpent).toBe(100000);
  expect(supabase.from).toHaveBeenCalledWith('loyalty_ledger');
  expect(result.loyalty.totalPoints).toBe(150);
});

test('each lookup reads balance again instead of reusing a stale decision', async () => {
  await lookupPosCustomerByPhone(phone);
  rows.loyalty_accounts = { total_points: 0, vouchers: [{ code: 'USED', used: true }] };
  const result = await lookupPosCustomerByPhone(phone);
  expect(result.loyalty.totalPoints).toBe(0);
  expect(result.availableVouchers).toEqual([]);
  expect(supabase.from.mock.calls.filter(([table]) => table === 'loyalty_accounts')).toHaveLength(2);
});

test('invalid phone never queries the server', async () => {
  expect((await lookupPosCustomerByPhone('123')).ok).toBe(false);
  expect(supabase.from).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
});
