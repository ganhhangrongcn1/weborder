import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";

export default function PrinterDisconnectedModal({
  visible,
  devices = [],
  busy = false,
  message = "",
  onClose,
  onRefresh,
  onSelect
}) {
  const { width } = useWindowDimensions();
  const safeDevices = Array.isArray(devices) ? devices : [];

  if (!visible) return null;

  return (
    <View style={styles.layer}>
      <View style={styles.backdrop} />
      <View style={[styles.sheet, { width: Math.min(Math.max(width - 24, 0), 620) }]}>
        <View style={styles.alertIcon}><Text style={styles.alertIconText}>!</Text></View>
        <Text style={styles.eyebrow}>Cảnh báo máy in</Text>
        <Text style={styles.title}>Máy in đang mất kết nối</Text>
        <Text style={styles.subtitle}>
          Kiểm tra nguồn máy in và dây USB/OTG, sau đó bấm kết nối ngay bên dưới.
        </Text>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {safeDevices.length ? safeDevices.map((device) => (
            <Pressable
              key={`${device.vendorId}-${device.productId}`}
              style={styles.deviceButton}
              onPress={() => onSelect?.(device)}
              disabled={busy}
            >
              <View style={styles.deviceCopy}>
                <Text style={styles.deviceName} numberOfLines={1}>{device.label || "Máy in USB"}</Text>
                <Text style={styles.deviceMeta}>
                  {device.hasPermission ? "Đã cấp quyền · sẵn sàng kết nối" : "Cần cấp quyền USB"}
                </Text>
              </View>
              <View style={styles.connectBadge}>
                <Text style={styles.connectBadgeText}>{busy ? "Đang nối" : "Kết nối"}</Text>
              </View>
            </Pressable>
          )) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Chưa tìm thấy máy in</Text>
              <Text style={styles.emptyText}>Cắm lại dây USB/OTG, bật nguồn máy in rồi bấm “Quét lại máy in”.</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable style={styles.laterButton} onPress={onClose} disabled={busy}>
            <Text style={styles.laterText}>Để sau</Text>
          </Pressable>
          <Pressable style={[styles.refreshButton, busy && styles.disabled]} onPress={onRefresh} disabled={busy}>
            <Text style={styles.refreshText}>{busy ? "Đang quét..." : "Quét lại máy in"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 16, zIndex: 700, elevation: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.58)" },
  sheet: { maxHeight: "88%", alignItems: "stretch", gap: 10, borderWidth: 2, borderColor: "#ef4444", backgroundColor: POS_COLORS.surface, borderRadius: POS_RADIUS.lg, padding: 18, ...POS_SHADOW },
  alertIcon: { alignSelf: "center", width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#fee2e2" },
  alertIconText: { color: "#dc2626", fontSize: 30, lineHeight: 34, fontWeight: "900" },
  eyebrow: { color: "#dc2626", fontSize: 11, fontWeight: "900", textAlign: "center", textTransform: "uppercase" },
  title: { color: POS_COLORS.heading, fontSize: 24, lineHeight: 29, fontWeight: "900", textAlign: "center" },
  subtitle: { color: POS_COLORS.slate, fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" },
  message: { borderWidth: 1, borderColor: "#fed7aa", backgroundColor: "#fff7ed", color: "#9a3412", borderRadius: POS_RADIUS.md, padding: 10, fontSize: 12, fontWeight: "800" },
  list: { maxHeight: 260 },
  listContent: { gap: 8 },
  deviceButton: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#86efac", backgroundColor: "#f0fdf4", borderRadius: POS_RADIUS.md, paddingHorizontal: 12, paddingVertical: 10 },
  deviceCopy: { flex: 1, minWidth: 0, gap: 4 },
  deviceName: { color: POS_COLORS.heading, fontSize: 14, fontWeight: "900" },
  deviceMeta: { color: POS_COLORS.slate, fontSize: 11, fontWeight: "800" },
  connectBadge: { borderRadius: 999, backgroundColor: POS_COLORS.primary, paddingHorizontal: 13, paddingVertical: 8 },
  connectBadgeText: { color: POS_COLORS.surface, fontSize: 12, fontWeight: "900" },
  emptyBox: { gap: 5, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", borderRadius: POS_RADIUS.md, padding: 13 },
  emptyTitle: { color: "#991b1b", fontSize: 14, fontWeight: "900" },
  emptyText: { color: "#7f1d1d", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginTop: 2 },
  laterButton: { flex: 0.75, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: POS_COLORS.inputBorder, backgroundColor: POS_COLORS.surface, borderRadius: POS_RADIUS.md },
  laterText: { color: POS_COLORS.slate, fontSize: 14, fontWeight: "900" },
  refreshButton: { flex: 1.25, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: POS_COLORS.primaryDark, backgroundColor: POS_COLORS.primary, borderRadius: POS_RADIUS.md },
  refreshText: { color: POS_COLORS.surface, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.58 }
});
