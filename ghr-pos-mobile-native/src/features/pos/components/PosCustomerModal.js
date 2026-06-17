import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import CustomerLookupPanel from "./CustomerLookupPanel";
import { getPosDialogWidth, POS_MODAL } from "./posModalTokens";

export default function PosCustomerModal({
  visible,
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
  onClose
}) {
  const { width } = useWindowDimensions();
  const dialogWidth = getPosDialogWidth(width, 560);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { width: dialogWidth }]}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>POS</Text>
              <Text style={styles.title}>Khách hàng và ưu đãi</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <CustomerLookupPanel
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              lookup={lookup}
              loyaltyBenefit={loyaltyBenefit}
              selectedVoucherId={selectedVoucherId}
              setSelectedVoucherId={setSelectedVoucherId}
              pointsInput={pointsInput}
              setPointsInput={setPointsInput}
              onClear={onClear}
            />
          </ScrollView>

          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneText}>Xong</Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.36)"
  },
  sheet: {
    maxHeight: "86%",
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
    fontSize: 12,
    fontWeight: "900"
  },
  body: {
    paddingBottom: 2
  },
  doneButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#166534",
    backgroundColor: "#2f7d3f",
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  doneText: {
    color: POS_COLORS.surface,
    fontSize: 15,
    fontWeight: "900"
  }
});
