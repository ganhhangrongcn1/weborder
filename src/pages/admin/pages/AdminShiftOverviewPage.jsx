import { useEffect, useMemo, useState } from "react";
import { AdminButton, AdminCard, AdminInput, AdminSelect } from "../ui/index.js";
import { buildBranchFilterOptions } from "../../../services/branchIdentityService.js";
import {
  getShiftHealth,
  readAdminShiftOverview
} from "../../../services/adminShiftOverviewService.js";
import {
  buildVietnamDateRange,
  toVietnamDateInputValue
} from "../../../utils/adminDateRange.js";

function formatMoney(value = 0) {
  return `${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("vi-VN")}đ`;
}

function formatSignedMoney(value = 0) {
  const amount = Math.round(Number(value) || 0);
  if (amount === 0) return "0đ";
  const prefix = amount > 0 ? "+" : "-";
  return `${prefix}${Math.abs(amount).toLocaleString("vi-VN")}đ`;
}

function formatDateTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getBranchShortLabel(label = "") {
  const text = String(label || "").trim();
  const match = text.match(/(?:Ganh Hang Rong\s*-\s*)?(.+)/i);
  return (match?.[1] || text || "Chi nhánh").replace(/\s+/g, " ");
}

function getDateText(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildWeekStartText() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return getDateText(monday);
}

function ShiftMetric({ label, value, detail = "", tone = "" }) {
  return (
    <article className={`admin-shift-metric ${tone ? `is-${tone}` : ""}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function ShiftStatusBadge({ health }) {
  return (
    <span className={`admin-shift-health-badge is-${health.tone}`}>
      {health.label}
    </span>
  );
}

export default function AdminShiftOverviewPage({
  branches = [],
  selectedBranchFilter = "all",
  setSelectedBranchFilter
}) {
  const todayText = toVietnamDateInputValue();
  const [datePreset, setDatePreset] = useState("today");
  const [dateFrom, setDateFrom] = useState(todayText);
  const [dateTo, setDateTo] = useState(todayText);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const branchOptions = useMemo(() => buildBranchFilterOptions(branches), [branches]);
  const activeBranch = useMemo(
    () => branchOptions.find((branch) => branch.value === selectedBranchFilter) || null,
    [branchOptions, selectedBranchFilter]
  );

  const applyPreset = (preset) => {
    const now = new Date();
    if (preset === "today") {
      const value = getDateText(now);
      setDateFrom(value);
      setDateTo(value);
    }
    if (preset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const value = getDateText(yesterday);
      setDateFrom(value);
      setDateTo(value);
    }
    if (preset === "week") {
      setDateFrom(buildWeekStartText());
      setDateTo(getDateText(now));
    }
    if (preset === "month") {
      setDateFrom(`${getDateText(now).slice(0, 7)}-01`);
      setDateTo(getDateText(now));
    }
    setDatePreset(preset);
  };

  const refreshShifts = async () => {
    setLoading(true);
    setMessage("");
    const range = buildVietnamDateRange(dateFrom, dateTo);
    const result = await readAdminShiftOverview({
      ...range,
      branchUuid: selectedBranchFilter === "all" ? "" : selectedBranchFilter
    });
    setLoading(false);
    setShifts(result.shifts || []);
    setMessage(result.message || "");
  };

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setLoading(true);
      setMessage("");
      const range = buildVietnamDateRange(dateFrom, dateTo);
      const result = await readAdminShiftOverview({
        ...range,
        branchUuid: selectedBranchFilter === "all" ? "" : selectedBranchFilter
      });
      if (disposed) return;
      setLoading(false);
      setShifts(result.shifts || []);
      setMessage(result.message || "");
    };
    load();
    return () => {
      disposed = true;
    };
  }, [dateFrom, dateTo, selectedBranchFilter]);

  const summary = useMemo(() => {
    return shifts.reduce((acc, shift) => {
      const health = getShiftHealth(shift);
      acc.total += 1;
      acc.cashRevenue += Number(shift.cashSales || 0);
      acc.transferRevenue += Number(shift.qrSales || 0);
      if (health.tone === "danger") acc.problem += 1;
      if (health.tone === "success") acc.ok += 1;
      return acc;
    }, {
      total: 0,
      ok: 0,
      problem: 0,
      cashRevenue: 0,
      transferRevenue: 0
    });
  }, [shifts]);

  const totalRevenue = summary.cashRevenue + summary.transferRevenue;

  return (
    <div className="admin-shift-page">
      <section className="admin-shift-toolbar">
        <div className="admin-orders-branch-switcher">
          <span>Chi nhánh</span>
          <div>
            <button
              type="button"
              className={selectedBranchFilter === "all" ? "is-active" : ""}
              onClick={() => setSelectedBranchFilter?.("all")}
            >
              Tất cả
            </button>
            {branchOptions.map((branch) => (
              <button
                key={branch.value}
                type="button"
                className={branch.value === selectedBranchFilter ? "is-active" : ""}
                onClick={() => setSelectedBranchFilter?.(branch.value)}
                title={branch.label}
              >
                {getBranchShortLabel(branch.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-shift-period-controls">
          <label className="admin-orders-period-select">
            <span>Kỳ</span>
            <AdminSelect
              value={datePreset}
              onChange={(event) => {
                const nextPreset = event.target.value;
                if (nextPreset === "custom") {
                  setDatePreset("custom");
                  return;
                }
                applyPreset(nextPreset);
              }}
              options={[
                { value: "today", label: "Hôm nay" },
                { value: "yesterday", label: "Hôm qua" },
                { value: "week", label: "Tuần này" },
                { value: "month", label: "Tháng này" },
                { value: "custom", label: "Tùy chỉnh..." }
              ]}
            />
          </label>
          {datePreset === "custom" ? (
            <>
              <label className="admin-orders-period-date">
                <span>Từ ngày</span>
                <AdminInput
                  type="date"
                  value={dateFrom || ""}
                  max={dateTo || todayText}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="admin-orders-period-date">
                <span>Đến ngày</span>
                <AdminInput
                  type="date"
                  value={dateTo || ""}
                  min={dateFrom || ""}
                  max={todayText}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <AdminButton type="button" variant="secondary" onClick={refreshShifts} disabled={loading}>
            {loading ? "Đang tải..." : "Tải lại"}
          </AdminButton>
        </div>
      </section>

      <section className="admin-shift-summary-grid">
        <ShiftMetric label="Tổng ca đã kết" value={summary.total.toLocaleString("vi-VN")} />
        <ShiftMetric label="Ca đủ tiền" value={summary.ok.toLocaleString("vi-VN")} tone="success" />
        <ShiftMetric label="Ca thiếu tiền" value={summary.problem.toLocaleString("vi-VN")} tone="danger" />
        <ShiftMetric
          label="Doanh thu đã kết ca"
          value={formatMoney(totalRevenue)}
          detail={`Tiền mặt ${formatMoney(summary.cashRevenue)} • Chuyển khoản ${formatMoney(summary.transferRevenue)}`}
          tone="money"
        />
      </section>

      {message ? (
        <AdminCard className="admin-shift-message">
          <strong>{message}</strong>
          <span>Màn này chỉ đọc dữ liệu kết ca POS, không thay đổi số liệu.</span>
        </AdminCard>
      ) : null}

      <AdminCard className="admin-shift-table-card">
        <div className="admin-shift-table-head">
          <span>Ca</span>
          <span>Chi nhánh</span>
          <span>Doanh thu</span>
          <span>Két tiền mặt</span>
          <span>Tiền thực đếm</span>
          <span>Chênh lệch</span>
          <span>Trạng thái</span>
        </div>

        <div className="admin-shift-table-body">
          {loading && !shifts.length ? (
            <div className="admin-shift-empty">Đang tải tổng quan ca...</div>
          ) : null}

          {!loading && !shifts.length ? (
            <div className="admin-shift-empty">
              Chưa có ca nào đã kết trong kỳ {activeBranch ? `ở ${activeBranch.label}` : "đã chọn"}.
            </div>
          ) : null}

          {shifts.map((shift) => {
            const health = getShiftHealth(shift);
            const shiftRevenue = Number(shift.cashSales || 0) + Number(shift.qrSales || 0);
            return (
              <article key={shift.id} className={`admin-shift-row is-${health.tone}`}>
                <div className="admin-shift-cell">
                  <strong>{String(shift.id || "").slice(0, 8).toUpperCase() || "--"}</strong>
                  <small>Mở: {formatDateTime(shift.openedAt)}</small>
                  <small>{shift.closedAt ? `Kết: ${formatDateTime(shift.closedAt)}` : "Chưa kết ca"}</small>
                </div>
                <div className="admin-shift-cell">
                  <strong>{shift.branchName || "Chi nhánh"}</strong>
                  <small>Quầy: {shift.registerKey || "main"}</small>
                  <small>Thu ngân: {shift.cashierName || "--"}</small>
                </div>
                <div className="admin-shift-cell admin-shift-money">
                  <strong>{formatMoney(shiftRevenue)}</strong>
                  <small>Tiền mặt {formatMoney(shift.cashSales)}</small>
                  <small>Chuyển khoản {formatMoney(shift.qrSales)}</small>
                </div>
                <div className="admin-shift-cell admin-shift-money">
                  <strong>{formatMoney(shift.expectedCash)}</strong>
                  <small>Tiền đầu ca {formatMoney(shift.openingCash)}</small>
                  <small>Bán hàng tiền mặt {formatMoney(shift.cashSales)}</small>
                </div>
                <div className="admin-shift-cell admin-shift-money">
                  <strong>{shift.closingCashCounted === null ? "--" : formatMoney(shift.closingCashCounted)}</strong>
                  <small>{shift.status === "closed" ? "Số tiền đã nhập khi kết ca" : "Chưa nhập tiền kết ca"}</small>
                </div>
                <div className="admin-shift-cell admin-shift-diff">
                  <strong>{shift.cashDifference === null ? "--" : formatSignedMoney(shift.cashDifference)}</strong>
                  <small>{health.note}</small>
                  <small>{shift.cancelledOrderCount} đơn hủy</small>
                </div>
                <div className="admin-shift-cell">
                  <ShiftStatusBadge health={health} />
                  <small>{shift.paidOrderCount} đơn đã ghi nhận</small>
                  <small>{shift.status === "closed" ? "Đã kết ca" : "Đang mở ca"}</small>
                </div>
              </article>
            );
          })}
        </div>
      </AdminCard>
    </div>
  );
}
