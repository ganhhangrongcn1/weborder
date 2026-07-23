import { useEffect, useMemo, useState } from "react";
import { goongAutocomplete, goongPlaceDetail, hasGoongApiKey } from "../../../services/goongService.js";
import { buildPosQrImageUrl, getPosQrPaymentConfig } from "../../../services/posPaymentService.js";
import { DEFAULT_SHIPPING_CONFIG } from "../../../services/shippingService.js";
import { syncBranchesToSupabase } from "../../../services/repositories/catalogConfigRepository.js";
import { createStableBranchUuid } from "../../../services/branchIdentityService.js";
import { createQrPngDataUrl, createQrSvg } from "../../../services/qrCodeService.js";
import { AdminButton, AdminCard, AdminInput } from "../ui/index.js";

const BANK_OPTIONS = [
  { bin: "970422", name: "MB Bank" },
  { bin: "970436", name: "Vietcombank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970405", name: "Agribank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970443", name: "HDBank" },
  { bin: "970437", name: "SeaBank" },
  { bin: "970448", name: "OCB" },
  { bin: "970438", name: "BaoViet Bank" },
  { bin: "970454", name: "VietCapital Bank" },
  { bin: "970441", name: "VIB" },
  { bin: "970440", name: "SHB" },
  { bin: "970400", name: "Saigonbank" },
  { bin: "970439", name: "Public Bank Vietnam" }
];

const QR_ORDER_PUBLIC_ORIGIN = "https://ganhhangrong.vn";

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
  const [previewBranchId, setPreviewBranchId] = useState("");
  const [qrModalBranchId, setQrModalBranchId] = useState("");
  const [expandedBranchId, setExpandedBranchId] = useState("");
  const [expandedPosBranchId, setExpandedPosBranchId] = useState("");
  const [deleteBranchId, setDeleteBranchId] = useState("");
  const [qrRefreshVersionByBranchId, setQrRefreshVersionByBranchId] = useState({});
  const getSiteOrigin = () => {
    return QR_ORDER_PUBLIC_ORIGIN;
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
  const getQrRefreshKey = (branch) => String(branch?.id || getQrBranchKey(branch) || "branch");
  const getBranchQrUrl = (branch) => {
    const branchKey = encodeURIComponent(getQrBranchKey(branch));
    return `${getSiteOrigin()}/qr/${branchKey}`;
  };
  const getBranchQrPreviewUrl = (branch) => {
    const svgMarkup = createQrSvg(getBranchQrUrl(branch), {
      moduleSize: 8,
      quietZone: 4,
      darkColor: "#2f1a10",
      lightColor: "#fffaf3"
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  };
  const getBranchQrPngUrl = (branch) => {
    return createQrPngDataUrl(getBranchQrUrl(branch), {
      moduleSize: 10,
      quietZone: 4,
      darkColor: "#2f1a10",
      lightColor: "#fffaf3"
    });
  };
  const escapePrintText = (value = "") => {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
  const downloadBranchQr = (branch) => {
    const anchor = document.createElement("a");
    anchor.href = getBranchQrPngUrl(branch);
    anchor.download = `qr-order-${String(getQrBranchKey(branch) || branch?.id || "branch").toLowerCase()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };
  const printBranchQr = (branch) => {
    const qrUrl = getBranchQrPngUrl(branch);
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
            <h1>${escapePrintText(branch?.name || "Chi nhánh")}</h1>
            <p>${escapePrintText(branch?.address || "")}</p>
            <p>Quét mã để đặt món tại quầy</p>
            <img src="${qrUrl}" alt="QR order tại quầy" />
            <p class="link">${escapePrintText(qrLink)}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };
  const regenerateBranchQr = (branch) => {
    const refreshKey = getQrRefreshKey(branch);
    setQrRefreshVersionByBranchId((current) => ({
      ...current,
      [refreshKey]: (current[refreshKey] || 0) + 1
    }));
    setBranchSaveMessage(`Đã tạo lại QR chi nhánh theo link ${getBranchQrUrl(branch)}.`);
  };
  const openBranchQrModal = (branch) => {
    setQrModalBranchId(String(branch?.id || ""));
    regenerateBranchQr(branch);
  };

  const getBranchPaymentPreviewUrl = (branch) =>
    buildPosQrImageUrl({
      branch,
      amount: 25000,
      orderIdentity: { displayOrderCode: "TEST-QR" }
    });

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

  const qrModalBranch = useMemo(
    () => draftBranches.find((branch) => String(branch?.id || "") === String(qrModalBranchId || "")) || null,
    [draftBranches, qrModalBranchId]
  );

  const deleteBranch = useMemo(
    () => draftBranches.find((branch) => String(branch?.id || "") === String(deleteBranchId || "")) || null,
    [deleteBranchId, draftBranches]
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

  const updateBranchPaymentField = (branchId, field, value) => {
    setDraftBranches(
      draftBranches.map((item) =>
        item.id === branchId
          ? {
              ...item,
              paymentSettings: {
                ...(item?.paymentSettings && typeof item.paymentSettings === "object" ? item.paymentSettings : {}),
                [field]: typeof value === "boolean" ? value : String(value || "").trim()
              }
            }
          : item
      )
    );
  };

  const updateBranchBankSelection = (branchId, selectedBin) => {
    const matchedBank = BANK_OPTIONS.find((item) => item.bin === String(selectedBin || "").trim());
    setDraftBranches(
      draftBranches.map((item) =>
        item.id === branchId
          ? {
              ...item,
              paymentSettings: {
                ...(item?.paymentSettings && typeof item.paymentSettings === "object" ? item.paymentSettings : {}),
                bankBin: matchedBank?.bin || "",
                bankName: matchedBank?.name || ""
              }
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

  const handleAddBranch = () => {
    const nextBranch = {
      id: `branch-${Date.now()}`,
      branch_code: getNextBranchCode(),
      branch_uuid: createStableBranchUuid(),
      name: "Chi nhánh mới",
      address: "",
      phone: "",
      map: "",
      lat: "",
      lng: "",
      shipEnabled: true,
      pickupEnabled: true,
      paymentSettings: {
        provider: "vietqr",
        bankBin: "",
        bankName: "",
        accountNumber: "",
        accountName: "",
        sepayBankAccountId: "",
        sepayMerchantCode: "",
        webMomoEnabled: true,
        webBankQrEnabled: false,
        webCounterPaymentEnabled: true
      },
      openTime: "09:00",
      closeTime: "21:00",
      time: "09:00 - 21:00",
      open: true
    };
    setDraftBranches((current) => [nextBranch, ...current]);
    setExpandedBranchId(nextBranch.id);
  };

  return (
    <>
      <AdminCard className="admin-panel admin-store-panel">
        <div className="admin-panel-head admin-branch-toolbar">
          <div>
            <h2>Chi nhánh</h2>
            <p className="admin-branch-toolbar__hint">Chọn một chi nhánh để xem và chỉnh cấu hình.</p>
          </div>
          <div className="flex items-center gap-2">
            <AdminButton
              variant={branchesDirty ? "primary" : "secondary"}
              className={!branchesDirty || branchSaving ? "opacity-70 cursor-not-allowed" : ""}
              disabled={!branchesDirty || branchSaving}
              onClick={handleSaveBranches}
            >
              {branchSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </AdminButton>
            <AdminButton onClick={handleAddBranch}>
              Thêm chi nhánh
            </AdminButton>
          </div>
        </div>
        {branchSaveMessage ? <p className="admin-store-message">{branchSaveMessage}</p> : null}
        <div className="admin-table">
          {draftBranches.map((branch) => {
            const { openTime, closeTime } = extractOpenCloseTime(branch);
            const showingSuggestions = addressSuggestions.branchId === branch.id;
            const paymentSettings = branch?.paymentSettings && typeof branch.paymentSettings === "object"
              ? branch.paymentSettings
              : {};
            const webMomoEnabled = paymentSettings.webMomoEnabled !== false;
            const webBankQrEnabled = paymentSettings.webBankQrEnabled === true;
            const webCounterPaymentEnabled = paymentSettings.webCounterPaymentEnabled !== false;
            const enabledWebPaymentCount = [
              webMomoEnabled,
              webBankQrEnabled,
              webCounterPaymentEnabled
            ].filter(Boolean).length;
            const qrPaymentConfig = getPosQrPaymentConfig(branch);
            const paymentPreviewOpen = previewBranchId === branch.id;
            const paymentPreviewUrl = paymentPreviewOpen && qrPaymentConfig.ready ? getBranchPaymentPreviewUrl(branch) : "";
            const qrRefreshKey = getQrRefreshKey(branch);
            const qrRefreshVersion = qrRefreshVersionByBranchId[qrRefreshKey] || 0;
            const branchId = String(branch?.id || "");
            const branchPanelId = `branch-settings-${branchId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            const isExpanded = expandedBranchId === branchId;
            const enabledPaymentLabels = [
              webMomoEnabled ? "MoMo" : "",
              webBankQrEnabled ? "QR ngân hàng" : "",
              webCounterPaymentEnabled ? "Tại quầy" : ""
            ].filter(Boolean);

            return (
              <section
                key={branch.id}
                className={`admin-edit-card admin-branch-card${isExpanded ? " is-expanded" : ""}`}
              >
                <button
                  type="button"
                  className="admin-branch-summary"
                  aria-expanded={isExpanded}
                  aria-controls={branchPanelId}
                  onClick={() => setExpandedBranchId(isExpanded ? "" : branchId)}
                >
                  <span className="admin-branch-summary__identity">
                    <span className="admin-branch-summary__code">
                      {String(branch?.branch_code || branch?.branchCode || getQrBranchKey(branch) || "CN")}
                    </span>
                    <span className="admin-branch-summary__copy">
                      <strong>{String(branch?.name || "Chi nhánh chưa đặt tên")}</strong>
                      <small>{String(branch?.address || "Chưa cập nhật địa chỉ")}</small>
                    </span>
                  </span>
                  <span className="admin-branch-summary__status">
                    <span className={`admin-branch-badge${branch.open === false ? " is-muted" : " is-live"}`}>
                      {branch.open === false ? "Tạm đóng" : "Đang mở"}
                    </span>
                    <span className={`admin-branch-badge${branch.shipEnabled === false ? " is-muted" : ""}`}>
                      {branch.shipEnabled === false ? "Tắt giao hàng" : "Giao hàng"}
                    </span>
                    <span className={`admin-branch-badge${branch.pickupEnabled === false ? " is-muted" : ""}`}>
                      {branch.pickupEnabled === false ? "Tắt đến lấy" : "Đến lấy"}
                    </span>
                  </span>
                  <span className="admin-branch-summary__payment">
                    <small>Website</small>
                    <strong>{enabledPaymentLabels.join(" · ")}</strong>
                  </span>
                  <span className="admin-branch-summary__chevron" aria-hidden="true">⌄</span>
                </button>

                {isExpanded ? (
                <div id={branchPanelId} className="admin-branch-layout">
                  <div className="admin-branch-main">
                    <div className="admin-branch-section-heading">
                      <div>
                        <strong>Thông tin chi nhánh</strong>
                        <small>Tên, địa chỉ, thời gian hoạt động và kênh phục vụ.</small>
                      </div>
                    </div>
                    <div className="admin-edit-fields admin-branch-top-grid">
                      <label className="admin-branch-field-card admin-branch-select-field">
                        <span className="text-xs font-semibold text-brown/70">Mã chi nhánh</span>
                        <AdminInput
                          className="admin-input"
                          name={`branch-code-${branchId}`}
                          autoComplete="off"
                          placeholder="Ví dụ: CN04…"
                          value={branch.branch_code ?? branch.branchCode ?? ""}
                          onChange={(event) => updateBranchField(branch.id, "branch_code", String(event.target.value || "").toUpperCase().trim())}
                        />
                      </label>
                      <label className="admin-branch-field-card admin-branch-select-field">
                        <span className="text-xs font-semibold text-brown/70">Tên chi nhánh</span>
                        <AdminInput
                          className="admin-input"
                          name={`branch-name-${branchId}`}
                          autoComplete="off"
                          placeholder="Nhập tên chi nhánh…"
                          value={branch.name ?? ""}
                          onChange={(event) => updateBranchField(branch.id, "name", event.target.value)}
                        />
                      </label>

                      <label className="admin-branch-field-card admin-branch-select-field relative">
                        <span className="text-xs font-semibold text-brown/70">Địa chỉ</span>
                        <AdminInput
                          className="admin-input"
                          name={`branch-address-${branchId}`}
                          autoComplete="street-address"
                          placeholder="Nhập địa chỉ chi nhánh…"
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
                      </label>

                      <label className="admin-branch-field-card admin-branch-select-field">
                        <span className="text-xs font-semibold text-brown/70">Số điện thoại</span>
                        <AdminInput
                          className="admin-input"
                          type="tel"
                          name={`branch-phone-${branchId}`}
                          autoComplete="tel"
                          placeholder="Nhập số điện thoại…"
                          value={branch.phone ?? ""}
                          onChange={(event) => updateBranchField(branch.id, "phone", event.target.value)}
                        />
                      </label>

                      <div className="admin-branch-time-grid">
                        <label className="admin-branch-field-card admin-branch-time-field">
                          <span className="text-xs font-semibold text-brown/70">Mở cửa</span>
                          <AdminInput
                            type="time"
                            name={`branch-open-time-${branchId}`}
                            value={openTime}
                            onChange={(event) => updateBranchTime(branch.id, event.target.value, closeTime)}
                          />
                        </label>
                        <label className="admin-branch-field-card admin-branch-time-field">
                          <span className="text-xs font-semibold text-brown/70">Đóng cửa</span>
                          <AdminInput
                            type="time"
                            name={`branch-close-time-${branchId}`}
                            value={closeTime}
                            onChange={(event) => updateBranchTime(branch.id, openTime, event.target.value)}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="admin-branch-section-heading is-compact">
                      <div>
                        <strong>Kênh phục vụ</strong>
                        <small>Bật các hình thức nhận đơn đang hoạt động tại chi nhánh.</small>
                      </div>
                    </div>
                    <div className="admin-branch-bottom-grid">
                      <label className="admin-branch-field-card admin-branch-toggle-field">
                        <span className="text-xs font-semibold text-brown/70">Bật giao hàng chi nhánh này</span>
                        <input
                          type="checkbox"
                          name={`branch-shipping-${branchId}`}
                          checked={branch.shipEnabled !== false}
                          onChange={(event) => updateBranchField(branch.id, "shipEnabled", event.target.checked)}
                          className="toggle-input"
                        />
                      </label>
                      <label className="admin-branch-field-card admin-branch-toggle-field">
                        <span className="text-xs font-semibold text-brown/70">Bật đến lấy chi nhánh này</span>
                        <input
                          type="checkbox"
                          name={`branch-pickup-${branchId}`}
                          checked={branch.pickupEnabled !== false}
                          onChange={(event) => updateBranchField(branch.id, "pickupEnabled", event.target.checked)}
                          className="toggle-input"
                        />
                      </label>
                    </div>

                    <div className="admin-branch-section-heading">
                      <div>
                        <strong>Bán hàng trên website</strong>
                        <small>QR order và các hình thức thanh toán khách được phép chọn.</small>
                      </div>
                    </div>
                    <div className="admin-branch-website-grid">
                    <div className="admin-branch-subcard admin-branch-qr-card">
                      <span className="text-xs font-semibold text-brown/70">QR order tại quầy</span>
                      <div className="admin-branch-qr-preview">
                        <img
                          key={`${qrRefreshKey}-${qrRefreshVersion}`}
                          src={getBranchQrPreviewUrl(branch)}
                          alt={`QR order tại quầy ${String(branch?.name || "")}`}
                        />
                        <div>
                          <strong>{String(branch?.branch_code || branch?.branchCode || getQrBranchKey(branch) || "QR")}</strong>
                          <small>Khách quét mã này để mở menu đúng chi nhánh và đặt món tại quầy.</small>
                        </div>
                      </div>
                      <code className="rounded-xl bg-white px-3 py-2 text-[11px] leading-5 text-brown/70">
                        {getBranchQrUrl(branch)}
                      </code>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminButton variant="secondary" onClick={() => openBranchQrModal(branch)}>
                          Xem QR lớn
                        </AdminButton>
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
                        <AdminButton variant="secondary" onClick={() => openBranchQrModal(branch)}>
                          Lưu QR
                        </AdminButton>
                        <AdminButton variant="secondary" onClick={() => printBranchQr(branch)}>
                          In QR
                        </AdminButton>
                      </div>
                    </div>

                    <div className="admin-branch-subcard admin-branch-payment-card">
                      <div>
                        <strong className="block text-sm font-bold text-brown">Thanh toán trên website</strong>
                        <small className="mt-1 block text-xs text-brown/60">
                          Áp dụng cho khách đặt đến lấy hoặc quét QR order tại chi nhánh này.
                        </small>
                      </div>
                      <div className="admin-branch-bottom-grid admin-web-payment-grid">
                        <label className="admin-branch-field-card admin-branch-toggle-field">
                          <span className="text-xs font-semibold text-brown/70">Ví MoMo</span>
                          <input
                            type="checkbox"
                            checked={webMomoEnabled}
                            disabled={webMomoEnabled && enabledWebPaymentCount === 1}
                            onChange={(event) => updateBranchPaymentField(branch.id, "webMomoEnabled", event.target.checked)}
                            className="toggle-input"
                            aria-label={`Cho phép MoMo trên website tại ${String(branch?.name || "chi nhánh")}`}
                          />
                        </label>
                        <label className="admin-branch-field-card admin-branch-toggle-field">
                          <span className="text-xs font-semibold text-brown/70">QR ngân hàng</span>
                          <input
                            type="checkbox"
                            checked={webBankQrEnabled}
                            disabled={webBankQrEnabled && enabledWebPaymentCount === 1}
                            onChange={(event) => updateBranchPaymentField(branch.id, "webBankQrEnabled", event.target.checked)}
                            className="toggle-input"
                            aria-label={`Cho phép QR ngân hàng trên website tại ${String(branch?.name || "chi nhánh")}`}
                          />
                        </label>
                        <label className="admin-branch-field-card admin-branch-toggle-field">
                          <span className="text-xs font-semibold text-brown/70">Thanh toán tại quầy</span>
                          <input
                            type="checkbox"
                            checked={webCounterPaymentEnabled}
                            disabled={webCounterPaymentEnabled && enabledWebPaymentCount === 1}
                            onChange={(event) => updateBranchPaymentField(branch.id, "webCounterPaymentEnabled", event.target.checked)}
                            className="toggle-input"
                            aria-label={`Cho phép thanh toán tại quầy trên website tại ${String(branch?.name || "chi nhánh")}`}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-brown/60">
                        Website phải luôn có ít nhất một hình thức thanh toán. Các công tắc này không ảnh hưởng POS.
                      </p>
                    </div>
                    </div>

                    <div className={`admin-branch-subcard admin-branch-pos-card${expandedPosBranchId === branchId ? " is-expanded" : ""}`}>
                      <button
                        type="button"
                        className="admin-branch-pos-toggle"
                        aria-expanded={expandedPosBranchId === branchId}
                        aria-controls={`branch-pos-${branchPanelId}`}
                        onClick={() => setExpandedPosBranchId(expandedPosBranchId === branchId ? "" : branchId)}
                      >
                        <span>
                          <strong>QR chuyển khoản tại POS</strong>
                          <small>
                            {qrPaymentConfig.ready
                              ? `${paymentSettings.bankName || "Đã cấu hình ngân hàng"} · ${paymentSettings.accountNumber || "Đã có tài khoản"}`
                              : "Chưa đủ thông tin tạo QR chuyển khoản"}
                          </small>
                        </span>
                        <span className="admin-branch-pos-toggle__action">
                          {expandedPosBranchId === branchId ? "Thu gọn" : "Cấu hình nâng cao"}
                          <span aria-hidden="true">⌄</span>
                        </span>
                      </button>
                      {expandedPosBranchId === branchId ? (
                      <div id={`branch-pos-${branchPanelId}`} className="admin-branch-pos-content">
                      <div className="admin-edit-fields admin-pos-payment-grid">
                        <label className="admin-branch-field-card admin-branch-select-field">
                          <span className="text-xs font-semibold text-brown/70">Kiểu QR POS</span>
                          <select
                            className="admin-input"
                            name={`pos-qr-provider-${branchId}`}
                            value={paymentSettings.provider ?? "vietqr"}
                            onChange={(event) => updateBranchPaymentField(branch.id, "provider", event.target.value)}
                          >
                            <option value="vietqr">VietQR thủ công</option>
                            <option value="sepay">SePay tự động</option>
                          </select>
                        </label>
                        <label className="admin-branch-field-card admin-branch-select-field">
                          <span className="text-xs font-semibold text-brown/70">Ngân hàng</span>
                          <select
                            className="admin-input"
                            name={`pos-bank-${branchId}`}
                            value={paymentSettings.bankBin ?? ""}
                            onChange={(event) => updateBranchBankSelection(branch.id, event.target.value)}
                          >
                            <option value="">Chọn ngân hàng</option>
                            {BANK_OPTIONS.map((bank) => (
                              <option key={bank.bin} value={bank.bin}>
                                {bank.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="admin-branch-field-card admin-branch-select-field">
                          <span className="text-xs font-semibold text-brown/70">Tên ngân hàng</span>
                          <AdminInput
                            className="admin-input"
                            name={`pos-bank-name-${branchId}`}
                            autoComplete="off"
                            placeholder="Nhập tên ngân hàng…"
                            value={paymentSettings.bankName ?? ""}
                            onChange={(event) => updateBranchPaymentField(branch.id, "bankName", event.target.value)}
                          />
                        </label>
                        <label className="admin-branch-field-card admin-branch-select-field">
                          <span className="text-xs font-semibold text-brown/70">Số tài khoản</span>
                          <AdminInput
                            className="admin-input"
                            name={`pos-account-number-${branchId}`}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="Nhập số tài khoản…"
                            value={paymentSettings.accountNumber ?? ""}
                            onChange={(event) => updateBranchPaymentField(branch.id, "accountNumber", event.target.value)}
                          />
                        </label>
                        <label className="admin-branch-field-card admin-branch-select-field">
                          <span className="text-xs font-semibold text-brown/70">Tên chủ tài khoản</span>
                          <AdminInput
                            className="admin-input"
                            name={`pos-account-name-${branchId}`}
                            autoComplete="off"
                            placeholder="Nhập tên chủ tài khoản…"
                            value={paymentSettings.accountName ?? ""}
                            onChange={(event) => updateBranchPaymentField(branch.id, "accountName", event.target.value)}
                          />
                        </label>
                        <label className="admin-branch-field-card admin-branch-select-field">
                          <span className="text-xs font-semibold text-brown/70">SePay Bank Account ID</span>
                          <AdminInput
                            className="admin-input"
                            name={`pos-sepay-account-${branchId}`}
                            autoComplete="off"
                            placeholder="Nhập Account ID…"
                            value={paymentSettings.sepayBankAccountId ?? ""}
                            onChange={(event) => updateBranchPaymentField(branch.id, "sepayBankAccountId", event.target.value)}
                          />
                        </label>
                        <label className="admin-branch-field-card admin-branch-select-field">
                          <span className="text-xs font-semibold text-brown/70">Mã cửa hàng SePay</span>
                          <AdminInput
                            className="admin-input"
                            name={`pos-sepay-merchant-${branchId}`}
                            autoComplete="off"
                            placeholder="Ví dụ: CN02…"
                            value={paymentSettings.sepayMerchantCode ?? ""}
                            onChange={(event) => updateBranchPaymentField(branch.id, "sepayMerchantCode", event.target.value.toUpperCase())}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-brown/60">
                        POS dùng các ô này để tạo QR chuyển khoản. Nếu chọn SePay tự động thì chi nhánh này sẽ dùng mã đơn đầy đủ để chờ webhook SePay tự xác nhận thanh toán. Lưu chi nhánh là sẽ cập nhật luôn lên Supabase.
                      </p>
                      {String(paymentSettings.provider || "vietqr").toLowerCase() === "sepay" ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
                          Đang bật chế độ SePay tự động cho chi nhánh này. Khi Edge Function webhook đã deploy đúng trên Supabase thì đơn QR thanh toán xong sẽ tự xác nhận, tự gửi bếp và tự tạo lệnh in bill.
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminButton
                          variant="secondary"
                          onClick={() => setPreviewBranchId(paymentPreviewOpen ? "" : branch.id)}
                        >
                          {paymentPreviewOpen ? "Ẩn QR mẫu" : "Xem trước QR"}
                        </AdminButton>
                        {!qrPaymentConfig.ready ? (
                          <span className="text-xs text-amber-700">
                            Chọn ngân hàng và điền đủ số tài khoản, tên chủ tài khoản để xem QR mẫu.
                          </span>
                        ) : null}
                      </div>
                      {paymentPreviewOpen ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          {qrPaymentConfig.ready ? (
                            <div className="flex flex-col items-center gap-3">
                              <img
                                src={paymentPreviewUrl}
                                alt={`QR thanh toán mẫu ${String(branch?.name || "")}`}
                                className="h-64 w-64 rounded-2xl border border-slate-200 bg-white object-contain p-2"
                              />
                              <div className="grid gap-1 text-center text-xs text-brown/70">
                                <strong className="text-sm text-brown">
                                  QR mẫu {String(branch?.name || "")}
                                </strong>
                                <span>
                                  Chế độ: {String(paymentSettings.provider || "vietqr").toLowerCase() === "sepay" ? "SePay tự động" : "VietQR thủ công"}
                                </span>
                                <span>Số tiền test: 25.000đ</span>
                                <span>Nội dung: TEST-QR</span>
                                <span>{paymentSettings.accountNumber || "Chưa có số tài khoản"} · {paymentSettings.accountName || "Chưa có tên tài khoản"}</span>
                                {paymentSettings.sepayBankAccountId ? (
                                  <span>SePay Account ID: {paymentSettings.sepayBankAccountId}</span>
                                ) : null}
                                {paymentSettings.sepayMerchantCode ? (
                                  <span>SePay Store: {paymentSettings.sepayMerchantCode}</span>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-800">
                              Chi nhánh này chưa đủ thông tin để tạo QR mẫu.
                            </div>
                          )}
                        </div>
                      ) : null}
                      </div>
                      ) : null}
                    </div>

                    <div className="admin-branch-danger-zone">
                      <div>
                        <strong>Xóa chi nhánh</strong>
                        <small>Chỉ dùng khi chi nhánh này không còn hoạt động.</small>
                      </div>
                      <AdminButton
                        variant="danger"
                        className="admin-danger"
                        onClick={() => setDeleteBranchId(branchId)}
                      >
                        Xóa chi nhánh
                      </AdminButton>
                    </div>
                  </div>
                </div>
                ) : null}
              </section>
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
        {shippingSaveMessage ? <p className="admin-store-message">{shippingSaveMessage}</p> : null}
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
            <div className="admin-ship-info-note">
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

      {deleteBranch ? (
        <div className="admin-qr-modal-backdrop" role="presentation" onClick={() => setDeleteBranchId("")}>
          <div
            className="admin-branch-delete-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-branch-title"
            aria-describedby="delete-branch-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="admin-branch-delete-modal__eyebrow">Cài đặt nguy hiểm</span>
            <h3 id="delete-branch-title">Xóa chi nhánh này?</h3>
            <p id="delete-branch-description">
              Bạn sắp xóa <strong>{String(deleteBranch?.name || "chi nhánh")}</strong> khỏi danh sách cấu hình.
              Thay đổi chỉ được cập nhật lên hệ thống sau khi bấm Lưu thay đổi.
            </p>
            <div className="admin-branch-delete-modal__actions">
              <AdminButton variant="secondary" onClick={() => setDeleteBranchId("")}>
                Giữ lại
              </AdminButton>
              <AdminButton
                variant="danger"
                onClick={() => {
                  const targetId = String(deleteBranch?.id || "");
                  setDraftBranches((current) =>
                    current.filter((item) => String(item?.id || "") !== targetId)
                  );
                  if (expandedBranchId === targetId) setExpandedBranchId("");
                  if (expandedPosBranchId === targetId) setExpandedPosBranchId("");
                  setDeleteBranchId("");
                }}
              >
                Xác nhận xóa
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}

      {qrModalBranch ? (
        <div className="admin-qr-modal-backdrop" role="presentation" onClick={() => setQrModalBranchId("")}>
          <div
            className="admin-qr-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`QR order tại quầy ${String(qrModalBranch?.name || "")}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-qr-modal-head">
              <div>
                <span>QR order tại quầy</span>
                <strong>{String(qrModalBranch?.branch_code || qrModalBranch?.branchCode || getQrBranchKey(qrModalBranch) || "QR")}</strong>
              </div>
              <AdminButton variant="secondary" onClick={() => setQrModalBranchId("")}>
                Đóng
              </AdminButton>
            </div>
            <div className="admin-qr-modal-preview">
              <img
                key={`modal-${getQrRefreshKey(qrModalBranch)}-${qrRefreshVersionByBranchId[getQrRefreshKey(qrModalBranch)] || 0}`}
                src={getBranchQrPreviewUrl(qrModalBranch)}
                alt={`QR order tại quầy ${String(qrModalBranch?.name || "")}`}
              />
            </div>
            <div className="admin-qr-modal-hint">
              <strong>Lưu QR trên điện thoại</strong>
              <span>Nhấn giữ ảnh QR rồi chọn Lưu ảnh. Nếu đang dùng Chrome hoặc máy tính, có thể bấm Tải PNG.</span>
            </div>
            <code>{getBranchQrUrl(qrModalBranch)}</code>
            <div className="admin-qr-modal-actions">
              <AdminButton variant="secondary" onClick={() => regenerateBranchQr(qrModalBranch)}>
                Tạo lại QR
              </AdminButton>
              <AdminButton
                variant="secondary"
                onClick={async () => {
                  const link = getBranchQrUrl(qrModalBranch);
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
              <AdminButton variant="secondary" onClick={() => downloadBranchQr(qrModalBranch)}>
                Tải PNG
              </AdminButton>
              <AdminButton variant="secondary" onClick={() => printBranchQr(qrModalBranch)}>
                In QR
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

