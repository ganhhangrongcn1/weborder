import MenuVoucherRail from "../../../features/menu/components/MenuVoucherRail.jsx";

export default function HomeVoucherCarousel({ vouchers = [] }) {
  if (!vouchers.length) return null;
  return (
    <section className="home2026-section home-voucher-section" aria-label="Khuyến mãi cho bạn">
      <div className="customer-voucher-heading"><h2>Khuyến mãi cho bạn</h2><span>{vouchers.length} ưu đãi</span></div>
      <MenuVoucherRail vouchers={vouchers} />
    </section>
  );
}
