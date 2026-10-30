import assert from 'node:assert/strict';
import test from 'node:test';
import { readMetadata, sanitizeReport, TOPICS } from '../supabase/functions/nexpos-event-observer/policy.mjs';

test('only allowlisted topics and enrolled HUBs become metadata', () => {
  const raw = JSON.stringify({ data: { topic: TOPICS[0], hub_ids: ['one', 'other', 'one'], customer_phone: 'private' } });
  assert.deepEqual(readMetadata(raw, ['one']), { topic: TOPICS[0], hubs: ['one'] });
  assert.equal(readMetadata(raw, ['two']), null);
  assert.equal(readMetadata(JSON.stringify({ data: { topic: 'unknown', hub_id: 'one' } }), ['one']), null);
  assert.equal(readMetadata('{', ['one']), null);
  assert.equal(readMetadata('a'.repeat(131073), ['one']), null);
});
test('reports discard source payload, credentials, unauthorized hubs and invalid counters', () => {
  const report = sanitizeReport({ connected: true, opens: -1, messages: Infinity,
    access_token: 'secret', raw_data: { customer_phone: 'private' },
    events: { one: { [TOPICS[0]]: 2, unexpected: 9 }, other: { [TOPICS[0]]: 5 } }
  }, ['one']);
  assert.equal(report.opens, 0);
  assert.equal(report.messages, 0);
  assert.deepEqual(Object.keys(report.events), ['one']);
  assert.equal(report.events.one[TOPICS[0]], 2);
  assert.ok(!JSON.stringify(report).match(/secret|private|unexpected|other/));
  assert.equal(sanitizeReport(null, ['one']), null);
});
