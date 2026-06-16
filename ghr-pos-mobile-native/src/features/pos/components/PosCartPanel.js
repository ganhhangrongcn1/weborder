import React, { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";

const PosCartPanel = memo(function PosCartPanel({
  cart = [],
  totals = {},
  onChangeQuantity,
  onClear,
  fillAvailable = false
}) {
  const itemCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

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
      <View style={styles.head}>
        <View style={styles.headTitle}>
          <View style={styles.headIcon}>
            <PosIcon name="receipt" size={16} color={POS_COLORS.primaryDark} />
          </View>
          <View style={styles.headCopy}>
            <Text style={styles.eyebrow}>Bill hiện tại</Text>
            <Text style={styles.title}>{itemCount} món</Text>
          </View>
        </View>
        <Pressable style={styles.clearButton} onPress={onClear}>
          <View style={styles.clearRow}>
            <PosIcon name="clear" size={14} color={POS_COLORS.danger} />
            <Text style={styles.clearText}>Xóa bill</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {cart.map((item) => (
          <View key={item.cartId || item.id} style={styles.itemCard}>
            <View style={styles.itemHead}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.itemPrice}>{formatMoney(item.lineTotal)}</Text>
            </View>

            {Array.isArray(item.options) && item.options.length ? (
              <Text style={styles.optionText} numberOfLines={2}>
                {item.options.slice(0, 3).join(" · ")}
              </Text>
            ) : null}

            <View style={styles.itemFoot}>
              <Text style={styles.unitText}>{formatMoney(item.price || 0)} / món</Text>
              <View style={styles.controls}>
                <Pressable style={styles.qtyButton} onPress={() => onChangeQuantity(item.cartId, -1)}>
                  <Text style={styles.qtyButtonText}>-</Text>
                </Pressable>
                <View style={styles.qtyValueBox}>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                </View>
                <Pressable
                  style={[styles.qtyButton, styles.qtyButtonPrimary]}
                  onPress={() => onChangeQuantity(item.cartId, 1)}
                >
                  <Text style={[styles.qtyButtonText, styles.qtyButtonPrimaryText]}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.totalBox}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Số món</Text>
          <Text style={styles.totalValue}>{itemCount}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tạm tính</Text>
          <Text style={styles.totalValue}>{formatMoney(totals.subtotal || 0)}</Text>
        </View>
        {Number(totals.voucherDiscount || 0) > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.discountLabel}>Voucher</Text>
            <Text style={styles.discountValue}>-{formatMoney(totals.voucherDiscount)}</Text>
          </View>
        ) : null}
        {Number(totals.pointsDiscount || 0) > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.discountLabel}>Điểm loyalty</Text>
            <Text style={styles.discountValue}>-{formatMoney(totals.pointsDiscount)}</Text>
          </View>
        ) : null}
        <View style={[styles.totalRow, styles.totalStrongRow]}>
          <Text style={styles.totalStrongLabel}>Tổng cộng</Text>
          <Text style={styles.totalStrongValue}>{formatMoney(totals.total || 0)}</Text>
        </View>
      </View>
    </View>
  );
});

export default PosCartPanel;

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  flexOne: {
    flex: 1
  },
  headTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: POS_COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  headCopy: {
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
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "900"
  },
  clearButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center"
  },
  clearText: {
    color: POS_COLORS.danger,
    fontSize: 12,
    fontWeight: "900"
  },
  clearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  list: {
    maxHeight: 270
  },
  listContent: {
    gap: 8
  },
  itemCard: {
    gap: 7,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  itemName: {
    flex: 1,
    color: POS_COLORS.heading,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900"
  },
  itemPrice: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  optionText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700"
  },
  itemFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  unitText: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "800"
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: POS_RADIUS.md,
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
    fontSize: 17,
    fontWeight: "900"
  },
  qtyButtonPrimaryText: {
    color: POS_COLORS.primaryDark
  },
  qtyValueBox: {
    minWidth: 34,
    height: 34,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: POS_COLORS.surface
  },
  qtyText: {
    color: POS_COLORS.heading,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900"
  },
  totalBox: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.softBorder,
    paddingTop: 12
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  totalLabel: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  totalValue: {
    color: POS_COLORS.slate,
    fontSize: 13,
    fontWeight: "900"
  },
  discountLabel: {
    color: POS_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "800"
  },
  discountValue: {
    color: POS_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  totalStrongRow: {
    marginTop: 2
  },
  totalStrongLabel: {
    color: POS_COLORS.heading,
    fontSize: 15,
    fontWeight: "900"
  },
  totalStrongValue: {
    color: "#166534",
    fontSize: 19,
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
