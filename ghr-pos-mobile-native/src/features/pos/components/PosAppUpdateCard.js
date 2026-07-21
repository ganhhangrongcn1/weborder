import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";

function formatSize(value = 0) {
  const size = Math.max(0, Number(value || 0));
  return size ? `${(size / 1024 / 1024).toFixed(1)} MB` : "";
}

export default function PosAppUpdateCard({ update, compact = false }) {
  const {
    current,
    release,
    available,
    checking,
    downloading,
    progress,
    message,
    checkNow,
    installUpdate
  } = update;
  const progressPercent = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);

  if (compact && !available) return null;

  return (
    <View style={[styles.card, available && styles.cardAvailable, compact && styles.cardCompact]}>
      <View style={styles.head}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>CẬP NHẬT POS</Text>
          <Text style={styles.title}>
            {available ? `Phiên bản ${release?.versionName} đã sẵn sàng` : "Ứng dụng POS"}
          </Text>
          <Text style={styles.meta}>
            Đang dùng {current?.versionName || "--"}
            {available && release?.sizeBytes ? ` · ${formatSize(release.sizeBytes)}` : ""}
          </Text>
        </View>
        <View style={[styles.badge, available ? styles.badgeAvailable : styles.badgeCurrent]}>
          <Text style={[styles.badgeText, available ? styles.badgeTextAvailable : styles.badgeTextCurrent]}>
            {release?.mandatory && available ? "Bắt buộc" : available ? "Có bản mới" : "Mới nhất"}
          </Text>
        </View>
      </View>

      {available && release?.releaseNotes?.length && !compact ? (
        <View style={styles.notes}>
          {release.releaseNotes.slice(0, 4).map((note) => (
            <Text key={note} style={styles.note}>• {note}</Text>
          ))}
        </View>
      ) : null}

      {downloading ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressValue, { width: `${progressPercent}%` }]} />
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.actions}>
        {available ? (
          <Pressable
            style={[styles.primaryButton, downloading && styles.buttonDisabled]}
            onPress={installUpdate}
            disabled={downloading}
          >
            <Text style={styles.primaryButtonText}>
              {downloading ? `Đang tải ${progressPercent}%` : "Tải và cài cập nhật"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.secondaryButton, checking && styles.buttonDisabled]}
            onPress={() => checkNow({ force: true })}
            disabled={checking}
          >
            <Text style={styles.secondaryButtonText}>{checking ? "Đang kiểm tra" : "Kiểm tra cập nhật"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  cardAvailable: {
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft
  },
  cardCompact: {
    marginTop: 12
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  heading: {
    flex: 1,
    gap: 3
  },
  eyebrow: {
    color: POS_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: "900"
  },
  title: {
    color: POS_COLORS.heading,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  meta: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  badgeAvailable: {
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.surface
  },
  badgeCurrent: {
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900"
  },
  badgeTextAvailable: {
    color: POS_COLORS.primaryDark
  },
  badgeTextCurrent: {
    color: POS_COLORS.muted
  },
  notes: {
    gap: 3
  },
  note: {
    color: POS_COLORS.slate,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  progressTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#bbf7d0"
  },
  progressValue: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: POS_COLORS.primary
  },
  message: {
    color: POS_COLORS.slate,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800"
  },
  actions: {
    flexDirection: "row"
  },
  primaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.primary,
    paddingHorizontal: 14
  },
  primaryButtonText: {
    color: POS_COLORS.surface,
    fontSize: 12,
    fontWeight: "900"
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.surface,
    paddingHorizontal: 14
  },
  secondaryButtonText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  buttonDisabled: {
    opacity: 0.6
  }
});
