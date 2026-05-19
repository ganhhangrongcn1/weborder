import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";

function getBranchKeyFromPath(pathname = "") {
  const match = String(pathname || "").match(/^\/qr\/([^/]+)$/i);
  if (!match) return "";
  return decodeURIComponent(match[1] || "").trim().toLowerCase();
}

function inferBranchCodeFromName(name = "") {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("30/4")) return "CN01";
  if (normalized.includes("thich quang duc")) return "CN02";
  if (normalized.includes("le hong phong")) return "CN03";
  return "";
}

function matchBranchByQrKey(branch = {}, key = "") {
  const normalizedKey = String(key || "").trim().toLowerCase();
  if (!normalizedKey) return false;
  const inferredBranchCode = inferBranchCodeFromName(branch?.name);
  const candidates = [
    branch?.branch_code,
    branch?.branchCode,
    inferredBranchCode,
    branch?.branch_uuid,
    branch?.branchUuid,
    branch?.slug,
    branch?.id
  ];
  return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === normalizedKey);
}

export default function QrOrderEntryPage({
  branches = [],
  checkoutPreset,
  setCheckoutPreset,
  navigate,
  isBranchOpenNow,
  buildOutOfHoursNotice,
  setServiceNotice
}) {
  const location = useLocation();
  const branchKey = getBranchKeyFromPath(location.pathname);
  const pickupBranches = useMemo(
    () => (Array.isArray(branches) ? branches.filter((branch) => branch?.pickupEnabled !== false) : []),
    [branches]
  );

  const branch = useMemo(
    () =>
      pickupBranches.find((item) => matchBranchByQrKey(item, branchKey)) || null,
    [pickupBranches, branchKey]
  );

  const handleStartOrder = () => {
    if (!branch) return;
    if (isBranchOpenNow && !isBranchOpenNow(branch)) {
      setServiceNotice?.(buildOutOfHoursNotice?.(branch) || null);
      return;
    }
    setCheckoutPreset?.((current) => ({
      ...(current || {}),
      fulfillmentType: "pickup",
      selectedBranch: branch.id,
      pickupMode: "soon",
      orderSource: "qr_counter",
      source: "qr_counter",
      qrBranchId: String(branch?.branch_code || branch?.branchCode || inferBranchCodeFromName(branch?.name) || branch?.id || ""),
      qrBranchLocked: true,
      qrAutoPickupNow: true
    }));
    navigate("menu", "menu");
  };

  return (
    <section className="px-4 pb-10 pt-5">
      <div className="rounded-[24px] bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-orange-600">
            <Icon name="tag" size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Weborder tại quầy</p>
            <h2 className="mt-1 text-base font-black text-brown">Quét QR đặt món nhanh</h2>
            <p className="mt-1 text-sm text-brown/70">Đơn sẽ được xử lý ngay theo chi nhánh trên mã QR.</p>
          </div>
        </div>

        {branch ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-brown/10 bg-cream px-3 py-3">
              <p className="text-xs font-semibold text-brown/60">Chi nhánh phục vụ</p>
              <p className="mt-1 text-sm font-black text-brown">{branch.name}</p>
              <p className="mt-1 text-xs text-brown/65">{branch.address}</p>
            </div>
            <button type="button" className="cta w-full" onClick={handleStartOrder}>
              Bắt đầu đặt món
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
              Mã QR không hợp lệ hoặc chi nhánh đang tắt tự đến lấy.
            </div>
            <button type="button" className="w-full rounded-2xl border border-brown/20 py-3 text-sm font-black text-brown" onClick={() => navigate("home", "home")}>
              Về trang chủ
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
