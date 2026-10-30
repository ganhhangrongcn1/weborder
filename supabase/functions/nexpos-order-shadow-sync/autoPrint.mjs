import { buildPrintJobPayload } from './receiptCore.bundle.mjs';
import partnerReceiptOrder from './partnerReceiptOrder.bundle.mjs';

export async function dispatchPartnerAutoBills(client, owner) {
  const { data: tasks, error } = await client.rpc('partner_auto_bill_claim', { p_owner: owner });
  if (error) throw new Error('auto_bill_claim_failed');
  let enqueued = 0, failed = 0;
  for (const task of tasks || []) {
    try {
      const order = partnerReceiptOrder(task.order, task.items);
      if (!order.items.length || order.items.some(item => !item.name || item.quantity <= 0)) {
        throw new Error('auto_bill_items_unavailable');
      }
      const payload = buildPrintJobPayload(order, { ...task.printer_options, receiptTemplate: task.template });
      const result = await client.rpc('partner_auto_bill_commit', {
        p_owner: owner, p_order_id: task.order.id,
        p_expected_hash: task.order.nexpos_enrichment_hash, p_payload: payload
      });
      if (result.error) throw new Error('auto_bill_commit_failed');
      if (result.data?.enqueued) enqueued++;
    } catch {
      failed++;
      await client.rpc('partner_auto_bill_retry', { p_owner: owner, p_order_id: task.order.id });
    }
  }
  return { claimed: tasks?.length || 0, enqueued, failed };
}
