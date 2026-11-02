export { buildBankQrPayload, crc16 } from "../../ghr-pos-mobile-native/src/shared/pos/bankQrPayload.js";

export async function renderBankQrImage(payload) {
  if (!payload) return "";
  const module = await import("qrcode");
  return (module.default || module).toDataURL(payload, { width: 420, margin: 4, errorCorrectionLevel: "M" });
}
