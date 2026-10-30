import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import * as policy from '../supabase/functions/nexpos-event-observer/policy.mjs';
import * as signals from '../supabase/functions/nexpos-event-observer/signals.mjs';

async function harness({ enrolled = true, expired = false, sync = false, pending = false, idSync = false } = {}) {
  let handle;
  const writes = [];
  const reads = [];
  const wakes = [], background = [];
  const createClient = () => ({ rpc: async () => ({ data: true }), from(table) {
    reads.push(table);
    let writing = false;
    const result = () => {
      if (table === 'nexpos_event_workers') return { data: enrolled ? { worker_id: policy.WORKER_ID, hub_ids: ['one', 'disabled'], sync_enabled: sync, id_sync_enabled: idSync } : null, error: null };
      if (table === 'nexpos_event_pending') return { data: pending ? [{ generation: 2, completed_generation: 1 }] : [], error: null };
      if (table === 'nexpos_shadow_sync_control') return { data: { cron_secret: 'synthetic-cron-secret' }, error: null };
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
  const context = createContext({ Request, Response, TextEncoder, Date, crypto: globalThis.crypto, AbortSignal,
    EdgeRuntime: { waitUntil: promise => background.push(promise) },
    fetch: async (url, init) => { wakes.push({ url, init }); return new Response('{}'); },
    Deno: { env: { get: () => 'test-only' }, serve: fn => { handle = fn; } } });
  const source = stripTypeScriptTypes(await readFile(new URL('../supabase/functions/nexpos-event-observer/index.ts', import.meta.url), 'utf8'));
  const module = new SourceTextModule(source, { context });
  await module.link(specifier => {
    const values = specifier.startsWith('npm:') ? { createClient } : specifier.includes('signals') ? signals : policy;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { writes, reads, wakes, background, request: (body, token = 'a'.repeat(64)) => handle(new Request('https://test.invalid', {
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

test('ID delivery requires explicit feature scope and rejects a disabled HUB', async () => {
  const off = await harness({ sync: true });
  assert.equal((await off.request({ action: 'events', signals: [] })).status, 409);
  const on = await harness({ sync: true, idSync: true });
  const payload = [{ hub_id: 'one', topic: 'saas_order_status_change', order_ids: ['opaque-id'], received_at: new Date().toISOString() }];
  assert.equal((await on.request({ action: 'events', signals: payload })).status, 200);
  await Promise.all(on.background);
  assert.equal(on.wakes.length, 1);
  payload[0].hub_id = 'disabled';
  assert.equal((await on.request({ action: 'events', signals: payload })).status, 400);
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

test('only an authenticated sync-enabled worker with durable pending work wakes the importer', async () => {
  for (const pending of [false, true]) {
    const h = await harness({ sync: true, pending });
    assert.equal((await h.request({ action: 'report', report: {} })).status, 200);
    await Promise.all(h.background);
    assert.equal(h.wakes.length, pending ? 1 : 0);
    if (pending) assert.equal(h.wakes[0].init.headers['x-nexpos-event-wake'], '1');
    assert.ok(h.writes.every(w => w.table === 'nexpos_event_workers'));
  }
});
