import Icon from "../../../components/Icon.jsx";

function HomeProgramCard({ program }) {
  return (
    <article className="home2026-program-card">
      <span>
        <Icon name={program.icon} size={18} />
      </span>
      <strong>{program.title}</strong>
      <p>{program.text}</p>
    </article>
  );
}

export default function HomePromoCards({ programCards }) {
  return (
    <div className="home2026-program-grid">
      {programCards.map((program) => (
        <HomeProgramCard key={program.title} program={program} />
      ))}
    </div>
  );
}
