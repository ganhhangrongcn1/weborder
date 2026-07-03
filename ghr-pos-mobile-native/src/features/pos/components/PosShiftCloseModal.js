import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from "react-native";

import {
  formatCashBreakdownSummary,
  getCashBreakdownTotal
} from "../../../services/pos/posCashBreakdownService";
import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosCashCountModal from "./PosCashCountModal";
import { getPosDialogWidth, POS_MODAL } from "./posModalTokens";

function getDifferenceState(hasCountedCash, difference) {
  if (!hasCountedCash) {
    return {
      label: "Chưa đếm tiền",
      amount: 0,
      tone: styles.diffPending
    };
  }

  if (difference === 0) {
    return {
      label: "Khớp tiền",
      amount: 0,
      tone: styles.diffEven
    };
  }

  if (difference > 0) {
    return {
      label: "Thừa tiền",
      amount: difference,
      tone: styles.diffOver
    };
  }

  return {
    label: "Thiếu tiền",
    amount: Math.abs(difference),
    tone: styles.diffShort
  };
}

export default function PosShiftCloseModal({
  visible,
  shift,
  summary,
  loading = false,
  error = "",
  onClose,
  onConfirm
}) {
  const { width } = useWindowDimensions();
  const dialogWidth = getPosDialogWidth(width, 680);
  const [closingNote, setClosingNote] = useState("");
  const [printReceipt, setPrintReceipt] = useState(true);
  const [cashCounterOpen, setCashCounterOpen] = useState(false);
  const [cashBreakdown, setCashBreakdown] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setClosingNote("");
    setPrintReceipt(true);
    setCashCounterOpen(false);
    setCashBreakdown(null);
  }, [visible]);

  const expectedCash = Number(summary?.expectedCash ?? shift?.openingCash ?? 0);
  const cashRoundingTotal = Number(summary?.cashRoundingTotal || 0);
  const hasCashRounding = cashRoundingTotal > 0;
  const countedAmount = useMemo(() => getCashBreakdownTotal(cashBreakdown), [cashBreakdown]);
  const difference = countedAmount - expectedCash;
  const hasCountedCash = Boolean(cashBreakdown);
  const differenceState = getDifferenceState(hasCountedCash, difference);

  if (!visible) return null;

  return (
    <>
        <View style={styles.layer}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { width: dialogWidth }]}>
            <View style={styles.header}>
              <View style={styles.flexOne}>
                <Text style={styles.eyebrow}>POS</Text>
                <Text style={styles.title}>Kết ca bán hàng</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Tiền đầu ca</Text>
                  <Text style={styles.summaryValue}>{formatMoney(shift?.openingCash || 0)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Tiền mặt đã thu</Text>
                  <Text style={styles.summaryValue}>{formatMoney(summary?.cashTotal || 0)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Tiền chuyển khoản</Text>
                  <Text style={styles.summaryValue}>{formatMoney(summary?.qrTotal || 0)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Dự kiến trong két</Text>
                  <Text style={styles.summaryValue}>{formatMoney(expectedCash)}</Text>
                  {hasCashRounding ? (
                    <Text style={styles.summaryHint}>Giảm làm tròn {formatMoney(cashRoundingTotal)}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.section}>
                <Pressable
                  style={[styles.requiredCountCard, hasCountedCash && styles.requiredCountCardDone]}
                  onPress={() => setCashCounterOpen(true)}
                >
                  <View style={styles.requiredCountText}>
                    <View style={[styles.requiredBadge, hasCountedCash && styles.requiredBadgeDone]}>
                      <Text style={[styles.requiredBadgeText, hasCountedCash && styles.requiredBadgeTextDone]}>
                        {hasCountedCash ? "Đã kiểm" : "Bắt buộc"}
                      </Text>
                    </View>
                    <Text style={styles.requiredTitle}>
                      {hasCountedCash ? "Đã kiểm tiền cuối ca" : "Kiểm tiền cuối ca"}
                    </Text>
                    <Text style={styles.requiredHint}>
                      {hasCountedCash
                        ? "Có thể đếm lại nếu cần trước khi xác nhận kết ca."
                        : "Cần nhập số tờ theo mệnh giá để đối chiếu đủ, thiếu hoặc thừa."}
                    </Text>
                  </View>
                  <View style={styles.requiredAction}>
                    <Text style={styles.requiredActionText}>{hasCountedCash ? "Đếm lại" : "Đếm theo mệnh giá"}</Text>
                  </View>
                </Pressable>

                <View style={styles.breakdownCard}>
                  <View style={styles.breakdownHead}>
                    <Text style={styles.summaryLabel}>Tiền mặt thực đếm</Text>
                    {hasCountedCash ? (
                      <View style={styles.readyBadge}>
                        <Text style={styles.readyBadgeText}>Đã đếm</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.breakdownValue}>
                    {hasCountedCash ? formatMoney(countedAmount) : "Chưa có dữ liệu"}
                  </Text>
                  <Text style={styles.breakdownText}>{formatCashBreakdownSummary(cashBreakdown)}</Text>
                </View>

                <View style={[styles.diffCard, differenceState.tone]}>
                  <Text style={styles.diffLabel}>{differenceState.label}</Text>
                  <Text style={styles.diffValue}>{formatMoney(differenceState.amount)}</Text>
                  <Text style={styles.diffMeta}>
                    Thực đếm: {hasCountedCash ? formatMoney(countedAmount) : "--"} • Dự kiến: {formatMoney(expectedCash)}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionCaption}>Biên bản kết ca</Text>
                <TextInput
                  value={closingNote}
                  onChangeText={setClosingNote}
                  placeholder="Ví dụ: Bàn giao ca tối, thiếu 20.000đ..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={styles.noteInput}
                />

                <View style={styles.printRow}>
                  <View style={styles.flexOne}>
                    <Text style={styles.printTitle}>In phiếu kết ca</Text>
                    <Text style={styles.printHint}>Phiếu sẽ in số liệu ca và phần chênh lệch tiền.</Text>
                  </View>
                  <Switch value={printReceipt} onValueChange={setPrintReceipt} />
                </View>
              </View>

              {!!error && <Text style={styles.errorBox}>{error}</Text>}
            </ScrollView>

            <Pressable
              style={[styles.submitButton, (!hasCountedCash || loading) && styles.submitButtonDisabled]}
              disabled={!hasCountedCash || loading}
              onPress={() =>
                onConfirm?.({
                  closingCashCounted: countedAmount,
                  closingCashBreakdown: cashBreakdown,
                  closingNote,
                  printReceipt
                })
              }
            >
              <Text style={[styles.submitText, (!hasCountedCash || loading) && styles.disabledText]}>
                {loading ? "Đang kết ca..." : "Xác nhận kết ca"}
              </Text>
            </Pressable>
          </View>
        </View>

      <PosCashCountModal
        visible={cashCounterOpen}
        title="Đếm tiền cuối ca"
        subtitle="Nhập đầy đủ số tờ thực tế còn trong két."
        initialCounts={cashBreakdown}
        onClose={() => setCashCounterOpen(false)}
        onApply={({ counts }) => {
          setCashBreakdown(counts);
          setCashCounterOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 500,
    elevation: 12
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
    fontSize: 14,
    fontWeight: "900"
  },
  body: {
    gap: 12
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  summaryCard: {
    minWidth: "47%",
    flexGrow: 1,
    gap: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  summaryLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: POS_COLORS.heading,
    fontSize: 17,
    fontWeight: "900"
  },
  summaryHint: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  section: {
    gap: 8
  },
  sectionCaption: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  requiredCountCard: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  requiredCountCardDone: {
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft
  },
  requiredCountText: {
    flex: 1,
    gap: 5
  },
  requiredBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fef3c7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  requiredBadgeDone: {
    borderColor: "#86efac",
    backgroundColor: "#dcfce7"
  },
  requiredBadgeText: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  requiredBadgeTextDone: {
    color: POS_COLORS.primaryDark
  },
  requiredTitle: {
    color: POS_COLORS.heading,
    fontSize: 17,
    fontWeight: "900"
  },
  requiredHint: {
    color: POS_COLORS.slate,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800"
  },
  requiredAction: {
    minWidth: 128,
    minHeight: 54,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  requiredActionText: {
    color: POS_COLORS.surface,
    fontSize: 14,
    fontWeight: "900"
  },
  breakdownCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  breakdownHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  readyBadge: {
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  readyBadgeText: {
    color: POS_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: "900"
  },
  breakdownValue: {
    color: POS_COLORS.heading,
    fontSize: 18,
    fontWeight: "900"
  },
  breakdownText: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  diffCard: {
    gap: 4,
    borderWidth: 1,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  diffPending: {
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface
  },
  diffEven: {
    borderColor: "#bbf7d0",
    backgroundColor: POS_COLORS.primarySoft
  },
  diffOver: {
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb"
  },
  diffShort: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  diffLabel: {
    color: POS_COLORS.heading,
    fontSize: 12,
    fontWeight: "900"
  },
  diffValue: {
    color: POS_COLORS.heading,
    fontSize: 22,
    fontWeight: "900"
  },
  diffMeta: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  noteInput: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: POS_COLORS.heading,
    fontSize: 16
  },
  printRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  printTitle: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  printHint: {
    marginTop: 2,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  errorBox: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    color: POS_COLORS.danger,
    borderRadius: POS_RADIUS.md,
    padding: 10,
    fontSize: 12,
    fontWeight: "800"
  },
  submitButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  submitButtonDisabled: {
    borderColor: "#cbd5e1",
    backgroundColor: "#e2e8f0"
  },
  submitText: {
    color: POS_COLORS.surface,
    fontSize: 16,
    fontWeight: "900"
  },
  disabledText: {
    color: POS_COLORS.muted
  }
});
