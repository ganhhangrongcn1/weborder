import { useState } from "react";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton } from "../../../components/customer/CustomerUI.jsx";
import CustomerControl from "../../../components/customer/CustomerControl.jsx";

const guideSteps = [
  ["Chọn cách bạn muốn đánh giá", "Chọn một đơn đối tác đã hoàn tất, hoặc chọn Google Maps để mở thẳng nơi đánh giá."],
  ["Đánh giá đúng đơn hoặc chi nhánh", "Đơn đối tác chọn trong danh sách; Google Maps chọn chi nhánh đã ghé."],
  ["Tải ảnh đánh giá 5 sao", "Tải ảnh chụp màn hình sau khi đánh giá 5 sao. Gánh kiểm tra và cộng điểm sau khi duyệt."]
];

export default function HomeReviewRewardPopup({ open, onClose, onContinue }) {
  const [step, setStep] = useState(1);
  if (!open) return null;
  const handleClose = () => { setStep(1); onClose?.(); };
  const handleContinue = () => { setStep(1); onContinue?.(); };
  return <CustomerBottomSheet
    title={step === 1 ? "Quà cảm ơn từ Gánh" : "Cách nhận quà"}
    ariaLabel="Hướng dẫn nhận điểm từ đánh giá"
    onClose={handleClose}
    className="review-reward-popup-sheet"
    contentClassName="review-intro-scroll"
    footer={<div className="review-intro-actions">
      {step === 2 && <CustomerButton variant="secondary" onClick={() => setStep(1)}>Quay lại</CustomerButton>}
      <CustomerButton full onClick={step === 1 ? () => setStep(2) : handleContinue}>
        {step === 1 ? "Bắt đầu nhận điểm" : "Chọn đơn hoặc Google Maps"}
      </CustomerButton>
    </div>}
  >
    <section className="review-intro">
      {step === 1 ? <>
        <div className="review-intro__summary">
          <Icon name="star" size={25} />
          <div><h3>Chia sẻ cảm nhận, nhận điểm thưởng</h3><p>Đơn đối tác · Google Maps</p></div>
        </div>
        <div className="review-intro__ways" aria-label="Hai cách nhận điểm">
          <CustomerControl type="button" onClick={handleContinue}><Icon name="bag" size={22} /><span><strong>Đánh giá đơn đối tác</strong><small>GrabFood · ShopeeFood · Xanh Ngon</small></span><Icon name="back" size={17} /></CustomerControl>
          <CustomerControl type="button" onClick={handleContinue}><Icon name="location" size={22} /><span><strong>Đánh giá Google Maps</strong><small>Chọn chi nhánh bạn đã trải nghiệm</small></span><Icon name="back" size={17} /></CustomerControl>
        </div>
        <aside className="review-intro__support">
          <strong>Trải nghiệm chưa trọn vẹn?</strong>
          <p>Gánh luôn sẵn lòng lắng nghe và hỗ trợ bạn qua Zalo 0933 799 061.</p>
          <a href="https://zalo.me/0933799061" target="_blank" rel="noreferrer">Nhắn Gánh <Icon name="back" size={15} /></a>
        </aside>
      </> : <>
        <p className="review-intro__lead">Gửi ảnh đánh giá 5 sao. Điểm được cộng sau khi Gánh kiểm tra và duyệt.</p>
        <ol className="review-intro__steps">{guideSteps.map(([title,description],index)=><li key={title}>
          <span>{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div>
        </li>)}</ol>
        <p className="review-intro__example"><Icon name="image" size={20} /><span>Ảnh cần nhìn rõ tên ứng dụng, mức 5 sao và nội dung đánh giá.</span></p>
      </>}
    </section>
  </CustomerBottomSheet>;
}
