import grabCsrfHeaders from './csrf.ts';
import cloudAccount from './accounts.ts';

const DAY = 86400000;
const fields = { reach_count: 'engagement', visit_count: 'conversion_menu', basket_count: 'conversion_basketpage', order_count: 'conversion_checkout' };
const fail = code => Object.assign(new Error(code), { code });

export function funnelRange(now = new Date()) {
  const yesterday = new Date(Date.parse(`${new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10)}T00:00:00Z`) - DAY);
  return {
    fromDate: [new Date(yesterday.getTime() - 30 * DAY).toISOString().slice(0, 10), '2026-10-01'].sort().at(-1),
    toDate: yesterday.toISOString().slice(0, 10)
  };
}

function count(value) {
  if (value === '' || value === null || value === undefined || !/^\d+$/.test(String(value))) throw fail('FUNNEL_INVALID_COUNT');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw fail('FUNNEL_INVALID_COUNT');
  return number;
}

export function normalizeFunnel(summaryPayload, dailyPayload, range) {
  const summary = summaryPayload?.data;
  const daily = dailyPayload?.data;
  if (!summary || Array.isArray(summary) || !Array.isArray(daily)) throw fail('FUNNEL_INVALID_RESPONSE');
  const seen = new Set();
  const rows = daily.map(item => {
    const values = item?.columns;
    const date = String(values?._date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < range.fromDate || date > range.toDate || seen.has(date)) throw fail('FUNNEL_INVALID_DATES');
    seen.add(date);
    return { metric_date: date, ...Object.fromEntries(Object.entries(fields).map(([column, key]) => [column, count(values?.[key])])) };
  });
  const days = Math.round((Date.parse(range.toDate) - Date.parse(range.fromDate)) / DAY) + 1;
  if (days < 1 || days > 31 || rows.length !== days) throw fail('FUNNEL_INCOMPLETE_DATES');
  for (const [column, key] of Object.entries(fields)) {
    if (rows.reduce((sum, row) => sum + row[column], 0) !== count(summary[`total_${key}`])) throw fail('FUNNEL_TOTAL_MISMATCH');
  }
  // Keep exactly the verified metric fields, never upstream credentials or arbitrary JSON.
  const apiSummary = Object.fromEntries(Object.values(fields).map(key => [`total_${key}`, count(summary[`total_${key}`])]));
  for (const key of ['rate_overall', 'rate_engagement_to_menu', 'rate_menu_to_checkout']) {
    if (summary[key] === '' || summary[key] === null || summary[key] === undefined || !Number.isFinite(Number(summary[key])) || Number(summary[key]) < 0 || Number(summary[key]) > 100) throw fail('FUNNEL_INVALID_RATE');
    apiSummary[key] = Number(summary[key]);
  }
  return { rows: rows.sort((a, b) => a.metric_date.localeCompare(b.metric_date)), apiSummary };
}

export default async function syncConversionFunnel({ client, source, jar, requestFetch = fetch, now = new Date() }) {
  const account = cloudAccount(source?.account_key);
  if (!account || source.id !== account.sourceId || source.merchant_id !== account.merchantId || !account.insightsGroupId || !account.insightsStoreId) throw fail('FUNNEL_SOURCE_NOT_ALLOWED');
  const { merchantId: GFID, insightsGroupId: GROUP_ID, insightsStoreId: GPID } = account;
  if (!source.branch_uuid) throw fail('FUNNEL_BRANCH_MISSING');
  const range = funnelRange(now);
  const requestBody = {
    parentEntityIds: [], storeGrabIDs: [GPID], storeZeusIDs: [GFID], businessLines: ['GF'],
    startDate: `${range.fromDate}T00:00:00.000Z`, endDate: `${range.toDate}T00:00:00.000Z`
  };
  const request = async (path, queryName) => {
    const url = `https://merchant.grab.com/troy/insights/v1/${path}?${new URLSearchParams({ merchant_group_id: GROUP_ID, currency: 'VND' })}`;
    const cookie = await jar.getCookieString(url);
    if (!cookie) throw fail('GRAB_SESSION_EXPIRED');
    const response = await requestFetch(url, {
      method: 'POST', redirect: 'error',
      headers: {
        accept: 'application/json', 'content-type': 'application/json', cookie,
        origin: 'https://merchant.grab.com', referer: 'https://merchant.grab.com/insights?tab=customers',
        merchantid: GFID, requestsource: 'troyPortal', 'x-client-id': 'GrabMerchant-Portal', 'x-grabkit-clientid': 'GrabMerchant-Portal',
        'x-agent': 'mexapp', 'x-app-platform': 'web', 'x-app-version': '1.0.0', 'x-device-id': 'ios',
        'x-user-type': 'user-profile', 'x-currency': 'VND', 'x-mex-version': 'v2',
        'x-mex-resource': `zeus_merchant:${GROUP_ID},zeus_store:${GFID}`,
        ...grabCsrfHeaders(cookie, 'POST')
      },
      body: JSON.stringify({ ...requestBody, queryNames: [queryName] }), signal: AbortSignal.timeout(20000)
    });
    for (const value of response.headers.getSetCookie?.() || []) await jar.setCookie(value, url);
    if (!response.ok) {
      await response.body?.cancel();
      throw fail(response.status === 401 ? 'GRAB_SESSION_EXPIRED' : response.status === 403 ? 'FUNNEL_FORBIDDEN' : response.status === 429 ? 'FUNNEL_RATE_LIMITED' : 'FUNNEL_UPSTREAM_ERROR');
    }
    return response.json();
  };
  const summary = await request('summary', 'conversion-funnel-summary');
  const daily = await request('list', 'conversion-funnel-daily');
  const normalized = normalizeFunnel(summary, daily, range);
  const at = now.toISOString();
  const rows = normalized.rows.map(row => ({
    ...row, source_id: source.id, branch_uuid: source.branch_uuid, branch_code: source.branch_code,
    last_synced_at: at, updated_at: at,
    raw_data: { basis: 'views_checkout', source: 'grab-insights-api', period: range, api_summary: normalized.apiSummary }
  }));
  const { error } = await client.from('partner_grab_conversion_funnel_daily').upsert(rows, { onConflict: 'source_id,metric_date' });
  if (error) throw fail('FUNNEL_PERSIST_FAILED');
  return { ok: true, ...range, rows: rows.length, at };
}
