import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import PosIcon from "./PosIcon";

function toDigits(value = "") {
  return String(value || "").replace(/\D+/g, "").slice(0, 11);
}

export default function PosCustomerSummaryCard({
  customerName = "",
  customerPhone = "",
  setCustomerName,
  setCustomerPhone,
  lookup,
  onOpen,
  onClear
}) {
  const customer = lookup?.result;
  const statusDetail = customer?.customerStatusDetail || "";
  const statusText = lookup?.loading
    ? "Đang tra khách..."
    : lookup?.error
      ? lookup.error
      : customer
        ? [
            customer.customerStatusShortLabel ||
              (customer.registeredCustomer ? "Đã nhận diện thành viên" : "Khách chưa đăng ký"),
            statusDetail
          ].filter(Boolean).join(" · ")
        : customerPhone
          ? "Đã nhập SĐT"
          : "Chưa nhập SĐT";

  return (
    <View style={styles.panel}>
      <View style={styles.headRow}>
        <Text style={styles.label}>Tên khách</Text>
        <Text style={styles.label}>SĐT</Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Tên khách"
          placeholderTextColor="#94a3b8"
          style={[styles.fieldInput, styles.flexOne]}
        />

        <TextInput
          value={customerPhone}
          onChangeText={(value) => setCustomerPhone(toDigits(value))}
          placeholder="Số điện thoại"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          maxLength={11}
          style={[styles.fieldInput, styles.flexOne]}
        />

        <Pressable style={styles.openButton} onPress={onOpen}>
          <View style={styles.actionRow}>
            <PosIcon name="customer" size={14} color="#6366f1" />
            <Text style={styles.openText}>Xem</Text>
          </View>
        </Pressable>

        <Pressable style={styles.clearButton} onPress={onClear} disabled={!customerName && !customerPhone}>
          <PosIcon name="clear" size={14} color={POS_COLORS.danger} />
        </Pressable>
      </View>

      <Text
        style={[
          styles.statusText,
          customer && styles.statusReadyText,
          lookup?.error && styles.statusErrorText
        ]}
        numberOfLines={1}
      >
        {statusText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 9
  },
  headRow: {
    flexDirection: "row",
    gap: 8
  },
  label: {
    flex: 1,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  flexOne: {
    flex: 1
  },
  fieldInput: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    color: POS_COLORS.heading,
    fontSize: 12,
    fontWeight: "800"
  },
  openButton: {
    minWidth: 58,
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  openText: {
    color: "#6366f1",
    fontSize: 12,
    fontWeight: "900"
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  clearButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  statusText: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "800"
  },
  statusReadyText: {
    color: POS_COLORS.primaryDark
  },
  statusErrorText: {
    color: POS_COLORS.danger
  }
});
