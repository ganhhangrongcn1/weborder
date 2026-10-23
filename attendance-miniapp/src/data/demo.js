export const DEMO_ACCOUNTS = [
  { username: "nhanvien.demo", password: "GhrDemo2026!", id: "demo-employee", name: "Nguyễn An · Demo", role: "employee", code: "NV-001" },
  { username: "quanly.demo", password: "GhrDemo2026!", id: "demo-manager", name: "Trần Bình · Demo", role: "manager", code: "QL-001" },
];

export const DEMO_BRANCH = {
  id: "demo-store", name: "Cửa hàng trải nghiệm", address: "Địa điểm giả lập để kiểm thử, không phải vị trí cửa hàng thật",
  latitude: 10.7769, longitude: 106.7009, radius: 150,
  qr: "GHR-ATTENDANCE:DEMO:STORE-01",
};

export const PERMISSIONS = [
  [25, "Quét QR", "Chấm công → Quét QR", "Nhân viên chủ động quét mã QR tại cửa hàng để xác định điểm làm việc trước khi xác nhận vào hoặc ra ca."],
  [38, "Vị trí hiện tại", "Chấm công → Kiểm tra GPS", "Ứng dụng lấy vị trí khi nhân viên chủ động chấm công để đối chiếu phạm vi địa điểm làm việc. Không theo dõi vị trí liên tục."],
  [48, "Thông tin mạng", "Chấm công → Kiểm tra kết nối", "Ứng dụng kiểm tra trạng thái kết nối mạng để thông báo khi nhân viên chưa thể gửi dữ liệu chấm công."],
  [58, "Giữ màn hình sáng", "Đào tạo → Phát video", "Ứng dụng giữ màn hình sáng khi nhân viên chủ động xem video hướng dẫn, và tắt chế độ này khi dừng xem hoặc rời màn hình."],
  [83, "Rung thiết bị", "Chấm công → Phản hồi rung", "Ứng dụng sử dụng rung ngắn kèm thông báo trên màn hình để phản hồi kết quả thao tác chấm công."],
  [87, "Truy cập camera", "Chấm công → Chụp ảnh", "Ứng dụng yêu cầu camera khi nhân viên chủ động chụp ảnh xác nhận chấm công để quản lý đối chiếu bản ghi tương ứng."],
  [94, "Chọn media", "Điều chỉnh → Đính kèm", "Nhân viên chủ động chọn ảnh, video hoặc tài liệu minh chứng để đính kèm yêu cầu điều chỉnh công và gửi quản lý xem xét."],
  [100, "Số điện thoại", "Tài khoản → Liên kết số điện thoại", "Ứng dụng xin số điện thoại khi người dùng đồng ý để đối chiếu hồ sơ nhân viên do doanh nghiệp đăng ký và liên kết đúng tài khoản."],
  [105, "Lưu video", "Đào tạo → Lưu video", "Nhân viên chủ động lưu video hướng dẫn nghiệp vụ do doanh nghiệp cung cấp về thiết bị để xem lại."],
  [106, "Tải file", "Lịch sử → Tải bảng công", "Nhân viên chủ động tải bảng công cá nhân về thiết bị để kiểm tra và đối chiếu."],
  [157, "Mở tài liệu", "Tài liệu → Xem nội quy PDF", "Ứng dụng cho phép nhân viên xem tài liệu PDF nội quy và hướng dẫn chấm công ngay trong ứng dụng."],
];

export function createDemoState(now = new Date()) {
  const records = Array.from({ length: 5 }, (_, index) => {
    const start = new Date(now); start.setDate(start.getDate() - index - 1); start.setHours(8, 0, 0, 0);
    const end = new Date(start); end.setHours(16, 0, 0, 0);
    return { id: `sample-${index}`, employeeId: "demo-employee", name: DEMO_ACCOUNTS[0].name,
      branchId: DEMO_BRANCH.id, checkIn: start.toISOString(), checkOut: end.toISOString(),
      method: "sample", demo: true, location: null, photo: null };
  });
  return { version: 1, records, requests: [], phones: {} };
}
