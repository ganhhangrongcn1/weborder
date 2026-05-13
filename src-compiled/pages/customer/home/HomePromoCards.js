import Icon from "../../../components/Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function HomeProgramCard({
  program
}) {
  return /*#__PURE__*/_jsxs("article", {
    className: "home2026-program-card",
    children: [/*#__PURE__*/_jsx("span", {
      children: /*#__PURE__*/_jsx(Icon, {
        name: program.icon,
        size: 18
      })
    }), /*#__PURE__*/_jsx("strong", {
      children: program.title
    }), /*#__PURE__*/_jsx("p", {
      children: program.text
    })]
  });
}
export default function HomePromoCards({
  programCards
}) {
  return /*#__PURE__*/_jsx("div", {
    className: "home2026-program-grid",
    children: programCards.map(program => /*#__PURE__*/_jsx(HomeProgramCard, {
      program: program
    }, program.title))
  });
}