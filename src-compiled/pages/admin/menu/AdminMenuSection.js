import MenuManager from "./MenuManager.js";
import AdminProductModal from "./AdminProductModal.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminMenuSection({
  section,
  products,
  setProducts,
  toppings,
  setToppings,
  adminCategories,
  setAdminCategories,
  optionGroupPresets,
  setOptionGroupPresets,
  editingProduct,
  setEditingProduct
}) {
  if (section !== "menu") return null;
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-menu-workspace",
    children: [/*#__PURE__*/_jsx(MenuManager, {
      products: products,
      setProducts: setProducts,
      toppings: toppings,
      setToppings: setToppings,
      adminCategories: adminCategories,
      setAdminCategories: setAdminCategories,
      optionGroupPresets: optionGroupPresets,
      setOptionGroupPresets: setOptionGroupPresets,
      onEditProduct: setEditingProduct
    }), editingProduct && /*#__PURE__*/_jsx(AdminProductModal, {
      product: editingProduct,
      categories: adminCategories.length ? adminCategories : ["Danh mục mặc định"],
      optionGroupPresets: optionGroupPresets,
      onClose: () => setEditingProduct(null),
      onSave: nextProduct => {
        setProducts(current => {
          const list = Array.isArray(current) ? current : [];
          const exists = list.some(item => item.id === nextProduct.id);
          return exists ? list.map(item => item.id === nextProduct.id ? nextProduct : item) : [nextProduct, ...list];
        });
        setEditingProduct(null);
      },
      onDelete: () => {
        setProducts(current => {
          const list = Array.isArray(current) ? current : [];
          return list.filter(item => item.id !== editingProduct.id);
        });
        setEditingProduct(null);
      }
    })]
  });
}