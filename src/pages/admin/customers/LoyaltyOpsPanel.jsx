import { useMemo, useState } from "react";
import {
  auditLoyaltyReconcileBacklog,
  auditLoyaltyReconcilePlan,
  reconcileLoyaltyBacklogSafe
} from "../../../services/loyaltyReconcileService.js";
import { AdminButton, AdminInput, AdminPanel, AdminSelect } from "../ui/index.js";

function formatPoints(value) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("vi-VN")}`;
}

function getRowDelta(row = {}) {
  const directValue = Number(
    row?.points_delta ??
    row?.pointsDelta ??
    row?.event_delta ??
    row?.eventDelta
  );
  if (Number.isFinite(directValue) && directValue !== 0) return directValue;

  const action = String(row?.action || "").toUpperCase();
  const expectedPoints = Number(row?.expected_points ?? row?.expectedPoints ?? 0);
  const pointsSpent = Number(row?.points_spent ?? row?.pointsSpent ?? 0);
  if (action === "SPEND") return -pointsSpent;
  if (action === "SETTLE_EARN") return expectedPoints;
  if (action === "REVERSE_SPEND") return pointsSpent;
  if (action === "REVERSE_EARN") return -expectedPoints;
  return 0;
}

function buildSummary(rows = [], mode = "") {
  return (Array.isArray(rows) ? rows : []).reduce((summary, row) => {
    const classification = String(row?.classification || "").toLowerCase();
    const ok = row?.ok === true;
    const applied = row?.applied === true;

    summary.total += 1;
    if (classification === "safe") summary.safe += 1;
    if (classification === "suspicious") summary.suspicious += 1;
    if (String(row?.action || "").toUpperCase() === "SPEND") summary.spend += 1;
    if (String(row?.action || "").toUpperCase() === "SETTLE_EARN") summary.earn += 1;
    if (applied) summary.applied += 1;
    if (mode === "dry-run-safe" && ok) summary.ready += 1;
    if (mode === "apply-safe" && ok) summary.ready += 1;
    if (!ok && row?.ok !== undefined) summary.failed += 1;
    return summary;
  }, {
    total: 0,
    safe: 0,
    suspicious: 0,
    spend: 0,
    earn: 0,
    applied: 0,
    ready: 0,
    failed: 0
  });
}

function getModeLabel(mode = "") {
  const labels = {
    backlog: "Audit backlog",
    plan: "Phân loại safe/suspicious",
    "dry-run-safe": "Dry-run nhóm safe",
    "apply-safe": "Đã áp dụng nhóm safe"
  };
  return labels[mode] || "Đối soát loyalty";
}

function getStatusLabel(row = {}, mode = "") {
  if (mode === "backlog") {
    return row?.detected_reason || "Cần kiểm tra";
  }
  if (mode === "plan") {
    return row?.classification === "safe"
      ? "Safe"
      : row?.suspicious_reason || "Suspicious";
  }
  if (row?.applied) return "Đã bù";
  if (row?.ok) return row?.message || "Sẵn sàng";
  return row?.message || "Chưa áp dụng";
}

function getStatusTone(row = {}, mode = "") {
  if (mode === "backlog") return "pending";
  if (mode === "plan") {
    return String(row?.classification || "").toLowerCase() === "safe" ? "claimed" : "blocked";
  }
  if (row?.applied) return "claimed";
  if (row?.ok) return "pending";
  return "blocked";
}

export default function LoyaltyOpsPanel({ onRefresh }) {
  const [customerPhone, setCustomerPhone] = useState("");
  const [sourceType, setSourceType] = useState("ORDER");
  const [limit, setLimit] = useState("120");
  const [mode, setMode] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const summary = useMemo(() => buildSummary(rows, mode), [rows, mode]);

  const runAction = async (nextMode) => {
    if (isRunning) return;
    if (nextMode === "apply-safe") {
      const confirmed = window.confirm(
        "Chạy bù điểm thật cho các dòng safe đang lọc. Chỉ nên bấm sau khi đã xem dry-run kỹ. Tiếp tục chứ?"
      );
      if (!confirmed) return;
    }

    const payload = {
      customerPhone: customerPhone.trim(),
      sourceType: sourceType || "",
      limit: Math.max(1, Math.min(500, Number(limit || 120)))
    };

    setIsRunning(true);
    setMessage("");
    try {
      let nextRows = [];
      if (nextMode === "backlog") {
        nextRows = await auditLoyaltyReconcileBacklog(payload);
      } else if (nextMode === "plan") {
        nextRows = await auditLoyaltyReconcilePlan(payload);
      } else if (nextMode === "dry-run-safe") {
        nextRows = await reconcileLoyaltyBacklogSafe({
          ...payload,
          dryRun: true
        });
      } else if (nextMode === "apply-safe") {
        nextRows = await reconcileLoyaltyBacklogSafe({
          ...payload,
          dryRun: false
        });
        await Promise.resolve(onRefresh?.({ forceSupportRefresh: true }));
      }

      setRows(Array.isArray(nextRows) ? nextRows : []);
      setMode(nextMode);
      setMessage(
        nextRows?.length
          ? `${getModeLabel(nextMode)}: ${nextRows.length.toLocaleString("vi-VN")} dòng.`
          : `${getModeLabel(nextMode)}: chưa có dòng nào cần xử lý.`
      );
    } catch (error) {
      setMessage(error?.message || "Không thể chạy đối soát loyalty.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AdminPanel
      title="Phase 5 · Đối soát loyalty"
      description="Kiểm tra backlog, xem nhóm safe/suspicious và chỉ bù tự động các dòng an toàn."
      className="admin-loyalty-card"
    >
      <div className="admin-loyalty-ops-controls">
        <label className="admin-loyalty-field">
          <span>Số điện thoại</span>
          <AdminInput
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            placeholder="Bỏ trống để quét toàn bộ"
          />
        </label>

        <label className="admin-loyalty-field">
          <span>Nguồn đơn</span>
          <AdminSelect value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="ORDER">Website / QR / POS</option>
            <option value="PARTNER_ORDER">Đơn đối tác</option>
          </AdminSelect>
        </label>

        <label className="admin-loyalty-field">
          <span>Số dòng tối đa</span>
          <AdminInput
            type="number"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
        </label>
      </div>

      <div className="admin-loyalty-ops-actions">
        <AdminButton variant="secondary" onClick={() => runAction("backlog")} disabled={isRunning}>
          {isRunning && mode === "backlog" ? "Đang quét..." : "Audit backlog"}
        </AdminButton>
        <AdminButton variant="outline" onClick={() => runAction("plan")} disabled={isRunning}>
          Phân loại safe
        </AdminButton>
        <AdminButton variant="warning" onClick={() => runAction("dry-run-safe")} disabled={isRunning}>
          Dry-run safe
        </AdminButton>
        <AdminButton variant="primary" onClick={() => runAction("apply-safe")} disabled={isRunning}>
          Áp dụng safe
        </AdminButton>
      </div>

      {message ? (
        <p className="admin-loyalty-save-message" role="status">{message}</p>
      ) : null}

      <div className="admin-loyalty-ops-summary">
        <div>
          <span>Tổng dòng</span>
          <strong>{summary.total.toLocaleString("vi-VN")}</strong>
        </div>
        <div>
          <span>Safe</span>
          <strong>{summary.safe.toLocaleString("vi-VN")}</strong>
        </div>
        <div>
          <span>Suspicious</span>
          <strong>{summary.suspicious.toLocaleString("vi-VN")}</strong>
        </div>
        <div>
          <span>Đã áp dụng</span>
          <strong>{summary.applied.toLocaleString("vi-VN")}</strong>
        </div>
      </div>

      <p className="admin-loyalty-note">
        Nhóm safe có thể bù tự động. Nhóm suspicious nên kiểm tra tay trước khi xử lý để tránh cộng/trừ nhầm.
      </p>

      <div className="admin-loyalty-ops-table-wrap">
        <div className="admin-loyalty-ops-table">
          <div className="admin-loyalty-ops-head" aria-hidden="true">
            <span>Đơn</span>
            <span>Action</span>
            <span>Điểm</span>
            <span>Trạng thái</span>
          </div>

          {rows.length ? rows.map((row, index) => (
            <div className="admin-loyalty-ops-row" key={`${row?.source_order_id || row?.sourceOrderId || index}-${row?.action || index}`}>
              <div>
                <strong>{row?.order_code || row?.orderCode || row?.source_order_id || row?.sourceOrderId || "--"}</strong>
                <small>{row?.customer_phone || row?.customerPhone || ""}</small>
              </div>
              <div>
                <strong>{row?.action || "--"}</strong>
                <small>{row?.source_type || row?.sourceType || sourceType}</small>
              </div>
              <div>
                <strong>{formatPoints(getRowDelta(row))}</strong>
                <small>
                  {row?.balance_before !== undefined && row?.balance_after !== undefined
                    ? `${Number(row.balance_before || 0).toLocaleString("vi-VN")} → ${Number(row.balance_after || 0).toLocaleString("vi-VN")}`
                    : "Xem thử trước khi ghi thật"}
                </small>
              </div>
              <div>
                <span className={`crm-point-status crm-point-status--${getStatusTone(row, mode)}`}>
                  {getStatusLabel(row, mode)}
                </span>
              </div>
            </div>
          )) : (
            <div className="admin-loyalty-ops-empty">
              Chưa có dữ liệu. Anh bấm một trong các nút audit ở trên để kiểm tra.
            </div>
          )}
        </div>
      </div>
    </AdminPanel>
  );
}
