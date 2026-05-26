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
  note: ""
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

  const featuredProducts = useMemo(() => {
    const ids = Array.isArray(settings.featuredProductIds) ? settings.featuredProductIds : [];
    const selected = ids.map((id) => products.find((product) => product.id === id)).filter(Boolean);
    return (selected.length ? selected : products).slice(0, 4);
  }, [products, settings.featuredProductIds]);
  const shippingConfig = settings.shippingConfig;
  const pickupBranches = useMemo(() => resolvePickupBranches(branches), [branches]);
  const selectedPickupBranch = useMemo(() => {
    if (form.pickupBranchId) {
      return pickupBranches.find((branch) => branch.id === form.pickupBranchId) || pickupBranches[0] || null;
    }
    return pickupBranches[0] || null;
  }, [form.pickupBranchId, pickupBranches]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openOrderForm = (product) => {
    setOrderingProduct(product);
    setSelectedProduct(null);
    setForm((current) => ({
      ...current,
      pickupBranchId: current.pickupBranchId || pickupBranches[0]?.id || ""
    }));
    setMessage("");
  };

  const closeOrderForm = () => {
    setOrderingProduct(null);
    setForm(EMPTY_FORM);
    setAddressInfo(null);
    setMessage("");
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!orderingProduct || submitting) return;
    setSubmitting(true);
    setMessage("");

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
        pickupBranch: selectedPickupBranch
      }
    });

    const zaloMessage = buildCakeZaloMessage({
      product: orderingProduct,
      form: {
        ...form,
        pickupBranchName: selectedPickupBranch?.name || settings.pickupAddress,
        pickupBranchAddress: selectedPickupBranch?.address || ""
      },
      addressInfo,
      shippingFee,
      orderCode: saved.orderCode
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
              <button type="button" className="cake-card__image" onClick={() => setSelectedProduct(product)}>
                <img src={product.image} alt={product.name} />
                <span className="cake-card__badge">{product.serving}</span>
                <strong className="cake-card__price">{formatMoney(product.price)}</strong>
              </button>
              <div className="cake-card__body">
                <h3>{product.name}</h3>
                <p>{product.size}</p>
                <button type="button" onClick={() => setSelectedProduct(product)}>Xem chi tiết</button>
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
            <img className="cake-detail__image" src={selectedProduct.image} alt={selectedProduct.name} />
            <div className="cake-detail__content">
              <p className="cake-eyebrow">{selectedProduct.serving}</p>
              <h2>{selectedProduct.name}</h2>
              <strong>{formatMoney(selectedProduct.price)}</strong>
              <p>{selectedProduct.description}</p>
              <div className="cake-detail__meta">
                <span>{selectedProduct.size}</span>
                {selectedProduct.addOns?.map((item) => (
                  <span key={item.name}>{item.name}: +{formatMoney(item.price)}</span>
                ))}
              </div>
              <div className="cake-detail__cols">
                <div>
                  <h3>Thành phần</h3>
                  <ul>{selectedProduct.ingredients.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h3>Phụ kiện</h3>
                  <ul>{selectedProduct.accessories.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
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
                <strong>{formatMoney(orderingProduct.price)}</strong>
              </div>
            </div>

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
              <textarea rows="3" value={form.note} onChange={(event) => updateForm("note", event.target.value)} placeholder="Ít cay, thêm chibi, màu nơ..." />
            </label>

            {message ? <p className="cake-form-message">{message}</p> : null}

            <button className="cake-primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi qua Zalo chăm sóc khách hàng"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
