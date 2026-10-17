import { createClient } from 'npm:@supabase/supabase-js@2.105.3';
import createCollectors from './collectors.ts';
import { restoreSession, serializeSession, loginWithoutBrowser } from './session.ts';
import loginWithBrowserless from './browserless.ts';
import {allowLegacy400Diagnostic} from './diagnostics.ts';
import cloudAccount from './accounts.ts';
import processStoreControl from './storeControl.ts';
import syncConversionFunnel from './funnel.ts';

const response = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json; charset=utf-8'}
});

export default async function handle(request) {
  const secret = Deno.env.get('PARTNER_REVIEW_AUTOMATION_SECRET');
  if (!secret || request.headers.get('x-automation-secret') !== secret) return response({ok:false},401);
  if (request.method !== 'POST') return response({ok:false},405);
  const body = await request.json().catch(()=>null);
  if (!body || !['sync','store_sync','store_status','auth_probe','browserless_probe','browserless_check','provision_cron'].includes(body.action || 'sync')) return response({ok:false},400);
  const action = body.action || 'sync';
  const storeOnly = action === 'store_sync' || action === 'store_status';
  const accountKey = body.account_key ?? 'grab_vietsing';
  const account = cloudAccount(accountKey);
  if (!account) return response({ok:false,code:'CLOUD_ACCOUNT_NOT_ALLOWED'},400);
  const {sourceId:SOURCE_ID,merchantId:MERCHANT_ID} = account;
  const browserlessProbe = action === 'browserless_probe';
  const diagnostic = action === 'auth_probe' || browserlessProbe;
  // Fresh cloud login and both collectors were verified before enabling recovery.
  const browserlessToken = Deno.env.get('BROWSERLESS_API_TOKEN');
  if ((browserlessProbe || action === 'browserless_check') && !browserlessToken) return response({ok:false,action,code:'BROWSERLESS_NOT_CONFIGURED'},503);
  if (action === 'browserless_check') {
    const target = new URL('https://production-sfo.browserless.io/scrape');
    target.searchParams.set('token',browserlessToken);
    const result = await fetch(target,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({url:'https://example.com',elements:[{selector:'title'}]}),signal:AbortSignal.timeout(30_000)});
    await result.body?.cancel();
    return response({ok:result.ok,action,upstream_status:result.status});
  }
  const started = Date.now();
  const workerId = `supabase:${accountKey}:${crypto.randomUUID()}`;
  const url = Deno.env.get('SUPABASE_URL');
  const client = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {persistSession:false,autoRefreshToken:false}
  });
  if (action === 'provision_cron') {
    const {error} = await client.rpc('partner_review_store_secret',{
      p_secret:secret,p_name:'grab-vietsing-pilot-cron',p_description:'Private scheduler authentication for Vietsing pilot'
    });
    return response({ok:!error},error ? 500 : 200);
  }
  // All collection and persistence use the existing domain API and shared lease.
  const limitedFetch = async (url, options = {}) => {
    const remaining = 115_000 - (Date.now()-started);
    if (remaining < 1000) throw new Error('PILOT_TIME_BUDGET');
    return fetch(url, {...options, signal:AbortSignal.timeout(Math.min(20_000,remaining))});
  };
  const api = async (action, payload={}) => {
    const result = await limitedFetch(`${url}/functions/v1/partner-review-source-api`, {
      method:'POST',headers:{'content-type':'application/json','x-automation-secret':secret},
      body:JSON.stringify({action,...payload})
    });
    const data = await result.json().catch(()=>({}));
    if (!result.ok || !data.ok) throw new Error(`DOMAIN_API_${result.status}`);
    return data;
  };
  let source;
  let previousStatus = 'idle';
  let previousProbe;
  let committed = false;
  let reauthAttempted = false;
  let outcome;
  let funnel;
  try {
    const {data:before,error:readError} = await client.from('partner_review_sources')
      .select('sync_status,metadata').eq('id',SOURCE_ID).maybeSingle();
    if (readError || !before) throw new Error('PILOT_SOURCE_UNAVAILABLE');
    previousStatus = before.sync_status;
    previousProbe = action === 'sync' || storeOnly
      ? before.metadata?.supabase_browserless_reauth || before.metadata?.supabase_browserless_trial
      : before.metadata?.[browserlessProbe ? 'supabase_browserless_trial' : 'supabase_pilot_auth_probe'];
    const setupFailure = browserlessProbe && previousProbe?.auth?.code === 'BROWSERLESS_LOGIN_FAILED'
      && ['browserless','load_library','connect','create_context'].includes(previousProbe?.auth?.stage);
    const canAttemptLogin = setupFailure || (browserlessProbe && allowLegacy400Diagnostic(previousProbe)) || !previousProbe || (diagnostic && previousProbe.ok) ||
      Date.now()-Date.parse(previousProbe.at || '') >= 6*60*60*1000;
    if (diagnostic && !canAttemptLogin) {
      return response({ok:false,action,code:'AUTH_PROBE_COOLDOWN'},429);
    }
    // Claim exactly one allowlisted account; this does not run Marketing.
    source = (await api('automation_marketing_source', {account_key:accountKey,worker_id:workerId})).source;
    if (source?.id !== SOURCE_ID || source.merchant_id !== MERCHANT_ID) throw new Error('PILOT_SOURCE_MISMATCH');
    const bundle = await api('automation_credentials',{source_id:SOURCE_ID});
    const {session,jar:storedJar} = await restoreSession(bundle.credentials.session);
    const collectors = createCollectors(api,limitedFetch);
    let jar = storedJar;
    let auth = {ok:true,stage:'stored_session'};
    if (storeOnly) {
      const originalCookies = JSON.stringify((await serializeSession(jar,session)).cookies);
      const store = await processStoreControl({client,source,getJar:()=>jar,requestFetch:limitedFetch,
        readOnly:action==='store_status',reauth:async()=>{
          if (reauthAttempted || !canAttemptLogin) throw new Error('SESSION_EXPIRED_REAUTH_COOLDOWN');
          if (!browserlessToken) throw new Error('BROWSERLESS_NOT_CONFIGURED');
          reauthAttempted = true;
          auth = await loginWithBrowserless(bundle.credentials,browserlessToken);
          if (!auth.ok) throw new Error('SESSION_EXPIRED_REAUTH_REQUIRED');
          jar = auth.jar;
        }});
      const rotatedSession = await serializeSession(jar,session);
      if (reauthAttempted || JSON.stringify(rotatedSession.cookies)!==originalCookies) {
        await api('automation_session',{source_id:SOURCE_ID,worker_id:workerId,
          lease_token:source.lease_token,session:rotatedSession});
      }
      outcome = {ok:true,action,account_key:accountKey,...store,
        auth:{ok:true,stage:auth.stage},duration_ms:Date.now()-started};
      return response(outcome);
    }
    if (diagnostic) {
      auth = browserlessProbe
        ? await loginWithBrowserless(bundle.credentials,browserlessToken)
        : await loginWithoutBrowser(bundle.credentials,limitedFetch);
      if (!auth.ok) {
        outcome = {ok:false,action,auth:{ok:false,stage:auth.stage,status:auth.status,code:auth.code,reason:auth.reason,diagnostics:auth.diagnostics},existing_session_preserved:true};
        return response(outcome);
      }
      jar = auth.jar;
    }
    let feedback;
    let finance;
    try {
      feedback = await collectors.collectFeedbackDirect(null,source,jar);
      if (action !== 'auth_probe') finance = await collectors.collectFinanceSnapshots(null,MERCHANT_ID,SOURCE_ID,jar);
    } catch (error) {
      // 403 is permission denial, not evidence that re-login will help.
      if (error.code !== 'GRAB_SESSION_EXPIRED' || diagnostic) throw error;
      if (!canAttemptLogin) {
        outcome = {ok:false,action,code:'SESSION_EXPIRED_REAUTH_COOLDOWN'};
        return response(outcome);
      }
      if (!browserlessToken) throw new Error('BROWSERLESS_NOT_CONFIGURED');
      reauthAttempted = true;
      auth = await loginWithBrowserless(bundle.credentials,browserlessToken);
      if (!auth.ok) {
        outcome = {ok:false,action,code:'SESSION_EXPIRED_REAUTH_REQUIRED',auth};
        return response(outcome);
      }
      jar = auth.jar;
      feedback = await collectors.collectFeedbackDirect(null,source,jar);
      finance = await collectors.collectFinanceSnapshots(null,MERCHANT_ID,SOURCE_ID,jar);
    }
    if (action === 'auth_probe') {
      // Persist a newly authenticated jar only after it can read this merchant.
      await api('automation_session',{source_id:SOURCE_ID,worker_id:workerId,lease_token:source.lease_token,
        session:await serializeSession(jar,session)});
      outcome = {ok:true,action,auth:{ok:true,stage:'fresh_session_verified'},review_count:feedback.reviews.length};
      return response(outcome);
    }
    if (action === 'sync') {
      const collectFunnel = () => syncConversionFunnel({client,source,jar,requestFetch:(target,options)=>{
        // Reserve 25 seconds for persisting reviews/finance and releasing the lease.
        const remaining = 90_000 - (Date.now()-started);
        if (remaining < 1000) throw Object.assign(new Error('FUNNEL_DEFERRED'),{code:'FUNNEL_DEFERRED'});
        return fetch(target,{...options,signal:AbortSignal.timeout(Math.min(12000,remaining))});
      }});
      try {
        funnel = await collectFunnel();
      } catch (error) {
        if (error.code === 'GRAB_SESSION_EXPIRED' && !reauthAttempted && canAttemptLogin && browserlessToken && Date.now()-started < 50_000) {
          reauthAttempted = true;
          const renewed = await loginWithBrowserless(bundle.credentials,browserlessToken);
          if (renewed.ok) {
            auth = renewed;
            jar = renewed.jar;
            try { funnel = await collectFunnel(); }
            catch (retryError) { funnel = {ok:false,code:retryError.code || 'FUNNEL_REQUEST_FAILED',at:new Date().toISOString()}; }
          } else funnel = {ok:false,code:'FUNNEL_REAUTH_REQUIRED',at:new Date().toISOString()};
        } else funnel = {ok:false,code:error.code || 'FUNNEL_REQUEST_FAILED',at:new Date().toISOString()};
      }
    }
    const saved = await api('automation_reviews',{
      source_id:SOURCE_ID,worker_id:workerId,lease_token:source.lease_token,merchant_id:MERCHANT_ID,
      overview:feedback.overview,reviews:feedback.reviews,
      finance_snapshots:finance.snapshots,finance_transactions:finance.transactions,
      finance_detail_stats:finance.detailStats,
      finance_error:finance.detailStats.remaining ? 'PILOT_FINANCE_DETAILS_PENDING' : '',
      session:await serializeSession(jar,session),busy_result:{applied:false,reason:'cloud_pilot_no_store_control'}
    });
    committed = true;
    outcome = {ok:!finance.detailStats.remaining,action,worker_id:workerId,
      review_count:saved.upserted_count,finance_transactions:saved.finance_transaction_count,
      finance_snapshots:finance.snapshots.length,remaining:finance.detailStats.remaining || 0,
      auth:{ok:true,stage:auth.stage},funnel,duration_ms:Date.now()-started};
    return response(outcome);
  } catch (error) {
    // Do not return raw upstream bodies, passwords, session data or cookies.
    const code = /^[A-Z][A-Z0-9_]+$/.test(error.code || error.message || '')
      ? (error.code || error.message) : 'PILOT_REQUEST_FAILED';
    outcome = {ok:false,action,code,duration_ms:Date.now()-started};
    return response(outcome,502);
  } finally {
    if (source?.id === SOURCE_ID) {
      // Optimistic update preserves concurrent local-worker metadata.
      const {data:current} = await client.from('partner_review_sources')
        .select('metadata,updated_at').eq('id',SOURCE_ID).maybeSingle();
      if (current) {
        const metadata = {...current.metadata};
        if (funnel) metadata.grab_funnel_last_run = funnel;
        const ownsLease = metadata.local_worker_lease_token === source.lease_token;
        if (!committed && ownsLease) {
          delete metadata.local_worker_lease_token;
          delete metadata.local_worker_lease_owner;
          delete metadata.local_worker_lease_expires_at;
        }
        const resultKey = storeOnly ? 'supabase_store_last_run' : browserlessProbe ? 'supabase_browserless_trial'
          : action === 'auth_probe' ? 'supabase_pilot_auth_probe' : 'supabase_pilot_last_run';
        metadata[resultKey] = {
          ...outcome,at:new Date().toISOString()
        };
        if (reauthAttempted) {
          metadata.supabase_browserless_reauth = {...outcome,at:new Date().toISOString()};
        }
        if (action === 'sync' && outcome?.auth?.ok === false) {
          metadata.supabase_pilot_auth_probe = {...outcome,at:new Date().toISOString()};
        }
        // Do not overwrite the domain sync status for a diagnostic probe.
        const statusUpdate = !committed && ownsLease
          ? diagnostic || storeOnly ? {sync_status:previousStatus}
            : {sync_status:'failed',last_error:outcome?.code || 'PILOT_REQUEST_FAILED',
              ...(outcome?.code?.startsWith('SESSION_EXPIRED') ? {auth_status:'expired'} : {})}
          : {};
        await client.from('partner_review_sources').update({metadata,...statusUpdate,updated_at:new Date().toISOString()})
          .eq('id',SOURCE_ID).eq('updated_at',current.updated_at);
      }
    }
  }
}
Deno.serve(handle);
