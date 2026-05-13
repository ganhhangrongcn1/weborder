function HomeCategoryBubble({ category, onClick, active }) {
  return (
    <button type="button" onClick={onClick} className={`home2026-category-bubble ${active ? "active" : ""}`}>
      {category.label}
    </button>
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
        <button type="button" onClick={onViewAll}>{viewAll}</button>
      </div>
      <div className="home2026-category-scroll no-scrollbar">
        {homeCategories.map((category) => (
          <HomeCategoryBubble key={category.label} category={category} active={activeHomeCategory === category.value} onClick={() => onSelectCategory(category.value)} />
        ))}
      </div>
    </section>
  );
}
