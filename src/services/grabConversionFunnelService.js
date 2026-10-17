import { getAdminSupabaseClient } from './supabase/adminSupabaseClient.js';

export async function getGrabConversionFunnel({ fromDate, toDate, branchUuid = '', sourceId = '' }) {
  const client = await getAdminSupabaseClient();
  if (!client) throw new Error('Supabase Admin chưa sẵn sàng.');
  const { data, error } = await client.functions.invoke('partner-review-source-api', {
    body: { action: 'funnel_report', from_date: fromDate, to_date: toDate, branch_uuid: branchUuid, source_id: sourceId === 'all' ? '' : sourceId },
    signal: globalThis.AbortSignal.timeout(15000)
  });
  if (error || !data?.ok) throw new Error(data?.message || 'Chưa tải được phễu Grab.');
  return data.data;
}

export default getGrabConversionFunnel;
