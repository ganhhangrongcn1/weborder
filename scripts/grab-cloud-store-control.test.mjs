import test from 'node:test';
import assert from 'node:assert/strict';
import processStoreControl,{busyDecision,normalizeStoreStatus} from '../supabase/functions/grab-vietsing-pilot/storeControl.ts';

function fixture({enabled=false,previous=null,state='NORMAL',command=null,statusCode=200,reauthResult=200}={}){
 let row={id:'source',updated_at:'0',sync_enabled:true,busy_enabled:enabled,
  store_control_status:command ? 'pending' : 'idle',store_control_action:command,
  store_control_requested_at:command ? 'request' : null,
  metadata:{local_worker_lease_token:'lease',...(previous ? {grab_store_status:previous} : {})}};
 const calls={puts:[],reauth:0};let currentState=state,now=0,requestStatus=statusCode;
 const client={from(){let mutation,filters=[];return {
  select(){return this;},eq(key,value){filters.push([key,value]);return this;},update(value){mutation=value;return this;},
  async maybeSingle(){if(mutation){if(!filters.every(([key,value])=>row[key]===value))return {data:null};row={...row,...mutation,updated_at:String(++now)};}
   return {data:structuredClone(row)};}
 };}};
 const options={client,source:{id:'source',merchant_id:'merchant',lease_token:'lease'},getJar:()=>({getCookieString:async()=> 'mexusers_authn_token_jti=test',setCookie:async()=>{}}),
  reauth:async()=>{calls.reauth++;requestStatus=reauthResult;},
  requestFetch:async(url,options)=>{
   assert.equal(options.headers.merchantid,'merchant');
   if(requestStatus!==200)return Response.json({}, {status:requestStatus});
   if(options.method==='PUT'){const body=JSON.parse(options.body);calls.puts.push(body);currentState=body.toState;return Response.json({});}
   return Response.json({isOpen:['BUSY','NORMAL'].includes(currentState),isMexInBusyMode:currentState==='BUSY',closeReason:currentState==='CLOSED' ? 3 : currentState==='PAUSED' ? 1 : 0});
  }};
 return {options,calls,row:()=>row};
}

test('manual switch from observed Busy to Normal disables automation without a PUT',async()=>{
 const f=fixture({enabled:true,previous:{state:'BUSY',auto_busy_enabled:true},state:'NORMAL'});
 const result=await processStoreControl(f.options);
 assert.equal(f.row().busy_enabled,false);assert.equal(f.calls.puts.length,0);
 assert.equal(result.observed.state,'NORMAL');assert.equal(f.row().metadata.auto_busy_disabled_reason,'observed_normal_on_grab');
});

test('newly enabled auto Busy applies 15 minute preparation and verifies the result',async()=>{
 const f=fixture({enabled:true});const result=await processStoreControl(f.options);
 assert.equal(f.calls.puts.length,1);assert.equal(f.calls.puts[0].busyModeRequest.busyModeFoodPrepareTime,15);
 assert.equal(result.observed.state,'BUSY');assert.equal(result.busy_result.applied,true);
});

test('disabled automation only observes the actual state',async()=>{
 const f=fixture();const result=await processStoreControl(f.options);
 assert.equal(f.calls.puts.length,0);assert.equal(result.observed.state,'NORMAL');
});

for(const state of ['CLOSED','PAUSED','BUSY'])test(`${state}: automatic control preserves the state without a PUT`,async()=>{
 const f=fixture({enabled:true,state});await processStoreControl(f.options);assert.equal(f.calls.puts.length,0);
});

test('read-only observation never switches a store',async()=>{
 const f=fixture({enabled:true});await processStoreControl({...f.options,readOnly:true});assert.equal(f.calls.puts.length,0);
});

test('explicit Normal command is acknowledged and disables automatic Busy',async()=>{
 const f=fixture({enabled:true,state:'BUSY',command:'normal'});await processStoreControl(f.options);
 assert.equal(f.row().busy_enabled,false);assert.equal(f.row().store_control_status,'success');assert.equal(f.calls.puts[0].toState,'NORMAL');
});

test('explicit Busy command is acknowledged even when already Busy',async()=>{
 const f=fixture({state:'BUSY',command:'busy'});await processStoreControl(f.options);
 assert.equal(f.row().store_control_status,'success');assert.equal(f.calls.puts.length,0);
});

test('401 renews the session once and resumes reading',async()=>{
 const f=fixture({statusCode:401});await processStoreControl(f.options);assert.equal(f.calls.reauth,1);assert.equal(f.calls.puts.length,0);
});

for(const statusCode of [403,429])test(`${statusCode} never triggers login or a store PUT`,async()=>{
 const f=fixture({statusCode,enabled:true});await assert.rejects(processStoreControl(f.options),new RegExp(`GRAB_STORE_HTTP_${statusCode}`));assert.equal(f.calls.reauth,0);assert.equal(f.calls.puts.length,0);
});

test('an invalid status cannot be treated as open',()=>{
 assert.throws(()=>normalizeStoreStatus({}),/INVALID/);
 assert.equal(busyDecision({sync_enabled:true,busy_enabled:true},{state:'UNKNOWN'}),'unknown');
});

test('a replaced lease prevents all remote operations',async()=>{
 const f=fixture({enabled:true});f.options.source.lease_token='other';await assert.rejects(processStoreControl(f.options),/LEASE_LOST/);assert.equal(f.calls.puts.length,0);
});

test('a read-only observation does not erase the staff override before the next control cycle',async()=>{
 const f=fixture({enabled:true,previous:{state:'BUSY',auto_busy_enabled:true}});
 await processStoreControl({...f.options,readOnly:true});assert.equal(f.row().busy_enabled,true);
 await processStoreControl(f.options);assert.equal(f.row().busy_enabled,false);assert.equal(f.calls.puts.length,0);
});
