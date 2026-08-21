import { useEffect, useState } from "react";
import { AdminButton } from "../../ui/index.js";

function normalizePriceDraft(value) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? String(price) : "0";
}

export default function MenuProductPriceRow({
  product,
  saving = false,
  saveDisabled = false,
  onEditProduct,
  onSavePrices,
  onToggleVisibility
}) {
  const websitePrice = Number(product?.price || 0);
  const storePrice = Number(product?.posPrice ?? product?.pos_price ?? product?.price ?? 0);
  const [webPriceDraft, setWebPriceDraft] = useState(() => normalizePriceDraft(websitePrice));
  const [storePriceDraft, setStorePriceDraft] = useState(() => normalizePriceDraft(storePrice));
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    setWebPriceDraft(normalizePriceDraft(websitePrice));
    setStorePriceDraft(normalizePriceDraft(storePrice));
    setSaveMessage("");
  }, [product?.id, websitePrice, storePrice]);

  const nextWebsitePrice = Number(webPriceDraft || 0);
  const nextStorePrice = Number(storePriceDraft || 0);
  const hasChanges = nextWebsitePrice !== websitePrice || nextStorePrice !== storePrice;
  const pricesAreValid = nextWebsitePrice > 0 && nextStorePrice > 0;

  const handleSave = async () => {
    if (!pricesAreValid) {
      setSaveMessage("Giá phải lớn hơn 0.");
      return;
    }

    setSaveMessage("");
    const result = await onSavePrices?.({
      productId: product.id,
      webPrice: nextWebsitePrice,
      posPrice: nextStorePrice
    });
    setSaveMessage(result?.ok ? "Đã lưu" : (result?.message || "Chưa thể lưu giá."));
  };

  const openProductEditor = (event) => {
    if (event.target.closest("input, button, label")) return;
    onEditProduct?.(product);
  };

  const openProductEditorByKeyboard = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onEditProduct?.(product);
  };

  return (
    <article
      className="admin-menu-product-row admin-menu-product-price-row"
      role="button"
      tabIndex={0}
      onClick={openProductEditor}
      onKeyDown={openProductEditorByKeyboard}
      aria-label={`Chỉnh sửa món ${product.name}`}
    >
      <img src={product.image} alt={product.name} />

      <span className="admin-menu-product-identity">
        <strong>{product.name}</strong>
        <small>Bấm vào tên món để chỉnh chi tiết</small>
      </span>

      <div className="admin-menu-inline-prices" onClick={(event) => event.stopPropagation()}>
        <label>
          <span>Website</span>
          <div className="admin-menu-price-input-wrap">
            <input
              type="number"
              min="1"
              step="1000"
              inputMode="numeric"
              value={webPriceDraft}
              onChange={(event) => { setWebPriceDraft(event.target.value); setSaveMessage(""); }}
              aria-label={`Giá Website của ${product.name}`}
            />
            <em>đ</em>
          </div>
        </label>
        <label>
          <span>Tại quán / POS</span>
          <div className="admin-menu-price-input-wrap">
            <input
              type="number"
              min="1"
              step="1000"
              inputMode="numeric"
              value={storePriceDraft}
              onChange={(event) => { setStorePriceDraft(event.target.value); setSaveMessage(""); }}
              aria-label={`Giá tại quán của ${product.name}`}
            />
            <em>đ</em>
          </div>
        </label>
      </div>

      <div className="admin-menu-product-price-actions" onClick={(event) => event.stopPropagation()}>
        <div className="admin-menu-product-visibility">
          <i>{product.visible === false ? "Đang ẩn" : "Đang bán"}</i>
          <label className="admin-switch">
            <input
              type="checkbox"
              checked={product.visible !== false}
              onChange={(event) => onToggleVisibility?.(product.id, event.target.checked)}
            />
            <span />
          </label>
        </div>
        <AdminButton
          type="button"
          className={`admin-menu-price-save ${hasChanges ? "is-dirty" : ""}`}
          disabled={!hasChanges || !pricesAreValid || saving || saveDisabled}
          onClick={handleSave}
        >
          {saving ? "Đang lưu..." : "Lưu giá"}
        </AdminButton>
        {saveMessage ? <small className={saveMessage === "Đã lưu" ? "is-success" : "is-error"}>{saveMessage}</small> : null}
      </div>
    </article>
  );
}
