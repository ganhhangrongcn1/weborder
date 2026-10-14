import { useEffect } from "react";
import { Link } from "react-router-dom";
import useRecruitmentForm from "./useRecruitmentForm.js";
import { ChoiceField, TextField } from "./RecruitmentFields.jsx";
import "./recruitment.css";

export default function RecruitmentPage({ homeContent = [] }) {
  const state = useRecruitmentForm();
  const brand = homeContent.find((block) => block?.id === "siteBrand");
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Tuyển dụng | Gánh Hàng Rong";
    return () => { document.title = previousTitle; };
  }, []);
  const field = { form: state.form, errors: state.errors, update: state.update, toggle: state.toggle };
  return (
    <main className="recruitment-page">
      <header className="recruitment-header">
        <Link to="/home" className="recruitment-brand">
          {brand?.logo && <img src={brand.logo} alt="Logo Gánh Hàng Rong" />}
          <span><small>Bánh tráng trộn</small><strong>Gánh Hàng Rong</strong></span>
        </Link>
        <Link to="/home" className="recruitment-back">Về trang chủ ↗</Link>
      </header>
      <div className="recruitment-layout">
        <section className="recruitment-intro" aria-labelledby="recruitment-title">
          <span className="recruitment-eyebrow">TUYỂN DỤNG · GÁNH HÀNG RONG</span>
          <h1 id="recruitment-title">Về chung<br />một Gánh nha!</h1>
          <p>Gánh không tìm một người hoàn hảo. Gánh muốn biết thêm về bạn, lịch làm việc và cửa hàng bạn muốn đồng hành.</p>
          <div className="recruitment-intro-note">
            <strong>Mình làm quen từ đây</strong>
            <p>Bạn điền thông tin bên dưới giúp Gánh nha. Chúng mình sẽ chủ động liên hệ lại khi bạn phù hợp với các tiêu chí của bên cửa hàng.</p>
          </div>
          <p className="recruitment-privacy">Thông tin của bạn chỉ dùng để tiếp nhận hồ sơ và liên hệ tuyển dụng. Không cần đăng nhập để gửi hồ sơ.</p>
        </section>
        <section className="recruitment-card" aria-label="Đơn ứng tuyển">
          {state.receipt ? (
            <div className="recruitment-success" role="status">
              <span className="recruitment-success-mark" aria-hidden="true">✓</span>
              <h2>Gánh đã nhận hồ sơ của bạn!</h2>
              <p>Cảm ơn bạn đã dành thời gian chia sẻ. Chúng mình sẽ chủ động liên hệ lại khi bạn phù hợp với các tiêu chí của bên cửa hàng.</p>
              <p className="recruitment-hint">Mã tiếp nhận: {state.receipt.applicationId}</p>
              <Link to="/home" className="recruitment-submit">Ghé trang chủ của Gánh</Link>
            </div>
          ) : (
            <form onSubmit={state.submit} noValidate>
              <div className="recruitment-form-heading"><h2>Đơn ứng tuyển</h2><p>Các mục có dấu <span>*</span> là bắt buộc.</p></div>
              <fieldset disabled={state.submitting} className="recruitment-form-body">
                <section aria-labelledby="recruitment-personal">
                  <h3 id="recruitment-personal"><span>01</span> Một chút về bạn</h3>
                  <div className="recruitment-grid">
                    <TextField {...field} name="fullName" label="Họ và tên" autoComplete="name" maxLength={100} />
                    <TextField {...field} name="birthDate" label="Ngày tháng năm sinh" type="date" min="1900-01-01" max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })} />
                    <TextField {...field} name="phone" label="Số điện thoại" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} />
                    <TextField {...field} name="address" label="Nơi ở của bạn" autoComplete="street-address" maxLength={300} />
                  </div>
                  <ChoiceField {...field} name="gender" label="Giới tính của bạn" />
                  <ChoiceField {...field} name="education" label="Trình độ học vấn" />
                  {state.form.education === "Mục khác" && <TextField {...field} name="educationOther" label="Trình độ học vấn khác" maxLength={150} />}
                  <TextField {...field} name="school" label="Nếu đang đi học thì bạn đang học trường nào?" hint="Nếu không đi học, bạn ghi “Không đang đi học” nha." maxLength={200} />
                </section>
                <section aria-labelledby="recruitment-work">
                  <h3 id="recruitment-work"><span>02</span> Bạn muốn làm việc ở đâu, lúc nào?</h3>
                  <ChoiceField {...field} name="branch" label="Cửa hàng bạn muốn ứng tuyển" />
                  <ChoiceField {...field} name="shifts" label="Khung giờ bạn có thể làm việc" multiple />
                  <ChoiceField {...field} name="workTypes" label="Thời gian bạn muốn làm việc tại cửa hàng" multiple />
                </section>
                <section aria-labelledby="recruitment-story">
                  <h3 id="recruitment-story"><span>03</span> Kể Gánh nghe thêm nha</h3>
                  <TextField {...field} name="impression" label="Cảm nhận của bạn về Gánh Hàng Rong" multiline />
                  <TextField {...field} name="previousJob" label="Mô tả công việc và mức lương gần nhất của bạn" hint="Nếu chưa từng đi làm, bạn ghi rõ giúp Gánh nha." multiline />
                  <TextField {...field} name="selfDescription" label="Bạn hãy tự nhận xét về bản thân mình" multiline />
                </section>
                <div className="recruitment-trap" aria-hidden="true">
                  <label htmlFor="recruitment-website">Website</label>
                  <input id="recruitment-website" name="website" tabIndex={-1} autoComplete="off" value={state.form.website} onChange={(event) => state.update("website", event.target.value)} />
                </div>
              </fieldset>
              {state.message && <p className="recruitment-error" role="alert">{state.message}</p>}
              <button type="submit" className="recruitment-submit" disabled={state.submitting} aria-busy={state.submitting}>
                {state.submitting ? "Đang gửi hồ sơ…" : "Gửi hồ sơ cho Gánh →"}
              </button>
              <p className="recruitment-submit-note">Bạn kiểm tra lại số điện thoại để Gánh có thể liên hệ nha.</p>
            </form>
          )}
        </section>
      </div>
      <footer className="recruitment-footer">Gánh Hàng Rong · Cảm ơn bạn đã muốn trở thành một phần của Gánh.</footer>
    </main>
  );
}
