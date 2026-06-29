import React, { memo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { buildVoucherSelectionKey } from "../../../shared/pos/posLoyalty";
import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

function toDigits(value = "") {
  return String(value || "").replace(/\D+/g, "").slice(0, 11);
}

function StatCell({ label, value }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function VoucherButton({ voucher, active, disabled, onPress }) {
  return (
    <Pressable
      style={[
        styles.voucherChip,
        active && styles.voucherChipActive,
        disabled && styles.voucherChipDisabled
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.voucherTitle, active && styles.voucherTitleActive]} numberOfLines={1}>
        {voucher.title || voucher.name || voucher.code || "Voucher"}
      </Text>
      <Text style={[styles.voucherMeta, active && styles.voucherMetaActive]} numberOfLines={1}>
        {voucher.conditionText || voucher.code || "Áp dụng tại quầy"}
      </Text>
    </Pressable>
  );
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
  setPointsInput
}) {
  const customer = lookup?.result;
  const stats = customer?.stats || {};
  const vouchers = loyaltyBenefit?.loyaltyVouchers || [];
  const visibleVouchers = vouchers.slice(0, 2);
  const pointSuggestions = (loyaltyBenefit?.pointSuggestions || []).slice(0, 3);
  const availablePoints = Number(loyaltyBenefit?.availablePoints || 0);
  const currentPoints = Math.max(0, Math.floor(Number(customer?.loyalty?.totalPoints ?? availablePoints ?? 0)));
  const usablePoints = Number(loyaltyBenefit?.usablePoints || 0);
  const pointSpendStep = Math.max(1, Number(loyaltyBenefit?.pointSpendStep || 1000));
  const discountTotal = Number(loyaltyBenefit?.voucherDiscount || 0) + Number(loyaltyBenefit?.pointsDiscount || 0);
  const customerTitle = customer?.customerStatusTitle || customer?.customerName || "";
  const customerLabel = customer?.customerStatusLabel || (customer?.registeredCustomer ? "Khách thành viên" : "SĐT mới");
  const customerDetail = customer?.customerStatusDetail || "";
  const normalizePointInput = () => {
    const rawPoints = Number(String(pointsInput || "").replace(/\D/g, ""));
    const normalizedPoints = Math.min(
      usablePoints,
      Math.floor(Math.max(0, rawPoints) / pointSpendStep) * pointSpendStep
    );
    setPointsInput(normalizedPoints > 0 ? String(normalizedPoints) : "");
  };

  return (
    <View style={styles.panel}>
      <View style={styles.inputRow}>
        <View style={styles.inputField}>
          <Text style={styles.fieldLabel}>Tên khách</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Tên khách"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>
        <View style={styles.inputField}>
          <Text style={styles.fieldLabel}>Số điện thoại</Text>
          <TextInput
            value={customerPhone}
            onChangeText={(value) => setCustomerPhone(toDigits(value))}
            placeholder="Số điện thoại"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            maxLength={11}
            style={styles.input}
          />
        </View>
      </View>

      {customer ? (
        <View style={styles.summaryCard}>
          <View style={styles.cardHead}>
            <View style={styles.flexOne}>
              <Text style={styles.cardEyebrow}>Tổng hợp theo SĐT</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {customerTitle || customerLabel}
              </Text>
              <Text style={styles.cardSubTitle} numberOfLines={1}>{customerLabel}</Text>
            </View>
            <View style={styles.orderCountBox}>
              <Text style={styles.cardEyebrow}>Tổng đơn</Text>
              <Text style={styles.orderCount}>{Number(stats.totalOrders || 0)}</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <StatCell label="Tổng mua" value={formatMoney(stats.totalSpent || 0)} />
            <StatCell label="Điểm hiện có" value={`${currentPoints.toLocaleString("vi-VN")} điểm`} />
            <StatCell label="Chờ tích" value={`${Number(stats.pendingPoints || 0).toLocaleString("vi-VN")} điểm`} />
          </View>
          {!!customerDetail && <Text style={styles.customerDetail} numberOfLines={1}>{customerDetail}</Text>}
        </View>
      ) : null}

      {customer ? (
        <View style={styles.benefitBox}>
          <View style={styles.cardHead}>
            <View style={styles.flexOne}>
              <Text style={styles.cardEyebrow}>Ưu đãi khách hàng</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{customer.customerName || customerLabel}</Text>
            </View>
            <View style={styles.orderCountBox}>
              <Text style={styles.cardEyebrow}>Đã giảm</Text>
              <Text style={styles.discountText}>{formatMoney(discountTotal)}</Text>
            </View>
          </View>

          <View style={styles.inlineSection}>
            <View style={styles.inlineHead}>
              <Text style={styles.sectionTitle}>Voucher loyalty</Text>
              <Text style={styles.sectionCount}>{vouchers.length}</Text>
            </View>
            {visibleVouchers.length ? (
              <View style={styles.voucherList}>
                {visibleVouchers.map((voucher) => {
                  const voucherKey = buildVoucherSelectionKey(voucher);
                  const active = selectedVoucherId === voucherKey;
                  const disabled = Number(voucher.minOrder || 0) > Number(loyaltyBenefit?.subtotal || 0);
                  return (
                    <VoucherButton
                      key={voucherKey}
                      voucher={voucher}
                      active={active}
                      disabled={disabled}
                      onPress={() => setSelectedVoucherId(active ? "" : voucherKey)}
                    />
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyBenefit}>Chưa có voucher loyalty khả dụng.</Text>
            )}
          </View>

          <View style={styles.pointCard}>
            <View style={styles.pointRow}>
              <View style={styles.pointCopy}>
                <Text style={styles.pointLabel}>Dùng điểm</Text>
                <Text style={styles.pointHint}>Còn {availablePoints.toLocaleString("vi-VN")} điểm</Text>
              </View>
              {Number(pointsInput || 0) > 0 ? (
                <Pressable style={styles.clearPointsButton} onPress={() => setPointsInput("")}>
                  <Text style={styles.clearPointsText}>Hủy dùng điểm</Text>
                </Pressable>
              ) : null}
              <TextInput
                value={pointsInput}
                onChangeText={(value) => setPointsInput(toDigits(value))}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                onEndEditing={normalizePointInput}
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
                    <Text style={styles.suggestionText} numberOfLines={1}>
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
    gap: 10
  },
  inputRow: {
    flexDirection: "row",
    gap: 10
  },
  inputField: {
    flex: 1,
    gap: 6
  },
  fieldLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 11,
    color: POS_COLORS.heading,
    fontSize: 16,
    fontWeight: "800"
  },
  statusBox: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  statusReady: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4"
  },
  statusError: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2"
  },
  statusCopy: {
    flex: 1
  },
  statusText: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  tierText: {
    marginTop: 2,
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "700"
  },
  statusReadyText: {
    color: POS_COLORS.primaryDark
  },
  statusErrorText: {
    color: POS_COLORS.danger
  },
  clearInline: {
    minHeight: 30,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: POS_RADIUS.sm,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  clearInlineText: {
    color: POS_COLORS.danger,
    fontSize: 12,
    fontWeight: "900"
  },
  summaryCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  benefitBox: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  flexOne: {
    flex: 1
  },
  cardEyebrow: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  cardTitle: {
    marginTop: 3,
    color: POS_COLORS.heading,
    fontSize: 16,
    fontWeight: "900"
  },
  cardSubTitle: {
    marginTop: 2,
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "800"
  },
  customerDetail: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "800"
  },
  orderCountBox: {
    alignItems: "flex-end",
    minWidth: 78
  },
  orderCount: {
    marginTop: 3,
    color: POS_COLORS.heading,
    fontSize: 18,
    fontWeight: "900"
  },
  discountText: {
    marginTop: 3,
    color: POS_COLORS.heading,
    fontSize: 18,
    fontWeight: "900"
  },
  statsGrid: {
    flexDirection: "row",
    gap: 7
  },
  statCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 9,
    paddingVertical: 8
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
    fontSize: 12,
    fontWeight: "900"
  },
  inlineSection: {
    gap: 7
  },
  inlineHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  sectionCount: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  voucherList: {
    gap: 6
  },
  voucherChip: {
    gap: 3,
    minHeight: 56,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 11,
    paddingVertical: 10,
    justifyContent: "center"
  },
  voucherChipActive: {
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft
  },
  voucherChipDisabled: {
    opacity: 0.45
  },
  voucherTitle: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  voucherTitleActive: {
    color: POS_COLORS.primaryDark
  },
  voucherMeta: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "700"
  },
  voucherMetaActive: {
    color: POS_COLORS.primaryDark
  },
  emptyBenefit: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#dbeafe",
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 8,
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  pointCard: {
    gap: 7,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 9
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  pointCopy: {
    flex: 1,
    gap: 2
  },
  clearPointsButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  clearPointsText: {
    color: POS_COLORS.danger,
    fontSize: 13,
    fontWeight: "900"
  },
  pointLabel: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  pointHint: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  pointInput: {
    minWidth: 86,
    minHeight: 48,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    color: POS_COLORS.heading,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right"
  },
  suggestionList: {
    flexDirection: "row",
    gap: 6
  },
  suggestionChip: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 9,
    justifyContent: "center"
  },
  suggestionText: {
    color: POS_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  }
});
