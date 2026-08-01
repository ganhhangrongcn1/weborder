import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";

export default function HomeReviewRewardPopup({
  open,
  onClose,
  onContinue
}) {
  const [step, setStep] = useState(1);
  if (!open) return null;

  const handleClose = () => {
    setStep(1);
    onClose?.();
  };
  const handleContinue = () => {
    setStep(1);
    onContinue?.();
  };
  const popup = (
    <CustomerBottomSheet
      ariaLabel="Hướng dẫn nhận điểm từ đánh giá đơn đối tác"
      onClose={handleClose}
      backdropClassName="review-reward-popup-backdrop"
      className="review-reward-popup-sheet"
      contentClassName="review-reward-popup-scroll"
      showHeader={false}
      showHandle={false}
    >
      <section className="review-reward-popup">
        <header className="review-reward-popup__topbar">
          {step === 1 ? (
            <span><Icon name="star" size={21} /></span>
          ) : (
            <button
              type="button"
              className="review-reward-popup__back"
              onClick={() => setStep(1)}
              aria-label="Quay lại phần giới thiệu"
            >
              <Icon name="back" size={20} />
            </button>
          )}
          <strong>{step === 1 ? "Quà cảm ơn từ Gánh" : "Cách nhận quà"}</strong>
          <button type="button" onClick={handleClose} aria-label="Đóng hướng dẫn">
            <Icon name="close" size={20} />
          </button>
        </header>

        {step === 1 ? (
          <>
            <div className="review-reward-popup__hero" aria-hidden="true">
              <span><Icon name="star" size={52} weight="fill" /></span>
              <strong>+5.000đ</strong>
            </div>

            <div className="review-reward-popup__copy">
              <p>
                Nếu món ăn hôm nay làm bạn hài lòng, hãy dành một chút thời gian
                <strong> đánh giá 5 sao cho Gánh trên GrabFood, ShopeeFood, Xanh Ngon hoặc Google Maps</strong> nhé.
                Mỗi lời khen của bạn là niềm vui và động lực để Gánh chăm chút món ăn tốt hơn mỗi ngày.
              </p>
            </div>

            <p className="review-reward-popup__note">
              <span>
                <strong>Trải nghiệm chưa trọn vẹn?</strong>
                Gánh luôn sẵn lòng lắng nghe và hỗ trợ bạn qua Zalo 0933 799 061.
              </span>
              <a
                href="https://zalo.me/0933799061"
                target="_blank"
                rel="noreferrer"
              >
                Nhắn Gánh
              </a>
            </p>

            <button
              type="button"
              className="review-reward-popup__continue"
              onClick={() => setStep(2)}
            >
              Tiếp tục
              <Icon name="back" size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="review-reward-popup__copy review-reward-popup__copy--guide">
              <h2>Gửi ảnh, chờ Gánh duyệt</h2>
              <p>Gánh sẽ kiểm tra và phản hồi kết quả trong 24–48 giờ.</p>
            </div>

            <div className="review-reward-popup__steps" aria-label="Ba bước nhận thưởng">
              <div>
                <span>1</span>
                <p>
                  <strong>Đánh giá trên nền tảng bạn chọn</strong>
                  <small>Đánh giá 5 sao trên app đặt món hoặc Google Maps rồi chụp lại màn hình.</small>
                </p>
              </div>
              <div>
                <span>2</span>
                <p>
                  <strong>Chọn nguồn, rồi chọn đơn hoặc chi nhánh</strong>
                  <small>App giao món chọn đúng đơn; Google Maps chọn chi nhánh đã đánh giá.</small>
                </p>
              </div>
              <div>
                <span>3</span>
                <p>
                  <strong>Tải ảnh lên và chờ duyệt</strong>
                  <small>Gánh kiểm tra ảnh và cộng 5.000 điểm sau khi duyệt.</small>
                </p>
              </div>
            </div>

            <div className="review-reward-popup__example">
              <Icon name="check" size={18} />
              <p>
                <strong>Ảnh cần nhìn rõ</strong>
                <span>Tên ứng dụng, mức 5 sao và nội dung đánh giá.</span>
              </p>
            </div>

            <button
              type="button"
              className="review-reward-popup__continue"
              onClick={handleContinue}
            >
              Chọn nguồn và tải ảnh
              <Icon name="back" size={17} />
            </button>
          </>
        )}
      </section>
    </CustomerBottomSheet>
  );

  return typeof document === "undefined" ? popup : createPortal(popup, document.body);
}
