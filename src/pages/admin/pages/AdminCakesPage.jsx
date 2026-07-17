import { useEffect, useMemo, useRef, useState } from "react";
import { processUploadImage } from "../../../utils/imageUpload.js";
import { uploadImageToMenuBucket } from "../../../services/supabase/storageService.js";
import {
  CAKE_ADDON_MODES,
  DEFAULT_CAKE_PRODUCTS,
  DEFAULT_CAKE_SETTINGS,
  loadCakeProducts,
  loadCakeProductsAsync,
  loadCakeSettings,
  loadCakeSettingsAsync,
  listCakeOrders,
  normalizeCakeProduct,
  normalizeCakeSettings,
  saveCakeProductsAsync,
  saveCakeSettingsAsync,
  updateCakeOrderStatus
} from "../../../services/cakeService.js";
import { isSupabaseEnabled } from "../../../services/repositories/dataSource.js";
import { formatMoney } from "../../../utils/format.js";
import "../../../styles/admin/cakes.css";

function listToText(value) {
  return Array.isArray(value) ? value.join("\n") : String(value || "");
}

function textToList(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateDecorationOption(options, index, patch) {
  const next = Array.isArray(options) ? [...options] : [];
  while (next.length < 3) {
    const optionNumber = next.length + 1;
    next.push({
      id: `pk-${optionNumber}`,
      name: `Mẫu phụ kiện ${optionNumber}`,
      price: 20000,
      image: ""
    });
  }
  next[index] = { ...next[index], ...patch };
  return next;
}

function createEmptyCake() {
  return normalizeCakeProduct({
    id: `cake-${Date.now()}`,
    name: "Mẫu bánh mới",
    price: 0,
    image: "",
    size: "",
    serving: "",
    description: "",
    ingredients: [],
    accessories: [],
    addOns: [],
    addonMode: CAKE_ADDON_MODES.paid,
    useSharedAddons: true,
    active: true
  });
}

function isCakeBranch304(branch) {
  const text = String(`${branch?.name || ""} ${branch?.address || ""} ${branch?.slug || ""} ${branch?.branch_code || ""}`)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return text.includes("30/4") || text.includes("30 thang 4") || text.includes("duong 30");
}

function getCakeBranchRuntimeId(branch) {
  return String(branch?.branch_uuid || branch?.branchUuid || branch?.uuid || branch?.id || branch?.dbId || "").trim();
}

function formatCakeOrderPickupTime(order) {
  const localValue = String(order?.pickupTimeLocal || order?.metadata?.pickupTimeLocal || "").trim();
  if (localValue) {
    const match = localValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return `${hour}:${minute}:00 ${Number(day)}/${Number(month)}/${year}`;
    }
  }

  if (!order?.pickupTime) return "Chưa rõ";
  const date = new Date(order.pickupTime);
  if (Number.isNaN(date.getTime())) return String(order.pickupTime);
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function AdminCakesPage({ branches = [] }) {
  const useSupabaseFirst = isSupabaseEnabled();
  const [products, setProducts] = useState(() => (useSupabaseFirst ? [] : loadCakeProducts()));
  const [settings, setSettings] = useState(() => (useSupabaseFirst ? normalizeCakeSettings(DEFAULT_CAKE_SETTINGS) : loadCakeSettings()));
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedId, setSelectedId] = useState(products[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setConfigLoading(true);
    Promise.all([loadCakeProductsAsync(), loadCakeSettingsAsync()])
      .then(([nextProducts, nextSettings]) => {
        if (!alive) return;
        setProducts(nextProducts);
        setSettings(nextSettings);
        setSelectedId((current) => current || nextProducts[0]?.id || "");
      })
      .catch((error) => {
        console.warn("[AdminCakesPage] load failed", error);
        if (!alive) return;
        setMessage("Chưa tải được cấu hình bánh từ Supabase. Kiểm tra app_configs trước khi chỉnh.");
        if (!useSupabaseFirst) {
          const fallbackProducts = loadCakeProducts();
          setProducts(fallbackProducts);
          setSettings(loadCakeSettings());
          setSelectedId(fallbackProducts[0]?.id || "");
        }
      })
      .finally(() => {
        if (alive) setConfigLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const refreshOrders = async () => {
    setOrdersLoading(true);
    const result = await listCakeOrders();
    if (result.ok) {
      setOrders(result.orders);
    } else {
      setMessage("Chưa tải được đơn bánh. Kiểm tra bảng cake_orders và policy Supabase.");
    }
    setOrdersLoading(false);
  };

  useEffect(() => {
    refreshOrders();
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedId) || products[0] || null,
    [products, selectedId]
  );
  const addonCatalog = settings.addonCatalog || {};
  const chibiAddon = addonCatalog.chibi || {};
  const decorationAddon = addonCatalog.decoration || {};
  const decorationOptions = Array.isArray(decorationAddon.options) ? decorationAddon.options : [];
  const cakeFulfillment = settings.cakeFulfillment || {};
  const branchOptions = useMemo(
    () => (Array.isArray(branches) ? branches : []).filter(isCakeBranch304),
    [branches]
  );
  const cakeBranch304 = branchOptions[0] || null;
  const cakeBranch304Id = getCakeBranchRuntimeId(cakeBranch304);
  const savedDeliverySourceBranchId = String(cakeFulfillment.deliverySourceBranchId || settings.shippingConfig?.sourceBranchId || "").trim();
  const selectedDeliverySourceBranchId = branchOptions.some((branch) => getCakeBranchRuntimeId(branch) === savedDeliverySourceBranchId)
    ? savedDeliverySourceBranchId
    : cakeBranch304Id;

  const updateProduct = (patch) => {
    if (!selectedProduct) return;
    setProducts((current) => current.map((product) => (
      product.id === selectedProduct.id ? normalizeCakeProduct({ ...product, ...patch }) : product
    )));
  };

  const addProduct = () => {
    const next = createEmptyCake();
    setProducts((current) => [next, ...current]);
    setSelectedId(next.id);
  };

  const duplicateProduct = () => {
    if (!selectedProduct) return;
    const next = normalizeCakeProduct({
      ...selectedProduct,
      id: `${selectedProduct.id}-${Date.now()}`,
      name: `${selectedProduct.name} copy`
    });
    setProducts((current) => [next, ...current]);
    setSelectedId(next.id);
  };

  const removeProduct = () => {
    if (!selectedProduct || products.length <= 1) return;
    const nextProducts = products.filter((product) => product.id !== selectedProduct.id);
    setProducts(nextProducts);
    setSelectedId(nextProducts[0]?.id || "");
  };

  const restoreDefaults = () => {
    setProducts(DEFAULT_CAKE_PRODUCTS.map(normalizeCakeProduct));
    setSettings(normalizeCakeSettings(DEFAULT_CAKE_SETTINGS));
    setSelectedId(DEFAULT_CAKE_PRODUCTS[0]?.id || "");
  };

  const saveAll = async () => {
    setSaving(true);
    setMessage("");
    try {
      if (!cakeBranch304Id) {
        setMessage("Chưa tìm thấy chi nhánh Đường 30/4 trong Supabase branches.");
        return;
      }
      const settingsToSave = normalizeCakeSettings({
        ...settings,
        shippingConfig: {
          ...(settings.shippingConfig || {}),
          sourceBranchId: cakeBranch304Id
        },
        cakeFulfillment: {
          ...(settings.cakeFulfillment || {}),
          deliverySourceBranchId: cakeBranch304Id
        }
      });
      const nextProducts = await saveCakeProductsAsync(products);
      const nextSettings = await saveCakeSettingsAsync(settingsToSave);
      setProducts(nextProducts);
      setSettings(nextSettings);
      setMessage("Đã lưu cấu hình bánh lên Supabase.");
    } catch (error) {
      console.warn("[AdminCakesPage] save failed", error);
      setMessage("Lưu thất bại. Kiểm tra cấu hình Supabase/app_configs.");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProduct) return;
    setUploading(true);
    setMessage("");
    try {
      const processed = await processUploadImage(file, { maxWidth: 1200, quality: 0.72 });
      try {
        const uploaded = await uploadImageToMenuBucket(processed.file, {
          folder: "cakes",
          stableKey: selectedProduct.id,
          currentUrl: selectedProduct.image
        });
        updateProduct({ image: uploaded.publicUrl });
      } catch (_uploadError) {
        updateProduct({ image: processed.dataUrl });
      }
    } catch (error) {
      setMessage(error?.message || "Không thể tải ảnh.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateFeaturedSlot = (slotIndex, productId) => {
    setSettings((current) => {
      const currentIds = Array.isArray(current.featuredProductIds) ? current.featuredProductIds.slice(0, 4) : [];
      const nextIds = Array.from({ length: 4 }, (_, index) => currentIds[index] || "");
      nextIds[slotIndex] = productId;
      return normalizeCakeSettings({ ...current, featuredProductIds: nextIds });
    });
  };

  const updateCakeFulfillment = (patch) => {
    setSettings((current) => {
      const nextFulfillment = {
        ...(current.cakeFulfillment || {}),
        ...patch
      };
      const nextShippingConfig = patch.deliverySourceBranchId !== undefined
        ? { ...(current.shippingConfig || {}), sourceBranchId: patch.deliverySourceBranchId }
        : current.shippingConfig;
      return normalizeCakeSettings({
        ...current,
        shippingConfig: nextShippingConfig,
        cakeFulfillment: nextFulfillment
      });
    });
  };

  const togglePickupBranch = (branchId, checked) => {
    const savedIds = Array.isArray(cakeFulfillment.pickupBranchIds) ? cakeFulfillment.pickupBranchIds : [];
    const currentIds = savedIds.length ? savedIds : branchOptions.map(getCakeBranchRuntimeId).filter(Boolean);
    const nextIds = checked
      ? Array.from(new Set([...currentIds, branchId]))
      : currentIds.filter((id) => id !== branchId);
    updateCakeFulfillment({ pickupBranchIds: nextIds });
  };

  const changeOrderStatus = async (orderId, status) => {
    const result = await updateCakeOrderStatus(orderId, status);
    if (!result.ok) {
      setMessage("Cập nhật trạng thái đơn thất bại.");
      return;
    }
    setOrders((current) => current.map((order) => (order.id === orderId ? result.order : order)));
  };

  return (
    <section className="admin-cakes-page">
      <div className="admin-cakes-head">
        <div>
          <h1>Bánh sinh nhật bánh tráng</h1>
          <p>Quản lý mẫu bánh, nội dung popup, Zalo nhận đơn và phí ship riêng cho bánh.</p>
        </div>
        <div className="admin-cakes-actions">
          <button type="button" className="admin-secondary" onClick={restoreDefaults} disabled={useSupabaseFirst && configLoading}>Khôi phục mẫu gốc</button>
          <button type="button" onClick={saveAll} disabled={saving || configLoading}>{saving ? "Đang lưu..." : "Lưu cấu hình"}</button>
        </div>
      </div>

      {configLoading ? <p className="admin-cakes-message" role="status" aria-live="polite">Đang tải cấu hình bánh từ Supabase…</p> : null}
      {message ? <p className="admin-cakes-message" role="status" aria-live="polite">{message}</p> : null}

      <div className="admin-cakes-tabs">
        <button type="button" className={activeTab === "orders" ? "is-active" : ""} onClick={() => setActiveTab("orders")}>
          Đơn bánh
        </button>
        <button type="button" className={activeTab === "settings" ? "is-active" : ""} onClick={() => setActiveTab("settings")}>
          Cài đặt
        </button>
        <button type="button" className={activeTab === "products" ? "is-active" : ""} onClick={() => setActiveTab("products")}>
          Mẫu bánh
        </button>
      </div>

      {activeTab === "orders" && (
        <section className="admin-panel admin-cake-orders">
          <div className="admin-panel-head">
            <h2>Đơn bánh sinh nhật</h2>
            <button type="button" onClick={refreshOrders} disabled={ordersLoading}>
              {ordersLoading ? "Đang tải..." : "Tải lại"}
            </button>
          </div>

          {!orders.length ? (
            <div className="admin-cake-empty">
              {ordersLoading ? "Đang tải danh sách đơn bánh..." : "Chưa có đơn bánh nào."}
            </div>
          ) : (
            <div className="admin-cake-order-list">
              {orders.map((order) => (
                <article key={order.id} className="admin-cake-order-card">
                  <div className="admin-cake-order-main">
                    <div>
                      <span className="admin-cake-order-code">{order.orderCode}</span>
                      <h3>{order.cakeName}</h3>
                      <p>{order.customerName} - {order.customerPhone}</p>
                    </div>
                    <strong>{formatMoney(order.cakePrice + Number(order.shippingFee || 0))}</strong>
                  </div>

                  <div className="admin-cake-order-grid">
                    <div>
                      <span>Ngày giờ lấy</span>
                      <strong>{formatCakeOrderPickupTime(order)}</strong>
                    </div>
                    <div>
                      <span>Hình thức</span>
                      <strong>{order.fulfillmentType === "delivery" ? "Giao hàng" : "Ghé lấy"}</strong>
                    </div>
                    <div>
                      <span>Phí ship</span>
                      <strong>{order.fulfillmentType === "delivery" ? (order.shippingFee === null ? "Xác nhận sau" : formatMoney(Number(order.shippingFee || 0))) : "0đ"}</strong>
                    </div>
                    <div>
                      <span>Trạng thái</span>
                      <select value={order.status} onChange={(event) => changeOrderStatus(order.id, event.target.value)}>
                        <option value="new">Mới</option>
                        <option value="contacted">Đã liên hệ</option>
                        <option value="confirmed">Đã chốt</option>
                        <option value="preparing">Đang chuẩn bị</option>
                        <option value="done">Hoàn tất</option>
                        <option value="cancelled">Đã hủy</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-cake-order-note">
                    {order.cakeMessage ? <p><b>Tên ghi bánh:</b> {order.cakeMessage}</p> : null}
                    {order.deliveryAddress ? <p><b>Địa chỉ:</b> {order.deliveryAddress}</p> : null}
                    {order.note ? <p><b>Ghi chú:</b> {order.note}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "settings" && (
        <div className="admin-cakes-editor">
          <section className="admin-panel admin-cake-settings">
            <div className="admin-panel-head">
              <h2>Cài đặt nhận đơn</h2>
            </div>
            <div className="admin-mini-grid">
              <label className="admin-mini-card">
                <span>Số Zalo nhận đơn bánh</span>
                <input className="admin-input" value={settings.zaloPhone} onChange={(event) => setSettings((current) => normalizeCakeSettings({ ...current, zaloPhone: event.target.value }))} />
              </label>
              <label className="admin-mini-card">
                <span>Địa chỉ khách ghé lấy</span>
                <input className="admin-input" value={settings.pickupAddress} onChange={(event) => setSettings((current) => normalizeCakeSettings({ ...current, pickupAddress: event.target.value }))} />
              </label>
              <label className="admin-mini-card admin-cake-wide">
                <span>Ghi chú hiển thị đầu trang</span>
                <textarea className="admin-input" rows="3" value={settings.orderNotice} onChange={(event) => setSettings((current) => normalizeCakeSettings({ ...current, orderNotice: event.target.value }))} />
              </label>
            </div>
          </section>

          <section className="admin-panel admin-cake-settings">
            <div className="admin-panel-head">
              <div>
                <h2>Cách nhận bánh</h2>
                <p>Bật/tắt hình thức nhận bánh và chọn chi nhánh áp dụng riêng cho bánh sinh nhật.</p>
              </div>
            </div>
            <div className="admin-mini-grid">
              <div className="admin-mini-card">
                <span>Khách ghé lấy tại quán</span>
                <label className="admin-cake-toggle">
                  <input
                    type="checkbox"
                    checked={cakeFulfillment.pickupEnabled !== false}
                    onChange={(event) => updateCakeFulfillment({ pickupEnabled: event.target.checked })}
                  />
                  <span>Bật lựa chọn ghé lấy</span>
                </label>
                {branchOptions.length ? (
                  <div className="admin-cake-option-stack">
                    {branchOptions.map((branch) => {
                      const branchId = getCakeBranchRuntimeId(branch);
                      const checked = !cakeFulfillment.pickupBranchIds?.length || cakeFulfillment.pickupBranchIds.includes(branchId);
                      return (
                        <label key={branchId || branch.id} className="admin-cake-toggle">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => togglePickupBranch(branchId, event.target.checked)}
                          />
                          <span>{branch.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p>Chưa có danh sách chi nhánh, trang khách sẽ dùng địa chỉ ghé lấy mặc định.</p>
                )}
              </div>

              <div className="admin-mini-card">
                <span>Giao bánh</span>
                <label className="admin-cake-toggle">
                  <input
                    type="checkbox"
                    checked={cakeFulfillment.deliveryEnabled !== false}
                    onChange={(event) => updateCakeFulfillment({ deliveryEnabled: event.target.checked })}
                  />
                  <span>Bật lựa chọn giao bánh</span>
                </label>
                <label>
                  <span>Chi nhánh tính phí giao bánh</span>
                  <select
                    className="admin-input"
                    value={selectedDeliverySourceBranchId}
                    onChange={(event) => updateCakeFulfillment({ deliverySourceBranchId: event.target.value })}
                    disabled={!branchOptions.length}
                  >
                    {!branchOptions.length ? <option value="">Chưa có chi nhánh Đường 30/4 trên Supabase</option> : null}
                    {branchOptions.map((branch) => (
                      <option key={getCakeBranchRuntimeId(branch) || branch.id || branch.dbId} value={getCakeBranchRuntimeId(branch)}>{branch.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="admin-mini-card">
                <span>Thời gian chuẩn bị tối thiểu (phút)</span>
                <input
                  className="admin-input"
                  type="number"
                  min="0"
                  value={Number(cakeFulfillment.minPickupLeadMinutes || 120)}
                  onChange={(event) => updateCakeFulfillment({ minPickupLeadMinutes: Number(event.target.value || 0) })}
                />
              </label>
            </div>
          </section>

          <section className="admin-panel admin-cake-settings">
            <div className="admin-panel-head">
              <h2>Thư viện phụ kiện</h2>
            </div>
            <div className="admin-mini-grid">
              <div className="admin-mini-card">
                <span>Hình chibi</span>
                <label className="admin-cake-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(chibiAddon.enabled)}
                    onChange={(event) =>
                      setSettings((current) =>
                        normalizeCakeSettings({
                          ...current,
                          addonCatalog: {
                            ...(current.addonCatalog || {}),
                            chibi: { ...(current.addonCatalog?.chibi || {}), enabled: event.target.checked }
                          }
                        })
                      )
                    }
                  />
                  <span>Bật phụ kiện chibi</span>
                </label>
                <input
                  className="admin-input"
                  placeholder="Tên hiển thị"
                  value={chibiAddon.name || ""}
                  onChange={(event) =>
                    setSettings((current) =>
                      normalizeCakeSettings({
                        ...current,
                        addonCatalog: {
                          ...(current.addonCatalog || {}),
                          chibi: { ...(current.addonCatalog?.chibi || {}), name: event.target.value }
                        }
                      })
                    )
                  }
                />
                <input
                  className="admin-input"
                  type="number"
                  placeholder="Giá chibi"
                  value={Number(chibiAddon.price || 0)}
                  onChange={(event) =>
                    setSettings((current) =>
                      normalizeCakeSettings({
                        ...current,
                        addonCatalog: {
                          ...(current.addonCatalog || {}),
                          chibi: { ...(current.addonCatalog?.chibi || {}), price: Number(event.target.value || 0) }
                        }
                      })
                    )
                  }
                />
                <input
                  className="admin-input"
                  placeholder="Link ảnh mẫu chibi"
                  value={chibiAddon.image || ""}
                  onChange={(event) =>
                    setSettings((current) =>
                      normalizeCakeSettings({
                        ...current,
                        addonCatalog: {
                          ...(current.addonCatalog || {}),
                          chibi: { ...(current.addonCatalog?.chibi || {}), image: event.target.value }
                        }
                      })
                    )
                  }
                />
              </div>

              <div className="admin-mini-card">
                <span>Phụ kiện theo set</span>
                <label className="admin-cake-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(decorationAddon.enabled)}
                    onChange={(event) =>
                      setSettings((current) =>
                        normalizeCakeSettings({
                          ...current,
                          addonCatalog: {
                            ...(current.addonCatalog || {}),
                            decoration: { ...(current.addonCatalog?.decoration || {}), enabled: event.target.checked }
                          }
                        })
                      )
                    }
                  />
                  <span>Bật phụ kiện theo set</span>
                </label>
                <input
                  className="admin-input"
                  placeholder="Tên hiển thị"
                  value={decorationAddon.name || ""}
                  onChange={(event) =>
                    setSettings((current) =>
                      normalizeCakeSettings({
                        ...current,
                        addonCatalog: {
                          ...(current.addonCatalog || {}),
                          decoration: { ...(current.addonCatalog?.decoration || {}), name: event.target.value }
                        }
                      })
                    )
                  }
                />
              </div>

              {[0, 1, 2].map((index) => {
                const option = decorationOptions[index] || {};
                return (
                  <div key={`decoration-option-${index}`} className="admin-mini-card">
                    <span>Set phụ kiện {index + 1}</span>
                    <input
                      className="admin-input"
                      placeholder="Tên set"
                      value={option.name || ""}
                      onChange={(event) =>
                        setSettings((current) =>
                          normalizeCakeSettings({
                            ...current,
                            addonCatalog: {
                              ...(current.addonCatalog || {}),
                              decoration: {
                                ...(current.addonCatalog?.decoration || {}),
                                options: updateDecorationOption(current.addonCatalog?.decoration?.options, index, { name: event.target.value })
                              }
                            }
                          })
                        )
                      }
                    />
                    <input
                      className="admin-input"
                      type="number"
                      placeholder="Giá set"
                      value={Number(option.price || 0)}
                      onChange={(event) =>
                        setSettings((current) =>
                          normalizeCakeSettings({
                            ...current,
                            addonCatalog: {
                              ...(current.addonCatalog || {}),
                              decoration: {
                                ...(current.addonCatalog?.decoration || {}),
                                options: updateDecorationOption(current.addonCatalog?.decoration?.options, index, { price: Number(event.target.value || 0) })
                              }
                            }
                          })
                        )
                      }
                    />
                    <input
                      className="admin-input"
                      placeholder="Link ảnh set"
                      value={option.image || ""}
                      onChange={(event) =>
                        setSettings((current) =>
                          normalizeCakeSettings({
                            ...current,
                            addonCatalog: {
                              ...(current.addonCatalog || {}),
                              decoration: {
                                ...(current.addonCatalog?.decoration || {}),
                                options: updateDecorationOption(current.addonCatalog?.decoration?.options, index, { image: event.target.value })
                              }
                            }
                          })
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="admin-panel admin-cake-settings">
            <div className="admin-panel-head">
              <h2>Phí ship riêng cho bánh</h2>
            </div>
            <div className="admin-mini-grid">
              <label className="admin-mini-card">
                <span>Phí 3km đầu</span>
                <input className="admin-input" type="number" value={settings.shippingConfig.baseFeeFirst3Km} onChange={(event) => setSettings((current) => normalizeCakeSettings({ ...current, shippingConfig: { ...current.shippingConfig, baseFeeFirst3Km: Number(event.target.value) } }))} />
              </label>
              <label className="admin-mini-card">
                <span>Giá mỗi km tiếp theo</span>
                <input className="admin-input" type="number" value={settings.shippingConfig.feePerNextKm} onChange={(event) => setSettings((current) => normalizeCakeSettings({ ...current, shippingConfig: { ...current.shippingConfig, feePerNextKm: Number(event.target.value) } }))} />
              </label>
              <label className="admin-mini-card">
                <span>Bán kính giao tối đa (km)</span>
                <input className="admin-input" type="number" value={settings.shippingConfig.maxRadiusKm} onChange={(event) => setSettings((current) => normalizeCakeSettings({ ...current, shippingConfig: { ...current.shippingConfig, maxRadiusKm: Number(event.target.value) } }))} />
              </label>
              <label className="admin-mini-card admin-cake-wide">
                <span>Ghi chú phí ship</span>
                <textarea className="admin-input" rows="3" value={settings.shippingConfig.customerNote} onChange={(event) => setSettings((current) => normalizeCakeSettings({ ...current, shippingConfig: { ...current.shippingConfig, customerNote: event.target.value } }))} />
              </label>
            </div>
          </section>

          <section className="admin-panel admin-cake-featured">
            <div className="admin-panel-head">
              <div>
                <h2>Mẫu bán chạy trên đầu trang</h2>
                <p>Chọn 4 mẫu theo thứ tự hiển thị ở khu vực vàng phía trên trang khách.</p>
              </div>
            </div>
            <div className="admin-cake-featured-selects">
              {Array.from({ length: 4 }, (_, index) => {
                const selectedProductId = settings.featuredProductIds?.[index] || "";
                return (
                  <label key={`featured-${index}`}>
                    <span>Mẫu bán chạy {index + 1}</span>
                    <select
                      className="admin-input"
                      value={selectedProductId}
                      onChange={(event) => updateFeaturedSlot(index, event.target.value)}
                    >
                      <option value="">Chọn mẫu bánh</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === "products" && <div className="admin-cakes-layout">
        <aside className="admin-cakes-list">
          <div className="admin-cakes-list-head">
            <strong>{products.length} mẫu bánh</strong>
            <button type="button" onClick={addProduct}>Thêm</button>
          </div>
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              className={product.id === selectedProduct?.id ? "is-active" : ""}
              onClick={() => setSelectedId(product.id)}
            >
              <img src={product.image || "/og-cover.jpg"} alt={product.name} />
              <span>{product.name}</span>
              <strong>{formatMoney(product.price)}</strong>
            </button>
          ))}
        </aside>

        <div className="admin-cakes-editor">
          {selectedProduct && (
            <section className="admin-panel admin-cake-product-editor">
              <div className="admin-panel-head">
                <h2>Thông tin mẫu bánh</h2>
                <div className="admin-cakes-actions">
                  <button type="button" className="admin-secondary" onClick={duplicateProduct}>Nhân bản</button>
                  <button type="button" className="admin-danger" onClick={removeProduct}>Xóa</button>
                </div>
              </div>

              <div className="admin-cake-product-grid">
                <div className="admin-cake-image-box">
                  <img src={selectedProduct.image || "/og-cover.jpg"} alt={selectedProduct.name} />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadImage} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? "Đang tải ảnh..." : "Đổi ảnh"}
                  </button>
                </div>

                <div className="admin-cake-fields">
                  <label>
                    <span>Tên bánh</span>
                    <input className="admin-input" value={selectedProduct.name} onChange={(event) => updateProduct({ name: event.target.value })} />
                  </label>
                  <label>
                    <span>Giá</span>
                    <input className="admin-input" type="number" value={selectedProduct.price} onChange={(event) => updateProduct({ price: Number(event.target.value) })} />
                  </label>
                  <label>
                    <span>Kích thước</span>
                    <input className="admin-input" value={selectedProduct.size} onChange={(event) => updateProduct({ size: event.target.value })} />
                  </label>
                  <label>
                    <span>Khẩu phần</span>
                    <input className="admin-input" value={selectedProduct.serving} onChange={(event) => updateProduct({ serving: event.target.value })} />
                  </label>
                  <label className="admin-cake-wide">
                    <span>Mô tả</span>
                    <textarea className="admin-input" rows="3" value={selectedProduct.description} onChange={(event) => updateProduct({ description: event.target.value })} />
                  </label>
                  <label>
                    <span>Thành phần, mỗi dòng 1 ý</span>
                    <textarea className="admin-input" rows="7" value={listToText(selectedProduct.ingredients)} onChange={(event) => updateProduct({ ingredients: textToList(event.target.value) })} />
                  </label>
                  <label>
                    <span>Phụ kiện đi kèm mặc định, mỗi dòng 1 ý</span>
                    <textarea className="admin-input" rows="7" value={listToText(selectedProduct.accessories)} onChange={(event) => updateProduct({ accessories: textToList(event.target.value) })} />
                  </label>
                  <label className="admin-cake-wide">
                    <span>Cách áp dụng phụ kiện</span>
                    <select
                      className="admin-input"
                      value={selectedProduct.addonMode || CAKE_ADDON_MODES.paid}
                      onChange={(event) => updateProduct({ addonMode: event.target.value })}
                    >
                      <option value={CAKE_ADDON_MODES.paid}>Tính phí phụ kiện như bình thường</option>
                      <option value={CAKE_ADDON_MODES.includedSet}>Bộ phụ kiện đã bao gồm trong giá bánh</option>
                      <option value={CAKE_ADDON_MODES.chibiOnly}>Chỉ cho thêm chibi</option>
                      <option value={CAKE_ADDON_MODES.none}>Không áp dụng phụ kiện</option>
                    </select>
                  </label>
                  <label className="admin-cake-toggle">
                    <input type="checkbox" checked={selectedProduct.active !== false} onChange={(event) => updateProduct({ active: event.target.checked })} />
                    <span>Đang hiển thị ngoài trang khách</span>
                  </label>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>}
    </section>
  );
}
