import Icon from "./Icon.jsx";

const iconText = {
  bike: "bag",
  cup: "star",
  gift: "gift",
  sale: "tag"
};

export default function PromoCard({ promo }) {
  return (
    <div className="rounded-[22px] bg-white p-3 text-center shadow-soft">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600"><Icon name={iconText[promo.icon]} size={20} /></div>
      <h3 className="mt-2 text-[11px] font-black uppercase text-brown">{promo.title}</h3>
      <p className="mt-1 text-[10px] font-semibold text-brown/60">{promo.text}</p>
    </div>
  );
}
