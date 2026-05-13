import Icon from "../../../components/Icon.jsx";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function PointsCard({
  title = "Quy định điểm thưởng",
  rows = []
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "checkin-card",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "flex items-center gap-2",
      children: [/*#__PURE__*/_jsx("span", {
        className: "reward-icon green",
        children: /*#__PURE__*/_jsx(Icon, {
          name: "star",
          size: 17
        })
      }), /*#__PURE__*/_jsx("h2", {
        children: title
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "reward-rules",
      children: rows.map((row, index) => /*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("span", {
          children: row.label
        }), /*#__PURE__*/_jsx("strong", {
          children: row.value
        })]
      }, `${row.label}-${index}`))
    })]
  });
}
