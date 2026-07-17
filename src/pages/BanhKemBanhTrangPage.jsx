import { useMemo, useState } from "react";
import { useEffect, useRef } from "react";
import Icon from "../components/Icon.jsx";
import GoongAddressPicker from "../components/GoongAddressPicker.jsx";
import { resolveDeliveryContext, resolvePickupBranches } from "../features/checkout/checkoutDomain.js";
import useCakeProducts from "../hooks/useCakeProducts.js";
import { CAKE_ADDON_MODES, buildCakeZaloMessage, createCakeOrder } from "../services/cakeService.js";
import { notifyCakeOrderWebhook } from "../services/cakeOrderWebhookService.js";
import { buildZaloLink } from "../services/zaloService.js";
import { formatMoney } from "../utils/format.js";
import "../styles/customer-checkout.css";
import "../styles/cake.css";

const EMPTY_FORM = {
  customerName: "",
  customerPhone: "",
  pickupTime: "",
  cakeMessage: "",
  fulfillmentType: "pickup",
  pickupBranchId: "",
  deliveryAddress: "",
  note: "",
  addOnNote: "",
  chibiSelected: false,
  decorationSelected: false,
  decorationOptionId: ""
};

const PICKUP_TIME_WARNING =
  "Vì là món quà để tặng người thân yêu, quán cần ít nhất 120 phút để chuẩn bị bánh đẹp và chỉn chu.";
const CAKE_PICKUP_OPEN_MINUTES = 10 * 60;
const CAKE_PICKUP_CLOSE_MINUTES = 22 * 60;
const ZALO_COMPLETION_DELAY_MS = 4000;

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

function formatDateTimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getMinPickupDateTimeValue(minutes = 120) {
  const minDate = roundUpDateToStep(new Date(Date.now() + Math.max(0, Number(minutes || 0)) * 60000));
  const minMinutes = minDate.getHours() * 60 + minDate.getMinutes();

  if (minMinutes < CAKE_PICKUP_OPEN_MINUTES) {
    minDate.setHours(10, 0, 0, 0);
  }

  if (minMinutes > CAKE_PICKUP_CLOSE_MINUTES) {
    minDate.setDate(minDate.getDate() + 1);
    minDate.setHours(10, 0, 0, 0);
  }

  return formatDateTimeLocal(minDate);
}

function isPickupTimeTooSoon(value, minutes = 120) {
  if (!value) return false;
  const selectedTime = new Date(value).getTime();
  if (Number.isNaN(selectedTime)) return false;
  return selectedTime < Date.now() + Math.max(0, Number(minutes || 0)) * 60000;
}

function roundUpDateToStep(date, stepMinutes = 15) {
  const next = new Date(date);
  const stepMs = Math.max(1, Number(stepMinutes || 15)) * 60000;
  const roundedTime = Math.ceil(next.getTime() / stepMs) * stepMs;
  next.setTime(roundedTime);
  next.setSeconds(0, 0);
  return next;
}

function formatDateValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatTimeValue(value) {
  if (!value) return "";
  return String(value).slice(11, 16);
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return "";
  return `${dateValue}T${timeValue}`;
}

function buildPickupTimeOptions({
  selectedDate,
  minDateTimeValue,
  stepMinutes = 15,
  openMinutes = CAKE_PICKUP_OPEN_MINUTES,
  closeMinutes = CAKE_PICKUP_CLOSE_MINUTES
}) {
  const minDate = formatDateValue(minDateTimeValue);
  const minTime = formatTimeValue(minDateTimeValue);
  const options = [];
  const step = Math.max(1, Number(stepMinutes || 15));

  for (let totalMinutes = openMinutes; totalMinutes <= closeMinutes; totalMinutes += step) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (selectedDate === minDate && value < minTime) continue;
    options.push({
      value,
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    });
  }

  return options;
}

function getBranchOperatingWindow(branch = {}) {
  const scheduleText = String(branch.time || branch.openingHours || branch.opening_hours || "").trim();
  const match = scheduleText.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    return {
      openMinutes: CAKE_PICKUP_OPEN_MINUTES,
      closeMinutes: CAKE_PICKUP_CLOSE_MINUTES,
      label: "10:00 - 22:00"
    };
  }

  const openMinutes = Number(match[1]) * 60 + Number(match[2]);
  const closeMinutes = Number(match[3]) * 60 + Number(match[4]);
  return {
    openMinutes,
    closeMinutes,
    label: `${String(match[1]).padStart(2, "0")}:${match[2]} - ${String(match[3]).padStart(2, "0")}:${match[4]}`
  };
}

function resolveAvailablePickupSelection({ dateValue, timeValue, minDateTimeValue, operatingWindow }) {
  let selectedDate = dateValue || formatDateValue(minDateTimeValue);
  let options = buildPickupTimeOptions({
    selectedDate,
    minDateTimeValue,
    stepMinutes: 15,
    ...operatingWindow
  });

  if (!options.length) {
    const nextDate = new Date(`${selectedDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    selectedDate = formatDateTimeLocal(nextDate).slice(0, 10);
    options = buildPickupTimeOptions({
      selectedDate,
      minDateTimeValue,
      stepMinutes: 15,
      ...operatingWindow
    });
  }

  const selectedTime = options.some((item) => item.value === timeValue)
    ? timeValue
    : options[0]?.value || formatTimeValue(minDateTimeValue);

  return {
    pickupTime: combineDateAndTime(selectedDate, selectedTime),
    options
  };
}

function getCakeAddonMode(product) {
  return product?.addonMode || (product?.useSharedAddons === false ? CAKE_ADDON_MODES.none : CAKE_ADDON_MODES.paid);
}

function getBranchRuntimeId(branch = {}) {
  return String(branch.branchUuid || branch.branch_uuid || branch.uuid || branch.id || "").trim();
}

function branchMatchesRuntimeId(branch = {}, value = "") {
  const target = String(value || "").trim();
  if (!target) return false;
  return [
    getBranchRuntimeId(branch),
    branch.id,
    branch.branchUuid,
    branch.branch_uuid,
    branch.uuid
  ].some((candidate) => String(candidate || "").trim() === target);
}

export default function BanhKemBanhTrangPage({ branches = [] }) {
  const { products, settings, loading, error } = useCakeProducts();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderingProduct, setOrderingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addressInfo, setAddressInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [addonInfoPopup, setAddonInfoPopup] = useState("");
  const [pickupTimeWarningOpen, setPickupTimeWarningOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const modalRootRef = useRef(null);
  const hasOpenModal = Boolean(selectedProduct || orderingProduct || successOrder || pickupTimeWarningOpen || addonInfoPopup);

  useEffect(() => {
    if (!hasOpenModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      modalRootRef.current?.querySelector(".cake-modal__close")?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (addonInfoPopup) setAddonInfoPopup("");
      else if (pickupTimeWarningOpen) setPickupTimeWarningOpen(false);
      else if (successOrder) setSuccessOrder(null);
      else if (orderingProduct) closeOrderForm();
      else if (selectedProduct) setSelectedProduct(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [addonInfoPopup, hasOpenModal, orderingProduct, pickupTimeWarningOpen, selectedProduct, successOrder]);

  const featuredProducts = useMemo(() => {
    const ids = Array.isArray(settings.featuredProductIds) ? settings.featuredProductIds : [];
    const selected = ids.map((id) => products.find((product) => product.id === id)).filter(Boolean);
    return (selected.length ? selected : products).slice(0, 4);
  }, [products, settings.featuredProductIds]);

  const addonCatalog = useMemo(() => settings.addonCatalog || {}, [settings.addonCatalog]);
  const chibiAddon = addonCatalog.chibi || {};
  const decorationAddon = addonCatalog.decoration || {};
  const decorationOptions = Array.isArray(decorationAddon.options) ? decorationAddon.options : [];
  const decorationReferenceImages = Array.isArray(decorationAddon.referenceImages) ? decorationAddon.referenceImages : [];
  const orderingAddonMode = getCakeAddonMode(orderingProduct);
  const canSelectChibi = Boolean(chibiAddon.enabled) && [CAKE_ADDON_MODES.paid, CAKE_ADDON_MODES.includedSet, CAKE_ADDON_MODES.chibiOnly].includes(orderingAddonMode);
  const canSelectDecoration = Boolean(decorationAddon.enabled) && [CAKE_ADDON_MODES.paid, CAKE_ADDON_MODES.includedSet].includes(orderingAddonMode);
  const decorationIncluded = orderingAddonMode === CAKE_ADDON_MODES.includedSet;

  const cakeFulfillment = settings.cakeFulfillment || {};
  const cakeDeliverySourceBranchId = String(cakeFulfillment.deliverySourceBranchId || settings.shippingConfig?.sourceBranchId || "").trim();
  const minPickupLeadMinutes = Number(cakeFulfillment.minPickupLeadMinutes || 120);
  const minPickupTimeValue = useMemo(() => getMinPickupDateTimeValue(minPickupLeadMinutes), [minPickupLeadMinutes]);
  const selectedPickupDateValue = formatDateValue(form.pickupTime) || formatDateValue(minPickupTimeValue);
  const selectedPickupTimeValue = formatTimeValue(form.pickupTime) || formatTimeValue(minPickupTimeValue);
  const shippingConfig = useMemo(() => ({
    ...(settings.shippingConfig || {}),
    sourceBranchId: cakeDeliverySourceBranchId
  }), [cakeDeliverySourceBranchId, settings.shippingConfig]);
  const allPickupBranches = useMemo(() => resolvePickupBranches(branches), [branches]);
  const pickupBranches = useMemo(() => {
    if (cakeFulfillment.pickupEnabled === false) return [];
    const allowedIds = Array.isArray(cakeFulfillment.pickupBranchIds) ? cakeFulfillment.pickupBranchIds : [];
    if (!allowedIds.length) return allPickupBranches;
    return allPickupBranches.filter((branch) => allowedIds.some((id) => branchMatchesRuntimeId(branch, id)));
  }, [allPickupBranches, cakeFulfillment.pickupBranchIds, cakeFulfillment.pickupEnabled]);
  const deliveryContext = useMemo(() => resolveDeliveryContext({
    branches,
    selectedDeliveryBranchId: cakeDeliverySourceBranchId,
    shippingConfig,
    allowDisabledSourceBranch: true
  }), [branches, cakeDeliverySourceBranchId, shippingConfig]);
  const deliveryOrigin = deliveryContext.deliveryOriginReady ? deliveryContext.deliveryOrigin : null;
  const pickupEnabled = pickupBranches.length > 0;
  const deliveryEnabled = cakeFulfillment.deliveryEnabled !== false;
  const defaultFulfillmentType = pickupEnabled ? "pickup" : (deliveryEnabled ? "delivery" : "pickup");
  const selectedPickupBranch = useMemo(() => {
    if (form.pickupBranchId) {
      return pickupBranches.find((branch) => branchMatchesRuntimeId(branch, form.pickupBranchId)) || pickupBranches[0] || null;
    }
    return pickupBranches[0] || null;
  }, [form.pickupBranchId, pickupBranches]);
  const activeServiceBranch = form.fulfillmentType === "delivery"
    ? deliveryContext.deliverySourceBranch
    : selectedPickupBranch;
  const activeOperatingWindow = useMemo(
    () => getBranchOperatingWindow(activeServiceBranch || {}),
    [activeServiceBranch]
  );
  const pickupTimeOptions = useMemo(
    () => buildPickupTimeOptions({
      selectedDate: selectedPickupDateValue,
      minDateTimeValue: minPickupTimeValue,
      stepMinutes: 15,
      ...activeOperatingWindow
    }),
    [activeOperatingWindow, minPickupTimeValue, selectedPickupDateValue]
  );

  const addOnTotal = useMemo(() => {
    const chibiPrice = canSelectChibi && form.chibiSelected ? Number(chibiAddon.price || 0) : 0;
    const selectedDecorationOption = decorationOptions.find((item) => item.id === form.decorationOptionId);
    const decorationPrice = canSelectDecoration && !decorationIncluded && form.decorationSelected ? Number(selectedDecorationOption?.price ?? decorationAddon.price ?? 0) : 0;
    return chibiPrice + decorationPrice;
  }, [canSelectChibi, canSelectDecoration, chibiAddon.price, decorationAddon.price, decorationIncluded, decorationOptions, form.chibiSelected, form.decorationOptionId, form.decorationSelected]);

  const finalCakePrice = Number(orderingProduct?.price || 0) + addOnTotal;

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updatePickupDate = (value) => {
    const nextDate = value || formatDateValue(minPickupTimeValue);
    const options = buildPickupTimeOptions({
      selectedDate: nextDate,
      minDateTimeValue: minPickupTimeValue,
      stepMinutes: 15,
      ...activeOperatingWindow
    });
    const nextTime = options.some((item) => item.value === selectedPickupTimeValue)
      ? selectedPickupTimeValue
      : options[0]?.value || formatTimeValue(minPickupTimeValue);
    updateForm("pickupTime", combineDateAndTime(nextDate, nextTime));
  };

  const updatePickupClock = (value) => {
    updateForm("pickupTime", combineDateAndTime(selectedPickupDateValue, value || pickupTimeOptions[0]?.value || selectedPickupTimeValue));
  };

  const updateFulfillmentType = (fulfillmentType) => {
    const nextBranch = fulfillmentType === "delivery" ? deliveryContext.deliverySourceBranch : selectedPickupBranch;
    const selection = resolveAvailablePickupSelection({
      dateValue: selectedPickupDateValue,
      timeValue: selectedPickupTimeValue,
      minDateTimeValue: minPickupTimeValue,
      operatingWindow: getBranchOperatingWindow(nextBranch || {})
    });
    setForm((current) => ({ ...current, fulfillmentType, pickupTime: selection.pickupTime }));
    setMessage("");
  };

  const selectPickupBranch = (branch, branchId) => {
    const selection = resolveAvailablePickupSelection({
      dateValue: selectedPickupDateValue,
      timeValue: selectedPickupTimeValue,
      minDateTimeValue: minPickupTimeValue,
      operatingWindow: getBranchOperatingWindow(branch)
    });
    setForm((current) => ({ ...current, pickupBranchId: branchId, pickupTime: selection.pickupTime }));
    setMessage("");
  };

  const openOrderForm = (product) => {
    const productAddonMode = getCakeAddonMode(product);
    const productCanSelectDecoration = Boolean(decorationAddon.enabled) && [CAKE_ADDON_MODES.paid, CAKE_ADDON_MODES.includedSet].includes(productAddonMode);
    const productDecorationIncluded = productAddonMode === CAKE_ADDON_MODES.includedSet;
    const initialDecorationOptionId = productCanSelectDecoration ? decorationOptions[0]?.id || "" : "";
    setOrderingProduct(product);
    setSelectedProduct(null);
    setForm((current) => ({
      ...EMPTY_FORM,
      pickupBranchId: current.pickupBranchId || getBranchRuntimeId(pickupBranches[0]) || "",
      pickupTime: minPickupTimeValue,
      fulfillmentType: defaultFulfillmentType,
      decorationSelected: productDecorationIncluded,
      decorationOptionId: initialDecorationOptionId
    }));
    setMessage("");
    setSuccessOrder(null);
  };

  const closeOrderForm = () => {
    setOrderingProduct(null);
    setForm(EMPTY_FORM);
    setAddressInfo(null);
    setMessage("");
  };

  const openProductDetail = (product) => {
    setSelectedProduct(product);
  };

  const copySuccessZaloMessage = () => {
    if (!successOrder?.zaloMessage) return;
    copyText(successOrder.zaloMessage).catch(() => {});
    setSuccessOrder((current) => current ? { ...current, hasOpenedZalo: true, isCompletingZalo: true } : current);
    window.setTimeout(() => {
      setSuccessOrder((current) => current ? { ...current, isCompletingZalo: false, zaloSent: true } : current);
    }, ZALO_COMPLETION_DELAY_MS);
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!orderingProduct || submitting) return;
    if (isPickupTimeTooSoon(form.pickupTime, minPickupLeadMinutes)) {
      setPickupTimeWarningOpen(true);
      return;
    }
    if (form.fulfillmentType === "delivery" && !String(addressInfo?.addressText || form.deliveryAddress || "").trim()) {
      setMessage("Vui lòng chọn địa chỉ giao hàng để quán kiểm tra khoảng cách và phí ship.");
      return;
    }
    setSubmitting(true);
    setMessage("");

    const selectedDecorationOption = decorationOptions.find((item) => item.id === form.decorationOptionId);
    const selectedAddOns = {
      chibi: {
        selected: canSelectChibi ? Boolean(form.chibiSelected) : false,
        name: chibiAddon.name || "Hình chibi cá nhân hóa",
        price: Number(chibiAddon.price || 0)
      },
      decoration: {
        selected: canSelectDecoration ? Boolean(decorationIncluded || form.decorationSelected) : false,
        name: decorationAddon.name || "Phụ kiện trang trí theo yêu cầu",
        optionId: selectedDecorationOption?.id || "",
        optionName: selectedDecorationOption?.name || "",
        price: decorationIncluded ? 0 : Number(selectedDecorationOption?.price ?? decorationAddon.price ?? 0)
      }
    };

    const deliveryAddress = addressInfo?.addressText || form.deliveryAddress || "";
    const shippingFee = form.fulfillmentType === "delivery" ? addressInfo?.deliveryFee ?? null : 0;
    const saved = await createCakeOrder({
      cakeId: orderingProduct.id,
      cakeName: orderingProduct.name,
      cakePrice: orderingProduct.price,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      pickupTime: form.pickupTime,
      cakeMessage: form.cakeMessage,
      fulfillmentType: form.fulfillmentType,
      deliveryAddress,
      deliveryLat: addressInfo?.lat ?? null,
      deliveryLng: addressInfo?.lng ?? null,
      distanceKm: addressInfo?.distanceKm ?? null,
      shippingFee,
      note: form.note,
      metadata: {
        product: orderingProduct,
        addressInfo,
        pickupBranch: selectedPickupBranch,
        selectedAddOns,
        addOnTotal,
        finalCakePrice,
        addOnNote: form.addOnNote || ""
      }
    });

    const zaloMessage = buildCakeZaloMessage({
      product: orderingProduct,
      form: {
        ...form,
        pickupBranchName: selectedPickupBranch?.name || settings.pickupAddress,
        pickupBranchAddress: selectedPickupBranch?.address || "",
        addOnNote: form.addOnNote || ""
      },
      addressInfo,
      shippingFee,
      orderCode: saved.orderCode,
      selectedAddOns,
      addOnTotal,
      finalTotal: finalCakePrice
    });

    try {
      await copyText(zaloMessage);
      setMessage("");
    } catch (_error) {
      setMessage("");
    }

    notifyCakeOrderWebhook({
      saved,
      product: orderingProduct,
      form,
      addressInfo,
      selectedPickupBranch,
      selectedAddOns,
      addOnTotal,
      finalCakePrice,
      shippingFee,
      deliveryAddress,
      zaloMessage
    }).catch((error) => {
      console.warn("[cake] n8n webhook failed", error);
    });

    setSubmitting(false);
    setSuccessOrder({
      orderCode: saved.orderCode,
      savedOk: saved.ok,
      productName: orderingProduct.name,
      zaloMessage,
      zaloWebLink: buildZaloLink(settings.zaloPhone, zaloMessage)
    });
    setOrderingProduct(null);
    setForm(EMPTY_FORM);
    setAddressInfo(null);
  };

  return (
    <main className="cake-page">
      <section className="cake-hero">
        <div className="cake-hero__content">
          <p className="cake-eyebrow">Gánh Hàng Rong</p>
          <h1>Bánh sinh nhật bánh tráng</h1>
          <p>Chọn mẫu bánh tráng sinh nhật, ghi tên theo yêu cầu, nhận tại quán hoặc giao hàng cẩn thận.</p>
          <div className="cake-hero__actions">
            <a href="#cake-list">Xem mẫu bánh</a>
            <span>{settings.orderNotice}</span>
          </div>
        </div>
        <div className="cake-hero__featured">
          <div className="cake-hero__featured-head">
            <p>Mẫu bán chạy</p>
            <span>Khách đặt nhiều</span>
          </div>
          <div className="cake-hero__grid" aria-label="Mẫu bánh bán chạy">
            {featuredProducts.map((product) => (
              <button key={product.id} type="button" onClick={() => setSelectedProduct(product)} aria-label={`Xem chi tiết ${product.name}`}>
                <img src={product.image} alt={product.name} width="520" height="520" decoding="async" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="cake-list" className="cake-list-section">
        <div className="cake-section-head">
          <div>
            <p className="cake-eyebrow">Danh sách mẫu</p>
            <h2>Chọn bánh muốn tư vấn</h2>
          </div>
          <p>{loading ? "Đang tải dữ liệu…" : `${products.length} mẫu đang bán`}</p>
        </div>

        {error ? <p className="cake-empty-state">{error}</p> : null}
        {!loading && !error && !products.length ? <p className="cake-empty-state">Hiện chưa có mẫu bánh nào đang hiển thị.</p> : null}

        {products.length ? (
          <div className="cake-grid">
            {products.map((product) => (
              <article key={product.id} className="cake-card">
                <button type="button" className="cake-card__image" onClick={() => openProductDetail(product)} aria-label={`Xem chi tiết ${product.name}`}>
                  <img src={product.image} alt={product.name} width="640" height="640" loading="lazy" decoding="async" />
                  <span className="cake-card__badge">{product.serving}</span>
                  <strong className="cake-card__price">{formatMoney(product.price)}</strong>
                </button>
                <div className="cake-card__body">
                  <h3>{product.name}</h3>
                  <p>{product.size}</p>
                  <button type="button" onClick={() => openProductDetail(product)}>Xem chi tiết</button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {selectedProduct && (
        <div ref={modalRootRef} className="cake-modal" role="dialog" aria-modal="true" aria-labelledby="cake-detail-title">
          <button type="button" className="cake-modal__backdrop" aria-label="Đóng chi tiết bánh" tabIndex="-1" onClick={() => setSelectedProduct(null)} />
          <div className="cake-detail">
            <button className="cake-modal__close" type="button" onClick={() => setSelectedProduct(null)} aria-label="Đóng chi tiết bánh">×</button>
            <div className="cake-detail__image-wrap">
              <img className="cake-detail__image" src={selectedProduct.image} alt={selectedProduct.name} width="760" height="760" decoding="async" />
            </div>
            <div className="cake-detail__content">
              <p className="cake-eyebrow"><Icon name="user" size={13} /> {selectedProduct.serving}</p>
              <h2 id="cake-detail-title">{selectedProduct.name}</h2>
              <strong>{formatMoney(selectedProduct.price)}</strong>
              <p>{selectedProduct.description}</p>

              <div className="cake-detail__meta">
                <span>{selectedProduct.size}</span>
              </div>

              <div className="cake-accessory-stack">
                <h3>Thành phần bánh</h3>
                <ul>{selectedProduct.ingredients.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>

              <div className="cake-accessory-stack">
                <h3>Phụ kiện đi kèm mặc định</h3>
                <ul className="cake-sticker-list">
                  {(Array.isArray(selectedProduct.accessories) ? selectedProduct.accessories : []).map((item) => (
                    <li key={item}>
                      <Icon name="gift" size={12} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button className="cake-primary-btn" type="button" onClick={() => openOrderForm(selectedProduct)}>Đặt mẫu này</button>
            </div>
          </div>
        </div>
      )}

      {orderingProduct && (
        <div ref={modalRootRef} className="cake-modal" role="dialog" aria-modal="true" aria-labelledby="cake-order-title">
          <button type="button" className="cake-modal__backdrop" aria-label="Đóng form đặt bánh" tabIndex="-1" onClick={closeOrderForm} />
          <form className="cake-order-form" onSubmit={submitOrder}>
            <button className="cake-modal__close" type="button" onClick={closeOrderForm} aria-label="Đóng form đặt bánh">×</button>
            <div className="cake-order-form__head">
              <img src={orderingProduct.image} alt={orderingProduct.name} width="96" height="96" decoding="async" />
              <div>
                <p className="cake-eyebrow">Tạo đơn bánh</p>
                <h2 id="cake-order-title">{orderingProduct.name}</h2>
                <strong>{formatMoney(finalCakePrice)}</strong>
              </div>
            </div>

            {canSelectChibi || canSelectDecoration ? (
            <details className="cake-addon-disclosure">
              <summary>
                <span>Thêm phụ kiện theo yêu cầu</span>
                <small>Chibi, phụ kiện trang trí và ghi chú riêng</small>
              </summary>
              <div className="cake-addon-order-box">
              <h3>Tùy chọn phụ kiện</h3>
              {canSelectChibi ? (
                <label className="cake-addon-check">
                  <input
                    type="checkbox"
                    checked={form.chibiSelected}
                    onChange={(event) => updateForm("chibiSelected", event.target.checked)}
                  />
                  <span>{chibiAddon.name} (+{formatMoney(Number(chibiAddon.price || 0))})</span>
                  <button type="button" onClick={() => setAddonInfoPopup("chibi")}>Chi tiết</button>
                </label>
              ) : null}

              {canSelectDecoration ? (
                <>
                  {decorationIncluded ? (
                    <div className="cake-addon-check cake-addon-check--included">
                      <span>{decorationAddon.name} (Đã bao gồm)</span>
                      <button type="button" onClick={() => setAddonInfoPopup("decoration")}>Xem mẫu</button>
                    </div>
                  ) : (
                    <label className="cake-addon-check">
                      <input
                        type="checkbox"
                        checked={form.decorationSelected}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          updateForm("decorationSelected", checked);
                          if (checked && !form.decorationOptionId && decorationOptions[0]) {
                            updateForm("decorationOptionId", decorationOptions[0].id);
                          }
                        }}
                      />
                      <span>{decorationAddon.name} (+{formatMoney(Number(decorationAddon.price || 0))})</span>
                      <button type="button" onClick={() => setAddonInfoPopup("decoration")}>Xem mẫu</button>
                    </label>
                  )}

                  {(decorationIncluded || form.decorationSelected) ? (
                    <div className="cake-addon-option-grid">
                      {decorationOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={form.decorationOptionId === item.id ? "is-active" : ""}
                          onClick={() => updateForm("decorationOptionId", item.id)}
                        >
                          <img src={item.image} alt={item.name} width="320" height="240" loading="lazy" decoding="async" />
                          <strong>{item.name}</strong>
                          <span>{decorationIncluded ? "Đã bao gồm" : `+${formatMoney(Number(item.price || 0))}`}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              <label>
                <span>Ghi chú phụ kiện</span>
                <textarea
                  rows="2"
                  name="addOnNote"
                  value={form.addOnNote}
                  onChange={(event) => updateForm("addOnNote", event.target.value)}
                  placeholder="VD: Chọn mẫu 2, đổi màu nơ vàng…"
                />
              </label>
              </div>
            </details>
            ) : null}

            <section className="cake-form-section" aria-labelledby="cake-contact-section">
              <h3 id="cake-contact-section"><span>1</span> Thông tin người nhận</h3>
              <div className="cake-form-grid">
                <label>
                  <span>Tên người nhận</span>
                  <input
                    name="customerName"
                    value={form.customerName}
                    onChange={(event) => updateForm("customerName", event.target.value)}
                    required
                    autoComplete="name"
                    placeholder="VD: Nguyễn Minh An…"
                  />
                </label>
                <label>
                  <span>Số điện thoại</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    name="customerPhone"
                    value={form.customerPhone}
                    onChange={(event) => updateForm("customerPhone", event.target.value)}
                    required
                    autoComplete="tel"
                    pattern="0[0-9]{9}"
                    title="Nhập số điện thoại Việt Nam gồm 10 chữ số và bắt đầu bằng số 0."
                    placeholder="VD: 0901234567…"
                  />
                </label>
              </div>
            </section>

            <section className="cake-form-section" aria-labelledby="cake-fulfillment-section">
              <h3 id="cake-fulfillment-section"><span>2</span> Cách nhận bánh</h3>
              <div className="cake-segmented" role="group" aria-label="Hình thức nhận bánh">
                {pickupEnabled ? (
                  <button
                    type="button"
                    className={form.fulfillmentType === "pickup" ? "is-active" : ""}
                    aria-pressed={form.fulfillmentType === "pickup"}
                    onClick={() => updateFulfillmentType("pickup")}
                  >
                    <Icon name="home" size={17} />
                    <span>Tự đến lấy</span>
                  </button>
                ) : null}
                {deliveryEnabled ? (
                  <button
                    type="button"
                    className={form.fulfillmentType === "delivery" ? "is-active" : ""}
                    aria-pressed={form.fulfillmentType === "delivery"}
                    onClick={() => updateFulfillmentType("delivery")}
                  >
                    <Icon name="bike" size={17} />
                    <span>Giao hàng</span>
                  </button>
                ) : null}
              </div>

              {form.fulfillmentType === "delivery" && deliveryEnabled ? (
                <GoongAddressPicker
                  value={addressInfo || { addressText: form.deliveryAddress }}
                  onChange={(value) => {
                    setAddressInfo(value);
                    updateForm("deliveryAddress", value.addressText || "");
                  }}
                  origin={deliveryOrigin}
                  originLabel={deliveryContext.deliverySourceBranch?.name || ""}
                  originAddress={deliveryContext.deliverySourceBranch?.address || ""}
                  requireOrigin
                  shippingConfig={shippingConfig}
                />
              ) : (
                <div className="cake-pickup-branches">
                  <p className="cake-pickup-title">Chọn chi nhánh ghé lấy</p>
                  {(pickupBranches.length ? pickupBranches : [{ id: "default", name: settings.pickupAddress, address: "", time: "" }]).map((branch) => {
                    const branchId = getBranchRuntimeId(branch) || branch.id;
                    const isSelected = branchMatchesRuntimeId(selectedPickupBranch, branchId);
                    return (
                      <button
                        key={branchId}
                        type="button"
                        className={`branch-card ${isSelected ? "branch-card-active" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() => selectPickupBranch(branch, branchId)}
                      >
                        <span className="cake-branch-icon">
                          <Icon name="home" size={18} />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <strong>{branch.name}</strong>
                          {branch.address ? <small>{branch.address}</small> : null}
                          {branch.time ? <em>{branch.time}</em> : null}
                        </span>
                        <span className="branch-radio">{isSelected ? "✓" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="cake-form-section" aria-labelledby="cake-time-section">
              <h3 id="cake-time-section"><span>3</span> Thời gian và lời nhắn</h3>
              <div className="cake-form-grid">
                <div className="cake-time-picker">
                  <div>
                    <span>Ngày giờ muốn lấy</span>
                    <small>
                      Quán cần ít nhất {minPickupLeadMinutes} phút để chuẩn bị. Khung giờ hiện tại: {activeOperatingWindow.label}.
                    </small>
                  </div>
                  <label>
                    <span>Ngày lấy</span>
                    <input
                      type="date"
                      name="pickupDate"
                      min={formatDateValue(minPickupTimeValue)}
                      value={selectedPickupDateValue}
                      onChange={(event) => updatePickupDate(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Giờ lấy</span>
                    <select
                      name="pickupTime"
                      value={pickupTimeOptions.some((item) => item.value === selectedPickupTimeValue) ? selectedPickupTimeValue : pickupTimeOptions[0]?.value || ""}
                      onChange={(event) => updatePickupClock(event.target.value)}
                      required
                    >
                      {pickupTimeOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Chữ ghi trên bánh</span>
                  <input
                    name="cakeMessage"
                    value={form.cakeMessage}
                    onChange={(event) => updateForm("cakeMessage", event.target.value)}
                    autoComplete="off"
                    placeholder="VD: Chúc mừng sinh nhật An"
                  />
                </label>
              </div>

              <label className="cake-note-field">
                <span>Ghi chú cho quán</span>
                <textarea
                  rows="3"
                  name="note"
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  placeholder="Ví dụ: ít cay, gọi trước khi giao…"
                />
              </label>
            </section>

            <button className="cake-primary-btn cake-order-submit" type="submit" disabled={submitting} aria-busy={submitting ? "true" : "false"}>
              {submitting ? "Đang tạo đơn…" : "Tạo đơn và gửi Zalo"}
            </button>
            {message ? <p className="cake-form-message" role="status" aria-live="polite">{message}</p> : null}
            <p className="cake-zalo-copy-note">
              App sẽ chuẩn bị nội dung đơn để bạn gửi Zalo cho quán xác nhận.
            </p>
          </form>
        </div>
      )}

      {successOrder ? (
        <div ref={modalRootRef} className="cake-modal" role="dialog" aria-modal="true" aria-labelledby="cake-success-title">
          <button type="button" className="cake-modal__backdrop" aria-label="Đóng thông báo đặt bánh" tabIndex="-1" onClick={() => setSuccessOrder(null)} />
          <div className="cake-success-popup">
            <button className="cake-modal__close" type="button" onClick={() => setSuccessOrder(null)} aria-label="Đóng thông báo đặt bánh">×</button>
            <div className="cake-success-popup__icon">{successOrder.zaloSent ? "✓" : successOrder.isCompletingZalo ? "…" : "!"}</div>
            <p className="cake-eyebrow">{successOrder.zaloSent ? "Đã hoàn tất" : successOrder.isCompletingZalo ? "Đang mở Zalo" : "Gần xong rồi"}</p>
            <h3 id="cake-success-title">{successOrder.zaloSent ? "Cảm ơn bạn, quán sẽ xác nhận đơn sớm" : successOrder.isCompletingZalo ? "Đang mở Zalo để gửi đơn…" : "Gửi tin nhắn Zalo để quán xác nhận mẫu bánh"}</h3>
            {successOrder.zaloSent ? (
              <p>
                CSKH sẽ kiểm tra tin nhắn Zalo, xác nhận mẫu bánh, giờ nhận và các ghi chú trang trí với bạn.
              </p>
            ) : successOrder.isCompletingZalo ? (
              <p>
                App đang chuyển bạn sang Zalo. Nội dung đơn đã được copy sẵn, bạn chỉ cần dán vào khung chat và gửi cho quán.
              </p>
            ) : (
              <>
                <p>
                Nội dung đơn đã được chuẩn bị sẵn. Bạn chỉ cần mở Zalo, dán tin nhắn và gửi cho quán.
                </p>
                <p>
                Quán sẽ kiểm tra mẫu bánh, giờ nhận và ghi chú trang trí trước khi xác nhận.
                </p>
              </>
            )}
            <div className="cake-success-popup__code">
              <span>Mã tham chiếu</span>
              <strong>{successOrder.orderCode || "Đang tạo"}</strong>
            </div>
            {!successOrder.savedOk ? (
              <p className="cake-success-popup__note">
                Nếu đơn chưa lưu vào hệ thống, CSKH vẫn có thể nhập lại đơn từ nội dung bạn gửi qua Zalo.
              </p>
            ) : null}
            <div className="cake-success-popup__actions">
              {successOrder.zaloSent ? (
                <button className="cake-primary-btn" type="button" onClick={() => setSuccessOrder(null)}>
                  Tiếp tục xem mẫu bánh
                </button>
              ) : successOrder.isCompletingZalo ? (
                <button className="cake-primary-btn" type="button" disabled>
                  Đang gửi Zalo…
                </button>
              ) : (
                <>
                  <a
                    className="cake-primary-btn"
                    href={successOrder.zaloWebLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={copySuccessZaloMessage}
                  >
                    Mở Zalo gửi đơn
                  </a>
                  <button className="cake-secondary-btn" type="button" onClick={() => setSuccessOrder(null)}>
                    Tiếp tục xem mẫu bánh
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {pickupTimeWarningOpen ? (
        <div ref={modalRootRef} className="cake-modal" role="dialog" aria-modal="true" aria-labelledby="cake-time-warning-title">
          <button type="button" className="cake-modal__backdrop" aria-label="Đóng cảnh báo giờ lấy bánh" tabIndex="-1" onClick={() => setPickupTimeWarningOpen(false)} />
          <div className="cake-addon-popup">
            <button className="cake-modal__close" type="button" onClick={() => setPickupTimeWarningOpen(false)} aria-label="Đóng cảnh báo giờ lấy bánh">×</button>
            <div className="cake-addon-popup__body">
              <h3 id="cake-time-warning-title">Chọn lại giờ lấy bánh</h3>
              <p>{PICKUP_TIME_WARNING}</p>
              <button className="cake-primary-btn" type="button" onClick={() => setPickupTimeWarningOpen(false)}>Chọn lại giờ lấy</button>
            </div>
          </div>
        </div>
      ) : null}

      {addonInfoPopup ? (
        <div ref={modalRootRef} className="cake-modal" role="dialog" aria-modal="true" aria-labelledby="cake-addon-popup-title">
          <button type="button" className="cake-modal__backdrop" aria-label="Đóng thông tin phụ kiện" tabIndex="-1" onClick={() => setAddonInfoPopup("")} />
          <div className="cake-addon-popup">
            <button className="cake-modal__close" type="button" onClick={() => setAddonInfoPopup("")} aria-label="Đóng thông tin phụ kiện">×</button>

            {addonInfoPopup === "chibi" ? (
              <div className="cake-addon-popup__body">
                <h3 id="cake-addon-popup-title">{chibiAddon.name || "Hình chibi cá nhân hóa"}</h3>
                <p>
                  Chibi được vẽ theo ảnh thật của người nhận. Quán sẽ liên hệ xin ảnh, gửi mẫu để anh/chị duyệt trước khi in và gắn lên bánh.
                  Phụ phí dịch vụ chibi: {formatMoney(Number(chibiAddon.price || 0))}/mẫu.
                </p>
                {chibiAddon.image ? <img src={chibiAddon.image} alt={chibiAddon.name || "Hình chibi"} width="860" height="640" loading="lazy" decoding="async" /> : null}
              </div>
            ) : null}

            {addonInfoPopup === "decoration" ? (
              <div className="cake-addon-popup__body">
                <h3 id="cake-addon-popup-title">{decorationAddon.name || "Phụ kiện trang trí theo yêu cầu"}</h3>
                <p>Có 3 mẫu phụ kiện đi kèm. Quán gửi thêm hình thực tế để anh/chị tham khảo trước khi chọn.</p>
                <div className="cake-addon-popup__gallery">
                  {decorationOptions.map((item) => (
                    <figure key={item.id}>
                      <img src={item.image} alt={item.name} width="320" height="240" loading="lazy" decoding="async" />
                      <figcaption>{item.name} - +{formatMoney(Number(item.price || 0))}</figcaption>
                    </figure>
                  ))}
                </div>
                {decorationReferenceImages.length ? (
                  <>
                    <h4>Hình thực tế phụ kiện</h4>
                    <div className="cake-addon-popup__gallery">
                      {decorationReferenceImages.map((image, index) => (
                        <figure key={`ref-${index + 1}`}>
                          <img src={image} alt={`Phụ kiện thực tế ${index + 1}`} width="320" height="240" loading="lazy" decoding="async" />
                          <figcaption>Mẫu thực tế {index + 1}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
