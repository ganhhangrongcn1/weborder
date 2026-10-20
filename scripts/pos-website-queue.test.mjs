import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../ghr-pos-mobile-native/src/services/pos/posPickupOrderService.js', import.meta.url), 'utf8');
async function loadService(rows, failAt = -1) {
  const ranges = [];
  globalThis.__websiteQueueTestClient = {
    from() {
      const query = {};
      for (const key of ['select', 'or', 'gte', 'lt', 'order']) query[key] = () => query;
      query.range = async (from, to) => {
        ranges.push([from, to]);
        return from === failAt ? { error: { message: 'offline' } } : { data: rows.slice(from, to + 1) };
      };
      return query;
    }
  };
  const code = source.replace('import { supabase } from "../supabase/client";', 'const supabase = globalThis.__websiteQueueTestClient;');
  const service = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${Math.random()}`);
  return { service, ranges };
}
const webOrder = { id: 'web', branch_uuid: 'branch', fulfillment_type: 'pickup', payment_method: 'cash', status: 'pending', metadata: { source: 'website' } };

test('web orders remain visible behind more than 80 counter sales', async () => {
  const rows = Array.from({ length: 90 }, (_, i) => ({ ...webOrder, id: `pos-${i}`, metadata: { source: 'pos_mobile' } }));
  rows.push(webOrder, { ...webOrder, id: 'phone', metadata: { source: 'pos_mobile', deviceMode: 'phone' } });
  const { service, ranges } = await loadService(rows);
  const result = await service.getPosWebsiteOrders({ branchUuid: 'branch', limit: 80 });
  assert.deepEqual(result.pickupOrders.map(row => row.id), ['web', 'phone']);
  assert.deepEqual(ranges, [[0, 79], [80, 159]]);
});

test('a failed later page rejects instead of returning an incomplete queue', async () => {
  const { service } = await loadService(Array.from({ length: 80 }, () => webOrder), 80);
  await assert.rejects(service.getPosWebsiteOrders({ branchUuid: 'branch', limit: 80 }), /offline/);
});

test('completed and cancelled orders stay out of the active queue', async () => {
  const { service } = await loadService([webOrder, { ...webOrder, id: 'cancel', status: 'cancelled' }, { ...webOrder, id: 'done', status: 'completed', metadata: { paymentStatus: 'paid' } }]);
  const result = await service.getPosWebsiteOrders({ branchUuid: 'branch' });
  assert.deepEqual(result.pickupOrders.map(row => row.id), ['web']);
});
