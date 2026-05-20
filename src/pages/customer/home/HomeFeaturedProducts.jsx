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
      <div className="home2026-featured-list">
        {featuredProducts.map((product) => (
          <ProductCard key={product.id} product={product} compact onOpen={openOptionModal} onAdd={openOptionModal} />
        ))}
      </div>
    </section>
  );
}
