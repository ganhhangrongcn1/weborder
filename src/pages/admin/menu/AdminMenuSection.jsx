import MenuManager from "./MenuManager.jsx";
import AdminProductModal from "./AdminProductModal.jsx";

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

  return (
    <div className="admin-menu-workspace">
      <MenuManager
        products={products}
        setProducts={setProducts}
        toppings={toppings}
        setToppings={setToppings}
        adminCategories={adminCategories}
        setAdminCategories={setAdminCategories}
        optionGroupPresets={optionGroupPresets}
        setOptionGroupPresets={setOptionGroupPresets}
        onEditProduct={setEditingProduct}
      />
      {editingProduct && (
        <AdminProductModal
          product={editingProduct}
          categories={adminCategories.length ? adminCategories : ["Danh mục mặc định"]}
          optionGroupPresets={optionGroupPresets}
          onClose={() => setEditingProduct(null)}
          onSave={(nextProduct) => {
            setProducts((current) => {
              const list = Array.isArray(current) ? current : [];
              const exists = list.some((item) => item.id === nextProduct.id);
              return exists ? list.map((item) => (item.id === nextProduct.id ? nextProduct : item)) : [nextProduct, ...list];
            });
            setEditingProduct(null);
          }}
          onDelete={() => {
            setProducts((current) => {
              const list = Array.isArray(current) ? current : [];
              return list.filter((item) => item.id !== editingProduct.id);
            });
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}
