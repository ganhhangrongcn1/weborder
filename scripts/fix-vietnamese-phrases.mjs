import fs from "node:fs";

const targets = [
  "src/features/account/AccountView.jsx",
  "src/features/account/hooks/useAccountViewModel.js",
  "src/pages/customer/checkout/PromoModal.jsx",
  "src/pages/customer/checkout/DeliveryFeeModal.jsx",
  "src/pages/customer/checkout/CheckoutTotalCard.jsx",
  "src/hooks/useCustomerSession.js",
  "src/App.jsx",
  "src/pages/admin/menu/AdminProductModal.jsx"
];

const replacements = [
  ["kho?n", "khoản"],
  ["c?u", "cứu"],
  ["don", "đơn"],
  ["s? ", "số "],
  ["di?n", "điện"],
  ["d?a", "địa"],
  ["m?t kh?u", "mật khẩu"],
  ["Ð", "Đ"],
  ["dã", "đã"],
  ["dang", "đang"],
  ["chua", "chưa"],
  ["khuy?n", "khuyến"],
  ["Uu dãi", "Ưu đãi"],
  ["T?ng", "Tổng"],
  ["c?ng", "cộng"],
  ["ti?t", "tiết"],
  ["ki?m", "kiệm"],
  ["du?c", "được"],
  ["di?m", "điểm"],
  ["thu?ng", "thưởng"],
  ["l?i", "lại"],
  ["hoàn t?t", "hoàn tất"],
  ["Xác minh d?", "Xác minh để"],
  ["phù h?p", "phù hợp"],
  ["Gi?i thích", "Giải thích"],
  ["hi?n t?i", "hiện tại"],
  ["d? ki?n", "dự kiến"],
  ["Chua xác d?nh", "Chưa xác định"],
  ["ngu?n", "nguồn"],
  ["Kh?ch v?ng lai", "Khách vãng lai"],
  ["V?a cay", "Vừa cay"],
  ["Ã—", "×"]
  ,["Ch?n", "Chọn"]
  ,["C?n", "Cần"]
  ,["gi?", "giữ"]
  ,["nh?t", "nhất"]
  ,["nh?p", "nhập"]
  ,["tho?i", "thoại"]
  ,["h?p l?", "hợp lệ"]
  ,["S?", "Số"]
  ,["d?", "để"]
  ,["m?", "mở"]
  ,["d?y", "đầy"]
  ,["t?ng", "từng"]
  ,["t?o", "tạo"]
  ,["nh?n", "nhận"]
  ,["b?n", "bạn"]
  ,["b?ng", "bằng"]
  ,["g?n", "gần"]
  ,["m?i", "mới"]
  ,["ho?c", "hoặc"]
  ,["ch?", "chỉ"]
  ,["c?a", "của"]
  ,["th?", "thể"]
  ,["t?i thi?u", "tối thiểu"]
  ,["kh?p", "khớp"]
  ,["c?p nh?t", "cập nhật"]
  ,["li?u", "liệu"]
  ,["k?t", "kết"]
  ,["kiệm", "kiểm"]
  ,["ch?n", "chọn"]
  ,["t? d?n", "tự đến"]
  ,["l?y", "lấy"]
  ,["Kho?ng", "Khoảng"]
  ,["Ngu?n", "Nguồn"]
  ,["t?m", "tạm"]
  ,["B?n", "Bạn"]
  ,["b?ng", "bằng"]
  ,["l?ch s?", "lịch sử"]
  ,["Đi?m", "Điểm"]
  ,["h? so", "hồ sơ"]
  ,["ch?", "chỗ"]
  ,["Đ? b?o v?", "Để bảo vệ"]
  ,["cu?i", "cuối"]
  ,["g?i", "gửi"]
  ,["Đ?a", "Địa"]
  ,["n?m", "nằm"]
  ,["Ví d?:", "Ví dụ:"]
  ,["đơn cu", "đơn cũ"]
  ,["ngu?i", "người"]
  ,["d?t", "đặt"]
  ,["luu", "lưu"]
  ,["Chua", "Chưa"]
  ,["Uu", "Ưu"]
  ,["Đon", "Đơn"]
  ,["H?ng", "Hạng"]
  ,["Tin t?c", "Tin tức"]
  ,["Tra cá»©u báº¡ng sá»‘ Ä‘iá»‡n thoáº¡i", "Tra cứu bằng số điện thoại"]
  ,["Nh?p sá»‘ Ä‘iá»‡n thoáº¡i Ä‘á»ƒ xem l?ch sá»‘ Ä‘Æ¡n. Äiá»ƒm, Ä‘á»‹a chá»‰, voucher vÃ  há»“ sÆ¡ c?n Ä‘ang nháº­p báº¡ng máº­t kháº©u.", "Nhập số điện thoại để xem lịch sử đơn. Điểm, địa chỉ, voucher và hồ sơ cần đăng nhập bằng mật khẩu."]
  ,["Nh?p sá»‘ Ä‘iá»‡n thoáº¡i", "Nhập số điện thoại"]
  ,["M?t kh?u", "Mật khẩu"]
  ,["M?t kh?u mởi", "Mật khẩu mới"]
  ,["Sá»‘ Ä‘iá»‡n thoáº¡i", "Số điện thoại"]
  ,["MÃ³n Â· Äá»‹a chá»‰ Ä‘Ã£ Ä‘Æ°á»£c ?n", "món · Địa chỉ đã được ẩn"]
  ,["T?o tÃ i khoáº£n t? Ä‘Æ¡n Ä‘Ã£ Ä‘á»ƒt", "Tạo tài khoản từ đơn đã đặt"]
  ,["MÃ£ Ä‘Æ¡n náº±m trong tin nháº­n Zalo báº¡n Ä‘Ã£ gá»­i cho quÃ¡n sau khi Ä‘á»ƒt hÃ ng. VÃ­ Ä‘á»ƒ: GHR-1028 ? nháº­p 1028.", "Mã đơn nằm trong tin nhắn Zalo bạn đã gửi cho quán sau khi đặt hàng. Ví dụ: GHR-1028 → nhập 1028."]
  ,["Chá»nh s?a há»“ sÆ¡", "Chỉnh sửa hồ sơ"]
  ,["CÃ i Ä‘á»ƒt thÃ´ng bÃ¡o", "Cài đặt thông báo"]
  ,["C?p nháº¥t Ä‘Æ¡n hÃ ng", "Cập nhật đơn hàng"]
  ,["Khuy?n mÃ£i & Æ¯u Ä‘Ã£i", "Khuyến mãi & Ưu đãi"]
  ,["Tin tá»©c má»Ÿi", "Tin tức mới"]
  ,["Sá»‘ nÃ y Ä‘Ã£ cÃ³ tÃ i khoáº£n. Nh?p máº­t kháº©u Ä‘á»ƒ má»Ÿ Ä‘á»ƒy Ä‘á»ƒ Ä‘iá»ƒm, Ä‘á»‹a chá»‰ vÃ  voucher.", "Số này đã có tài khoản. Nhập mật khẩu để mở đầy đủ điểm, địa chỉ và voucher."]
  ,["Sá»‘ nÃ y Ä‘Ã£ tá»«ng Ä‘á»ƒt hÃ ng. Ä? táº¡o tÃ i khoáº£n vÃ  nháº­n láº¡i Ä‘iá»ƒm, báº¡n c?n xÃ¡c minh báº¡ng mÃ£ Ä‘Æ¡n gáº§n nháº¥t.", "Số này đã từng đặt hàng. Để tạo tài khoản và nhận lại điểm, bạn cần xác minh bằng mã đơn gần nhất."]
  ,["Sá»‘ má»Ÿi. T?o tÃ i khoáº£n báº¡ng tÃªn vÃ  máº­t kháº©u Ä‘á»ƒ b?t Ä‘á»ƒu lÆ°u Ä‘á»ƒ liá»‡u riÃªng.", "Số mới. Tạo tài khoản bằng tên và mật khẩu để bắt đầu lưu dữ liệu riêng."]
  ,["M?t kh?u chÆ°a dÃºng.", "Mật khẩu chưa đúng."]
  ,["XÃ¡c minh thÃ nh cÃ´ng. Báº¡n cÃ³ thá»ƒ táº¡o máº­t kháº©u má»Ÿi.", "Xác minh thành công. Bạn có thể tạo mật khẩu mới."]
  ,["M?t kh?u má»Ÿi tá»‘i thiá»ƒu 6 kÃ½ t?.", "Mật khẩu mới tối thiểu 6 ký tự."]
  ,["Nh?p láº¡i máº­t kháº©u má»Ÿi chÆ°a khá»›p.", "Nhập lại mật khẩu mới chưa khớp."]
  ,["KhÃ´ng tÃ¬m thá»ƒy tÃ i khoáº£n Ä‘á»ƒ c?p nháº¥t.", "Không tìm thấy tài khoản để cập nhật."]
  ,["ÄÃ£ c?p nháº¥t máº­t kháº©u. Báº¡n Ä‘ang nháº­p láº¡i báº¡ng máº­t kháº©u má»Ÿi nhÃ©.", "Đã cập nhật mật khẩu. Bạn đăng nhập lại bằng mật khẩu mới nhé."]
  ,["M?t kh?u tá»‘i thiá»ƒu 6 kÃ½ t?.", "Mật khẩu tối thiểu 6 ký tự."]
  ,["Äang kÃ½ thÃ nh cÃ´ng. D? liá»‡u cu theo sá»‘ Ä‘iá»‡n thoáº¡i Ä‘Ã£ Ä‘Æ°á»£c liÃªn káº¿t.", "Đăng ký thành công. Dữ liệu cũ theo số điện thoại đã được liên kết."]
];

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const input = fs.readFileSync(file, "utf8");
  let output = input;
  for (const [from, to] of replacements) {
    output = output.split(from).join(to);
  }
  if (output !== input) {
    fs.writeFileSync(file, output, "utf8");
    console.log(`updated: ${file}`);
  }
}
