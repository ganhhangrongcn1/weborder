import React from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { buildPosPaymentReference, buildPosQrImageUrl, getPosQrPaymentConfig } from "../../../services/pos/posPaymentService";
import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

export default function QrPaymentModal({
  visible,
  branch,
  amount,
  draftSession,
  previewIdentity,
  loading,
  processing,
  printBusy = false,
  errorMessage,
  onClose,
  onCancel,
  onConfirmPaid,
  onPrint
}) {
  const identity = draftSession || previewIdentity || {};
  const qrUrl = buildPosQrImageUrl({ branch, amount, orderIdentity: identity });
  const config = getPosQrPaymentConfig(branch);
  const transferContent = draftSession?.paymentReference || buildPosPaymentReference(identity, branch);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>Chuyển khoản QR</Text>
              <Text style={styles.title}>Quét mã thanh toán</Text>
            </View>
            <View style={styles.headerActions}>
              {config.ready ? (
                <Pressable style={styles.ghostButton} onPress={onPrint} disabled={printBusy}>
                  <Text style={styles.ghostText}>{printBusy ? "Đang in..." : "In QR"}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
          </View>

          {config.ready ? (
            <View style={styles.body}>
              <View style={styles.qrBox}>
                {qrUrl ? (
                  <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.qrFallback}>Chưa tạo được QR</Text>
                )}
              </View>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Số tiền</Text>
                  <Text style={styles.summaryValue}>{formatMoney(amount)}</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Nội dung</Text>
                  <Text style={styles.summaryValue} numberOfLines={2}>
                    {transferContent}
                  </Text>
                </View>
              </View>

              {draftSession ? (
                <View style={styles.statusBox}>
                  <Text style={styles.statusLabel}>Đang chờ thanh toán</Text>
                  <Text style={styles.statusValue}>
                    {draftSession.displayOrderCode || draftSession.orderCode || draftSession.paymentReference}
                  </Text>
                  <Text style={styles.statusMeta}>Trạng thái: {draftSession.status}</Text>
                </View>
              ) : null}

              {loading ? <Text style={styles.notice}>Đang tạo phiên thanh toán...</Text> : null}
              {!!errorMessage && <Text style={styles.errorBox}>{errorMessage}</Text>}

              {draftSession ? (
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.cancelButton, processing && styles.disabledButton]}
                    disabled={processing}
                    onPress={onCancel}
                  >
                    <Text style={styles.cancelText}>Hủy QR</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButton, processing && styles.disabledPrimary]}
                    disabled={processing}
                    onPress={onConfirmPaid}
                  >
                    <Text style={[styles.primaryText, processing && styles.disabledText]}>
                      {processing ? "Đang xử lý..." : "Xác nhận tay"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.errorBox}>
              Chi nhánh này chưa cấu hình thông tin ngân hàng để tạo QR thanh toán.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: "center",
    padding: 14
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  sheet: {
    gap: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg,
    padding: 14,
    ...POS_SHADOW
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  eyebrow: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 3,
    color: POS_COLORS.heading,
    fontSize: 22,
    fontWeight: "900"
  },
  ghostButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  closeButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  body: {
    gap: 12
  },
  qrBox: {
    minHeight: 260,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    padding: 10
  },
  qrImage: {
    width: 250,
    height: 250
  },
  qrFallback: {
    color: POS_COLORS.muted,
    fontWeight: "900"
  },
  summaryGrid: {
    gap: 8
  },
  summaryCell: {
    gap: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  summaryLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: POS_COLORS.heading,
    fontSize: 16,
    fontWeight: "900"
  },
  statusBox: {
    gap: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  statusLabel: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  statusValue: {
    color: POS_COLORS.primaryDark,
    fontSize: 17,
    fontWeight: "900"
  },
  statusMeta: {
    color: POS_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "800"
  },
  notice: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  errorBox: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    color: POS_COLORS.danger,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "800"
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButton: {
    flex: 1.2,
    minHeight: 44,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelText: {
    color: POS_COLORS.danger,
    fontWeight: "900"
  },
  primaryText: {
    color: POS_COLORS.surface,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.55
  },
  disabledPrimary: {
    borderColor: "#94a3b8",
    backgroundColor: POS_COLORS.disabled
  },
  disabledText: {
    color: POS_COLORS.muted
  },
  flexOne: {
    flex: 1
  }
});
