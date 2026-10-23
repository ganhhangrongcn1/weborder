import { createDemoState, DEMO_ACCOUNTS } from "../data/demo.js";
import { isMiniApp, mutateNativeState, getSessionId, setSessionId } from "./miniAppRuntime.js";

let connection;
function db() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = window.indexedDB.open("ghr-attendance-demo-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => { connection = null; reject(new Error("Không mở được dữ liệu chấm công. Vui lòng cho phép lưu dữ liệu trình duyệt.")); };
    request.onblocked = () => reject(new Error("Đóng tab cũ rồi mở lại."));
  });
  return connection;
}

export async function mutateDemo(reducer) {
  if (isMiniApp()) return mutateNativeState(reducer, createDemoState);
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("state", "readwrite"); const store = tx.objectStore("state");
    let next; let failure;
    const request = store.get("demo");
    request.onsuccess = () => {
      try { next = reducer(request.result || createDemoState()); store.put(next, "demo"); }
      catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = () => reject(failure || new Error("Không lưu được dữ liệu chấm công. Có thể bộ nhớ đã đầy."));
    tx.onerror = () => { failure ||= new Error("Lưu dữ liệu thất bại. Chưa ghi nhận thay đổi."); };
  });
}

export const loadDemo = () => mutateDemo((state) => state);

export function loginDemo(username, password) {
  const account = DEMO_ACCOUNTS.find((a) => a.username === username.trim() && a.password === password);
  if (!account) throw new Error("Tài khoản hoặc mật khẩu chưa đúng.");
  const { password: _password, ...session } = account;
  setSessionId(session.id);
  return session;
}

export function restoreSession() {
  const id = getSessionId();
  const account = DEMO_ACCOUNTS.find((a) => a.id === id);
  if (!account) return null;
  const { password: _password, ...session } = account;
  return session;
}

export function logoutDemo() { setSessionId(null); }

export async function readAttachment(file) {
  if (!file || !/^(image\/(jpeg|png|webp)|video\/mp4|application\/pdf)$/.test(file.type)) {
    throw new Error("Chọn ảnh JPG/PNG/WebP, video MP4 hoặc tài liệu PDF.");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("Tệp tối đa 5 MB.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result, size: file.size });
    reader.onerror = () => reject(new Error("Không đọc được tệp."));
    reader.readAsDataURL(file);
  });
}
