import test from 'node:test';
import assert from 'node:assert/strict';
import syncFunnel, { funnelRange, normalizeFunnel } from '../supabase/functions/grab-vietsing-pilot/funnel.ts';
import getReport, { summarizeFunnel } from '../supabase/functions/partner-review-source-api/funnelReport.ts';

const source = { id: '6281a325-599e-46f3-a36c-9b28b687d50a', account_key: 'grab_vietsing', merchant_id: '5-C8EKJAE1WCADLA', branch_uuid: 'branch', branch_code: 'CN04' };
const now = new Date('2026-10-03T03:00:00Z');
const range = { fromDate: '2026-10-01', toDate: '2026-10-02' };
const summary = { data: { total_engagement: '1000', total_conversion_menu: '100', total_conversion_basketpage: '50', total_conversion_checkout: '10', rate_overall: '1', rate_engagement_to_menu: '10', rate_menu_to_checkout: '10' } };
const daily = { data: [
  { columns: { _date: '2026-10-01T00:00:00Z', engagement: '100', conversion_menu: '90', conversion_basketpage: '40', conversion_checkout: '9' } },
  { columns: { _date: '2026-10-02T00:00:00Z', engagement: '900', conversion_menu: '10', conversion_basketpage: '10', conversion_checkout: '1' } }
] };
const jar = { getCookieString: async () => 'mexusers_authn_token_jti=test-secret', setCookie: async () => {} };

test('closed Vietnam days, capped lookback and explicit initial date', () => {
  assert.deepEqual(funnelRange(now), range);
  assert.equal(funnelRange(new Date('2026-10-03T16:59:00Z')).toDate, '2026-10-02');
  assert.equal(funnelRange(new Date('2026-10-03T17:01:00Z')).toDate, '2026-10-03');
  assert.equal(funnelRange(new Date('2026-12-03T03:00:00Z')).fromDate, '2026-11-02');
});

test('successful requests persist only Vietsing, normalized fields, and no secrets', async () => {
  let saved;
  const calls = [];
  const client = { from: table => ({ upsert: async (rows, options) => { saved = { table, rows, options }; return {}; } }) };
  const result = await syncFunnel({ client, source, jar, now, requestFetch: async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers['x-mex-version'], 'v2');
    assert.match(options.headers['x-mex-resource'], /zeus_store:5-C8EKJAE1WCADLA/);
    return Response.json(url.includes('/summary?') ? summary : daily);
  } });
  assert.equal(calls.length, 2);
  assert.equal(result.rows, 2);
  assert.equal(saved.table, 'partner_grab_conversion_funnel_daily');
  assert.equal(saved.options.onConflict, 'source_id,metric_date');
  assert.ok(saved.rows.every(r => r.source_id === source.id && r.branch_uuid === source.branch_uuid));
  assert.ok(!JSON.stringify(saved).includes('test-secret'));
});

test('another source cannot cause network requests or persistence', async () => {
  await assert.rejects(syncFunnel({ client: null, source: { ...source, merchant_id: 'other' }, jar, now, requestFetch: () => assert.fail('network') }), e => e.code === 'FUNNEL_SOURCE_NOT_ALLOWED');
});

for (const [status, code] of [[401, 'GRAB_SESSION_EXPIRED'], [403, 'FUNNEL_FORBIDDEN'], [429, 'FUNNEL_RATE_LIMITED']]) {
  test(`HTTP ${status} is classified without retries or overwriting last good data`, async () => {
    let calls = 0;
    await assert.rejects(syncFunnel({ client: { from: () => assert.fail('write') }, source, jar, now, requestFetch: async () => { calls++; return Response.json({ token: 'never expose' }, { status }); } }), e => e.code === code && !e.message.includes('never expose'));
    assert.equal(calls, 1);
  });
}

test('incomplete, duplicate or missing metrics cannot be stored as zeros', () => {
  assert.throws(() => normalizeFunnel(summary, { data: [] }, range), /INCOMPLETE/);
  assert.throws(() => normalizeFunnel(summary, { data: [daily.data[0], daily.data[0]] }, range), /INVALID_DATES/);
  const bad = structuredClone(daily); delete bad.data[0].columns.engagement;
  assert.throws(() => normalizeFunnel(summary, bad, range), /INVALID_COUNT/);
  const mismatch = structuredClone(summary); mismatch.data.total_engagement = '999';
  assert.throws(() => normalizeFunnel(mismatch, daily, range), /TOTAL_MISMATCH/);
});

test('report rates use totals rather than averaging daily percentages; zero denominator is null', () => {
  const { rows } = normalizeFunnel(summary, daily, range);
  assert.equal(summarizeFunnel(rows).overallRate, 1);
  assert.equal(summarizeFunnel(rows).listingToMenuRate, 10);
  assert.equal(summarizeFunnel([]).overallRate, null);
});

test('branch-scoped admin cannot request another branch before database access', async () => {
  const result = await getReport({ from: () => assert.fail('database') }, { branch_uuid: 'own' }, { from_date: range.fromDate, to_date: range.toDate, branch_uuid: 'other' }, (body, status) => ({ body, status }));
  assert.equal(result.status, 403);
});

test('invalid calendar dates and unbounded ranges are rejected', async () => {
  for (const body of [{ from_date: '2026-02-30', to_date: '2026-03-01' }, { from_date: '2026-01-01', to_date: '2026-12-01' }]) {
    const result = await getReport({ from: () => assert.fail('database') }, {}, body, (value, status) => ({ value, status }));
    assert.equal(result.status, 400);
  }
});
import { CLOUD_ACCOUNTS } from '../supabase/functions/grab-vietsing-pilot/accounts.ts';

for (const [key, account] of Object.entries(CLOUD_ACCOUNTS)) {
  test(`${key}: collector uses its verified group, store and source mapping`, async () => {
    const branchSource = { ...source, id: account.sourceId, account_key: key, merchant_id: account.merchantId };
    const calls = [];
    await syncFunnel({ source: branchSource, jar, now,
      client: { from: () => ({ upsert: async rows => { assert.ok(rows.every(row => row.source_id === account.sourceId)); return {}; } }) },
      requestFetch: async (url, options) => {
        calls.push(url);
        assert.equal(new URL(url).searchParams.get('merchant_group_id'), account.insightsGroupId);
        assert.equal(options.headers['x-mex-resource'], `zeus_merchant:${account.insightsGroupId},zeus_store:${account.merchantId}`);
        const body = JSON.parse(options.body);
        assert.deepEqual(body.storeGrabIDs, [account.insightsStoreId]);
        assert.deepEqual(body.storeZeusIDs, [account.merchantId]);
        return Response.json(url.includes('/summary?') ? summary : daily);
      } });
    assert.equal(calls.length, 2);
  });
}

function reportClient(sources, rows) {
  const queries = [];
  return { queries, from(table) {
    const filters = [];
    const query = { select() { return this; }, in(k, values) { filters.push([k, v => values.includes(v)]); return this; },
      eq(k, value) { filters.push([k, v => v === value]); return this; },
      gte(k, value) { filters.push([k, v => v >= value]); return this; }, lte(k, value) { filters.push([k, v => v <= value]); return this; },
      order() { return this; }, async limit(limit) {
        queries.push({ table, columns: filters.map(([key]) => key), limit });
        const data = table === 'partner_review_sources' ? sources : rows;
        return { data: data.filter(row => filters.every(([key, testValue]) => testValue(row[key]))).slice(0, limit) };
      } };
    return query;
  } };
}
const reportSources = Object.entries(CLOUD_ACCOUNTS).map(([key, account], index) => ({
  id: account.sourceId, account_key: key, merchant_id: account.merchantId,
  branch_uuid: index === 2 ? 'branch-1' : `branch-${index}`, display_name: key,
  metadata: { grab_funnel_last_run: { ok: true } }
}));
const reportRows = reportSources.flatMap(item => normalizeFunnel(summary, daily, range).rows.map(row => ({ ...row, source_id: item.id, branch_uuid: item.branch_uuid, last_synced_at: new Date().toISOString() })));
const reportBody = { from_date: range.fromDate, to_date: range.toDate };
const reply = (body, status = 200) => ({ ...body, status });

test('global report aggregates five stores with weighted rates and complete store-day coverage', async () => {
  const db = reportClient(reportSources, reportRows);
  const result = await getReport(db, {}, reportBody, reply);
  assert.equal(result.data.summary.reach, 5000);
  assert.equal(result.data.summary.overallRate, 1);
  assert.equal(result.data.daily.length, 2);
  assert.equal(result.data.daily[0].sourceCount, 5);
  assert.equal(result.data.coveredStoreDays, 10);
  assert.equal(result.data.expectedStoreDays, 10);
  assert.equal(result.data.stale, false);
  assert.equal(db.queries[1].limit, 465);
});

test('branch admin without an explicit filter sees only its two stores', async () => {
  const db = reportClient(reportSources, reportRows);
  const result = await getReport(db, { branch_uuid: 'branch-1' }, reportBody, reply);
  assert.equal(result.data.sourceCount, 2);
  assert.equal(result.data.summary.reach, 2000);
  assert.ok(db.queries.every(query => query.columns.includes('branch_uuid')));
});

test('a selected source from another branch returns no data', async () => {
  const result = await getReport(reportClient(reportSources, reportRows), { branch_uuid: 'branch-1' }, { ...reportBody, source_id: reportSources[0].id }, reply);
  assert.equal(result.data.available, false);
});

test('same-branch stores stay separate when a single source is selected', async () => {
  const result = await getReport(reportClient(reportSources, reportRows), {}, { ...reportBody, branch_uuid: 'branch-1', source_id: reportSources[2].id }, reply);
  assert.equal(result.data.sourceCount, 1);
  assert.equal(result.data.summary.reach, 1000);
  assert.equal(result.data.sources[0].id, reportSources[2].id);
});

test('missing store-days and rows with mismatched branches are never silently treated as full coverage', async () => {
  const badRows = reportRows.filter(row => row.source_id !== reportSources[4].id);
  badRows.push({ ...reportRows[0], branch_uuid: 'wrong' });
  const result = await getReport(reportClient(reportSources, badRows), {}, reportBody, reply);
  assert.equal(result.data.summary.reach, 4000);
  assert.equal(result.data.coveredStoreDays, 8);
  assert.equal(result.data.expectedStoreDays, 10);
  assert.equal(result.data.stale, true);
});

test('unknown source is rejected before database access', async () => {
  const result = await getReport({ from: () => assert.fail('database') }, {}, { ...reportBody, source_id: 'other' }, reply);
  assert.equal(result.status, 400);
});
