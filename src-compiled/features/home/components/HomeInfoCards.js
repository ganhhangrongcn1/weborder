import { useEffect, useMemo, useState } from "react";
import HomeBranchPlannerModal from "./HomeBranchPlannerModal.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
function normalizeExternalUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
function getDeliveryAppBrand(app) {
  const value = `${app?.id || ""} ${app?.name || ""}`.toLowerCase();
  if (value.includes("grab")) return {
    className: "grab",
    label: "GrabFood"
  };
  if (value.includes("shopee")) return {
    className: "shopee",
    label: "ShopeeFood"
  };
  if (value.includes("xanh")) return {
    className: "xanh",
    label: "Xanh Ngon"
  };
  return {
    className: "default",
    label: app?.name || "App"
  };
}
function DeliveryAppLogo({
  app
}) {
  const brand = getDeliveryAppBrand(app);
  return /*#__PURE__*/_jsx("span", {
    className: `delivery-app-logo delivery-app-logo-${brand.className}`,
    "aria-hidden": "true",
    children: brand.label
  });
}
export default function HomeInfoCards({
  showCashback,
  cashbackRef,
  cashbackBlock,
  showDeliveryApps,
  deliveryAppsRef,
  deliveryAppsBlock,
  deliveryAppsList,
  deliveryAppBranches = [],
  deliveryBranches = []
}) {
  const [activeBranchId, setActiveBranchId] = useState(deliveryAppBranches[0]?.branchId || "");
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const hasBranchApps = deliveryAppBranches.length > 0;
  useEffect(() => {
    if (!hasBranchApps) return;
    const hasCurrentBranch = deliveryAppBranches.some(branch => branch.branchId === activeBranchId);
    if (!hasCurrentBranch) {
      setActiveBranchId(deliveryAppBranches[0]?.branchId || "");
    }
  }, [activeBranchId, deliveryAppBranches, hasBranchApps]);
  const activeBranch = useMemo(() => deliveryAppBranches.find(branch => branch.branchId === activeBranchId) || deliveryAppBranches[0] || null, [activeBranchId, deliveryAppBranches]);
  const branchPickerItems = useMemo(() => deliveryAppBranches.map(branch => {
    const sourceBranch = deliveryBranches.find(item => String(item?.id || "") === String(branch.branchSourceId || "") || String(item?.name || "") === String(branch.branchSourceId || "") || String(item?.name || "") === String(branch.branchName || ""));
    return {
      id: branch.branchId,
      name: branch.branchName,
      address: sourceBranch?.address || "",
      time: sourceBranch?.time || "",
      openTime: sourceBranch?.openTime || sourceBranch?.open || "",
      closeTime: sourceBranch?.closeTime || sourceBranch?.close || ""
    };
  }), [deliveryAppBranches, deliveryBranches]);
  const legacyApps = deliveryAppsList.length ? deliveryAppsList : ["GrabFood", "ShopeeFood", "Xanh Ngon"];
  const openDeliveryApp = url => {
    const normalizedUrl = normalizeExternalUrl(url);
    if (!normalizedUrl) return;
    window.open(normalizedUrl, "_blank", "noopener,noreferrer");
  };
  if (!showCashback && !showDeliveryApps) return null;
  return /*#__PURE__*/_jsxs("section", {
    className: "home2026-section grid gap-3",
    children: [showCashback && /*#__PURE__*/_jsxs("article", {
      ref: cashbackRef,
      className: "cashback-card",
      children: [/*#__PURE__*/_jsx("span", {
        className: "cashback-icon",
        children: cashbackBlock?.iconText || "%"
      }), /*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("h2", {
          children: cashbackBlock?.title || "Hoàn tiền"
        }), /*#__PURE__*/_jsx("p", {
          children: cashbackBlock?.subtitle || "Ưu đãi hoàn tiền khi đặt món."
        })]
      })]
    }), showDeliveryApps && /*#__PURE__*/_jsxs("article", {
      ref: deliveryAppsRef,
      className: "delivery-app-card",
      children: [/*#__PURE__*/_jsx("h2", {
        children: deliveryAppsBlock?.title || "Mua trên app giao hàng"
      }), deliveryAppsBlock?.subtitle ? /*#__PURE__*/_jsx("p", {
        className: "delivery-app-subtitle",
        children: deliveryAppsBlock.subtitle
      }) : null, hasBranchApps ? /*#__PURE__*/_jsxs(_Fragment, {
        children: [/*#__PURE__*/_jsxs("label", {
          className: "delivery-app-branch-select",
          children: [/*#__PURE__*/_jsx("span", {
            children: "Ch\u1ECDn chi nh\xE1nh \u0111\u1EB7t qua app"
          }), /*#__PURE__*/_jsxs("button", {
            type: "button",
            className: "delivery-app-branch-trigger",
            onClick: () => setBranchPickerOpen(true),
            children: [/*#__PURE__*/_jsx("span", {
              children: activeBranch?.branchName || "Chọn chi nhánh"
            }), /*#__PURE__*/_jsx("i", {
              children: "\u25BE"
            })]
          })]
        }), activeBranch?.branchName ? /*#__PURE__*/_jsxs("p", {
          className: "delivery-app-branch-note",
          children: ["App \u0111\u1EB7t h\xE0ng c\u1EE7a chi nh\xE1nh: ", /*#__PURE__*/_jsx("strong", {
            children: activeBranch.branchName
          })]
        }) : null, /*#__PURE__*/_jsx("div", {
          className: "grid grid-cols-3 gap-2",
          children: (activeBranch?.apps || []).map(app => {
            const appUrl = normalizeExternalUrl(app.url);
            return /*#__PURE__*/_jsxs("button", {
              type: "button",
              className: "delivery-app-item",
              disabled: !appUrl,
              onClick: () => openDeliveryApp(appUrl),
              children: [/*#__PURE__*/_jsx(DeliveryAppLogo, {
                app: app
              }), /*#__PURE__*/_jsx("strong", {
                children: app.name
              })]
            }, app.id);
          })
        }), /*#__PURE__*/_jsx(HomeBranchPlannerModal, {
          open: branchPickerOpen,
          onBackdropClose: () => setBranchPickerOpen(false),
          onClose: () => setBranchPickerOpen(false),
          title: "Ch\u1ECDn chi nh\xE1nh giao h\xE0ng",
          subtitle: "Ch\u1ECDn chi nh\xE1nh g\u1EA7n b\u1EA1n nh\u1EA5t \u0111\u1EC3 ti\u1EBFt ki\u1EC7m ph\xED ship.",
          ariaLabel: "Ch\u1ECDn chi nh\xE1nh giao h\xE0ng",
          branches: branchPickerItems,
          selectedBranchId: activeBranch?.branchId || "",
          onSelectBranch: setActiveBranchId,
          onConfirm: () => {
            setBranchPickerOpen(false);
            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });
          },
          confirmLabel: "Ch\u1ECDn chi nh\xE1nh n\xE0y",
          iconName: "star"
        })]
      }) : /*#__PURE__*/_jsx("div", {
        className: "grid grid-cols-3 gap-2",
        children: legacyApps.map((app, index) => /*#__PURE__*/_jsxs("div", {
          className: "delivery-app-item",
          children: [/*#__PURE__*/_jsx(DeliveryAppLogo, {
            app: {
              name: app
            }
          }), /*#__PURE__*/_jsx("strong", {
            children: app
          })]
        }, `${app}-${index}`))
      })]
    })]
  });
}