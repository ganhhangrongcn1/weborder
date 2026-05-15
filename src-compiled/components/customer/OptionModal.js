import { useEffect } from "react";
import { toppings as toppingSeed } from "../../data/products.js";
import { formatMoney } from "../../utils/format.js";
import Icon from "../Icon.js";
import CustomerBottomSheet from "./CustomerBottomSheet.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function OptionModal({
  product,
  selectedSpice,
  setSelectedSpice,
  selectedToppings,
  setSelectedToppings,
  note,
  setNote,
  quantity,
  setQuantity,
  onClose,
  onAdd,
  submitLabel,
  toppings = toppingSeed,
  optionModalText,
  spiceLevels,
  normalizeOrderOption,
  closeOnlyOnBackdrop,
  OptionGroup
}) {
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
    return selectedToppings.find(item => item.id === id && (groupId ? item.groupId === groupId : !item.groupId))?.quantity || 0;
  }
  useEffect(() => {
    if (!usesCustomOptions) return;
    const requiredGroups = customOptionGroups.filter(group => group.required && (group.options || []).length > 0);
    if (!requiredGroups.length) return;
    setSelectedToppings(current => {
      let next = [...current];
      let changed = false;
      requiredGroups.forEach(group => {
        const hasSelected = next.some(item => item.groupId === group.id);
        if (hasSelected) return;
        const firstOption = group.options?.[0];
        if (!firstOption) return;
        const normalized = normalizeOrderOption(group, firstOption);
        next = next.filter(item => item.groupId !== group.id);
        next.push({
          ...normalized,
          quantity: 1
        });
        changed = true;
      });
      return changed ? next : current;
    });
  }, [usesCustomOptions, customOptionGroups, normalizeOrderOption, setSelectedToppings]);
  function changeToppingQuantity(topping, delta) {
    setSelectedToppings(current => {
      const exists = current.find(item => item.id === topping.id && !item.groupId);
      const nextQuantity = Math.max(0, (exists?.quantity || 0) + delta);
      if (!nextQuantity) return current.filter(item => !(item.id === topping.id && !item.groupId));
      if (exists) return current.map(item => item.id === topping.id && !item.groupId ? {
        ...item,
        quantity: nextQuantity
      } : item);
      return [...current, {
        ...topping,
        quantity: nextQuantity
      }];
    });
  }
  function toggleCustomOption(group, option) {
    const normalized = normalizeOrderOption(group, option);
    if (group.type === "single") {
      setSelectedSpice(group.name + ": " + option.name);
      setSelectedToppings(current => {
        const rest = current.filter(item => item.groupId !== group.id);
        return [...rest, {
          ...normalized,
          quantity: 1
        }];
      });
      return;
    }
    changeCustomOptionQuantity(group, option, 1);
  }
  function changeCustomOptionQuantity(group, option, delta) {
    const normalized = normalizeOrderOption(group, option);
    setSelectedToppings(current => {
      const exists = current.find(item => item.id === option.id && item.groupId === group.id);
      const nextQuantity = Math.max(0, (exists?.quantity || 0) + delta);
      if (!nextQuantity) return current.filter(item => !(item.id === option.id && item.groupId === group.id));
      if (exists) return current.map(item => item.id === option.id && item.groupId === group.id ? {
        ...item,
        quantity: nextQuantity
      } : item);
      return [...current, {
        ...normalized,
        quantity: nextQuantity
      }];
    });
  }
  function isCustomOptionActive(group, option) {
    if (group.type === "single") {
      return selectedToppings.some(item => item.groupId === group.id && item.id === option.id);
    }
    return getToppingQuantity(option.id, group.id) > 0;
  }
  function hasMissingRequiredSelection() {
    if (!usesCustomOptions) return false;
    const requiredGroups = customOptionGroups.filter(group => group.required && (group.options || []).length > 0);
    return requiredGroups.some(group => !selectedToppings.some(item => item.groupId === group.id));
  }
  function handleAddToCart() {
    if (hasMissingRequiredSelection()) {
      return;
    }
    onAdd();
  }
  return /*#__PURE__*/_jsxs(CustomerBottomSheet, {
    ariaLabel: optionModalText.aria,
    onClose: onClose,
    closeOnBackdrop: true,
    className: "option-sheet customer-option-sheet",
    contentClassName: "customer-option-sheet-scroll",
    showHeader: false,
    children: [/*#__PURE__*/_jsxs("div", {
      className: "option-modal-sticky-header flex items-start gap-3",
      children: [/*#__PURE__*/_jsx("img", {
        src: product.image,
        alt: product.name,
        className: "h-24 w-24 rounded-[22px] object-cover shadow-soft"
      }), /*#__PURE__*/_jsxs("div", {
        className: "min-w-0 flex-1",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex items-start justify-between gap-2",
          children: [/*#__PURE__*/_jsx("h2", {
            className: "line-clamp-2 text-lg font-black leading-tight text-brown",
            children: product.name
          }), /*#__PURE__*/_jsx("button", {
            onClick: onClose,
            "aria-label": optionModalText.close,
            className: "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-50 text-sm font-black text-orange-600",
            children: "X"
          })]
        }), /*#__PURE__*/_jsx("p", {
          className: "mt-1 line-clamp-2 text-xs font-semibold leading-5 text-brown/55",
          children: product.short
        }), /*#__PURE__*/_jsxs("div", {
          className: "mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1",
          children: [hasStrikePrice && /*#__PURE__*/_jsx("span", {
            className: "text-xs font-bold text-brown/35 line-through",
            children: formatMoney(originalProductPrice)
          }), /*#__PURE__*/_jsx("strong", {
            className: "block text-lg font-black text-orange-600",
            children: formatMoney(productPrice)
          })]
        })]
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "mt-5 space-y-5",
      children: [usesCustomOptions ? customOptionGroups.map(group => (() => {
        const isSpiceLikeGroup = (group.required || group.type === "single") && (group.options || []).every(option => Number(option.price || 0) === 0);
        return /*#__PURE__*/_jsxs(OptionGroup, {
          title: group.name + (group.required ? " *" : ""),
          children: [/*#__PURE__*/_jsx("p", {
            className: `option-hint ${group.required ? "option-hint-required" : "option-hint-optional"}`,
            children: group.required ? optionModalText.requiredOne : optionModalText.optionalMany
          }), isSpiceLikeGroup ? /*#__PURE__*/_jsx("div", {
            className: "option-spice-grid",
            children: group.options.map(option => {
              const active = isCustomOptionActive(group, option);
              return /*#__PURE__*/_jsx("button", {
                onClick: () => toggleCustomOption(group, option),
                className: "option " + (active ? "option-active" : ""),
                children: option.name
              }, option.id);
            })
          }) : /*#__PURE__*/_jsx("div", {
            className: "option-choice-grid",
            children: group.options.map(option => {
              const active = isCustomOptionActive(group, option);
              const qty = getToppingQuantity(option.id, group.id);
              return /*#__PURE__*/_jsxs("button", {
                onClick: () => toggleCustomOption(group, option),
                className: "modal-topping " + (active ? "modal-topping-active" : ""),
                children: [/*#__PURE__*/_jsx("span", {
                  children: option.name
                }), /*#__PURE__*/_jsx("strong", {
                  children: Number(option.price) > 0 ? "+" + formatMoney(Number(option.price)) : optionModalText.zeroDong
                }), group.type !== "single" && !group.required && qty > 0 && /*#__PURE__*/_jsxs("em", {
                  className: "modal-topping-count",
                  onClick: event => event.stopPropagation(),
                  children: [/*#__PURE__*/_jsx("b", {
                    onClick: () => changeCustomOptionQuantity(group, option, -1),
                    children: "-"
                  }), /*#__PURE__*/_jsx("i", {
                    children: qty
                  }), /*#__PURE__*/_jsx("b", {
                    onClick: () => changeCustomOptionQuantity(group, option, 1),
                    children: "+"
                  })]
                })]
              }, option.id);
            })
          })]
        }, group.id);
      })()) : /*#__PURE__*/_jsxs(_Fragment, {
        children: [/*#__PURE__*/_jsxs(OptionGroup, {
          title: optionModalText.spiceTitle,
          children: [/*#__PURE__*/_jsx("p", {
            className: "option-hint option-hint-required",
            children: optionModalText.requiredSpice
          }), /*#__PURE__*/_jsx("div", {
            className: "option-spice-grid",
            children: spiceLevels.map(level => /*#__PURE__*/_jsx("button", {
              onClick: () => setSelectedSpice(level),
              className: "option " + (selectedSpice === level ? "option-active" : ""),
              children: level
            }, level))
          })]
        }), /*#__PURE__*/_jsxs(OptionGroup, {
          title: optionModalText.toppingTitle,
          children: [/*#__PURE__*/_jsx("p", {
            className: "option-hint option-hint-optional",
            children: optionModalText.optionalTopping
          }), /*#__PURE__*/_jsx("div", {
            className: "option-choice-grid",
            children: toppings.map(topping => {
              const qty = getToppingQuantity(topping.id);
              const active = qty > 0;
              return /*#__PURE__*/_jsxs("button", {
                onClick: () => changeToppingQuantity(topping, 1),
                className: "modal-topping " + (active ? "modal-topping-active" : ""),
                children: [/*#__PURE__*/_jsx("span", {
                  children: topping.name
                }), /*#__PURE__*/_jsxs("strong", {
                  children: ["+", formatMoney(topping.price)]
                }), qty > 0 && /*#__PURE__*/_jsxs("em", {
                  className: "modal-topping-count",
                  onClick: event => event.stopPropagation(),
                  children: [/*#__PURE__*/_jsx("b", {
                    onClick: () => changeToppingQuantity(topping, -1),
                    children: "-"
                  }), /*#__PURE__*/_jsx("i", {
                    children: qty
                  }), /*#__PURE__*/_jsx("b", {
                    onClick: () => changeToppingQuantity(topping, 1),
                    children: "+"
                  })]
                })]
              }, topping.id);
            })
          })]
        })]
      }), /*#__PURE__*/_jsxs("label", {
        className: "block",
        children: [/*#__PURE__*/_jsx("span", {
          className: "label",
          children: optionModalText.note
        }), /*#__PURE__*/_jsx("textarea", {
          value: note,
          onChange: event => setNote(event.target.value),
          className: "note-input mt-3",
          rows: "2",
          placeholder: optionModalText.notePlaceholder
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "flex items-center justify-between",
        children: [/*#__PURE__*/_jsx("span", {
          className: "label",
          children: optionModalText.quantity
        }), /*#__PURE__*/_jsxs("div", {
          className: "flex items-center gap-3",
          children: [/*#__PURE__*/_jsx("button", {
            onClick: () => setQuantity(Math.max(1, quantity - 1)),
            className: "qty-btn",
            children: "-"
          }), /*#__PURE__*/_jsx("span", {
            className: "w-8 text-center font-black",
            children: quantity
          }), /*#__PURE__*/_jsx("button", {
            onClick: () => setQuantity(quantity + 1),
            className: "qty-btn text-orange-600",
            children: "+"
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "option-modal-footer",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex items-center justify-between rounded-[22px] bg-orange-50 px-4 py-3",
          children: [/*#__PURE__*/_jsx("span", {
            className: "text-sm font-black uppercase text-brown/70",
            children: optionModalText.subtotal
          }), /*#__PURE__*/_jsxs("div", {
            className: "text-right",
            children: [hasStrikePrice && /*#__PURE__*/_jsx("span", {
              className: "block text-xs font-bold text-brown/35 line-through",
              children: formatMoney(originalTotal)
            }), /*#__PURE__*/_jsx("strong", {
              className: "text-xl font-black text-orange-600",
              children: formatMoney(total)
            })]
          })]
        }), /*#__PURE__*/_jsx("button", {
          onClick: handleAddToCart,
          className: "cta w-full",
          children: finalSubmitLabel
        })]
      })]
    })]
  });
}