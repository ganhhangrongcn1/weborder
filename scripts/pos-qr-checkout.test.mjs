import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['supabase/functions/_shared/posQrCheckout.ts'],
  bundle: true, write: false, format: 'esm', platform: 'node' });
const { createPosQrCheckout } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const session = { id: 'session', source: 'qr_order', status: 'pending_payment', order_id: 'POS-TEST' };
const payload = { session: { source: 'pos', provider: 'sepay', payment_reference: 'POS-TEST',
  branch_uuid: 'branch', amount_expected: 25000 }, pending_order: { order: { id: 'POS-TEST',
  branch_uuid: 'branch', total_amount: 25000, status: 'pending_payment' }, items: [{ quantity: 1 }] } };

test('SePay and Pay2S combined checkout return QR only after atomic save/attach finishes', async () => {
  for (const provider of ['sepay', 'pay2s']) {
    let finish; const events = [];
    const response = createPosQrCheckout({ payload, reply,
      createSession: async () => { events.push('session'); return reply({ ok: true, session: { id: 'session', provider } }); },
      userClient: { rpc: async (name, args) => { events.push(name); assert.equal(args.p_session_id, 'session');
        await new Promise(resolve => { finish = resolve; }); return { data: { ...session, provider } }; } } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events, ['session', 'save_pos_qr_checkout']);
    finish();
    assert.equal((await (await response).json()).session.provider, provider);
  }
});

test('mismatched checkout is rejected before creating a session', async () => {
  const response = await createPosQrCheckout({ payload: { ...payload,
    pending_order: { ...payload.pending_order, order: { ...payload.pending_order.order, total_amount: 1 } } },
    reply, createSession: () => { throw Error('must not create'); } });
  assert.equal(response.status, 400);
});

test('failed session creation does not attempt order writes', async () => {
  const response = await createPosQrCheckout({ payload, reply,
    createSession: async () => reply({ ok: false, message: 'forbidden' }, 403),
    userClient: { rpc: () => { throw Error('must not write'); } } });
  assert.equal(response.status, 403);
});

test('ambiguous save response is retryable and never cancels a possibly committed checkout', async () => {
  for (const rpc of [async () => ({ error: { message: 'network' } }), async () => { throw Error('network'); }]) {
    const response = await createPosQrCheckout({ payload, reply,
      createSession: async () => reply({ ok: true, reused: true, session: { id: 'session' } }),
      userClient: { rpc }, serviceClient: { from: () => { throw Error('must not cancel'); } } });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
  }
});

test('definitive SQL error cancels only the newly created, still unattached pending session', async () => {
  const conditions = [];
  const q = { eq: (key, value) => { conditions.push([key, value]); return q; }, then: resolve => resolve({ error: null }) };
  const response = await createPosQrCheckout({ payload, reply,
    createSession: async () => reply({ ok: true, reused: false, session: { id: 'session' } }),
    userClient: { rpc: async () => ({ error: { code: 'P0001', message: 'validation failed' } }) },
    serviceClient: { from: () => ({ update: () => q }) } });
  assert.equal(response.status, 409);
  assert.deepEqual(conditions, [['id', 'session'], ['source', 'pos'], ['status', 'pending_payment']]);
});
