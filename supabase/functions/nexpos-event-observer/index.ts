import { createClient } from 'npm:@supabase/supabase-js@2';
import { sanitizeReport, WORKER_ID } from './policy.mjs';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

// Own machine authentication: only a hash is stored in DB; no public enrollment endpoint.
// This function never invokes the importer and never writes orders.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const token = request.headers.get('x-worker-token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return reply({ error: 'unauthorized' }, 401);
  if (Number(request.headers.get('content-length') || 0) > 8192) return reply({ error: 'too_large' }, 413);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  try {
    const { data: worker, error } = await client.from('nexpos_event_workers')
      .select('worker_id,hub_ids,last_seen_at,last_bootstrap_at')
      .eq('worker_id', WORKER_ID).eq('token_sha256', tokenHash).eq('enabled', true)
      .gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error) throw error;
    if (!worker) return reply({ error: 'unauthorized' }, 401);
    const raw = await request.text();
    if (raw.length > 8192) return reply({ error: 'too_large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'invalid_json' }, 400); }
    const { data: hubs, error: hubError } = await client.from('nexpos_shadow_hubs')
      .select('nexpos_hub_id').eq('enabled', true).in('nexpos_hub_id', worker.hub_ids);
    if (hubError) throw hubError;
    const allowedHubs = (hubs || []).map(v => v.nexpos_hub_id);
    if (!allowedHubs.length) return reply({ error: 'no_enabled_hubs' }, 409);
    const now = new Date().toISOString();
    if (body.action === 'bootstrap') {
      const { data: claimed, error: claimError } = await client.from('nexpos_event_workers')
        .update({ last_bootstrap_at: now, updated_at: now })
        .eq('worker_id', WORKER_ID).eq('token_sha256', tokenHash).eq('enabled', true)
        .or(`last_bootstrap_at.is.null,last_bootstrap_at.lt.${new Date(Date.now() - 30_000).toISOString()}`)
        .select('worker_id').maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return reply({ error: 'rate_limited' }, 429);
      const { data: session, error: sessionError } = await client.from('integration_sessions')
        .select('session_value,expires_at').eq('integration_key', 'nexpos_master_account').maybeSingle();
      if (sessionError) throw sessionError;
      const accessToken = session?.session_value?.match(/(?:^|[,;]\s*)__token=([^;,\s]+)/)?.[1];
      const expiresAt = Date.parse(session?.expires_at || '');
      if (!accessToken || !Number.isFinite(expiresAt) || expiresAt < Date.now() + 300_000) {
        return reply({ error: 'source_session_unavailable' }, 503);
      }
      return reply({ access_token: accessToken, hub_ids: allowedHubs, mode: 'observe' });
    }
    if (body.action === 'report') {
      const report = sanitizeReport(body.report, allowedHubs);
      if (!report) return reply({ error: 'invalid_report' }, 400);
      const { data: saved, error: saveError } = await client.from('nexpos_event_workers')
        .update({ last_report: report, last_seen_at: now, updated_at: now })
        .eq('worker_id', WORKER_ID).eq('token_sha256', tokenHash).eq('enabled', true)
        .or(`last_seen_at.is.null,last_seen_at.lt.${new Date(Date.now() - 20_000).toISOString()}`)
        .select('worker_id').maybeSingle();
      if (saveError) throw saveError;
      return reply({ ok: Boolean(saved), mode: 'observe', hub_ids: allowedHubs }, saved ? 200 : 429);
    }
    return reply({ error: 'invalid_action' }, 400);
  } catch {
    return reply({ error: 'observer_unavailable' }, 503);
  }
});
