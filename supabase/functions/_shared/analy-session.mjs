// Server-only. Never return the session/token to a browser or log upstream bodies.
export class AnalyError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}
export function tokenExpiry(token, now) {
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const part = raw.padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const exp = JSON.parse(atob(part)).exp;
    if (Number.isFinite(exp)) return Math.min(exp * 1000, now + 6 * 60 * 60_000);
  } catch { /* Opaque tokens use a conservative cache interval, not an assumed lifetime. */ }
  return now + 5 * 60_000;
}
export function createAnalySession({ store, credentials, fetcher = fetch, now = Date.now }) {
  function usable(row) {
    return row?.state === 'connected' && typeof row.token === 'string' && row.token.length > 0 && row.expiresAt > now() + 60_000;
  }
  async function getSession(rejectedToken = '') {
    let row = await store.read();
    if (usable(row) && row.token !== rejectedToken) return row;
    if (row?.retryAt > now()) throw new AnalyError(row.state, 409);
    const { username, password, deviceId } = credentials();
    if (!username || !password || !deviceId) throw new AnalyError('not_configured', 503);
    const lease = await store.acquire();
    if (!lease) throw new AnalyError('login_in_progress', 409);
    try {
      row = await store.read();
      if (usable(row) && row.token !== rejectedToken) return row;
      if (row?.retryAt > now()) throw new AnalyError(row.state, 409);
      const result = await fetcher('https://api-c2.analy.co/auth/v1/login', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId, deviceName: 'GHR Supabase', deviceModel: 'Server', deviceType: 'Desktop' }),
      });
      if (!result.ok) throw new AnalyError(result.status === 401 || result.status === 403 ? 'login_rejected' : 'upstream_unavailable');
      const data = await result.json().catch(() => { throw new AnalyError('invalid_login_response'); });
      if (data?.deviceNeedApproval) throw new AnalyError('device_approval_required', 409);
      if (typeof data?.accessToken !== 'string' || !data.accessToken.trim()) throw new AnalyError('invalid_login_response');
      const expiresAt = tokenExpiry(data.accessToken, now());
      if (expiresAt <= now() + 60_000) throw new AnalyError('expired_login_token');
      row = { state: 'connected', token: data.accessToken, expiresAt, updatedAt: now() };
      await store.write(row);
      return row;
    } catch (error) {
      const code = error instanceof AnalyError ? error.code : 'upstream_unavailable';
      // No tokens from a previous rejected/approval-pending session survive a failure.
      await store.write({ state: code, retryAt: now() + 60_000, updatedAt: now() });
      throw error instanceof AnalyError ? error : new AnalyError(code);
    } finally { await store.release(lease); }
  }
  return {
    getSession,
    async status() {
      const row = await store.read();
      const configured = Object.values(credentials()).every(Boolean);
      return { configured, state: !configured ? 'not_configured' : usable(row) ? 'connected' : row?.state === 'connected' ? 'expired' : row?.state || 'disconnected',
        session_updated_at: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        expires_at: row?.expiresAt ? new Date(row.expiresAt).toISOString() : null };
    },
    // Internal callers supply a read-only operation. Retry only explicit 401, never generic 403.
    async readWithSession(operation) {
      let session = await getSession();
      let response = await operation(session.token);
      if (response.status !== 401) return response;
      session = await getSession(session.token);
      response = await operation(session.token);
      if (response.status === 401) {
        await store.write({ state: 'session_rejected', retryAt: now() + 60_000, updatedAt: now() });
        throw new AnalyError('session_rejected', 409);
      }
      return response;
    },
  };
}
