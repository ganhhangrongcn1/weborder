import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sessionSource = (await readFile(new URL('../supabase/functions/grab-vietsing-pilot/session.ts',import.meta.url),'utf8'))
  .replace('npm:tough-cookie@6.0.0',import.meta.resolve('tough-cookie'));
const sessionUrl = `data:text/javascript;base64,${Buffer.from(sessionSource).toString('base64')}`;
const diagnosticSource=await readFile(new URL('../supabase/functions/grab-vietsing-pilot/diagnostics.ts',import.meta.url),'utf8');
const diagnosticUrl=`data:text/javascript;base64,${Buffer.from(diagnosticSource).toString('base64')}`;
const {safeGrabMessage,loginResponseDiagnostic,isCriticalLoginPath,allowLegacy400Diagnostic}=await import(diagnosticUrl);
const browserSource = (await readFile(new URL('../supabase/functions/grab-vietsing-pilot/browserless.ts',import.meta.url),'utf8'))
  .replace('./session.ts',sessionUrl).replace('./diagnostics.ts',diagnosticUrl);
const {default:login,browserlessEndpoint,classifyBrowserLogin} = await import(
  `data:text/javascript;base64,${Buffer.from(browserSource).toString('base64')}`
);

test('missing key cannot start a browser connection',async()=>{
  let connected=false;
  await assert.rejects(login({username:'test',password:'test'},'',{
    connect:async()=>{connected=true;}
  }),/BROWSERLESS_NOT_CONFIGURED/);
  assert.equal(connected,false);
});

test('trial uses the fixed standard endpoint with a 90 second maximum',()=>{
  const url = new URL(browserlessEndpoint('sample'));
  assert.equal(url.hostname,'production-sfo.browserless.io');
  assert.equal(url.protocol,'wss:');
  assert.equal(url.searchParams.get('timeout'),'90000');
  assert.equal(url.searchParams.has('proxy'),false);
});

test('rate limiting and interactive verification stop the attempt',()=>{
  assert.equal(classifyBrowserLogin(429),'GRAB_RATE_LIMITED');
  assert.equal(classifyBrowserLogin(403),'GRAB_LOGIN_REJECTED');
  assert.equal(classifyBrowserLogin(0,'Enter verification code'),'GRAB_INTERACTIVE_AUTH_REQUIRED');
});

test('connection errors never disclose the token or credentials',async()=>{
  const result=await login({username:'private-account',password:'private-password'},'private-token',{
    connect:async()=>{throw Error('wss://example/?token=private-token');}
  });
  assert.equal(result.ok,false);
  assert.ok(!JSON.stringify(result).includes('private-'));
});

test('remote browser and isolated context close after a failed login',async()=>{
  let contextClosed=false,browserClosed=false;
  const page={
    setDefaultTimeout(){},on(){},async goto(){throw Error('Page unavailable');}
  };
  const result=await login({username:'test',password:'test'},'sample',{
    connect:async()=>({
      async createBrowserContext(){return {
        async newPage(){return page;},async close(){contextClosed=true;}
      };},
      async close(){browserClosed=true;}
    })
  });
  assert.equal(result.ok,false);
  assert.equal(contextClosed,true);
  assert.equal(browserClosed,true);
});

test('diagnostics redact credentials and tokens and omit payload values',()=>{
  const credentials={username:'private@example.com',password:'private-pass'};
  const result=loginResponseDiagnostic('https://api.grab.com/grabid/v1/authnv4/login',400,
    {message:'private@example.com private-pass abcdefghijklmnopqrstuvwxyz123456',code:400},
    {accountIdentifier:credentials.username,payload:{code:credentials.password}},credentials);
  const encoded=JSON.stringify(result);
  assert.ok(!encoded.includes(credentials.username));
  assert.ok(!encoded.includes(credentials.password));
  assert.ok(!encoded.includes('abcdefghijklmnopqrstuvwxyz123456'));
  assert.match(safeGrabMessage('other@example.com'),/\[email\]/);
});

test('an unrelated profile failure is not a password verification failure',()=>{
  assert.equal(isCriticalLoginPath('https://api.grab.com/grabid/v1/me/profile'),false);
  assert.equal(isCriticalLoginPath('https://api.grab.com/grabid/v1/authnv4/login'),true);
});

test('only the legacy 400 can receive one instrumented diagnostic attempt',()=>{
  const previous={at:'2026-10-16T02:00:00Z',auth:{status:400,code:'GRAB_BROWSER_LOGIN_INCOMPLETE'}};
  const now=Date.parse('2026-10-16T02:02:00Z');
  assert.equal(allowLegacy400Diagnostic(previous,now),true);
  assert.equal(allowLegacy400Diagnostic({...previous,auth:{...previous.auth,diagnostics:{revision:1}}},now),false);
  assert.equal(allowLegacy400Diagnostic({...previous,auth:{status:429,code:'GRAB_RATE_LIMITED'}},now),false);
  const unsent={...previous,auth:{...previous.auth,diagnostics:{revision:1,network:[{
    path:'/grabid/v1/authnv4/login',status:400,challenge_type:'PWD_V2'
  }]}}};
  assert.equal(allowLegacy400Diagnostic(unsent,now),true);
  assert.equal(allowLegacy400Diagnostic({...unsent,auth:{...unsent.auth,status:undefined,
    code:'BROWSERLESS_LOGIN_FAILED'}},now),true);
  assert.equal(allowLegacy400Diagnostic({...unsent,auth:{...unsent.auth,
    diagnostics:{...unsent.auth.diagnostics,revision:5}}},now),false);
  const detached={...unsent,auth:{...unsent.auth,stage:'password',code:'BROWSERLESS_LOGIN_FAILED',
    diagnostics:{...unsent.auth.diagnostics,revision:5,password_submitted:false,client_error:'Node is detached from document'}}};
  assert.equal(allowLegacy400Diagnostic(detached,now),true);
  assert.equal(allowLegacy400Diagnostic({...detached,auth:{...detached.auth,diagnostics:{...detached.auth.diagnostics,password_submitted:true}}},now),false);
});

test('PWD_V2 challenge followed by Continue issues a fresh session',async()=>{
  let listener,submitted=false;
  const emit=(status,body,requestBody)=>listener({
    url:()=> 'https://api.grab.com/grabid/v1/authnv4/login',status:()=>status,
    request:()=>({method:()=> 'POST',postData:()=>JSON.stringify(requestBody)}),
    json:async()=>body
  });
  const username={async type(){},async press(){
    emit(400,{details:{challengeSessionID:'example',currentGeneratedChallenge:{challengeType:'PWD_V2'}}},{});
  }};
  const password={async click(){},async type(){},async press(){assert.fail('Enter must not submit this password screen');}};
  const button={async evaluate(fn){return fn({textContent:'Continue',disabled:false,getClientRects:()=>[{}]});},
    async click(){submitted=true;emit(200,{isCompleted:true},{challengeSessionID:'example'});}};
  const page={setDefaultTimeout(){},on(event,fn){listener=fn;},async goto(){},
    async evaluate(){return {password_present:true,buttons:[]};},
    locator(){return {async fill(){}};},
    async waitForSelector(selector){return selector.includes("type='password'") ? password : username;},
    async waitForFunction(){},async $$(){return [button];},async waitForNavigation(){}
  };
  const result=await login({username:'test',password:'test'},'sample',{
    connect:async()=>({async createBrowserContext(){return {
      async newPage(){return page;},async close(){},async cookies(){return submitted ? [{
        name:'mexusers_authn_token',value:'test-cookie',domain:'.grab.com',path:'/'
      }] : [];}
    };},async close(){}})
  });
  assert.equal(result.ok,true);
  assert.equal(submitted,true);
  assert.equal(result.diagnostics.network[0].challenge_type,'PWD_V2');
});
