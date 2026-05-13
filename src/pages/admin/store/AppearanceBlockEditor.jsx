import { useEffect, useState } from "react";
import { AdminBadge, AdminButton, AdminCard, AdminInput, AdminIconButton, AdminSelect } from "../ui/index.js";
import { APP_SECTIONS, FALLBACK_IMAGE, HOME_SECTION_TARGETS } from "./appearanceSettings.utils.js";

export default function AppearanceBlockEditor({
  uiDirty = false,
  selectedBlockId,
  selectedBlockMeta,
  selectedNonHeroBlock,
  selectedPopupActionType,
  deliveryBranchApps = [],
  flashSaleWarnings = [],
  selectedHeroBlock,
  selectedActionType,
  topBannerItems,
  uploading,
  uploadInputRef,
  handleBannerUpload,
  updateHomeContent,
  addBannerItem,
  onSaveAppearance,
  setBlockActive,
  draggingHeroId,
  setDraggingHeroId,
  reorderBannerByDrop,
  deleteBanner,
  setSelectedHeroId,
  popupUploadRef,
  handlePopupUpload
}) {
  const [activeDeliveryBranchId, setActiveDeliveryBranchId] = useState("");
  const activeDeliveryBranch = deliveryBranchApps.find((branch) => branch.branchId === activeDeliveryBranchId) || deliveryBranchApps[0] || null;

  useEffect(() => {
    if (!deliveryBranchApps.length) {
      setActiveDeliveryBranchId("");
      return;
    }
    if (!deliveryBranchApps.some((branch) => branch.branchId === activeDeliveryBranchId)) {
      setActiveDeliveryBranchId(deliveryBranchApps[0].branchId);
    }
  }, [activeDeliveryBranchId, deliveryBranchApps]);

  const updateDeliveryBranchApp = (branchId, appId, patch) => {
    const nextBranchApps = deliveryBranchApps.map((branch) => ({
      ...branch,
      apps: branch.apps.map((app) => (branch.branchId === branchId && app.id === appId ? { ...app, ...patch } : app))
    }));

    updateHomeContent("deliveryApps", { branchApps: nextBranchApps });
  };

  if (selectedBlockId === "hero") {
    return (
      <div className="admin-appearance-col admin-appearance-form">
        <AdminCard variant="elevated" className="admin-appearance-editor">
          <EditorHead
            title="Banner đầu trang"
            description="Quản lý các banner con trong block hero."
            uiDirty={uiDirty}
            onSaveAppearance={onSaveAppearance}
            action={
              <>
                <AdminButton variant="secondary" onClick={addBannerItem}>+ Thêm hình</AdminButton>
                <label className="admin-switch admin-switch-lg">
                  <input type="checkbox" checked={topBannerItems.some((item) => item.active !== false)} onChange={(event) => setBlockActive("hero", event.target.checked)} />
                  <span />
                </label>
              </>
            }
          />

          {selectedHeroBlock ? (
            <>
              <div className="admin-appearance-main-grid">
                <div className="admin-appearance-preview">
                  <strong>Preview banner</strong>
                  <div className="admin-appearance-image-frame">
                    <img
                      src={selectedHeroBlock.image || FALLBACK_IMAGE}
                      alt={selectedHeroBlock.title || "Banner preview"}
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                    <label className="admin-appearance-upload-inline">
                      <input ref={uploadInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBannerUpload} disabled={uploading} />
                      <span
                        onClick={(event) => {
                          event.preventDefault();
                          uploadInputRef.current?.click();
                        }}
                      >
                        {uploading ? "Đang xử lý..." : "Thay đổi ảnh"}
                      </span>
                    </label>
                  </div>
                  <p className="admin-appearance-upload-note">Mỗi lần chọn 1 ảnh, gợi ý 1200x525px (16:7), kéo/crop trước khi lưu.</p>
                </div>

                <div className="admin-appearance-side">
                  <div className="admin-appearance-group">
                    <h4>Hành động khi bấm banner</h4>
                    <div className="admin-appearance-fields">
                      <label>
                        Loại hành động
                        <AdminSelect
                          value={selectedActionType}
                          onChange={(event) =>
                            updateHomeContent(selectedHeroBlock.id, {
                              actionType: event.target.value,
                              actionTarget: event.target.value === "block" ? selectedHeroBlock.actionTarget || "home" : selectedHeroBlock.actionTarget || "",
                              actionUrl: event.target.value === "url" ? selectedHeroBlock.actionUrl || "" : selectedHeroBlock.actionUrl || ""
                            })
                          }
                        >
                          <option value="block">Block</option>
                          <option value="url">URL</option>
                        </AdminSelect>
                      </label>

                      {selectedActionType === "block" ? (
                        <label className="wide">
                          Chọn block/section đích
                          <AdminSelect value={selectedHeroBlock.actionTarget || "home"} onChange={(event) => updateHomeContent(selectedHeroBlock.id, { actionTarget: event.target.value })}>
                            {APP_SECTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </AdminSelect>
                        </label>
                      ) : (
                        <label className="wide">
                          URL đích
                          <AdminInput value={selectedHeroBlock.actionUrl || ""} onChange={(event) => updateHomeContent(selectedHeroBlock.id, { actionUrl: event.target.value })} placeholder="https://..." />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-appearance-group">
                <h4>Danh sách banner trong block đầu trang</h4>
                <div className="admin-banner-order-list">
                  {topBannerItems.map((item, index) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggingHeroId(item.id)}
                      onDragEnd={() => setDraggingHeroId("")}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        reorderBannerByDrop(draggingHeroId, item.id);
                        setDraggingHeroId("");
                      }}
                      className={`admin-banner-order-item ${item.id === selectedHeroBlock.id ? "selected" : ""} ${draggingHeroId === item.id ? "dragging" : ""}`}
                    >
                      <button type="button" className="admin-banner-order-main" onClick={() => setSelectedHeroId(item.id)}>
                        <img src={item.image || FALLBACK_IMAGE} alt={item.title || "Banner"} />
                        <span>
                          <strong>{item.title || `Banner ${index + 1}`}</strong>
                          <small>Vị trí {index + 1}</small>
                        </span>
                      </button>
                      <div className="admin-banner-order-actions">
                        <AdminIconButton label="Xóa banner" variant="danger" onClick={() => deleteBanner(item.id)} disabled={topBannerItems.length <= 1}>
                          ×
                        </AdminIconButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="admin-help-text">Chưa có banner hero để chỉnh.</p>
          )}
        </AdminCard>
      </div>
    );
  }

  return (
    <div className="admin-appearance-col admin-appearance-form">
      <AdminCard variant="elevated" className="admin-appearance-editor">
        <EditorHead
          title={selectedBlockMeta.title}
          description={selectedBlockMeta.placement}
          uiDirty={uiDirty}
          onSaveAppearance={onSaveAppearance}
          action={
            <label className="admin-switch admin-switch-lg">
              <input type="checkbox" checked={selectedNonHeroBlock?.active !== false} onChange={(event) => setBlockActive(selectedBlockId, event.target.checked)} />
              <span />
            </label>
          }
        />

        <div className="admin-appearance-group">
          <h4>Thông tin block</h4>
          {selectedBlockId === "cashback" ? (
            <div className="admin-appearance-fields">
              <label className="wide">
                Tiêu đề
                <AdminInput value={selectedNonHeroBlock?.title || ""} onChange={(event) => updateHomeContent("cashback", { title: event.target.value })} />
              </label>
              <label className="wide">
                Mô tả
                <AdminInput value={selectedNonHeroBlock?.subtitle || ""} onChange={(event) => updateHomeContent("cashback", { subtitle: event.target.value })} />
              </label>
              <label>
                Ký hiệu icon
                <AdminInput value={selectedNonHeroBlock?.iconText || "%"} onChange={(event) => updateHomeContent("cashback", { iconText: event.target.value })} />
              </label>
            </div>
          ) : selectedBlockId === "deliveryApps" ? (
            <DeliveryAppsEditor
              selectedNonHeroBlock={selectedNonHeroBlock}
              deliveryBranchApps={deliveryBranchApps}
              activeDeliveryBranch={activeDeliveryBranch}
              setActiveDeliveryBranchId={setActiveDeliveryBranchId}
              updateHomeContent={updateHomeContent}
              updateDeliveryBranchApp={updateDeliveryBranchApp}
            />
          ) : selectedBlockId === "flashSale" ? (
            <FlashSaleNotice flashSaleWarnings={flashSaleWarnings} />
          ) : selectedBlockId === "popupCampaign" ? (
            <PopupCampaignEditor
              selectedNonHeroBlock={selectedNonHeroBlock}
              selectedPopupActionType={selectedPopupActionType}
              uploading={uploading}
              popupUploadRef={popupUploadRef}
              handlePopupUpload={handlePopupUpload}
              updateHomeContent={updateHomeContent}
            />
          ) : (
            <p className="admin-help-text">Block này dùng dữ liệu động từ hệ thống. Bạn chỉ cần bật/tắt và sắp xếp thứ tự hiển thị.</p>
          )}
        </div>
      </AdminCard>
    </div>
  );
}

function EditorHead({ title, description, uiDirty, onSaveAppearance, action }) {
  return (
    <div className="admin-appearance-subhead">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="admin-appearance-head-actions">
        <AdminButton variant={uiDirty ? "primary" : "secondary"} onClick={onSaveAppearance}>
          {uiDirty ? "Lưu thay đổi" : "Đã đồng bộ"}
        </AdminButton>
        {action}
      </div>
    </div>
  );
}

function DeliveryAppsEditor({
  selectedNonHeroBlock,
  deliveryBranchApps,
  activeDeliveryBranch,
  setActiveDeliveryBranchId,
  updateHomeContent,
  updateDeliveryBranchApp
}) {
  return (
    <div className="admin-appearance-fields">
      <label className="wide">
        Tiêu đề
        <AdminInput value={selectedNonHeroBlock?.title || ""} onChange={(event) => updateHomeContent("deliveryApps", { title: event.target.value })} />
      </label>
      <label className="wide">
        Mô tả
        <AdminInput
          value={selectedNonHeroBlock?.subtitle || ""}
          onChange={(event) => updateHomeContent("deliveryApps", { subtitle: event.target.value })}
          placeholder="Chọn chi nhánh gần bạn rồi đặt qua app quen thuộc."
        />
      </label>
      <div className="wide admin-delivery-app-branches">
        <label className="wide">
          Chọn chi nhánh đang chỉnh
          <AdminSelect value={activeDeliveryBranch?.branchId || ""} onChange={(event) => setActiveDeliveryBranchId(event.target.value)}>
            {deliveryBranchApps.map((branch) => (
              <option key={branch.branchId} value={branch.branchId}>
                {branch.branchName}
              </option>
            ))}
          </AdminSelect>
        </label>

        {activeDeliveryBranch ? (
          <div className="admin-delivery-app-branch">
            <div className="admin-delivery-app-grid">
              {activeDeliveryBranch.apps.map((app) => (
                <div key={`${activeDeliveryBranch.branchId}-${app.id}`} className="admin-delivery-app-row">
                  <label className="admin-switch">
                    <input type="checkbox" checked={app.active !== false} onChange={(event) => updateDeliveryBranchApp(activeDeliveryBranch.branchId, app.id, { active: event.target.checked })} />
                    <span />
                  </label>
                  <strong>{app.name}</strong>
                  <AdminInput value={app.url || ""} onChange={(event) => updateDeliveryBranchApp(activeDeliveryBranch.branchId, app.id, { url: event.target.value })} placeholder="https://..." />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="admin-help-text">Chưa có chi nhánh để cấu hình link app.</p>
        )}
      </div>
    </div>
  );
}

function FlashSaleNotice({ flashSaleWarnings }) {
  return (
    <div className="admin-appearance-fields">
      {flashSaleWarnings.length ? (
        <div className="wide admin-appearance-warning">
          <strong>Flash Sale chưa hiển thị trên Customer</strong>
          {flashSaleWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : (
        <div className="wide admin-appearance-ok">
          <strong>Flash Sale đủ điều kiện hiển thị</strong>
          <p>Customer sẽ thấy block này khi có sản phẩm Flash Sale đang chạy.</p>
        </div>
      )}
      <p className="wide admin-help-text">Nội dung Flash Sale được chỉnh trong Khuyến mãi &gt; Flashsale. Tại đây bạn chỉ bật/tắt và kéo thả vị trí block trên Home.</p>
    </div>
  );
}

function PopupCampaignEditor({
  selectedNonHeroBlock,
  selectedPopupActionType,
  uploading,
  popupUploadRef,
  handlePopupUpload,
  updateHomeContent
}) {
  return (
    <div className="admin-appearance-fields">
      <label className="wide">
        Tiêu đề popup
        <AdminInput value={selectedNonHeroBlock?.title || ""} onChange={(event) => updateHomeContent("popupCampaign", { title: event.target.value })} placeholder="Ví dụ: Ưu đãi hôm nay" />
      </label>
      <label className="wide">
        Mô tả ngắn
        <AdminInput value={selectedNonHeroBlock?.subtitle || ""} onChange={(event) => updateHomeContent("popupCampaign", { subtitle: event.target.value })} placeholder="Ví dụ: Chạm để xem menu mới" />
      </label>
      <label>
        Độ trễ hiển thị (giây)
        <AdminInput
          type="number"
          min="0"
          value={Number(selectedNonHeroBlock?.delaySeconds ?? 3)}
          onChange={(event) => updateHomeContent("popupCampaign", { delaySeconds: Math.max(0, Number(event.target.value || 0)) })}
        />
      </label>
      <label>
        Hiện lại sau
        <AdminSelect
          value={Number(selectedNonHeroBlock?.cooldownHours ?? 6)}
          onChange={(event) => updateHomeContent("popupCampaign", { cooldownHours: Number(event.target.value) })}
        >
          <option value={0}>Mỗi phiên truy cập</option>
          <option value={1}>1 giờ</option>
          <option value={6}>6 giờ</option>
          <option value={12}>12 giờ</option>
          <option value={24}>24 giờ</option>
        </AdminSelect>
      </label>
      <label>
        Loại hành động
        <AdminSelect
          value={selectedPopupActionType}
          onChange={(event) =>
            updateHomeContent("popupCampaign", {
              actionType: event.target.value,
              actionTarget: event.target.value === "block" ? selectedNonHeroBlock?.actionTarget || "home" : selectedNonHeroBlock?.actionTarget || "",
              actionUrl: event.target.value === "url" ? selectedNonHeroBlock?.actionUrl || "" : selectedNonHeroBlock?.actionUrl || ""
            })
          }
        >
          <option value="block">Block</option>
          <option value="url">URL</option>
        </AdminSelect>
      </label>
      {selectedPopupActionType === "block" ? (
        <label className="wide">
          Chọn điểm đến
          <AdminSelect value={selectedNonHeroBlock?.actionTarget || "home"} onChange={(event) => updateHomeContent("popupCampaign", { actionTarget: event.target.value })}>
            {HOME_SECTION_TARGETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </AdminSelect>
        </label>
      ) : (
        <label className="wide">
          URL đích
          <AdminInput value={selectedNonHeroBlock?.actionUrl || ""} onChange={(event) => updateHomeContent("popupCampaign", { actionUrl: event.target.value })} placeholder="https://..." />
        </label>
      )}
      <div className="wide admin-popup-upload">
        <strong>Ảnh popup</strong>
        <div className="admin-popup-upload-row">
          <img src={selectedNonHeroBlock?.image || FALLBACK_IMAGE} alt="Popup preview" />
          <label className="admin-popup-upload-trigger">
            <input ref={popupUploadRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePopupUpload} disabled={uploading} />
            <span>{uploading ? "Đang xử lý..." : "Chọn ảnh popup"}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
