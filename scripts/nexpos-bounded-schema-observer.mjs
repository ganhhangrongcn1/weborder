// Temporary authenticated observer. Render __GLOBAL_END__ before deployment;
// deploy the fixed 410 stub after the bounded run. No raw payload/IDs are stored.
import { createClient } from 'npm:@supabase/supabase-js@2';
const END = '__GLOBAL_END__';
const TOPICS = ['saas_print_bill', 'saas_notifications', 'saas_order_status_change'];
const reply = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
const isId = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\u0000-\u0020\u007f]/.test(value);
function candidates(data) {
  const result = [];
  const walk = (value, path, depth) => {
    if (!value || typeof value !== 'object' || depth > 4 || result.length >= 8) return;
    for (const [key, child] of Object.entries(value).slice(0, 48)) {
      if (!/^[A-Za-z_]{1,40}$/.test(key)) continue;
      const next = `${path}.${key}`;
      if (/^(order_id|order_ids|orderId|orderIds|order_uuid)$/.test(key)
        || (key === 'id' && /\.(order|orders)(\.|$)/.test(path))) {
        for (const id of (Array.isArray(child) ? child : [child]).slice(0, 4)) {
          if (isId(id)) result.push({ path: next, id });
        }
      }
      if (typeof child === 'object') walk(child, next, depth + 1);
      if (typeof child === 'string' && /^(payload|body|content|message)$/.test(key) && child.length < 65536) {
        try { walk(JSON.parse(child), next, depth + 1); } catch { /* Not JSON. */ }
      }
    }
  };
  walk(data, 'data', 0);
  return result.slice(0, 4);
}

Deno.serve(async request => {
  if (!Number.isFinite(Date.parse(END)) || Date.now() >= Date.parse(END)) return reply({ error: 'expired' }, 410);
  if (request.method !== 'POST') return reply({ error: 'method' }, 405);
  const client = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: control } = await client.from('nexpos_shadow_sync_control').select('cron_secret')
    .eq('control_key', 'nexpos_partner_orders').maybeSingle();
  if (!control?.cron_secret || request.headers.get('x-cron-secret') !== control.cron_secret) return reply({ error: 'unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return reply({ error: 'invalid' }, 400); }
  if (!/^[a-f0-9-]{36}$/.test(body.run_id || '')) return reply({ error: 'invalid' }, 400);
  const now = new Date().toISOString();
  const { data: run, error } = await client.from('nexpos_wss_inspection_runs')
    .update({ leased_until: new Date(Date.now() + 120000).toISOString() })
    .eq('id', body.run_id).eq('status', 'active').gt('expires_at', now)
    .or(`leased_until.is.null,leased_until.lt.${now}`).select('*').maybeSingle();
  if (error) return reply({ error: 'unavailable' }, 503);
  if (!run) return reply({ skipped: true });
  EdgeRuntime.waitUntil(observe(client, run, control.cron_secret));
  return reply({ accepted: true }, 202);
});

async function observe(client, run, secret) {
  let socket, timer, ping, messages = run.messages, captured = false;
  const observations = run.observations || [], checks = [];
  const save = async (status = 'active') => client.from('nexpos_wss_inspection_runs').update({
    status, messages, observations: observations.slice(0, 20),
    leased_until: null, completed_at: status === 'active' ? null : new Date().toISOString()
  }).eq('id', run.id);
  try {
    const { data: hubs } = await client.from('nexpos_shadow_hubs').select('nexpos_hub_id').eq('enabled', true).in('nexpos_hub_id', run.hubs);
    const allowed = (hubs || []).map(h => h.nexpos_hub_id);
    const { data: session } = await client.from('integration_sessions').select('session_value,expires_at')
      .eq('integration_key', 'nexpos_master_account').maybeSingle();
    const token = session?.session_value?.match(/(?:^|[,;]\s*)__token=([^;,\s]+)/)?.[1];
    if (!allowed.length || !token || Date.parse(session.expires_at) < Date.now() + 120000) throw new Error('session_unavailable');
    const finish = {};
    const ended = new Promise(resolve => { finish.resolve = resolve; });
    socket = new WebSocket('wss://saas-notification.nexpos.io/ws');
    timer = setTimeout(() => finish.resolve(), Math.max(0, Math.min(85000, Date.parse(run.expires_at) - Date.now())));
    ping = setInterval(() => { if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'ping' })); }, 30000);
    socket.onopen = () => socket.send(JSON.stringify({ access_token: token, topic: TOPICS.join(', ') }));
    socket.onclose = socket.onerror = () => finish.resolve();
    socket.onmessage = event => {
      messages++;
      if (typeof event.data !== 'string' || event.data.length > 131072 || checks.length + observations.length >= 20) return;
      let data;
      try { data = JSON.parse(event.data)?.data; } catch { return; }
      if (!data || !TOPICS.includes(data.topic)) return;
      const eventHubs = (Array.isArray(data.hub_ids) ? data.hub_ids : [data.hub_id]).filter(h => allowed.includes(h));
      if (!eventHubs.length) return;
      checks.push((async () => {
        const sample = { topic: data.topic, received_at: new Date().toISOString(),
          schema: Object.entries(data).filter(([field]) => /^[A-Za-z_]{1,40}$/.test(field)).slice(0, 24)
            .map(([field, value]) => ({ field, type: Array.isArray(value) ? 'array' : typeof value })),
          matches: [] };
        for (const c of candidates(data).slice(0, 2)) {
          const response = await fetch('https://saas-api.nexpos.io/v1/order-service/site/orders/' + encodeURIComponent(c.id), {
            headers: { Accept: 'application/json', Cookie: session.session_value }, signal: AbortSignal.timeout(5000)
          });
          if (!response.ok) continue;
          const detail = (await response.json())?.data;
          const hub = detail?.hub_id || detail?.nexpos_hub_id;
          if ((detail?.order_id || detail?.id) !== c.id || !eventHubs.includes(hub)) continue;
          const query = () => client.from('partner_orders').select('id,display_order_code,created_at,nexpos_status')
            .eq('nexpos_hub_id', hub).eq('nexpos_order_id', c.id).limit(2);
          let result = await query();
          for (const delay of [2000, 3000, 3000]) {
            if (result.data?.length) break;
            await new Promise(resolve => setTimeout(resolve, delay)); result = await query();
          }
          const order = result.data?.length === 1 ? result.data[0] : null;
          const fresh = Boolean(order && Date.parse(order.created_at) >= Date.parse(run.started_at));
          // Only a REST-verified identity is hashed; never store an unverified ID.
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(c.id));
          const idHash = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
          sample.matches.push({ path: c.path, hub, rest_verified: true, verified_id_sha256: idHash, db_unique: Boolean(order),
            display_code: order?.display_order_code, db_created_during_run: fresh,
            old_status: ['NEW','PENDING','CREATED','PRE_ORDER','DOING','PICK','FINISH','CANCEL'].includes(data.old_status) ? data.old_status : null });
          if (fresh && (data.topic !== 'saas_order_status_change' || ['NEW','PENDING','CREATED'].includes(data.old_status))) captured = true;
        }
        observations.push(sample);
        await client.from('nexpos_wss_inspection_runs').update({ observations: observations.slice(0, 20), messages }).eq('id', run.id);
        if (captured) finish.resolve();
      })().catch(() => {}));
    };
    await ended;
    try { socket.close(); } catch { /* Already closed. */ }
    await Promise.allSettled(checks);
    const status = captured ? 'captured' : Date.now() >= Date.parse(run.expires_at) || observations.length >= 20 ? 'finished' : 'active';
    await save(status);
    if (status === 'active' && Date.now() < Date.parse(END)) {
      await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/nexpos-event-schema-probe', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), 'x-cron-secret': secret },
        body: JSON.stringify({ run_id: run.id }), signal: AbortSignal.timeout(10000)
      });
    }
  } catch { await save('failed'); }
  finally { clearTimeout(timer); clearInterval(ping); try { socket?.close(); } catch { /* Already closed. */ } }
}
