import { useState } from "react";
import RecruitmentQuestion from "../../../features/recruitment/RecruitmentQuestion.jsx";
import "../../../features/recruitment/recruitment.css";

export default function RecruitmentFormPreview({ config, selectedId, screen, setScreen }) {
  const [form, setForm] = useState({});
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const toggle = (key, value) => setForm((previous) => ({ ...previous,
    [key]: (previous[key] || []).includes(value) ? previous[key].filter((item) => item !== value) : [...(previous[key] || []), value] }));
  return (
    <aside className="recruitment-preview" aria-label="Xem trước form ứng viên">
      <header className="recruitment-preview-heading"><div><strong>Ứng viên sẽ thấy thế này</strong><p>Cập nhật ngay theo bản đang chỉnh. Có thể chọn và gõ thử; không gửi hồ sơ.</p></div></header>
      <div className="recruitment-preview-tabs" role="group" aria-label="Màn hình xem trước">
        <button type="button" aria-pressed={screen === "form"} onClick={() => setScreen("form")}>Form ứng tuyển</button>
        <button type="button" aria-pressed={screen === "success"} onClick={() => setScreen("success")}>Sau khi gửi</button>
      </div>
      <div className="recruitment-preview-scroll">
        <div className="recruitment-page recruitment-preview-page">
          <div className="recruitment-preview-brand"><small>Bánh tráng trộn</small><strong>Gánh Hàng Rong</strong></div>
          <section className="recruitment-intro"><span className="recruitment-eyebrow">TUYỂN DỤNG · GÁNH HÀNG RONG</span><h1>Về chung<br />một Gánh nha!</h1><p>Gánh không tìm một người hoàn hảo. Gánh muốn biết thêm về bạn, lịch làm việc và cửa hàng bạn muốn đồng hành.</p><div className="recruitment-intro-note"><strong>Mình làm quen từ đây</strong><p>Bạn điền thông tin bên dưới giúp Gánh nha. {config.introduction}</p></div><p className="recruitment-privacy">Thông tin của bạn chỉ dùng để tiếp nhận hồ sơ và liên hệ tuyển dụng. Không cần đăng nhập để gửi hồ sơ.</p></section>
          <section className="recruitment-card">
            {screen === "success" ? <div className="recruitment-success"><span className="recruitment-success-mark" aria-hidden="true">✓</span><h2>Gánh đã nhận hồ sơ của bạn!</h2><p>{config.successMessage}</p><small>Đây là bản xem trước thông báo, chưa có hồ sơ nào được gửi.</small></div>
              : !config.accepting ? <p>Gánh đang tạm ngưng nhận hồ sơ. Bạn ghé lại sau nha.</p>
              : <><div className="recruitment-form-heading"><h2>Đơn ứng tuyển</h2><p>Các mục có dấu <span>*</span> là bắt buộc.</p></div>
                {config.questions.filter((q) => q.active).map((q) => <div id={`preview-${q.id}`} key={q.id} className={q.id === selectedId ? "recruitment-preview-selected" : ""}>
                  <RecruitmentQuestion question={q} form={form} errors={{}} update={update} toggle={toggle} />
                </div>)}
                <button className="recruitment-submit" type="button" disabled>Gửi hồ sơ cho Gánh →</button>
                <p className="recruitment-submit-note">Bạn kiểm tra lại số điện thoại để Gánh có thể liên hệ nha.</p>
              </>}
          </section>
        </div>
      </div>
    </aside>
  );
}
