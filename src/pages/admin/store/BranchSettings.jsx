import { useEffect, useMemo, useState } from "react";
import { goongAutocomplete, goongPlaceDetail, hasGoongApiKey } from "../../../services/goongService.js";
import { DEFAULT_SHIPPING_CONFIG } from "../../../services/shippingService.js";
import { syncBranchesToSupabase } from "../../../services/repositories/catalogConfigRepository.js";
import { AdminButton, AdminCard, AdminInput } from "../ui/index.js";

export default function BranchSettings({
  branches,
  setBranches,
  shippingConfig,
  setShippingConfig,
  onSaveShippingConfig
}) {
  const [addressSuggestions, setAddressSuggestions] = useState({
    branchId: "",
    loading: false,
    items: []
  });
  const [draftBranches, setDraftBranches] = useState(() => (Array.isArray(branches) ? branches : []));
  const [draftShippingConfig, setDraftShippingConfig] = useState(() => ({ ...(shippingConfig || {}) }));
  const [branchSaveMessage, setBranchSaveMessage] = useState("");
  const [shippingSaveMessage, setShippingSaveMessage] = useState("");
  const [branchSaving, setBranchSaving] = useState(false);
  const [shippingSaving, setShippingSaving] = useState(false);
  const getSiteOrigin = () => {
    if (typeof window === "undefined") return "";
    return String(window.location.origin || "").trim();
  };
  const inferBranchCodeFromName = (name = "") => {
    const normalized = String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (normalized.includes("30/4")) return "CN01";
    if (normalized.includes("thich quang duc")) return "CN02";
    if (normalized.includes("le hong phong")) return "CN03";
    return "";
  };
  const getQrBranchKey = (branch) => {
    const branchCode = String(branch?.branch_code || branch?.branchCode || "").trim();
    if (branchCode) return branchCode;
    const inferredBranchCode = inferBranchCodeFromName(branch?.name);
    if (inferredBranchCode) return inferredBranchCode;
    const slug = String(branch?.slug || "").trim();
    if (slug) return slug;
    return String(branch?.id || "").trim();
  };
  const getBranchQrUrl = (branch) => {
    const branchKey = encodeURIComponent(getQrBranchKey(branch));
    return `${getSiteOrigin()}/qr/${branchKey}`;
  };
  const getBranchQrImageUrl = (branch) => {
    const qrData = encodeURIComponent(getBranchQrUrl(branch));
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${qrData}`;
  };
  const downloadBranchQr = (branch) => {
    const anchor = document.createElement("a");
    anchor.href = getBranchQrImageUrl(branch);
    anchor.download = `qr-${String(branch?.id || "branch")}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };
  const printBranchQr = (branch) => {
    const qrUrl = getBranchQrImageUrl(branch);
    const qrLink = getBranchQrUrl(branch);
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>QR ${String(branch?.name || "")}</title>
          <style>
            body { font-family: system-ui, Arial, sans-serif; margin: 0; padding: 24px; }
            .qr-sheet { max-width: 520px; margin: 0 auto; border: 1px solid #ddd; border-radius: 16px; padding: 20px; text-align: center; }
            h1 { font-size: 24px; margin: 0 0 8px; }
            p { margin: 0 0 8px; color: #555; }
            img { width: 320px; height: 320px; object-fit: contain; margin: 12px auto; display: block; }
            .link { font-size: 12px; word-break: break-all; color: #666; }
          </style>
        </head>
        <body>
          <div class="qr-sheet">
            <h1>${String(branch?.name || "Chi nhánh")}</h1>
            <p>${String(branch?.address || "")}</p>
            <p>Quét mã để đặt món tại quầy</p>
            <img src="${qrUrl}" alt="QR order tại quầy" />
            <p class="link">${qrLink}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  useEffect(() => {
    setDraftBranches(Array.isArray(branches) ? branches : []);
  }, [branches]);

  useEffect(() => {
    setDraftShippingConfig({ ...(shippingConfig || {}) });
  }, [shippingConfig]);

  const branchesDirty = useMemo(
    () => JSON.stringify(draftBranches || []) !== JSON.stringify(branches || []),
    [draftBranches, branches]
  );

  const shippingDirty = useMemo(
    () => JSON.stringify(draftShippingConfig || {}) !== JSON.stringify(shippingConfig || {}),
    [draftShippingConfig, shippingConfig]
  );

  const extractOpenCloseTime = (branch) => {
    const defaultOpen = "09:00";
    const defaultClose = "21:00";

    if (branch?.openTime && branch?.closeTime) {
      return {
        openTime: branch.openTime,
        closeTime: branch.closeTime
      };
    }

    const matched = String(branch?.time || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!matched) {
      return {
        openTime: defaultOpen,
        closeTime: defaultClose
      };
    }

    const normalize = (value) => {
      const [hour, minute] = String(value).split(":");
      return `${String(Number(hour)).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`;
    };

    return {
      openTime: normalize(matched[1]),
      closeTime: normalize(matched[2])
    };
  };

  const updateBranchTime = (branchId, nextOpenTime, nextCloseTime) => {
    setDraftBranches(
      draftBranches.map((item) =>
        item.id === branchId
          ? {
              ...item,
              openTime: nextOpenTime,
              closeTime: nextCloseTime,
              time: `${nextOpenTime} - ${nextCloseTime}`
            }
          : item
      )
    );
  };

  const updateBranchField = (branchId, field, value) => {
    setDraftBranches(
      draftBranches.map((item) =>
        item.id === branchId
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    );
  };

  const getNextBranchCode = () => {
    const usedNumbers = (draftBranches || [])
      .map((item) => String(item?.branch_code || item?.branchCode || "").trim().toUpperCase())
      .map((code) => {
        const match = code.match(/^CN(\d{2,})$/);
        return match ? Number(match[1]) : null;
      })
      .filter((value) => Number.isFinite(value));
    const maxUsed = usedNumbers.length ? Math.max(...usedNumbers) : 0;
    const nextNumber = Math.max(1, maxUsed + 1);
    return `CN${String(nextNumber).padStart(2, "0")}`;
  };

  const updateBranchAddress = async (branchId, value) => {
    updateBranchField(branchId, "address", value);

    const keyword = String(value || "").trim();
    if (!hasGoongApiKey() || keyword.length < 3) {
      setAddressSuggestions({ branchId: "", loading: false, items: [] });
      return;
    }

    setAddressSuggestions({ branchId, loading: true, items: [] });
    const items = await goongAutocomplete(keyword);
    setAddressSuggestions({ branchId, loading: false, items: items.slice(0, 5) });
  };

  const pickBranchAddress = async (branch, suggestion) => {
    const detail = await goongPlaceDetail(suggestion.place_id);
    const location = detail?.geometry?.location;
    const formattedAddress = detail?.formatted_address || suggestion.description || branch.address || "";

    setDraftBranches(
      draftBranches.map((item) =>
        item.id === branch.id
          ? {
              ...item,
              address: formattedAddress,
              lat: location?.lat ? String(location.lat) : item.lat,
              lng: location?.lng ? String(location.lng) : item.lng
            }
          : item
      )
    );

    setAddressSuggestions({ branchId: "", loading: false, items: [] });
  };

  const handleSaveBranches = async () => {
    if (!branchesDirty || branchSaving) return;
    setBranchSaving(true);
    setBranchSaveMessage("");
    try {
      setBranches(draftBranches);
      await syncBranchesToSupabase(draftBranches);
      setBranchSaveMessage("Đã lưu chi nhánh lên Supabase.");
    } catch {
      setBranchSaveMessage("Lưu chi nhánh thất bại. Kiểm tra RLS policy write cho catalog.");
    } finally {
      setBranchSaving(false);
    }
  };

  const handleSaveShipping = async () => {
    if (!shippingDirty || shippingSaving) return;
    setShippingSaving(true);
    setShippingSaveMessage("");
    try {
      await onSaveShippingConfig(draftShippingConfig);
      setShippingSaveMessage("Đã lưu cấu hình phí ship lên Supabase.");
    } catch {
      setShippingSaveMessage("Lưu phí ship thất bại. Kiểm tra RLS policy write cho app_configs.");
    } finally {
      setShippingSaving(false);
    }
  };

  return (
    <>
      <AdminCard className="admin-panel admin-store-panel">
        <div className="admin-panel-head">
          <h2>Chi nhánh</h2>
          <div className="flex items-center gap-2">
            <AdminButton
              variant={branchesDirty ? "primary" : "secondary"}
              className={!branchesDirty || branchSaving ? "opacity-70 cursor-not-allowed" : ""}
              disabled={!branchesDirty || branchSaving}
              onClick={handleSaveBranches}
            >
              {branchSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </AdminButton>
            <AdminButton
              onClick={() =>
                setDraftBranches([
                  {
                    id: `branch-${Date.now()}`,
                    branch_code: getNextBranchCode(),
                    name: "Chi nhánh mới",
                    address: "",
                    phone: "",
                    map: "",
                    lat: "",
                    lng: "",
                    shipEnabled: true,
                    pickupEnabled: true,
                    openTime: "09:00",
                    closeTime: "21:00",
                    time: "09:00 - 21:00",
                    open: true
                  },
                  ...draftBranches
                ])
              }
            >
              Thêm chi nhánh
            </AdminButton>
          </div>
        </div>
        {branchSaveMessage ? <p className="text-sm text-slate-600">{branchSaveMessage}</p> : null}
        <div className="admin-table">
          {draftBranches.map((branch) => {
            const { openTime, closeTime } = extractOpenCloseTime(branch);
            const showingSuggestions = addressSuggestions.branchId === branch.id;

            return (
              <div key={branch.id} className="admin-edit-card">
                <div className="admin-branch-layout">
                  <div className="admin-branch-main">
                    <div className="admin-edit-fields admin-branch-top-grid">
                      <AdminInput
                        className="admin-input"
                        placeholder="Mã chi nhánh (ví dụ: CN04)"
                        value={branch.branch_code ?? branch.branchCode ?? ""}
                        onChange={(event) => updateBranchField(branch.id, "branch_code", String(event.target.value || "").toUpperCase().trim())}
                      />
                      <AdminInput
                        className="admin-input"
                        placeholder="Tên chi nhánh"
                        value={branch.name ?? ""}
                        onChange={(event) => updateBranchField(branch.id, "name", event.target.value)}
                      />

                      <div className="relative">
                        <AdminInput
                          className="admin-input"
                          placeholder="Địa chỉ"
                          value={branch.address ?? ""}
                          onChange={(event) => updateBranchAddress(branch.id, event.target.value)}
                        />
                        {showingSuggestions && (addressSuggestions.loading || addressSuggestions.items.length > 0) && (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-orange-100 bg-white p-1 shadow-lg">
                            {addressSuggestions.loading ? (
                              <div className="px-3 py-2 text-xs text-brown/60">Đang tìm địa chỉ...</div>
                            ) : (
                              addressSuggestions.items.map((item) => (
                                <AdminButton
                                  key={item.place_id}
                                  variant="ghost"
                                  className="w-full rounded-xl px-3 py-2 text-left text-xs hover:bg-orange-50"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    pickBranchAddress(branch, item);
                                  }}
                                >
                                  <span>
                                    <strong className="block text-brown">{item.structured_formatting?.main_text || item.description}</strong>
                                    <span className="mt-0.5 block text-brown/60">{item.description}</span>
                                  </span>
                                </AdminButton>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <AdminInput
                        className="admin-input"
                        placeholder="Số điện thoại"
                        value={branch.phone ?? ""}
                        onChange={(event) => updateBranchField(branch.id, "phone", event.target.value)}
                      />

                      <div className="admin-branch-time-grid">
                        <label className="admin-input flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-brown/70">Mở cửa</span>
                          <AdminInput
                            type="time"
                            value={openTime}
                            onChange={(event) => updateBranchTime(branch.id, event.target.value, closeTime)}
                          />
                        </label>
                        <label className="admin-input flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-brown/70">Đóng cửa</span>
                          <AdminInput
                            type="time"
                            value={closeTime}
                            onChange={(event) => updateBranchTime(branch.id, openTime, event.target.value)}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="admin-branch-bottom-grid">
                      <label className="admin-input flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-brown/70">Bật giao hàng chi nhánh này</span>
                        <input
                          type="checkbox"
                          checked={branch.shipEnabled !== false}
                          onChange={(event) => updateBranchField(branch.id, "shipEnabled", event.target.checked)}
                          className="toggle-input"
                        />
                      </label>
                      <label className="admin-input flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-brown/70">Bật đến lấy chi nhánh này</span>
                        <input
                          type="checkbox"
                          checked={branch.pickupEnabled !== false}
                          onChange={(event) => updateBranchField(branch.id, "pickupEnabled", event.target.checked)}
                          className="toggle-input"
                        />
                      </label>
                    </div>
                    <div className="admin-input flex flex-col gap-3">
                      <span className="text-xs font-semibold text-brown/70">QR order tại quầy</span>
                      <code className="rounded-xl bg-white px-3 py-2 text-[11px] leading-5 text-brown/70">
                        {getBranchQrUrl(branch)}
                      </code>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminButton
                          variant="secondary"
                          onClick={async () => {
                            const link = getBranchQrUrl(branch);
                            try {
                              await navigator.clipboard.writeText(link);
                              setBranchSaveMessage("Đã copy link QR chi nhánh.");
                            } catch {
                              setBranchSaveMessage("Không thể copy tự động. Vui lòng copy thủ công.");
                            }
                          }}
                        >
                          Copy link
                        </AdminButton>
                        <AdminButton variant="secondary" onClick={() => downloadBranchQr(branch)}>
                          Tải PNG
                        </AdminButton>
                        <AdminButton variant="secondary" onClick={() => printBranchQr(branch)}>
                          In QR
                        </AdminButton>
                      </div>
                    </div>
                  </div>
                  <div className="admin-branch-actions">
                    <AdminButton variant="danger" className="admin-danger" onClick={() => setDraftBranches(draftBranches.filter((item) => item.id !== branch.id))}>
                      Xóa
                    </AdminButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AdminCard>

      <AdminCard className="admin-panel admin-store-panel">
        <div className="admin-panel-head">
          <h2>Cấu hình phí ship nền tại chi nhánh</h2>
          <AdminButton
            variant={shippingDirty ? "primary" : "secondary"}
            className={!shippingDirty || shippingSaving ? "opacity-70 cursor-not-allowed" : ""}
            disabled={!shippingDirty || shippingSaving}
            onClick={handleSaveShipping}
          >
            {shippingSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </AdminButton>
        </div>
        {shippingSaveMessage ? <p className="text-sm text-slate-600">{shippingSaveMessage}</p> : null}
        <div className="admin-mini-grid admin-ship-compact-grid">
          <div className="admin-mini-card admin-ship-compact-item">
            <label>Phí 3km đầu</label>
            <AdminInput
              className="admin-input"
              type="number"
              value={draftShippingConfig.baseFeeFirst3Km}
              onChange={(event) => setDraftShippingConfig((current) => ({ ...current, baseFeeFirst3Km: Number(event.target.value) }))}
            />
          </div>
          <div className="admin-mini-card admin-ship-compact-item">
            <label>Giá mỗi km tiếp theo</label>
            <AdminInput
              className="admin-input"
              type="number"
              value={draftShippingConfig.feePerNextKm}
              onChange={(event) => setDraftShippingConfig((current) => ({ ...current, feePerNextKm: Number(event.target.value) }))}
            />
          </div>
          <div className="admin-mini-card admin-ship-compact-item">
            <label>Ưu đãi freeship</label>
            <div className="admin-input flex items-center text-xs text-brown/70">
              Cấu hình tại Khuyến mãi → Freeship.
            </div>
          </div>
          <div className="admin-mini-card admin-ship-compact-item">
            <label>Bán kính giao hàng tối đa (km)</label>
            <AdminInput
              className="admin-input"
              type="number"
              value={draftShippingConfig.maxRadiusKm}
              onChange={(event) => setDraftShippingConfig((current) => ({ ...current, maxRadiusKm: Number(event.target.value) }))}
            />
          </div>
          <div className="admin-mini-card admin-ship-compact-item admin-ship-note-item">
            <label>Ghi chú hiển thị cho khách</label>
            <textarea
              className="admin-input"
              rows="4"
              value={draftShippingConfig.customerNote || ""}
              onChange={(event) => setDraftShippingConfig((current) => ({ ...current, customerNote: event.target.value }))}
            />
          </div>
        </div>
        <AdminButton variant="secondary" className="admin-secondary" onClick={() => setDraftShippingConfig({ ...DEFAULT_SHIPPING_CONFIG })}>
          Khôi phục phí ship mặc định
        </AdminButton>
      </AdminCard>
    </>
  );
}

