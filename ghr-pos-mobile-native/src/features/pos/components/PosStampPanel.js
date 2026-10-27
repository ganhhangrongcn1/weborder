import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import PosStampRewardBadge from "./PosStampRewardBadge";
import { normalizeCustomerPhone } from "../../../services/pos/posCustomerService";

export default function PosStampPanel({ phone, products = [], onChoose, disabled, state = {} }) {
  const normalized = normalizeCustomerPhone(phone);
  const canRedeem = Boolean(state.data?.enabled && state.data.available >= 10 && !state.loading && !state.error);
  if (!normalized || (state.data && !state.data.enabled)) return null;
  return <View style={[styles.panel, canRedeem && styles.readyPanel]}>
    <View style={styles.header}><Text style={styles.title}>{canRedeem ? "Khách đã đủ tem đổi quà!" : "Tích tem nhận quà"}</Text>{canRedeem && <PosStampRewardBadge />}</View>
    {state.loading ? <Text>Đang tải tem…</Text> : state.error ? <Text>{state.error}</Text> : state.data && <>
      <Text style={styles.balance}>{state.data.available}/10 tem khả dụng</Text>
      {state.data.held > 0 && <Text>{state.data.held} tem đang giữ cho đơn khác.</Text>}
      <Text>{canRedeem ? "Chọn một món bên dưới để thêm quà 0đ vào bill cho khách." : "Mỗi ngày 1 tem · Chọn 1 món khi đủ 10 tem"}</Text>
      {state.data.gifts.map((gift) => {
        const available = products.find((p) => p.id === gift.id);
        const blocked = disabled || !available || state.data.available < 10;
        return <Pressable key={gift.id} style={[styles.gift, canRedeem && !blocked && styles.readyGift, blocked && styles.disabled]} disabled={blocked} onPress={() => onChoose(available)}>
          <Text style={styles.title}>{gift.name}</Text><Text>{available ? canRedeem ? "Thêm quà vào bill · 10 tem · 0đ" : "Đổi 10 tem · 0đ" : "Chi nhánh chưa có món này"}</Text>
        </Pressable>;
      })}
    </>}
  </View>;
}
const styles = StyleSheet.create({ panel: { padding: 14, gap: 9, borderRadius: 14, backgroundColor: "#fff5e6", marginTop: 10 },
  title: { fontSize: 15, fontWeight: "700", color: "#5b3513" }, balance: { fontSize: 22, fontWeight: "800", color: "#ba5900" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  readyPanel: { borderWidth: 2, borderColor: "#df951e", backgroundColor: "#fff8df" },
  readyGift: { borderWidth: 1, borderColor: "#df951e", backgroundColor: "#fff0c2" },
  gift: { padding: 12, gap: 4, borderRadius: 10, backgroundColor: "white" }, disabled: { opacity: 0.5 } });
