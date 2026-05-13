import { DISCOUNT_TYPE_OPTIONS, FLASH_APPLY_SCOPE_OPTIONS, ROUND_MODE_OPTIONS, formatCountdownFromMs, formatMoney, getFlashStatus, mergeDateAndTime, toIdList, toggleCsvId } from "./promotionTabUtils.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function FlashSaleTab({
  flashSalePromos,
  selectedFlashPromo,
  setSelectedFlashPromoId,
  createPromotion,
  nowTick,
  updatePromotion,
  activeCategories,
  activeProducts,
  setSmartPromotions,
  smartPromotions
}) {
  return flashSalePromos.length ? /*#__PURE__*/_jsxs("div", {
    className: "admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]",
    children: [/*#__PURE__*/_jsxs("aside", {
      className: "admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "mb-3 flex items-center justify-between",
        children: [/*#__PURE__*/_jsx("strong", {
          className: "text-sm font-black text-slate-800",
          children: "Danh s\xE1ch Flash Sale"
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          className: "admin-cta",
          onClick: () => createPromotion("flash_sale"),
          children: "+ T\u1EA1o m\u1EDBi"
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "max-h-[68vh] space-y-2 overflow-y-auto pr-1",
        children: flashSalePromos.map(promo => {
          const status = getFlashStatus(promo, new Date(nowTick));
          const isSelected = selectedFlashPromo?.id === promo.id;
          const totalSlots = Number(promo.condition?.totalSlots || 0);
          const soldCount = Math.min(Number(promo.condition?.soldCount || 0), totalSlots || Number.MAX_SAFE_INTEGER);
          return /*#__PURE__*/_jsxs("button", {
            type: "button",
            onClick: () => setSelectedFlashPromoId(promo.id),
            className: `w-full rounded-[14px] border bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995] ${isSelected ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-200"}`,
            children: [/*#__PURE__*/_jsxs("div", {
              className: "mb-2 flex items-start justify-between gap-2",
              children: [/*#__PURE__*/_jsx("strong", {
                className: "text-sm font-black text-slate-900",
                children: promo.title || promo.name || "Flash Sale"
              }), /*#__PURE__*/_jsx("span", {
                className: `rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`,
                children: status.label
              })]
            }), /*#__PURE__*/_jsx("p", {
              className: "text-xl font-black text-orange-600",
              children: promo.reward.type === "percent_discount" ? `-${Number(promo.reward.value || 0)}%` : `-${formatMoney(promo.reward.value || 0)}`
            }), /*#__PURE__*/_jsxs("p", {
              className: "mt-1 text-xs text-slate-700",
              children: [promo.condition?.startTime || "00:00", " - ", promo.condition?.endTime || "23:59"]
            }), /*#__PURE__*/_jsxs("p", {
              className: "mt-1 text-[11px] text-slate-500",
              children: ["\u0110\xE3 b\xE1n ", soldCount, "/", totalSlots || 0, " su\u1EA5t"]
            })]
          }, promo.id);
        })
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
      children: selectedFlashPromo ? /*#__PURE__*/_jsxs(_Fragment, {
        children: [(() => {
          const status = getFlashStatus(selectedFlashPromo, new Date(nowTick));
          const totalSlots = Math.max(0, Number(selectedFlashPromo.condition?.totalSlots || 0));
          const soldCount = Math.max(0, Math.min(Number(selectedFlashPromo.condition?.soldCount || 0), totalSlots || Number.MAX_SAFE_INTEGER));
          const remaining = Math.max(totalSlots - soldCount, 0);
          const progress = totalSlots > 0 ? Math.min(soldCount / totalSlots * 100, 100) : 0;
          const endDateTime = mergeDateAndTime(selectedFlashPromo.endAt, selectedFlashPromo.condition?.endTime || "23:59", true);
          const countdown = status.code === "running" && endDateTime ? formatCountdownFromMs(endDateTime.getTime() - nowTick) : "";
          return /*#__PURE__*/_jsxs("div", {
            className: `mb-4 rounded-[14px] border border-orange-200 bg-orange-50 px-4 py-3 ${selectedFlashPromo.active ? "opacity-100" : "opacity-60"}`,
            children: [/*#__PURE__*/_jsxs("div", {
              className: "flex items-start justify-between gap-3",
              children: [/*#__PURE__*/_jsxs("div", {
                children: [/*#__PURE__*/_jsxs("p", {
                  className: "text-xs font-bold uppercase tracking-wide text-slate-500",
                  children: ["\u26A1 ", selectedFlashPromo.title || "FLASH SALE"]
                }), /*#__PURE__*/_jsx("p", {
                  className: "mt-1 text-2xl font-black text-orange-600",
                  children: selectedFlashPromo.reward.type === "percent_discount" ? `GIẢM ${Number(selectedFlashPromo.reward.value || 0)}%` : `GIẢM ${formatMoney(selectedFlashPromo.reward.value || 0)}`
                }), /*#__PURE__*/_jsxs("p", {
                  className: "mt-1 text-sm font-semibold text-slate-700",
                  children: [selectedFlashPromo.condition?.startTime || "00:00", " - ", selectedFlashPromo.condition?.endTime || "23:59"]
                })]
              }), /*#__PURE__*/_jsx("span", {
                className: `h-fit rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`,
                children: status.label
              })]
            }), /*#__PURE__*/_jsxs("p", {
              className: "mt-2 text-xs text-slate-600",
              children: ["\u0110\xE3 b\xE1n ", soldCount, "/", totalSlots || 0, " su\u1EA5t \xB7 C\xF2n l\u1EA1i ", remaining, " su\u1EA5t"]
            }), /*#__PURE__*/_jsx("div", {
              className: "mt-2 h-2 w-full overflow-hidden rounded-full bg-white",
              children: /*#__PURE__*/_jsx("div", {
                className: "h-full rounded-full bg-orange-500 transition-all",
                style: {
                  width: `${progress}%`
                }
              })
            }), countdown ? /*#__PURE__*/_jsxs("p", {
              className: "mt-2 text-xs font-bold text-orange-700",
              children: ["K\u1EBFt th\xFAc sau: ", countdown]
            }) : null]
          });
        })(), /*#__PURE__*/_jsxs("div", {
          className: "space-y-4",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "1. Ch\u1ECDn m\xF3n ch\u1EA1y Flash Sale"
            }), (() => {
              const selectedScope = selectedFlashPromo.condition.applyScope || "product";
              const selectedCategoryIds = toIdList(selectedFlashPromo.condition.categoryIds || "");
              const selectedProductIds = toIdList(selectedFlashPromo.condition.productIds || "");
              return /*#__PURE__*/_jsxs("div", {
                className: "grid grid-cols-1 gap-3 md:grid-cols-2",
                children: [/*#__PURE__*/_jsxs("label", {
                  className: "text-[12px] font-semibold text-slate-500 md:col-span-2",
                  children: ["\xC1p d\u1EE5ng cho", /*#__PURE__*/_jsx("select", {
                    className: "admin-input mt-1",
                    value: selectedScope,
                    onChange: event => updatePromotion(selectedFlashPromo.id, {
                      condition: {
                        ...selectedFlashPromo.condition,
                        applyScope: event.target.value
                      }
                    }),
                    children: FLASH_APPLY_SCOPE_OPTIONS.map(item => /*#__PURE__*/_jsx("option", {
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
                    children: activeCategories.map(categoryName => /*#__PURE__*/_jsxs("label", {
                      className: "flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700",
                      children: [/*#__PURE__*/_jsx("input", {
                        type: "checkbox",
                        checked: selectedCategoryIds.includes(categoryName),
                        onChange: () => updatePromotion(selectedFlashPromo.id, {
                          condition: {
                            ...selectedFlashPromo.condition,
                            categoryIds: toggleCsvId(selectedFlashPromo.condition.categoryIds || "", categoryName)
                          }
                        })
                      }), /*#__PURE__*/_jsx("span", {
                        children: categoryName
                      })]
                    }, categoryName))
                  })]
                }) : null, selectedScope === "product" ? /*#__PURE__*/_jsxs("div", {
                  className: "md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3",
                  children: [/*#__PURE__*/_jsx("p", {
                    className: "mb-2 text-[12px] font-semibold text-slate-600",
                    children: "Ch\u1ECDn m\xF3n \xE1p d\u1EE5ng"
                  }), /*#__PURE__*/_jsx("div", {
                    className: "max-h-56 space-y-2 overflow-y-auto pr-1",
                    children: activeProducts.map(product => /*#__PURE__*/_jsxs("label", {
                      className: "flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700",
                      children: [/*#__PURE__*/_jsx("input", {
                        type: "checkbox",
                        checked: selectedProductIds.includes(product.id),
                        onChange: () => updatePromotion(selectedFlashPromo.id, {
                          condition: {
                            ...selectedFlashPromo.condition,
                            productIds: toggleCsvId(selectedFlashPromo.condition.productIds || "", product.id)
                          }
                        })
                      }), /*#__PURE__*/_jsx("span", {
                        className: "flex-1",
                        children: product.name
                      })]
                    }, product.id))
                  })]
                }) : null]
              });
            })()]
          }), /*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "2. Gi\u1EA3m bao nhi\xEAu?"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-2",
              children: [/*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Ki\u1EC3u gi\u1EA3m", /*#__PURE__*/_jsx("select", {
                  className: "admin-input mt-1",
                  value: selectedFlashPromo.reward.type,
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    reward: {
                      ...selectedFlashPromo.reward,
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
                  value: Number(selectedFlashPromo.reward.value || 0),
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    reward: {
                      ...selectedFlashPromo.reward,
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
              children: "3. Ch\u1EA1y khi n\xE0o?"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-4",
              children: [/*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Ng\xE0y b\u1EAFt \u0111\u1EA7u", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "date",
                  value: selectedFlashPromo.startAt || "",
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    startAt: event.target.value
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Ng\xE0y k\u1EBFt th\xFAc", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "date",
                  value: selectedFlashPromo.endAt || "",
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    endAt: event.target.value
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Gi\u1EDD b\u1EAFt \u0111\u1EA7u", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "time",
                  value: selectedFlashPromo.condition.startTime || "10:00",
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    condition: {
                      ...selectedFlashPromo.condition,
                      startTime: event.target.value
                    }
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["Gi\u1EDD k\u1EBFt th\xFAc", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "time",
                  value: selectedFlashPromo.condition.endTime || "13:00",
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    condition: {
                      ...selectedFlashPromo.condition,
                      endTime: event.target.value
                    }
                  })
                })]
              })]
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "4. Gi\u1EDBi h\u1EA1n su\u1EA5t"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-2",
              children: [/*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["T\u1ED5ng s\u1ED1 su\u1EA5t flash sale", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "number",
                  min: "0",
                  value: Number(selectedFlashPromo.condition.totalSlots || 0),
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    condition: {
                      ...selectedFlashPromo.condition,
                      totalSlots: Number(event.target.value || 0)
                    }
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["M\u1ED7i kh\xE1ch mua t\u1ED1i \u0111a", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "number",
                  min: "1",
                  value: Number(selectedFlashPromo.condition.maxPerCustomer || 1),
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    condition: {
                      ...selectedFlashPromo.condition,
                      maxPerCustomer: Number(event.target.value || 1)
                    }
                  })
                })]
              })]
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "5. T\xEAn hi\u1EC3n th\u1ECB"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-2",
              children: [/*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["T\xEAn ch\u01B0\u01A1ng tr\xECnh", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  value: selectedFlashPromo.title || "",
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    title: event.target.value
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["T\xEAn n\u1ED9i b\u1ED9", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  value: selectedFlashPromo.name || "",
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    name: event.target.value
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500 md:col-span-2",
                children: ["M\xF4 t\u1EA3 ng\u1EAFn", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  value: selectedFlashPromo.text || "",
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
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
              className: "mt-4 grid grid-cols-1 gap-3 md:grid-cols-3",
              children: [/*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["L\xE0m tr\xF2n gi\xE1 sau gi\u1EA3m", /*#__PURE__*/_jsx("select", {
                  className: "admin-input mt-1",
                  value: selectedFlashPromo.reward.roundMode || "none",
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    reward: {
                      ...selectedFlashPromo.reward,
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
                  value: Number(selectedFlashPromo.priority || 0),
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
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
                      checked: Boolean(selectedFlashPromo.condition.noStackWithOtherPromotions),
                      onChange: event => updatePromotion(selectedFlashPromo.id, {
                        condition: {
                          ...selectedFlashPromo.condition,
                          noStackWithOtherPromotions: event.target.checked
                        }
                      })
                    }), /*#__PURE__*/_jsx("span", {})]
                  })
                })]
              }), /*#__PURE__*/_jsxs("label", {
                className: "text-[12px] font-semibold text-slate-500",
                children: ["\u0110\xE3 b\xE1n (demo/admin)", /*#__PURE__*/_jsx("input", {
                  className: "admin-input mt-1",
                  type: "number",
                  min: "0",
                  value: Number(selectedFlashPromo.condition.soldCount || 0),
                  onChange: event => updatePromotion(selectedFlashPromo.id, {
                    condition: {
                      ...selectedFlashPromo.condition,
                      soldCount: Number(event.target.value || 0)
                    }
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
                      checked: Boolean(selectedFlashPromo.active),
                      onChange: event => updatePromotion(selectedFlashPromo.id, {
                        active: event.target.checked
                      })
                    }), /*#__PURE__*/_jsx("span", {})]
                  })
                })]
              })]
            })]
          })]
        }), /*#__PURE__*/_jsx("div", {
          className: "mt-4 flex items-center justify-end",
          children: /*#__PURE__*/_jsx("button", {
            className: "admin-danger",
            onClick: () => setSmartPromotions(smartPromotions.filter(item => item.id !== selectedFlashPromo.id)),
            children: "X\xF3a ch\u01B0\u01A1ng tr\xECnh"
          })
        })]
      }) : /*#__PURE__*/_jsx("p", {
        className: "py-8 text-center text-sm text-slate-500",
        children: "Ch\u1ECDn ch\u01B0\u01A1ng tr\xECnh Flash Sale \u0111\u1EC3 ch\u1EC9nh s\u1EEDa."
      })
    })]
  }) : null;
}