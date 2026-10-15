import { createClient } from 'npm:@supabase/supabase-js@2.105.3';
import { probeAnalyDelivery } from '../_shared/analy-delivery-probe.mjs';
import { isAnalyFingerprintRequest, isAnalyServerRequest } from '../_shared/analy-auth.mjs';
import { AnalyError, createAnalySession } from '../_shared/analy-session.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-analy-server-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const key = 'analy_master_account';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ ok: false, code: 'method_not_allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    let namedKeys: Record<string, string> = {};
    try { namedKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); } catch { /* Use legacy key below. */ }
    const secret = typeof namedKeys.default === 'string' && namedKeys.default.startsWith('sb_secret_')
      ? namedKeys.default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !secret) return reply({ ok: false, code: 'server_not_configured' }, 503);
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const bearer = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    // Dashboard tests and trusted backend callers use the exact server key.
    // Never trust a decoded JWT role claim to grant this access.
    const serverRequest = isAnalyServerRequest(request.headers, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
      || await isAnalyFingerprintRequest(request.headers, Deno.env.get('ANALY_SERVER_KEY_SHA256') || '');
    if (!serverRequest) {
      if (!bearer) return reply({ ok: false, code: 'unauthorized' }, 401);
      const { data: auth, error: authError } = await db.auth.getUser(bearer);
      if (authError || !auth.user) return reply({ ok: false, code: 'unauthorized' }, 401);
      const { data: profile, error: profileError } = await db.from('profiles').select('role,status')
        .eq('auth_user_id', auth.user.id).maybeSingle();
      if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') {
        return reply({ ok: false, code: 'forbidden' }, 403);
      }
    }
    const body = await request.json().catch(() => null);
    if (!body || !['status', 'connect', 'check_api'].includes(body.action)) return reply({ ok: false, code: 'invalid_action' }, 400);
    const credentials = () => ({ username: Deno.env.get('ANALY_USERNAME')?.trim() || '',
      password: Deno.env.get('ANALY_PASSWORD') || '',
      deviceId: Deno.env.get('ANALY_DEVICE_ID')?.trim() || `ghr-analy-${new URL(url).hostname.split('.')[0]}` });
    const identity = `${credentials().username.toLowerCase()}\n${credentials().deviceId}`;
    const identityBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
    const accountFingerprint = Array.from(new Uint8Array(identityBytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    const store = {
      async read() {
        const { data, error } = await db.from('integration_sessions').select('session_value').eq('integration_key', key).maybeSingle();
        if (error) throw new AnalyError('session_store_unavailable', 503);
        if (!data) return null;
        try {
          const value = JSON.parse(data.session_value);
          return value.accountFingerprint === accountFingerprint ? value : null;
        } catch { throw new AnalyError('invalid_stored_session', 503); }
      },
      async write(value: { expiresAt?: number; retryAt?: number }) {
        const { error } = await db.from('integration_sessions').upsert({ integration_key: key,
          session_value: JSON.stringify({ ...value, accountFingerprint }), expires_at: new Date(value.expiresAt || value.retryAt || Date.now()).toISOString(),
          updated_at: new Date().toISOString() }, { onConflict: 'integration_key' });
        if (error) throw new AnalyError('session_store_unavailable', 503);
      },
      async acquire() {
        const lockKey = `${key}_lease`;
        const holder = crypto.randomUUID();
        const current = new Date().toISOString();
        const { error: seedError } = await db.from('integration_sessions').upsert({ integration_key: lockKey,
          session_value: '', expires_at: new Date(0).toISOString(), updated_at: current },
        { onConflict: 'integration_key', ignoreDuplicates: true });
        if (seedError) throw new AnalyError('session_store_unavailable', 503);
        const { data, error } = await db.from('integration_sessions').update({ session_value: holder,
          expires_at: new Date(Date.now() + 60_000).toISOString(), updated_at: current })
          .eq('integration_key', lockKey).lt('expires_at', current).select('integration_key');
        if (error) throw new AnalyError('session_store_unavailable', 503);
        return data?.length ? holder : null;
      },
      async release(holder: string) {
        const { error } = await db.from('integration_sessions').update({ expires_at: new Date(0).toISOString() })
          .eq('integration_key', `${key}_lease`).eq('session_value', holder);
        if (error) throw new AnalyError('session_store_unavailable', 503);
      },
    };
    const session = createAnalySession({ store, credentials });
    if (body.action === 'check_api') {
      const report = await probeAnalyDelivery(session);
      const { error } = await db.from('integration_sessions').upsert({
        integration_key: 'analy_delivery_probe', session_value: JSON.stringify(report),
        expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'integration_key' });
      if (error) throw new AnalyError('probe_store_unavailable', 503);
      return reply({ ok: report.shipping_api_usable, ...report });
    }
    if (body.action === 'connect') await session.getSession();
    return reply({ ok: true, ...await session.status(), account_mode: Deno.env.get('ANALY_ACCOUNT_MODE') || 'unknown', delivery_creation_enabled: false });
  } catch (error) {
    // Upstream bodies, credentials and token values never enter the response or logs.
    return reply({ ok: false, code: error instanceof AnalyError ? error.code : 'internal_error' },
      error instanceof AnalyError ? error.status : 500);
  }
});
