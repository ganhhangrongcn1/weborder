import { useMemo, useState } from "react";
import Icon from "../components/Icon.jsx";
import GoongAddressPicker from "../components/GoongAddressPicker.jsx";
import { resolvePickupBranches } from "../features/checkout/checkoutDomain.js";
import useCakeProducts from "../hooks/useCakeProducts.js";
import { buildCakeZaloMessage, createCakeOrder } from "../services/cakeService.js";
import { BRANCH_LOCATION } from "../services/goongService.js";
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
const EMPTY_PREVIEW_SELECTION = {
  chibiSelected: false,
  decorationOptionId: "",
  addOnNote: ""
};

function buildZaloLink(phone) {
  return `https://zalo.me/${String(phone || "").replace(/\D/g, "")}`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

export default function BanhKemBanhTrangPage({ branches = [] }) {
  const { products, settings, loading } = useCakeProducts();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderingProduct, setOrderingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addressInfo, setAddressInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [addonInfoPopup, setAddonInfoPopup] = useState("");
  const [previewSelection, setPreviewSelection] = useState(EMPTY_PREVIEW_SELECTION);

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
  const selectedProductUseSharedAddons = selectedProduct
    ? selectedProduct.id !== "set-trai-tim-2-tang" && selectedProduct.useSharedAddons !== false
    : true;
  const orderingProductUseSharedAddons = orderingProduct
    ? orderingProduct.id !== "set-trai-tim-2-tang" && orderingProduct.useSharedAddons !== false
    : true;

  const shippingConfig = settings.shippingConfig;
  const pickupBranches = useMemo(() => resolvePickupBranches(branches), [branches]);
  const selectedPickupBranch = useMemo(() => {
    if (form.pickupBranchId) {
      return pickupBranches.find((branch) => branch.id === form.pickupBranchId) || pickupBranches[0] || null;
    }
    return pickupBranches[0] || null;
  }, [form.pickupBranchId, pickupBranches]);

  const addOnTotal = useMemo(() => {
    if (!orderingProductUseSharedAddons) return 0;
    const chibiPrice = form.chibiSelected ? Number(chibiAddon.price || 0) : 0;
    const selectedDecorationOption = decorationOptions.find((item) => item.id === form.decorationOptionId);
    const decorationPrice = form.decorationSelected ? Number(selectedDecorationOption?.price ?? decorationAddon.price ?? 0) : 0;
    return chibiPrice + decorationPrice;
  }, [orderingProductUseSharedAddons, chibiAddon.price, decorationAddon.price, decorationOptions, form.chibiSelected, form.decorationOptionId, form.decorationSelected]);

  const finalCakePrice = Number(orderingProduct?.price || 0) + addOnTotal;

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openOrderForm = (product) => {
    setOrderingProduct(product);
    setSelectedProduct(null);
    setForm((current) => ({
      ...EMPTY_FORM,
      pickupBranchId: current.pickupBranchId || pickupBranches[0]?.id || "",
      chibiSelected: product.useSharedAddons !== false ? previewSelection.chibiSelected : false,
      decorationSelected: product.useSharedAddons !== false ? Boolean(previewSelection.decorationOptionId) : false,
      decorationOptionId: product.useSharedAddons !== false ? previewSelection.decorationOptionId : "",
      addOnNote: previewSelection.addOnNote
    }));
    setMessage("");
  };

  const closeOrderForm = () => {
    setOrderingProduct(null);
    setForm(EMPTY_FORM);
    setAddressInfo(null);
    setMessage("");
  };

  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setPreviewSelection({
      chibiSelected: false,
      decorationOptionId: "",
      addOnNote: ""
    });
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!orderingProduct || submitting) return;
    setSubmitting(true);
    setMessage("");

    const selectedDecorationOption = decorationOptions.find((item) => item.id === form.decorationOptionId);
    const selectedAddOns = {
      chibi: {
        selected: orderingProductUseSharedAddons ? Boolean(form.chibiSelected) : false,
        name: chibiAddon.name || "Hình chibi cá nhân hóa",
        price: Number(chibiAddon.price || 0)
      },
      decoration: {
        selected: orderingProductUseSharedAddons ? Boolean(form.decorationSelected) : false,
        name: decorationAddon.name || "Phụ kiện trang trí theo yêu cầu",
        optionId: selectedDecorationOption?.id || "",
        optionName: selectedDecorationOption?.name || "",
        price: Number(selectedDecorationOption?.price ?? decorationAddon.price ?? 0)
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
      setMessage(saved.ok ? "Đã lưu đơn và copy nội dung. Zalo sẽ mở ở tab mới." : "Đã copy nội dung Zalo. Supabase chưa lưu được, shop vẫn nhận thông tin qua Zalo.");
    } catch (_error) {
      setMessage("Không copy tự động được, bạn có thể copy nội dung ở ô bên dưới.");
    }

    setSubmitting(false);
    window.open(buildZaloLink(settings.zaloPhone), "_blank", "noopener,noreferrer");
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
              <button key={product.id} type="button" onClick={() => setSelectedProduct(product)}>
                <img src={product.image} alt={product.name} />
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
          <p>{loading ? "Đang tải dữ liệu..." : `${products.length} mẫu đang bán`}</p>
        </div>

        <div className="cake-grid">
          {products.map((product) => (
            <article key={product.id} className="cake-card">
              <button type="button" className="cake-card__image" onClick={() => openProductDetail(product)}>
                <img src={product.image} alt={product.name} />
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
      </section>

      {selectedProduct && (
        <div className="cake-modal" role="dialog" aria-modal="true">
          <div className="cake-modal__backdrop" onClick={() => setSelectedProduct(null)} />
          <div className="cake-detail">
            <button className="cake-modal__close" type="button" onClick={() => setSelectedProduct(null)}>×</button>
            <div className="cake-detail__image-wrap">
              <img className="cake-detail__image" src={selectedProduct.image} alt={selectedProduct.name} />
            </div>
            <div className="cake-detail__content">
              <p className="cake-eyebrow"><Icon name="user" size={13} /> {selectedProduct.serving}</p>
              <h2>{selectedProduct.name}</h2>
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

              {selectedProductUseSharedAddons ? (
              <div className="cake-optional-addon cake-native-addon">
                <h4>Phụ kiện theo yêu cầu</h4>
                <ul>
                  {chibiAddon.enabled ? (
                    <li>
                      <span className="cake-addon-title"><Icon name="star" size={14} />{chibiAddon.name || "Hình chibi cá nhân hóa"}</span>
                      <span className="cake-addon-actions">
                        <strong>+{formatMoney(Number(chibiAddon.price || 0))}</strong>
                        <button
                          type="button"
                          className={previewSelection.chibiSelected ? "is-active" : ""}
                          onClick={() => setPreviewSelection((current) => ({ ...current, chibiSelected: !current.chibiSelected }))}
                        >
                          {previewSelection.chibiSelected ? "Đã chọn" : "+ Thêm"}
                        </button>
                        <button type="button" onClick={() => setAddonInfoPopup("chibi")}>Xem chi tiết</button>
                      </span>
                    </li>
                  ) : null}
                  {decorationAddon.enabled ? (
                    <li>
                      <span className="cake-addon-title"><Icon name="gift" size={14} />{decorationAddon.name || "Phụ kiện trang trí theo yêu cầu"}</span>
                      <span className="cake-addon-actions">
                        <strong>+{formatMoney(Number(decorationAddon.price || 0))}</strong>
                        <button
                          type="button"
                          className={previewSelection.decorationOptionId ? "is-active" : ""}
                          onClick={() =>
                            setPreviewSelection((current) => ({
                              ...current,
                              decorationOptionId: current.decorationOptionId ? "" : (decorationOptions[0]?.id || "")
                            }))
                          }
                        >
                          {previewSelection.decorationOptionId ? "Đã chọn" : "+ Thêm"}
                        </button>
                        <button type="button" onClick={() => setAddonInfoPopup("decoration")}>Xem mẫu</button>
                      </span>
                    </li>
                  ) : null}
                </ul>
                {previewSelection.decorationOptionId ? (
                  <div className="cake-addon-option-grid">
                    {decorationOptions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={previewSelection.decorationOptionId === item.id ? "is-active" : ""}
                        onClick={() => setPreviewSelection((current) => ({ ...current, decorationOptionId: item.id }))}
                      >
                        <img src={item.image} alt={item.name} />
                        <strong>{item.name}</strong>
                        <span>+{formatMoney(Number(item.price || 0))}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <label className="cake-addon-note-inline">
                  <span>Ghi chú phụ kiện (nếu có)</span>
                  <input
                    value={previewSelection.addOnNote}
                    onChange={(event) => setPreviewSelection((current) => ({ ...current, addOnNote: event.target.value }))}
                    placeholder="VD: chọn mẫu 2, thêm nơ vàng..."
                  />
                </label>
              </div>
              ) : (
                <div className="cake-optional-addon cake-native-addon">
                  <h4>Phụ kiện theo yêu cầu</h4>
                  <p>Mẫu này đã bao gồm set phụ kiện, không áp dụng chọn thêm.</p>
                </div>
              )}

              <button className="cake-primary-btn" type="button" onClick={() => openOrderForm(selectedProduct)}>Đặt mẫu này</button>
            </div>
          </div>
        </div>
      )}

      {orderingProduct && (
        <div className="cake-modal" role="dialog" aria-modal="true">
          <div className="cake-modal__backdrop" onClick={closeOrderForm} />
          <form className="cake-order-form" onSubmit={submitOrder}>
            <button className="cake-modal__close" type="button" onClick={closeOrderForm}>×</button>
            <div className="cake-order-form__head">
              <img src={orderingProduct.image} alt={orderingProduct.name} />
              <div>
                <p className="cake-eyebrow">Đặt bánh</p>
                <h2>{orderingProduct.name}</h2>
                <strong>{formatMoney(finalCakePrice)}</strong>
              </div>
            </div>

            {orderingProductUseSharedAddons ? (
            <div className="cake-addon-order-box">
              <h3>Phụ kiện theo yêu cầu</h3>
              {chibiAddon.enabled ? (
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

              {decorationAddon.enabled ? (
                <>
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

                  {form.decorationSelected ? (
                    <div className="cake-addon-option-grid">
                      {decorationOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={form.decorationOptionId === item.id ? "is-active" : ""}
                          onClick={() => updateForm("decorationOptionId", item.id)}
                        >
                          <img src={item.image} alt={item.name} />
                          <strong>{item.name}</strong>
                          <span>+{formatMoney(Number(item.price || 0))}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              <label>
                <span>Ghi chú phụ kiện theo yêu cầu (nếu có)</span>
                <input
                  value={form.addOnNote}
                  onChange={(event) => updateForm("addOnNote", event.target.value)}
                  placeholder="VD: Chọn mẫu 2, đổi màu nơ vàng..."
                />
              </label>
            </div>
            ) : null}

            <div className="cake-form-grid">
              <label>
                <span>Họ tên</span>
                <input value={form.customerName} onChange={(event) => updateForm("customerName", event.target.value)} required placeholder="Tên khách nhận bánh" />
              </label>
              <label>
                <span>Số điện thoại</span>
                <input value={form.customerPhone} onChange={(event) => updateForm("customerPhone", event.target.value)} required placeholder="09xxxxxxxx" />
              </label>
              <label>
                <span>Ngày giờ muốn lấy</span>
                <input type="datetime-local" value={form.pickupTime} onChange={(event) => updateForm("pickupTime", event.target.value)} required />
              </label>
              <label>
                <span>Tên muốn ghi trên bánh</span>
                <input value={form.cakeMessage} onChange={(event) => updateForm("cakeMessage", event.target.value)} placeholder="VD: Chúc mừng sinh nhật An" />
              </label>
            </div>

            <div className="cake-segmented">
              <button type="button" className={form.fulfillmentType === "pickup" ? "is-active" : ""} onClick={() => updateForm("fulfillmentType", "pickup")}>Ghé lấy</button>
              <button type="button" className={form.fulfillmentType === "delivery" ? "is-active" : ""} onClick={() => updateForm("fulfillmentType", "delivery")}>Giao hàng</button>
            </div>

            {form.fulfillmentType === "delivery" ? (
              <GoongAddressPicker
                value={addressInfo || { addressText: form.deliveryAddress }}
                onChange={(value) => {
                  setAddressInfo(value);
                  updateForm("deliveryAddress", value.addressText || "");
                }}
                origin={BRANCH_LOCATION}
                shippingConfig={shippingConfig}
              />
            ) : (
              <div className="cake-pickup-branches">
                <p className="cake-pickup-title">Chọn chi nhánh ghé lấy</p>
                {(pickupBranches.length ? pickupBranches : [{ id: "default", name: settings.pickupAddress, address: "", time: "" }]).map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    className={`branch-card ${selectedPickupBranch?.id === branch.id ? "branch-card-active" : ""}`}
                    onClick={() => updateForm("pickupBranchId", branch.id)}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                      <Icon name="home" size={18} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{branch.name}</strong>
                      {branch.address ? <small>{branch.address}</small> : null}
                      {branch.time ? <em>{branch.time}</em> : null}
                    </span>
                    <span className="branch-radio">{selectedPickupBranch?.id === branch.id ? "✓" : ""}</span>
                  </button>
                ))}
              </div>
            )}

            <label className="cake-note-field">
              <span>Ghi chú thêm</span>
              <textarea rows="3" value={form.note} onChange={(event) => updateForm("note", event.target.value)} placeholder="Ví dụ: ít cay, gọi trước khi giao..." />
            </label>

            {message ? <p className="cake-form-message">{message}</p> : null}

            <button className="cake-primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi qua Zalo chăm sóc khách hàng"}
            </button>
          </form>
        </div>
      )}

      {addonInfoPopup ? (
        <div className="cake-modal" role="dialog" aria-modal="true">
          <div className="cake-modal__backdrop" onClick={() => setAddonInfoPopup("")} />
          <div className="cake-addon-popup">
            <button className="cake-modal__close" type="button" onClick={() => setAddonInfoPopup("")}>×</button>

            {addonInfoPopup === "chibi" ? (
              <div className="cake-addon-popup__body">
                <h3>{chibiAddon.name || "Hình chibi cá nhân hóa"}</h3>
                <p>
                  Chibi bên em làm theo ảnh thật người anh/chị muốn tặng. Bên em sẽ vẽ lại theo phong cách hoạt hình, gửi anh/chị duyệt trước.
                  Khi anh/chị đồng ý, quán mới in, cắt và gắn lên bánh. Phụ phí dịch vụ chibi: {formatMoney(Number(chibiAddon.price || 0))}/mẫu.
                  Anh/chị tham khảo hình mẫu bên dưới giúp em nhé.
                </p>
                {chibiAddon.image ? <img src={chibiAddon.image} alt={chibiAddon.name || "Hình chibi"} /> : null}
              </div>
            ) : null}

            {addonInfoPopup === "decoration" ? (
              <div className="cake-addon-popup__body">
                <h3>{decorationAddon.name || "Phụ kiện trang trí theo yêu cầu"}</h3>
                <p>Có 3 mẫu phụ kiện đi kèm. Quán gửi thêm hình thực tế để anh/chị tham khảo trước khi chọn.</p>
                <div className="cake-addon-popup__gallery">
                  {decorationOptions.map((item) => (
                    <figure key={item.id}>
                      <img src={item.image} alt={item.name} />
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
                          <img src={image} alt={`Phụ kiện thực tế ${index + 1}`} />
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
