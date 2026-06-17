import React, { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";
import PosOrderDetailModal from "./PosOrderDetailModal";

const STATUS_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "pending_payment", label: "Chờ thanh toán" },
  { id: "processing", label: "Đang xử lý" },
  { id: "completed", label: "Hoàn tất" },
  { id: "cancelled", label: "Đã hủy" }
];

const RANGE_FILTERS = [
  { id: "shift", label: "Ca này" },
  { id: "today", label: "Hôm nay" }
];

function toText(value = "") {
  return String(value ?? "").trim();
}

function formatTime(value = "") {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

function isToday(value = "") {
  const date = new Date(value);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function getSessionStatusText(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "Đã nhận tiền";
  if (normalized === "converted") return "Đã tạo đơn";
  if (normalized === "converting") return "Đang chốt";
  if (normalized === "cancelled") return "Đã hủy";
  if (normalized === "expired") return "Hết hạn";
  return "Chờ CK";
}

function getSessionStatusGroup(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["draft", "pending_payment"].includes(normalized)) return "pending_payment";
  if (["cancelled", "canceled", "expired"].includes(normalized)) return "cancelled";
  if (["converted", "done", "completed", "complete"].includes(normalized)) return "completed";
  return "processing";
}

function getOrderStatusGroup(order = {}) {
  const status = toText(order.status).toLowerCase();
  const kitchenStatus = toText(order.kitchenStatus).toLowerCase();

  if (["cancelled", "canceled", "cancel"].includes(status) || ["cancelled", "canceled", "cancel"].includes(kitchenStatus)) {
    return "cancelled";
  }
  if (["done", "completed", "complete"].includes(status) || ["done", "completed", "complete"].includes(kitchenStatus)) {
    return "completed";
  }
  return "processing";
}

function getOrderStatusText(order = {}) {
  const group = getOrderStatusGroup(order);
  if (group === "cancelled") return "Đã hủy";
  if (group === "completed") return "Hoàn tất";
  return "Đang xử lý";
}

function getStatusTone(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["đã nhận tiền", "đã tạo đơn", "đang chốt", "hoàn tất"].includes(normalized)) {
    return styles.statusSuccess;
  }
  if (["đã hủy", "hết hạn"].includes(normalized)) {
    return styles.statusDanger;
  }
  return styles.statusNeutral;
}

function matchesRange(record = {}, rangeFilter = "shift", activeShiftId = "") {
  if (rangeFilter === "today") {
    return isToday(record.createdAt);
  }
  if (activeShiftId) {
    return toText(record.posShiftId) === toText(activeShiftId);
  }
  return true;
}

function OrderCard({ order, loading, onOpen }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, styles.orderCard, pressed && styles.cardPressed]}
      onPress={() => onOpen?.(order)}
      disabled={loading}
    >
      <View style={styles.cardHead}>
        <View style={styles.flexOne}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {order.displayOrderCode || order.id}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {[
              order.pagerNumber ? `Thẻ ${order.pagerNumber}` : "Không có thẻ",
              order.customerName || "Khách tại quầy",
              formatTime(order.createdAt)
            ].join(" • ")}
          </Text>
        </View>

        <View style={styles.amountCol}>
          <Text style={styles.amountText}>{formatMoney(order.totalAmount)}</Text>
          <View style={[styles.statusBadge, getStatusTone(getOrderStatusText(order))]}>
            <Text style={styles.statusBadgeText}>{getOrderStatusText(order)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SessionCard({ session, loading, onOpen, onCancel }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flexOne}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {session.paymentReference || session.displayOrderCode}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={2}>
            {[
              session.pagerNumber ? `Thẻ ${session.pagerNumber}` : "Không có thẻ",
              session.customerName || "Khách tại quầy",
              formatTime(session.createdAt)
            ].join(" • ")}
          </Text>
        </View>

        <View style={styles.amountCol}>
          <Text style={styles.amountText}>{formatMoney(session.amountExpected)}</Text>
          <View style={[styles.statusBadge, getStatusTone(getSessionStatusText(session.status))]}>
            <Text style={styles.statusBadgeText}>{getSessionStatusText(session.status)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={[styles.actionButton, styles.primaryActionButton]}
          onPress={() => onOpen?.(session)}
          disabled={loading}
        >
          <Text style={[styles.primaryActionText, loading && styles.disabledText]}>Mở QR</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.dangerActionButton]}
          onPress={() => onCancel?.(session)}
          disabled={loading}
        >
          <Text style={[styles.dangerActionText, loading && styles.disabledText]}>Hủy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const PosHistoryPanel = memo(function PosHistoryPanel({
  recentOrders = [],
  paymentSessions = [],
  loading = false,
  error = "",
  activeShiftId = "",
  onRefresh,
  onOpenPaymentSession,
  onCancelPaymentSession,
  onCancelOrder,
  onReprintOrder,
  onOpenOrderDetail
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("shift");
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filteredPaymentSessions = useMemo(
    () => (Array.isArray(paymentSessions) ? paymentSessions : []).filter((session) => {
      if (!matchesRange(session, rangeFilter, activeShiftId)) return false;
      return statusFilter === "all" || statusFilter === getSessionStatusGroup(session.status);
    }),
    [activeShiftId, paymentSessions, rangeFilter, statusFilter]
  );

  const filteredOrders = useMemo(
    () => (Array.isArray(recentOrders) ? recentOrders : []).filter((order) => {
      if (!matchesRange(order, rangeFilter, activeShiftId)) return false;
      return statusFilter === "all" || statusFilter === getOrderStatusGroup(order);
    }),
    [activeShiftId, rangeFilter, recentOrders, statusFilter]
  );

  const pendingPaymentCount = useMemo(
    () => (Array.isArray(paymentSessions) ? paymentSessions : []).filter((session) => (
      getSessionStatusGroup(session.status) === "pending_payment"
    )).length,
    [paymentSessions]
  );

  const handleOpenDetail = async (order) => {
    if (!order?.id || !onOpenOrderDetail) return;
    setDetailVisible(true);
    setDetailLoading(true);
    const detail = await onOpenOrderDetail(order);
    setDetailOrder(detail);
    setDetailLoading(false);
  };

  const handleCloseDetail = () => {
    setDetailVisible(false);
    setDetailOrder(null);
    setDetailLoading(false);
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.panel}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              <PosIcon name="history" size={16} color={POS_COLORS.primaryDark} />
            </View>
            <View style={styles.titleCopy}>
              <Text style={styles.eyebrow}>Vận hành</Text>
              <Text style={styles.title}>QR và lịch sử đơn</Text>
            </View>
          </View>
          <Pressable style={styles.refreshButton} onPress={onRefresh} disabled={loading}>
            <Text style={styles.refreshText}>{loading ? "Đang tải" : "Làm mới"}</Text>
          </Pressable>
        </View>

        <View style={styles.rangeRow}>
          {RANGE_FILTERS.map((filter) => {
            const active = rangeFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                style={[styles.rangeButton, active && styles.rangeButtonActive]}
                onPress={() => setRangeFilter(filter.id)}
              >
                <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.id;
            const label = filter.id === "pending_payment" && pendingPaymentCount > 0
              ? `${filter.label} (${pendingPaymentCount})`
              : filter.label;
            return (
              <Pressable
                key={filter.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(filter.id)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>QR đang chờ</Text>
            <Text style={styles.countText}>{filteredPaymentSessions.length}</Text>
          </View>

          {filteredPaymentSessions.length ? (
            filteredPaymentSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                loading={loading}
                onOpen={onOpenPaymentSession}
                onCancel={onCancelPaymentSession}
              />
            ))
          ) : (
            <Text style={styles.empty}>Không có QR đang chờ.</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Đơn gần đây</Text>
            <Text style={styles.countText}>{filteredOrders.length}</Text>
          </View>

          {filteredOrders.length ? (
            filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                loading={loading}
                onOpen={handleOpenDetail}
              />
            ))
          ) : (
            <Text style={styles.empty}>Chưa có đơn POS gần đây.</Text>
          )}
        </View>
      </ScrollView>

      <PosOrderDetailModal
        visible={detailVisible}
        order={detailOrder}
        loading={detailLoading}
        actionBusy={loading}
        onClose={handleCloseDetail}
        onReprint={onReprintOrder}
        onCancel={onCancelOrder}
      />
    </>
  );
});

export default PosHistoryPanel;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md
  },
  panel: {
    gap: 12,
    padding: 12
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1
  },
  titleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: POS_COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  titleCopy: {
    flex: 1
  },
  eyebrow: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 2,
    color: POS_COLORS.heading,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900"
  },
  refreshButton: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  refreshText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900"
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8
  },
  rangeButton: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  rangeButtonActive: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  rangeText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900"
  },
  rangeTextActive: {
    color: POS_COLORS.primaryDark
  },
  filterRow: {
    gap: 8
  },
  filterChip: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  filterChipActive: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  filterText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900"
  },
  filterTextActive: {
    color: POS_COLORS.primaryDark
  },
  errorText: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    color: POS_COLORS.danger,
    borderRadius: POS_RADIUS.md,
    padding: 8,
    fontSize: 11,
    fontWeight: "800"
  },
  section: {
    gap: 8
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  countText: {
    minWidth: 24,
    textAlign: "center",
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    borderRadius: 999
  },
  card: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  cardPressed: {
    opacity: 0.9
  },
  orderCard: {
    gap: 0
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  rowTitle: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  rowMeta: {
    marginTop: 4,
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "800"
  },
  amountCol: {
    minWidth: 92,
    alignItems: "flex-end",
    gap: 6
  },
  amountText: {
    color: POS_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  statusNeutral: {
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface
  },
  statusSuccess: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  statusDanger: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  statusBadgeText: {
    color: POS_COLORS.slate,
    fontSize: 10,
    fontWeight: "900"
  },
  cardActions: {
    flexDirection: "row",
    gap: 8
  },
  actionButton: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  primaryActionButton: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  dangerActionButton: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  primaryActionText: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "900"
  },
  dangerActionText: {
    color: POS_COLORS.danger,
    fontSize: 11,
    fontWeight: "900"
  },
  empty: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  disabledText: {
    color: POS_COLORS.muted
  },
  flexOne: {
    flex: 1,
    minWidth: 0
  }
});
