import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PosIcon from "./PosIcon";
import { POS_COLORS } from "../../../styles/posTheme";

export default function PosPhoneNavigation({ activeTab, onSelect, orderCount = 0 }) {
  const selected = ["history", "pickup"].includes(activeTab) ? "history" : ["more", "shift", "settings"].includes(activeTab) ? "more" : "sale";
  return (
    <View style={styles.bar}>
      {[{ key: "sale", label: "Bán hàng", icon: "sale" }, { key: "history", label: "Đơn", icon: "order" }, { key: "more", label: "Khác", icon: "settings" }].map((tab) => (
        <Pressable key={tab.key} accessibilityRole="button" accessibilityState={{ selected: selected === tab.key }} style={[styles.item, selected === tab.key && styles.active]} onPress={() => onSelect(tab.key)}>
          <PosIcon name={tab.icon} size={20} color={selected === tab.key ? POS_COLORS.primaryDark : POS_COLORS.muted} />
          <Text style={[styles.label, selected === tab.key && styles.activeLabel]}>{tab.label}{tab.key === "history" && orderCount > 0 ? ` (${orderCount})` : ""}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function PosPhoneMore({ onSelect, onSignOut }) {
  return (
    <ScrollView contentContainerStyle={styles.more}>
      <Text style={styles.heading}>Quản lý POS</Text>
      {[{ key: "shift", label: "Tổng quan ca" }, { key: "settings", label: "Máy in & thiết lập" }].map((item) => (
        <Pressable key={item.key} style={styles.row} onPress={() => onSelect(item.key)}><Text style={styles.rowText}>{item.label} ›</Text></Pressable>
      ))}
      <Pressable style={styles.row} onPress={onSignOut}><Text style={[styles.rowText, { color: POS_COLORS.danger }]}>Đổi ca / Đăng xuất</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 6, padding: 6, borderRadius: 16, backgroundColor: "#fff" },
  item: { flex: 1, minHeight: 58, gap: 4, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  active: { backgroundColor: POS_COLORS.primarySoft },
  label: { fontSize: 13, fontWeight: "700", color: POS_COLORS.muted },
  activeLabel: { color: POS_COLORS.primaryDark },
  more: { padding: 12, gap: 12 },
  heading: { fontSize: 22, fontWeight: "900", color: POS_COLORS.heading },
  row: { padding: 18, minHeight: 60, borderRadius: 14, backgroundColor: "#fff" },
  rowText: { fontSize: 16, fontWeight: "800", color: POS_COLORS.heading },
});
