import Icon from "../../../components/Icon.jsx";
import { formatMoney } from "../../../utils/format.js";
import { spiceLevels } from "../../../constants/storeConfig.js";

function OptionGroup({ title, children }) {
  return (
    <div>
      <h2 className="label">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function ProductDetailModal({
  navigate,
  selectedProduct,
  selectedSpice,
  setSelectedSpice,
  selectedToppings,
  setSelectedToppings,
  quantity,
  setQuantity,
  addToCart,
  toppings
}) {
  const badgeText = String(selectedProduct?.badge || "").trim();
  const toppingTotal = selectedToppings.reduce((sum, topping) => sum + topping.price, 0);
  const total = (selectedProduct.price + toppingTotal) * quantity;

  function toggleTopping(topping) {
    setSelectedToppings((current) =>
      current.some((item) => item.id === topping.id)
        ? current.filter((item) => item.id !== topping.id)
        : [...current, topping]
    );
  }

  return (
    <section className="pb-5">
      <div className="relative">
        <img src={selectedProduct.image} alt={selectedProduct.name} className="h-72 w-full rounded-b-[34px] object-cover" />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between">
          <button onClick={() => navigate("menu", "menu")} className="float-btn">‹</button>
          <div className="flex gap-2">
            <button aria-label="Chia sẻ" className="float-btn"><Icon name="share" size={18} /></button>
            <button aria-label="Yêu thích" className="float-btn text-orange-600"><Icon name="heart" size={18} /></button>
          </div>
        </div>
        {badgeText ? (
          <span className="absolute bottom-4 left-4 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white">{badgeText}</span>
        ) : null}
      </div>

      <div className="space-y-5 px-4 pt-5">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600">Đã bán {selectedProduct.sold}</div>
          <h1 className="text-2xl font-black leading-tight text-brown">{selectedProduct.name}</h1>
          <p className="mt-2 text-sm font-semibold text-brown/60">{selectedProduct.description}</p>
          <p className="mt-3 flex items-center gap-1 text-sm font-bold text-brown/70">
            <Icon name="star" size={16} className="text-orange-500" /> {selectedProduct.rating} ({selectedProduct.reviews}) · Đã bán {selectedProduct.sold}
          </p>
        </div>

        <OptionGroup title="Chọn vị">
          {spiceLevels.map((level) => (
            <button key={level} onClick={() => setSelectedSpice(level)} className={`option ${selectedSpice === level ? "option-active" : ""}`}>
              {level}
            </button>
          ))}
        </OptionGroup>

        <OptionGroup title="Topping thêm">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {toppings.map((topping) => {
              const active = selectedToppings.some((item) => item.id === topping.id);
              return (
                <button key={topping.id} onClick={() => toggleTopping(topping)} className={`topping-card ${active ? "topping-active" : ""}`}>
                  + {topping.name}
                  <span>{formatMoney(topping.price)}</span>
                </button>
              );
            })}
          </div>
        </OptionGroup>

        <label className="block">
          <span className="label">Ghi chú</span>
          <input className="input" placeholder="Ví dụ: Không hành, ít cay,..." />
        </label>

        <div className="flex items-center justify-between">
          <span className="label">Số lượng</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="qty-btn">-</button>
            <span className="w-8 text-center font-black">{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)} className="qty-btn text-orange-600">+</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {["Freeship", "An toàn", "30-45 phút", "Đổi trả"].map((text) => (
            <div key={text} className="rounded-2xl bg-white px-2 py-3 text-center text-[11px] font-bold text-brown/65 shadow-soft">{text}</div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-[72px] z-30 mt-5 bg-gradient-to-t from-cream via-cream px-4 pt-4">
        <button onClick={() => addToCart(selectedProduct, selectedSpice, selectedToppings, quantity)} className="cta w-full">
          Thêm vào giỏ - {formatMoney(total)}
        </button>
      </div>
    </section>
  );
}
