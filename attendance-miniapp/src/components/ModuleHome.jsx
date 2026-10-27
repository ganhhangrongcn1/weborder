import NavigationIcon from "./NavigationIcon.jsx";

const modules = [
  { page: "membership", title: "Tích điểm", description: "Điểm mua hàng và đổi quà", icon: "membership" },
  { page: "checkin", title: "Điểm danh", description: "Giờ làm và lịch sử điểm danh", icon: "checkin" },
];

export default function ModuleHome({ onChoose }) {
  return <section className="module-choices" aria-label="Chọn chức năng">
    {modules.map((item) => <button key={item.page} className={`module-choice module-${item.page}`} onClick={() => onChoose(item.page)}>
      <span className="module-symbol"><NavigationIcon name={item.icon}/></span>
      <span className="module-copy"><strong>{item.title}</strong><span>{item.description}</span></span>
      <span className="module-arrow" aria-hidden="true">→</span>
    </button>)}
  </section>;
}
