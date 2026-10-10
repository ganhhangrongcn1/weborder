const ORDER_BATCH_SIZE = 100;
const PAGE_SIZE = 500;

// Scope each request to the requested orders and keep a stable page order.
export default async function readOrderItemPages(client, {
  table = "order_items",
  orderIdColumn = "order_id",
  columns,
  orderIds = [],
  signal,
  onRequest
} = {}) {
  const ids = [...new Set(orderIds.filter(Boolean))];
  const rows = [];
  for (let start = 0; start < ids.length; start += ORDER_BATCH_SIZE) {
    const batch = ids.slice(start, start + ORDER_BATCH_SIZE);
    let offset = 0;
    while (true) {
      let query = client.from(table)
        .select(columns, { count: "exact" })
        .in(orderIdColumn, batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (signal) query = query.abortSignal(signal);
      const { data, error, count } = await query;
      onRequest?.();
      if (error) throw error;
      const page = Array.isArray(data) ? data : [];
      rows.push(...page);
      offset += page.length;
      if (!page.length || (Number.isFinite(count) ? offset >= count : page.length < PAGE_SIZE)) break;
    }
  }
  return rows;
}
