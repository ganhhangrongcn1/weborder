import { useMemo, useRef, useState } from "react";
import useKitchenAuth from "../../hooks/useKitchenAuth.js";
import useKitchenNewOrderAlert from "../../hooks/useKitchenNewOrderAlert.js";
import useKitchenOrders, { getTodayDateKey } from "../../hooks/useKitchenOrders.js";
import KitchenDishSummaryPanel from "./KitchenDishSummaryPanel.jsx";
import KitchenOrderCard from "./KitchenOrderCard.jsx";
import KitchenOrderStrip from "./KitchenOrderStrip.jsx";
import {
  getKitchenItemGroupKey,
  getKitchenOrderKey,
  orderContainsKitchenItemGroup
} from "./kitchenOrderGrouping.js";

const STAT_CARDS = [
  { id: "active", label: "Đang xử lý" },
  { id: "done", label: "Đã xong" },
  { id: "cancelled", label: "Đã hủy" },
  { id: "website", label: "Website" },
  { id: "partner", label: "Đối tác" }
];

const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "T\u1ea5t c\u1ea3 ngu\u1ed3n" },
  { value: "website", label: "Website" },
  { value: "qr_counter", label: "QR t\u1ea1i qu\u1ea7y" },
  { value: "pickup", label: "T\u1ef1 l\u1ea5y" },
  { value: "grabfood", label: "GrabFood" },
  { value: "shopeefood", label: "ShopeeFood" },
  { value: "xanhngon", label: "Xanh Ngon" }
];

function formatUpdatedTime(value = "") {
  if (!value) return "Chưa tải";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa tải";

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? "1px solid #111827" : "1px solid #d1d5db",
        background: active ? "#111827" : "#ffffff",
        color: active ? "#ffffff" : "#374151",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </button>
  );
}

function SourceFilterSelect({ value, onChange }) {
  return (
    <label
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        minWidth: 172,
        height: 42
      }}
    >
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          height: "100%",
          appearance: "none",
          border: "1px solid #d1d5db",
          background: "#ffffff",
          color: "#374151",
          borderRadius: 8,
          padding: "0 34px 0 12px",
          fontSize: 13,
          fontWeight: 800,
          lineHeight: "42px",
          cursor: "pointer",
          boxShadow: "0 1px 0 rgba(15, 23, 42, 0.03)",
          outline: "none"
        }}
      >
        {SOURCE_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 12,
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "6px solid #475569",
          pointerEvents: "none"
        }}
      />
    </label>
  );
}

function KitchenRequestAuditBadge({ audit, onReset }) {
  const total60m = Number(audit?.total60m || 0);
  const total5m = Number(audit?.total5m || 0);
  const topTables = (audit?.byTable || [])
    .slice(0, 3)
    .map((item) => `${item.key}: ${item.count}`)
    .join(" · ");

  return (
    <div
      title="Chỉ đếm request Supabase phát sinh từ màn hình bếp trên máy này trong 60 phút gần nhất."
      style={{
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 34,
        border: "1px dashed #cbd5e1",
        background: "#f8fafc",
        borderRadius: 8,
        padding: "6px 8px",
        color: "#475569",
        fontSize: 12,
        fontWeight: 800
      }}
    >
      <span>Bếp đọc: {total60m} req/60p</span>
      <span style={{ color: "#64748b", fontWeight: 700 }}>5p: {total5m}</span>
      {topTables ? (
        <span style={{ color: "#64748b", fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {topTables}
        </span>
      ) : null}
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

function KitchenLoginScreen({ error, loading, onLogin, submitting }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    await onLogin({ email, password });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        color: "#1f2933",
        fontFamily: "system-ui, Arial, sans-serif",
        display: "grid",
        placeItems: "center",
        padding: 24
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 440,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 8,
          padding: 24,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.10)",
          display: "grid",
          gap: 14
        }}
      >
        <div>
          <p style={{ margin: "0 0 6px", color: "#64748b", fontSize: 13, fontWeight: 800 }}>
            Gánh Hàng Rong
          </p>
          <h1 style={{ margin: 0, color: "#111827", fontSize: 28 }}>
            Đăng nhập xử lý đơn
          </h1>
        </div>

        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#111827" }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="lhp@ghr.vn"
            required
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "12px 13px",
              fontSize: 14
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#111827" }}>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu"
            required
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "12px 13px",
              fontSize: 14
            }}
          />
        </label>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 8,
              padding: 11,
              fontWeight: 700,
              fontSize: 13
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || submitting}
          style={{
            border: "1px solid #16a34a",
            background: "#16a34a",
            color: "#ffffff",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 15,
            fontWeight: 900,
            cursor: loading || submitting ? "not-allowed" : "pointer",
            opacity: loading || submitting ? 0.75 : 1
          }}
        >
          {loading || submitting ? "Đang kiểm tra..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}

export default function KitchenPage() {
  const [activeDishKey, setActiveDishKey] = useState("");
  const [activeOrderKey, setActiveOrderKey] = useState("");
  const orderRefs = useRef({});
  const {
    session,
    profile,
    loading: authLoading,
    submitting,
    error: authError,
    login,
    logout
  } = useKitchenAuth();

  const kitchenOrderOptions = useMemo(() => ({
    enabled: Boolean(session && profile),
    branchUuid: profile?.branchUuid || "",
    branchName: profile?.branchName || "",
    branchAlias: profile?.branchAlias || ""
  }), [profile, session]);

  const {
    orders,
    filteredOrders,
    canLoadMoreDoneOrders,
    stats,
    loading,
    refreshing,
    error,
    dateFilter,
    setDateFilter,
    sourceFilter,
    setSourceFilter,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    updatingOrderId,
    updatingItemKey,
    claimingGiftOrderId,
    requestAudit,
    resetRequestAudit,
    loadMoreDoneOrders,
    markDone,
    toggleItemDone,
    claimGift,
    reload
  } = useKitchenOrders(kitchenOrderOptions);
  const {
    soundEnabled,
    toggleSound
  } = useKitchenNewOrderAlert(orders, Boolean(session && profile));

  if (authLoading || !session || !profile) {
    return (
      <KitchenLoginScreen
        error={authError}
        loading={authLoading}
        onLogin={login}
        submitting={submitting}
      />
    );
  }

  const displayName = profile.name || profile.email || "Tài khoản bếp";
  const branchLabel = profile.branchName || profile.branchAlias || "Chưa gán chi nhánh";

  function scrollToOrder(orderKey = "") {
    window.requestAnimationFrame(() => {
      orderRefs.current[orderKey]?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  function handleSelectOrder(orderKey = "") {
    setActiveOrderKey((currentKey) => {
      const nextKey = currentKey === orderKey ? "" : orderKey;
      if (nextKey) scrollToOrder(nextKey);
      return nextKey;
    });
    setActiveDishKey("");
  }

  function handleFocusOrder(orderKey = "") {
    if (!orderKey) return;
    setActiveOrderKey(orderKey);
    setActiveDishKey("");
  }

  function handleMarkOrderDone(order) {
    const orderKey = getKitchenOrderKey(order);
    setActiveDishKey("");
    setActiveOrderKey((currentKey) => (currentKey === orderKey ? "" : currentKey));
    markDone(order);
  }

  function clearActiveSelection() {
    setActiveDishKey("");
    setActiveOrderKey("");
  }

  function handleSearchChange(value = "") {
    clearActiveSelection();
    setSearch(value);
  }

  function handleDateFilterChange(value = "") {
    clearActiveSelection();
    setDateFilter(value);
  }

  function handleSourceFilterChange(value = "all") {
    clearActiveSelection();
    setSourceFilter(value);
  }

  function handleStatusFilterChange(value = "active") {
    clearActiveSelection();
    setStatusFilter(value);
  }

  function handleSelectDish(dishKey = "") {
    setActiveDishKey((currentKey) => {
      const nextKey = currentKey === dishKey ? "" : dishKey;
      if (nextKey) {
        const firstMatchedOrder = filteredOrders.find((order) => orderContainsKitchenItemGroup(order, nextKey));
        if (firstMatchedOrder) scrollToOrder(getKitchenOrderKey(firstMatchedOrder));
      }
      return nextKey;
    });
    setActiveOrderKey("");
  }

  return (
    <main
      style={{
        height: "100vh",
        background: "#f8fafc",
        color: "#1f2933",
        fontFamily: "system-ui, Arial, sans-serif",
        padding: 8,
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      <section
        style={{
          maxWidth: "100%",
          height: "100%",
          margin: "0 auto",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gap: 8
        }}
      >
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "320px minmax(0, 1fr)",
            alignItems: "start",
            gap: "10px 16px",
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: 18,
            padding: 12,
            boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)"
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                color: "#6b7280",
                fontSize: 13,
                fontWeight: 800,
                textTransform: "uppercase"
              }}
            >
              {branchLabel}
            </p>
            <h1
              style={{
                margin: 0,
                color: "#111827",
                fontSize: 28,
                lineHeight: 1.15
              }}
            >
              Xử lý đơn chi nhánh
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#334155", fontSize: 13, fontWeight: 800 }}>
              {displayName}
            </span>
            <input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Tìm mã đơn, khách, món..."
              style={{
                width: 250,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13,
                boxSizing: "border-box"
              }}
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => handleDateFilterChange(event.target.value)}
              style={{
                width: 176,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13
              }}
            />
            <FilterButton active={dateFilter === getTodayDateKey()} onClick={() => handleDateFilterChange(getTodayDateKey())}>
              Hôm nay
            </FilterButton>
            <button
              type="button"
              onClick={reload}
              disabled={refreshing}
              style={{
                border: "1px solid #16a34a",
                background: "#16a34a",
                color: "#ffffff",
                borderRadius: 8,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.85 : 1,
                minWidth: 70
              }}
            >
              Tải lại
            </button>
            <button
              type="button"
              onClick={toggleSound}
              style={{
                border: soundEnabled ? "1px solid #15803d" : "1px solid #d1d5db",
                background: soundEnabled ? "#dcfce7" : "#ffffff",
                color: soundEnabled ? "#166534" : "#374151",
                borderRadius: 8,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              {soundEnabled ? "Chuông bật" : "Bật chuông"}
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={submitting}
              style={{
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                borderRadius: 8,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor: submitting ? "not-allowed" : "pointer"
              }}
            >
              Đăng xuất
            </button>
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <SourceFilterSelect value={sourceFilter} onChange={handleSourceFilterChange} />
            <FilterButton active={statusFilter === "active"} onClick={() => handleStatusFilterChange("active")}>
              Đang xử lý
            </FilterButton>
            <FilterButton active={statusFilter === "done"} onClick={() => handleStatusFilterChange("done")}>
              Hoàn thành
            </FilterButton>
            <FilterButton active={statusFilter === "cancelled"} onClick={() => handleStatusFilterChange("cancelled")}>
              Đã hủy
            </FilterButton>
            <FilterButton active={statusFilter === "all"} onClick={() => handleStatusFilterChange("all")}>
              Tất cả trạng thái
            </FilterButton>
            <KitchenRequestAuditBadge audit={requestAudit} onReset={resetRequestAudit} />
          </div>
        </header>

        <section
          style={{
            display: "none",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12
          }}
        >
          {STAT_CARDS.map((card) => (
            <div
              key={card.id}
              style={{
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                borderRadius: 8,
                padding: 14
              }}
            >
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                {card.label}
              </div>
              <strong style={{ display: "block", marginTop: 6, fontSize: 26, color: "#111827" }}>
                {stats[card.id] || 0}
              </strong>
            </div>
          ))}
        </section>

        <section
          style={{
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: 8,
            padding: 14,
            display: "none",
            gap: 12
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) 170px auto",
              gap: 10,
              alignItems: "center"
            }}
          >
            <input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Tìm mã đơn, khách, món..."
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "11px 12px",
                fontSize: 14,
                boxSizing: "border-box"
              }}
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => handleDateFilterChange(event.target.value)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14
              }}
            />
            <FilterButton active={dateFilter === getTodayDateKey()} onClick={() => handleDateFilterChange(getTodayDateKey())}>
              Hôm nay
            </FilterButton>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <FilterButton active={statusFilter === "active"} onClick={() => handleStatusFilterChange("active")}>
              Đang xử lý
            </FilterButton>
            <FilterButton active={statusFilter === "done"} onClick={() => handleStatusFilterChange("done")}>
              Đã xong
            </FilterButton>
            <FilterButton active={statusFilter === "cancelled"} onClick={() => handleStatusFilterChange("cancelled")}>
              Đã hủy
            </FilterButton>
            <FilterButton active={statusFilter === "all"} onClick={() => handleStatusFilterChange("all")}>
              Tất cả trạng thái
            </FilterButton>
          </div>
        </section>

        {error ? (
          <div
            style={{
              border: "1px solid #fed7aa",
              background: "#fff7ed",
              color: "#c2410c",
              borderRadius: 8,
              padding: 12,
              fontWeight: 700
            }}
          >
            {error}
          </div>
        ) : null}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(430px, 0.62fr)",
            gap: 10,
            alignItems: "stretch",
            minHeight: 0,
            height: "100%"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateRows: "minmax(0, 1fr) auto",
              gap: 10,
              minHeight: 0,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 10,
                alignContent: "start",
                overflowY: "auto",
                minHeight: 0,
                paddingRight: 4,
                paddingBottom: 12
              }}
            >
          {loading ? (
            <div
              style={{
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                borderRadius: 8,
                padding: 18,
                color: "#64748b"
              }}
            >
              Đang tải danh sách đơn chi nhánh...
            </div>
          ) : null}

          {!loading && filteredOrders.length === 0 ? (
            <div
              style={{
                border: "1px dashed #cbd5e1",
                background: "#ffffff",
                borderRadius: 8,
                padding: 22,
                textAlign: "center",
                color: "#64748b"
              }}
            >
              Chưa có đơn phù hợp với chi nhánh hoặc bộ lọc hiện tại.
            </div>
          ) : null}

            {filteredOrders.map((order) => {
              const orderKey = getKitchenOrderKey(order);
              const highlightedByDish = orderContainsKitchenItemGroup(order, activeDishKey);

              return (
                <div
                  key={orderKey}
                  ref={(node) => {
                    if (node) orderRefs.current[orderKey] = node;
                    else delete orderRefs.current[orderKey];
                  }}
                >
                <KitchenOrderCard
                  active={activeOrderKey === orderKey}
                  dimmed={Boolean(activeOrderKey && activeOrderKey !== orderKey)}
                  highlightedDishKey={highlightedByDish ? activeDishKey : ""}
                  isItemHighlighted={(item) => activeDishKey && getKitchenItemGroupKey(item) === activeDishKey}
                  onFocusOrder={handleFocusOrder}
                  onSelectOrder={handleSelectOrder}
                  order={order}
                  updating={String(updatingOrderId) === String(order.id)}
                  updatingItemKey={updatingItemKey}
                  claimingGift={String(claimingGiftOrderId) === String(order.id)}
                  onMarkDone={handleMarkOrderDone}
                  onToggleItemDone={toggleItemDone}
                  onClaimGift={claimGift}
                />
                </div>
              );
            })}
            {!loading && statusFilter === "done" && canLoadMoreDoneOrders ? (
              <button
                type="button"
                onClick={loadMoreDoneOrders}
                disabled={refreshing}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  borderRadius: 10,
                  padding: "13px 16px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: refreshing ? "not-allowed" : "pointer",
                  opacity: refreshing ? 0.72 : 1
                }}
              >
                {refreshing ? "Đang tải thêm..." : "Xem thêm đơn hoàn thành"}
              </button>
            ) : null}
            </div>

            <KitchenOrderStrip
              activeOrderKey={activeOrderKey}
              orders={filteredOrders}
              onSelectOrder={handleSelectOrder}
            />
          </div>

          <KitchenDishSummaryPanel
            activeDishKey={activeDishKey}
            activeOrderKey={activeOrderKey}
            orders={filteredOrders}
            onSelectDish={handleSelectDish}
          />
        </section>
      </section>
    </main>
  );
}
