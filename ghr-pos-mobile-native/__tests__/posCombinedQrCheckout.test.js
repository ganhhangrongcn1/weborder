/* global jest, test, expect, beforeEach */
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../src/services/supabase/client', () => ({ supabase: {
  auth: { getSession: jest.fn(), refreshSession: jest.fn() },
  functions: { invoke: jest.fn() }, realtime: { setAuth: jest.fn() }
} }));
import { supabase } from '../src/services/supabase/client';
import { createPosPaymentSession } from '../src/services/pos/posPaymentSessionService';
const input = { paymentReference: 'POS-TEST', pendingOrder: { order: { id: 'POS-TEST' }, items: [] } };
beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600 } } });
});
test('new cashier uses one combined call and preserves server bank snapshot', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: { ok: true, session: { id: 'session',
    payment_reference: 'POS-TEST', provider: 'pay2s', source: 'qr_order', order_id: 'POS-TEST',
    provider_payload: { bankTransfer: { bankBin: '970422' } } } } });
  const result = await createPosPaymentSession(input);
  expect(result.ok).toBe(true);
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  expect(supabase.functions.invoke.mock.calls[0][1].body.action).toBe('create_checkout');
  expect(result.session.providerPayload.bankTransfer.bankBin).toBe('970422');
});
test('never expose QR from an unattached combined response', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: { ok: true, session: { id: 'session', source: 'pos' } } });
  expect((await createPosPaymentSession(input)).ok).toBe(false);
});
