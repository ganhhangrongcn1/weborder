import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(new URL('../ghr-pos-mobile-native/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../supabase/functions/pos-payment-session-api/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/, '');
const compiled = ts.transpileModule(source + '\nglobalThis.createSessionForTest = createSession;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText;
const context = vm.createContext({ Response, Date, console, Deno: { serve() {}, env: { get() {} } } });
vm.runInContext(compiled, context);

const branch = '11111111-1111-4111-8111-111111111111';
const body = { source: 'pos', payment_reference: 'POS-TEST-20261010', request_key: 'pos:branch:bill',
  branch_uuid: branch, amount_expected: 19000, cart_snapshot: [{ id: 'food', quantity: 1 }],
  checkout_snapshot: { pagerEnabled: false } };

function client(config, configError = null, busyPager = false) {
  const inserts = [];
  const pagerLookups = [];
  return { inserts, pagerLookups, from(table) {
    let insert;
    let pagerQuery = false;
    const chain = {
      select() { return chain; },
      eq(key, value) { if (key === 'pager_number') { pagerQuery = true; pagerLookups.push(value); } return chain; },
      or() { return chain; }, in() { return chain; }, gt() { return chain; }, order() { return chain; }, limit() { return chain; },
      insert(row) { insert = row; inserts.push(row); return chain; },
      maybeSingle: async () => table === 'app_configs' ? { data: config, error: configError }
        : { data: pagerQuery && busyPager ? { id: 'busy' } : null, error: null },
      single: async () => ({ data: { ...insert, id: 'new-session' }, error: null })
    };
    return chain;
  } };
}

test('QR without pager is accepted only for a branch configured off; sessions use null and never share a pager', async () => {
  const db = client({ value: { enabled: false } });
  const response = await context.createSessionForTest(db, { role: 'staff', branch_uuid: branch }, body);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(db.inserts[0].pager_number, null);
  assert.equal(db.pagerLookups.length, 0);
});
test('missing config or enabled config rejects an attempted no-pager QR', async () => {
  for (const value of [null, { value: { enabled: true } }]) {
    const db = client(value);
    const response = await context.createSessionForTest(db, { role: 'staff', branch_uuid: branch }, body);
    assert.equal(response.status, 409);
    assert.equal(db.inserts.length, 0);
  }
});
test('existing clients still require pagers, and a busy pager still blocks QR', async () => {
  const db = client(null, null, true);
  const old = { ...body, checkout_snapshot: {} };
  assert.equal((await context.createSessionForTest(db, { role: 'staff', branch_uuid: branch }, old)).status, 400);
  assert.equal((await context.createSessionForTest(db, { role: 'staff', branch_uuid: branch }, { ...old, pager_number: '01' })).status, 409);
  assert.equal(db.inserts.length, 0);
});
test('branch permission and config read failures remain enforced', async () => {
  const db = client(null, { message: 'offline' });
  assert.equal((await context.createSessionForTest(db, { role: 'staff', branch_uuid: 'other' }, body)).status, 403);
  assert.equal((await context.createSessionForTest(db, { role: 'staff', branch_uuid: branch }, body)).status, 503);
  assert.equal(db.inserts.length, 0);
});
