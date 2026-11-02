import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const compiled = await build({ entryPoints: ['supabase/functions/_shared/posQrCheckout.ts'],bundle:true,write:false,format:'esm',platform:'node' });
const {createPosQrCheckout}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status});
const payload={session:{source:'pos',provider:'sepay',bank_account_snapshot:true,payment_reference:'POS-TEST',branch_uuid:'branch',amount_expected:25000},
  pending_order:{order:{id:'POS-TEST',branch_uuid:'branch',total_amount:25000,status:'pending_payment'},items:[{quantity:1}]}};
const profile={auth_user_id:'verified-user'};
const session={id:'session',source:'qr_order',order_id:'POS-TEST',status:'pending_payment'};
const resolveRoute=async()=>({provider:'pay2s',providerPayload:{bankTransfer:{accountNumber:'000001'}}});

test('one atomic RPC uses verified actor and server-selected account, waits for commit before returning QR',async()=>{
  let finish;let calls=0;
  const response=createPosQrCheckout({payload,profile,resolveRoute,reply,serviceClient:{rpc:async(name,args)=>{
    calls++;assert.equal(name,'create_pos_bank_checkout');assert.equal(args.p_actor,'verified-user');
    assert.equal(args.p_session.provider,'pay2s');assert.equal(args.p_session.provider_payload.bankTransfer.accountNumber,'000001');
    await new Promise(resolve=>{finish=resolve;});return {data:{session,reused:false}};
  }}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);finish();
  assert.equal((await (await response).json()).session.id,'session');
});
test('mismatched order is rejected before any database write',async()=>{
  const response=await createPosQrCheckout({payload:{...payload,pending_order:{...payload.pending_order,order:{...payload.pending_order.order,total_amount:1}}},profile,resolveRoute,reply});
  assert.equal(response.status,400);
});
test('routing failure blocks creation; SQL errors and ambiguous network replies do not run separate writes',async()=>{
  assert.equal((await createPosQrCheckout({payload,profile,reply,resolveRoute:async()=>{throw Error('offline');}})).status,503);
  for(const error of [{message:'network'},{code:'P0001',message:'invalid amount'}]){
    const response=await createPosQrCheckout({payload,profile,resolveRoute,reply,serviceClient:{
      rpc:async()=>({error}),from:()=>{throw Error('No separate writes after transaction');}}});
    assert.equal(response.status,error.code?409:503);
  }
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

test('with Pay2S live, old POS creates SePay while capable POS gets MB snapshot', async()=>{
  let handler;let inserted;
  const branch='22222222-2222-4222-8222-222222222222';
  globalThis.posCheckoutApiClient={auth:{getUser:async()=>({data:{user:{id:'operator'}}})},
    from:table=>{
      const q={select:()=>q,insert:row=>{inserted=row;return q;},single:async()=>({data:{id:'created',...inserted}}),
        maybeSingle:async()=>({data:table==='profiles'?{id:'operator',role:'staff',status:'active',branch_uuid:branch}:
          table==='branches'?{data:{paymentSettings:{pay2sMode:'live',pay2sBankBin:'970422',pay2sAccountNumber:'00123456789',pay2sAccountName:'TEST MB'}}}:null})};
      for(const key of ['eq','in','or','gt','limit','order'])q[key]=()=>q;return q;
    }};
  globalThis.Deno={env:{get:()=> 'test-config'},serve:fn=>{handler=fn;}};
  const compiled=await build({entryPoints:['supabase/functions/pos-payment-session-api/index.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'fake-client',setup(builder){
    builder.onResolve({filter:/^npm:@supabase/},()=>({path:'client',namespace:'mock'}));
    builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const createClient=()=>globalThis.posCheckoutApiClient;'}));
  }}]});
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}#legacy`);
  const body={action:'create',session:{payment_reference:'POS-TEST123',request_key:'test:legacy:123',provider:'sepay',source:'pos',
    branch_uuid:branch,pager_number:'01',amount_expected:25000,cart_snapshot:[{id:'test',quantity:1}],checkout_snapshot:{}}};
  const request=capability=>new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({
    ...body,session:{...body.session,bank_account_snapshot:capability}})});
  const legacy=await(await handler(request(false))).json();assert.equal(legacy.ok,true);assert.equal(legacy.session.provider,'sepay');
  const modern=await(await handler(request(true))).json();assert.equal(modern.ok,true);assert.equal(modern.session.provider,'pay2s');
  assert.equal(modern.session.provider_payload.bankTransfer.bankBin,'970422');
});
