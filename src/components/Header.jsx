import Icon from "./Icon.jsx";

const IconButton = ({ children, onClick, label }) => (
  <button aria-label={label} onClick={onClick} className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-soft">
    {children}
  </button>
);

export default function Header({ points = 120, onAccountClick }) {
  return (
    <header className="sticky top-0 z-30 bg-cream/95 px-4 pb-3 pt-3 backdrop-blur">
      <div className="flex items-center justify-between">
        <button onClick={onAccountClick} className="flex items-center gap-2 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-main text-xl shadow-orange">G</span>
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-wide text-orange-600">Bánh tráng trộn</span>
            <span className="block text-lg font-black leading-5 text-brown">Gánh Hàng Rong</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-2xl bg-white px-3 py-2 text-xs font-extrabold text-brown shadow-soft min-[390px]:block">{points} điểm</div>
          <IconButton label="Thông báo"><Icon name="bell" /></IconButton>
        </div>
      </div>
    </header>
  );
}
