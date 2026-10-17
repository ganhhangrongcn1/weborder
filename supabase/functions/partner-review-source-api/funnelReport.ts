import { CLOUD_ACCOUNTS } from '../grab-vietsing-pilot/accounts.ts';

const DAY = 86400000;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const ratio = (n, d) => d > 0 ? Math.round(n / d * 10000) / 100 : null;

export function summarizeFunnel(rows) {
  const totals = { reach: 0, visits: 0, baskets: 0, checkouts: 0 };
  for (const row of rows) {
    totals.reach += Number(row.reach_count);
    totals.visits += Number(row.visit_count);
    totals.baskets += Number(row.basket_count);
    totals.checkouts += Number(row.order_count);
  }
  return { ...totals, listingToMenuRate: ratio(totals.visits, totals.reach), menuToCheckoutRate: ratio(totals.checkouts, totals.visits), overallRate: ratio(totals.checkouts, totals.reach) };
}

export default async function getFunnelReport(client, admin, body, reply) {
  const fromDate = String(body.from_date || '');
  const toDate = String(body.to_date || '');
  const requestedBranch = String(body.branch_uuid || '');
  const adminBranch = String(admin.branch_uuid || '');
  const requestedSource = body.source_id && body.source_id !== 'all' ? String(body.source_id) : '';
  if (!validDate(fromDate) || !validDate(toDate) || fromDate > toDate || (Date.parse(toDate) - Date.parse(fromDate)) / DAY > 92) {
    return reply({ ok: false, message: 'Khoảng ngày phễu không hợp lệ (tối đa 93 ngày).' }, 400);
  }
  if (adminBranch && requestedBranch && adminBranch !== requestedBranch) {
    return reply({ ok: false, message: 'Admin không có quyền xem chi nhánh đã chọn.' }, 403);
  }
  const allowed = Object.values(CLOUD_ACCOUNTS);
  if (requestedSource && !allowed.some(account => account.sourceId === requestedSource)) {
    return reply({ ok: false, message: 'Gian hàng phễu không hợp lệ.' }, 400);
  }
  const branch = adminBranch || requestedBranch;
  let sourceQuery = client.from('partner_review_sources')
    .select('id,account_key,merchant_id,display_name,branch_uuid,branch_code,metadata')
    .in('id', requestedSource ? [requestedSource] : allowed.map(account => account.sourceId));
  if (branch) sourceQuery = sourceQuery.eq('branch_uuid', branch);
  const { data: sources, error: sourceError } = await sourceQuery.limit(allowed.length);
  if (sourceError) return reply({ ok: false, message: 'Chưa tải được nguồn phễu Grab.' }, 503);
  const scopedSources = (sources || []).filter(source => {
    const account = CLOUD_ACCOUNTS[source.account_key];
    return account && source.id === account.sourceId && source.merchant_id === account.merchantId && source.branch_uuid && (!branch || source.branch_uuid === branch);
  });
  if (!scopedSources.length) {
    return reply({ ok: true, data: { available: false, reason: 'no_scoped_sources' } });
  }
  let rowQuery = client.from('partner_grab_conversion_funnel_daily')
    .select('source_id,branch_uuid,metric_date,reach_count,visit_count,basket_count,order_count,last_synced_at')
    .in('source_id', scopedSources.map(source => source.id))
    .gte('metric_date', fromDate).lte('metric_date', toDate);
  if (branch) rowQuery = rowQuery.eq('branch_uuid', branch);
  const { data: result, error } = await rowQuery.order('metric_date').order('source_id').limit(93 * scopedSources.length);
  if (error) return reply({ ok: false, message: 'Chưa tải được phễu Grab đã đồng bộ.' }, 503);
  // A source must still match its assigned branch, even for a global admin.
  const sourceBranches = new Map(scopedSources.map(source => [source.id, source.branch_uuid]));
  const rows = (result || []).filter(row => sourceBranches.get(row.source_id) === row.branch_uuid);
  const byDay = new Map();
  const latestBySource = new Map();
  for (const row of rows) {
    if (!byDay.has(row.metric_date)) byDay.set(row.metric_date, []);
    byDay.get(row.metric_date).push(row);
    if (row.last_synced_at > (latestBySource.get(row.source_id) || '')) latestBySource.set(row.source_id, row.last_synced_at);
  }
  const daily = [...byDay].map(([date, items]) => ({ date, ...summarizeFunnel(items), sourceCount: new Set(items.map(row => row.source_id)).size }));
  const expectedDays = Math.round((Date.parse(toDate) - Date.parse(fromDate)) / DAY) + 1;
  const lastSyncedAt = [...latestBySource.values()].sort()[0] || null;
  return reply({ ok: true, data: {
    available: true,
    displayName: scopedSources.length === 1 ? scopedSources[0].display_name : `${scopedSources.length} gian hàng Grab`,
    branchCode: scopedSources.length === 1 ? scopedSources[0].branch_code : null,
    sourceCount: scopedSources.length, coveredSourceCount: latestBySource.size,
    sources: scopedSources.map(source => ({ id: source.id, displayName: source.display_name, branchCode: source.branch_code })),
    fromDate, toDate, basis: 'views_checkout', summary: summarizeFunnel(rows), daily,
    coveredDays: daily.length, expectedDays, coveredStoreDays: rows.length, expectedStoreDays: expectedDays * scopedSources.length, lastSyncedAt,
    syncOk: scopedSources.every(source => source.metadata?.grab_funnel_last_run?.ok === true),
    stale: latestBySource.size < scopedSources.length || !lastSyncedAt || Date.now() - Date.parse(lastSyncedAt) > 3 * 3600000,
    syncIntervalMinutes: 60
  } });
}
