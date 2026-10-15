import { useEffect } from "react";
import { Link } from "react-router-dom";
import useRecruitmentForm from "./useRecruitmentForm.js";
import RecruitmentQuestion from "./RecruitmentQuestion.jsx";
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
            <p>Bạn điền thông tin bên dưới giúp Gánh nha. {state.settings?.config.introduction || "Chúng mình sẽ chủ động liên hệ lại khi bạn phù hợp với các tiêu chí của bên cửa hàng."}</p>
          </div>
          <p className="recruitment-privacy">Thông tin của bạn chỉ dùng để tiếp nhận hồ sơ và liên hệ tuyển dụng. Không cần đăng nhập để gửi hồ sơ.</p>
        </section>
        <section className="recruitment-card" aria-label="Đơn ứng tuyển">
          {state.receipt ? (
            <div className="recruitment-success" role="status">
              <span className="recruitment-success-mark" aria-hidden="true">✓</span>
              <h2>Gánh đã nhận hồ sơ của bạn!</h2>
              <p>{state.settings?.config.successMessage}</p>
              <p className="recruitment-hint">Mã tiếp nhận: {state.receipt.applicationId}</p>
              <Link to="/home" className="recruitment-submit">Ghé trang chủ của Gánh</Link>
            </div>
          ) : state.loading ? <p role="status">Đang tải form tuyển dụng…</p> : !state.settings ? <div role="alert"><p>{state.message}</p><button type="button" onClick={() => window.location.reload()}>Tải lại</button></div> : !state.settings.config.accepting ? <p role="status">Gánh đang tạm ngưng nhận hồ sơ. Bạn ghé lại sau nha.</p> : (
            <form onSubmit={state.submit} noValidate>
              <div className="recruitment-form-heading"><h2>Đơn ứng tuyển</h2><p>Các mục có dấu <span>*</span> là bắt buộc.</p></div>
              <fieldset disabled={state.submitting} className="recruitment-form-body">
                {state.settings.config.questions.filter((q) => q.active).map((q) => <RecruitmentQuestion key={q.id} question={q} {...field} />)}
                <div className="recruitment-trap" aria-hidden="true">
                  <label htmlFor="recruitment-website">Website</label>
                  <input id="recruitment-website" name="website" tabIndex={-1} autoComplete="off" value={state.form.website} onChange={(event) => state.update("website", event.target.value)} />
                </div>
              </fieldset>
              {state.message && <p className="recruitment-error" role="alert">{state.message}</p>}
              <button type="submit" className="recruitment-submit" disabled={state.submitting || state.settings.readOnly} aria-busy={state.submitting}>
                {state.settings.readOnly ? "Tạm chưa kết nối để nhận hồ sơ" : state.submitting ? "Đang gửi hồ sơ…" : "Gửi hồ sơ cho Gánh →"}
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
