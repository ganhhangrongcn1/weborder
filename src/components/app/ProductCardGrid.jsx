import ProductCard from "../ProductCard.jsx";

export default function ProductCardGrid({ products, onOpen }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onOpen={onOpen} onAdd={onOpen} />
      ))}
    </div>
  );
}
