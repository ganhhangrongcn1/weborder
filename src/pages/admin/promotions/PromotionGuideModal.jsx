export default function PromotionGuideModal({ onClose }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <section className="admin-guide-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-guide-head">
          <div>
            <span>Hướng dẫn</span>
            <h2>Cách set chương trình khuyến mãi</h2>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="admin-guide-body">
          <p><strong>1. Chọn loại chương trình:</strong> Freeship dùng cho hỗ trợ phí giao hàng, Mã giảm giá dùng cho ưu đãi nhập mã/gợi ý, Đủ mốc nhận quà dùng để kích thích khách thêm món.</p>
          <p><strong>2. Set điều kiện:</strong> nhập đơn tối thiểu, loại khách và nơi hiển thị. Ví dụ freeship 150k: loại Freeship, đơn tối thiểu 150000, hiển thị Checkout và Trang chủ.</p>
          <p><strong>3. Set phần thưởng:</strong> hỗ trợ phí ship, giảm tiền cố định, giảm %, tặng quà hoặc tặng điểm. App khách sẽ đọc phần này để tính/hiển thị đúng.</p>
          <p><strong>4. Ưu tiên:</strong> số càng nhỏ càng hiện trước. Dùng để admin quyết định chương trình nào nổi bật hơn.</p>
          <p><strong>5. Supabase:</strong> tạo bảng <code>promotions</code> gồm id, name, type, title, text, icon, active, display_places, condition, reward, start_at, end_at, priority. Khi nối thật, chỉ thay hàm load/save localStorage bằng query Supabase.</p>
        </div>
      </section>
    </div>
  );
}

