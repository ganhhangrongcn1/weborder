import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { readSignal, sanitizeSignals } from '../supabase/functions/nexpos-event-observer/signals.mjs';
import { createSignalDelivery } from '../services/nexpos-events/signalDelivery.mjs';

const hub = '69e18c814673b293b04be1ab';
const signal = ids => ({ hub_id: hub, topic: 'saas_order_status_change', order_ids: ids, received_at: '2026-10-30T09:00:00Z' });

test('live status envelope preserves opaque IDs and drops raw customer/token fields', () => {
  const raw = JSON.stringify({ data: { hub_ids: [hub, 'other'], topic: 'saas_order_status_change',
    order_ids: ['123456789012345', 'source-opaque-id-26-letters'], customer_phone: 'private', token: 'private' } });
  const parsed = readSignal(raw, [hub]);
  assert.deepEqual(parsed[0].order_ids, ['123456789012345', 'source-opaque-id-26-letters']);
  assert.ok(!JSON.stringify(parsed).includes('private'));
  assert.equal(parsed.length, 1);
  assert.equal(sanitizeSignals(parsed, ['other']), null);
  assert.equal(sanitizeSignals([{ ...signal(['x']), topic: 'arbitrary' }], [hub]), null);
  assert.deepEqual(readSignal(JSON.stringify({ data: { hub_id: hub, topic: 'saas_notifications', order_ids: ['x'] } }), [hub])[0].order_ids, []);
});

test('first event sends immediately; events while busy are coalesced and delivered afterwards', async () => {
  const calls = [];
  let finish;
  const delivery = createSignalDelivery({ delay: 5, send: batch => {
    calls.push(batch);
    return calls.length === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve();
  } });
  delivery.push([signal(['one'])]);
  assert.equal(calls.length, 1);
  delivery.push([signal(['two'])]);
  delivery.push([signal(['two', 'three'])]);
  assert.equal(calls.length, 1);
  finish();
  await sleep(25);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1][0].order_ids, ['two', 'three']);
  delivery.stop();
});

test('failed delivery retries the same IDs; overflow reconciles the HUB instead of truncating', async () => {
  const calls = [];
  const delivery = createSignalDelivery({ delay: 5, send: async batch => {
    calls.push(batch);
    if (calls.length === 1) throw new Error('simulated network failure');
  } });
  delivery.push([signal(['one'])]);
  await sleep(35);
  assert.deepEqual(calls[1][0].order_ids, ['one']);
  delivery.stop();
  let finish;
  const overflow = [];
  const d = createSignalDelivery({ delay: 5, send: batch => {
    overflow.push(batch);
    return overflow.length === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve();
  } });
  d.push([signal(['initial'])]);
  d.push([signal(Array.from({ length: 32 }, (_, i) => 'id' + i))]);
  d.push([signal(['id33'])]);
  finish();
  await sleep(25);
  assert.deepEqual(overflow[1][0].order_ids, []);
  d.stop();
});
