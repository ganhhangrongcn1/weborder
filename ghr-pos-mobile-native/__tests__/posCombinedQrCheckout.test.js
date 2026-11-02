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

test('reuse authentication prepared in parallel without reading it again', async () => {
  supabase.functions.invoke.mockResolvedValue({data:{ok:true,session:{id:'session',source:'qr_order',order_id:'POS-TEST'}}});
  const result=await createPosPaymentSession({...input,authPreparation:Promise.resolve({ok:true,session:{
    access_token:'prepared-token',expires_at:Math.floor(Date.now()/1000)+3600}})});
  expect(result.ok).toBe(true);expect(supabase.auth.getSession).not.toHaveBeenCalled();
  expect(supabase.functions.invoke.mock.calls[0][1].headers.Authorization).toBe('Bearer prepared-token');
});

test('failed parallel authentication cannot create a payment session', async()=>{
  const result=await createPosPaymentSession({...input,authPreparation:Promise.resolve({ok:false,message:'sign in again'})});
  expect(result.ok).toBe(false);expect(supabase.functions.invoke).not.toHaveBeenCalled();
});

test('do not reuse prepared authentication that expired while validating benefits',async()=>{
  supabase.functions.invoke.mockResolvedValue({data:{ok:true,session:{id:'session',source:'qr_order',order_id:'POS-TEST'}}});
  const result=await createPosPaymentSession({...input,authPreparation:Promise.resolve({ok:true,session:{
    access_token:'old-prepared-token',expires_at:Math.floor(Date.now()/1000)-1}})});
  expect(result.ok).toBe(true);expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  expect(supabase.functions.invoke.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
});
