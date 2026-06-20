import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";

export default function UsbPrinterPickerModal({
  visible,
  devices = [],
  busy = false,
  onClose,
  onRefresh,
  onSelect
}) {
  const { width } = useWindowDimensions();
  const sheetWidth = Math.min(Math.max(width - 24, 0), 620);
  const safeDevices = Array.isArray(devices) ? devices : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { width: sheetWidth }]}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>Máy in USB</Text>
              <Text style={styles.title}>Chọn máy in bill</Text>
              <Text style={styles.subtitle}>
                Chọn đúng máy in đang cắm vào POS. Nếu chưa thấy máy, kiểm tra cáp OTG rồi bấm tải lại.
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} disabled={busy}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {safeDevices.length ? (
              safeDevices.map((device) => {
                const selected = Boolean(device.selected);
                return (
                  <Pressable
                    key={`${device.vendorId}-${device.productId}`}
                    style={[styles.deviceButton, selected && styles.deviceButtonActive]}
                    onPress={() => onSelect?.(device)}
                    disabled={busy}
                  >
                    <View style={styles.deviceMain}>
                      <Text style={[styles.deviceName, selected && styles.deviceNameActive]} numberOfLines={1}>
                        {device.label || "Máy in USB"}
                      </Text>
                      <Text style={styles.deviceMeta}>
                        Vendor {device.vendorId || "--"} • Product {device.productId || "--"}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, selected && styles.statusBadgeActive]}>
                      <Text style={[styles.statusText, selected && styles.statusTextActive]}>
                        {selected ? "Đang chọn" : device.hasPermission ? "Sẵn sàng" : "Cấp quyền"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Chưa thấy máy in USB</Text>
                <Text style={styles.emptyText}>
                  Anh kiểm tra nguồn máy in, dây USB/OTG rồi bấm “Tải lại danh sách”.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.refreshButton} onPress={onRefresh} disabled={busy}>
              <Text style={styles.refreshText}>{busy ? "Đang tải…" : "Tải lại danh sách"}</Text>
            </Pressable>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 24
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.36)"
  },
  sheet: {
    maxHeight: "88%",
    gap: 14,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg,
    padding: 18,
    ...POS_SHADOW
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
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
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 5,
    color: POS_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  closeButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: {
    color: POS_COLORS.slate,
    fontSize: 14,
    fontWeight: "900"
  },
  list: {
    maxHeight: 360
  },
  listContent: {
    gap: 10
  },
  deviceButton: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  deviceButtonActive: {
    borderColor: POS_COLORS.primary,
    backgroundColor: POS_COLORS.primarySoft
  },
  deviceMain: {
    flex: 1,
    minWidth: 0,
    gap: 5
  },
  deviceName: {
    color: POS_COLORS.heading,
    fontSize: 15,
    fontWeight: "900"
  },
  deviceNameActive: {
    color: POS_COLORS.primaryDark
  },
  deviceMeta: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  statusBadgeActive: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  statusText: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900"
  },
  statusTextActive: {
    color: POS_COLORS.primaryDark
  },
  emptyBox: {
    gap: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 16
  },
  emptyTitle: {
    color: POS_COLORS.heading,
    fontSize: 16,
    fontWeight: "900"
  },
  emptyText: {
    color: POS_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  refreshButton: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  refreshText: {
    color: POS_COLORS.slate,
    fontSize: 14,
    fontWeight: "900"
  },
  flexOne: {
    flex: 1
  }
});
