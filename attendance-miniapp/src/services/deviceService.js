import { DEMO_BRANCH } from "../data/demo.js";
import { readAttachment } from "./demoRepository.js";
import { isMiniApp } from "./miniAppRuntime.js";
import { DEMO_ONLY } from "../constants/runtimeMode.js";

export const isZalo = () => !DEMO_ONLY && isMiniApp();
const sdk = () => import("zmp-sdk");
let wakeLock;

async function decode(kind) {
  const api = await sdk();
  const { token } = kind === "phone" ? await api.getPhoneNumber() : await api.getLocation();
  const accessToken = await api.getAccessToken();
  if (!token || !accessToken) throw new Error("Zalo chưa trả về token. Vui lòng kiểm tra quyền trên thiết bị.");
  const base = import.meta.env.VITE_ATTENDANCE_API_URL || "";
  const response = await fetch(`${base}/api/zalo/${kind}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, accessToken }), signal: AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => ({ error: "Máy chủ đổi token chưa sẵn sàng. Cần chạy bridge local hoặc cấu hình endpoint HTTPS." }));
  if (!response.ok) throw new Error(result.error || "Không đổi được token Zalo.");
  return result;
}

export async function networkStatus() {
  if (isZalo()) {
    const { networkType } = await (await sdk()).getNetworkType();
    return { online: networkType !== "none", label: networkType };
  }
  return { online: navigator.onLine, label: navigator.onLine ? "Đã kết nối trình duyệt" : "Mất kết nối" };
}

export async function locate(simulated) {
  if (simulated) return { latitude: DEMO_BRANCH.latitude, longitude: DEMO_BRANCH.longitude, accuracy: 5, capturedAt: Date.now(), simulated: true };
  if (isZalo()) return decode("location");
  if (!navigator.geolocation) throw new Error("Thiết bị không hỗ trợ GPS.");
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    ({ coords, timestamp }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, capturedAt: timestamp, simulated: false }),
    (error) => reject(new Error(error.code === 1 ? "Anh/chị chưa cho phép truy cập vị trí." : "Chưa lấy được GPS. Vui lòng kiểm tra cài đặt vị trí.")),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  ));
}

export async function scanQr(simulated) {
  if (simulated) return DEMO_BRANCH.qr;
  if (isZalo()) return (await (await sdk()).scanQRCode()).content;
  throw new Error("Quét QR native cần mở trong Zalo. Trên local, dùng mã QR mẫu hoặc mở camera quét bằng thiết bị hỗ trợ.");
}

export async function linkPhone(simulated) {
  if (simulated) return { masked: "SĐT MẪU · *** 0001", simulated: true };
  if (!isZalo()) throw new Error("Lấy số điện thoại Zalo cần chạy trong ứng dụng Zalo. Anh/chị có thể dùng liên kết mẫu trên local.");
  return decode("phone");
}

export async function pickNative(type = "photo") {
  if (!isZalo()) throw new Error("Sử dụng nút chọn tệp trên trình duyệt hoặc mở Mini App trong Zalo.");
  const api = await sdk();
  if (type === "zcamera_photo") await api.requestCameraPermission();
  const result = await api.openMediaPicker({ type, maxItemSize: 5 * 1024 * 1024, maxSelectItem: 1, compressLevel: 2 });
  const path = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!path || typeof path !== "string") throw new Error("Không có tệp được chọn.");
  const saved = await api.saveFile({ filePath: path });
  return { name: "Minh chứng thiết bị", type: type === "video" ? "video/mp4" : type === "file" ? "application/pdf" : "image/jpeg", data: saved.savedPath, native: true };
}

export function pickBrowserFile(camera = false) {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input"); input.type = "file";
    input.accept = camera ? "image/*" : "image/jpeg,image/png,image/webp,video/mp4,application/pdf";
    if (camera) input.setAttribute("capture", "user");
    input.onchange = async () => {
      try { resolve(input.files?.[0] ? await readAttachment(input.files[0]) : null); } catch (error) { reject(error); }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function vibrate() {
  if (isZalo()) { await (await sdk()).vibrate({ type: "oneShot", milliseconds: 100 }); return; }
  if (!navigator.vibrate?.(100)) throw new Error("Thiết bị/trình duyệt không hỗ trợ rung. Thông báo trên màn hình vẫn hoạt động.");
}

export async function keepAwake(enabled) {
  if (isZalo()) { await (await sdk()).keepScreen({ keepScreenOn: enabled }); return; }
  if (!enabled) { await wakeLock?.release(); wakeLock = null; return; }
  if (!navigator.wakeLock) throw new Error("Trình duyệt này không hỗ trợ giữ màn hình sáng.");
  wakeLock = await navigator.wakeLock.request("screen");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function downloadCsv(text) {
  if (isZalo()) {
    const base64 = btoa(Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join(""));
    await (await sdk()).downloadFile({ fileBase64Data: `data:text/csv;base64,${base64}` });
  } else downloadBlob(new Blob([text], { type: "text/csv;charset=utf-8" }), "bang-cong-demo.csv");
}

export async function openPdf(url) {
  if (isZalo()) await (await sdk()).openDocument({ url: new URL(url, window.location.href).href, title: "Hướng dẫn chấm công GHR", download: false });
  else window.open(url, "_blank", "noopener,noreferrer");
}

export async function saveVideo(url) {
  if (isZalo()) { await (await sdk()).saveVideoToGallery({ videoUrl: new URL(url, window.location.href).href }); return; }
  const response = await fetch(url); if (!response.ok) throw new Error("Không tải được video hướng dẫn.");
  downloadBlob(await response.blob(), "huong-dan-cham-cong.mp4");
}
