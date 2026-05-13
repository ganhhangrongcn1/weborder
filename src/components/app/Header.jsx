import Icon from "../Icon.jsx";

export default function Header({ title, onBack, right }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-cream/95 px-4 backdrop-blur">
      <button onClick={onBack} className="top-icon">{onBack ? <Icon name="back" /> : <Icon name="gear" />}</button>
      <h1 className="text-sm font-black uppercase tracking-wide">{title}</h1>
      <div className="min-w-11">{right || <span />}</div>
    </header>
  );
}
