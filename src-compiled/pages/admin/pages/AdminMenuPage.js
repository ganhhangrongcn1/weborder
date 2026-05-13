import AdminMenuSection from "../menu/AdminMenuSection.js";
import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminMenuPage({
  products,
  setProducts,
  adminCategories,
  setAdminCategories,
  toppings,
  setToppings,
  editingProduct,
  setEditingProduct,
  optionGroupPresets,
  setOptionGroupPresets
}) {
  return /*#__PURE__*/_jsx(AdminMenuSection, {
    section: "menu",
    products: products,
    setProducts: setProducts,
    adminCategories: adminCategories,
    setAdminCategories: setAdminCategories,
    toppings: toppings,
    setToppings: setToppings,
    editingProduct: editingProduct,
    setEditingProduct: setEditingProduct,
    optionGroupPresets: optionGroupPresets,
    setOptionGroupPresets: setOptionGroupPresets
  });
}