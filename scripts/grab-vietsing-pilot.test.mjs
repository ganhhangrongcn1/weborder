import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import createCollectors from '../supabase/functions/grab-vietsing-pilot/collectors.ts';
import cloudAccount,{CLOUD_ACCOUNTS} from '../supabase/functions/grab-vietsing-pilot/accounts.ts';

const source = await readFile(new URL('../supabase/functions/grab-vietsing-pilot/session.ts',import.meta.url),'utf8');
const sessions = await import(`data:text/javascript;base64,${Buffer.from(source.replace(
  'npm:tough-cookie@6.0.0',import.meta.resolve('tough-cookie')
)).toString('base64')}`);

test('clean login stops on rate limiting before submitting the password',async()=>{
  let calls=0;
  const result=await sessions.loginWithoutBrowser({username:'test',password:'do-not-send'},async(url,options)=>{
    calls++;
    assert.ok(!options.body.includes('do-not-send'));
    assert.equal(options.headers.cookie,'');
    return Response.json({message:'rate limited'},{status:429});
  });
  assert.equal(calls,1);
  assert.equal(result.code,'GRAB_RATE_LIMITED');
  assert.ok(!JSON.stringify(result).includes('do-not-send'));
});

test('interactive challenge stops before password verification',async()=>{
  let calls=0;
  const result=await sessions.loginWithoutBrowser({username:'test',password:'secret'},async()=>{
    calls++;
    return Response.json({details:{challengeSessionID:'test',currentGeneratedChallenge:{challengeType:'OTP'}}});
  });
  assert.equal(calls,1);
  assert.equal(result.ok,false);
});

test('cookie conversion preserves host-only scope and round-trips the session',async()=>{
  const {jar}=await sessions.restoreSession({cookies:[
    {name:'host',value:'a',domain:'api.grab.com',path:'/',secure:true},
    {name:'shared',value:'b',domain:'.grab.com',path:'/',secure:true}
  ]});
  const serialized=await sessions.serializeSession(jar,{storage:{example:'preserved'}});
  assert.equal(serialized.cookies.find(c=>c.name==='host').domain,'api.grab.com');
  const restored=await sessions.restoreSession(serialized);
  assert.equal(await restored.jar.getCookieString('https://api.grab.com/'),'host=a; shared=b');
  assert.equal(await restored.jar.getCookieString('https://merchant.grab.com/'),'shared=b');
  assert.equal(serialized.storage.example,'preserved');
});

test('permission denial never becomes session expiry',async()=>{
  const {jar}=await sessions.restoreSession({cookies:[{name:'mexusers_authn_token_jti',value:'test',domain:'.grab.com',path:'/'}]});
  const collectors=createCollectors(()=>assert.fail('no persistence'),async()=>Response.json({}, {status:403}));
  await assert.rejects(collectors.collectFeedbackDirect(null,{merchant_id:'test'},jar),
    error=>error.code==='GRAB_REQUEST_FORBIDDEN');
});

test('expired session is classified for the recovery path',async()=>{
  const {jar}=await sessions.restoreSession({cookies:[{name:'mexusers_authn_token_jti',value:'test',domain:'.grab.com',path:'/'}]});
  const collectors=createCollectors(()=>{},async()=>Response.json({}, {status:401}));
  await assert.rejects(collectors.collectFeedbackDirect(null,{merchant_id:'test'},jar),
    error=>error.code==='GRAB_SESSION_EXPIRED');
});

test('finance only classifies 401 as session expiry',async()=>{
  const {jar}=await sessions.restoreSession({cookies:[]});
  for (const status of [401,403]) {
    const collectors=createCollectors(()=>assert.fail('no persistence'),async()=>Response.json({}, {status}));
    await assert.rejects(collectors.collectFinanceSnapshots(null,'merchant','source',jar),
      error=>error.code===(status===401 ? 'GRAB_SESSION_EXPIRED' : 'GRAB_REQUEST_FORBIDDEN'));
  }
});

test('function denies unauthenticated requests before constructing a database client',async()=>{
  let code=await readFile(new URL('../supabase/functions/grab-vietsing-pilot/index.ts',import.meta.url),'utf8');
  code=code.replace(/^import .*;\r?\n/gm,'');
  code=code.replace('Deno.serve(handle);','');
  code='const Deno={env:{get:()=>"expected-secret"}}; const createClient=()=>{throw Error("Database accessed")};\n'+code;
  const {default:handle}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const result=await handle(new Request('https://example.test',{method:'POST',body:'{"action":"provision_cron"}'}));
  assert.equal(result.status,401);
});

for (const [accountKey,binding] of Object.entries(CLOUD_ACCOUNTS)) for (const expired of [true,false]) test(`${accountKey}: ${expired ? 'expired' : 'valid'} session saves only its own data`,async()=>{
  let code=await readFile(new URL('../supabase/functions/grab-vietsing-pilot/index.ts',import.meta.url),'utf8');
  code=code.replace(/^import .*;\r?\n/gm,'').replace('Deno.serve(handle);','');
  const calls={login:0,reviews:0,finance:0,funnel:0,saved:null};
  const sourceRow={id:binding.sourceId,merchant_id:binding.merchantId,lease_token:'lease'};
  const query={select(){return this;},eq(){return this;},update(){return this;},
    async maybeSingle(){return {data:{sync_status:'success',metadata:{local_worker_lease_token:'lease'},updated_at:'test'}};}};
  const deps={
    cloudAccount,
    syncConversionFunnel:async({source,jar})=>{assert.equal(source.id,binding.sourceId);assert.equal(jar,'fresh');calls.funnel++;return {ok:true,rows:16};},
    Deno:{env:{get:name=>name==='SUPABASE_URL' ? 'https://example.test' : 'test-secret'}},
    createClient:()=>({from:()=>query}),
    restoreSession:async()=>({session:{},jar:expired ? 'expired' : 'fresh'}),serializeSession:async jar=>({jar}),
    loginWithBrowserless:async()=>{calls.login++;return {ok:true,jar:'fresh',stage:'browserless_fresh_session'};},
    loginWithoutBrowser:()=>assert.fail('API-only login must not run'),allowLegacy400Diagnostic:()=>false,
    createCollectors:()=>({
      async collectFeedbackDirect(page,source,jar){calls.reviews++;if(jar==='expired')throw Object.assign(Error('expired'),{code:'GRAB_SESSION_EXPIRED'});return {reviews:[{}],overview:{}};},
      async collectFinanceSnapshots(page,merchant,source,jar){assert.equal(jar,'fresh');calls.finance++;return {snapshots:[{},{}],transactions:[],detailStats:{remaining:0}};}
    }),
    fetch:async(url,options)=>{
      const body=JSON.parse(options.body);let result={ok:true};
      if(body.action==='automation_marketing_source'){assert.equal(body.account_key,accountKey);result.source=sourceRow;}
      if(body.action==='automation_credentials')result.credentials={session:{},username:'fake',password:'fake'};
      if(body.action==='automation_reviews'){calls.saved=body;result={ok:true,upserted_count:1,finance_transaction_count:0};}
      return Response.json(result);
    }
  };
  const key=`__cloudRecoveryTest_${accountKey}_${expired}`;globalThis[key]=deps;
  try{
    const prefix=`const {${Object.keys(deps).join(',')}}=globalThis.${key};\n`;
    const {default:handle}=await import(`data:text/javascript;base64,${Buffer.from(prefix+code).toString('base64')}`);
    const result=await handle(new Request('https://example.test',{method:'POST',headers:{'x-automation-secret':'test-secret'},body:JSON.stringify({action:'sync',account_key:accountKey})}));
    const outcome=await result.json();
    assert.equal(outcome.ok,true);assert.equal(outcome.funnel.ok,true);assert.equal(calls.funnel,1);
    assert.equal(calls.login,expired ? 1 : 0);assert.equal(calls.reviews,expired ? 2 : 1);assert.equal(calls.finance,1);
    assert.equal(calls.saved.session.jar,'fresh');assert.equal(calls.saved.finance_snapshots.length,2);
    assert.equal(calls.saved.source_id,binding.sourceId);assert.equal(calls.saved.merchant_id,binding.merchantId);
  }finally{delete globalThis[key];}
});

test('unknown accounts cannot enter the cloud worker allowlist',()=>{
  assert.equal(cloudAccount('unknown'),null);
  assert.equal(cloudAccount('__proto__'),null);
  assert.equal(cloudAccount({toString:'invalid'}),null);
  assert.equal(cloudAccount(),CLOUD_ACCOUNTS.grab_vietsing);
});
