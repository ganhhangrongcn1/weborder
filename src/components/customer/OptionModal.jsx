import { useEffect } from "react";
import { toppings as toppingSeed } from "../../data/products.js";
import { formatMoney } from "../../utils/format.js";
import { getDefaultOrderChoices, getRequiredExactAllOptions } from "../../utils/pureHelpers.js";
import Icon from "../Icon.jsx";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";

function getOptionGroupTitle(groupName) {
  const normalizedName = String(groupName || "").trim();
  const lowercaseName = normalizedName.toLocaleLowerCase("vi");

  if (lowercaseName.includes("độ cay") || lowercaseName.includes("chọn vị")) return "Chọn độ cay";
  if (lowercaseName.includes("ngon hơn khi ăn cùng")) return "Ăn kèm cho ngon";
  return normalizedName;
}

export default function OptionModal({ product, selectedSpice, setSelectedSpice, selectedToppings, setSelectedToppings, note, setNote, quantity, setQuantity, onClose, onAdd, submitLabel, toppings = toppingSeed, optionModalText, spiceLevels, normalizeOrderOption, OptionGroup }) {
  const finalSubmitLabel = submitLabel || optionModalText.addToCart;
  const customOptionGroups = product.optionGroups?.length ? product.optionGroups : [];
  const usesCustomOptions = customOptionGroups.length > 0;
  const requiredExactAllOptions = getRequiredExactAllOptions(product);
  const effectiveToppingMap = new Map();
  [...selectedToppings, ...requiredExactAllOptions].forEach((item) => {
    effectiveToppingMap.set(`${item.groupId || ""}:${item.id || ""}`, item);
  });
  const effectiveSelectedToppings = Array.from(effectiveToppingMap.values());
  const toppingTotal = effectiveSelectedToppings.reduce((sum, topping) => sum + Number(topping.price || 0) * (topping.quantity || 1), 0);
  const productPrice = Number(product.price || 0);
  const originalProductPrice = Number(product.originalPrice || 0);
  const hasStrikePrice = originalProductPrice > productPrice;
  const total = (productPrice + toppingTotal) * quantity;
  const originalTotal = hasStrikePrice ? (originalProductPrice + toppingTotal) * quantity : 0;

  function getToppingQuantity(id, groupId = "") {
    return effectiveSelectedToppings.find((item) => item.id === id && (groupId ? item.groupId === groupId : !item.groupId))?.quantity || 0;
  }

  function mustSelectEveryOption(group) {
    const options = Array.isArray(group?.options) ? group.options : [];
    const exactCount = Math.min(options.length, Math.max(1, Number(group?.maxSelect || 1)));
    return group?.required === true && group?.selectionMode === "exact" && options.length > 0 && exactCount === options.length;
  }

  useEffect(() => {
    if (!usesCustomOptions) return;
    const requiredGroups = customOptionGroups.filter((group) => group.required && (group.options || []).length > 0);
    if (!requiredGroups.length) return;
    const defaultOptions = getDefaultOrderChoices(product).toppings;

    setSelectedToppings((current) => {
      let next = [...current];
      let changed = false;

      requiredGroups.forEach((group) => {
        const groupDefaults = defaultOptions.filter((item) => item.groupId === group.id);
        if (groupDefaults.length > 0) {
          const hasEveryDefault = groupDefaults.every((defaultItem) =>
            next.some((item) => item.groupId === group.id && item.id === defaultItem.id)
          );
          if (hasEveryDefault) return;

          next = [
            ...next.filter((item) => item.groupId !== group.id),
            ...groupDefaults.map((item) => ({ ...item, quantity: 1 }))
          ];
          changed = true;
          return;
        }

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
  }, [product, usesCustomOptions, customOptionGroups, normalizeOrderOption, setSelectedToppings]);

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
    if (mustSelectEveryOption(group)) return;
    const normalized = normalizeOrderOption(group, option);
    if (group.type === "single") {
      setSelectedSpice(group.name + ": " + option.name);
      setSelectedToppings((current) => {
        const rest = current.filter((item) => item.groupId !== group.id);
        return [...rest, { ...normalized, quantity: 1 }];
      });
      return;
    }
    const isActive = isCustomOptionActive(group, option);
    const selectedCount = effectiveSelectedToppings.filter((item) => item.groupId === group.id).length;
    const maxSelect = Math.min((group.options || []).length, Math.max(1, Number(group.maxSelect || 1)));
    if (!isActive && selectedCount >= maxSelect) return;
    changeCustomOptionQuantity(group, option, isActive ? -getToppingQuantity(option.id, group.id) : 1);
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
    if (mustSelectEveryOption(group)) return true;
    if (group.type === "single") {
      return effectiveSelectedToppings.some((item) => item.groupId === group.id && item.id === option.id);
    }
    return getToppingQuantity(option.id, group.id) > 0;
  }

  function hasMissingRequiredSelection() {
    if (!usesCustomOptions) return false;
    const requiredGroups = customOptionGroups.filter((group) => group.required && (group.options || []).length > 0);
    return requiredGroups.some((group) => {
      const selectedCount = effectiveSelectedToppings.filter((item) => item.groupId === group.id).length;
      if (group.selectionMode === "exact") {
        const exactCount = Math.min((group.options || []).length, Math.max(1, Number(group.maxSelect || 1)));
        return selectedCount !== exactCount;
      }
      return selectedCount < 1;
    });
  }

  function handleAddToCart() {
    if (hasMissingRequiredSelection()) {
      return;
    }
    onAdd(effectiveSelectedToppings);
  }

  return (
    <CustomerBottomSheet
      ariaLabel={optionModalText.aria}
      onClose={onClose}
      closeOnBackdrop={false}
      className="option-sheet customer-option-sheet"
      contentClassName="customer-option-sheet-scroll"
      footer={(
        <div className="option-modal-footer">
          <button type="button" onClick={handleAddToCart} className="cta option-modal-submit" disabled={hasMissingRequiredSelection()}>
            <span>{finalSubmitLabel}</span>
            <span className="option-modal-submit__summary">
              {hasStrikePrice && (
                <del>
                  {formatMoney(originalTotal)}
                </del>
              )}
              <strong>{quantity} món · {formatMoney(total)}</strong>
            </span>
          </button>
        </div>
      )}
      showHeader={false}
    >
        <div className="option-modal-sticky-header flex items-start gap-3">
          <img src={product.image} alt={product.name} width="96" height="96" className="h-24 w-24 rounded-[22px] object-cover shadow-soft" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="customer-modal-title line-clamp-2 text-brown">{product.name}</h2>
              <button type="button" onClick={onClose} aria-label={optionModalText.close} className="option-modal-close">
                <Icon name="close" size={18} />
              </button>
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
                const groupTitle = getOptionGroupTitle(group.name);
                return (
                  <OptionGroup
                    key={group.id}
                    title={groupTitle}
                    badge={group.required && group.selectionMode === "exact"
                      ? `Bắt buộc chọn đủ ${Math.min((group.options || []).length, Math.max(1, Number(group.maxSelect || 1)))}`
                      : group.required ? optionModalText.requiredOne : optionModalText.optionalMany}
                  >
                    {isSpiceLikeGroup ? (
                      <div className="option-spice-grid" role="radiogroup" aria-label={groupTitle}>
                        {group.options.map((option) => {
                          const active = isCustomOptionActive(group, option);
                          return (
                            <button
                              type="button"
                              key={option.id}
                              role="radio"
                              aria-checked={active}
                              onClick={() => toggleCustomOption(group, option)}
                              className={"option " + (active ? "option-active" : "")}
                            >
                              <span>{option.name}</span>
                              {active ? <Icon name="check" size={14} /> : null}
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
                            <div key={option.id} className={"modal-topping " + (active ? "modal-topping-active is-active" : "")}>
                              <button
                                type="button"
                                onClick={() => toggleCustomOption(group, option)}
                                className="modal-topping__select"
                                aria-pressed={active}
                                aria-label={`${active ? "Bỏ chọn" : "Chọn"} ${option.name}`}
                              >
                                <span className="modal-topping__copy">
                                  <span>{option.name}</span>
                                  <strong>{Number(option.price) > 0 ? "+" + formatMoney(Number(option.price)) : optionModalText.zeroDong}</strong>
                                </span>
                                <span className="modal-topping__indicator">
                                  <Icon name={active ? "check" : "plus"} size={15} />
                                </span>
                              </button>
                              {group.type !== "single" && !group.required && qty > 0 && (
                                <div className="modal-topping-count" aria-label={`Số lượng ${option.name}: ${qty}`}>
                                  <button type="button" onClick={() => changeCustomOptionQuantity(group, option, -1)} aria-label={`Giảm ${option.name}`}>
                                    <Icon name="minus" size={13} />
                                  </button>
                                  <output aria-live="polite">{qty}</output>
                                  <button type="button" onClick={() => changeCustomOptionQuantity(group, option, 1)} aria-label={`Tăng ${option.name}`}>
                                    <Icon name="plus" size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
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
            <textarea name="item-note" autoComplete="off" value={note} onChange={(event) => setNote(event.target.value)} className="note-input mt-3" rows="2" placeholder={optionModalText.notePlaceholder} />
          </label>

          <div className="flex items-center justify-between">
            <span className="label">{optionModalText.quantity}</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="qty-btn" aria-label="Giảm số lượng" disabled={quantity <= 1}>
                <Icon name="minus" size={15} />
              </button>
              <output className="w-8 text-center font-black" aria-live="polite" aria-label={`Số lượng ${quantity}`}>{quantity}</output>
              <button type="button" onClick={() => setQuantity(quantity + 1)} className="qty-btn text-orange-600" aria-label="Tăng số lượng">
                <Icon name="plus" size={15} />
              </button>
            </div>
          </div>

        </div>
    </CustomerBottomSheet>
  );
}
