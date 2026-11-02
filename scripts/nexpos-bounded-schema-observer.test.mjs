import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

const raw = await readFile(new URL('./nexpos-bounded-schema-observer.mjs', import.meta.url), 'utf8');
async function load(source) {
  let handler, reads = 0;
  const client = { from() { reads++; return { select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: { cron_secret: 'synthetic-test-only' } }) }; } };
  const context = createContext({ Date, Request, Response, AbortSignal,
    Deno: { env: { get() { return 'test'; } }, serve(fn) { handler = fn; } } });
  const module = new SourceTextModule(source + '\nexport { candidates };', { context });
  await module.link(() => new SyntheticModule(['createClient'], function () {
    this.setExport('createClient', () => client);
  }, { context }));
  await module.evaluate();
  return { handler, candidates: module.namespace.candidates, reads: () => reads };
}

test('unrendered or expired observer cannot read credentials or open a socket', async () => {
  for (const source of [raw, raw.replace("const END = '__GLOBAL_END__';", "const END = '2000-01-01T00:00:00Z';")]) {
    const app = await load(source);
    assert.equal((await app.handler(new Request('https://test/', { method: 'POST' }))).status, 410);
    assert.equal(app.reads(), 0);
  }
});
test('live observer rejects missing authentication before run/session access', async () => {
  const app = await load(raw.replace("const END = '__GLOBAL_END__';", `const END = '${new Date(Date.now() + 60000).toISOString()}';`));
  assert.equal((await app.handler(new Request('https://test/', { method: 'POST' }))).status, 401);
  assert.equal(app.reads(), 1);
});
test('candidate extraction supports nested order payloads without returning customer fields', async () => {
  const app = await load(raw);
  const result = JSON.parse(JSON.stringify(app.candidates({ payload: JSON.stringify({ order: { id: 'synthetic-order' },
    customer_phone: 'private-phone', access_token: 'private-token' }) })));
  assert.deepEqual(result, [{ path: 'data.payload.order.id', id: 'synthetic-order' }]);
  assert.doesNotMatch(JSON.stringify(result), /private/);
});
