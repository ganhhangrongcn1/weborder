import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import PosIcon from "./PosIcon";

function formatDateTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getPrintStatus(status = "") {
  if (status === "printed") {
    return {
      label: "Đã in phiếu kết ca",
      color: POS_COLORS.primaryDark,
      backgroundColor: POS_COLORS.primarySoft,
      borderColor: "#86efac"
    };
  }
  if (status === "skipped") {
    return {
      label: "Đã tắt in khi kết ca",
      color: "#92400e",
      backgroundColor: "#fffbeb",
      borderColor: "#fde68a"
    };
  }
  return {
    label: "Chưa in được phiếu kết ca",
    color: "#b91c1c",
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca"
  };
}

export default function PosShiftClosedCard({
  record,
  busy = false,
  onReprint,
  onStartNewShift,
  onSignOut
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const shift = record?.shift || {};
  const summary = record?.summary || {};
  const printStatus = getPrintStatus(record?.printStatus);
  const shiftCode = String(shift.id || "").slice(0, 8).toUpperCase() || "--";
  const expectedCash = Number(summary.expectedCash ?? shift.expectedCashSnapshot ?? 0);
  const countedCash = Number(shift.closingCashCounted ?? summary.closingCashCounted ?? 0);
  const difference = countedCash - expectedCash;

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.successIcon}>
          <PosIcon name="check" size={28} color={POS_COLORS.primaryDark} />
        </View>

        <Text style={styles.eyebrow}>KẾT CA THÀNH CÔNG</Text>
        <Text style={styles.title}>Đã kết ca bán hàng</Text>
        <Text style={styles.subtitle}>
          Ca đã được lưu an toàn. Anh/chị có thể in lại phiếu mà không cần đếm tiền hoặc mở lại ca.
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Mã ca</Text>
            <Text style={styles.summaryValue}>{shiftCode}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Thời gian kết</Text>
            <Text style={styles.summaryValue}>{formatDateTime(shift.closedAt)}</Text>
          </View>
        </View>

        <View
          style={[
            styles.printStatus,
            {
              backgroundColor: printStatus.backgroundColor,
              borderColor: printStatus.borderColor
            }
          ]}
        >
          <Text style={[styles.printStatusText, { color: printStatus.color }]}>
            {busy ? "Đang gửi lại phiếu đến máy in..." : printStatus.label}
          </Text>
          {!busy && record?.printMessage ? (
            <Text style={[styles.printStatusHint, { color: printStatus.color }]}>
              {record.printMessage}
            </Text>
          ) : null}
        </View>

        <Pressable style={styles.viewButton} onPress={() => setDetailsOpen((value) => !value)}>
          <Text style={styles.viewButtonText}>{detailsOpen ? "Ẩn thông tin ca" : "Xem ca"}</Text>
        </Pressable>

        {detailsOpen ? (
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Chi nhánh</Text>
              <Text style={styles.detailValue}>{shift.branchName || "POS mobile"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Thu ngân</Text>
              <Text style={styles.detailValue}>{shift.cashierName || "Thu ngân"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mở ca</Text>
              <Text style={styles.detailValue}>{formatDateTime(shift.openedAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tổng đơn</Text>
              <Text style={styles.detailValue}>{Number(summary.orderCount || 0)} đơn</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dự kiến trong két</Text>
              <Text style={styles.detailValue}>{formatMoney(expectedCash)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tiền thực đếm</Text>
              <Text style={styles.detailValue}>{formatMoney(countedCash)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {difference > 0 ? "Thừa tiền" : difference < 0 ? "Thiếu tiền" : "Chênh lệch"}
              </Text>
              <Text style={[styles.detailValue, difference !== 0 && styles.differenceValue]}>
                {difference < 0 ? "-" : ""}
                {formatMoney(Math.abs(difference))}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, busy && styles.disabledButton]}
            onPress={onReprint}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>{busy ? "Đang in..." : "In lại phiếu vừa kết"}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, busy && styles.disabledButton]}
            onPress={onStartNewShift}
            disabled={busy}
          >
            <Text style={styles.secondaryButtonText}>Bắt đầu ca mới</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={onSignOut} disabled={busy}>
            <Text style={styles.signOutButtonText}>Đăng xuất</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: POS_COLORS.page
  },
  card: {
    width: "100%",
    maxWidth: 620,
    alignItems: "stretch",
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    borderRadius: POS_RADIUS.lg,
    backgroundColor: POS_COLORS.surface,
    ...POS_SHADOW
  },
  successIcon: {
    width: 58,
    height: 58,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    backgroundColor: POS_COLORS.primarySoft
  },
  eyebrow: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.8
  },
  title: {
    color: POS_COLORS.heading,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center"
  },
  subtitle: {
    color: POS_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center"
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10
  },
  summaryCell: {
    flex: 1,
    gap: 4,
    padding: 12,
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.subtleSurface
  },
  summaryLabel: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: POS_COLORS.heading,
    fontSize: 14,
    fontWeight: "900"
  },
  printStatus: {
    gap: 3,
    padding: 11,
    borderWidth: 1,
    borderRadius: POS_RADIUS.md
  },
  printStatusText: {
    fontSize: 13,
    fontWeight: "900"
  },
  printStatusHint: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  viewButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.subtleSurface
  },
  viewButtonText: {
    color: POS_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  details: {
    gap: 9,
    padding: 13,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.surface
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14
  },
  detailLabel: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  detailValue: {
    flexShrink: 1,
    color: POS_COLORS.heading,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  differenceValue: {
    color: "#b91c1c"
  },
  actions: {
    gap: 9,
    marginTop: 2
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.primaryDark
  },
  primaryButtonText: {
    color: POS_COLORS.surface,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.surface
  },
  secondaryButtonText: {
    color: POS_COLORS.primaryDark,
    fontSize: 14,
    fontWeight: "900"
  },
  signOutButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  signOutButtonText: {
    color: POS_COLORS.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.55
  }
});
