import grabCsrfHeaders from './csrf.ts';

const ORIGIN = 'https://api.grab.com';
const STATUS_PATH = '/food/merchant/v3/open-status';
const CLOSED = new Set([3,4,5,7,8]);
const PAUSED = new Map([[1,'TEMPPAUSED'],[2,'OPSPAUSED'],[6,'OPSPAUSED']]);

export function normalizeStoreStatus(payload, now = new Date().toISOString()) {
  const value = [payload?.data,payload?.result,payload].find(item=>
    item && typeof item === 'object' && ('isOpen' in item || 'closeReason' in item));
  if (!value || typeof value.isOpen !== 'boolean') throw new Error('GRAB_STORE_STATUS_INVALID');
  const closeReason = Number(value.closeReason || 0);
  return {state:value.isOpen ? (value.isMexInBusyMode === true ? 'BUSY' : 'NORMAL')
    : CLOSED.has(closeReason) ? 'CLOSED' : PAUSED.has(closeReason) ? 'PAUSED' : 'UNKNOWN',
    is_open:value.isOpen,is_busy:value.isMexInBusyMode === true,close_reason:closeReason,checked_at:now};
}

export function busyDecision(row, observed) {
  if (!row.sync_enabled || !row.busy_enabled) return 'disabled';
  if (observed.state === 'CLOSED' || observed.state === 'PAUSED') return 'closed';
  const previous = row.metadata?.grab_store_status;
  if (observed.state === 'NORMAL' && (previous?.state === 'BUSY' || previous?.normal_override_seen === true)
    && previous.auto_busy_enabled === true) return 'respect_staff_normal';
  if (observed.state === 'BUSY') return 'already_busy';
  return observed.state === 'NORMAL' ? 'apply_busy' : 'unknown';
}

async function readRow(client, id) {
  const {data,error} = await client.from('partner_review_sources').select('*').eq('id',id).maybeSingle();
  if (error || !data) throw new Error('STORE_SOURCE_READ_FAILED');
  return data;
}

async function updateRow(client, row, values) {
  const {data,error} = await client.from('partner_review_sources')
    .update({...values,updated_at:new Date().toISOString()}).eq('id',row.id)
    .eq('updated_at',row.updated_at).select('id').maybeSingle();
  if (error || !data) throw new Error('STORE_SOURCE_CHANGED');
}

// Always re-read permission before a real store write. Commands retain their
// existing requested_at identity; a newer staff command is never overwritten.
export default async function processStoreControl({client,source,getJar,requestFetch,reauth,readOnly=false}) {
  let row = await readRow(client,source.id);
  const ownsLease = current => current.metadata?.local_worker_lease_token === source.lease_token;
  if (!ownsLease(row)) throw new Error('STORE_LEASE_LOST');
  const request = async (path, method='GET', body, retried=false) => {
    const url = ORIGIN+path;
    const jar = getJar();
    const cookie = await jar.getCookieString(url);
    const result = await requestFetch(url,{method,redirect:'error',headers:{
      accept:'application/json, text/plain, */*',cookie,merchantid:source.merchant_id,
      origin:'https://merchant.grab.com',referer:'https://merchant.grab.com/',
      requestsource:'troyPortal','x-client-id':'GrabMerchant-Portal',
      'x-grabkit-clientid':'grabmerchant-portal',...grabCsrfHeaders(cookie,method),
      ...(body ? {'content-type':'application/json'} : {})
    },...(body ? {body:JSON.stringify(body)} : {})});
    for (const value of result.headers.getSetCookie?.() || []) await jar.setCookie(value,url);
    if (result.status===401 && !retried) {
      await reauth();
      return request(path,method,body,true);
    }
    if (!result.ok) throw new Error(`GRAB_STORE_HTTP_${result.status}`);
    return result.json();
  };
  let observed = normalizeStoreStatus(await request(STATUS_PATH));
  let commandResult = null;
  const stalledCommand = row.store_control_status==='running'
    && Date.now()-Date.parse(row.store_control_requested_at || '') > 120_000;
  const commandPending = !readOnly && (row.store_control_status==='pending' || stalledCommand)
    && ['busy','normal'].includes(row.store_control_action);
  if (commandPending) {
    const command = {action:row.store_control_action,at:row.store_control_requested_at};
    await updateRow(client,row,{store_control_status:'running',store_control_error:null});
    row = await readRow(client,source.id);
    try {
      commandResult = await apply(command.action);
      const fresh = await readRow(client,source.id);
      if (fresh.store_control_requested_at===command.at && ownsLease(fresh)) {
        await updateRow(client,fresh,{
          store_control_status:commandResult.applied || ['already_normal','already_busy'].includes(commandResult.reason) ? 'success' : 'error',
          store_control_finished_at:new Date().toISOString(),
          store_control_error:commandResult.applied || ['already_normal','already_busy'].includes(commandResult.reason) ? null : commandResult.reason,
          ...(command.action==='normal' ? {busy_enabled:false} : {}),
          metadata:{...fresh.metadata,last_store_control_result:commandResult}
        });
      }
    } catch (error) {
      const fresh = await readRow(client,source.id);
      if (fresh.store_control_requested_at===command.at && ownsLease(fresh)) {
        await updateRow(client,fresh,{store_control_status:'error',store_control_finished_at:new Date().toISOString(),
          store_control_error:/^[A-Z_0-9]+$/.test(error.message) ? error.message : 'STORE_COMMAND_FAILED'});
      }
      throw error;
    }
  }
  row = await readRow(client,source.id);
  if (!ownsLease(row)) throw new Error('STORE_LEASE_LOST');
  const decision = busyDecision(row,observed);
  let busyResult = {applied:false,reason:readOnly ? 'read_only' : decision};
  if (!readOnly && !commandPending && decision==='respect_staff_normal') {
    await updateRow(client,row,{busy_enabled:false,metadata:{...row.metadata,
      auto_busy_disabled_reason:'observed_normal_on_grab',auto_busy_disabled_at:new Date().toISOString()}});
  } else if (!readOnly && !commandPending && decision==='apply_busy') {
    busyResult = await apply('busy',true);
  }
  row = await readRow(client,source.id);
  if (!ownsLease(row)) throw new Error('STORE_LEASE_LOST');
  const snapshot = {...observed,auto_busy_enabled:row.busy_enabled===true,
    normal_override_seen:decision==='respect_staff_normal' && row.busy_enabled===true};
  await updateRow(client,row,{metadata:{...row.metadata,grab_store_status:snapshot,
    ...(!readOnly ? {last_busy_result:busyResult} : {})}});
  return {ok:true,observed:snapshot,busy_result:busyResult,command_result:commandResult};

  async function apply(action, automatic=false) {
    const fresh = await readRow(client,source.id);
    if (!ownsLease(fresh)) throw new Error('STORE_LEASE_LOST');
    if (automatic && (!fresh.sync_enabled || !fresh.busy_enabled
      || ['pending','running'].includes(fresh.store_control_status))) return {applied:false,reason:'permission_changed'};
    if (!automatic && (fresh.store_control_requested_at!==row.store_control_requested_at
      || fresh.store_control_action!==action)) return {applied:false,reason:'command_changed'};
    if (observed.state==='CLOSED' || (automatic && observed.state==='PAUSED') || observed.state==='UNKNOWN') {
      return {applied:false,reason:'closed_or_unknown'};
    }
    if ((action==='busy' && observed.state==='BUSY') || (action==='normal' && observed.state==='NORMAL')) {
      return {applied:false,reason:action==='busy' ? 'already_busy' : 'already_normal'};
    }
    const fromState = observed.state==='PAUSED' ? PAUSED.get(observed.close_reason) : observed.state;
    await request('/food/merchant/v1/merchant/status','PUT',{
      fromState,toState:action==='busy' ? 'BUSY' : 'NORMAL',
      busyModeRequest:action==='busy' ? {busyModeFoodPrepareTime:15,busyModeStartTime:null} : {},tempPauseRequest:{}
    });
    observed = normalizeStoreStatus(await request(STATUS_PATH));
    if (observed.state!==(action==='busy' ? 'BUSY' : 'NORMAL')) throw new Error('GRAB_STORE_STATUS_UNCONFIRMED');
    return {applied:true,action,fromState,...(action==='busy' ? {minutes:15} : {})};
  }
}
