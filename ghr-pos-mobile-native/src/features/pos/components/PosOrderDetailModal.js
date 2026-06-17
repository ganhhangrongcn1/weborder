import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import { getPosDialogWidth, POS_MODAL } from "./posModalTokens";

function formatDateTime(value = "") {
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

function getOrderStatusLabel(order = {}) {
  const status = String(order.status || "").trim().toLowerCase();
  const kitchenStatus = String(order.kitchenStatus || "").trim().toLowerCase();
  if (["cancelled", "canceled", "cancel"].includes(status) || ["cancelled", "canceled", "cancel"].includes(kitchenStatus)) {
    return "Đã hủy";
  }
  if (["done", "completed", "complete"].includes(status) || ["done", "completed", "complete"].includes(kitchenStatus)) {
    return "Hoàn tất";
  }
  return "Đang xử lý";
}

function getPaymentMethodLabel(method = "") {
  const normalized = String(method || "").trim().toLowerCase();
  if (normalized === "bank_qr") return "Chuyển khoản";
  if (normalized === "cash") return "Tiền mặt";
  return "Chưa rõ";
}

function getItemOptionLabels(item = {}) {
  const selectedOptions = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
  return selectedOptions
    .map((option) => {
      const groupName = String(option.groupName || "").trim();
      const optionName = String(option.name || "").trim();
      return [groupName, optionName].filter(Boolean).join(": ");
    })
    .filter(Boolean);
}

export default function PosOrderDetailModal({
  visible,
  order,
  loading = false,
  actionBusy = false,
  onClose,
  onReprint,
  onCancel
}) {
  const { width } = useWindowDimensions();
  const dialogWidth = getPosDialogWidth(width, 560);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { width: dialogWidth }]}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>POS</Text>
              <Text style={styles.title}>Chi tiết đơn</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <Text style={styles.loadingText}>Đang tải chi tiết đơn...</Text>
            </View>
          ) : order ? (
            <>
              <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.heroCard}>
                  <View style={styles.heroHead}>
                    <Text style={styles.orderCode}>{order.displayOrderCode || order.id}</Text>
                    <Text style={styles.totalText}>{formatMoney(order.totalAmount || 0)}</Text>
                  </View>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{getOrderStatusLabel(order)}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{getPaymentMethodLabel(order.paymentMethod)}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{order.pagerNumber ? `Thẻ ${order.pagerNumber}` : "Không có thẻ"}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Khách hàng</Text>
                    <Text style={styles.infoValue}>{order.customerName || "Khách vãng lai"}</Text>
                    <Text style={styles.infoMeta}>{order.customerPhone || "Không có SĐT"}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Thời gian</Text>
                    <Text style={styles.infoValue}>{formatDateTime(order.createdAt)}</Text>
                    <Text style={styles.infoMeta}>{order.paidAt ? `Đã thu: ${formatDateTime(order.paidAt)}` : "Chưa ghi nhận giờ thu"}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Thanh toán</Text>
                    <Text style={styles.infoValue}>{order.paymentReference || "--"}</Text>
                    <Text style={styles.infoMeta}>{order.paymentStatus || "paid"}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Thu ngân</Text>
                    <Text style={styles.infoValue}>{order.cashierName || "--"}</Text>
                    <Text style={styles.infoMeta}>{order.branchName || "--"}</Text>
                  </View>
                </View>

                <View style={styles.moneyCard}>
                  <View style={styles.moneyRow}>
                    <Text style={styles.moneyLabel}>Tạm tính</Text>
                    <Text style={styles.moneyValue}>{formatMoney(order.subtotal || 0)}</Text>
                  </View>
                  <View style={styles.moneyRow}>
                    <Text style={styles.moneyLabel}>Voucher</Text>
                    <Text style={styles.moneyValue}>-{formatMoney(order.promoDiscount || 0)}</Text>
                  </View>
                  <View style={styles.moneyRow}>
                    <Text style={styles.moneyLabel}>Dùng điểm</Text>
                    <Text style={styles.moneyValue}>-{formatMoney(order.pointsDiscountAmount || 0)}</Text>
                  </View>
                  <View style={[styles.moneyRow, styles.moneyRowStrong]}>
                    <Text style={styles.moneyTotalLabel}>Tổng cộng</Text>
                    <Text style={styles.moneyTotalValue}>{formatMoney(order.totalAmount || 0)}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Món trong đơn</Text>
                  {(Array.isArray(order.items) ? order.items : []).map((item) => {
                    const optionLabels = getItemOptionLabels(item);
                    return (
                      <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemHead}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.itemPrice}>
                            x{item.quantity || 1} • {formatMoney(item.lineTotal || 0)}
                          </Text>
                        </View>
                        {optionLabels.length ? (
                          <Text style={styles.itemMeta} numberOfLines={2}>
                            {optionLabels.join(" • ")}
                          </Text>
                        ) : null}
                        {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.noteCard}>
                  <Text style={styles.infoLabel}>Ghi chú đơn</Text>
                  <Text style={styles.noteText}>{order.orderNote || "--"}</Text>
                </View>
              </ScrollView>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionButton, styles.ghostAction]}
                  onPress={() => onReprint?.(order)}
                  disabled={actionBusy}
                >
                  <Text style={[styles.ghostActionText, actionBusy && styles.disabledText]}>In lại bill</Text>
                </Pressable>
                {order.canCancel ? (
                  <Pressable
                    style={[styles.actionButton, styles.dangerAction]}
                    onPress={() => onCancel?.(order)}
                    disabled={actionBusy}
                  >
                    <Text style={[styles.dangerActionText, actionBusy && styles.disabledText]}>Hủy đơn</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.loadingBox}>
              <Text style={styles.loadingText}>Không có dữ liệu đơn.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.36)"
  },
  sheet: {
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_MODAL.radius,
    padding: POS_MODAL.padding,
    gap: POS_MODAL.gap,
    ...POS_SHADOW
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  flexOne: {
    flex: 1
  },
  eyebrow: {
    color: POS_COLORS.muted,
    fontSize: POS_MODAL.eyebrowSize,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 2,
    color: POS_COLORS.heading,
    fontSize: POS_MODAL.titleSize,
    fontWeight: "900"
  },
  closeButton: {
    minHeight: POS_MODAL.closeButtonHeight,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  body: {
    gap: 10
  },
  loadingBox: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    color: POS_COLORS.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  heroCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  heroHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  orderCode: {
    flex: 1,
    color: POS_COLORS.heading,
    fontSize: 18,
    fontWeight: "900"
  },
  totalText: {
    color: POS_COLORS.primaryDark,
    fontSize: 18,
    fontWeight: "900"
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tag: {
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  tagText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900"
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  infoCard: {
    minWidth: "47%",
    flexGrow: 1,
    gap: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  infoLabel: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  infoValue: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  infoMeta: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  moneyCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  moneyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  moneyRowStrong: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.softBorder
  },
  moneyLabel: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "800"
  },
  moneyValue: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  moneyTotalLabel: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  moneyTotalValue: {
    color: POS_COLORS.primaryDark,
    fontSize: 20,
    fontWeight: "900"
  },
  section: {
    gap: 8
  },
  sectionTitle: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  itemCard: {
    gap: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  itemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  itemName: {
    flex: 1,
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  itemPrice: {
    color: POS_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  itemMeta: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "700"
  },
  itemNote: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontStyle: "italic"
  },
  noteCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  noteText: {
    color: POS_COLORS.heading,
    fontSize: 12,
    fontWeight: "700"
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostAction: {
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface
  },
  dangerAction: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  ghostActionText: {
    color: POS_COLORS.slate,
    fontWeight: "900"
  },
  dangerActionText: {
    color: POS_COLORS.danger,
    fontWeight: "900"
  },
  disabledText: {
    color: POS_COLORS.muted
  }
});
