import React, { useEffect, useState } from "react";
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PosIcon from "./PosIcon";
import { POS_COLORS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

export default function PosPhoneSaleWorkspace({ menu, customer, cartPanel, payment, cart = [], totals = {}, pager, pagerBusy, onChoosePager, orderMode = false, busy = false, onSendOrder, onOpenBenefit, loyaltyBenefit = {} }) {
  const [step, setStep] = useState("menu");
  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  useEffect(() => {
    if (!cart.length) setStep("menu");
  }, [cart.length]);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
        return true;
      }
      if (step === "menu") return false;
      setStep(step === "payment" ? "cart" : "menu");
      return true;
    });
    return () => listener.remove();
  }, [step]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {step !== "menu" ? (
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => setStep(step === "payment" ? "cart" : "menu")} style={styles.back}>
            <Text style={styles.backText}>‹ {step === "payment" ? "Giỏ hàng" : "Chọn món"}</Text>
          </Pressable>
          <Text style={styles.title}>{step === "payment" ? "Thanh toán" : "Giỏ hàng"}</Text>
        </View>
      ) : null}
      {step === "menu" ? <View style={styles.body}>{menu}</View> : null}
      {step === "cart" ? (
        <View style={styles.body}>
          <View style={styles.customer}>{customer}</View>
          <Pressable style={styles.pager} onPress={onChoosePager} accessibilityRole="button">
            <Text style={styles.pagerText}>Thẻ rung: {pager || "Chưa chọn"}{pagerBusy ? " · Đang bận" : ""}</Text>
            <Text style={styles.backText}>Chọn thẻ ›</Text>
          </Pressable>
          <View style={styles.body}>{cartPanel}</View>
        </View>
      ) : null}
      {step === "payment" ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.payment} keyboardShouldPersistTaps="handled">
          <Text style={styles.detail}>{count} món · Thẻ {pager}</Text>
          {payment}
        </ScrollView>
      ) : null}
      {step !== "payment" && cart.length > 0 ? (
        <View style={styles.footer}>
          {orderMode && step === "cart" ? <>
          <View style={styles.summary}>
            <View style={styles.summaryRow}><Text>Tạm tính</Text><Text>{formatMoney(totals.subtotal || 0)}</Text></View>
            {Number(totals.voucherDiscount) > 0 && <View style={styles.summaryRow}><Text>Voucher</Text><Text>−{formatMoney(totals.voucherDiscount)}</Text></View>}
            {Number(totals.pointsDiscount) > 0 && <View style={styles.summaryRow}><Text>Đổi {Number(loyaltyBenefit.pointsSpent || 0).toLocaleString("vi-VN")} điểm</Text><Text>−{formatMoney(totals.pointsDiscount)}</Text></View>}
            {cart.some(item => item.stampGift) && <Text style={styles.hint}>Đổi quà · 10 tem</Text>}
            <View style={styles.summaryRow}><Text style={styles.total}>Cần thanh toán</Text><Text style={styles.total}>{formatMoney(totals.total || 0)}</Text></View>
          </View>
          <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onOpenBenefit} style={[styles.benefit, busy && styles.disabled]}><PosIcon name="voucher" color={POS_COLORS.primaryDark} /><Text style={styles.backText}>Ưu đãi</Text></Pressable>
            {[{ method: "cash", icon: "cash", label: Number(totals.total) === 0 ? "Đổi quà" : "Tiền mặt" }, ...(Number(totals.total) > 0 ? [{ method: "bank_qr", icon: "qr", label: "QR" }] : [])].map(item => <Pressable key={item.method}
              accessibilityRole="button" disabled={busy || !pager || Boolean(pagerBusy)}
              style={[styles.primary, styles.paymentAction, (busy || !pager || pagerBusy) && styles.disabled]}
              onPress={() => onSendOrder?.(item.method)}><PosIcon name={item.icon} color="#fff" /><Text style={styles.primaryText}>{item.label}</Text></Pressable>)}
          </View></> : <Pressable
            accessibilityRole="button"
            style={[styles.primary, step === "cart" && (!pager || pagerBusy) && styles.disabled]}
            disabled={busy || (step === "cart" && (!pager || Boolean(pagerBusy)))}
            onPress={() => step === "cart" && orderMode ? onSendOrder?.() : setStep(step === "menu" ? "cart" : "payment")}
          >
            <Text style={styles.primaryText}>{busy ? "Đang tạo đơn..." : step === "menu" ? `Giỏ · ${count} món` : orderMode ? "Tạo đơn & thu tiền" : "Thanh toán"}</Text>
            <Text style={styles.primaryText}>{formatMoney(totals.total || 0)} ›</Text>
          </Pressable>}
          {orderMode && step === "cart" && busy && <Text style={styles.hint}>Đang xử lý…</Text>}
          {step === "cart" && (!pager || pagerBusy) ? <Text style={styles.hint}>Chọn thẻ rung sẵn sàng trước khi thanh toán.</Text> : null}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, gap: 8 },
  body: { flex: 1, minHeight: 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  back: { minHeight: 44, justifyContent: "center" },
  backText: { color: POS_COLORS.primaryDark, fontSize: 14, fontWeight: "800" },
  title: { color: POS_COLORS.heading, fontSize: 18, fontWeight: "900" },
  customer: { paddingHorizontal: 4 },
  pager: { margin: 4, paddingHorizontal: 12, minHeight: 48, borderRadius: 12, backgroundColor: POS_COLORS.primarySoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pagerText: { color: POS_COLORS.heading, fontWeight: "700", fontSize: 13 },
  payment: { paddingBottom: 16, gap: 12 },
  detail: { color: POS_COLORS.muted, fontSize: 14, paddingHorizontal: 12 },
  summary: { gap: 5, padding: 8, backgroundColor: "#fff", borderRadius: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  total: { fontSize: 16, fontWeight: "800", color: POS_COLORS.heading },
  actions: { flexDirection: "row", gap: 6 },
  benefit: { flex: 1, minHeight: 56, borderRadius: 12, backgroundColor: POS_COLORS.primarySoft, alignItems: "center", justifyContent: "center", gap: 3 },
  paymentAction: { flex: 1, flexDirection: "column", justifyContent: "center", gap: 3, paddingHorizontal: 4 },
  footer: { padding: 6, gap: 6 },
  primary: { minHeight: 56, backgroundColor: POS_COLORS.primary, borderRadius: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  hint: { color: POS_COLORS.muted, fontSize: 12, textAlign: "center" },
});
