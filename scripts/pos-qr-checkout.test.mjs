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
      createSession: async (input) => { assert.equal(input.checkout_snapshot.combinedCheckout, true);
        events.push('session'); return reply({ ok: true, session: { id: 'session', provider } }); },
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

test('read and recovery list hide combined sessions until their order is attached; legacy remains available', async () => {
  let handler;
  const id='11111111-1111-4111-8111-111111111111';
  const branch='22222222-2222-4222-8222-222222222222';
  const pending={ id, provider:'sepay', branch_uuid:branch, source:'pos', status:'pending_payment',
    checkout_snapshot:{ combinedCheckout:true } };
  const legacy={ ...pending, id:'legacy', checkout_snapshot:{} };
  const attached={ ...pending, id:'attached', source:'qr_order', order_id:'POS-TEST' };
  globalThis.posCheckoutApiClient={
    auth:{ getUser:async()=>({data:{user:{id:'operator'}}}) },
    from:(table)=>{
      let columns='';
      const q={ select:(value)=>{columns=value;return q;}, maybeSingle:async()=>({data:table==='profiles'
        ?{ id:'operator',role:'staff',status:'active',branch_uuid:branch }:pending}),
      then:(resolve,reject)=>Promise.resolve({data:columns==='id,order_id,payment_reference'?[]:[pending,legacy,attached]}).then(resolve,reject) };
      for(const key of ['eq','in','lt','order','limit','update']) q[key]=()=>q;
      return q;
    }
  };
  globalThis.Deno={env:{get:()=> 'test-config'},serve:fn=>{handler=fn;}};
  const api=await build({entryPoints:['supabase/functions/pos-payment-session-api/index.ts'],bundle:true,
    write:false,format:'esm',platform:'node',plugins:[{name:'fake-client',setup(builder){
      builder.onResolve({filter:/^npm:@supabase/},()=>({path:'client',namespace:'mock'}));
      builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const createClient=()=>globalThis.posCheckoutApiClient;'}));
    }}]});
  await import(`data:text/javascript;base64,${Buffer.from(api.outputFiles[0].contents).toString('base64')}`);
  const request=body=>new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)});
  assert.equal((await handler(request({action:'read',session_id:id}))).status,409);
  const listed=await (await handler(request({action:'list',branch_uuid:branch}))).json();
  assert.deepEqual(listed.sessions.map(row=>row.id),['legacy','attached']);
});
