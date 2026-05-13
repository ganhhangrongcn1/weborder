import Icon from "../../../components/Icon.js";
import AppBanner from "../../../components/app/Banner.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function HomeHero({
  subtitle,
  searchText,
  bannerAria,
  navigate,
  onSearch,
  bannerRef,
  handleBannerScroll,
  banners,
  activeBanner,
  setActiveBanner,
  onBannerClick
}) {
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs("div", {
      className: "home2026-greeting",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("h1", {
          children: "\u01AFu \u0111\xE3i & T\xEDch \u0111i\u1EC3m"
        }), /*#__PURE__*/_jsx("p", {
          children: subtitle
        })]
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        onClick: () => navigate("account", "account"),
        className: "home2026-profile-btn",
        "aria-label": "T\xE0i kho\u1EA3n",
        children: /*#__PURE__*/_jsx("span", {
          className: "home2026-user-outline"
        })
      })]
    }), /*#__PURE__*/_jsxs("button", {
      type: "button",
      onClick: onSearch,
      className: "home2026-search",
      children: [/*#__PURE__*/_jsx(Icon, {
        name: "search",
        size: 17
      }), /*#__PURE__*/_jsx("span", {
        children: searchText
      })]
    }), /*#__PURE__*/_jsxs("div", {
      children: [/*#__PURE__*/_jsx("div", {
        ref: bannerRef,
        onScroll: handleBannerScroll,
        className: "home2026-banner-track no-scrollbar",
        children: banners.map(banner => /*#__PURE__*/_jsx(AppBanner, {
          banner: banner,
          onClick: onBannerClick
        }, banner.id))
      }), /*#__PURE__*/_jsx("div", {
        className: "home2026-dots",
        children: banners.map((banner, index) => /*#__PURE__*/_jsx("button", {
          onClick: () => setActiveBanner(index),
          className: index === activeBanner ? "active" : "",
          "aria-label": `${bannerAria} ${index + 1}`
        }, banner.id))
      })]
    })]
  });
}