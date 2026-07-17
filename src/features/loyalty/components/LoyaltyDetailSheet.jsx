import AppEmptyState from "../../../components/app/EmptyState.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import CouponList from "../../../pages/customer/loyalty/CouponList.jsx";
import PointsCard from "../../../pages/customer/loyalty/PointsCard.jsx";
import { isVoucherExpired } from "../../../utils/pureHelpers.js";
import { CheckinDetails } from "./CheckinCard.jsx";
import PointHistoryList from "./PointHistoryList.jsx";
import TierJourneyCard from "./TierJourneyCard.jsx";

const SHEET_TITLES = {
  tiers: "Hành trình thành viên",
  checkin: "Chi tiết điểm danh",
  rules: "Quy tắc sử dụng điểm",
  vouchers: "Voucher của bạn",
  history: "Lịch sử tích điểm"
};

function VoucherLibrary({ vouchers, onUseVoucher }) {
  const safeVouchers = Array.isArray(vouchers) ? vouchers : [];
  const usableVouchers = safeVouchers.filter(
    (voucher) => !voucher?.canceled && !voucher?.used && !isVoucherExpired(voucher)
  );
  const archivedVouchers = safeVouchers.filter(
    (voucher) => voucher?.canceled || voucher?.used || isVoucherExpired(voucher)
  );

  return (
    <div className="loyalty-voucher-library">
      <section className="loyalty-voucher-group">
        <h3>Dùng được ({usableVouchers.length})</h3>
        <CouponList
          vouchers={usableVouchers}
          isVoucherExpired={isVoucherExpired}
          EmptyState={<AppEmptyState icon={null} message="Chưa có voucher dùng được" />}
          onUseVoucher={onUseVoucher}
        />
      </section>

      {archivedVouchers.length > 0 ? (
        <details className="loyalty-voucher-archive">
          <summary>Lịch sử voucher ({archivedVouchers.length})</summary>
          <div>
            <CouponList
              vouchers={archivedVouchers}
              isVoucherExpired={isVoucherExpired}
              EmptyState={null}
              onUseVoucher={onUseVoucher}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default function LoyaltyDetailSheet({
  activeSheet,
  onClose,
  journey,
  loyalty,
  today,
  recentDays,
  vouchers,
  pointHistory,
  pointRulesRows,
  pointRulesExample,
  onUseVoucher
}) {
  if (!activeSheet) return null;

  return (
    <CustomerBottomSheet
      title={SHEET_TITLES[activeSheet]}
      onClose={onClose}
      className="loyalty-detail-sheet"
      contentClassName="loyalty-detail-sheet__content"
    >
      {activeSheet === "tiers" ? <TierJourneyCard journey={journey} /> : null}
      {activeSheet === "checkin" ? (
        <CheckinDetails loyalty={loyalty} today={today} recentDays={recentDays} />
      ) : null}
      {activeSheet === "rules" ? (
        <PointsCard rows={pointRulesRows} example={pointRulesExample} showTitle={false} />
      ) : null}
      {activeSheet === "vouchers" ? (
        <VoucherLibrary vouchers={vouchers} onUseVoucher={onUseVoucher} />
      ) : null}
      {activeSheet === "history" ? (
        <PointHistoryList entries={pointHistory} pageSize={12} />
      ) : null}
    </CustomerBottomSheet>
  );
}
