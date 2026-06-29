import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";

function buildPaymentStatus(paymentConfirmed = null) {
  if (!paymentConfirmed) return "Chưa xác nhận thanh toán";
  if (paymentConfirmed.method === "cash") {
    return `Tiền mặt · khách đưa ${formatMoney(paymentConfirmed.received || 0)} · thối ${formatMoney(paymentConfirmed.change || 0)}`;
  }
  return "Đã xác nhận thanh toán QR";
}

export default function PaymentBar({
  totals = {},
  paymentConfirmed,
  disabled = false,
  hasBenefitSignal = false,
  onOpenBenefit,
  onConfirmCash,
  onOpenQrPayment,
  onCreateOrder
}) {
  const subtotal = Number(totals.subtotal || 0);
  const total = Number(totals.total || 0);
  const discount = Math.max(0, subtotal - total);
  const readyToCreate = !!paymentConfirmed && !disabled;

  return (
    <View style={styles.wrap}>
      <View style={styles.infoCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Tạm tính</Text>
            <Text style={styles.summaryValue}>{formatMoney(subtotal)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Giảm</Text>
            <Text style={styles.summaryValue}>{formatMoney(discount)}</Text>
          </View>
          <View style={[styles.summaryItem, styles.summaryItemTotal]}>
            <Text style={styles.totalLabel}>Tổng cần thu</Text>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
          </View>
        </View>
        <Text style={styles.status}>{buildPaymentStatus(paymentConfirmed)}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.benefitButton, hasBenefitSignal && styles.benefitButtonReady]}
          onPress={onOpenBenefit}
        >
          <PosIcon
            name="voucher"
            size={18}
            color={hasBenefitSignal ? POS_COLORS.primaryDark : "#6366f1"}
          />
          {hasBenefitSignal ? <View style={styles.benefitDot} /> : null}
        </Pressable>

        <Pressable
          style={[styles.secondary, disabled && styles.disabledButton]}
          onPress={onConfirmCash}
          disabled={disabled}
        >
          <View style={styles.buttonRow}>
            <PosIcon name="cash" size={16} color={disabled ? POS_COLORS.muted : POS_COLORS.slate} />
            <Text style={[styles.secondaryText, disabled && styles.disabledText]}>Tiền mặt</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.secondary, disabled && styles.disabledButton]}
          onPress={onOpenQrPayment}
          disabled={disabled}
        >
          <View style={styles.buttonRow}>
            <PosIcon name="qr" size={16} color={disabled ? POS_COLORS.muted : POS_COLORS.slate} />
            <Text style={[styles.secondaryText, disabled && styles.disabledText]}>QR</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.primary, !readyToCreate && styles.primaryDisabled]}
          onPress={onCreateOrder}
          disabled={!readyToCreate}
        >
          <View style={styles.buttonRow}>
            <PosIcon
              name="order"
              size={16}
              color={!readyToCreate ? POS_COLORS.muted : POS_COLORS.surface}
            />
            <Text style={[styles.primaryText, !readyToCreate && styles.disabledText]}>
              {paymentConfirmed ? "Tạo đơn" : "Chờ thanh toán"}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    gap: 8,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface
  },
  infoCard: {
    gap: 7,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 9
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8
  },
  summaryItem: {
    flex: 1,
    gap: 3
  },
  summaryItemTotal: {
    alignItems: "flex-end"
  },
  summaryLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  totalLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  totalValue: {
    color: "#166534",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900"
  },
  status: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "700"
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  benefitButton: {
    width: 46,
    minHeight: 42,
    borderRadius: POS_RADIUS.md,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  benefitButtonReady: {
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft
  },
  benefitDot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: POS_COLORS.primaryDark
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  secondary: {
    flex: 1,
    minHeight: 42,
    borderRadius: POS_RADIUS.md,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  primary: {
    flex: 1.35,
    minHeight: 42,
    borderRadius: POS_RADIUS.md,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryDisabled: {
    borderColor: "#94a3b8",
    backgroundColor: POS_COLORS.disabled
  },
  disabledButton: {
    opacity: 0.55
  },
  secondaryText: {
    color: POS_COLORS.slate,
    fontSize: 13,
    fontWeight: "900"
  },
  primaryText: {
    color: POS_COLORS.surface,
    fontSize: 13,
    fontWeight: "900"
  },
  disabledText: {
    color: POS_COLORS.muted
  }
});
