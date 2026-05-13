import { useEffect, useMemo, useState } from "react";
import { goongAutocomplete, goongPlaceDetail, hasGoongApiKey } from "../../../services/goongService.js";
import { DEFAULT_SHIPPING_CONFIG } from "../../../services/shippingService.js";
import { syncBranchesToSupabase } from "../../../services/repositories/catalogConfigRepository.js";
import { AdminButton, AdminCard, AdminInput } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function BranchSettings({
  branches,
  setBranches,
  shippingConfig,
  setShippingConfig,
  onSaveShippingConfig
}) {
  const [addressSuggestions, setAddressSuggestions] = useState({
    branchId: "",
    loading: false,
    items: []
  });
  const [draftBranches, setDraftBranches] = useState(() => Array.isArray(branches) ? branches : []);
  const [draftShippingConfig, setDraftShippingConfig] = useState(() => ({
    ...(shippingConfig || {})
  }));
  const [branchSaveMessage, setBranchSaveMessage] = useState("");
  const [shippingSaveMessage, setShippingSaveMessage] = useState("");
  const [branchSaving, setBranchSaving] = useState(false);
  const [shippingSaving, setShippingSaving] = useState(false);
  useEffect(() => {
    setDraftBranches(Array.isArray(branches) ? branches : []);
  }, [branches]);
  useEffect(() => {
    setDraftShippingConfig({
      ...(shippingConfig || {})
    });
  }, [shippingConfig]);
  const branchesDirty = useMemo(() => JSON.stringify(draftBranches || []) !== JSON.stringify(branches || []), [draftBranches, branches]);
  const shippingDirty = useMemo(() => JSON.stringify(draftShippingConfig || {}) !== JSON.stringify(shippingConfig || {}), [draftShippingConfig, shippingConfig]);
  const extractOpenCloseTime = branch => {
    const defaultOpen = "09:00";
    const defaultClose = "21:00";
    if (branch?.openTime && branch?.closeTime) {
      return {
        openTime: branch.openTime,
        closeTime: branch.closeTime
      };
    }
    const matched = String(branch?.time || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!matched) {
      return {
        openTime: defaultOpen,
        closeTime: defaultClose
      };
    }
    const normalize = value => {
      const [hour, minute] = String(value).split(":");
      return `${String(Number(hour)).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`;
    };
    return {
      openTime: normalize(matched[1]),
      closeTime: normalize(matched[2])
    };
  };
  const updateBranchTime = (branchId, nextOpenTime, nextCloseTime) => {
    setDraftBranches(draftBranches.map(item => item.id === branchId ? {
      ...item,
      openTime: nextOpenTime,
      closeTime: nextCloseTime,
      time: `${nextOpenTime} - ${nextCloseTime}`
    } : item));
  };
  const updateBranchField = (branchId, field, value) => {
    setDraftBranches(draftBranches.map(item => item.id === branchId ? {
      ...item,
      [field]: value
    } : item));
  };
  const updateBranchAddress = async (branchId, value) => {
    updateBranchField(branchId, "address", value);
    const keyword = String(value || "").trim();
    if (!hasGoongApiKey() || keyword.length < 3) {
      setAddressSuggestions({
        branchId: "",
        loading: false,
        items: []
      });
      return;
    }
    setAddressSuggestions({
      branchId,
      loading: true,
      items: []
    });
    const items = await goongAutocomplete(keyword);
    setAddressSuggestions({
      branchId,
      loading: false,
      items: items.slice(0, 5)
    });
  };
  const pickBranchAddress = async (branch, suggestion) => {
    const detail = await goongPlaceDetail(suggestion.place_id);
    const location = detail?.geometry?.location;
    const formattedAddress = detail?.formatted_address || suggestion.description || branch.address || "";
    setDraftBranches(draftBranches.map(item => item.id === branch.id ? {
      ...item,
      address: formattedAddress,
      lat: location?.lat ? String(location.lat) : item.lat,
      lng: location?.lng ? String(location.lng) : item.lng
    } : item));
    setAddressSuggestions({
      branchId: "",
      loading: false,
      items: []
    });
  };
  const handleSaveBranches = async () => {
    if (!branchesDirty || branchSaving) return;
    setBranchSaving(true);
    setBranchSaveMessage("");
    try {
      setBranches(draftBranches);
      await syncBranchesToSupabase(draftBranches);
      setBranchSaveMessage("Đã lưu chi nhánh lên Supabase.");
    } catch (_error) {
      setBranchSaveMessage("Lưu chi nhánh thất bại. Kiểm tra RLS policy write cho catalog.");
    } finally {
      setBranchSaving(false);
    }
  };
  const handleSaveShipping = async () => {
    if (!shippingDirty || shippingSaving) return;
    setShippingSaving(true);
    setShippingSaveMessage("");
    try {
      await onSaveShippingConfig(draftShippingConfig);
      setShippingSaveMessage("Đã lưu cấu hình phí ship lên Supabase.");
    } catch (_error) {
      setShippingSaveMessage("Lưu phí ship thất bại. Kiểm tra RLS policy write cho app_configs.");
    } finally {
      setShippingSaving(false);
    }
  };
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs(AdminCard, {
      className: "admin-panel admin-store-panel",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-panel-head",
        children: [/*#__PURE__*/_jsx("h2", {
          children: "Chi nh\xE1nh"
        }), /*#__PURE__*/_jsxs("div", {
          className: "flex items-center gap-2",
          children: [/*#__PURE__*/_jsx(AdminButton, {
            variant: branchesDirty ? "primary" : "secondary",
            className: !branchesDirty || branchSaving ? "opacity-70 cursor-not-allowed" : "",
            disabled: !branchesDirty || branchSaving,
            onClick: handleSaveBranches,
            children: branchSaving ? "Đang lưu..." : "Lưu thay đổi"
          }), /*#__PURE__*/_jsx(AdminButton, {
            onClick: () => setDraftBranches([{
              id: `branch-${Date.now()}`,
              name: "Chi nhánh mới",
              address: "",
              phone: "",
              map: "",
              lat: "",
              lng: "",
              shipEnabled: true,
              pickupEnabled: true,
              openTime: "09:00",
              closeTime: "21:00",
              time: "09:00 - 21:00",
              open: true
            }, ...draftBranches]),
            children: "Th\xEAm chi nh\xE1nh"
          })]
        })]
      }), branchSaveMessage ? /*#__PURE__*/_jsx("p", {
        className: "text-sm text-slate-600",
        children: branchSaveMessage
      }) : null, /*#__PURE__*/_jsx("div", {
        className: "admin-table",
        children: draftBranches.map(branch => {
          const {
            openTime,
            closeTime
          } = extractOpenCloseTime(branch);
          const showingSuggestions = addressSuggestions.branchId === branch.id;
          return /*#__PURE__*/_jsx("div", {
            className: "admin-edit-card",
            children: /*#__PURE__*/_jsxs("div", {
              className: "admin-branch-layout",
              children: [/*#__PURE__*/_jsxs("div", {
                className: "admin-branch-main",
                children: [/*#__PURE__*/_jsxs("div", {
                  className: "admin-edit-fields admin-branch-top-grid",
                  children: [/*#__PURE__*/_jsx(AdminInput, {
                    className: "admin-input",
                    placeholder: "T\xEAn chi nh\xE1nh",
                    value: branch.name ?? "",
                    onChange: event => updateBranchField(branch.id, "name", event.target.value)
                  }), /*#__PURE__*/_jsxs("div", {
                    className: "relative",
                    children: [/*#__PURE__*/_jsx(AdminInput, {
                      className: "admin-input",
                      placeholder: "\u0110\u1ECBa ch\u1EC9",
                      value: branch.address ?? "",
                      onChange: event => updateBranchAddress(branch.id, event.target.value)
                    }), showingSuggestions && (addressSuggestions.loading || addressSuggestions.items.length > 0) && /*#__PURE__*/_jsx("div", {
                      className: "absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-orange-100 bg-white p-1 shadow-lg",
                      children: addressSuggestions.loading ? /*#__PURE__*/_jsx("div", {
                        className: "px-3 py-2 text-xs text-brown/60",
                        children: "\u0110ang t\xECm \u0111\u1ECBa ch\u1EC9..."
                      }) : addressSuggestions.items.map(item => /*#__PURE__*/_jsx(AdminButton, {
                        variant: "ghost",
                        className: "w-full rounded-xl px-3 py-2 text-left text-xs hover:bg-orange-50",
                        onMouseDown: event => {
                          event.preventDefault();
                          pickBranchAddress(branch, item);
                        },
                        children: /*#__PURE__*/_jsxs("span", {
                          children: [/*#__PURE__*/_jsx("strong", {
                            className: "block text-brown",
                            children: item.structured_formatting?.main_text || item.description
                          }), /*#__PURE__*/_jsx("span", {
                            className: "mt-0.5 block text-brown/60",
                            children: item.description
                          })]
                        })
                      }, item.place_id))
                    })]
                  }), /*#__PURE__*/_jsx(AdminInput, {
                    className: "admin-input",
                    placeholder: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
                    value: branch.phone ?? "",
                    onChange: event => updateBranchField(branch.id, "phone", event.target.value)
                  }), /*#__PURE__*/_jsxs("div", {
                    className: "admin-branch-time-grid",
                    children: [/*#__PURE__*/_jsxs("label", {
                      className: "admin-input flex items-center justify-between gap-2",
                      children: [/*#__PURE__*/_jsx("span", {
                        className: "text-xs font-semibold text-brown/70",
                        children: "M\u1EDF c\u1EEDa"
                      }), /*#__PURE__*/_jsx(AdminInput, {
                        type: "time",
                        value: openTime,
                        onChange: event => updateBranchTime(branch.id, event.target.value, closeTime)
                      })]
                    }), /*#__PURE__*/_jsxs("label", {
                      className: "admin-input flex items-center justify-between gap-2",
                      children: [/*#__PURE__*/_jsx("span", {
                        className: "text-xs font-semibold text-brown/70",
                        children: "\u0110\xF3ng c\u1EEDa"
                      }), /*#__PURE__*/_jsx(AdminInput, {
                        type: "time",
                        value: closeTime,
                        onChange: event => updateBranchTime(branch.id, openTime, event.target.value)
                      })]
                    })]
                  })]
                }), /*#__PURE__*/_jsxs("div", {
                  className: "admin-branch-bottom-grid",
                  children: [/*#__PURE__*/_jsxs("label", {
                    className: "admin-input flex items-center justify-between gap-3",
                    children: [/*#__PURE__*/_jsx("span", {
                      className: "text-xs font-semibold text-brown/70",
                      children: "B\u1EADt giao h\xE0ng chi nh\xE1nh n\xE0y"
                    }), /*#__PURE__*/_jsx("input", {
                      type: "checkbox",
                      checked: branch.shipEnabled !== false,
                      onChange: event => updateBranchField(branch.id, "shipEnabled", event.target.checked),
                      className: "toggle-input"
                    })]
                  }), /*#__PURE__*/_jsxs("label", {
                    className: "admin-input flex items-center justify-between gap-3",
                    children: [/*#__PURE__*/_jsx("span", {
                      className: "text-xs font-semibold text-brown/70",
                      children: "B\u1EADt \u0111\u1EBFn l\u1EA5y chi nh\xE1nh n\xE0y"
                    }), /*#__PURE__*/_jsx("input", {
                      type: "checkbox",
                      checked: branch.pickupEnabled !== false,
                      onChange: event => updateBranchField(branch.id, "pickupEnabled", event.target.checked),
                      className: "toggle-input"
                    })]
                  })]
                })]
              }), /*#__PURE__*/_jsx("div", {
                className: "admin-branch-actions",
                children: /*#__PURE__*/_jsx(AdminButton, {
                  variant: "danger",
                  className: "admin-danger",
                  onClick: () => setDraftBranches(draftBranches.filter(item => item.id !== branch.id)),
                  children: "X\xF3a"
                })
              })]
            })
          }, branch.id);
        })
      })]
    }), /*#__PURE__*/_jsxs(AdminCard, {
      className: "admin-panel admin-store-panel",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-panel-head",
        children: [/*#__PURE__*/_jsx("h2", {
          children: "C\u1EA5u h\xECnh ph\xED ship n\u1EC1n t\u1EA1i chi nh\xE1nh"
        }), /*#__PURE__*/_jsx(AdminButton, {
          variant: shippingDirty ? "primary" : "secondary",
          className: !shippingDirty || shippingSaving ? "opacity-70 cursor-not-allowed" : "",
          disabled: !shippingDirty || shippingSaving,
          onClick: handleSaveShipping,
          children: shippingSaving ? "Đang lưu..." : "Lưu thay đổi"
        })]
      }), shippingSaveMessage ? /*#__PURE__*/_jsx("p", {
        className: "text-sm text-slate-600",
        children: shippingSaveMessage
      }) : null, /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-grid admin-ship-compact-grid",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "admin-mini-card admin-ship-compact-item",
          children: [/*#__PURE__*/_jsx("label", {
            children: "Ph\xED 3km \u0111\u1EA7u"
          }), /*#__PURE__*/_jsx(AdminInput, {
            className: "admin-input",
            type: "number",
            value: draftShippingConfig.baseFeeFirst3Km,
            onChange: event => setDraftShippingConfig(current => ({
              ...current,
              baseFeeFirst3Km: Number(event.target.value)
            }))
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-mini-card admin-ship-compact-item",
          children: [/*#__PURE__*/_jsx("label", {
            children: "Gi\xE1 m\u1ED7i km ti\u1EBFp theo"
          }), /*#__PURE__*/_jsx(AdminInput, {
            className: "admin-input",
            type: "number",
            value: draftShippingConfig.feePerNextKm,
            onChange: event => setDraftShippingConfig(current => ({
              ...current,
              feePerNextKm: Number(event.target.value)
            }))
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-mini-card admin-ship-compact-item",
          children: [/*#__PURE__*/_jsx("label", {
            children: "\u01AFu \u0111\xE3i freeship"
          }), /*#__PURE__*/_jsx("div", {
            className: "admin-input flex items-center text-xs text-brown/70",
            children: "C\u1EA5u h\xECnh t\u1EA1i Khuy\u1EBFn m\xE3i \u2192 Freeship."
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-mini-card admin-ship-compact-item",
          children: [/*#__PURE__*/_jsx("label", {
            children: "B\xE1n k\xEDnh giao h\xE0ng t\u1ED1i \u0111a (km)"
          }), /*#__PURE__*/_jsx(AdminInput, {
            className: "admin-input",
            type: "number",
            value: draftShippingConfig.maxRadiusKm,
            onChange: event => setDraftShippingConfig(current => ({
              ...current,
              maxRadiusKm: Number(event.target.value)
            }))
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-mini-card admin-ship-compact-item admin-ship-note-item",
          children: [/*#__PURE__*/_jsx("label", {
            children: "Ghi ch\xFA hi\u1EC3n th\u1ECB cho kh\xE1ch"
          }), /*#__PURE__*/_jsx("textarea", {
            className: "admin-input",
            rows: "4",
            value: draftShippingConfig.customerNote || "",
            onChange: event => setDraftShippingConfig(current => ({
              ...current,
              customerNote: event.target.value
            }))
          })]
        })]
      }), /*#__PURE__*/_jsx(AdminButton, {
        variant: "secondary",
        className: "admin-secondary",
        onClick: () => setDraftShippingConfig({
          ...DEFAULT_SHIPPING_CONFIG
        }),
        children: "Kh\xF4i ph\u1EE5c ph\xED ship m\u1EB7c \u0111\u1ECBnh"
      })]
    })]
  });
}