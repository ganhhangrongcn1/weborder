import ProductCard from "../../../components/ProductCard.jsx";

export default function HomeFeaturedProducts({
  featuredTitle,
  viewMore,
  collapse,
  showAllHomeProducts,
  setShowAllHomeProducts,
  featuredProducts,
  openOptionModal
}) {
  return (
    <section className="home2026-section">
      <div className="home2026-section-head">
        <h2>{featuredTitle}</h2>
        <button type="button" onClick={() => setShowAllHomeProducts((value) => !value)}>
          {showAllHomeProducts ? collapse : viewMore}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 featured-grid product-grid">
        {featuredProducts.map((product) => (
          <ProductCard key={product.id} product={product} onOpen={openOptionModal} onAdd={openOptionModal} />
        ))}
      </div>
    </section>
  );
}
