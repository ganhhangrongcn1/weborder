import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { buildVoucherSelectionKey } from "../../../shared/pos/posLoyalty";
import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";
import { getPosDialogWidth, POS_MODAL } from "./posModalTokens";

function buildBenefitCompactCopy({ promotionHints = [], loyaltyBenefit = {}, selectedVoucher = null }) {
  const normalVoucherCount = (loyaltyBenefit?.checkoutVouchers || []).length;
  const bestPromotion = Array.isArray(promotionHints) && promotionHints.length ? promotionHints[0] : null;
  const title = bestPromotion
    ? (bestPromotion.eligible ? `Đủ mốc quà: ${bestPromotion.rewardText}` : `Gợi ý thêm ${formatMoney(bestPromotion.missing)}`)
    : (selectedVoucher?.source === "checkout"
      ? (selectedVoucher.title || selectedVoucher.code || "Đang chọn voucher")
      : "Ưu đãi & tư vấn");

  const subtitleParts = [];
  if (bestPromotion) {
    subtitleParts.push(bestPromotion.eligible ? "Nhắc khách nhận quà" : `Đủ ${formatMoney(bestPromotion.minSubtotal)} có quà`);
  }
  if (normalVoucherCount) subtitleParts.push(`${normalVoucherCount} voucher`);
  if (selectedVoucher?.source === "checkout" && loyaltyBenefit?.voucherDiscount > 0) {
    subtitleParts.push(`Giảm ${formatMoney(loyaltyBenefit.voucherDiscount)}`);
  }

  return {
    title,
    subtitle: subtitleParts.length ? subtitleParts.join(" · ") : "Chạm để mở danh sách ưu đãi"
  };
}

function PromotionHintList({ promotionHints = [] }) {
  if (!Array.isArray(promotionHints) || !promotionHints.length) return null;

  return (
    <View style={styles.hintList}>
      {promotionHints.map((promotion) => (
        <View key={promotion.id} style={styles.hintCard}>
          <Text style={styles.hintEyebrow}>Tư vấn bán hàng</Text>
          <Text style={styles.hintTitle}>
            {promotion.eligible ? `Đủ mốc quà: ${promotion.rewardText}` : `Gợi ý thêm ${formatMoney(promotion.missing)}`}
          </Text>
          <Text style={styles.hintText}>
            {promotion.eligible
              ? "Đơn đã đủ mốc, nhắc khách nhận quà."
              : `Đủ ${formatMoney(promotion.minSubtotal)} sẽ tặng ${promotion.rewardText}.`}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function PosBenefitCard({
  loyaltyBenefit,
  selectedVoucherId,
  setSelectedVoucherId,
  promotionHints,
  disabled = false
}) {
  const { width } = useWindowDimensions();
  const [modalOpen, setModalOpen] = useState(false);
  const checkoutVouchers = loyaltyBenefit?.checkoutVouchers || [];
  const selectedVoucher = loyaltyBenefit?.selectedVoucher?.source === "checkout"
    ? loyaltyBenefit.selectedVoucher
    : null;
  const benefitCopy = useMemo(
    () => buildBenefitCompactCopy({ promotionHints, loyaltyBenefit, selectedVoucher }),
    [loyaltyBenefit, promotionHints, selectedVoucher]
  );
  const dialogWidth = getPosDialogWidth(width, 520);

  const handleToggleVoucher = (voucher) => {
    const voucherKey = buildVoucherSelectionKey(voucher);
    setSelectedVoucherId(selectedVoucherId === voucherKey ? "" : voucherKey);
  };

  return (
    <>
      <Pressable
        style={[styles.triggerCard, disabled && styles.triggerCardDisabled]}
        onPress={() => setModalOpen(true)}
      >
        <View style={styles.triggerIcon}>
          <PosIcon name="voucher" size={16} color={POS_COLORS.primaryDark} />
        </View>

        <View style={styles.triggerCopy}>
          <Text style={styles.triggerEyebrow}>Ưu đãi & tư vấn</Text>
          <Text style={styles.triggerTitle} numberOfLines={1}>
            {benefitCopy.title}
          </Text>
          <Text style={styles.triggerSubtitle} numberOfLines={1}>
            {benefitCopy.subtitle}
          </Text>
        </View>

        <View style={styles.triggerActions}>
          {!!selectedVoucher && Number(loyaltyBenefit?.voucherDiscount || 0) > 0 ? (
            <Text style={styles.discountText}>-{formatMoney(loyaltyBenefit.voucherDiscount || 0)}</Text>
          ) : null}
          <View style={styles.triggerButton}>
            <PosIcon name="voucher" size={14} color="#6366f1" />
          </View>
        </View>
      </Pressable>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.layer}>
          <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)} />
          <View style={[styles.sheet, { width: dialogWidth }]}>
            <View style={styles.sheetHead}>
              <View style={styles.flexOne}>
                <Text style={styles.sheetEyebrow}>POS</Text>
                <Text style={styles.sheetTitle}>Ưu đãi & tư vấn</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setModalOpen(false)}>
                <Text style={styles.sheetCloseText}>Đóng</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <PromotionHintList promotionHints={promotionHints} />

              {!!selectedVoucher ? (
                <View style={styles.selectedBox}>
                  <View style={styles.selectedCopy}>
                    <Text style={styles.selectedLabel}>Voucher đang chọn</Text>
                    <Text style={styles.selectedTitle} numberOfLines={1}>
                      {selectedVoucher.title || selectedVoucher.code}
                    </Text>
                  </View>
                  <View style={styles.selectedActions}>
                    <Text style={styles.selectedDiscount}>-{formatMoney(loyaltyBenefit?.voucherDiscount || 0)}</Text>
                    <Pressable
                      style={styles.clearButton}
                      onPress={() => setSelectedVoucherId("")}
                      disabled={disabled}
                    >
                      <PosIcon name="clear" size={13} color={POS_COLORS.danger} />
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.modalSection}>
                <View style={styles.modalSectionHead}>
                  <Text style={styles.modalSectionTitle}>Voucher thường</Text>
                  <Text style={styles.modalSectionCount}>{checkoutVouchers.length}</Text>
                </View>

                {checkoutVouchers.length ? (
                  <View style={styles.voucherList}>
                    {checkoutVouchers.map((voucher) => {
                      const voucherKey = buildVoucherSelectionKey(voucher);
                      const active = selectedVoucherId === voucherKey;
                      const disabledVoucher = Number(voucher.minOrder || 0) > Number(loyaltyBenefit?.subtotal || 0);
                      return (
                        <Pressable
                          key={voucherKey}
                          style={[
                            styles.voucherChip,
                            active && styles.voucherChipActive,
                            disabledVoucher && styles.voucherChipDisabled
                          ]}
                          onPress={() => handleToggleVoucher(voucher)}
                          disabled={disabled || disabledVoucher}
                        >
                          <View style={styles.voucherTop}>
                            <Text style={[styles.voucherTitle, active && styles.voucherTitleActive]} numberOfLines={1}>
                              {voucher.title || voucher.code || "Voucher"}
                            </Text>
                            {active ? <PosIcon name="open" size={14} color={POS_COLORS.primaryDark} /> : null}
                          </View>
                          <Text style={[styles.voucherMeta, active && styles.voucherMetaActive]} numberOfLines={1}>
                            {voucher.conditionText || "Áp dụng trực tiếp tại quầy"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>Chưa có voucher thường khả dụng.</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  triggerCardDisabled: {
    opacity: 0.65
  },
  triggerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: POS_COLORS.primarySoft
  },
  triggerCopy: {
    flex: 1,
    gap: 1
  },
  triggerEyebrow: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  triggerTitle: {
    color: POS_COLORS.heading,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900"
  },
  triggerSubtitle: {
    color: POS_COLORS.slate,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700"
  },
  triggerActions: {
    alignItems: "flex-end",
    gap: 6
  },
  triggerButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#f8fafc",
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center"
  },
  discountText: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "900"
  },
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
    maxHeight: "74%",
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_MODAL.radius,
    padding: POS_MODAL.padding,
    gap: POS_MODAL.gap,
    ...POS_SHADOW
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  flexOne: {
    flex: 1
  },
  sheetEyebrow: {
    color: POS_COLORS.muted,
    fontSize: POS_MODAL.eyebrowSize,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  sheetTitle: {
    marginTop: 2,
    color: POS_COLORS.heading,
    fontSize: POS_MODAL.titleSize,
    fontWeight: "900"
  },
  sheetCloseButton: {
    minHeight: POS_MODAL.closeButtonHeight,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  sheetCloseText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  sheetBody: {
    gap: 12,
    paddingBottom: 4
  },
  hintList: {
    gap: 8
  },
  hintCard: {
    gap: 4,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  hintEyebrow: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  hintTitle: {
    color: POS_COLORS.heading,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  hintText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  selectedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  selectedCopy: {
    flex: 1,
    gap: 2
  },
  selectedLabel: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  selectedTitle: {
    color: POS_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  selectedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  selectedDiscount: {
    color: POS_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  clearButton: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  modalSection: {
    gap: 10
  },
  modalSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  modalSectionTitle: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  modalSectionCount: {
    minWidth: 24,
    textAlign: "center",
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  voucherList: {
    gap: 8
  },
  voucherChip: {
    gap: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  voucherChipActive: {
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft
  },
  voucherChipDisabled: {
    opacity: 0.45
  },
  voucherTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  voucherTitle: {
    flex: 1,
    color: POS_COLORS.heading,
    fontSize: 12,
    fontWeight: "900"
  },
  voucherTitleActive: {
    color: POS_COLORS.primaryDark
  },
  voucherMeta: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "700"
  },
  voucherMetaActive: {
    color: POS_COLORS.primaryDark
  },
  emptyText: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "700"
  }
});
