import { useEffect } from "react";
import { toppings as toppingSeed } from "../../data/products.js";
import { formatMoney } from "../../utils/format.js";
import Icon from "../Icon.jsx";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";

export default function OptionModal({ product, selectedSpice, setSelectedSpice, selectedToppings, setSelectedToppings, note, setNote, quantity, setQuantity, onClose, onAdd, submitLabel, toppings = toppingSeed, optionModalText, spiceLevels, normalizeOrderOption, closeOnlyOnBackdrop, OptionGroup }) {
  const finalSubmitLabel = submitLabel || optionModalText.addToCart;
  const customOptionGroups = product.optionGroups?.length ? product.optionGroups : [];
  const usesCustomOptions = customOptionGroups.length > 0;
  const toppingTotal = selectedToppings.reduce((sum, topping) => sum + Number(topping.price || 0) * (topping.quantity || 1), 0);
  const productPrice = Number(product.price || 0);
  const originalProductPrice = Number(product.originalPrice || 0);
  const hasStrikePrice = originalProductPrice > productPrice;
  const total = (productPrice + toppingTotal) * quantity;
  const originalTotal = hasStrikePrice ? (originalProductPrice + toppingTotal) * quantity : 0;

  function getToppingQuantity(id, groupId = "") {
    return selectedToppings.find((item) => item.id === id && (groupId ? item.groupId === groupId : !item.groupId))?.quantity || 0;
  }

  useEffect(() => {
    if (!usesCustomOptions) return;
    const requiredGroups = customOptionGroups.filter((group) => group.required && (group.options || []).length > 0);
    if (!requiredGroups.length) return;

    setSelectedToppings((current) => {
      let next = [...current];
      let changed = false;

      requiredGroups.forEach((group) => {
        const hasSelected = next.some((item) => item.groupId === group.id);
        if (hasSelected) return;
        const firstOption = group.options?.[0];
        if (!firstOption) return;
        const normalized = normalizeOrderOption(group, firstOption);
        next = next.filter((item) => item.groupId !== group.id);
        next.push({ ...normalized, quantity: 1 });
        changed = true;
      });

      return changed ? next : current;
    });
  }, [usesCustomOptions, customOptionGroups, normalizeOrderOption, setSelectedToppings]);

  function changeToppingQuantity(topping, delta) {
    setSelectedToppings((current) => {
      const exists = current.find((item) => item.id === topping.id && !item.groupId);
      const nextQuantity = Math.max(0, (exists?.quantity || 0) + delta);
      if (!nextQuantity) return current.filter((item) => !(item.id === topping.id && !item.groupId));
      if (exists) return current.map((item) => item.id === topping.id && !item.groupId ? { ...item, quantity: nextQuantity } : item);
      return [...current, { ...topping, quantity: nextQuantity }];
    });
  }

  function toggleCustomOption(group, option) {
    const normalized = normalizeOrderOption(group, option);
    if (group.type === "single") {
      setSelectedSpice(group.name + ": " + option.name);
      setSelectedToppings((current) => {
        const rest = current.filter((item) => item.groupId !== group.id);
        return [...rest, { ...normalized, quantity: 1 }];
      });
      return;
    }
    changeCustomOptionQuantity(group, option, 1);
  }

  function changeCustomOptionQuantity(group, option, delta) {
    const normalized = normalizeOrderOption(group, option);
    setSelectedToppings((current) => {
      const exists = current.find((item) => item.id === option.id && item.groupId === group.id);
      const nextQuantity = Math.max(0, (exists?.quantity || 0) + delta);
      if (!nextQuantity) return current.filter((item) => !(item.id === option.id && item.groupId === group.id));
      if (exists) return current.map((item) => item.id === option.id && item.groupId === group.id ? { ...item, quantity: nextQuantity } : item);
      return [...current, { ...normalized, quantity: nextQuantity }];
    });
  }

  function isCustomOptionActive(group, option) {
    if (group.type === "single") {
      return selectedToppings.some((item) => item.groupId === group.id && item.id === option.id);
    }
    return getToppingQuantity(option.id, group.id) > 0;
  }

  function hasMissingRequiredSelection() {
    if (!usesCustomOptions) return false;
    const requiredGroups = customOptionGroups.filter((group) => group.required && (group.options || []).length > 0);
    return requiredGroups.some((group) => !selectedToppings.some((item) => item.groupId === group.id));
  }

  function handleAddToCart() {
    if (hasMissingRequiredSelection()) {
      return;
    }
    onAdd();
  }

  return (
    <CustomerBottomSheet
      ariaLabel={optionModalText.aria}
      onClose={onClose}
      closeOnBackdrop={true}
      className="option-sheet customer-option-sheet"
      contentClassName="customer-option-sheet-scroll"
      showHeader={false}
    >
        <div className="option-modal-sticky-header flex items-start gap-3">
          <img src={product.image} alt={product.name} className="h-24 w-24 rounded-[22px] object-cover shadow-soft" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="line-clamp-2 text-lg font-black leading-tight text-brown">{product.name}</h2>
              <button onClick={onClose} aria-label={optionModalText.close} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-50 text-sm font-black text-orange-600">X</button>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-brown/55">{product.short}</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {hasStrikePrice && (
                <span className="text-xs font-bold text-brown/35 line-through">
                  {formatMoney(originalProductPrice)}
                </span>
              )}
              <strong className="block text-lg font-black text-orange-600">{formatMoney(productPrice)}</strong>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {usesCustomOptions ? (
            customOptionGroups.map((group) => (
              (() => {
                const isSpiceLikeGroup = (group.required || group.type === "single") && (group.options || []).every((option) => Number(option.price || 0) === 0);
                return (
                  <OptionGroup key={group.id} title={group.name + (group.required ? " *" : "")}>
                    <p className={`option-hint ${group.required ? "option-hint-required" : "option-hint-optional"}`}>
                      {group.required ? optionModalText.requiredOne : optionModalText.optionalMany}
                    </p>
                    {isSpiceLikeGroup ? (
                      <div className="option-spice-grid">
                        {group.options.map((option) => {
                          const active = isCustomOptionActive(group, option);
                          return (
                            <button key={option.id} onClick={() => toggleCustomOption(group, option)} className={"option " + (active ? "option-active" : "")}>
                              {option.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="option-choice-grid">
                        {group.options.map((option) => {
                          const active = isCustomOptionActive(group, option);
                          const qty = getToppingQuantity(option.id, group.id);
                          return (
                            <button key={option.id} onClick={() => toggleCustomOption(group, option)} className={"modal-topping " + (active ? "modal-topping-active" : "")}>
                              <span>{option.name}</span>
                              <strong>{Number(option.price) > 0 ? "+" + formatMoney(Number(option.price)) : optionModalText.zeroDong}</strong>
                              {group.type !== "single" && !group.required && qty > 0 && (
                                <em className="modal-topping-count" onClick={(event) => event.stopPropagation()}>
                                  <b onClick={() => changeCustomOptionQuantity(group, option, -1)}>-</b>
                                  <i>{qty}</i>
                                  <b onClick={() => changeCustomOptionQuantity(group, option, 1)}>+</b>
                                </em>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </OptionGroup>
                );
              })()
            ))
          ) : null}

          <label className="block">
            <span className="label">{optionModalText.note}</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="note-input mt-3" rows="2" placeholder={optionModalText.notePlaceholder} />
          </label>

          <div className="flex items-center justify-between">
            <span className="label">{optionModalText.quantity}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="qty-btn">-</button>
              <span className="w-8 text-center font-black">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="qty-btn text-orange-600">+</button>
            </div>
          </div>

          <div className="option-modal-footer">
            <div className="flex items-center justify-between rounded-[22px] bg-orange-50 px-4 py-3">
              <span className="text-sm font-black uppercase text-brown/70">{optionModalText.subtotal}</span>
              <div className="text-right">
                {hasStrikePrice && (
                  <span className="block text-xs font-bold text-brown/35 line-through">
                    {formatMoney(originalTotal)}
                  </span>
                )}
                <strong className="text-xl font-black text-orange-600">{formatMoney(total)}</strong>
              </div>
            </div>
            <button onClick={handleAddToCart} className="cta w-full">{finalSubmitLabel}</button>
          </div>
        </div>
    </CustomerBottomSheet>
  );
}
