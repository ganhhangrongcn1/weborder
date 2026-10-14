/* global jest, test, expect, beforeEach */
jest.mock('../src/services/supabase/client', () => ({ supabase: { from: jest.fn() } }));
import { supabase } from '../src/services/supabase/client';
import { getBusyPosPagerNumbers } from '../src/services/pos/posOrderQueryService';
import createPosReadCoalescer from '../src/utils/posReadCoalescer';

const branch = '11111111-1111-4111-8111-111111111111';
let pages;
let ranges;
let filters;
beforeEach(() => {
  jest.clearAllMocks(); pages = [[]]; ranges = []; filters = [];
  supabase.from.mockImplementation(() => {
    const q = { select: () => q, order: () => q, or: (value) => { filters.push(value); return q; },
      range: (start, end) => { ranges.push([start, end]); return Promise.resolve(pages.shift()); } };
    return q;
  });
});

test('pager lookup scopes canonical and legacy branches and finds an old open bill beyond page one', async () => {
  pages = [{ data: Array.from({ length: 200 }, (_, index) => ({ id: String(index), branch_uuid: branch, status: 'pending', metadata: { pagerNumber: '1' } })) },
    { data: [{ id: 'old', metadata: { branchUuid: branch, pagerNumber: '2' }, status: 'pending' }] }];
  expect(await getBusyPosPagerNumbers({ branchUuid: branch })).toEqual(['01', '02']);
  expect(ranges).toEqual([[0, 199], [200, 399]]);
  expect(filters[0]).toContain(`branch_uuid.eq.${branch}`);
  expect(filters[0]).toContain(`metadata->>branchUuid.eq.${branch}`);
  expect(filters[0]).toContain('metadata->>pagerNumber.not.is.null');
});

test('released, finished, cancelled and other branch pagers remain excluded', async () => {
  pages = [{ data: [
    { branch_uuid: branch, status: 'done', metadata: { pagerNumber: '1' } },
    { branch_uuid: branch, status: 'pending', metadata: { pagerNumber: '2', pagerStatus: 'released' } },
    { branch_uuid: branch, status: 'cancelled', metadata: { pagerNumber: '3' } },
    { branch_uuid: 'other', status: 'pending', metadata: { pagerNumber: '4' } },
    { branch_uuid: branch, status: 'pending', metadata: { pagerNumber: '5' } }
  ] }];
  expect(await getBusyPosPagerNumbers({ branchUuid: branch })).toEqual(['05']);
});

test('failure on a later page is not treated as available pagers', async () => {
  pages = [{ data: Array(200).fill({}) }, { error: { message: 'network failed' } }];
  await expect(getBusyPosPagerNumbers({ branchUuid: branch })).rejects.toThrow('network failed');
});

test('invalid branch cannot create an unscoped pager read', async () => {
  await expect(getBusyPosPagerNumbers({ branchUuid: 'invalid' })).rejects.toThrow();
  expect(supabase.from).not.toHaveBeenCalled();
});

test('summary reads share only overlapping requests for the same scope', async () => {
  const read = createPosReadCoalescer();
  let resolve;
  const fetch = jest.fn(() => new Promise(done => { resolve = done; }));
  const first = read('user:branch:shift:cash', fetch);
  expect(read('user:branch:shift:cash', fetch)).toBe(first);
  await Promise.resolve(); resolve({ total: 5 });
  expect(await first).toEqual({ total: 5 });
  await read('user:branch:shift:cash', () => ({ total: 9 }));
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('fresh close-shift reads bypass pending requests; another account never shares totals', async () => {
  const read = createPosReadCoalescer();
  const old = read('userA:shift', () => new Promise(() => {}));
  const fresh = read('userA:shift', () => ({ total: 20 }), { fresh: true });
  expect(fresh).not.toBe(old);
  expect(await fresh).toEqual({ total: 20 });
  expect(await read('userA:shift', () => ({ total: 21 }))).toEqual({ total: 21 });
  expect(await read('userB:shift', () => ({ total: 30 }))).toEqual({ total: 30 });
});

test('a failed read is evicted so recovery can retry', async () => {
  const read = createPosReadCoalescer();
  await expect(read('scope', () => { throw new Error('offline'); })).rejects.toThrow('offline');
  expect(await read('scope', () => 10)).toBe(10);
});
