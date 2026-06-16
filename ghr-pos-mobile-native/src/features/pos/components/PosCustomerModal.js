import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import CustomerLookupPanel from "./CustomerLookupPanel";

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
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
    width: "100%",
    maxWidth: 620,
    maxHeight: "86%",
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg,
    padding: 14,
    gap: 12,
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
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 2,
    color: POS_COLORS.heading,
    fontSize: 20,
    fontWeight: "900"
  },
  closeButton: {
    minHeight: 36,
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
