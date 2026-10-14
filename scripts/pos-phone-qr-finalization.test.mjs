import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from '../ghr-pos-mobile-native/node_modules/typescript/lib/typescript.js';

function context(path, extra = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import .*;\r?\n/gm, '');
  const sandbox = { Response, console, Deno: { env: { get: () => 'configured' }, serve() {} }, ...extra };
  vm.createContext(sandbox);
  vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), sandbox);
  return sandbox;
}

const branch = 'c0d35bd0-e614-4973-9eb2-17e78fb9a245';
async function confirm({ phone = true, amount = 4000, orderBranch = branch, missing = false, converted = true } = {}) {
  let sessionReads = 0, writes = 0, webhookCalls = 0;
  const session = { id: 'e9caaa84-db94-48f2-a0c0-1c1626eaa4df', source: 'web', order_id: 'fixture', branch_uuid: branch, amount_expected: 4000, payment_reference: 'FIXTURE-QR', status: 'pending_payment' };
  const db = { from(table) {
    const q = { select: () => q, eq: () => q, in: () => q, update: patch => { writes++; Object.assign(session, patch); return q; },
      maybeSingle: async () => ({ data: table === 'orders' ? (missing ? null : { metadata: { deviceMode: phone ? 'phone' : 'cashier' }, branch_uuid: orderBranch, total_amount: amount }) : { ...session, status: ++sessionReads > 1 && converted && phone ? 'converted' : session.status } }) };
    return q;
  } };
  const ctx = context('supabase/functions/pos-payment-session-api/index.ts', { fetch: async (_url, options) => {
    webhookCalls++;
    const body = JSON.parse(options.body);
    assert.equal(body.manualConfirmation, true);
    assert.equal(body.transferAmount, 4000);
    return new Response(JSON.stringify({ success: true, matched: true }));
  } });
  const result = await ctx.updateSession(db, { role: 'admin', name: 'Fixture' }, { session_id: session.id }, 'confirm_paid');
  return { status: result.status, writes, webhookCalls };
}
assert.deepEqual(await confirm(), { status: 200, writes: 0, webhookCalls: 1 });
assert.deepEqual(await confirm({ amount: 5000 }), { status: 409, writes: 0, webhookCalls: 0 });
assert.deepEqual(await confirm({ orderBranch: 'other' }), { status: 409, writes: 0, webhookCalls: 0 });
assert.deepEqual(await confirm({ missing: true }), { status: 502, writes: 0, webhookCalls: 0 });
assert.deepEqual(await confirm({ converted: false }), { status: 502, writes: 0, webhookCalls: 1 });
assert.deepEqual(await confirm({ phone: false }), { status: 200, writes: 1, webhookCalls: 0 });

// Existing paid QR must not be charged again when SePay delivers late.
const webhook = context('supabase/functions/sepay-pos-webhook/index.ts');
let writes = 0;
const already = await webhook.markPaymentSessionPaid({ from() { writes++; throw Error('unexpected write'); } },
  { id: 'fixture', status: 'converted' }, { transferAmount: 4000, payload: {} });
assert.equal(already.alreadyPaid, true);
assert.equal(writes, 0);
for (const row of [
  { status: 'cancelled', branch_uuid: branch, total_amount: 4000, metadata: { deviceMode: 'phone' } },
  { status: 'pending_payment', branch_uuid: 'other', total_amount: 4000, metadata: { deviceMode: 'phone' } },
  { status: 'preparing', branch_uuid: branch, total_amount: 4000, payment_method: 'cash', metadata: { deviceMode: 'phone', paymentStatus: 'paid' } }
]) {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row }) };
  const result = await webhook.markOrderPaidFromPaymentSession({ from: () => q }, { order_id: 'fixture', branch_uuid: branch }, { transferAmount: 4000 });
  assert.equal(result.ok, false);
}
console.log('10 phone QR routing, fail-closed and late-payment checks passed; no live writes.');
