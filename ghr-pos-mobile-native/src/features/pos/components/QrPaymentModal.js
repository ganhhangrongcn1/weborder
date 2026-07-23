import React from "react";
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { buildPosPaymentReference, buildPosQrImageUrl, getPosQrPaymentConfig } from "../../../services/pos/posPaymentService";
import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";
import { getPosDialogWidth, POS_MODAL } from "./posModalTokens";

const MOMO_LOGO = require("../../../assets/momo-logo.png");

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
  useSystemModal = false,
  onClose,
  onCancel,
  onConfirmPaid,
  onPrint
}) {
  const { width, height } = useWindowDimensions();
  const identity = draftSession || previewIdentity || {};
  const sessionStatus = String(draftSession?.status || "").trim().toLowerCase();
  const sessionPaid = ["paid", "converting", "converted"].includes(sessionStatus);
  const isMomo = String(draftSession?.provider || "").trim().toLowerCase() === "momo";
  const canRetryFinalize = sessionPaid && Boolean(errorMessage);
  const qrUrl = buildPosQrImageUrl({ branch, amount, orderIdentity: identity });
  const momoQrValue = String(draftSession?.momoQrValue || "").trim();
  const config = getPosQrPaymentConfig(branch);
  const transferContent = draftSession?.paymentReference || buildPosPaymentReference(identity, branch);
  const dialogWidth = getPosDialogWidth(width, isMomo ? 440 : 500);
  const qrSize = Math.min(
    dialogWidth - 64,
    isMomo ? 210 : 240,
    Math.max(170, height - 390)
  );

  const primaryLabel = processing
    ? "Đang xử lý..."
    : canRetryFinalize
      ? "Chốt lại đơn"
      : "Xác nhận tay";

  const content = (
    <View style={styles.layer}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { width: dialogWidth }]}>
        <View style={styles.header}>
          <View style={styles.flexOne}>
            {isMomo ? <Image source={MOMO_LOGO} style={styles.momoHeaderLogo} resizeMode="contain" /> : null}
            <Text style={styles.eyebrow}>{isMomo ? "Ví MoMo" : "Chuyển khoản QR"}</Text>
            <Text style={styles.title}>{isMomo ? "Quét mã thanh toán MoMo" : "Quét mã thanh toán"}</Text>
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
              {isMomo && momoQrValue ? (
                <QRCode value={momoQrValue} size={qrSize} backgroundColor="#ffffff" color="#111827" />
              ) : qrUrl ? (
                <Image source={{ uri: qrUrl }} style={{ width: qrSize, height: qrSize }} resizeMode="contain" />
              ) : (
                <Text style={styles.qrFallback}>Chưa tạo được QR</Text>
              )}
            </View>
            <Text style={styles.validityNote}>Mã QR có hiệu lực trong 10 phút.</Text>

            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Số tiền</Text>
                <Text style={styles.summaryValue}>{formatMoney(amount)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Nội dung</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {transferContent}
                </Text>
              </View>
            </View>

            {draftSession ? (
              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>
                  {sessionPaid
                    ? (isMomo ? "Đã nhận thanh toán MoMo" : "Đã nhận chuyển khoản")
                    : (isMomo ? "Đang chờ MoMo" : "Đang chờ thanh toán")}
                </Text>
                <Text style={styles.statusValue} numberOfLines={1}>
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
                {sessionPaid && !canRetryFinalize ? (
                  <View style={[styles.primaryButton, styles.primaryWaiting]}>
                    <Text style={styles.primaryWaitingText}>Đang chốt đơn...</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.primaryButton, processing && styles.disabledPrimary]}
                    disabled={processing}
                    onPress={onConfirmPaid}
                  >
                    <Text style={[styles.primaryText, processing && styles.disabledText]}>
                      {primaryLabel}
                    </Text>
                  </Pressable>
                )}
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
  );

  if (!visible) return null;
  if (!useSystemModal) return content;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 500
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  sheet: {
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_MODAL.radius,
    padding: 14,
    ...POS_SHADOW
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  flexOne: {
    flex: 1
  },
  momoHeaderLogo: {
    width: 36,
    height: 36,
    marginBottom: 4,
    borderRadius: 8
  },
  eyebrow: {
    color: POS_COLORS.muted,
    fontSize: POS_MODAL.eyebrowSize,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 2,
    color: POS_COLORS.heading,
    fontSize: POS_MODAL.titleSize,
    lineHeight: POS_MODAL.titleLineHeight,
    fontWeight: "900"
  },
  ghostButton: {
    minHeight: POS_MODAL.closeButtonHeight,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostText: {
    color: POS_COLORS.slate,
    fontSize: 14,
    fontWeight: "900"
  },
  closeButton: {
    minHeight: POS_MODAL.closeButtonHeight,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
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
  body: {
    gap: 7
  },
  qrBox: {
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    padding: 7
  },
  qrFallback: {
    color: POS_COLORS.muted,
    fontWeight: "900"
  },
  validityNote: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  summaryBox: {
    gap: 5,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 7,
    paddingHorizontal: 10
  },
  summaryRow: {
    gap: 4
  },
  summaryDivider: {
    height: 1,
    backgroundColor: POS_COLORS.softBorder
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
    gap: 2,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 7,
    paddingHorizontal: 10
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
    fontSize: 11,
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
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButton: {
    flex: 1.15,
    minHeight: 46,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelText: {
    color: POS_COLORS.danger,
    fontSize: 15,
    fontWeight: "900"
  },
  primaryText: {
    color: POS_COLORS.surface,
    fontSize: 15,
    fontWeight: "900"
  },
  primaryWaiting: {
    backgroundColor: POS_COLORS.disabled,
    borderColor: "#94a3b8"
  },
  primaryWaitingText: {
    color: POS_COLORS.slate,
    fontSize: 15,
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
  }
});
