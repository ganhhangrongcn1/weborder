import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import { getPosDialogWidth, POS_MODAL } from "./posModalTokens";

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

function buildInitialSelectedOptions(groups = [], selectedOptions = []) {
  return (Array.isArray(selectedOptions) ? selectedOptions : []).reduce((result, option) => {
    const matchedGroup = (Array.isArray(groups) ? groups : []).find((group) => group.id === option.groupId);
    if (!matchedGroup) return result;
    return {
      ...result,
      [matchedGroup.id]: option.id
    };
  }, {});
}

export default function ProductOptionsModal({
  product,
  initialConfig = null,
  submitLabel = "",
  onClose,
  onSubmit
}) {
  const { width } = useWindowDimensions();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : [];
    setQuantity(Math.max(1, Number(initialConfig?.quantity || 1)));
    setNote(String(initialConfig?.note || ""));
    setSelectedOptions(buildInitialSelectedOptions(groups, initialConfig?.selectedOptions));
    setSubmitError("");
  }, [initialConfig, product?.id]);

  const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : [];
  const selectedList = useMemo(
    () => buildSelectedList(groups, selectedOptions),
    [groups, selectedOptions]
  );
  const optionTotal = selectedList.reduce((sum, option) => sum + toNumber(option.price, 0), 0);
  const total = (toNumber(product?.price, 0) + optionTotal) * quantity;
  const missingRequiredGroups = groups.filter((group) => group.required && !selectedOptions[group.id]);
  const canSubmit = Boolean(product) && missingRequiredGroups.length === 0;
  const compactGrid = width >= 760;
  const dialogWidth = getPosDialogWidth(width, width >= 760 ? 700 : 500);

  const handleSelectOption = (group, optionId) => {
    setSelectedOptions((current) => {
      const currentValue = current[group.id];
      if (!group.required && currentValue === optionId) {
        const next = { ...current };
        delete next[group.id];
        return next;
      }
      return { ...current, [group.id]: optionId };
    });
    setSubmitError("");
  };

  const handleSubmit = () => {
    if (!product) return;
    if (!canSubmit) {
      setSubmitError("Vui lòng chọn đủ tùy chọn bắt buộc trước khi lưu món.");
      return;
    }

    onSubmit(product, {
      quantity,
      note,
      selectedOptions: selectedList
    });
  };

  if (!product) return null;

  return (
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { width: dialogWidth }, width >= 680 && styles.sheetDesktop]}>
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
                  <Text style={styles.groupNote}>Chọn 1 mục trước khi lưu món.</Text>
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
                        onPress={() => handleSelectOption(group, option.id)}
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
                <Text style={styles.totalStrongLabel}>Tổng món</Text>
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
              {submitLabel || `Thêm vào bill · ${formatMoney(total)}`}
            </Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  sheet: {
    maxHeight: "82%",
    borderRadius: POS_MODAL.radius,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    padding: POS_MODAL.padding,
    ...POS_SHADOW
  },
  sheetDesktop: {},
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.softBorder,
    paddingBottom: 12
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
    marginTop: 3,
    color: POS_COLORS.heading,
    fontSize: POS_MODAL.titleSize,
    lineHeight: POS_MODAL.titleLineHeight,
    fontWeight: "900"
  },
  basePrice: {
    marginTop: 4,
    color: POS_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "900"
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
    fontSize: 16,
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
    fontSize: 11,
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
    fontSize: 13,
    fontWeight: "800"
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionButton: {
    minHeight: 58,
    width: "100%",
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 13,
    paddingVertical: 11
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
    fontSize: 15,
    fontWeight: "900"
  },
  optionNameActive: {
    color: POS_COLORS.primaryDark
  },
  optionPrice: {
    marginTop: 3,
    color: POS_COLORS.muted,
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    color: POS_COLORS.heading,
    fontSize: 15,
    fontWeight: "800"
  },
  noteInput: {
    minHeight: 92,
    paddingTop: 11,
    textAlignVertical: "top"
  },
  summaryCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 11
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  qtyLabel: {
    color: POS_COLORS.heading,
    fontSize: 15,
    fontWeight: "900"
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  qtyButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  qtyButtonPrimary: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  qtyButtonText: {
    color: POS_COLORS.slate,
    fontSize: 22,
    fontWeight: "900"
  },
  qtyButtonPrimaryText: {
    color: POS_COLORS.primaryDark
  },
  qtyValueBox: {
    minWidth: 48,
    height: 48,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  qtyValue: {
    color: POS_COLORS.heading,
    fontSize: 18,
    fontWeight: "900"
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  totalLabel: {
    color: POS_COLORS.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  totalValue: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  totalStrongLabel: {
    color: POS_COLORS.heading,
    fontSize: 15,
    fontWeight: "900"
  },
  totalStrongValue: {
    color: POS_COLORS.primaryDark,
    fontSize: 20,
    fontWeight: "900"
  },
  errorBox: {
    color: POS_COLORS.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  submitButton: {
    minHeight: 58,
    marginTop: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  submitButtonDisabled: {
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.disabled
  },
  submitText: {
    color: POS_COLORS.surface,
    fontSize: 16,
    fontWeight: "900"
  },
  submitTextDisabled: {
    color: POS_COLORS.muted
  }
});
