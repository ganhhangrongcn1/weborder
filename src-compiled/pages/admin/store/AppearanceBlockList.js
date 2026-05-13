import { AdminBadge, AdminInput } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AppearanceBlockList({
  search,
  setSearch,
  filteredBlocks,
  getBlockData,
  draggingBlockId,
  setDraggingBlockId,
  reorderBlocks,
  selectedBlockId,
  setSelectedBlockId,
  setBlockActive
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-appearance-col admin-appearance-nav",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-appearance-nav-head",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("strong", {
          children: "Danh s\xE1ch giao di\u1EC7n"
        }), /*#__PURE__*/_jsx("small", {
          children: "B\u1EADt/t\u1EAFt v\xE0 s\u1EAFp x\u1EBFp th\u1EE9 t\u1EF1 block tr\xEAn Home."
        })]
      }), /*#__PURE__*/_jsx(AdminBadge, {
        tone: "brand",
        children: filteredBlocks.length
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-appearance-filterbar",
      children: /*#__PURE__*/_jsx(AdminInput, {
        className: "admin-appearance-search",
        placeholder: "T\xECm theo t\xEAn giao di\u1EC7n, v\u1ECB tr\xED...",
        value: search,
        onChange: event => setSearch(event.target.value)
      })
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-appearance-list",
      role: "list",
      children: filteredBlocks.map(block => {
        const blockData = getBlockData(block.id);
        const isActive = blockData?.active !== false;
        const selected = selectedBlockId === block.id;
        return /*#__PURE__*/_jsxs("button", {
          type: "button",
          draggable: true,
          onDragStart: () => setDraggingBlockId(block.id),
          onDragEnd: () => setDraggingBlockId(""),
          onDragOver: event => event.preventDefault(),
          onDrop: event => {
            event.preventDefault();
            reorderBlocks(draggingBlockId, block.id);
            setDraggingBlockId("");
          },
          onClick: () => setSelectedBlockId(block.id),
          className: `admin-appearance-fixed-item ${selected ? "selected" : ""} ${draggingBlockId === block.id ? "opacity-70" : ""}`,
          role: "listitem",
          children: [/*#__PURE__*/_jsxs("span", {
            className: "admin-appearance-row-main",
            children: [/*#__PURE__*/_jsx("span", {
              className: "admin-appearance-row-icon",
              children: selected ? "✓" : "•"
            }), /*#__PURE__*/_jsxs("span", {
              children: [/*#__PURE__*/_jsx("strong", {
                children: block.title
              }), /*#__PURE__*/_jsx("small", {
                children: block.placement
              })]
            })]
          }), /*#__PURE__*/_jsxs("span", {
            className: "admin-appearance-row-actions",
            children: [/*#__PURE__*/_jsx(AdminBadge, {
              tone: isActive ? "success" : "neutral",
              children: isActive ? "Đang hiển thị" : "Đã ẩn"
            }), /*#__PURE__*/_jsxs("label", {
              className: "admin-switch",
              onClick: event => event.stopPropagation(),
              children: [/*#__PURE__*/_jsx("input", {
                type: "checkbox",
                checked: isActive,
                onChange: event => {
                  event.stopPropagation();
                  setBlockActive(block.id, event.target.checked);
                }
              }), /*#__PURE__*/_jsx("span", {})]
            })]
          })]
        }, block.id);
      })
    })]
  });
}