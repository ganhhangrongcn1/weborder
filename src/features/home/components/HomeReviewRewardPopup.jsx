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
              <strong>ĐÁNH GIÁ NGAY · ĐIỂM VỀ TAY</strong>
            </div>

            <div className="review-reward-popup__copy">
              <h2>Chia sẻ cảm nhận,<br />Gánh gửi lời cảm ơn</h2>
              <p>Đơn đối tác · Google Maps</p>
            </div>

            <div className="review-reward-popup__ways" aria-label="Hai cách nhận điểm">
              <article>
                <span><Icon name="bag" size={22} /></span>
                <div>
                  <small>Đơn hàng đã mua</small>
                  <strong>Đánh giá đơn đối tác</strong>
                  <p>GrabFood · ShopeeFood · Xanh Ngon</p>
                </div>
              </article>
              <article>
                <span><Icon name="location" size={22} /></span>
                <div>
                  <small>Địa điểm đã ghé</small>
                  <strong>Đánh giá Google Maps</strong>
                  <p>Chọn chi nhánh bạn đã trải nghiệm</p>
                </div>
              </article>
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
              Bắt đầu nhận điểm
              <Icon name="back" size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="review-reward-popup__copy review-reward-popup__copy--guide">
              <h2>Gửi Ảnh Đánh Giá 5⭐, Chờ Gánh Duyệt</h2>
            </div>

            <div className="review-reward-popup__steps" aria-label="Ba bước nhận thưởng">
              <div>
                <span>1</span>
                <p>
                  <strong>Chọn cách bạn muốn đánh giá</strong>
                  <small>Chọn một đơn đối tác đã hoàn tất, hoặc chọn Google Maps để mở thẳng nơi đánh giá.</small>
                </p>
              </div>
              <div>
                <span>2</span>
                <p>
                  <strong>Đánh giá đúng đơn hoặc chi nhánh</strong>
                  <small>Đơn đối tác chọn trong khung danh sách; Google Maps chọn chi nhánh đã ghé.</small>
                </p>
              </div>
              <div>
                <span>3</span>
                <p>
                  <strong>Tải ảnh đánh giá 5⭐ lên</strong>
                  <small>Sau khi đánh giá 5⭐, hãy tải ảnh chụp màn hình lên. Gánh sẽ kiểm tra và cộng điểm sau khi duyệt.</small>
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
              Chọn đơn hoặc Google Maps
              <Icon name="back" size={17} />
            </button>
          </>
        )}
      </section>
    </CustomerBottomSheet>
  );

  return typeof document === "undefined" ? popup : createPortal(popup, document.body);
}
