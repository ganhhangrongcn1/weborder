import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from '../ghr-pos-mobile-native/node_modules/typescript/lib/typescript.js';

const source = fs.readFileSync('supabase/functions/pos-payment-session-api/index.ts', 'utf8');
const code = ts.transpile(source.replace(/^import .*createClient.*;\r?\n/, ''), { target: ts.ScriptTarget.ES2022 });
const branch = 'c0d35bd0-e614-4973-9eb2-17e78fb9a245';
const other = 'b108f000-02dc-4f04-8a97-996bbfc27fb8';
async function run({ role = 'kitchen', grant = '', assigned = branch, target = branch, active = true, forged = false, action = 'confirm_paid' }) {
  let handler;
  const profile = { id: 'profile', role, status: active ? 'active' : 'inactive', branch_uuid: assigned, manualQrBranch: forged ? branch : '' };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user', app_metadata: { pos_manual_qr_branch: grant }, user_metadata: { pos_manual_qr_branch: branch } } } }) },
    from(table) {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === 'profiles' ? profile : { id: 'session', branch_uuid: target, source: 'qr_order' } }) };
      return query;
    }
  };
  vm.runInNewContext(code, {
    createClient: () => client, Response, console: { log() {}, warn() {} },
    Deno: { env: { get: key => key === 'SEPAY_WEBHOOK_SECRET' ? '' : 'configured' }, serve: fn => { handler = fn; } }
  });
  // Missing webhook secret stops authorized requests before any payment write.
  return handler(new Request('https://test.invalid', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ action, session_id: '11111111-1111-4111-8111-111111111111' }) }));
}
assert.equal((await run({})).status, 403);
assert.equal((await run({ forged: true })).status, 403);
assert.equal((await run({ grant: branch })).status, 500);
assert.equal((await run({ grant: branch, target: other })).status, 403);
assert.equal((await run({ grant: other })).status, 403);
assert.equal((await run({ grant: branch, assigned: '' })).status, 403);
assert.equal((await run({ grant: branch, active: false })).status, 401);
assert.equal((await run({ role: 'staff' })).status, 500);
assert.equal((await run({ role: 'admin' })).status, 500);
assert.equal((await run({ action: 'read' })).status, 200);
const branches = [branch, other, '2ae2433d-081e-4a1c-a65f-8b158f48df56', '99ffd49c-c0e3-4267-a384-35c6298b1abf'];
for (const assigned of branches) {
  for (const target of branches) {
    assert.equal((await run({ assigned, grant: assigned, target })).status, assigned === target ? 500 : 403);
  }
}
console.log('26 permission scenarios passed; no payment writes performed.');
