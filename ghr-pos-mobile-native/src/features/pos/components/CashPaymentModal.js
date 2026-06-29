import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { calculateCashChange, getCashPaymentSummary, normalizeCashReceived } from "../../../shared/pos/posPayment";
import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import { getPosDialogWidth, POS_MODAL } from "./posModalTokens";

const CASH_LEVELS = [50000, 100000, 200000, 500000, 1000000, 2000000];

function formatCashInput(value = "") {
  const normalized = normalizeCashReceived(value);
  if (!normalized) return "";
  return normalized.toLocaleString("vi-VN");
}

function roundUpToStep(amount = 0, step = 1000) {
  if (!step) return amount;
  return Math.ceil(amount / step) * step;
}

function buildSmartSuggestions(amount = 0) {
  const baseAmount = Math.max(0, Number(amount || 0));
  if (!baseAmount) return CASH_LEVELS.slice(0, 5);

  const suggestions = new Set();
  [5000, 10000, 20000, 50000, 100000].forEach((step) => {
    const rounded = roundUpToStep(baseAmount, step);
    if (rounded > baseAmount) suggestions.add(rounded);
  });

  const allowedLevels = baseAmount <= 500000
    ? CASH_LEVELS.filter((level) => level <= 500000)
    : CASH_LEVELS;

  for (const level of allowedLevels) {
    if (level >= baseAmount) suggestions.add(level);
  }

  const sorted = [...suggestions]
    .filter((value) => value > 0)
    .sort((first, second) => first - second);

  if (baseAmount <= 500000) {
    const withoutTopLevel = sorted.filter((value) => value !== 500000);
    return [...withoutTopLevel.slice(0, 5), 500000];
  }

  return sorted.slice(0, 6);
}

export default function CashPaymentModal({
  visible,
  amount = 0,
  cashReceived = "",
  setCashReceived,
  processing = false,
  eyebrow = "Tiền mặt",
  title = "Xác nhận thanh toán",
  subtitle = "",
  useSystemModal = false,
  onClose,
  onConfirm
}) {
  const { width } = useWindowDimensions();
  const cashSummary = getCashPaymentSummary(amount);
  const amountDue = cashSummary.paymentAmount;
  const hasCashRounding = cashSummary.cashRoundingDiscount > 0;
  const normalized = normalizeCashReceived(cashReceived);
  const shouldAutoFocusInput = !normalized;
  const change = calculateCashChange(amountDue, normalized);
  const missing = Math.max(0, amountDue - normalized);
  const paidEnough = normalized >= amountDue;
  const suggestions = useMemo(() => buildSmartSuggestions(amountDue), [amountDue]);
  const dialogWidth = getPosDialogWidth(width, 500);
  const quickColumns = 3;
  const quickButtonWidth = "31.8%";
  const quickItems = [
    { key: "exact", label: "Đủ tiền", value: amountDue, selected: normalized === amountDue },
    ...suggestions.map((value) => ({
      key: String(value),
      label: formatMoney(value),
      value,
      selected: normalized === value
    }))
  ];
  const paddedQuickItems = [...quickItems];
  while (paddedQuickItems.length % quickColumns !== 0) {
    paddedQuickItems.push({ key: `empty-${paddedQuickItems.length}`, empty: true });
  }

  const content = (
    <View style={styles.layer}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { width: dialogWidth }]}>
        <View style={styles.header}>
          <View style={styles.flexOne}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Đóng</Text>
          </Pressable>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Cần thu</Text>
          <View style={styles.amountValueGroup}>
            <Text style={styles.amountValue}>{formatMoney(amountDue)}</Text>
            {hasCashRounding ? (
              <Text style={styles.amountHint}>
                Gốc {formatMoney(cashSummary.originalAmount)} · làm tròn xuống {formatMoney(cashSummary.cashRoundingDiscount)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.quickGrid}>
          {paddedQuickItems.map((item) => {
            if (item.empty) {
              return <View key={item.key} style={{ width: quickButtonWidth }} />;
            }

            return (
              <Pressable
                key={item.key}
                style={[
                  styles.quickButton,
                  { width: quickButtonWidth },
                  item.selected && styles.quickButtonActive,
                  item.key === "exact" && styles.quickButtonExact
                ]}
                onPress={() => setCashReceived?.(String(item.value))}
              >
                <Text style={[styles.quickText, item.selected && styles.quickTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Tiền khách đưa</Text>
          <TextInput
            value={formatCashInput(cashReceived)}
            onChangeText={(value) => setCashReceived?.(String(value || "").replace(/[^\d]/g, ""))}
            placeholder="Nhập số tiền"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            autoFocus={shouldAutoFocusInput}
            style={[styles.input, paidEnough && styles.inputPaid]}
          />
        </View>

        <View style={[styles.resultCard, paidEnough ? styles.resultPaid : styles.resultMissing]}>
          <View style={styles.resultCol}>
            <Text style={styles.resultLabel}>Khách đưa</Text>
            <Text style={styles.resultValue}>{formatMoney(normalized)}</Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultColRight}>
            <Text style={styles.resultLabel}>{paidEnough ? "Tiền thối" : "Còn thiếu"}</Text>
            <Text style={[styles.resultValue, paidEnough ? styles.resultValuePaid : styles.resultValueMissing]}>
              {formatMoney(paidEnough ? change : missing)}
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, (!paidEnough || processing) && styles.primaryDisabled]}
          disabled={!paidEnough || processing}
          onPress={onConfirm}
        >
          <Text style={[styles.primaryText, (!paidEnough || processing) && styles.disabledText]}>
            {processing ? "Đang xử lý..." : "Xác nhận đã thanh toán"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (!visible) return null;
  if (!useSystemModal) return content;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 500
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  sheet: {
    gap: POS_MODAL.gap,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_MODAL.radius,
    padding: POS_MODAL.padding,
    ...POS_SHADOW
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
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
    lineHeight: POS_MODAL.titleLineHeight,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 4,
    color: POS_COLORS.slate,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  closeButton: {
    minHeight: POS_MODAL.closeButtonHeight,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: {
    color: POS_COLORS.slate,
    fontSize: 14,
    fontWeight: "900"
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.softBorder,
    paddingBottom: 7
  },
  amountLabel: {
    color: POS_COLORS.slate,
    fontSize: 15,
    fontWeight: "800"
  },
  amountValue: {
    color: POS_COLORS.heading,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900"
  },
  amountValueGroup: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3
  },
  amountHint: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right"
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 7
  },
  quickButton: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  quickButtonExact: {
    minWidth: 0
  },
  quickButtonActive: {
    borderColor: "#7bc590",
    backgroundColor: POS_COLORS.primarySoft
  },
  quickText: {
    color: POS_COLORS.slate,
    fontSize: 14,
    fontWeight: "900"
  },
  quickTextActive: {
    color: POS_COLORS.primaryDark
  },
  field: {
    gap: 5
  },
  fieldLabel: {
    color: POS_COLORS.slate,
    fontSize: 14,
    fontWeight: "800"
  },
  input: {
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    color: POS_COLORS.text,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: "900"
  },
  inputPaid: {
    borderColor: "#7bc590"
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderRadius: POS_RADIUS.md,
    overflow: "hidden"
  },
  resultPaid: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  resultMissing: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  resultCol: {
    flex: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  resultColRight: {
    flex: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-end"
  },
  resultDivider: {
    width: 1,
    backgroundColor: "rgba(148, 163, 184, 0.28)"
  },
  resultLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900"
  },
  resultValue: {
    color: POS_COLORS.heading,
    fontSize: 18,
    fontWeight: "900"
  },
  resultValuePaid: {
    color: POS_COLORS.primaryDark
  },
  resultValueMissing: {
    color: POS_COLORS.danger
  },
  primaryButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryDisabled: {
    borderColor: "#94a3b8",
    backgroundColor: POS_COLORS.disabled
  },
  primaryText: {
    color: POS_COLORS.surface,
    fontSize: 16,
    fontWeight: "900"
  },
  disabledText: {
    color: POS_COLORS.muted
  }
});
