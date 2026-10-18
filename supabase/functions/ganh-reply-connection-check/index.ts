// Deployment is separate from Ganh Reply and requires project-owner confirmation.
// Dashboard Test must use the service_role Authorization header. Never use this key in the frontend.
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

async function matchesSecret(provided: string, expected: string) {
  if (!provided || !expected || provided.length > 4096) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}

async function hasServerAccess(provided: string) {
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (await matchesSecret(provided, serverKey)) return true;
  if (!provided || provided.length > 4096 || !serverKey) return false;
  // The hosted gateway can mint a different service-role JWT for Dashboard calls.
  // Decoding is only a prefilter; PostgREST must independently validate its signature.
  try {
    const parts = provided.split('.');
    if (parts.length !== 3) return false;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    if (claims.role !== 'service_role') return false;
    const projectUrl = Deno.env.get('SUPABASE_URL');
    if (!projectUrl) return false;
    // HEAD on the API schema endpoint validates JWT without requesting table rows.
    const validation = await fetch(`${projectUrl.replace(/\/$/, '')}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: serverKey, Authorization: `Bearer ${provided}` },
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    await validation.body?.cancel();
    return validation.status === 200;
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return respond({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!await hasServerAccess(provided)) {
    return respond({ ok: false, code: 'FORBIDDEN', message: 'Chỉ quản trị server được chạy kiểm tra.' }, 403);
  }
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return respond({ ok: false, code: 'OPENAI_KEY_MISSING', message: 'Chưa có OPENAI_API_KEY trong Supabase secrets.' }, 503);
  const model = Deno.env.get('GANH_REPLY_MODEL') || 'gpt-4.1-mini';
  try {
    // Model metadata only: no customer data, no generation, no database access.
    const result = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    await result.body?.cancel();
    if (!result.ok) {
      const code = result.status === 401 ? 'OPENAI_KEY_INVALID'
        : result.status === 403 ? 'OPENAI_PERMISSION_DENIED'
        : result.status === 404 ? 'OPENAI_MODEL_UNAVAILABLE'
        : result.status === 429 ? 'OPENAI_RATE_LIMITED' : 'OPENAI_UNAVAILABLE';
      return respond({ ok: false, code, provider_status: result.status, model }, 502);
    }
    return respond({
      ok: true, code: 'OPENAI_CONNECTED', model,
      message: 'Key kết nối được OpenAI và truy cập được thông tin model.',
      generation_tested: false,
      balance_checked: false,
    });
  } catch {
    return respond({ ok: false, code: 'OPENAI_CONNECTION_FAILED', message: 'Chưa kết nối được OpenAI. Hãy thử lại.' }, 502);
  }
});
