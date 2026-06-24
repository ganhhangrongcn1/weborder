import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import {
  CASH_DENOMINATIONS,
  getCashBreakdownTotal,
  normalizeCashBreakdown,
  toCashCount
} from "../../../services/pos/posCashBreakdownService";
import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import { getPosDialogWidth, POS_MODAL } from "./posModalTokens";

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["C", "0", "<"]
];

const DENOMINATION_COLUMNS = 3;

export default function PosCashCountModal({
  visible,
  title = "Đếm tiền cuối ca",
  subtitle = "",
  initialCounts = null,
  onClose,
  onApply
}) {
  const { width } = useWindowDimensions();
  const dialogWidth = getPosDialogWidth(width, 820);
  const [counts, setCounts] = useState({});
  const [activeDenomination, setActiveDenomination] = useState(CASH_DENOMINATIONS[0]);

  useEffect(() => {
    if (!visible) return;
    setCounts(normalizeCashBreakdown(initialCounts) || {});
    setActiveDenomination(CASH_DENOMINATIONS[0]);
  }, [initialCounts, visible]);

  const total = useMemo(() => getCashBreakdownTotal(counts), [counts]);
  const activeCount = counts[String(activeDenomination)] || 0;

  const denominationRows = useMemo(() => {
    const rows = [];
    for (let index = 0; index < CASH_DENOMINATIONS.length; index += DENOMINATION_COLUMNS) {
      rows.push(CASH_DENOMINATIONS.slice(index, index + DENOMINATION_COLUMNS));
    }
    return rows;
  }, []);

  const setCountForDenomination = (denomination, value) => {
    const normalized = toCashCount(value);
    setCounts((current) => {
      const next = { ...current };
      if (normalized > 0) {
        next[String(denomination)] = normalized;
      } else {
        delete next[String(denomination)];
      }
      return next;
    });
  };

  const handleStepCount = (delta) => {
    const currentCount = counts[String(activeDenomination)] || 0;
    setCountForDenomination(activeDenomination, currentCount + delta);
  };

  const handleDigitPress = (digit) => {
    if (digit === "C") {
      setCountForDenomination(activeDenomination, 0);
      return;
    }

    if (digit === "<") {
      const nextValue = String(activeCount).slice(0, -1);
      setCountForDenomination(activeDenomination, nextValue || 0);
      return;
    }

    const base = activeCount > 0 ? String(activeCount) : "";
    const nextValue = `${base}${digit}`.slice(0, 4);
    setCountForDenomination(activeDenomination, nextValue);
  };

  const handleClearAll = () => {
    setCounts({});
  };

  const handleApply = () => {
    onApply?.({ counts: normalizeCashBreakdown(counts) || null, total });
  };

  const renderDenominationCard = (denomination) => {
    const count = counts[String(denomination)] || 0;
    const active = denomination === activeDenomination;
    const rowTotal = denomination * count;

    return (
      <Pressable
        key={denomination}
        style={[styles.moneyCard, active && styles.moneyCardActive]}
        onPress={() => setActiveDenomination(denomination)}
      >
        <Text style={styles.moneyLabel} numberOfLines={1}>
          {formatMoney(denomination)}
        </Text>
        <View style={styles.moneyMeta}>
          <Text style={styles.moneySubValue} numberOfLines={1}>
            {formatMoney(rowTotal)}
          </Text>
          <View style={[styles.countBadge, active && styles.countBadgeActive]}>
            <Text style={[styles.countBadgeValue, active && styles.countBadgeValueActive]}>{count}</Text>
            <Text style={[styles.countBadgeText, active && styles.countBadgeTextActive]}>tờ</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (!visible) return null;

  return (
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { width: dialogWidth }]}>
          <View style={styles.header}>
            <View style={styles.headerBody}>
              <Text style={styles.eyebrow}>POS</Text>
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.ghostButton} onPress={handleClearAll}>
                <Text style={styles.ghostButtonText}>Xóa hết</Text>
              </Pressable>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.leftColumn}>
              <View style={styles.moneyGrid}>
                {denominationRows.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.moneyGridRow}>
                    {row.map((denomination) => renderDenominationCard(denomination))}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.rightColumn}>
              <View style={styles.activeCard}>
                <View style={styles.activeHeader}>
                  <Text style={styles.activeLabel}>Đang nhập</Text>
                  <View style={styles.activeCountBadge}>
                    <Text style={styles.activeCountBadgeText}>{activeCount} tờ</Text>
                  </View>
                </View>
                <View style={styles.activeValueRow}>
                  <Text style={styles.activeValue} numberOfLines={1}>
                    {formatMoney(activeDenomination)}
                  </Text>
                  <View style={styles.activeStepper}>
                    <Pressable
                      style={[styles.stepButton, activeCount <= 0 && styles.stepButtonDisabled]}
                      onPress={() => handleStepCount(-1)}
                      disabled={activeCount <= 0}
                    >
                      <Text style={[styles.stepButtonText, activeCount <= 0 && styles.stepButtonTextDisabled]}>-</Text>
                    </Pressable>
                    <Pressable style={styles.stepButton} onPress={() => handleStepCount(1)}>
                      <Text style={styles.stepButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.keypad}>
                {KEYPAD_ROWS.map((row) => (
                  <View key={row.join("-")} style={styles.keypadRow}>
                    {row.map((key) => (
                      <Pressable key={key} style={styles.keyButton} onPress={() => handleDigitPress(key)}>
                        <Text style={styles.keyButtonText}>{key}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Tiền thực đếm</Text>
                <Text style={styles.totalValue} numberOfLines={1}>
                  {formatMoney(total)}
                </Text>
              </View>
            </View>
          </View>

          <Pressable style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyText}>Áp dụng</Text>
          </Pressable>
        </View>
      </View>
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
    gap: 12,
    overflow: "hidden",
    ...POS_SHADOW
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  headerBody: {
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
  subtitle: {
    marginTop: 4,
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  ghostButton: {
    minHeight: POS_MODAL.closeButtonHeight,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostButtonText: {
    color: POS_COLORS.muted,
    fontSize: 14,
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
  content: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10
  },
  leftColumn: {
    flex: 1.15,
    minWidth: 0
  },
  rightColumn: {
    flex: 0.95,
    minWidth: 0,
    gap: 8
  },
  moneyGrid: {
    gap: 8
  },
  moneyGridRow: {
    flexDirection: "row",
    gap: 8
  },
  moneyCard: {
    flex: 1,
    minHeight: 112,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "space-between"
  },
  moneyCardActive: {
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft
  },
  moneyLabel: {
    color: POS_COLORS.heading,
    fontSize: 16,
    fontWeight: "900"
  },
  moneyMeta: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8
  },
  moneySubValue: {
    flex: 1,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  countBadge: {
    minWidth: 58,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  countBadgeActive: {
    borderColor: "#86efac",
    backgroundColor: "#dcfce7"
  },
  countBadgeValue: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  countBadgeValueActive: {
    color: POS_COLORS.primaryDark
  },
  countBadgeText: {
    color: POS_COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  countBadgeTextActive: {
    color: POS_COLORS.primaryDark
  },
  activeCard: {
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 12,
    gap: 10
  },
  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  activeLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  activeCountBadge: {
    minWidth: 58,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "center"
  },
  activeCountBadgeText: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  activeValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  activeValue: {
    flex: 1,
    color: POS_COLORS.heading,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900"
  },
  activeStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  stepButton: {
    width: 54,
    height: 54,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  stepButtonDisabled: {
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface
  },
  stepButtonText: {
    color: POS_COLORS.heading,
    fontSize: 24,
    fontWeight: "900"
  },
  stepButtonTextDisabled: {
    color: POS_COLORS.muted
  },
  keypad: {
    gap: 8
  },
  keypadRow: {
    flexDirection: "row",
    gap: 8
  },
  keyButton: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  keyButtonText: {
    color: POS_COLORS.heading,
    fontSize: 24,
    fontWeight: "900"
  },
  totalBox: {
    marginTop: "auto",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  totalLabel: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  totalValue: {
    marginTop: 4,
    color: POS_COLORS.primaryDark,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900"
  },
  applyButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  applyText: {
    color: POS_COLORS.surface,
    fontSize: 17,
    fontWeight: "900"
  }
});
