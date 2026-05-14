import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { formatMoney } from "../../../utils/format.js";

function HomeDealTimer({ getCountdownParts, secondsLeft }) {
  return (
    <span className="home2026-timer-boxes">
      {getCountdownParts(secondsLeft).map((part, index) => (
        <em key={index}>{part}</em>
      ))}
    </span>
  );
}

function HomeFlashCard({ product, onBuy, buyText }) {
  return (
    <article className="home2026-flash-card">
      <div className="home2026-flash-image">
        <img src={product.image} alt={product.name} />
        <span>-{product.discountPercent}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3>{product.name}</h3>
        <del>{formatMoney(product.originalPrice)}</del>
        <strong>{formatMoney(product.salePrice)}</strong>
      </div>
      <button type="button" onClick={onBuy}>{buyText}</button>
    </article>
  );
}

function HomeFlashDealCard({ product, onBuy, flashSub }) {
  return (
    <article className="home2026-flash-main-card" onClick={onBuy}>
      <div className="home2026-flash-main-image">
        <img src={product.image} alt={product.name} />
      </div>
      <div className="home2026-flash-main-info">
        <h3>{product.name}</h3>
        <p>{flashSub}</p>
        <div className="home2026-flash-main-price">
          <strong>{formatMoney(product.salePrice)}</strong>
          <del>{formatMoney(product.originalPrice)}</del>
        </div>
      </div>
      <span className="home2026-flash-discount">-{product.discountPercent}%</span>
    </article>
  );
}

function FlashSaleSheet({ products, onClose, onBuy, secondsLeft, endAfter, flashTitle, buyText, closeText, getCountdownParts, formatCountdown }) {
  return (
    <CustomerBottomSheet
      ariaLabel={flashTitle}
      onClose={onClose}
      className="home2026-flash-sheet customer-flash-sheet"
      contentClassName="customer-flash-sheet-scroll"
      showHeader={false}
    >
      <div className="home2026-flash-sheet-head">
        <div>
          <p>{endAfter}</p>
          <h2>{flashTitle}</h2>
        </div>
        <span>{formatCountdown(secondsLeft)}</span>
        <button type="button" onClick={onClose} aria-label={closeText}>
          <Icon name="back" size={18} />
        </button>
      </div>
      <div className="home2026-flash-sheet-list">
        {products.map((product) => (
          <HomeFlashCard key={product.id} product={product} onBuy={() => onBuy(product)} buyText={buyText} getCountdownParts={getCountdownParts} />
        ))}
      </div>
    </CustomerBottomSheet>
  );
}

export default function HomeFlashSale({
  dealTitle,
  endAfter,
  viewAll,
  flashTitle,
  flashSub,
  buyText,
  closeText,
  secondsLeft,
  setFlashModalOpen,
  mainFlashProduct,
  openOptionModal,
  flashModalOpen,
  flashProducts,
  getCountdownParts,
  formatCountdown
}) {
  const canViewAll = Array.isArray(flashProducts) && flashProducts.length > 1;

  return (
    <>
      <section className="home2026-section home2026-flash-deal">
        <div className="home2026-deal-head">
          <h2>{dealTitle}</h2>
          <div className="home2026-deal-timer">
            <span>{endAfter}</span>
            <HomeDealTimer getCountdownParts={getCountdownParts} secondsLeft={secondsLeft} />
          </div>
          {canViewAll && (
            <button type="button" onClick={() => setFlashModalOpen(true)}>{viewAll}</button>
          )}
        </div>
        {mainFlashProduct && <HomeFlashDealCard product={mainFlashProduct} onBuy={() => openOptionModal(mainFlashProduct)} flashSub={flashSub} />}
      </section>

      {canViewAll && flashModalOpen && (
        <FlashSaleSheet
          products={flashProducts}
          onClose={() => setFlashModalOpen(false)}
          onBuy={(product) => {
            setFlashModalOpen(false);
            openOptionModal(product);
          }}
          secondsLeft={secondsLeft}
          endAfter={endAfter}
          flashTitle={flashTitle}
          buyText={buyText}
          closeText={closeText}
          getCountdownParts={getCountdownParts}
          formatCountdown={formatCountdown}
        />
      )}
    </>
  );
}
