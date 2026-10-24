import { useCallback, useEffect, useRef, useState } from "react";
import { loginAttendance, logoutAttendance } from "../services/attendanceAuthService.js";
import { loadAttendance, mutateAttendance } from "../services/attendanceRepository.js";
import { recordAttendance, submitCorrection, reviewCorrection } from "../services/attendanceService.js";
import * as device from "../services/deviceService.js";
import { TRAINING_MATERIALS } from "../services/trainingMaterialService.js";

export default function useAttendance() {
  const [actor, setActor] = useState(null);
  const [state, setState] = useState(null); const [error, setError] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const simulated = true; const [location, setLocation] = useState(null);
  const [qr, setQr] = useState(null); const [photo, setPhoto] = useState(null);
  const [network, setNetwork] = useState({ online: navigator.onLine, label: "Chưa kiểm tra" });
  const [method, setMethod] = useState("gps");
  const run = useCallback(async (action, success = "") => {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { const result = await action(); if (success) setMessage(success); return result; }
    catch (failure) { setError(failure.message || failure.errorMessage || "Thao tác chưa thành công. Vui lòng thử lại."); return null; }
    finally { lock.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const expected = generation.current;
      if (actor && !lock.current) loadAttendance(actor).then((data) => {
        if (active && !lock.current && expected === generation.current) setState(data.state);
      }).catch((e) => { if (active && expected === generation.current) setError(e.message); });
    };
    const connectivity = () => setNetwork({ online: navigator.onLine, label: navigator.onLine ? "Đã kết nối" : "Mất kết nối" });
    window.addEventListener("focus", refresh); window.addEventListener("online", connectivity); window.addEventListener("offline", connectivity);
    return () => { active = false; window.removeEventListener("focus", refresh); window.removeEventListener("online", connectivity); window.removeEventListener("offline", connectivity); };
  }, [actor]);
  const update = async (reducer) => { generation.current++; const next = await mutateAttendance(actor, reducer); setState(next); return next; };
  const login = (username, password) => run(async () => {
    const user = await loginAttendance(username, password);
    try {
      const next = await loadAttendance(user);
      setState(next.state); setActor(user);
    }
    catch (failure) { await logoutAttendance().catch(() => {}); throw failure; }
  }, "Đăng nhập thành công.");
  const logout = () => run(async () => { await logoutAttendance(); setActor(null); setState(null); setLocation(null); setQr(null); setPhoto(null); });
  const setSimulated = () => { setLocation(null); setQr(null); };
  const locate = () => run(async () => { const result = await device.locate(simulated); setLocation(result); }, "Đã kiểm tra vị trí.");
  const scan = () => run(async () => { const content = await device.scanQr(simulated); setQr({ content, at: Date.now() }); }, "Đã đọc mã QR. Hệ thống sẽ đối chiếu khi chấm công.");
  const checkNetwork = () => run(async () => { setNetwork(await device.networkStatus()); }, "Đã kiểm tra trạng thái mạng.");
  const capture = () => run(async () => { const image = device.isZalo() ? await device.pickNative("zcamera_photo") : await device.pickBrowserFile(true); if (image) setPhoto(image); });
  const check = (action) => run(async () => {
    const currentNetwork = await device.networkStatus(); setNetwork(currentNetwork);
    await update((data) => recordAttendance(data, actor, action, { online: currentNetwork.online, location, method, qr: qr?.content, qrAt: qr?.at, photo }));
    setPhoto(null); setLocation(null); setQr(null);
    try { await device.vibrate(); } catch { /* The persisted attendance remains successful when haptics are unavailable. */ }
  }, action === "in" ? "Đã ghi nhận vào ca." : "Đã ghi nhận ra ca.");
  const correction = (input) => run(() => update((data) => submitCorrection(data, actor, input)), "Đã lưu yêu cầu điều chỉnh công.");
  const review = (id, status, note) => run(() => update((data) => reviewCorrection(data, actor, id, status, note)), "Đã xử lý yêu cầu và lưu lịch sử duyệt.");
  const phone = () => run(async () => { const result = await device.linkPhone(simulated); await update((data) => ({ ...data, phones: { ...data.phones, [actor.id]: result } })); }, "Đã lưu liên kết số điện thoại.");
  const saveMaterial = (id) => run(async () => {
    if (!TRAINING_MATERIALS.some((item) => item.id === id)) throw new Error("Không tìm thấy tài liệu.");
    return update((data) => ({ ...data, savedMaterials: { ...data.savedMaterials, [id]: new Date().toISOString() } }));
  }, "Đã lưu vào mục Tài liệu của tôi để xem lại.");
  const clearNotices = () => { setError(""); setMessage(""); };
  return { actor, state, error, message, busy, saveMaterial, simulated, setSimulated, location, qr, photo, setPhoto, network, method, setMethod, clearNotices,
    run, login, logout, locate, scan, checkNetwork, capture, check, correction, review, phone };
}
