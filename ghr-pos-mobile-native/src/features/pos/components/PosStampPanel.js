import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { readPosStamps } from "../../../services/pos/posStampService";
import { normalizeCustomerPhone } from "../../../services/pos/posCustomerService";

export default function PosStampPanel({ phone, products = [], onChoose, disabled }) {
  const [state, setState] = useState({ data: null, error: "", loading: false });
  const normalized = normalizeCustomerPhone(phone);
  useEffect(() => {
    let active = true;
    setState({ data: null, error: "", loading: /^0[35789]\d{8}$/.test(normalized) });
    if (!/^0[35789]\d{8}$/.test(normalized)) return undefined;
    const timer = setTimeout(() => {
      readPosStamps(normalized).then((data) => { if (active) setState({ data, error: "", loading: false }); })
        .catch(() => { if (active) setState({ data: null, error: "Chưa tải được số tem. Không đổi quà khi mất kết nối.", loading: false }); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [normalized]);
  if (!normalized || (state.data && !state.data.enabled)) return null;
  return <View style={styles.panel}>
    <Text style={styles.title}>Tích tem nhận quà</Text>
    {state.loading ? <Text>Đang tải tem…</Text> : state.error ? <Text>{state.error}</Text> : state.data && <>
      <Text style={styles.balance}>{state.data.available}/10 tem khả dụng</Text>
      {state.data.held > 0 && <Text>{state.data.held} tem đang giữ cho đơn khác.</Text>}
      <Text>Mỗi ngày 1 tem · Chọn 1 món khi đủ 10 tem</Text>
      {state.data.gifts.map((gift) => {
        const available = products.find((p) => p.id === gift.id);
        const blocked = disabled || !available || state.data.available < 10;
        return <Pressable key={gift.id} style={[styles.gift, blocked && styles.disabled]} disabled={blocked} onPress={() => onChoose(available)}>
          <Text style={styles.title}>{gift.name}</Text><Text>{available ? "Đổi 10 tem · 0đ" : "Chi nhánh chưa có món này"}</Text>
        </Pressable>;
      })}
    </>}
  </View>;
}
const styles = StyleSheet.create({ panel: { padding: 14, gap: 9, borderRadius: 14, backgroundColor: "#fff5e6", marginTop: 10 },
  title: { fontSize: 15, fontWeight: "700", color: "#5b3513" }, balance: { fontSize: 22, fontWeight: "800", color: "#ba5900" },
  gift: { padding: 12, gap: 4, borderRadius: 10, backgroundColor: "white" }, disabled: { opacity: 0.5 } });
