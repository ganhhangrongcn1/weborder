import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import * as policy from '../supabase/functions/nexpos-event-observer/policy.mjs';

async function harness({ enrolled = true, expired = false } = {}) {
  let handle;
  const writes = [];
  const reads = [];
  const createClient = () => ({ from(table) {
    reads.push(table);
    let writing = false;
    const result = () => {
      if (table === 'nexpos_event_workers') return { data: enrolled ? { worker_id: policy.WORKER_ID, hub_ids: ['one', 'disabled'] } : null, error: null };
      if (table === 'nexpos_shadow_hubs') return { data: [{ nexpos_hub_id: 'one' }], error: null };
      if (table === 'integration_sessions') return { data: {
        session_value: '__token=test-source-token', expires_at: expired ? 'invalid' : new Date(Date.now() + 3600000).toISOString()
      }, error: null };
      throw new Error(`Unexpected access ${table}`);
    };
    const query = {
      select() { return query; }, eq() { return query; }, gt() { return query; }, in() { return query; }, or() { return query; },
      update(value) { writing = true; writes.push({ table, value }); return query; },
      maybeSingle: async () => result(),
      then: (resolve, reject) => Promise.resolve(result(writing)).then(resolve, reject)
    };
    return query;
  } });
  const context = createContext({ Request, Response, TextEncoder, Date, crypto: globalThis.crypto,
    Deno: { env: { get: () => 'test-only' }, serve: fn => { handle = fn; } } });
  const source = stripTypeScriptTypes(await readFile(new URL('../supabase/functions/nexpos-event-observer/index.ts', import.meta.url), 'utf8'));
  const module = new SourceTextModule(source, { context });
  await module.link(specifier => {
    const values = specifier.startsWith('npm:') ? { createClient } : policy;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { writes, reads, request: (body, token = 'a'.repeat(64)) => handle(new Request('https://test.invalid', {
    method: 'POST', headers: { 'x-worker-token': token }, body: JSON.stringify(body)
  })) };
}
test('missing or unregistered machine credential never reaches source session', async () => {
  const h = await harness({ enrolled: false });
  assert.equal((await h.request({ action: 'bootstrap' }, '')).status, 401);
  assert.equal((await h.request({ action: 'bootstrap' })).status, 401);
  assert.deepEqual(h.reads, ['nexpos_event_workers']);
  assert.equal(h.writes.length, 0);
});
test('bootstrap intersects current enabled hubs; expired sessions fail closed', async () => {
  const h = await harness();
  const response = await h.request({ action: 'bootstrap' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await response.json()).hub_ids, ['one']);
  const expired = await harness({ expired: true });
  assert.equal((await expired.request({ action: 'bootstrap' })).status, 503);
});
test('report cannot write business tables or persist secrets from event payload', async () => {
  const h = await harness();
  assert.equal((await h.request({ action: 'sync', hub_id: 'other' })).status, 400);
  const response = await h.request({ action: 'report', report: { connected: true, raw_data: 'private' } });
  assert.equal(response.status, 200);
  assert.ok(h.writes.every(w => w.table === 'nexpos_event_workers'));
  assert.ok(!JSON.stringify(h.writes).includes('private'));
  assert.ok(!h.reads.includes('integration_sessions'));
});
