// WSS is an invalidation signal. REST and the existing importer own business data.
export const EVENT_STATUSES = ['PRE_ORDER', 'DOING', 'PICK', 'FINISH', 'CANCEL'];

export async function lease(client, owner, action) {
  const { data, error } = await client.rpc('nexpos_sync_lease', { p_owner: owner, p_action: action });
  if (error) throw new Error('sync_lease_unavailable');
  if (!data && action !== 'acquire' && action !== 'release') throw new Error('sync_lease_lost');
  return data === true;
}

export async function commitOrder(client, input) {
  const { data, error } = await client.rpc('nexpos_commit_order', input);
  // Database error text may contain customer values; expose only a stable code.
  if (error) throw new Error(`sync_commit_failed:${error.code || 'unknown'}`);
  if (!data?.row?.id) throw new Error('sync_commit_missing_order');
  if (data.stale) throw new Error('sync_stale_snapshot_retry');
  return data;
}

export function scopedRows(rows, hubId) {
  return rows.filter(row => String(row.hub_id || row.nexpos_hub_id || '') === hubId);
}
