import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

function formatDateTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

function ClosedShiftRow({ shift, busy, onReprint }) {
  const [expanded, setExpanded] = useState(false);
  const summary = shift.closingSummary || {};
  const expectedCash = Number(summary.expectedCash || 0);
  const countedCash = Number(shift.closingCashCounted || summary.closingCashCounted || 0);
  const difference = countedCash - expectedCash;
  const shiftCode = String(shift.id || "").slice(0, 8).toUpperCase() || "--";

  return (
    <View style={styles.rowCard}>
      <Pressable style={styles.rowHeader} onPress={() => setExpanded((value) => !value)}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>Ca {shiftCode}</Text>
          <Text style={styles.rowMeta}>{formatDateTime(shift.openedAt)} → {formatDateTime(shift.closedAt)}</Text>
          <Text style={styles.rowMeta}>Thu ngân: {shift.cashierName || "Thu ngân"}</Text>
        </View>
        <View style={styles.revenueBox}>
          <Text style={styles.revenueValue}>{formatMoney(summary.revenue || 0)}</Text>
          <Text style={styles.revenueLabel}>{expanded ? "Thu gọn" : "Xem ca"}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricLabel}>Tiền mặt</Text><Text style={styles.metricValue}>{formatMoney(summary.cashTotal || 0)}</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Chuyển khoản</Text><Text style={styles.metricValue}>{formatMoney(summary.qrTotal || 0)}</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Tổng đơn</Text><Text style={styles.metricValue}>{Number(summary.orderCount || 0)}</Text></View>
          </View>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricLabel}>Dự kiến trong két</Text><Text style={styles.metricValue}>{formatMoney(expectedCash)}</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Thực đếm</Text><Text style={styles.metricValue}>{formatMoney(countedCash)}</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Chênh lệch</Text><Text style={[styles.metricValue, difference !== 0 && styles.difference]}>{difference < 0 ? "-" : ""}{formatMoney(Math.abs(difference))}</Text></View>
          </View>
          <Pressable
            style={[styles.printButton, busy && styles.disabled]}
            onPress={() => onReprint(shift)}
            disabled={busy}
          >
            <Text style={styles.printButtonText}>{busy ? "Đang xử lý..." : "In lại phiếu kết ca"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function PosClosedShiftHistory({
  visible = false,
  shifts = [],
  loading,
  error,
  busy,
  onClose,
  onRefresh,
  onReprint
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.caption}>Tổng quan ca</Text>
              <Text style={styles.title}>Ca đã kết trong 7 ngày</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>
          <Pressable style={styles.refreshButton} onPress={onRefresh} disabled={loading || busy}>
            <Text style={styles.refreshText}>{loading ? "Đang tải..." : "Làm mới danh sách"}</Text>
          </Pressable>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {!loading && !shifts.length ? <Text style={styles.empty}>Chưa có ca đã kết trong 7 ngày gần đây.</Text> : null}
            {shifts.map((shift) => (
              <ClosedShiftRow key={shift.id} shift={shift} busy={busy} onReprint={onReprint} />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(15, 23, 42, 0.55)" },
  modalCard: { width: "100%", maxWidth: 720, maxHeight: "88%", gap: 10, padding: 16, borderRadius: POS_RADIUS.lg, backgroundColor: POS_COLORS.surface },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  caption: { color: POS_COLORS.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  title: { marginTop: 3, color: POS_COLORS.heading, fontSize: 16, fontWeight: "900" },
  closeButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: POS_RADIUS.md, backgroundColor: POS_COLORS.subtleSurface },
  closeText: { color: POS_COLORS.heading, fontSize: 12, fontWeight: "900" },
  refreshButton: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderRadius: POS_RADIUS.md, backgroundColor: POS_COLORS.primarySoft },
  refreshText: { color: POS_COLORS.primaryDark, fontSize: 12, fontWeight: "900" },
  list: { minHeight: 0 },
  listContent: { gap: 10, paddingBottom: 4 },
  rowCard: { overflow: "hidden", borderWidth: 1, borderColor: POS_COLORS.softBorder, borderRadius: POS_RADIUS.md, backgroundColor: POS_COLORS.subtleSurface },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  rowMain: { flex: 1, gap: 3 },
  rowTitle: { color: POS_COLORS.heading, fontSize: 14, fontWeight: "900" },
  rowMeta: { color: POS_COLORS.muted, fontSize: 11, fontWeight: "700" },
  revenueBox: { alignItems: "flex-end", gap: 3 },
  revenueValue: { color: POS_COLORS.primaryDark, fontSize: 14, fontWeight: "900" },
  revenueLabel: { color: POS_COLORS.muted, fontSize: 10, fontWeight: "800" },
  details: { gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: POS_COLORS.softBorder, backgroundColor: POS_COLORS.surface },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, gap: 4, padding: 9, borderRadius: POS_RADIUS.md, backgroundColor: POS_COLORS.subtleSurface },
  metricLabel: { color: POS_COLORS.muted, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: POS_COLORS.heading, fontSize: 12, fontWeight: "900" },
  difference: { color: "#b91c1c" },
  printButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: POS_RADIUS.md, backgroundColor: POS_COLORS.primaryDark },
  printButtonText: { color: POS_COLORS.surface, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  error: { color: "#b91c1c", fontSize: 12, fontWeight: "800" },
  empty: { paddingVertical: 10, color: POS_COLORS.muted, fontSize: 12, fontWeight: "700", textAlign: "center" }
});
