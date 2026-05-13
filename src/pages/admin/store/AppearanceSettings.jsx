import { useEffect, useMemo, useRef, useState } from "react";
import { processUploadImage } from "../../../utils/imageUpload.js";
import { uploadImageToMenuBucket } from "../../../services/supabase/storageService.js";
import { AdminBadge, AdminButton, AdminCard } from "../ui/index.js";
import AppearanceCropModal from "./AppearanceCropModal.jsx";
import AppearanceBlockList from "./AppearanceBlockList.jsx";
import AppearanceBlockEditor from "./AppearanceBlockEditor.jsx";
import {
  catalogConfigRepository,
  CATALOG_CONFIG_KEYS,
  syncAppearanceCatalogToSupabase
} from "../../../services/repositories/catalogConfigRepository.js";
import {
  BANNER_WIDTH,
  BANNER_HEIGHT,
  HOME_BLOCKS,
  HOME_BLOCK_DEFAULTS,
  buildDeliveryBranchApps,
  isTopBannerItem,
  normalizeAction
} from "./appearanceSettings.utils.js";

function parseAdminDateTime(dateValue, timeValue, fallbackTime) {
  if (!dateValue) return null;
  const time = String(timeValue || fallbackTime || "00:00");
  const date = new Date(`${dateValue}T${time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIdList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function calculateFlashSaleWarnings({ flashSaleBlock, smartPromotions = [], products = [] }) {
  if (flashSaleBlock?.active === false) return [];

  const warnings = [];
  const now = new Date();
  const visibleProducts = products.filter((product) => product?.visible !== false);
  const flashPromos = smartPromotions.filter((promo) => promo?.type === "flash_sale");
  const activePromos = flashPromos.filter((promo) => promo?.active !== false);

  if (!flashPromos.length) return ["Chưa có chương trình Flash Sale. Vào Khuyến mãi > Flashsale để tạo chương trình."];
  if (!activePromos.length) return ["Tất cả chương trình Flash Sale đang tắt."];

  const validPromos = activePromos.filter((promo) => {
    const totalSlots = Number(promo?.condition?.totalSlots || 0);
    const soldCount = Number(promo?.condition?.soldCount || 0);
    if (totalSlots > 0 && soldCount >= totalSlots) return false;

    const start = parseAdminDateTime(promo?.startAt, promo?.condition?.startTime, "00:00");
    const end = parseAdminDateTime(promo?.endAt, promo?.condition?.endTime, "23:59");
    if (start && now.getTime() < start.getTime()) return false;
    if (end && now.getTime() > end.getTime()) return false;

    const scope = promo?.condition?.applyScope || "product";
    const categoryIds = toIdList(promo?.condition?.categoryIds);
    const productIds = toIdList(promo?.condition?.productIds);
    const matchedProducts = visibleProducts.filter((product) => {
      if (scope === "category") return categoryIds.includes(String(product?.category || ""));
      return productIds.includes(String(product?.id || ""));
    });

    return matchedProducts.some((product) => {
      const basePrice = Number(product?.originalPrice || product?.price || 0);
      const rewardType = promo?.reward?.type || "percent_discount";
      const rewardValue = Number(promo?.reward?.value || 0);
      const salePrice = rewardType === "fixed_discount"
        ? Math.max(basePrice - rewardValue, 0)
        : Math.max(basePrice * (1 - rewardValue / 100), 0);
      return basePrice > 0 && salePrice > 0 && salePrice < basePrice;
    });
  });

  if (validPromos.length) return [];

  const hasRunningTime = activePromos.some((promo) => {
    const start = parseAdminDateTime(promo?.startAt, promo?.condition?.startTime, "00:00");
    const end = parseAdminDateTime(promo?.endAt, promo?.condition?.endTime, "23:59");
    if (start && now.getTime() < start.getTime()) return false;
    if (end && now.getTime() > end.getTime()) return false;
    return true;
  });

  const hasRemainingSlots = activePromos.some((promo) => {
    const totalSlots = Number(promo?.condition?.totalSlots || 0);
    const soldCount = Number(promo?.condition?.soldCount || 0);
    return totalSlots <= 0 || soldCount < totalSlots;
  });

  const hasSelectedTarget = activePromos.some((promo) => {
    const scope = promo?.condition?.applyScope || "product";
    const categoryIds = toIdList(promo?.condition?.categoryIds);
    const productIds = toIdList(promo?.condition?.productIds);
    return scope === "category" ? categoryIds.length > 0 : productIds.length > 0;
  });

  if (!hasRunningTime) warnings.push("Chưa tới giờ chạy hoặc đã hết hạn Flash Sale.");
  if (!hasRemainingSlots) warnings.push("Flash Sale đã hết suất.");
  if (!hasSelectedTarget) warnings.push("Flash Sale chưa chọn món hoặc danh mục áp dụng.");
  if (!visibleProducts.length) warnings.push("Không có món đang hiển thị để chạy Flash Sale.");
  if (!warnings.length) warnings.push("Flash Sale chưa có món đủ điều kiện giảm giá thấp hơn giá gốc.");

  return warnings;
}

export default function AppearanceSettings({
  uiDirty = false,
  homeContent,
  setHomeContent,
  banners = [],
  branches = [],
  products = [],
  smartPromotions = [],
  onDirtyChange
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("hero");
  const [draggingBlockId, setDraggingBlockId] = useState("");
  const [draggingHeroId, setDraggingHeroId] = useState("");
  const [selectedHeroId, setSelectedHeroId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingUploadHeroId, setPendingUploadHeroId] = useState("");

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState("");
  const [cropSourceFile, setCropSourceFile] = useState(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);

  const uploadInputRef = useRef(null);
  const popupUploadRef = useRef(null);
  const cropImageRef = useRef(null);
  const cropViewportRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const topBannerItems = useMemo(() => homeContent.filter(isTopBannerItem), [homeContent]);

  useEffect(() => {
    const missing = HOME_BLOCK_DEFAULTS.filter((blockDefault) => !homeContent.some((item) => item.id === blockDefault.id));
    if (!missing.length) return;
    setHomeContent([...homeContent, ...missing]);
  }, [homeContent, setHomeContent]);

  useEffect(() => {
    if (!selectedHeroId || !topBannerItems.some((item) => item.id === selectedHeroId)) {
      setSelectedHeroId(topBannerItems[0]?.id || "");
    }
  }, [topBannerItems, selectedHeroId]);

  const selectedHeroBlock = topBannerItems.find((item) => item.id === selectedHeroId) || topBannerItems[0] || null;
  const selectedActionType = selectedHeroBlock ? normalizeAction(selectedHeroBlock) : "block";

  const blockMetaById = useMemo(() => Object.fromEntries(HOME_BLOCKS.map((item) => [item.id, item])), []);

  const blockOrder = useMemo(() => {
    const order = {};
    HOME_BLOCKS.forEach((item, index) => {
      const idx =
        item.id === "hero"
          ? homeContent.findIndex((contentItem) => isTopBannerItem(contentItem))
          : homeContent.findIndex((contentItem) => contentItem.id === item.id);
      order[item.id] = idx >= 0 ? idx : index;
    });
    return order;
  }, [homeContent]);

  const filteredBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = [...HOME_BLOCKS].sort((a, b) => blockOrder[a.id] - blockOrder[b.id]);
    if (!q) return source;
    return source.filter((item) => `${item.title} ${item.placement} ${item.id}`.toLowerCase().includes(q));
  }, [search, blockOrder]);

  const getBlockData = (blockId) => {
    if (blockId === "hero") return { id: "hero", active: topBannerItems.some((item) => item.active !== false) };
    return homeContent.find((item) => item.id === blockId) || HOME_BLOCK_DEFAULTS.find((item) => item.id === blockId) || { id: blockId, active: true };
  };

  const updateHomeContent = (id, patch) => {
    onDirtyChange?.(true);
    setHomeContent((current) => {
      const existed = current.some((item) => item.id === id);
      if (existed) {
        return current.map((item) => (item.id === id ? { ...item, ...patch } : item));
      }
      const fallback =
        HOME_BLOCK_DEFAULTS.find((item) => item.id === id) ||
        HOME_BLOCKS.find((item) => item.id === id) || { id };
      return [...current, { ...fallback, ...patch }];
    });
  };

  const setBlockActive = (blockId, checked) => {
    onDirtyChange?.(true);
    if (blockId === "hero") {
      setHomeContent((current) => current.map((item) => (isTopBannerItem(item) ? { ...item, active: checked } : item)));
      return;
    }
    updateHomeContent(blockId, { active: checked });
  };

  const reorderBlocks = (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const ordered = [...HOME_BLOCKS].sort((a, b) => blockOrder[a.id] - blockOrder[b.id]);
    const currentIndex = ordered.findIndex((item) => item.id === draggedId);
    const targetIndex = ordered.findIndex((item) => item.id === targetId);
    if (currentIndex < 0 || targetIndex < 0) return;
    const next = [...ordered];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);
    const nextIndexByBlock = Object.fromEntries(next.map((item, index) => [item.id, index]));

    onDirtyChange?.(true);
    setHomeContent((current) => {
      const keepOrderWithinGroup = [...current];
      keepOrderWithinGroup.sort((a, b) => {
        const blockA = isTopBannerItem(a) ? "hero" : a.id;
        const blockB = isTopBannerItem(b) ? "hero" : b.id;
        const ia = nextIndexByBlock[blockA] ?? Number.MAX_SAFE_INTEGER;
        const ib = nextIndexByBlock[blockB] ?? Number.MAX_SAFE_INTEGER;
        if (ia !== ib) return ia - ib;
        if (blockA === "hero" && blockB === "hero") {
          const heroIds = topBannerItems.map((hero) => hero.id);
          return heroIds.indexOf(a.id) - heroIds.indexOf(b.id);
        }
        return 0;
      });
      return keepOrderWithinGroup;
    });
  };

  const reorderTopBanners = (nextTopBanners) => {
    onDirtyChange?.(true);
    let cursor = 0;
    setHomeContent((current) =>
      current.map((item) => {
        if (!isTopBannerItem(item)) return item;
        const nextItem = nextTopBanners[cursor];
        cursor += 1;
        return nextItem || item;
      })
    );
  };

  const reorderBannerByDrop = (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const currentIndex = topBannerItems.findIndex((item) => item.id === draggedId);
    const targetIndex = topBannerItems.findIndex((item) => item.id === targetId);
    if (currentIndex < 0 || targetIndex < 0) return;
    const next = [...topBannerItems];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);
    reorderTopBanners(next);
    setSelectedHeroId(draggedId);
  };

  const deleteBanner = (id) => {
    if (topBannerItems.length <= 1) {
      alert("Cần giữ ít nhất 1 banner đầu trang.");
      return;
    }
    onDirtyChange?.(true);
    setHomeContent((current) => current.filter((item) => item.id !== id));
    if (selectedHeroId === id) {
      setSelectedHeroId(topBannerItems.find((item) => item.id !== id)?.id || "");
    }
  };

  const addBannerItem = () => {
    const nextId = `banner-${Date.now()}`;
    const nextItem = {
      id: nextId,
      placement: "Trang chủ / Banner đầu trang",
      title: "Banner mới",
      active: true,
      image: "",
      bannerZone: "home-hero",
      actionType: "block",
      actionTarget: "home",
      actionUrl: ""
    };
    onDirtyChange?.(true);
    setHomeContent((current) => [nextItem, ...current]);
    setSelectedHeroId(nextId);
    setPendingUploadHeroId("");
  };

  const clampCropOffset = (nextOffset, scaleValue = cropScale) => {
    const viewport = cropViewportRef.current;
    const image = cropImageRef.current;
    if (!viewport || !image) return nextOffset;
    const frameW = viewport.clientWidth;
    const frameH = viewport.clientHeight;
    const baseScale = Math.max(frameW / image.naturalWidth, frameH / image.naturalHeight);
    const drawW = image.naturalWidth * baseScale * scaleValue;
    const drawH = image.naturalHeight * baseScale * scaleValue;
    const maxX = Math.max(0, (drawW - frameW) / 2);
    const maxY = Math.max(0, (drawH - frameH) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, nextOffset.y))
    };
  };

  const openCropperForFile = (file) => {
    const objectUrl = URL.createObjectURL(file);
    setCropSourceFile(file);
    setCropSourceUrl(objectUrl);
    setCropScale(1);
    setCropOffset({ x: 0, y: 0 });
    setCropModalOpen(true);
  };

  const closeCropper = () => {
    setCropModalOpen(false);
    setIsDraggingCrop(false);
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
    setCropSourceUrl("");
    setCropSourceFile(null);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const applyCroppedImage = async () => {
    const image = cropImageRef.current;
    const viewport = cropViewportRef.current;
    const targetId = pendingUploadHeroId || selectedHeroBlock?.id || "";
    if (!image || !viewport || !targetId || !cropSourceFile) return;
    setUploading(true);
    try {
      const frameW = viewport.clientWidth;
      const frameH = viewport.clientHeight;
      const baseScale = Math.max(frameW / image.naturalWidth, frameH / image.naturalHeight);
      const drawScale = baseScale * cropScale;
      const drawW = image.naturalWidth * drawScale;
      const drawH = image.naturalHeight * drawScale;
      const drawX = (frameW - drawW) / 2 + cropOffset.x;
      const drawY = (frameH - drawH) / 2 + cropOffset.y;

      const srcX = Math.max(0, (-drawX) / drawScale);
      const srcY = Math.max(0, (-drawY) / drawScale);
      const srcW = Math.min(image.naturalWidth, frameW / drawScale);
      const srcH = Math.min(image.naturalHeight, frameH / drawScale);

      const canvas = document.createElement("canvas");
      canvas.width = BANNER_WIDTH;
      canvas.height = BANNER_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Không thể xử lý crop ảnh.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, BANNER_WIDTH, BANNER_HEIGHT);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error("Không thể xuất ảnh sau khi crop."));
              return;
            }
            resolve(b);
          },
          "image/webp",
          0.76
        );
      });

      const croppedFile = new File([blob], cropSourceFile.name || `image_${Date.now()}.webp`, { type: "image/webp" });
      // Keep localStorage payload smaller to reduce quota overflow risk.
      const result = await processUploadImage(croppedFile, { maxWidth: 960, quality: 0.62 });
      try {
        const uploaded = await uploadImageToMenuBucket(result.file, { folder: "banners" });
        updateHomeContent(targetId, { image: uploaded.publicUrl });
      } catch (_uploadError) {
        updateHomeContent(targetId, { image: result.dataUrl });
      }
      setPendingUploadHeroId("");
      closeCropper();
    } catch (error) {
      alert(error?.message || "Không thể crop ảnh.");
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = (event) => {
    const file = event.target.files?.[0];
    const targetId = pendingUploadHeroId || selectedHeroBlock?.id || "";
    if (!file || !targetId) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("Ảnh nên dưới 4MB để xử lý nhanh.");
      event.target.value = "";
      return;
    }
    openCropperForFile(file);
  };

  const handlePopupUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("Ảnh nên dưới 4MB để tải nhanh.");
      event.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const result = await processUploadImage(file, { maxWidth: 720, quality: 0.62 });
      try {
        const uploaded = await uploadImageToMenuBucket(result.file, { folder: "popups" });
        updateHomeContent("popupCampaign", { image: uploaded.publicUrl });
      } catch (_uploadError) {
        updateHomeContent("popupCampaign", { image: result.dataUrl });
      }
    } catch (error) {
      alert(error?.message || "Không thể tải ảnh popup.");
    } finally {
      setUploading(false);
      if (popupUploadRef.current) popupUploadRef.current.value = "";
    }
  };

  const selectedBlockMeta = blockMetaById[selectedBlockId] || HOME_BLOCKS[0];
  const selectedNonHeroBlock = selectedBlockId === "hero" ? null : getBlockData(selectedBlockId);
  const selectedPopupActionType = selectedBlockId === "popupCampaign" ? normalizeAction(selectedNonHeroBlock) : "block";
  const deliveryBranchApps = selectedBlockId === "deliveryApps"
    ? buildDeliveryBranchApps(selectedNonHeroBlock, branches)
    : [];
  const flashSaleWarnings = selectedBlockId === "flashSale"
    ? calculateFlashSaleWarnings({ flashSaleBlock: selectedNonHeroBlock, smartPromotions, products })
    : [];

  const appearanceStats = useMemo(() => {
    const allBlocks = HOME_BLOCKS.map((block) => getBlockData(block.id));
    const visible = allBlocks.filter((block) => block?.active !== false).length;

    return {
      total: allBlocks.length,
      visible,
      hidden: Math.max(allBlocks.length - visible, 0),
      heroItems: topBannerItems.length
    };
  }, [homeContent, topBannerItems.length]);

  const handleSaveAppearance = async () => {
    if (!uiDirty || isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      catalogConfigRepository.set(CATALOG_CONFIG_KEYS.homeContent, homeContent || []);
      catalogConfigRepository.set(CATALOG_CONFIG_KEYS.banners, Array.isArray(banners) ? banners : []);

      await syncAppearanceCatalogToSupabase({
        homeContent,
        banners: Array.isArray(banners) ? banners : []
      });

      onDirtyChange?.(false);
      setSaveMessage("Đã lưu giao diện.");
    } catch (error) {
      console.warn("[AppearanceSettings] save appearance failed", error);
      setSaveMessage("Lưu giao diện thất bại. Kiểm tra RLS policy write cho catalog.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-appearance-page">
      <div className="admin-appearance-page-head">
        <div>
          <h1>Quản lý giao diện</h1>
          <p>Quản lý các giao diện hiển thị trên website và ứng dụng.</p>
        </div>
        <AdminButton
          variant={uiDirty ? "primary" : "secondary"}
          onClick={handleSaveAppearance}
          disabled={!uiDirty || isSaving}
          className="admin-appearance-header-save"
        >
          {isSaving ? "Đang lưu..." : uiDirty ? "Lưu thay đổi" : "Đã đồng bộ"}
        </AdminButton>
      </div>
      {saveMessage ? <p className="text-sm text-slate-600">{saveMessage}</p> : null}

      <div className="admin-appearance-stats" aria-label="Tổng quan giao diện">
        <AdminCard variant="compact" className="admin-appearance-stat is-active">
          <span>Tất cả</span>
          <strong>{appearanceStats.total}</strong>
          <AdminBadge tone="brand">Block</AdminBadge>
        </AdminCard>
        <AdminCard variant="compact" className="admin-appearance-stat">
          <span>Đang hiển thị</span>
          <strong>{appearanceStats.visible}</strong>
          <AdminBadge tone="success">Bật</AdminBadge>
        </AdminCard>
        <AdminCard variant="compact" className="admin-appearance-stat">
          <span>Đã ẩn</span>
          <strong>{appearanceStats.hidden}</strong>
          <AdminBadge tone="neutral">Tắt</AdminBadge>
        </AdminCard>
        <AdminCard variant="compact" className="admin-appearance-stat">
          <span>Banner đầu trang</span>
          <strong>{appearanceStats.heroItems}</strong>
          <AdminBadge tone="info">Ảnh</AdminBadge>
        </AdminCard>
      </div>

      <div className="admin-panel admin-appearance-layout">
        <AppearanceBlockList
          search={search}
          setSearch={setSearch}
          filteredBlocks={filteredBlocks}
          getBlockData={getBlockData}
          draggingBlockId={draggingBlockId}
          setDraggingBlockId={setDraggingBlockId}
          reorderBlocks={reorderBlocks}
          selectedBlockId={selectedBlockId}
          setSelectedBlockId={setSelectedBlockId}
          setBlockActive={setBlockActive}
        />

        <AppearanceBlockEditor
          uiDirty={uiDirty}
          selectedBlockId={selectedBlockId}
          selectedBlockMeta={selectedBlockMeta}
          selectedNonHeroBlock={selectedNonHeroBlock}
          selectedPopupActionType={selectedPopupActionType}
          deliveryBranchApps={deliveryBranchApps}
          flashSaleWarnings={flashSaleWarnings}
          selectedHeroBlock={selectedHeroBlock}
          selectedActionType={selectedActionType}
          topBannerItems={topBannerItems}
          uploading={uploading}
          uploadInputRef={uploadInputRef}
          handleBannerUpload={handleBannerUpload}
          updateHomeContent={updateHomeContent}
          addBannerItem={addBannerItem}
          onSaveAppearance={handleSaveAppearance}
          setBlockActive={setBlockActive}
          draggingHeroId={draggingHeroId}
          setDraggingHeroId={setDraggingHeroId}
          reorderBannerByDrop={reorderBannerByDrop}
          deleteBanner={deleteBanner}
          setSelectedHeroId={setSelectedHeroId}
          popupUploadRef={popupUploadRef}
          handlePopupUpload={handlePopupUpload}
        />
      </div>

      <AppearanceCropModal
        open={cropModalOpen}
        onClose={closeCropper}
        cropViewportRef={cropViewportRef}
        cropImageRef={cropImageRef}
        cropSourceUrl={cropSourceUrl}
        setCropOffset={setCropOffset}
        setCropScale={setCropScale}
        setIsDraggingCrop={setIsDraggingCrop}
        dragStartRef={dragStartRef}
        cropOffset={cropOffset}
        isDraggingCrop={isDraggingCrop}
        clampCropOffset={clampCropOffset}
        cropScale={cropScale}
        applyCroppedImage={applyCroppedImage}
      />
    </section>
  );
}



