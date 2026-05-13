import { ALL_CATEGORY } from "../menuManager.utils.js";
import { formatMoney } from "../../../../utils/format.js";
import { AdminButton, AdminCard, AdminIconButton, AdminInput, AdminSelect } from "../../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function MenuOverviewPanel({
  createMenuOpen,
  setCreateMenuOpen,
  addProduct,
  addCategory,
  viewFilter,
  setViewFilter,
  selectedAdminCategory,
  setSelectedAdminCategory,
  adminCategories,
  productSearch,
  setProductSearch,
  products,
  categoryStats,
  setCategoryVisibility,
  openCategoryEditor,
  filteredAdminProducts,
  setProductVisibility,
  onEditProduct
}) {
  return /*#__PURE__*/_jsxs(AdminCard, {
    className: "admin-panel admin-menu-section",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-menu-filter-row admin-menu-sticky-toolbar",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-menu-left-actions",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "admin-menu-create-wrap",
          children: [/*#__PURE__*/_jsx(AdminButton, {
            className: "admin-menu-filter-btn",
            onClick: () => setCreateMenuOpen(current => !current),
            children: "Th\xEAm m\u1EDBi"
          }), createMenuOpen ? /*#__PURE__*/_jsxs("div", {
            className: "admin-menu-create-dropdown",
            children: [/*#__PURE__*/_jsx(AdminButton, {
              variant: "ghost",
              onClick: () => {
                addProduct();
                setCreateMenuOpen(false);
              },
              children: "Th\xEAm m\xF3n"
            }), /*#__PURE__*/_jsx(AdminButton, {
              variant: "ghost",
              onClick: () => {
                addCategory();
                setCreateMenuOpen(false);
              },
              children: "Th\xEAm danh m\u1EE5c"
            })]
          }) : null]
        }), /*#__PURE__*/_jsxs(AdminSelect, {
          className: "admin-input",
          value: viewFilter,
          onChange: event => setViewFilter(event.target.value),
          children: [/*#__PURE__*/_jsx("option", {
            value: "all",
            children: "T\u1EA5t c\u1EA3 l\u1ECBch b\xE1n"
          }), /*#__PURE__*/_jsx("option", {
            value: "visible",
            children: "\u0110ang hi\u1EC3n th\u1ECB"
          }), /*#__PURE__*/_jsx("option", {
            value: "hidden",
            children: "\u0110ang \u1EA9n"
          })]
        }), /*#__PURE__*/_jsxs(AdminSelect, {
          className: "admin-input",
          value: selectedAdminCategory,
          onChange: event => setSelectedAdminCategory(event.target.value),
          children: [/*#__PURE__*/_jsx("option", {
            value: ALL_CATEGORY,
            children: "Xem t\u1EA5t c\u1EA3 c\xE1c m\xF3n"
          }), adminCategories.map(category => /*#__PURE__*/_jsx("option", {
            value: category,
            children: category
          }, category))]
        })]
      }), /*#__PURE__*/_jsx(AdminInput, {
        className: "admin-input admin-menu-search",
        value: productSearch,
        onChange: event => setProductSearch(event.target.value),
        placeholder: "T\xECm theo t\xEAn m\xF3n"
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-menu-board admin-menu-overview-board",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-menu-col",
        children: [/*#__PURE__*/_jsx("div", {
          className: "admin-menu-col-head",
          children: /*#__PURE__*/_jsx("strong", {
            children: "Danh m\u1EE5c"
          })
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-menu-categories",
          children: [/*#__PURE__*/_jsxs("button", {
            type: "button",
            className: `admin-menu-category-item ${selectedAdminCategory === ALL_CATEGORY ? "active" : ""}`,
            onClick: () => setSelectedAdminCategory(ALL_CATEGORY),
            children: [/*#__PURE__*/_jsx("span", {
              children: ALL_CATEGORY
            }), /*#__PURE__*/_jsx("em", {
              children: products.length
            })]
          }), adminCategories.map(category => {
            const stat = categoryStats.get(category) || {
              total: 0,
              hidden: 0
            };
            const categoryActive = stat.total > 0 ? stat.hidden < stat.total : true;
            return /*#__PURE__*/_jsxs("div", {
              className: `admin-menu-category-item admin-menu-preset-item ${selectedAdminCategory === category ? "active" : ""}`,
              onClick: () => setSelectedAdminCategory(category),
              role: "button",
              tabIndex: 0,
              onKeyDown: event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedAdminCategory(category);
                }
              },
              children: [/*#__PURE__*/_jsx("span", {
                children: category
              }), /*#__PURE__*/_jsxs("div", {
                className: "admin-menu-preset-actions",
                children: [/*#__PURE__*/_jsxs("em", {
                  children: [stat.total, stat.hidden > 0 ? /*#__PURE__*/_jsx("small", {
                    children: ` • ẩn ${stat.hidden}`
                  }) : null]
                }), /*#__PURE__*/_jsxs("label", {
                  className: "admin-switch",
                  onClick: event => event.stopPropagation(),
                  children: [/*#__PURE__*/_jsx("input", {
                    type: "checkbox",
                    checked: categoryActive,
                    onChange: event => {
                      event.stopPropagation();
                      setCategoryVisibility(category, event.target.checked);
                    }
                  }), /*#__PURE__*/_jsx("span", {})]
                }), /*#__PURE__*/_jsx(AdminIconButton, {
                  label: "Ch\u1EC9nh s\u1EEDa danh m\u1EE5c",
                  className: "admin-menu-preset-edit-btn",
                  onClick: event => {
                    event.stopPropagation();
                    openCategoryEditor(category);
                  },
                  children: "\u270E"
                })]
              })]
            }, category);
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-menu-col admin-menu-products",
        children: [/*#__PURE__*/_jsx("div", {
          className: "admin-menu-col-head",
          children: /*#__PURE__*/_jsx("strong", {
            children: "M\xF3n"
          })
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-menu-product-list",
          children: [filteredAdminProducts.map(product => /*#__PURE__*/_jsxs("button", {
            type: "button",
            onClick: () => onEditProduct?.(product),
            className: "admin-menu-product-row",
            children: [/*#__PURE__*/_jsx("img", {
              src: product.image,
              alt: product.name
            }), /*#__PURE__*/_jsxs("span", {
              children: [/*#__PURE__*/_jsx("strong", {
                children: product.name
              }), /*#__PURE__*/_jsx("em", {
                children: formatMoney(product.price)
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "flex items-center gap-2",
              children: [/*#__PURE__*/_jsx("i", {
                children: product.visible === false ? "Đang ẩn" : "Đang bán"
              }), /*#__PURE__*/_jsxs("label", {
                className: "admin-switch",
                onClick: event => event.stopPropagation(),
                children: [/*#__PURE__*/_jsx("input", {
                  type: "checkbox",
                  checked: product.visible !== false,
                  onChange: event => {
                    event.stopPropagation();
                    setProductVisibility(product.id, event.target.checked);
                  }
                }), /*#__PURE__*/_jsx("span", {})]
              })]
            })]
          }, product.id)), !filteredAdminProducts.length ? /*#__PURE__*/_jsx("p", {
            className: "admin-help-text",
            children: "Kh\xF4ng c\xF3 m\xF3n ph\xF9 h\u1EE3p b\u1ED9 l\u1ECDc hi\u1EC7n t\u1EA1i."
          }) : null]
        })]
      })]
    })]
  });
}