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

test('v2 sends benefit intent without CRM snapshots and returns one saved session',async()=>{
  supabase.functions.invoke.mockResolvedValue({data:{ok:true,session:{id:'session',source:'qr_order',order_id:'POS-TEST'}}});
  const result=await createPosPaymentSession({...input,serverBenefits:true,benefitIntent:{pointsRequested:9000},
    checkout:{customerLookup:{phone:'0900000099',history:'private'},pointsDiscount:9000},
    pendingOrder:{order:{id:'POS-TEST',metadata:{customerLookup:{history:'private'},pointsSpent:9000}},items:[]}});
  expect(result.ok).toBe(true);expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  const body=supabase.functions.invoke.mock.calls[0][1].body;
  expect(body.action).toBe('create_checkout_v2');expect(body.benefit_intent.pointsRequested).toBe(9000);
  expect(body.session.checkout_snapshot.customerLookup).toBeUndefined();
  expect(body.pending_order.order.metadata.customerLookup).toBeUndefined();
  expect(body.pending_order.order.metadata.pointsSpent).toBe(9000);
});

test('v2 propagates changed-benefit quote without silently retrying or exposing QR',async()=>{
  supabase.functions.invoke.mockResolvedValue({error:{context:{status:409,clone:()=>({json:async()=>({
    ok:false,code:'benefits_changed',message:'confirm amount',quote:{total:20000,pointsSpent:5000}})})}}});
  const result=await createPosPaymentSession({...input,serverBenefits:true,benefitIntent:{pointsRequested:9000}});
  expect(result.ok).toBe(false);expect(result.session).toBeUndefined();
  expect(result.code).toBe('benefits_changed');expect(result.quote.total).toBe(20000);
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});

test('do not reuse prepared authentication that expired while validating benefits',async()=>{
  supabase.functions.invoke.mockResolvedValue({data:{ok:true,session:{id:'session',source:'qr_order',order_id:'POS-TEST'}}});
  const result=await createPosPaymentSession({...input,authPreparation:Promise.resolve({ok:true,session:{
    access_token:'old-prepared-token',expires_at:Math.floor(Date.now()/1000)-1}})});
  expect(result.ok).toBe(true);expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  expect(supabase.functions.invoke.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
});
