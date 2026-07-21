import React, { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";

const FILTERS = [
  { id: "action", label: "Cần làm ngay" },
  { id: "scheduled", label: "Đơn hẹn" },
  { id: "all", label: "Tất cả" }
];

const PREP_LEAD_TIME_MS = 20 * 60 * 1000;

const SEGMENTS = [
  { id: "pickup", label: "Hẹn lấy" },
  { id: "delivery", label: "Giao hàng" }
];

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

function getKitchenLabel(order = {}) {
  const status = String(order.kitchenStatus || order.status || "").trim().toLowerCase();
  if (["done", "completed", "complete"].includes(status)) return "Bếp đã xong";
  if (["doing", "preparing", "in_progress"].includes(status)) return "Bếp đang làm";
  return "Đang chờ bếp";
}

function getPaymentLabel(order = {}) {
  const paid = order.paymentStatus === "paid";
  if (!paid) {
    return order.fulfillmentType === "delivery" ? "Chưa thu shipper" : "Chưa thanh toán";
  }
  if (order.paymentMethod === "bank_qr") {
    return order.fulfillmentType === "delivery" ? "Đã thu shipper QR" : "Đã thanh toán QR";
  }
  return order.fulfillmentType === "delivery" ? "Đã thu shipper tiền mặt" : "Đã thu tiền mặt";
}

function getOrderAmount(order = {}) {
  return Number(order.collectAmount || order.totalAmount || order.paymentAmount || 0);
}

function parsePickupTime(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const [, hour, minute, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getScheduleInfo(order = {}) {
  if (order.fulfillmentType !== "pickup") return { scheduled: false, pickupAt: null, workAt: null };
  const pickupAt = parsePickupTime(order.pickupTimeText);
  if (!pickupAt) return { scheduled: false, pickupAt: null, workAt: null };
  const workAt = new Date(pickupAt.getTime() - PREP_LEAD_TIME_MS);
  return { scheduled: workAt.getTime() > Date.now(), pickupAt, workAt };
}

function formatClock(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function getNextAction(order = {}) {
  const schedule = getScheduleInfo(order);
  if (schedule.scheduled) return `Chưa tới giờ làm · Bắt đầu ${formatClock(schedule.workAt)}`;
  const paid = order.paymentStatus === "paid";
  const kitchenLabel = getKitchenLabel(order);
  if (!paid) return order.fulfillmentType === "delivery" ? "Cần thu tiền từ shipper" : "Cần thu tiền khách";
  if (kitchenLabel === "Bếp đã xong") return order.fulfillmentType === "delivery" ? "Sẵn sàng giao shipper" : "Sẵn sàng trả khách";
  return kitchenLabel;
}

function getOrderPriority(order = {}) {
  if (getScheduleInfo(order).scheduled) return -100;
  let score = order.paymentStatus === "paid" ? 0 : 100;
  if (getKitchenLabel(order) === "Bếp đã xong") score += 40;
  return score;
}

function getCrossShiftInfo(order = {}, activeShiftId = "", shiftOpenedAt = "") {
  const currentShiftId = String(activeShiftId || "").trim();
  const paymentShiftId = String(order.posShiftId || "").trim();
  const shiftStartedAt = new Date(shiftOpenedAt || "").getTime();
  const orderCreatedAt = new Date(order.createdAt || "").getTime();
  const paidAt = new Date(order.paidAt || "").getTime();
  const placedBeforeShift = Number.isFinite(shiftStartedAt)
    && Number.isFinite(orderCreatedAt)
    && orderCreatedAt < shiftStartedAt;
  const paidBeforeShift = order.paymentStatus === "paid" && (
    (paymentShiftId && currentShiftId && paymentShiftId !== currentShiftId)
    || (!paymentShiftId && Number.isFinite(shiftStartedAt) && Number.isFinite(paidAt) && paidAt < shiftStartedAt)
  );

  if (paidBeforeShift) {
    return { label: "Đã thu tiền ca trước", tone: "paid_previous" };
  }
  if (placedBeforeShift) {
    return { label: "Đặt từ ca trước", tone: "placed_previous" };
  }
  return null;
}

function WebsiteOrderCard({ order, activeShiftId, shiftOpenedAt, loading, onPayCash, onPayQr }) {
  const paid = order.paymentStatus === "paid";
  const isDelivery = order.fulfillmentType === "delivery";
  const amount = getOrderAmount(order);
  const nextAction = getNextAction(order);
  const schedule = getScheduleInfo(order);
  const crossShiftInfo = getCrossShiftInfo(order, activeShiftId, shiftOpenedAt);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flexOne}>
          <View style={styles.orderTitleRow}>
            <Text style={styles.orderCode} numberOfLines={1}>{order.displayOrderCode || order.orderCode}</Text>
            {schedule.scheduled ? <View style={styles.scheduleBadge}><Text style={styles.scheduleBadgeText}>ĐƠN HẸN</Text></View> : null}
            {crossShiftInfo ? (
              <View style={[
                styles.crossShiftBadge,
                crossShiftInfo.tone === "paid_previous" && styles.crossShiftBadgePaid
              ]}>
                <Text style={styles.crossShiftBadgeText}>{crossShiftInfo.label}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.customerLine} numberOfLines={1}>
            {order.customerName || "Khách đặt web"} · {order.customerPhone || "Không có SĐT"}
          </Text>
          <Text style={styles.fulfillmentLine} numberOfLines={2}>
            {isDelivery
              ? `Giao tới: ${order.deliveryAddress || "Chưa có địa chỉ"}`
              : `Hẹn lấy: ${order.pickupTimeText || "Khách ghé lấy khi tới"}`}
          </Text>
          <Text style={styles.createdLine}>Đặt lúc {formatTime(order.createdAt)}</Text>
        </View>

        <View style={styles.amountCol}>
          <Text style={styles.amount}>{formatMoney(amount)}</Text>
          <View style={[styles.badge, paid ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={styles.badgeText}>{getPaymentLabel(order)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.nextActionBar, paid && styles.nextActionBarReady, schedule.scheduled && styles.nextActionBarScheduled]}>
        <View style={[styles.nextActionDot, paid && styles.nextActionDotReady]} />
        <Text style={[styles.nextActionText, paid && styles.nextActionTextReady, schedule.scheduled && styles.nextActionTextScheduled]}>{nextAction}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.kitchenStatus}>
          <PosIcon name="order" size={13} color={POS_COLORS.slate} />
          <Text style={styles.kitchenText}>{getKitchenLabel(order)}</Text>
        </View>

        {paid ? (
          <View style={styles.paidConfirmation}>
            <PosIcon name="cash" size={14} color={POS_COLORS.primaryDark} />
            <Text style={styles.paidConfirmationText}>Thanh toán hoàn tất</Text>
          </View>
        ) : <View style={styles.paymentActions}>
          <Pressable
            style={[styles.qrButton, loading && styles.disabledButton]}
            hitSlop={8}
            onPress={() => onPayQr?.(order)}
            disabled={loading}
          >
            <PosIcon name="qr" size={14} color={POS_COLORS.slate} />
            <Text style={styles.qrButtonText}>QR</Text>
          </Pressable>

          <Pressable
            style={[styles.cashButton, loading && styles.disabledButton]}
            hitSlop={8}
            onPress={() => onPayCash?.(order)}
            disabled={loading}
          >
            <PosIcon name="cash" size={14} color={POS_COLORS.primaryDark} />
            <Text style={styles.cashButtonText}>
              {isDelivery ? "Thu shipper" : "Tiền mặt"}
            </Text>
          </Pressable>
        </View>}
      </View>
    </View>
  );
}

const PosPickupOrdersPanel = memo(function PosPickupOrdersPanel({
  pickupOrders = [],
  deliveryOrders = [],
  activeShiftId = "",
  shiftOpenedAt = "",
  loading = false,
  error = "",
  onRefresh,
  onPayCash,
  onPayQr
}) {
  const [segment, setSegment] = useState("pickup");
  const [filter, setFilter] = useState("action");

  const pickupUnpaidCount = useMemo(
    () => (Array.isArray(pickupOrders) ? pickupOrders : []).filter((order) => order.paymentStatus !== "paid").length,
    [pickupOrders]
  );
  const deliveryUnpaidCount = useMemo(
    () => (Array.isArray(deliveryOrders) ? deliveryOrders : []).filter((order) => order.paymentStatus !== "paid").length,
    [deliveryOrders]
  );
  const totalUnpaidCount = pickupUnpaidCount + deliveryUnpaidCount;

  const sourceOrders = segment === "delivery" ? deliveryOrders : pickupOrders;
  const activeActionCount = useMemo(
    () => (Array.isArray(sourceOrders) ? sourceOrders : []).filter((order) => !getScheduleInfo(order).scheduled).length,
    [sourceOrders]
  );
  const scheduledCount = useMemo(
    () => (Array.isArray(sourceOrders) ? sourceOrders : []).filter((order) => getScheduleInfo(order).scheduled).length,
    [sourceOrders]
  );

  const filteredOrders = useMemo(
    () => (Array.isArray(sourceOrders) ? sourceOrders : [])
      .filter((order) => {
        const scheduled = getScheduleInfo(order).scheduled;
        if (filter === "scheduled") return scheduled;
        if (filter === "action") return !scheduled;
        return true;
      })
      .sort((left, right) => {
        const priorityDiff = getOrderPriority(right) - getOrderPriority(left);
        if (priorityDiff) return priorityDiff;
        return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
      }),
    [filter, sourceOrders]
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.panel}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Hàng đợi xử lý</Text>
          <Text style={styles.title}>Đơn website</Text>
          <Text style={styles.subtitle}>
            Đơn cần thu tiền và đơn bếp đã xong luôn được đưa lên trước.
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countValue}>{totalUnpaidCount}</Text>
          <Text style={styles.countLabel}>cần thu</Text>
        </View>
      </View>

      <View style={styles.segmentRow}>
        {SEGMENTS.map((item) => {
          const active = item.id === segment;
          const count = item.id === "delivery" ? deliveryOrders.length : pickupOrders.length;
          return (
            <Pressable
              key={item.id}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => setSegment(item.id)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {item.label}
              </Text>
              <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
                <Text style={[styles.segmentBadgeText, active && styles.segmentBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <Pressable
                key={item.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(item.id)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.id === "action" && activeActionCount > 0
                    ? `${item.label} (${activeActionCount})`
                    : item.id === "scheduled" && scheduledCount > 0
                      ? `${item.label} (${scheduledCount})`
                      : item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable style={styles.refreshButton} onPress={onRefresh} disabled={loading}>
          <Text style={styles.refreshText}>{loading ? "Đang tải" : "Tải lại"}</Text>
        </Pressable>
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.listFrame}>
        {filteredOrders.length ? (
          filteredOrders.map((order) => (
              <WebsiteOrderCard
                key={order.id}
                order={order}
                activeShiftId={activeShiftId}
                shiftOpenedAt={shiftOpenedAt}
              loading={loading}
              onPayCash={onPayCash}
              onPayQr={onPayQr}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {segment === "delivery" ? "Không có đơn giao hàng phù hợp." : "Không có đơn hẹn lấy phù hợp."}
            </Text>
            <Text style={styles.emptyCopy}>
              {segment === "delivery"
                ? "Đơn website giao hàng đúng chi nhánh sẽ hiện tại đây để nhân viên theo dõi và thu tiền."
                : "Đơn website tự lấy đúng chi nhánh sẽ hiện tại đây để nhân viên theo dõi và thu tiền."}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
});

export default PosPickupOrdersPanel;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg
  },
  panel: {
    gap: 8,
    padding: 10
  },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  titleWrap: {
    flex: 1,
    gap: 3
  },
  eyebrow: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: POS_COLORS.heading,
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "900"
  },
  subtitle: {
    color: POS_COLORS.slate,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  countPill: {
    width: 82,
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  countValue: {
    color: POS_COLORS.primaryDark,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900"
  },
  countLabel: {
    color: POS_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12
  },
  segmentButtonActive: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  segmentText: {
    color: POS_COLORS.slate,
    fontSize: 13,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: POS_COLORS.primaryDark
  },
  segmentBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  segmentBadgeActive: {
    borderColor: "#86efac",
    backgroundColor: "#dcfce7"
  },
  segmentBadgeText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900"
  },
  segmentBadgeTextActive: {
    color: POS_COLORS.primaryDark
  },
  toolbar: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.softBorder,
    paddingHorizontal: 2,
    paddingBottom: 8
  },
  filterRow: {
    gap: 8,
    alignItems: "center",
    paddingRight: 4
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
  listFrame: {
    flexGrow: 1,
    minHeight: 430,
    gap: 8,
    backgroundColor: POS_COLORS.surface,
    paddingTop: 4
  },
  card: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg,
    padding: 12
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  flexOne: {
    flex: 1,
    minWidth: 0
  },
  orderCode: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  orderTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scheduleBadge: {
    borderRadius: 6,
    backgroundColor: "#e8eefb",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  scheduleBadgeText: { color: "#36598a", fontSize: 9, fontWeight: "900" },
  crossShiftBadge: {
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 6,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  crossShiftBadgePaid: {
    borderColor: "#a7c7e7",
    backgroundColor: "#eef4ff"
  },
  crossShiftBadgeText: { color: "#36598a", fontSize: 9, fontWeight: "900" },
  customerLine: { marginTop: 5, color: POS_COLORS.heading, fontSize: 13, fontWeight: "900" },
  fulfillmentLine: { marginTop: 4, color: POS_COLORS.slate, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  createdLine: { marginTop: 3, color: POS_COLORS.muted, fontSize: 10, fontWeight: "700" },
  highlightGrid: {
    marginTop: 8,
    gap: 8
  },
  highlightCard: {
    gap: 3,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  highlightLabel: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  highlightValue: {
    color: POS_COLORS.heading,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  highlightMeta: {
    color: POS_COLORS.slate,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700"
  },
  deliveryMoneyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  moneyMetaPill: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 10
  },
  moneyMetaLabel: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900"
  },
  moneyMetaValue: {
    color: POS_COLORS.heading,
    fontSize: 11,
    fontWeight: "900"
  },
  amountCol: {
    minWidth: 124,
    alignItems: "flex-end",
    gap: 6
  },
  amount: {
    color: POS_COLORS.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  badgeSuccess: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  badgeWarning: {
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed"
  },
  badgeText: {
    color: POS_COLORS.slate,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right"
  },
  nextActionBar: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: POS_RADIUS.sm,
    backgroundColor: POS_COLORS.warningSoft,
    paddingHorizontal: 10
  },
  nextActionBarReady: { backgroundColor: POS_COLORS.primarySoft },
  nextActionBarScheduled: { backgroundColor: "#eef4ff" },
  nextActionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: POS_COLORS.warning },
  nextActionDotReady: { backgroundColor: POS_COLORS.primary },
  nextActionText: { color: POS_COLORS.warning, fontSize: 12, fontWeight: "900" },
  nextActionTextReady: { color: POS_COLORS.primaryDark },
  nextActionTextScheduled: { color: "#36598a" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.softBorder,
    paddingTop: 8
  },
  kitchenStatus: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  kitchenText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "800"
  },
  paymentActions: {
    flexDirection: "row",
    gap: 8
  },
  paidConfirmation: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12
  },
  paidConfirmationText: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "900"
  },
  qrButton: {
    minHeight: 36,
    minWidth: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12
  },
  qrButtonText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  cashButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12
  },
  cashButtonText: {
    color: POS_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  disabledButton: {
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface
  },
  disabledText: {
    color: POS_COLORS.muted
  },
  emptyState: {
    minHeight: 130,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  emptyTitle: {
    color: POS_COLORS.heading,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  emptyCopy: {
    color: POS_COLORS.slate,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center"
  }
});
