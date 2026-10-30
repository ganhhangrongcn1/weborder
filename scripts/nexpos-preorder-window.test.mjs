import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import * as windowPolicy from '../supabase/functions/nexpos-order-shadow-sync/preorderWindow.mjs';
import { getPreorderQueryWindow, normalizePreorderWindowConfig } from '../supabase/functions/nexpos-order-shadow-sync/preorderWindow.mjs';

const canary = '69e18c814673b293b04be1ab';
const other = '69e589d15f07d302954e2f63';
const now = Date.parse('2026-10-30T03:10:00Z');
const fallback = { from: '2026-10-29T21:10:00.000Z', to: '2026-10-30T04:10:00.000Z' };
const config = normalizePreorderWindowConfig({ enabled: true, hubIds: [canary], lookbackDays: 7, lookaheadDays: 7 });

test('canary PRE_ORDER includes GF-113F pickup beyond the original one-hour horizon', () => {
  const result = getPreorderQueryWindow({ status: 'PRE_ORDER', hubId: canary, config, fallback, now });
  assert.deepEqual(result, { from: '2026-10-23T03:10:00.000Z', to: '2026-11-06T03:10:00.000Z' });
  const pickup = Date.parse('2026-10-30T10:17:38Z');
  assert.ok(pickup > Date.parse(fallback.to));
  assert.ok(pickup >= Date.parse(result.from) && pickup <= Date.parse(result.to));
});
test('all other statuses and non-enrolled HUBs retain the exact old range', () => {
  for (const status of ['DOING', 'PICK', 'FINISH', 'CANCEL']) {
    assert.equal(getPreorderQueryWindow({ status, hubId: canary, config, fallback, now }), fallback);
  }
  assert.equal(getPreorderQueryWindow({ status: 'PRE_ORDER', hubId: other, config, fallback, now }), fallback);
});
test('missing or disabled config fails closed and day bounds cannot expand unboundedly', () => {
  for (const input of [null, [], {}, { enabled: false, hubIds: [canary] }, { enabled: true, hubIds: ['*'] }]) {
    assert.equal(getPreorderQueryWindow({ status: 'PRE_ORDER', hubId: canary, config: normalizePreorderWindowConfig(input), fallback, now }), fallback);
  }
  assert.deepEqual(normalizePreorderWindowConfig({ enabled: 'true', hubIds: [canary, canary], lookbackDays: 999, lookaheadDays: -5 }), {
    enabled: false, hubIds: [canary], lookbackDays: 7, lookaheadDays: 7
  });
});

test('deployed entrypoint compiles, keeps v38 Grab codes, and batches existing automation with canary config', async () => {
  const queries = [];
  const client = { from(table) {
    const query = { select(columns) { queries.push({ table, columns }); return query; },
      async in(column, ids) {
        assert.equal(column, 'id');
        assert.deepEqual(Array.from(ids), ['ghr_partner_order_automation', windowPolicy.PREORDER_WINDOW_CONFIG_KEY]);
        return { data: [
          { id: 'ghr_partner_order_automation', value: { grabAutoPrepEnabled: false, grabPrepMinutes: 25 } },
          { id: windowPolicy.PREORDER_WINDOW_CONFIG_KEY, value: { enabled: true, hubIds: [canary] } }
        ], error: null };
      }
    };
    return query;
  } };
  const context = createContext({ Deno: { serve() {} } });
  const raw = await readFile(new URL('../supabase/functions/nexpos-order-shadow-sync/index.ts', import.meta.url), 'utf8');
  const source = stripTypeScriptTypes(raw) + '\nexport { normalizedDisplayCode, readGrabAutomationConfig };';
  const module = new SourceTextModule(source, { context });
  await module.link(specifier => {
    const values = specifier.startsWith('npm:') ? { createClient() {} } : windowPolicy;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  assert.equal(module.namespace.normalizedDisplayCode('grabfood', 'GF-1234F'), 'GF-1234F');
  const actual = await module.namespace.readGrabAutomationConfig(client);
  assert.equal(actual.enabled, false);
  assert.equal(actual.prepMinutes, 25);
  assert.deepEqual(actual.preorderWindow, config);
  assert.equal(queries.length, 1);
});
