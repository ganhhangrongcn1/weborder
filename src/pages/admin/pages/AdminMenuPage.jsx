import AdminMenuSection from "../menu/AdminMenuSection.jsx";

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
  setOptionGroupPresets,
  branches
}) {
  return (
    <AdminMenuSection
      section="menu"
      products={products}
      setProducts={setProducts}
      adminCategories={adminCategories}
      setAdminCategories={setAdminCategories}
      toppings={toppings}
      setToppings={setToppings}
      editingProduct={editingProduct}
      setEditingProduct={setEditingProduct}
      optionGroupPresets={optionGroupPresets}
      setOptionGroupPresets={setOptionGroupPresets}
      branches={branches}
    />
  );
}
