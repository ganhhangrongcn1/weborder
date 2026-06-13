import { useState } from "react";
import { formatMoney, toNumber } from "./posHelpers.js";

export default function ProductOptionsModal({ product, onClose, onSubmit }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});

  if (!product) return null;

  const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
  const selectedList = groups
    .map((group) => {
      const option = (group.options || []).find((item) => item.id === selectedOptions[group.id]);
      if (!option) return null;
      return {
        ...option,
        groupId: group.id,
        groupName: group.name
      };
    })
    .filter(Boolean);

  const optionTotal = selectedList.reduce((sum, option) => sum + toNumber(option.price, 0), 0);
  const total = (toNumber(product.price, 0) + optionTotal) * quantity;

  return (
    <div className="pos-modal-layer" role="presentation">
      <button type="button" className="pos-modal-backdrop" aria-label="Đóng tùy chọn món" onClick={onClose} />
      <section className="pos-product-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>Tùy chọn món</span>
            <strong>{product.name}</strong>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>
        <div className="pos-option-scroll">
          {groups.map((group) => (
            <section key={group.id} className="pos-option-group">
              <div>
                <strong>{group.name}</strong>
                {group.required ? <span>Bắt buộc</span> : <span>Không bắt buộc</span>}
              </div>
              <div className="pos-option-grid">
                {(group.options || []).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={selectedOptions[group.id] === option.id ? "is-active" : ""}
                    onClick={() => setSelectedOptions((current) => ({ ...current, [group.id]: option.id }))}
                  >
                    <strong>{option.name}</strong>
                    {option.price > 0 ? <small>+{formatMoney(option.price)}</small> : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <label className="pos-option-note">
            <span>Ghi chú món</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: ít sốt, không rau răm..." />
          </label>
          <div className="pos-option-qty">
            <span>Số lượng</span>
            <div>
              <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>-</button>
              <strong>{quantity}</strong>
              <button type="button" onClick={() => setQuantity((current) => current + 1)}>+</button>
            </div>
          </div>
        </div>
        <button type="button" className="pos-modal-primary" onClick={() => onSubmit(product, { quantity, note, selectedOptions: selectedList })}>
          Thêm vào bill - {formatMoney(total)}
        </button>
      </section>
    </div>
  );
}
