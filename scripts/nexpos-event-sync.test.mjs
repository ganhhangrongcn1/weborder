import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import * as eventPolicy from '../supabase/functions/nexpos-order-shadow-sync/eventSync.mjs';
import * as windowPolicy from '../supabase/functions/nexpos-order-shadow-sync/preorderWindow.mjs';

const hub = '69e18c814673b293b04be1ab';
async function run({ status = 'DOING', existing = false, failCommit = false, detailOnly = false } = {}) {
  let handle;
  const commits = [], writes = [], urls = [], leases = [];
  const client = {
    from(table) {
      let write;
      const result = () => {
        if (write) return { data: table === 'nexpos_shadow_sync_runs' ? { id: 'run' } : [], error: null };
        const data = {
          nexpos_shadow_sync_control: { mode: 'dual_write', cron_secret: 'test', last_full_sweep_at: new Date().toISOString(), last_rare_sweep_at: new Date().toISOString() },
          nexpos_shadow_hubs: [{ nexpos_hub_id: hub }, { nexpos_hub_id: 'other' }],
          nexpos_event_workers: [{ hub_ids: [hub] }],
          nexpos_event_pending: [{ hub_id: hub, generation: 3, completed_generation: 2 }],
          integration_sessions: { session_value: '__token=test', expires_at: new Date(Date.now() + 3600000).toISOString() },
          app_configs: [{ id: 'ghr_partner_order_automation', value: { grabAutoPrepEnabled: false } }],
          partner_orders: existing ? [{ id: 'order', partner_source: 'grabfood', nexpos_order_id: 'synthetic', nexpos_hub_id: hub, ingested_by: 'supabase', nexpos_enrichment_hash: 'before' }] : [],
          nexpos_shadow_orders: [], partner_order_items: [{ id: 'item', line_index: 0 }]
        }[table];
        assert.notEqual(data, undefined, table);
        return { data, error: null };
      };
      const q = {
        select() { return q; }, eq() { return q; }, gt() { return q; }, lt() { return q; }, in() { return q; }, or() { return q; }, limit() { return q; },
        insert(value) { write = value; writes.push({ table, value }); return q; },
        update(value) { write = value; writes.push({ table, value }); return q; },
        upsert(value) { write = value; writes.push({ table, value }); return q; },
        single: async () => result(), maybeSingle: async () => result(),
        then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
      };
      return q;
    },
    async rpc(name, input) {
      if (name === 'nexpos_sync_lease') { leases.push(input); return { data: true }; }
      assert.equal(name, 'nexpos_commit_order');
      commits.push(input);
      if (failCommit) return { error: { code: 'TEST' } };
      return { data: { row: { ...input.p_order, id: 'order' }, created: !existing } };
    }
  };
  // Fixed business clock; tests never depend on the wall-clock trading window.
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-30T04:00:00Z'])); }
    static now() { return new Date('2026-10-30T04:00:00Z').getTime(); }
  }
  const ctx = createContext({ Request, Response, URLSearchParams, TextEncoder, AbortSignal, crypto, Date: FixedDate,
    Deno: { env: { get: () => 'test' }, serve: fn => { handle = fn; } },
    fetch: async (url) => {
      urls.push(url);
      const requested = new URL(url).searchParams.get('status');
      const order = {
        id: 'synthetic', source: 'grab', hub_id: hub, order_id: 'GF-1234F', status,
        dishes: [{ quantity: 2, price: 20000, discount_price: 16000, name: 'Synthetic' }],
        finance_data: { gross_received: 16000, real_received: 12000 }
      };
      return { ok: true, status: 200, json: async () => ({ data: !requested ? order
        : !detailOnly && requested === status ? [order, { id: 'cross-hub', hub_id: 'forbidden', status }] : [] }) };
    }
  });
  const source = stripTypeScriptTypes(await readFile(new URL('../supabase/functions/nexpos-order-shadow-sync/index.ts', import.meta.url), 'utf8'));
  const module = new SourceTextModule(source, { context: ctx });
  await module.link(specifier => {
    const values = specifier.startsWith('npm:') ? { createClient: () => client }
      : specifier.includes('eventSync') ? eventPolicy : windowPolicy;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context: ctx });
  });
  await module.evaluate();
  const response = await handle(new Request('https://test.invalid', {
    method: 'POST', headers: { 'x-cron-secret': 'test', 'x-nexpos-event-wake': '1' }
  }));
  return { response, commits, writes, urls, leases };
}

test('WSS wake scopes one HUB, uses full REST statuses and preserves v39 mapping atomically', async () => {
  const r = await run();
  assert.equal(r.response.status, 200);
  assert.equal(r.urls.length, 5);
  assert.ok(r.urls.every(url => new URL(url).searchParams.get('hub_ids') === hub));
  assert.equal(r.commits.length, 1);
  const p = r.commits[0];
  assert.equal(p.p_order.display_order_code, 'GF-1234F');
  assert.equal(p.p_items[0].unit_price, 10000);
  assert.equal(p.p_items[0].line_total, 16000);
  assert.equal(p.p_order.points_base_amount, 12000);
  assert.equal(p.p_generation, 3);
  assert.ok(!r.writes.some(w => ['partner_orders', 'partner_order_items', 'partner_order_promotions'].includes(w.table)));
  assert.ok(r.writes.some(w => w.table === 'nexpos_event_pending' && w.value.completed_generation === 3));
  assert.equal(r.leases.at(-1).p_action, 'release');
});

test('cancel and status mapping preserve kitchen work progress and commit item prices together', async () => {
  for (const [status, expected] of [['CANCEL', 'cancelled'], ['PICK', 'ready'], ['FINISH', 'completed']]) {
    const r = await run({ status, existing: true });
    assert.equal(r.response.status, 200);
    assert.equal(r.commits[0].p_order.order_status, expected);
    assert.ok(!Object.hasOwn(r.commits[0].p_order, 'kitchen_work_status'));
    assert.equal(r.commits[0].p_expected_hash, 'before');
    assert.equal(r.commits[0].p_items[0].id, 'item');
  }
});

test('failed commit leaves pending generation for retry and releases only its own lease', async () => {
  const r = await run({ failCommit: true });
  assert.equal(r.response.status, 500);
  assert.ok(!r.writes.some(w => w.table === 'nexpos_event_pending'));
  assert.equal(r.leases.at(-1).p_action, 'release');
  assert.ok(r.leases.every(l => l.p_owner === r.leases[0].p_owner));
});

test('a known preorder cancelled outside the list window is rechecked by stable ID', async () => {
  const r = await run({ existing: true, status: 'CANCEL', detailOnly: true });
  assert.equal(r.response.status, 200);
  assert.ok(r.urls.some(url => url.endsWith('/orders/synthetic')));
  assert.equal(r.commits[0].p_order.order_status, 'cancelled');
});

test('real detail envelope separates immutable order_id from short_order_id', () => {
  const detail = { order_id: 'immutable-id', short_order_id: 'GF-113F', hub_id: hub, status: 'CANCEL' };
  const normalized = eventPolicy.normalizeDetail(detail, 'immutable-id', hub);
  assert.equal(normalized.id, 'immutable-id');
  assert.equal(normalized.order_id, 'GF-113F');
  assert.throws(() => eventPolicy.normalizeDetail(detail, 'GF-113F', hub), /scope_mismatch/);
  assert.throws(() => eventPolicy.normalizeDetail(detail, 'immutable-id', 'other'), /scope_mismatch/);
});
