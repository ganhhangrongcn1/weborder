import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import PosIcon from "./PosIcon";

function toDigits(value = "") {
  return String(value || "").replace(/\D+/g, "").slice(0, 10);
}

export default function PosCustomerSummaryCard({
  customerName = "",
  customerPhone = "",
  setCustomerName,
  setCustomerPhone,
  lookup,
  onOpen,
  onClear,
  rightAction = null
}) {
  const customer = lookup?.result;
  const hasInput = Boolean(customerName || customerPhone);
  const isRegistered = Boolean(customer?.registeredCustomer);
  const availablePoints = Number(customer?.loyalty?.totalPoints || 0);
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
          ? "Số điện thoại không hợp lệ, vui lòng nhập lại."
          : "Chưa nhập SĐT";

  return (
    <View style={styles.panel}>
      <View style={styles.headRow}>
        <View style={styles.titleWrap}>
          <View style={styles.titleIcon}>
            <PosIcon name="customer" size={16} color={POS_COLORS.primaryDark} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.title}>Khách hàng</Text>
            <Text style={styles.subtitle}>{customer ? "Đã nhận diện quyền lợi" : "Không bắt buộc"}</Text>
          </View>
        </View>
        {rightAction ? <View style={styles.headAction}>{rightAction}</View> : null}
      </View>

      {customer ? (
        <View style={styles.memberRow}>
          <View style={styles.memberCopy}>
            <Text style={styles.memberName} numberOfLines={1}>{customerName || customer.customerName || "Khách thành viên"}</Text>
            <Text style={styles.memberDetail} numberOfLines={1}>
              {customerPhone} · {isRegistered ? `${availablePoints.toLocaleString("vi-VN")} điểm` : "Khách mới"}
            </Text>
          </View>
          <Pressable style={styles.openButton} onPress={onOpen}>
            <View style={styles.actionRow}>
              <PosIcon name="customer" size={14} color={POS_COLORS.primaryDark} />
              <Text style={styles.openText}>Quyền lợi</Text>
            </View>
          </Pressable>
          <Pressable style={styles.clearButton} onPress={onClear}>
            <PosIcon name="clear" size={14} color={POS_COLORS.danger} />
          </Pressable>
        </View>
      ) : <><View style={styles.inputRow}>
        <TextInput
          value={customerPhone}
          onChangeText={(value) => setCustomerPhone(toDigits(value))}
          placeholder="Nhập số điện thoại"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          maxLength={10}
          style={[styles.fieldInput, styles.phoneInput]}
        />

        <Pressable style={styles.openButton} onPress={onOpen}>
          <View style={styles.actionRow}>
            <PosIcon name="customer" size={14} color="#6366f1" />
            <Text style={styles.openText}>Tra cứu</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.clearButton, !hasInput && styles.clearButtonDisabled]} onPress={onClear} disabled={!hasInput}>
          <PosIcon name="clear" size={14} color={POS_COLORS.danger} />
        </Pressable>
      </View>

      {hasInput ? (
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Tên khách (không bắt buộc)"
          placeholderTextColor="#94a3b8"
          style={styles.fieldInput}
        />
      ) : null}

      {hasInput || lookup?.loading || lookup?.error ? <View style={[styles.statusBar, customer && styles.statusBarReady, lookup?.error && styles.statusBarError]}>
        <View style={[styles.statusDot, customer && styles.statusDotReady, lookup?.error && styles.statusDotError]} />
        <Text style={[styles.statusText, customer && styles.statusReadyText, lookup?.error && styles.statusErrorText]} numberOfLines={1}>
          {statusText}
        </Text>
      </View> : null}</>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg,
    padding: 10
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: POS_COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  flexOne: { flex: 1 },
  title: { color: POS_COLORS.heading, fontSize: 14, fontWeight: "900" },
  subtitle: { marginTop: 2, color: POS_COLORS.muted, fontSize: 10, fontWeight: "700" },
  headAction: {
    width: 38,
    alignItems: "center"
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  fieldInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.sm,
    paddingHorizontal: 10,
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "800"
  },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberCopy: {
    flex: 1,
    minHeight: 46,
    borderRadius: POS_RADIUS.sm,
    backgroundColor: POS_COLORS.primarySoft,
    justifyContent: "center",
    paddingHorizontal: 11
  },
  memberName: { color: POS_COLORS.heading, fontSize: 14, fontWeight: "900" },
  memberDetail: { marginTop: 2, color: POS_COLORS.primaryDark, fontSize: 10, fontWeight: "800" },
  phoneInput: { flex: 1 },
  openButton: {
    minWidth: 88,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#f8fafc",
    borderRadius: POS_RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  openText: {
    color: POS_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  clearButton: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: POS_RADIUS.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  clearButtonDisabled: { opacity: 0.35 },
  statusBar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: POS_RADIUS.sm,
    backgroundColor: POS_COLORS.subtleSurface,
    paddingHorizontal: 10
  },
  statusBarReady: { backgroundColor: POS_COLORS.primarySoft },
  statusBarError: { backgroundColor: POS_COLORS.dangerSoft },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: POS_COLORS.muted },
  statusDotReady: { backgroundColor: POS_COLORS.primary },
  statusDotError: { backgroundColor: POS_COLORS.danger },
  statusText: {
    flex: 1,
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  statusReadyText: {
    color: POS_COLORS.primaryDark
  },
  statusErrorText: {
    color: POS_COLORS.danger
  },
  memberMeta: { color: POS_COLORS.primaryDark, fontSize: 11, fontWeight: "900" }
});
