import CustomerControl from "../../../components/customer/CustomerControl.jsx";
function HomeCategoryBubble({ category, onClick, active }) {
  return (
    <CustomerControl
      type="button"
      onClick={onClick}
      className={`home2026-category-bubble ${active ? "active" : ""}`}
      aria-pressed={active}
    >
      {category.label}
    </CustomerControl>
  );
}

export default function HomeCategorySection({
  categoryTitle,
  viewAll,
  homeCategories,
  activeHomeCategory,
  onSelectCategory,
  onViewAll
}) {
  return (
    <section className="home2026-section">
      <div className="home2026-section-head">
        <h2>{categoryTitle}</h2>
        <CustomerControl type="button" onClick={onViewAll}>{viewAll}</CustomerControl>
      </div>
      <div className="home2026-category-scroll-wrap">
        <div className="home2026-category-scroll no-scrollbar">
          {homeCategories.map((category) => (
            <HomeCategoryBubble key={category.label} category={category} active={activeHomeCategory === category.value} onClick={() => onSelectCategory(category.value)} />
          ))}
        </div>
      </div>
    </section>
  );
}
