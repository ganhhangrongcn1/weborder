import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const { Request, Response, TextEncoder, AbortSignal, atob } = globalThis;
const output = await build({ entryPoints: ['supabase/functions/ganh-reply-connection-check/index.ts'], bundle: true, write: false, platform: 'neutral' });
function setup({ key = 'example-api-key', providerStatus = 200, authStatus = 200 } = {}) {
  let handler;
  const calls = [];
  vm.runInNewContext(output.outputFiles[0].text, {
    Response, TextEncoder, Uint8Array, AbortSignal, atob, crypto: webcrypto,
    Deno: { env: { get: name => ({ SUPABASE_SERVICE_ROLE_KEY: 'example-server-key', SUPABASE_URL: 'https://test.supabase.co', OPENAI_API_KEY: key })[name] }, serve: fn => { handler = fn; } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(null, { status: url === 'https://test.supabase.co/rest/v1/' ? authStatus : providerStatus });
    },
  });
  return { calls, invoke: async (token = 'example-server-key') => {
    const response = await handler(new Request('https://test.invalid', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }));
    return { status: response.status, body: await response.json() };
  } };
}
test('Unauthorized requests cannot reach OpenAI or learn key state', async () => {
  const h = setup();
  assert.equal((await h.invoke('wrong-key')).status, 403);
  assert.equal(h.calls.length, 0);
});
test('Missing key gives configuration status without provider request', async () => {
  const h = setup({ key: '' });
  assert.equal((await h.invoke()).body.code, 'OPENAI_KEY_MISSING');
  assert.equal(h.calls.length, 0);
});
test('Successful metadata check does not claim balance or generation verified', async () => {
  const h = setup(); const result = await h.invoke();
  assert.equal(result.body.ok, true);
  assert.equal(result.body.generation_tested, false);
  assert.equal(result.body.balance_checked, false);
  assert.equal(h.calls[0].options.method, 'GET');
  assert.ok(!JSON.stringify(result).includes('example-api-key'));
});
test('Invalid key mapped to a safe response without raw provider content', async () => {
  const h = setup({ providerStatus: 401 });
  assert.equal((await h.invoke()).body.code, 'OPENAI_KEY_INVALID');
});

const tokenFor = role => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
test('Gateway-minted service-role JWT must pass independent server validation', async () => {
  const h = setup(); const result = await h.invoke(tokenFor('service_role'));
  assert.equal(result.body.ok, true);
  assert.equal(h.calls[0].url, 'https://test.supabase.co/rest/v1/');
  assert.equal(h.calls[0].options.method, 'HEAD');
  assert.equal(h.calls[1].url, 'https://api.openai.com/v1/models/gpt-4.1-mini');
});
test('Forged service-role claim is rejected when signature validation fails', async () => {
  const h = setup({ authStatus: 401 }); const result = await h.invoke(tokenFor('service_role'));
  assert.equal(result.status, 403);
  assert.equal(h.calls.length, 1);
});
test('Anon and authenticated user JWTs never reach the provider', async () => {
  for (const role of ['anon', 'authenticated']) {
    const h = setup(); assert.equal((await h.invoke(tokenFor(role))).status, 403);
    assert.equal(h.calls.length, 0);
  }
});
test('Unavailable token-validation endpoint fails closed', async () => {
  const h = setup({ authStatus: 503 });
  assert.equal((await h.invoke(tokenFor('service_role'))).status, 403);
  assert.equal(h.calls.length, 1);
});
