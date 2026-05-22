function formatAuditRows(rows = [], labelMap = {}, limit = 10) {
  return (rows || [])
    .slice(0, limit)
    .map((item) => `${labelMap[item.key] || item.key}: ${item.count}`)
    .join(" · ");
}

export default function AdminRequestAuditBadge({ audit, onReset }) {
  const total60m = Number(audit?.total60m || 0);
  const total5m = Number(audit?.total5m || 0);
  const labelMap = {
    orders: "orders",
    order_items: "order_items",
    partner_orders: "partner_orders",
    partner_order_items: "partner_order_items",
    profiles: "khách hàng",
    app_configs: "app_configs",
    loyalty_accounts: "loyalty_accounts",
    "read web orders snapshot": "đơn web",
    "read partner orders": "đơn app",
    "read partner order items": "món app",
    "crm loyalty config": "CRM cấu hình điểm",
    "crm customer meta": "CRM ghi chú khách",
    "crm registered profiles": "CRM hồ sơ khách",
    "crm loyalty summary": "CRM điểm khách",
    "manual refresh web orders": "refresh đơn web",
    "order updated web orders": "sau cập nhật đơn"
  };
  const tableText = formatAuditRows(audit?.byTable, labelMap, 8);
  const scopeText = formatAuditRows(audit?.byScope, labelMap, 12);
  const tooltip = [
    "Chỉ đếm request admin phát sinh trên máy này trong 60 phút gần nhất.",
    tableText ? `Theo bảng: ${tableText}` : "",
    scopeText ? `Theo lý do: ${scopeText}` : ""
  ].filter(Boolean).join("\n");

  return (
    <div
      title={tooltip}
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto minmax(260px, 1fr) auto",
        alignItems: "start",
        gap: 8,
        width: "100%",
        minHeight: 34,
        border: "1px dashed #cbd5e1",
        background: "#f8fafc",
        borderRadius: 8,
        padding: "6px 8px",
        color: "#475569",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.35,
        boxSizing: "border-box"
      }}
    >
      <span>Admin đọc: {total60m} req/60p</span>
      <span style={{ color: "#64748b", fontWeight: 700 }}>5p: {total5m}</span>
      <span
        style={{
          color: "#64748b",
          display: "grid",
          gap: 3,
          fontWeight: 700,
          minWidth: 0,
          whiteSpace: "normal",
          wordBreak: "break-word"
        }}
      >
        {tableText ? <span>Bảng: {tableText}</span> : null}
        {scopeText ? <span>Lý do: {scopeText}</span> : null}
      </span>
      <button
        type="button"
        onClick={onReset}
        style={{
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          color: "#475569",
          borderRadius: 6,
          padding: "4px 7px",
          fontSize: 11,
          fontWeight: 900,
          cursor: "pointer"
        }}
      >
        Reset
      </button>
    </div>
  );
}
