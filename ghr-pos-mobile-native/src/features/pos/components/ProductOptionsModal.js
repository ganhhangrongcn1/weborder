import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSelectedList(groups = [], selectedOptions = {}) {
  return groups
    .map((group) => {
      const option = (group.options || []).find((item) => item.id === selectedOptions[group.id]);
      if (!option) return null;
      return {
        ...option,
        groupId: group.id,
        groupName: group.name
      };
    })
    .filter(Boolean);
}

export default function ProductOptionsModal({ product, onClose, onSubmit }) {
  const { width } = useWindowDimensions();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setQuantity(1);
    setNote("");
    setSelectedOptions({});
    setSubmitError("");
  }, [product?.id]);

  const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : [];
  const selectedList = useMemo(
    () => buildSelectedList(groups, selectedOptions),
    [groups, selectedOptions]
  );
  const optionTotal = selectedList.reduce((sum, option) => sum + toNumber(option.price, 0), 0);
  const total = (toNumber(product?.price, 0) + optionTotal) * quantity;
  const missingRequiredGroups = groups.filter((group) => group.required && !selectedOptions[group.id]);
  const canSubmit = Boolean(product) && missingRequiredGroups.length === 0;
  const compactGrid = width >= 680;

  const handleSelectOption = (groupId, optionId) => {
    setSelectedOptions((current) => ({ ...current, [groupId]: optionId }));
    setSubmitError("");
  };

  const handleSubmit = () => {
    if (!product) return;
    if (!canSubmit) {
      setSubmitError("Vui lòng chọn đủ tùy chọn bắt buộc trước khi thêm vào bill.");
      return;
    }

    onSubmit(product, {
      quantity,
      note,
      selectedOptions: selectedList
    });
  };

  return (
    <Modal visible={Boolean(product)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, width >= 680 && styles.sheetDesktop]}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>Tùy chọn món</Text>
              <Text style={styles.title} numberOfLines={2}>
                {product?.name || ""}
              </Text>
              <Text style={styles.basePrice}>Giá gốc {formatMoney(product?.price || 0)}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.id} style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupTitle}>{group.name}</Text>
                  <View style={[styles.groupBadge, group.required ? styles.groupBadgeRequired : styles.groupBadgeOptional]}>
                    <Text style={[styles.groupBadgeText, group.required ? styles.groupBadgeTextRequired : styles.groupBadgeTextOptional]}>
                      {group.required ? "Bắt buộc" : "Tùy chọn"}
                    </Text>
                  </View>
                </View>
                {group.required ? (
                  <Text style={styles.groupNote}>Chọn 1 mục trước khi thêm món.</Text>
                ) : null}

                <View style={styles.optionGrid}>
                  {(group.options || []).map((option) => {
                    const active = selectedOptions[group.id] === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        style={[
                          styles.optionButton,
                          compactGrid && styles.optionButtonHalf,
                          active && styles.optionButtonActive
                        ]}
                        onPress={() => handleSelectOption(group.id, option.id)}
                      >
                        <Text style={[styles.optionName, active && styles.optionNameActive]}>
                          {option.name}
                        </Text>
                        <Text style={[styles.optionPrice, active && styles.optionPriceActive]}>
                          {toNumber(option.price, 0) > 0 ? `+${formatMoney(option.price)}` : "Không cộng thêm"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <View style={styles.field}>
              <Text style={styles.label}>Ghi chú món</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Ví dụ: ít sốt, không rau răm..."
                placeholderTextColor="#94a3b8"
                style={[styles.input, styles.noteInput]}
                multiline
              />
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Số lượng</Text>
                <View style={styles.qtyControls}>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                  >
                    <Text style={styles.qtyButtonText}>-</Text>
                  </Pressable>
                  <View style={styles.qtyValueBox}>
                    <Text style={styles.qtyValue}>{quantity}</Text>
                  </View>
                  <Pressable
                    style={[styles.qtyButton, styles.qtyButtonPrimary]}
                    onPress={() => setQuantity((current) => current + 1)}
                  >
                    <Text style={[styles.qtyButtonText, styles.qtyButtonPrimaryText]}>+</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tiền option</Text>
                <Text style={styles.totalValue}>{formatMoney(optionTotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalStrongLabel}>Tổng thêm bill</Text>
                <Text style={styles.totalStrongValue}>{formatMoney(total)}</Text>
              </View>
            </View>

            {!!submitError && <Text style={styles.errorBox}>{submitError}</Text>}
          </ScrollView>

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
              Thêm vào bill · {formatMoney(total)}
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
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "82%",
    borderRadius: POS_RADIUS.lg,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    padding: 14,
    ...POS_SHADOW
  },
  sheetDesktop: {
    maxWidth: 620
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.softBorder,
    paddingBottom: 12
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
    lineHeight: 25,
    fontWeight: "900"
  },
  basePrice: {
    marginTop: 4,
    color: POS_COLORS.primaryDark,
    fontSize: 12,
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
  body: {
    gap: 12,
    paddingVertical: 12
  },
  group: {
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  groupTitle: {
    flex: 1,
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  groupBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  groupBadgeRequired: {
    borderColor: "#facc15",
    backgroundColor: "#fffbeb"
  },
  groupBadgeOptional: {
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface
  },
  groupBadgeText: {
    fontSize: 10,
    fontWeight: "900"
  },
  groupBadgeTextRequired: {
    color: POS_COLORS.warning
  },
  groupBadgeTextOptional: {
    color: POS_COLORS.muted
  },
  groupNote: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionButton: {
    minHeight: 46,
    width: "100%",
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  optionButtonHalf: {
    width: "48.9%"
  },
  optionButtonActive: {
    borderColor: POS_COLORS.primary,
    backgroundColor: POS_COLORS.primarySoft
  },
  optionName: {
    color: POS_COLORS.slate,
    fontSize: 13,
    fontWeight: "900"
  },
  optionNameActive: {
    color: POS_COLORS.primaryDark
  },
  optionPrice: {
    marginTop: 3,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  optionPriceActive: {
    color: POS_COLORS.primaryDark
  },
  field: {
    gap: 7
  },
  label: {
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "800"
  },
  noteInput: {
    minHeight: 82,
    textAlignVertical: "top"
  },
  summaryCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  qtyLabel: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  qtyButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: POS_COLORS.surface
  },
  qtyButtonPrimary: {
    borderColor: POS_COLORS.primary,
    backgroundColor: POS_COLORS.primarySoft
  },
  qtyButtonText: {
    color: POS_COLORS.slate,
    fontSize: 18,
    fontWeight: "900"
  },
  qtyButtonPrimaryText: {
    color: POS_COLORS.primaryDark
  },
  qtyValueBox: {
    minWidth: 38,
    height: 38,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: POS_COLORS.surface
  },
  qtyValue: {
    color: POS_COLORS.heading,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900"
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
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
  totalStrongLabel: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  totalStrongValue: {
    color: "#166534",
    fontSize: 18,
    fontWeight: "900"
  },
  errorBox: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    color: POS_COLORS.danger,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "800"
  },
  submitButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  submitButtonDisabled: {
    borderColor: "#94a3b8",
    backgroundColor: POS_COLORS.disabled
  },
  submitText: {
    color: POS_COLORS.surface,
    fontSize: 15,
    fontWeight: "900"
  },
  submitTextDisabled: {
    color: POS_COLORS.muted
  },
  flexOne: {
    flex: 1
  }
});
