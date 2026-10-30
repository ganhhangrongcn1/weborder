// WSS is an invalidation signal. REST and the existing importer own business data.
export const EVENT_STATUSES = ['PRE_ORDER', 'DOING', 'PICK', 'FINISH', 'CANCEL'];

export async function lease(client, owner, action) {
  const { data, error } = await client.rpc('nexpos_sync_lease', { p_owner: owner, p_action: action });
  if (error) throw new Error('sync_lease_unavailable');
  if (!data && action !== 'acquire' && action !== 'release') throw new Error('sync_lease_lost');
  return data === true;
}

export async function commitOrder(client, input, idEvent = null) {
  const args = idEvent ? { ...input, p_hub: idEvent.hub_id, p_source_id: idEvent.order_id,
    p_generation: idEvent.generation } : input;
  const { data, error } = await client.rpc(idEvent ? 'nexpos_commit_id_order' : 'nexpos_commit_order', args);
  // Database error text may contain customer values; expose only a stable code.
  if (error) throw new Error(`sync_commit_failed:${error.code || 'unknown'}`);
  if (!data?.row?.id) throw new Error('sync_commit_missing_order');
  if (data.stale) throw new Error('sync_stale_snapshot_retry');
  return data;
}

export function scopedRows(rows, hubId) {
  return rows.filter(row => String(row.hub_id || row.nexpos_hub_id || '') === hubId);
}

export function normalizeDetail(detail, expectedId, hubId) {
  // Detail API: order_id is the immutable ID, short_order_id is the display code.
  // List API: id is the immutable ID, order_id is the display code.
  const explicitId = detail.id || detail._id || detail.order_uuid || detail.orderId;
  const identity = explicitId || detail.order_id;
  const code = detail.short_order_id || (explicitId ? detail.order_id : '');
  if (identity !== expectedId || !code || scopedRows([detail], hubId).length !== 1) {
    throw new Error('sync_detail_scope_mismatch');
  }
  return { ...detail, id: expectedId, order_id: code };
}
