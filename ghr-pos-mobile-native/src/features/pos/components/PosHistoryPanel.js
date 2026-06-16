import React, { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";

function formatTime(value = "") {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSessionStatusText(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "Đã trả";
  if (normalized === "converted") return "Đã tạo đơn";
  if (normalized === "converting") return "Đang chốt";
  if (normalized === "cancelled") return "Đã hủy";
  if (normalized === "expired") return "Hết hạn";
  return "Chờ CK";
}

function getOrderStatusText(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "cancelled" || normalized === "canceled") return "Đã hủy";
  if (normalized === "done" || normalized === "completed") return "Hoàn tất";
  if (normalized === "pending_zalo") return "Đang xử lý";
  return status || "Mới";
}

function getStatusTone(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "converted", "done", "completed"].includes(normalized)) {
    return styles.statusSuccess;
  }
  if (["cancelled", "canceled", "expired"].includes(normalized)) {
    return styles.statusDanger;
  }
  return styles.statusNeutral;
}

function HistoryCard({
  title,
  meta,
  amount,
  status,
  primaryAction,
  secondaryAction
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flexOne}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amountText}>{amount}</Text>
          <View style={[styles.statusBadge, getStatusTone(status)]}>
            <Text style={styles.statusBadgeText}>{status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        {primaryAction ? (
          <Pressable
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={primaryAction.onPress}
            disabled={primaryAction.disabled}
          >
            <Text style={[styles.primaryActionText, primaryAction.disabled && styles.disabledText]}>
              {primaryAction.label}
            </Text>
          </Pressable>
        ) : null}

        {secondaryAction ? (
          <Pressable
            style={[styles.actionButton, styles.secondaryActionButton]}
            onPress={secondaryAction.onPress}
            disabled={secondaryAction.disabled}
          >
            <Text style={[styles.secondaryActionText, secondaryAction.disabled && styles.disabledText]}>
              {secondaryAction.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const PosHistoryPanel = memo(function PosHistoryPanel({
  recentOrders = [],
  paymentSessions = [],
  loading = false,
  error = "",
  onRefresh,
  onOpenPaymentSession,
  onCancelPaymentSession,
  onCancelOrder,
  onReprintOrder
}) {
  return (
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

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>QR đang chờ</Text>
          <Text style={styles.countText}>{paymentSessions.length}</Text>
        </View>

        {paymentSessions.length ? (
          paymentSessions.map((session) => (
            <HistoryCard
              key={session.id}
              title={session.paymentReference || session.displayOrderCode}
              meta={`Thẻ ${session.pagerNumber || "--"} · ${session.customerName || "Khách tại quầy"} · ${formatTime(session.createdAt)}`}
              amount={formatMoney(session.amountExpected)}
              status={getSessionStatusText(session.status)}
              primaryAction={{
                label: "Mở QR",
                onPress: () => onOpenPaymentSession?.(session),
                disabled: loading
              }}
              secondaryAction={{
                label: "Hủy",
                onPress: () => onCancelPaymentSession?.(session),
                disabled: loading
              }}
            />
          ))
        ) : (
          <Text style={styles.empty}>Không có QR đang chờ.</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Đơn gần đây</Text>
          <Text style={styles.countText}>{recentOrders.length}</Text>
        </View>

        {recentOrders.length ? (
          recentOrders.map((order) => (
            <HistoryCard
              key={order.id}
              title={order.displayOrderCode || order.id}
              meta={`Thẻ ${order.pagerNumber || "--"} · ${order.customerName || "Khách tại quầy"} · ${formatTime(order.createdAt)}`}
              amount={formatMoney(order.totalAmount)}
              status={getOrderStatusText(order.status)}
              primaryAction={{
                label: "In lại",
                onPress: () => onReprintOrder?.(order),
                disabled: loading
              }}
              secondaryAction={
                order.canCancel
                  ? {
                      label: "Hủy đơn",
                      onPress: () => onCancelOrder?.(order),
                      disabled: loading
                    }
                  : null
              }
            />
          ))
        ) : (
          <Text style={styles.empty}>Chưa có đơn POS gần đây.</Text>
        )}
      </View>
    </ScrollView>
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
    gap: 14,
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
    gap: 8
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
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface
  },
  secondaryActionButton: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  primaryActionText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900"
  },
  secondaryActionText: {
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
