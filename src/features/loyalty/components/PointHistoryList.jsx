import { useMemo, useState } from "react";
import AppEmptyState from "../../../components/app/EmptyState.jsx";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import { formatSignedLoyaltyPoints } from "../../../services/loyaltyLedgerUtils.js";
import { getOrderSourceBadge } from "../../../services/partnerOrderService.js";

const CHECKIN_TYPES = new Set(["CHECKIN", "CHECKIN_V2", "MILESTONE"]);
const HISTORY_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "earned", label: "Tích điểm" },
  { id: "spent", label: "Đã dùng" },
  { id: "checkin", label: "Điểm danh" }
];

function getEntryOrderCode(entry = {}) {
  return String(
    entry.displayOrderCode ||
    entry.metadata?.displayOrderCode ||
    entry.metadata?.partnerDisplayOrderCode ||
    entry.partnerOrderCode ||
    entry.metadata?.partnerOrderCode ||
    entry.orderCode ||
    entry.orderId ||
    ""
  ).trim();
}

function normalizeLegacyPointTitle(title = "") {
  const value = String(title || "").trim();
  if (!value) return "Lịch sử điểm";

  return value
    .replace(/^Tich diem don\b/i, "Tích điểm đơn")
    .replace(/^Dung diem don\b/i, "Dùng điểm đơn")
    .replace(/^Hoan diem\b/i, "Hoàn điểm")
    .replace(/^Thu hoi diem\b/i, "Thu hồi điểm")
    .replace(/^Diem danh\b/i, "Điểm danh");
}

export function getPointEntryTitle(entry = {}) {
  const type = String(entry.type || "").toUpperCase();
  const orderCode = getEntryOrderCode(entry);

  if (type === "PARTNER_ORDER_EARN") {
    const source = entry.source || entry.metadata?.partnerSource || "";
    const sourceBadge = getOrderSourceBadge(source);
    return orderCode
      ? `Cộng điểm từ đơn ${sourceBadge.label} ${orderCode}`
      : "Cộng điểm từ đơn đối tác";
  }

  if (type === "ORDER_EARN") return orderCode ? `Cộng điểm từ đơn ${orderCode}` : "Cộng điểm đơn hàng";
  if (type === "ORDER_SPEND") return orderCode ? `Dùng điểm cho đơn ${orderCode}` : "Dùng điểm thanh toán";
  if (type === "ORDER_EARN_REVERSED") return orderCode ? `Thu hồi điểm đơn ${orderCode}` : "Thu hồi điểm đơn hàng";
  if (type === "ORDER_SPEND_REVERSED") return orderCode ? `Hoàn điểm đơn ${orderCode}` : "Hoàn điểm đơn hàng";
  if (type === "CHECKIN" || type === "CHECKIN_V2") return "Điểm danh nhận điểm";
  if (type === "MILESTONE") return "Thưởng chuỗi điểm danh";

  return normalizeLegacyPointTitle(entry.title);
}

function getEntryDate(entry = {}) {
  const raw = String(entry.createdAt || entry.created_at || entry.at || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getDateKey(date) {
  if (!date) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHistoryGroupLabel(date) {
  if (!date) return "Chưa rõ thời gian";
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const entryStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayGap = Math.round((todayStart - entryStart) / 86400000);
  if (dayGap === 0) return "Hôm nay";
  if (dayGap === 1) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatHistoryTime(entry = {}) {
  const raw = String(entry.createdAt || entry.created_at || entry.at || "").trim();
  const date = getEntryDate(entry);
  if (!date) return "Chưa rõ thời gian";
  if (!/[T\s]\d{1,2}:\d{2}/.test(raw)) return date.toLocaleDateString("vi-VN");
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function matchesHistoryFilter(entry, filter) {
  if (filter === "all") return true;
  const type = String(entry?.type || "").toUpperCase();
  const points = Number(entry?.points || 0);
  if (filter === "checkin") return CHECKIN_TYPES.has(type);
  if (filter === "spent") return points < 0;
  if (filter === "earned") return points > 0 && !CHECKIN_TYPES.has(type);
  return true;
}

export default function PointHistoryList({ entries, pageSize = 12 }) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safePageSize = Math.max(5, Number(pageSize || 12));
  const [activeFilter, setActiveFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(safePageSize);
  const loyaltyText = getLoyaltyText();

  const filteredEntries = useMemo(() => (
    safeEntries.filter((entry) => matchesHistoryFilter(entry, activeFilter))
  ), [activeFilter, safeEntries]);

  const visibleGroups = useMemo(() => {
    const groups = [];
    const groupByKey = new Map();

    filteredEntries.slice(0, visibleCount).forEach((entry) => {
      const date = getEntryDate(entry);
      const key = getDateKey(date);
      let group = groupByKey.get(key);
      if (!group) {
        group = { key, label: formatHistoryGroupLabel(date), entries: [] };
        groupByKey.set(key, group);
        groups.push(group);
      }
      group.entries.push(entry);
    });

    return groups;
  }, [filteredEntries, visibleCount]);

  const selectFilter = (filter) => {
    setActiveFilter(filter);
    setVisibleCount(safePageSize);
  };
  const hasMore = visibleCount < filteredEntries.length;
  const remainingCount = Math.min(safePageSize, Math.max(filteredEntries.length - visibleCount, 0));

  return (
    <div className="loyalty-point-history">
      <div className="loyalty-point-history__filters" role="group" aria-label="Lọc lịch sử điểm">
        {HISTORY_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={activeFilter === filter.id ? "is-active" : ""}
            aria-pressed={activeFilter === filter.id}
            onClick={() => selectFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {visibleGroups.map((group) => (
        <section key={group.key} className="loyalty-point-history__group" aria-labelledby={`point-history-${group.key}`}>
          <h3 id={`point-history-${group.key}`}>{group.label}</h3>
          <div className="loyalty-point-history__list">
            {group.entries.map((entry, index) => {
              const points = Number(entry?.points || 0);
              return (
                <article
                  key={entry.id || `${group.key}-${entry.type || "point"}-${index}`}
                  className="loyalty-point-history__item"
                >
                  <span className={`loyalty-point-history__mark ${points < 0 ? "is-spent" : "is-earned"}`} aria-hidden="true">
                    {points < 0 ? "−" : "+"}
                  </span>
                  <div>
                    <strong>{getPointEntryTitle(entry)}</strong>
                    <small>{formatHistoryTime(entry)}</small>
                  </div>
                  <b className={points < 0 ? "is-spent" : "is-earned"}>
                    {formatSignedLoyaltyPoints(points)} điểm
                  </b>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {!filteredEntries.length ? (
        <AppEmptyState
          icon={null}
          message={safeEntries.length ? "Chưa có giao dịch phù hợp với bộ lọc này" : loyaltyText.noPointHistory}
        />
      ) : null}

      {hasMore ? (
        <button
          type="button"
          className="loyalty-point-history__more"
          onClick={() => setVisibleCount((current) => current + safePageSize)}
        >
          Xem thêm {remainingCount} giao dịch
        </button>
      ) : null}
    </div>
  );
}
