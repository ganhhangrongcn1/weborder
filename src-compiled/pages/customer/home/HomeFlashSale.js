import Icon from "../../../components/Icon.js";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { formatMoney } from "../../../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
function HomeDealTimer({
  getCountdownParts,
  secondsLeft
}) {
  return /*#__PURE__*/_jsx("span", {
    className: "home2026-timer-boxes",
    children: getCountdownParts(secondsLeft).map((part, index) => /*#__PURE__*/_jsx("em", {
      children: part
    }, index))
  });
}
function HomeFlashCard({
  product,
  onBuy,
  buyText
}) {
  return /*#__PURE__*/_jsxs("article", {
    className: "home2026-flash-card",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "home2026-flash-image",
      children: [/*#__PURE__*/_jsx("img", {
        src: product.image,
        alt: product.name
      }), /*#__PURE__*/_jsxs("span", {
        children: ["-", product.discountPercent, "%"]
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "min-w-0 flex-1",
      children: [/*#__PURE__*/_jsx("h3", {
        children: product.name
      }), /*#__PURE__*/_jsx("del", {
        children: formatMoney(product.originalPrice)
      }), /*#__PURE__*/_jsx("strong", {
        children: formatMoney(product.salePrice)
      })]
    }), /*#__PURE__*/_jsx("button", {
      type: "button",
      onClick: onBuy,
      children: buyText
    })]
  });
}
function HomeFlashDealCard({
  product,
  onBuy,
  flashSub
}) {
  return /*#__PURE__*/_jsxs("article", {
    className: "home2026-flash-main-card",
    onClick: onBuy,
    children: [/*#__PURE__*/_jsx("div", {
      className: "home2026-flash-main-image",
      children: /*#__PURE__*/_jsx("img", {
        src: product.image,
        alt: product.name
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "home2026-flash-main-info",
      children: [/*#__PURE__*/_jsx("h3", {
        children: product.name
      }), /*#__PURE__*/_jsx("p", {
        children: flashSub
      }), /*#__PURE__*/_jsxs("div", {
        className: "home2026-flash-main-price",
        children: [/*#__PURE__*/_jsx("strong", {
          children: formatMoney(product.salePrice)
        }), /*#__PURE__*/_jsx("del", {
          children: formatMoney(product.originalPrice)
        })]
      })]
    }), /*#__PURE__*/_jsxs("span", {
      className: "home2026-flash-discount",
      children: ["-", product.discountPercent, "%"]
    })]
  });
}
function FlashSaleSheet({
  products,
  onClose,
  onBuy,
  secondsLeft,
  endAfter,
  flashTitle,
  buyText,
  closeText,
  getCountdownParts,
  formatCountdown
}) {
  return /*#__PURE__*/_jsxs(CustomerBottomSheet, {
    ariaLabel: flashTitle,
    onClose: onClose,
    className: "home2026-flash-sheet customer-flash-sheet",
    contentClassName: "customer-flash-sheet-scroll",
    showHeader: false,
    children: [/*#__PURE__*/_jsxs("div", {
      className: "home2026-flash-sheet-head",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("p", {
          children: endAfter
        }), /*#__PURE__*/_jsx("h2", {
          children: flashTitle
        })]
      }), /*#__PURE__*/_jsx("span", {
        children: formatCountdown(secondsLeft)
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        onClick: onClose,
        "aria-label": closeText,
        children: /*#__PURE__*/_jsx(Icon, {
          name: "back",
          size: 18
        })
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "home2026-flash-sheet-list",
      children: products.map(product => /*#__PURE__*/_jsx(HomeFlashCard, {
        product: product,
        onBuy: () => onBuy(product),
        buyText: buyText,
        getCountdownParts: getCountdownParts
      }, product.id))
    })]
  });
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
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs("section", {
      className: "home2026-section home2026-flash-deal",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "home2026-deal-head",
        children: [/*#__PURE__*/_jsx("h2", {
          children: dealTitle
        }), /*#__PURE__*/_jsxs("div", {
          className: "home2026-deal-timer",
          children: [/*#__PURE__*/_jsx("span", {
            children: endAfter
          }), /*#__PURE__*/_jsx(HomeDealTimer, {
            getCountdownParts: getCountdownParts,
            secondsLeft: secondsLeft
          })]
        }), canViewAll && /*#__PURE__*/_jsx("button", {
          type: "button",
          onClick: () => setFlashModalOpen(true),
          children: viewAll
        })]
      }), mainFlashProduct && /*#__PURE__*/_jsx(HomeFlashDealCard, {
        product: mainFlashProduct,
        onBuy: () => openOptionModal(mainFlashProduct),
        flashSub: flashSub
      })]
    }), canViewAll && flashModalOpen && /*#__PURE__*/_jsx(FlashSaleSheet, {
      products: flashProducts,
      onClose: () => setFlashModalOpen(false),
      onBuy: product => {
        setFlashModalOpen(false);
        openOptionModal(product);
      },
      secondsLeft: secondsLeft,
      endAfter: endAfter,
      flashTitle: flashTitle,
      buyText: buyText,
      closeText: closeText,
      getCountdownParts: getCountdownParts,
      formatCountdown: formatCountdown
    })]
  });
}