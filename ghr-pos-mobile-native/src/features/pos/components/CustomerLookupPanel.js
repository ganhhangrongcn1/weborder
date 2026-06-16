import React, { memo } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { buildVoucherSelectionKey } from "../../../shared/pos/posLoyalty";
import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

function toDigits(value = "") {
  return String(value || "").replace(/\D+/g, "").slice(0, 11);
}

const CustomerLookupPanel = memo(function CustomerLookupPanel({
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  lookup,
  loyaltyBenefit,
  selectedVoucherId,
  setSelectedVoucherId,
  pointsInput,
  setPointsInput,
  onClear,
  compact = false
}) {
  const { width } = useWindowDimensions();
  const customer = lookup?.result;
  const vouchers = loyaltyBenefit?.availableVouchers || [];
  const pointSuggestions = loyaltyBenefit?.pointSuggestions || [];
  const hasBenefit = Boolean(
    (loyaltyBenefit?.voucherDiscount || 0) > 0 || (loyaltyBenefit?.pointsDiscount || 0) > 0
  );
  const horizontalFields = compact && width >= 360;
  const statusText = lookup?.loading
    ? "Đang tra khách..."
    : lookup?.error
      ? lookup.error
      : customer
        ? customer.registeredCustomer
          ? "Đã nhận diện thành viên"
          : "Đã nhận diện khách vãng lai"
        : customerPhone
          ? "Đã nhập SĐT"
          : "Chưa nhập SĐT";

  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.head}>
        <View style={styles.flexOne}>
          {compact ? (
            <View style={styles.compactLabels}>
              <Text style={styles.compactLabel}>Tên khách</Text>
              <Text style={styles.compactLabel}>SĐT</Text>
            </View>
          ) : (
            <>
              <Text style={styles.eyebrow}>Khách hàng</Text>
              <Text style={styles.title}>Thông tin và loyalty</Text>
            </>
          )}
        </View>
        <Pressable style={styles.clearButton} onPress={onClear} disabled={!customerName && !customerPhone}>
          <Text style={styles.clearText}>Xóa</Text>
        </Pressable>
      </View>

      <View style={[styles.inputGrid, horizontalFields && styles.inputRow]}>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Tên khách"
          placeholderTextColor="#94a3b8"
          style={[styles.input, horizontalFields && styles.inputHalf]}
        />
        <TextInput
          value={customerPhone}
          onChangeText={(value) => setCustomerPhone(toDigits(value))}
          placeholder="Số điện thoại"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          maxLength={11}
          style={[styles.input, horizontalFields && styles.inputHalf]}
        />
      </View>

      <View
        style={[
          styles.statusBox,
          lookup?.error && styles.statusError,
          customer && styles.statusReady
        ]}
      >
        <Text
          style={[
            styles.statusText,
            lookup?.error && styles.statusErrorText,
            customer && styles.statusReadyText
          ]}
        >
          {statusText}
        </Text>
      </View>

      {!compact && customer ? (
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Tổng đơn</Text>
            <Text style={styles.statValue}>{Number(customer.stats?.totalOrders || 0)}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Tổng mua</Text>
            <Text style={styles.statValue}>{formatMoney(customer.stats?.totalSpent || 0)}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Điểm</Text>
            <Text style={styles.statValue}>
              {Number(customer.loyalty?.totalPoints || 0).toLocaleString("vi-VN")}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Voucher</Text>
            <Text style={styles.statValue}>{Number(customer.availableVouchers?.length || 0)}</Text>
          </View>
        </View>
      ) : null}

      {!compact && customer ? (
        <View style={styles.benefitBox}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Ưu đãi POS</Text>
            {hasBenefit ? (
              <Text style={styles.discountText}>
                -{formatMoney((loyaltyBenefit?.voucherDiscount || 0) + (loyaltyBenefit?.pointsDiscount || 0))}
              </Text>
            ) : null}
          </View>

          {vouchers.length ? (
            <View style={styles.voucherList}>
              {vouchers.map((voucher) => {
                const voucherKey = buildVoucherSelectionKey(voucher);
                const active = selectedVoucherId === voucherKey;
                const disabled = Number(voucher.minOrder || 0) > Number(loyaltyBenefit?.subtotal || 0);
                return (
                  <Pressable
                    key={voucherKey}
                    style={[
                      styles.voucherChip,
                      active && styles.voucherChipActive,
                      disabled && styles.voucherChipDisabled
                    ]}
                    onPress={() => setSelectedVoucherId(active ? "" : voucherKey)}
                    disabled={disabled}
                  >
                    <Text style={[styles.voucherTitle, active && styles.voucherTitleActive]} numberOfLines={1}>
                      {voucher.title || voucher.code || "Voucher"}
                    </Text>
                    <Text style={[styles.voucherMeta, active && styles.voucherMetaActive]} numberOfLines={1}>
                      {voucher.conditionText || "Áp dụng tại quầy"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyBenefit}>Khách chưa có voucher khả dụng.</Text>
          )}

          <View style={styles.pointCard}>
            <View style={styles.pointRow}>
              <View style={styles.pointCopy}>
                <Text style={styles.pointLabel}>Dùng điểm</Text>
                <Text style={styles.pointHint}>
                  Còn {Number(loyaltyBenefit?.availablePoints || 0).toLocaleString("vi-VN")} điểm
                </Text>
              </View>
              <TextInput
                value={pointsInput}
                onChangeText={setPointsInput}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                style={styles.pointInput}
              />
            </View>

            {pointSuggestions.length ? (
              <View style={styles.suggestionList}>
                {pointSuggestions.map((suggestion) => (
                  <Pressable
                    key={`${suggestion.label}-${suggestion.points}`}
                    style={styles.suggestionChip}
                    onPress={() => setPointsInput(String(suggestion.points))}
                  >
                    <Text style={styles.suggestionText}>
                      {suggestion.label} · {Number(suggestion.points || 0).toLocaleString("vi-VN")} điểm
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
});

export default CustomerLookupPanel;

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  panelCompact: {
    paddingVertical: 12
  },
  head: {
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
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 2,
    color: POS_COLORS.heading,
    fontSize: 17,
    fontWeight: "900"
  },
  compactLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  compactLabel: {
    flex: 1,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  clearButton: {
    minHeight: 34,
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
  inputGrid: {
    gap: 10
  },
  inputRow: {
    flexDirection: "row"
  },
  inputHalf: {
    flex: 1
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    color: POS_COLORS.text,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "800"
  },
  statusBox: {
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: 10
  },
  statusReady: {
    borderColor: "#bbf7d0",
    backgroundColor: POS_COLORS.primarySoft
  },
  statusError: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  statusText: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  statusReadyText: {
    color: POS_COLORS.primaryDark
  },
  statusErrorText: {
    color: POS_COLORS.danger
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statCell: {
    flexGrow: 1,
    flexBasis: "47%",
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  statLabel: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  statValue: {
    marginTop: 4,
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  benefitBox: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.softBorder,
    paddingTop: 10
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  sectionTitle: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  discountText: {
    color: POS_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  voucherList: {
    gap: 8
  },
  voucherChip: {
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: 10
  },
  voucherChipActive: {
    borderColor: POS_COLORS.primary,
    backgroundColor: POS_COLORS.primarySoft
  },
  voucherChipDisabled: {
    opacity: 0.45
  },
  voucherTitle: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  voucherTitleActive: {
    color: POS_COLORS.primaryDark
  },
  voucherMeta: {
    marginTop: 3,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  voucherMetaActive: {
    color: POS_COLORS.primaryDark
  },
  emptyBenefit: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  pointCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  pointCopy: {
    flex: 1
  },
  pointLabel: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  pointHint: {
    marginTop: 3,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  pointInput: {
    width: 112,
    minHeight: 40,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    color: POS_COLORS.text,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right"
  },
  suggestionList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  suggestionText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900"
  }
});
