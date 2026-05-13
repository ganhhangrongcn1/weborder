import { APPLY_SCOPE_OPTIONS, DISCOUNT_TYPE_OPTIONS, MIN_DISCOUNT_TO_SHOW_OPTIONS, ROUND_MODE_OPTIONS, formatDateShort, formatMoney, getStrikeStatus, toIdList, toggleCsvId } from "./promotionTabUtils.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function StrikePriceTab({
  strikePromos,
  selectedStrikePromo,
  setSelectedStrikePromoId,
  createPromotion,
  preview,
  updatePromotion,
  activeCategories,
  activeProducts,
  setSmartPromotions,
  smartPromotions
}) {
  return strikePromos.length ? /*#__PURE__*/_jsxs("div", {
    className: "admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]",
    children: [/*#__PURE__*/_jsxs("aside", {
      className: "admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "mb-3 flex items-center justify-between",
        children: [/*#__PURE__*/_jsx("strong", {
          className: "text-sm font-black text-slate-800",
          children: "Danh s\xE1ch g\u1EA1ch gi\xE1"
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          className: "admin-cta",
          onClick: () => createPromotion("strike_price"),
          children: "+ T\u1EA1o m\u1EDBi"
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "max-h-[68vh] space-y-2 overflow-y-auto pr-1",
        children: strikePromos.map(promo => {
          const status = getStrikeStatus(promo);
          const isSelected = selectedStrikePromo?.id === promo.id;
          return /*#__PURE__*/_jsxs("button", {
            type: "button",
            onClick: () => setSelectedStrikePromoId(promo.id),
            className: `w-full rounded-[14px] border bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995] ${isSelected ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-200"}`,
            children: [/*#__PURE__*/_jsxs("div", {
              className: "mb-2 flex items-start justify-between gap-2",
              children: [/*#__PURE__*/_jsx("strong", {
                className: "text-sm font-black text-slate-900",
                children: promo.title || promo.name || "Gạch giá món ăn"
              }), /*#__PURE__*/_jsx("span", {
                className: `rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`,
                children: status.label
              })]
            }), /*#__PURE__*/_jsx("p", {
              className: "text-xl font-black text-orange-600",
              children: promo.reward.type === "percent_discount" ? `-${Number(promo.reward.value || 0)}%` : `-${formatMoney(promo.reward.value || 0)}`
            }), /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-xs text-slate-700",
              children: promo.condition.applyScope === "all" ? "Toàn menu" : promo.condition.applyScope === "category" ? "Theo danh mục" : "Theo món cụ thể"
            }), /*#__PURE__*/_jsxs("p", {
              className: "mt-1 text-[11px] text-slate-500",
              children: [formatDateShort(promo.startAt), " \u2192 ", formatDateShort(promo.endAt)]
            })]
          }, promo.id);
        })
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
      children: selectedStrikePromo ? /*#__PURE__*/_jsxs(_Fragment, {
        children: [/*#__PURE__*/_jsxs("div", {
          className: `mb-4 rounded-[14px] border border-orange-200 bg-orange-50 px-4 py-3 ${selectedStrikePromo.active ? "opacity-100" : "opacity-60"}`,
          children: [/*#__PURE__*/_jsxs("p", {
            className: "text-2xl font-black text-orange-600",
            children: ["\uD83D\uDD25 ", selectedStrikePromo.reward.type === "percent_discount" ? `GIẢM ${Number(selectedStrikePromo.reward.value || 0)}%` : `GIẢM ${formatMoney(selectedStrikePromo.reward.value || 0)}`]
          }), /*#__PURE__*/_jsxs("p", {
            className: "mt-1 text-sm font-semibold text-slate-700",
            children: [formatMoney(preview?.originalPrice || 0), " \u2192 ", formatMoney(preview?.finalPrice || 0), /*#__PURE__*/_jsxs("span", {
              className: "ml-2 text-orange-600",
              children: ["(-", Math.round(preview?.percentDiscount || 0), "%)"]
            })]
          }), /*#__PURE__*/_jsxs("p", {
            className: "mt-1 text-xs text-slate-500",
            children: ["\xC1p d\u1EE5ng cho ph\u1EA1m vi \u0111\xE3 ch\u1ECDn \xB7 H\u1EBFt h\u1EA1n: ", formatDateShort(selectedStrikePromo.endAt)]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "space-y-4",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "1. Gi\u1EA3m bao nhi\xEAu?"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-2",
              children: [/*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Ki\u1EC3u gi\u1EA3m", /*#__PURE__*/_jsx("select", {
                  className: "admin-input mt-1",
                  value: selectedStrikePromo.reward.type,
                  onChange: event => updatePromotion(selectedStrikePromo.id, {
                    reward: {
                      ...selectedStrikePromo.reward,
                      type: event.target.value
                    }
                  }),
                  children: DISCOUNT_TYPE_OPTIONS.map(item => /*#__PURE__*/_jsx("option", {
                    value: item.value,
                    children: item.label
                  }, item.value))
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Gi\xE1 tr\u1ECB gi\u1EA3m", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "number",
                  min: "0",
                  value: Number(selectedStrikePromo.reward.value || 0),
                  onChange: event => updatePromotion(selectedStrikePromo.id, {
                    reward: {
                      ...selectedStrikePromo.reward,
                      value: Number(event.target.value || 0)
                    }
                  })
                })]
              })]
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "2. \xC1p d\u1EE5ng cho m\xF3n n\xE0o?"
            }), (() => {
              const selectedScope = selectedStrikePromo.condition.applyScope || "all";
              const selectedCategoryIds = toIdList(selectedStrikePromo.condition.categoryIds || "");
              const selectedProductIds = toIdList(selectedStrikePromo.condition.productIds || "");
              return /*#__PURE__*/_jsxs("div", {
                className: "grid grid-cols-1 gap-3 md:grid-cols-2",
                children: [/*#__PURE__*/_jsxs("label", {
                  className: "text-[12px] font-semibold text-slate-500 md:col-span-2",
                  children: ["\xC1p d\u1EE5ng cho", /*#__PURE__*/_jsx("select", {
                    className: "admin-input mt-1",
                    value: selectedScope,
                    onChange: event => updatePromotion(selectedStrikePromo.id, {
                      condition: {
                        ...selectedStrikePromo.condition,
                        applyScope: event.target.value
                      }
                    }),
                    children: APPLY_SCOPE_OPTIONS.map(item => /*#__PURE__*/_jsx("option", {
                      value: item.value,
                      children: item.label
                    }, item.value))
                  })]
                }), selectedScope === "category" ? /*#__PURE__*/_jsxs("div", {
                  className: "md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3",
                  children: [/*#__PURE__*/_jsx("p", {
                    className: "mb-2 text-[12px] font-semibold text-slate-600",
                    children: "Ch\u1ECDn danh m\u1EE5c \xE1p d\u1EE5ng"
                  }), /*#__PURE__*/_jsx("div", {
                    className: "grid grid-cols-1 gap-2 md:grid-cols-2",
                    children: activeCategories.map(categoryName => {
                      const checked = selectedCategoryIds.includes(categoryName);
                      return /*#__PURE__*/_jsxs("label", {
                        className: "flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700",
                        children: [/*#__PURE__*/_jsx("input", {
                          type: "checkbox",
                          checked: checked,
                          onChange: () => updatePromotion(selectedStrikePromo.id, {
                            condition: {
                              ...selectedStrikePromo.condition,
                              categoryIds: toggleCsvId(selectedStrikePromo.condition.categoryIds || "", categoryName)
                            }
                          })
                        }), /*#__PURE__*/_jsx("span", {
                          children: categoryName
                        })]
                      }, categoryName);
                    })
                  })]
                }) : null, selectedScope === "product" ? /*#__PURE__*/_jsxs("div", {
                  className: "md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3",
                  children: [/*#__PURE__*/_jsx("p", {
                    className: "mb-2 text-[12px] font-semibold text-slate-600",
                    children: "Ch\u1ECDn m\xF3n \xE1p d\u1EE5ng"
                  }), /*#__PURE__*/_jsx("div", {
                    className: "max-h-56 space-y-2 overflow-y-auto pr-1",
                    children: activeProducts.map(product => {
                      const checked = selectedProductIds.includes(product.id);
                      return /*#__PURE__*/_jsxs("label", {
                        className: "flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700",
                        children: [/*#__PURE__*/_jsx("input", {
                          type: "checkbox",
                          checked: checked,
                          onChange: () => updatePromotion(selectedStrikePromo.id, {
                            condition: {
                              ...selectedStrikePromo.condition,
                              productIds: toggleCsvId(selectedStrikePromo.condition.productIds || "", product.id)
                            }
                          })
                        }), /*#__PURE__*/_jsx("span", {
                          className: "flex-1",
                          children: product.name
                        })]
                      }, product.id);
                    })
                  })]
                }) : null, selectedScope === "all" ? /*#__PURE__*/_jsx("div", {
                  className: "md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500",
                  children: "\u0110ang \xE1p d\u1EE5ng to\xE0n b\u1ED9 menu."
                }) : null]
              });
            })()]
          }), /*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "3. Ch\u1EA1y khi n\xE0o?"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-3",
              children: [/*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Ng\xE0y b\u1EAFt \u0111\u1EA7u", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "date",
                  value: selectedStrikePromo.startAt || "",
                  onChange: event => updatePromotion(selectedStrikePromo.id, {
                    startAt: event.target.value
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Ng\xE0y k\u1EBFt th\xFAc", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "date",
                  value: selectedStrikePromo.endAt || "",
                  onChange: event => updatePromotion(selectedStrikePromo.id, {
                    endAt: event.target.value
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["B\u1EADt ch\u01B0\u01A1ng tr\xECnh", /*#__PURE__*/_jsx("div", {
                  className: "mt-2",
                  children: /*#__PURE__*/_jsxs("label", {
                    className: "admin-switch",
                    children: [/*#__PURE__*/_jsx("input", {
                      type: "checkbox",
                      checked: Boolean(selectedStrikePromo.active),
                      onChange: event => updatePromotion(selectedStrikePromo.id, {
                        active: event.target.checked
                      })
                    }), /*#__PURE__*/_jsx("span", {})]
                  })
                })]
              })]
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "4. T\xEAn hi\u1EC3n th\u1ECB"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-2",
              children: [/*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["T\xEAn ch\u01B0\u01A1ng tr\xECnh", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  value: selectedStrikePromo.title || "",
                  onChange: event => updatePromotion(selectedStrikePromo.id, {
                    title: event.target.value
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["T\xEAn n\u1ED9i b\u1ED9", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  value: selectedStrikePromo.name || "",
                  onChange: event => updatePromotion(selectedStrikePromo.id, {
                    name: event.target.value
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500 md:col-span-2",
                children: ["M\xF4 t\u1EA3 ng\u1EAFn", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  value: selectedStrikePromo.text || "",
                  onChange: event => updatePromotion(selectedStrikePromo.id, {
                    text: event.target.value
                  })
                })]
              })]
            })]
          }), /*#__PURE__*/_jsxs("details", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("summary", {
              className: "cursor-pointer text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "T\xF9y ch\u1ECDn n\xE2ng cao"
            }), /*#__PURE__*/_jsxs("div", {
              className: "mt-4 space-y-4",
              children: [/*#__PURE__*/_jsxs("div", {
                className: "grid grid-cols-1 gap-3 md:grid-cols-3",
                children: [/*#__PURE__*/_jsxs("label", {
                  className: "text-[12px] font-semibold text-slate-500",
                  children: ["L\xE0m tr\xF2n gi\xE1 sau gi\u1EA3m", /*#__PURE__*/_jsx("select", {
                    className: "admin-input mt-1",
                    value: selectedStrikePromo.reward.roundMode || "none",
                    onChange: event => updatePromotion(selectedStrikePromo.id, {
                      reward: {
                        ...selectedStrikePromo.reward,
                        roundMode: event.target.value
                      }
                    }),
                    children: ROUND_MODE_OPTIONS.map(item => /*#__PURE__*/_jsx("option", {
                      value: item.value,
                      children: item.label
                    }, item.value))
                  })]
                }), /*#__PURE__*/_jsxs("label", {
                  className: "text-[12px] font-semibold text-slate-500",
                  children: ["Priority / \u0110\u1ED9 \u01B0u ti\xEAn", /*#__PURE__*/_jsx("input", {
                    className: "admin-input mt-1",
                    type: "number",
                    min: "0",
                    value: Number(selectedStrikePromo.priority || 0),
                    onChange: event => updatePromotion(selectedStrikePromo.id, {
                      priority: Number(event.target.value || 0)
                    })
                  })]
                }), /*#__PURE__*/_jsxs("label", {
                  className: "text-[12px] font-semibold text-slate-500",
                  children: ["Kh\xF4ng cho ch\u1ED3ng khuy\u1EBFn m\xE3i", /*#__PURE__*/_jsx("div", {
                    className: "mt-2",
                    children: /*#__PURE__*/_jsxs("label", {
                      className: "admin-switch",
                      children: [/*#__PURE__*/_jsx("input", {
                        type: "checkbox",
                        checked: Boolean(selectedStrikePromo.condition.noStackWithOtherPromotions),
                        onChange: event => updatePromotion(selectedStrikePromo.id, {
                          condition: {
                            ...selectedStrikePromo.condition,
                            noStackWithOtherPromotions: event.target.checked
                          }
                        })
                      }), /*#__PURE__*/_jsx("span", {})]
                    })
                  })]
                })]
              }), /*#__PURE__*/_jsxs("div", {
                className: "grid grid-cols-1 gap-3 md:grid-cols-3",
                children: [/*#__PURE__*/_jsxs("label", {
                  className: "text-[12px] font-semibold text-slate-500",
                  children: ["\xC1p d\u1EE5ng theo khung gi\u1EDD", /*#__PURE__*/_jsx("div", {
                    className: "mt-2",
                    children: /*#__PURE__*/_jsxs("label", {
                      className: "admin-switch",
                      children: [/*#__PURE__*/_jsx("input", {
                        type: "checkbox",
                        checked: Boolean(selectedStrikePromo.condition.useTimeWindow),
                        onChange: event => updatePromotion(selectedStrikePromo.id, {
                          condition: {
                            ...selectedStrikePromo.condition,
                            useTimeWindow: event.target.checked
                          }
                        })
                      }), /*#__PURE__*/_jsx("span", {})]
                    })
                  })]
                }), selectedStrikePromo.condition.useTimeWindow ? /*#__PURE__*/_jsxs(_Fragment, {
                  children: [/*#__PURE__*/_jsxs("label", {
                    className: "text-[12px] font-semibold text-slate-500",
                    children: ["Gi\u1EDD b\u1EAFt \u0111\u1EA7u", /*#__PURE__*/_jsx("input", {
                      className: "admin-input mt-1",
                      type: "time",
                      value: selectedStrikePromo.condition.startTime || "09:00",
                      onChange: event => updatePromotion(selectedStrikePromo.id, {
                        condition: {
                          ...selectedStrikePromo.condition,
                          startTime: event.target.value
                        }
                      })
                    })]
                  }), /*#__PURE__*/_jsxs("label", {
                    className: "text-[12px] font-semibold text-slate-500",
                    children: ["Gi\u1EDD k\u1EBFt th\xFAc", /*#__PURE__*/_jsx("input", {
                      className: "admin-input mt-1",
                      type: "time",
                      value: selectedStrikePromo.condition.endTime || "21:00",
                      onChange: event => updatePromotion(selectedStrikePromo.id, {
                        condition: {
                          ...selectedStrikePromo.condition,
                          endTime: event.target.value
                        }
                      })
                    })]
                  })]
                }) : null]
              }), /*#__PURE__*/_jsxs("div", {
                className: "grid grid-cols-1 gap-3 md:grid-cols-2",
                children: [/*#__PURE__*/_jsxs("label", {
                  className: "text-[12px] font-semibold text-slate-500",
                  children: ["Ch\u1EC9 hi\u1EC3n th\u1ECB n\u1EBFu m\u1EE9c gi\u1EA3m t\u1ED1i thi\u1EC3u", /*#__PURE__*/_jsx("select", {
                    className: "admin-input mt-1",
                    value: Number(selectedStrikePromo.condition.minDiscountToShow || 5),
                    onChange: event => updatePromotion(selectedStrikePromo.id, {
                      condition: {
                        ...selectedStrikePromo.condition,
                        minDiscountToShow: Number(event.target.value || 5)
                      }
                    }),
                    children: MIN_DISCOUNT_TO_SHOW_OPTIONS.map(value => /*#__PURE__*/_jsxs("option", {
                      value: value,
                      children: [value, "%"]
                    }, value))
                  })]
                }), /*#__PURE__*/_jsxs("label", {
                  className: "text-[12px] font-semibold text-slate-500",
                  children: ["Gi\xE1 t\u1ED1i thi\u1EC3u sau gi\u1EA3m", /*#__PURE__*/_jsx("input", {
                    className: "admin-input mt-1",
                    type: "number",
                    min: "0",
                    value: Number(selectedStrikePromo.condition.minFinalPrice || 0),
                    onChange: event => updatePromotion(selectedStrikePromo.id, {
                      condition: {
                        ...selectedStrikePromo.condition,
                        minFinalPrice: Number(event.target.value || 0)
                      }
                    })
                  })]
                })]
              })]
            })]
          })]
        }), /*#__PURE__*/_jsx("div", {
          className: "mt-4 flex items-center justify-end",
          children: /*#__PURE__*/_jsx("button", {
            className: "admin-danger",
            onClick: () => setSmartPromotions(smartPromotions.filter(item => item.id !== selectedStrikePromo.id)),
            children: "X\xF3a ch\u01B0\u01A1ng tr\xECnh"
          })
        })]
      }) : /*#__PURE__*/_jsx("p", {
        className: "py-8 text-center text-sm text-slate-500",
        children: "Ch\u1ECDn ch\u01B0\u01A1ng tr\xECnh g\u1EA1ch gi\xE1 \u0111\u1EC3 ch\u1EC9nh s\u1EEDa."
      })
    })]
  }) : null;
}