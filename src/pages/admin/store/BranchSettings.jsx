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
    } catch (_error) {
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
    } catch (_error) {
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
