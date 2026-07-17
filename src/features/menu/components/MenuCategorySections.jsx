import ProductCard from "../../../components/ProductCard.jsx";

export default function MenuCategorySections({
  groups = [],
  registerCategoryRef,
  selectedCounts = {},
  onRemove,
  onOpenProduct,
  onAddProduct
}) {
  return (
    <div className="menu-category-stack">
      {groups.map((group) => (
        <section
          key={group.key}
          ref={(node) => registerCategoryRef(group.category, node)}
          className="menu-category-section"
          data-menu-category={group.key}
          aria-labelledby={`menu-category-${group.key}`}
        >
          <header className="menu-category-section__head">
            <h2 id={`menu-category-${group.key}`}>{group.category}</h2>
            <span>{group.products.length} món</span>
          </header>

          <div className="menu-product-list">
            {group.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                compact
                selectedCount={selectedCounts[product.id] || 0}
                onOpen={onOpenProduct}
                onAdd={onAddProduct}
                onRemove={() => onRemove(product.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
