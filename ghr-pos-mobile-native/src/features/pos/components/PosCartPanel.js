import React, { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";

function buildOptionSummary(options = []) {
  if (!Array.isArray(options) || !options.length) return "";
  const normalized = options
    .map((option) => String(option || "").trim())
    .filter(Boolean);
  if (!normalized.length) return "";
  if (normalized.length <= 2) return normalized.join(" · ");
  return `${normalized.slice(0, 2).join(" · ")} · +${normalized.length - 2} tùy chọn`;
}

const PosCartPanel = memo(function PosCartPanel({
  cart = [],
  onChangeQuantity,
  onEditItem,
  onClear,
  fillAvailable = false
}) {
  if (!cart.length) {
    return (
      <View style={[styles.emptyPanel, fillAvailable && styles.emptyPanelFill]}>
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <PosIcon name="cart" size={18} color={POS_COLORS.muted} />
          </View>
          <Text style={styles.emptyTitle}>Chưa có món</Text>
          <Text style={styles.emptyHint}>Chọn món ở bên trái để bắt đầu tạo bill.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Pressable style={styles.clearButton} onPress={onClear}>
        <PosIcon name="clear" size={14} color={POS_COLORS.danger} />
      </Pressable>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {cart.map((item) => {
          const optionSummary = buildOptionSummary(item.options);
          const autoGift = Number(item.lineTotal || 0) <= 0;

          return (
            <Pressable
              key={item.cartId || item.id}
              style={styles.itemRow}
              onPress={() => onEditItem?.(item)}
              disabled={autoGift}
            >
              <View style={styles.itemMain}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>{formatMoney(item.lineTotal)}</Text>
                </View>

                {optionSummary ? (
                  <Text style={styles.optionText} numberOfLines={2}>
                    {optionSummary}
                  </Text>
                ) : null}
              </View>

              {autoGift ? (
                <View style={styles.giftBadge}>
                  <Text style={styles.giftBadgeText}>Tặng</Text>
                </View>
              ) : (
                <View style={styles.controls}>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      onChangeQuantity(item.cartId, -1);
                    }}
                  >
                    <Text style={styles.qtyButtonText}>-</Text>
                  </Pressable>
                  <View style={styles.qtyValueBox}>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                  </View>
                  <Pressable
                    style={[styles.qtyButton, styles.qtyButtonPrimary]}
                    onPress={(event) => {
                      event.stopPropagation();
                      onChangeQuantity(item.cartId, 1);
                    }}
                  >
                    <Text style={[styles.qtyButtonText, styles.qtyButtonPrimaryText]}>+</Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default PosCartPanel;

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    position: "relative",
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 6
  },
  clearButton: {
    position: "absolute",
    top: -10,
    right: 10,
    zIndex: 2,
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  list: {
    flex: 1,
    minHeight: 0
  },
  listContent: {
    gap: 4,
    paddingTop: 8,
    paddingBottom: 2
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.softBorder,
    paddingVertical: 7
  },
  itemMain: {
    flex: 1,
    gap: 2
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  itemName: {
    flex: 1,
    color: POS_COLORS.heading,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900"
  },
  itemPrice: {
    color: POS_COLORS.heading,
    fontSize: 11,
    fontWeight: "900"
  },
  optionText: {
    color: POS_COLORS.slate,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700"
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  qtyButtonPrimary: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  qtyButtonText: {
    color: POS_COLORS.slate,
    fontSize: 14,
    fontWeight: "900"
  },
  qtyButtonPrimaryText: {
    color: POS_COLORS.primaryDark
  },
  qtyValueBox: {
    minWidth: 22,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: POS_COLORS.surface
  },
  qtyText: {
    color: POS_COLORS.heading,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900"
  },
  giftBadge: {
    minWidth: 54,
    height: 28,
    borderWidth: 1,
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  giftBadgeText: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "900"
  },
  emptyPanel: {
    minHeight: 220
  },
  emptyPanelFill: {
    flex: 1
  },
  emptyBox: {
    flex: 1,
    minHeight: 140,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18
  },
  emptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: POS_COLORS.subtleSurface,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    color: POS_COLORS.heading,
    fontSize: 16,
    fontWeight: "900"
  },
  emptyHint: {
    color: POS_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center"
  }
});
