import { useEffect, useState } from "react";
import Icon from "../../../components/Icon.jsx";

export default function MenuPromotionHeading({ items = [] }) {
  const [now, setNow] = useState(Date.now);
  const ends = items.filter((item) => item.offer.source === "flash_sale")
    .map((item) => Date.parse(item.offer.endsAt)).filter(Number.isFinite);
  const deadline = ends.length ? Math.min(...ends) : 0;
  const hasFlash = items.some((item) => item.offer.source === "flash_sale" || item.product.flashPromoId);
  useEffect(() => {
    if (!deadline) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const remaining = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
  return <span className={`menu-promotion-label${hasFlash ? " is-flash" : ""}`}><Icon name={hasFlash ? "flash" : "sale"} size={15} />
    {hasFlash ? "Kết thúc sau" : "Đang giảm"}
    {deadline > 0 && <time dateTime={new Date(deadline).toISOString()} aria-label={seconds ? `Kết thúc sau ${remaining}` : "Đã hết thời gian"}>{seconds ? remaining : "Đã kết thúc"}</time>}
  </span>;
}
