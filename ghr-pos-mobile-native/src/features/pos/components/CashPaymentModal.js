import React from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { calculateCashChange, normalizeCashReceived } from "../../../shared/pos/posPayment";
import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

const CASH_SUGGESTIONS = [50000, 100000, 200000, 500000];

export default function CashPaymentModal({
  visible,
  amount = 0,
  cashReceived = "",
  setCashReceived,
  processing = false,
  onClose,
  onConfirm
}) {
  const normalized = normalizeCashReceived(cashReceived);
  const change = calculateCashChange(amount, normalized);
  const missing = Math.max(0, amount - normalized);
  const paidEnough = normalized >= amount;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>Tiền mặt</Text>
              <Text style={styles.title}>Xác nhận thanh toán</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Cần thu</Text>
            <Text style={styles.summaryValue}>{formatMoney(amount)}</Text>
          </View>

          <View style={styles.quickGrid}>
            {CASH_SUGGESTIONS.map((value) => {
              const selected = normalized === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.quickButton, selected && styles.quickButtonActive]}
                  onPress={() => setCashReceived?.(String(value))}
                >
                  <Text style={[styles.quickText, selected && styles.quickTextActive]}>{formatMoney(value)}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Tiền khách đưa</Text>
            <TextInput
              value={normalized > 0 ? String(normalized) : cashReceived}
              onChangeText={(value) => setCashReceived?.(String(value || "").replace(/[^\d]/g, ""))}
              placeholder="Nhập số tiền"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              autoFocus
              style={styles.input}
            />
          </View>

          <View style={[styles.noteCard, paidEnough ? styles.notePaid : styles.noteMissing]}>
            <View style={styles.noteRow}>
              <Text style={styles.noteLabel}>Khách đưa</Text>
              <Text style={styles.noteValue}>{formatMoney(normalized)}</Text>
            </View>
            <View style={styles.noteRow}>
              <Text style={styles.noteLabel}>{paidEnough ? "Tiền thối" : "Còn thiếu"}</Text>
              <Text style={styles.noteValue}>{formatMoney(paidEnough ? change : missing)}</Text>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: "center",
    padding: 14
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  sheet: {
    gap: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg,
    padding: 14,
    ...POS_SHADOW
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  eyebrow: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 3,
    color: POS_COLORS.heading,
    fontSize: 22,
    fontWeight: "900"
  },
  closeButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
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
  summaryCard: {
    gap: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  summaryLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: POS_COLORS.heading,
    fontSize: 22,
    fontWeight: "900"
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickButton: {
    minWidth: 92,
    minHeight: 38,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  quickButtonActive: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  quickText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  quickTextActive: {
    color: POS_COLORS.primaryDark
  },
  field: {
    gap: 7
  },
  fieldLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    color: POS_COLORS.text,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 16,
    fontWeight: "800"
  },
  noteCard: {
    gap: 8,
    borderWidth: 1,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  notePaid: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  noteMissing: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  noteLabel: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "800"
  },
  noteValue: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  primaryButton: {
    minHeight: 46,
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
    fontSize: 14,
    fontWeight: "900"
  },
  disabledText: {
    color: POS_COLORS.muted
  },
  flexOne: {
    flex: 1
  }
});
