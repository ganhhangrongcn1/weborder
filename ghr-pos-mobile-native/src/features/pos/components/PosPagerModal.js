import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";

function buildPagerOptions() {
  return Array.from({ length: 16 }, (_, index) => String(index + 1).padStart(2, "0"));
}

export default function PosPagerModal({
  visible,
  value = "",
  busyPagers = [],
  onClose,
  onSelect
}) {
  const { width } = useWindowDimensions();
  const activePager = String(value || "").trim();
  const busySet = useMemo(
    () =>
      new Set(
        (Array.isArray(busyPagers) ? busyPagers : [])
          .map((pager) => String(pager || "").trim())
          .filter(Boolean)
      ),
    [busyPagers]
  );
  const sheetWidth = Math.min(Math.max(width - 24, 0), 560);

  if (!visible) return null;

  return (
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { width: sheetWidth }]}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>POS</Text>
              <Text style={styles.title}>Chọn thẻ rung</Text>
              <Text style={styles.subtitle}>Thẻ đang có đơn sẽ bị khóa để tránh trùng bill.</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {buildPagerOptions().map((pager) => {
              const isActive = activePager === pager;
              const isBusy = busySet.has(pager);
              return (
                <Pressable
                  key={pager}
                  style={[
                    styles.pagerButton,
                    isActive && styles.pagerButtonActive,
                    isBusy && styles.pagerButtonDisabled
                  ]}
                  disabled={isBusy}
                  onPress={() => onSelect?.(pager)}
                >
                  <Text
                    style={[
                      styles.pagerText,
                      isActive && styles.pagerTextActive,
                      isBusy && styles.pagerTextDisabled
                    ]}
                  >
                    {pager}
                  </Text>
                  <Text
                    style={[
                      styles.pagerMeta,
                      isActive && styles.pagerMetaActive,
                      isBusy && styles.pagerMetaDisabled
                    ]}
                  >
                    {isBusy ? "Bận" : isActive ? "Đang chọn" : "Sẵn sàng"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    zIndex: 500,
    elevation: 12
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.34)"
  },
  sheet: {
    gap: 14,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg,
    padding: 16,
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
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 4,
    color: POS_COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  closeButton: {
    minHeight: 44,
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
    fontSize: 14,
    fontWeight: "900"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pagerButton: {
    width: "23%",
    minHeight: 78,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8
  },
  pagerButtonActive: {
    borderColor: POS_COLORS.primary,
    backgroundColor: POS_COLORS.primarySoft
  },
  pagerButtonDisabled: {
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface
  },
  pagerText: {
    color: POS_COLORS.slate,
    fontSize: 24,
    fontWeight: "900"
  },
  pagerTextActive: {
    color: POS_COLORS.primaryDark
  },
  pagerTextDisabled: {
    color: "#94a3b8"
  },
  pagerMeta: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  pagerMetaActive: {
    color: POS_COLORS.primaryDark
  },
  pagerMetaDisabled: {
    color: "#94a3b8"
  },
  flexOne: {
    flex: 1
  }
});
