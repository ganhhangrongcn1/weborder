import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAnalySession, tokenExpiry } from '../supabase/functions/_shared/analy-session.mjs';
import { isAnalyServerRequest, isAnalyFingerprintRequest } from '../supabase/functions/_shared/analy-auth.mjs';
const time = 1800000000000;
const token = exp => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
function fixture(fetcher, initial = null) {
  let row = initial; let logins = 0;
  const store = { read: async () => row, write: async value => { row = value; }, acquire: async () => 'lease', release: async () => {} };
  const session = createAnalySession({ store, now: () => time, credentials: () => ({ username: 'test', password: 'test', deviceId: 'test' }),
    fetcher: async (...args) => { logins++; return fetcher(...args); } });
  return { session, row: () => row, logins: () => logins };
}
test('token cache respects actual short expiry and caps unrealistic long expiry', () => {
  assert.equal(tokenExpiry(token(time / 1000 + 120), time), time + 120000);
  assert.equal(tokenExpiry(token(time / 1000 + 99999999), time), time + 6 * 3600000);
  assert.equal(tokenExpiry('opaque', time), time + 300000);
});
test('reuses session without logging in again', async () => {
  const f = fixture(() => { throw Error('must not login'); }, { state: 'connected', token: 'cached', expiresAt: time + 300000 });
  await f.session.getSession(); await f.session.getSession(); assert.equal(f.logins(), 0);
});
test('refreshes a rejected session once after 401', async () => {
  const fresh = token(time / 1000 + 600);
  const f = fixture(async () => Response.json({ accessToken: fresh }), { state: 'connected', token: 'old', expiresAt: time + 300000 });
  let calls = 0;
  const result = await f.session.readWithSession(async value => { calls++; return new Response('', { status: value === 'old' ? 401 : 200 }); });
  assert.equal(result.status, 200); assert.equal(calls, 2); assert.equal(f.logins(), 1);
});
test('does not login repeatedly for service errors or 428', async () => {
  const f = fixture(() => { throw Error('must not login'); }, { state: 'connected', token: 'cached', expiresAt: time + 300000 });
  assert.equal((await f.session.readWithSession(async () => new Response('', { status: 428 }))).status, 428);
  assert.equal(f.logins(), 0);
});
test('device approval stops connection and clears token', async () => {
  const f = fixture(async () => Response.json({ deviceNeedApproval: true, accessToken: 'discard' }));
  await assert.rejects(f.session.getSession(), error => error.code === 'device_approval_required');
  assert.equal(f.row().token, undefined);
});
test('rejects forged JWT claims and accepts only provisioned key or matching fingerprint', async () => {
  assert.equal(isAnalyServerRequest(new Headers({ authorization: 'Bearer real-key' }), 'real-key'), true);
  const forged = token(time / 1000 + 600);
  assert.equal(isAnalyServerRequest(new Headers({ authorization: `Bearer ${forged}` }), 'real-key'), false);
  const hash = createHash('sha256').update('provisioned-server-key').digest('hex');
  assert.equal(await isAnalyFingerprintRequest(new Headers({ 'x-analy-server-key': 'provisioned-server-key' }), hash), true);
  assert.equal(await isAnalyFingerprintRequest(new Headers({ 'x-analy-server-key': 'wrong' }), hash), false);
  assert.equal(await isAnalyFingerprintRequest(new Headers(), hash), false);
});
