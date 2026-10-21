import { supabase } from '../supabase/client';

// One server-queued receipt is shared by all POS devices in the branch.
export async function readWebsitePaidReceiptStatus(orderId, branchUuid) {
  if (!supabase || !orderId || !branchUuid) return { ok: false, message: 'Thiếu thông tin bill website.' };
  const { data, error } = await supabase.from('print_jobs').select('status,error_message')
    .eq('order_id', orderId).eq('branch_uuid', branchUuid).eq('source_type', 'website_paid_receipt')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false, message: 'Chưa đọc được trạng thái bill website. Kiểm tra trạm in trước khi in lại.' };
  if (!data) return null; // Compatibility when the database migration is not installed yet.
  return { ok: data.status !== 'failed', message: data.status === 'printed'
    ? ' Trạm in đã in bill website sau thanh toán, kèm tem đã xác nhận.'
    : data.status === 'failed' ? ` Chưa in được bill website: ${data.error_message || 'kiểm tra máy in.'}`
    : ' Bill website sau thanh toán đang chờ trạm in tại quán.' };
}
