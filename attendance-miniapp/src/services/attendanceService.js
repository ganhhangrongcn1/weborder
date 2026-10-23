import { DEMO_BRANCH } from "../data/demo.js";

export function localDay(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function distanceMeters(a, b) {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude); const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function validateLocation(location, now = Date.now()) {
  if (!location || ![location.latitude, location.longitude, location.accuracy, location.capturedAt].every(Number.isFinite)
    || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180
    || location.accuracy < 0 || now - location.capturedAt > 120000 || location.capturedAt > now + 5000) {
    throw new Error("Vị trí không hợp lệ hoặc đã quá 2 phút. Vui lòng kiểm tra GPS lại.");
  }
  const distance = distanceMeters(location, DEMO_BRANCH);
  if (location.accuracy > 100) throw new Error("GPS chưa đủ chính xác (trên 100 m). Vui lòng thử lại ở nơi thoáng.");
  if (distance + location.accuracy > DEMO_BRANCH.radius) throw new Error("Vị trí chưa nằm trọn trong phạm vi chấm công 150 m của điểm chấm công.");
  return Math.round(distance);
}

export function recordAttendance(state, actor, action, evidence, now = new Date()) {
  if (!actor || !["in", "out"].includes(action)) throw new Error("Thao tác chấm công không hợp lệ.");
  if (!evidence.online) throw new Error("Đang mất mạng. Chưa ghi nhận chấm công; vui lòng kết nối rồi thử lại.");
  validateLocation(evidence.location, now.getTime());
  if (!["gps", "qr"].includes(evidence.method)) throw new Error("Phương thức chấm công không hợp lệ.");
  if (evidence.method === "qr" && (evidence.qr !== DEMO_BRANCH.qr || !Number.isFinite(evidence.qrAt) || evidence.qrAt > now.getTime() + 5000 || now.getTime() - evidence.qrAt > 120000)) {
    throw new Error("Mã QR không đúng điểm chấm công hoặc đã hết hạn kiểm tra. Vui lòng quét lại.");
  }
  const open = state.records.find((r) => r.employeeId === actor.id && !r.checkOut);
  if (action === "in") {
    if (open) throw new Error("Anh/chị đang có ca chưa ra. Hãy ra ca trước khi vào ca mới.");
    const entry = { id: crypto.randomUUID(), employeeId: actor.id, name: actor.name, branchId: DEMO_BRANCH.id,
      checkIn: now.toISOString(), checkOut: null, method: evidence.method, demo: true,
      location: evidence.location, photo: evidence.photo || null };
    return { ...state, records: [entry, ...state.records] };
  }
  if (!open) throw new Error("Chưa có ca đang làm để ra ca.");
  if (now.getTime() <= new Date(open.checkIn).getTime()) throw new Error("Giờ ra ca phải sau giờ vào ca.");
  return { ...state, records: state.records.map((r) => r.id === open.id
    ? { ...r, checkOut: now.toISOString(), outLocation: evidence.location, outPhoto: evidence.photo || null } : r) };
}

export function submitCorrection(state, actor, input) {
  const reason = String(input.reason || "").trim();
  const record = state.records.find((r) => r.id === input.recordId && r.employeeId === actor.id);
  if (!record) throw new Error("Vui lòng chọn bản ghi của mình cần điều chỉnh.");
  if (reason.length < 10 || reason.length > 1000) throw new Error("Lý do cần từ 10 đến 1.000 ký tự.");
  const start = new Date(input.checkIn); const end = input.checkOut ? new Date(input.checkOut) : null;
  if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end <= start))) {
    throw new Error("Giờ điều chỉnh chưa hợp lệ; giờ ra phải sau giờ vào.");
  }
  if (start > new Date() || (end && end > new Date())) throw new Error("Không thể điều chỉnh công sang thời điểm trong tương lai.");
  if (state.requests.some((r) => r.recordId === record.id && r.status === "pending")) throw new Error("Bản ghi đang có yêu cầu chờ duyệt.");
  const request = { id: crypto.randomUUID(), employeeId: actor.id, name: actor.name, recordId: record.id,
    reason, checkIn: start.toISOString(), checkOut: end?.toISOString() || null,
    attachment: input.attachment || null, status: "pending", createdAt: new Date().toISOString() };
  return { ...state, requests: [request, ...state.requests] };
}

export function reviewCorrection(state, actor, id, status, note) {
  if (actor?.role !== "manager") throw new Error("Chỉ tài khoản quản lý được duyệt yêu cầu.");
  const request = state.requests.find((r) => r.id === id && r.status === "pending");
  if (!request || !["approved", "rejected"].includes(status)) throw new Error("Yêu cầu không còn chờ duyệt.");
  if (request.employeeId === actor.id) throw new Error("Không thể tự duyệt yêu cầu của mình.");
  if (!String(note || "").trim()) throw new Error("Vui lòng ghi ý kiến xử lý.");
  const target = state.records.find((r) => r.id === request.recordId);
  if (!target) throw new Error("Bản ghi chấm công không còn tồn tại.");
  if (status === "approved") {
    const overlaps = state.records.some((r) => r.id !== target.id && r.employeeId === target.employeeId
      && new Date(request.checkIn).getTime() < (r.checkOut ? new Date(r.checkOut).getTime() : Infinity)
      && new Date(r.checkIn).getTime() < (request.checkOut ? new Date(request.checkOut).getTime() : Infinity));
    if (overlaps) throw new Error("Giờ điều chỉnh trùng với ca khác của nhân viên.");
  }
  return { ...state,
    requests: state.requests.map((r) => r.id === id ? { ...r, status, note: note.trim(), reviewer: actor.name, reviewedAt: new Date().toISOString() } : r),
    records: status === "approved" ? state.records.map((r) => r.id === target.id
      ? { ...r, originalCheckIn: r.originalCheckIn || r.checkIn, originalCheckOut: r.originalCheckOut || r.checkOut,
        checkIn: request.checkIn, checkOut: request.checkOut, adjusted: true } : r) : state.records };
}

export function hours(record) {
  return record.checkOut ? Math.max(0, (new Date(record.checkOut) - new Date(record.checkIn)) / 3600000) : 0;
}

export function exportCsv(records) {
  const cell = (v) => `"${String(v ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  return "\uFEFF" + [["Nhân viên", "Vào ca", "Ra ca", "Số giờ", "Dữ liệu"], ...records.map((r) =>
    [r.name, r.checkIn, r.checkOut || "Chưa ra ca", hours(r).toFixed(2), "DEMO"])]
    .map((row) => row.map(cell).join(",")).join("\r\n");
}
