import React, { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "unpaid", label: "Chưa thanh toán" },
  { id: "paid", label: "Đã thanh toán" }
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

function getPaymentLabel(order = {}) {
  if (order.paymentStatus === "paid") {
    return order.paymentMethod === "bank_qr" ? "Đã thanh toán QR" : "Đã thu tiền mặt";
  }
  return "Chưa thanh toán";
}

function getKitchenLabel(order = {}) {
  const status = String(order.kitchenStatus || order.status || "").trim().toLowerCase();
  if (["done", "completed", "complete"].includes(status)) return "Bếp đã xong";
  if (["doing", "preparing", "in_progress"].includes(status)) return "Bếp đang làm";
  return "Đang chờ bếp";
}

function PickupOrderCard({ order, loading, onPayCash, onPayQr }) {
  const paid = order.paymentStatus === "paid";
  const pickupSchedule = order.pickupTimeText || "Khách ghé lấy khi tới";

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flexOne}>
          <Text style={styles.orderCode} numberOfLines={1}>
            {order.displayOrderCode || order.orderCode}
          </Text>
          <View style={styles.highlightGrid}>
            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>Khách nhận</Text>
              <Text style={styles.highlightValue} numberOfLines={1}>
                {order.customerName || "Khách tự lấy"}
              </Text>
              <Text style={styles.highlightMeta} numberOfLines={1}>
                {order.customerPhone || "Không có SĐT"}
              </Text>
            </View>

            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>Hẹn ghé lấy</Text>
              <Text style={styles.highlightValue} numberOfLines={1}>
                {pickupSchedule}
              </Text>
              <Text style={styles.highlightMeta} numberOfLines={1}>
                Đặt lúc {formatTime(order.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.amountCol}>
          <Text style={styles.amount}>{formatMoney(order.totalAmount)}</Text>
          <View style={[styles.badge, paid ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={styles.badgeText}>{getPaymentLabel(order)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.kitchenStatus}>
          <PosIcon name="order" size={13} color={POS_COLORS.slate} />
          <Text style={styles.kitchenText}>{getKitchenLabel(order)}</Text>
        </View>

        <View style={styles.paymentActions}>
          <Pressable
            style={[styles.qrButton, (paid || loading) && styles.disabledButton]}
            hitSlop={8}
            onPress={() => onPayQr?.(order)}
            disabled={paid || loading}
          >
            <PosIcon name="qr" size={14} color={paid ? POS_COLORS.muted : POS_COLORS.slate} />
            <Text style={[styles.qrButtonText, paid && styles.disabledText]}>
              {paid ? "Đã thu" : "QR"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.cashButton, (paid || loading) && styles.disabledButton]}
            hitSlop={8}
            onPress={() => onPayCash?.(order)}
            disabled={paid || loading}
          >
            <PosIcon name="cash" size={14} color={paid ? POS_COLORS.muted : POS_COLORS.primaryDark} />
            <Text style={[styles.cashButtonText, paid && styles.disabledText]}>
              {paid ? "Đã thu" : "Tiền mặt"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const PosPickupOrdersPanel = memo(function PosPickupOrdersPanel({
  orders = [],
  loading = false,
  error = "",
  onRefresh,
  onPayCash,
  onPayQr
}) {
  const [filter, setFilter] = useState("unpaid");
  const unpaidCount = useMemo(
    () => (Array.isArray(orders) ? orders : []).filter((order) => order.paymentStatus !== "paid").length,
    [orders]
  );
  const filteredOrders = useMemo(
    () => (Array.isArray(orders) ? orders : []).filter((order) => {
      if (filter === "unpaid") return order.paymentStatus !== "paid";
      if (filter === "paid") return order.paymentStatus === "paid";
      return true;
    }),
    [filter, orders]
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.panel}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Website tự lấy</Text>
          <Text style={styles.title}>Đơn hẹn lấy</Text>
          <Text style={styles.subtitle}>
            Thu tiền tại POS, trạng thái giao khách vẫn để Kitchen xử lý.
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countValue}>{unpaidCount}</Text>
          <Text style={styles.countLabel}>cần thu</Text>
        </View>
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
                  {item.id === "unpaid" && unpaidCount > 0 ? `${item.label} (${unpaidCount})` : item.label}
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
            <PickupOrderCard
              key={order.id}
              order={order}
              loading={loading}
              onPayCash={onPayCash}
              onPayQr={onPayQr}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Không có đơn hẹn lấy phù hợp.</Text>
            <Text style={styles.emptyCopy}>
              Đơn đặt web tự lấy sẽ hiện tại đây nếu đúng chi nhánh và còn cần xử lý.
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
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md
  },
  panel: {
    gap: 10,
    padding: 8
  },
  header: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 12
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
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900"
  },
  subtitle: {
    color: POS_COLORS.slate,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  countPill: {
    width: 92,
    borderWidth: 1,
    borderColor: "#86efac",
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
  toolbar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    borderRadius: POS_RADIUS.md,
    padding: 8
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
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  card: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
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
  metaText: {
    marginTop: 4,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
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
  amountCol: {
    minWidth: 112,
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
    fontWeight: "900"
  },
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
