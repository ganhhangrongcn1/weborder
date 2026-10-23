export function detectMiniAppRuntime({ hostname = "", userAgent = "", appId = "" } = {}) {
  return hostname === "h5.zdn.vn" || Boolean(appId) && (/Zalo/i.test(userAgent) || hostname === "localhost" || hostname === "127.0.0.1");
}

export function isMiniApp() {
  return detectMiniAppRuntime({ hostname: window.location.hostname, userAgent: navigator.userAgent,
    appId: window.APP_ID || window.zAppID || "" });
}

export async function initializeMiniApp(provider = () => import("zmp-sdk")) {
  if (!isMiniApp()) return;
  const { nativeStorage } = await provider();
  // Configure before the repository or session is initialized. Never silently use web storage in Zalo.
  storage = nativeStorage;
}

let storage;
let nativeQueue = Promise.resolve();
let sessionId = null;
export function getSessionId() {
  return isMiniApp() ? sessionId : window.sessionStorage.getItem("ghr-attendance-demo-session");
}
export function setSessionId(id) {
  if (isMiniApp()) { sessionId = id; return; }
  if (id) window.sessionStorage.setItem("ghr-attendance-demo-session", id);
  else window.sessionStorage.removeItem("ghr-attendance-demo-session");
}

export function mutateNativeState(reducer, seed) {
  const task = nativeQueue.then(() => {
    if (!storage) throw new Error("Bộ nhớ Zalo chưa sẵn sàng. Vui lòng mở lại ứng dụng.");
    const key = "ghr_attendance_sample_v1";
    const saved = storage.getItem(key);
    let state;
    try { state = saved ? JSON.parse(saved) : seed(); }
    catch { throw new Error("Dữ liệu chấm công trên thiết bị bị lỗi. Chưa ghi thay đổi."); }
    if (state?.version !== 1 || !Array.isArray(state.records) || !Array.isArray(state.requests)) throw new Error("Dữ liệu chấm công chưa đúng định dạng.");
    const next = reducer(state); const serialized = JSON.stringify(next);
    if (new TextEncoder().encode(serialized).length > 1024 * 1024) throw new Error("Bộ nhớ chấm công đã đầy. Chưa lưu thay đổi.");
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) throw new Error("Zalo chưa lưu được dữ liệu. Vui lòng thử lại.");
    return next;
  });
  nativeQueue = task.catch(() => {});
  return task;
}
