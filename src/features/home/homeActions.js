export function createHomeActionHandlers({
  navigate,
  refs,
  onDeliveryApps
}) {
  const getRefByTarget = (target) => {
    const map = {
      promoVouchers: refs.promoVouchersRef,
      deliveryApps: refs.deliveryAppsRef,
      fulfillment: refs.fulfillmentRef,
      flashSale: refs.flashSaleRef,
      featuredProducts: refs.featuredProductsRef
    };
    return map[target] || null;
  };

  const handleAction = (item) => {
    const actionType = item?.actionType || (item?.actionUrl ? "url" : "block");
    if (actionType === "url" && item?.actionUrl) {
      window.open(item.actionUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const target = item?.actionTarget || "home";
    if (target === "deliveryApps" && onDeliveryApps) { onDeliveryApps(); return; }
    if (target === "categorySection") {
      navigate("menu", "menu");
      return;
    }
    if (["menu", "checkout", "loyalty", "account", "tracking", "reviewRewards"].includes(target)) {
      navigate(target, target === "reviewRewards" ? "account" : target);
      return;
    }
    if (target === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const targetRef = getRefByTarget(target);
    if (!targetRef?.current && target === "promoVouchers") { navigate("loyalty", "rewards"); return; }
    if (!targetRef?.current && target === "flashSale") { navigate("menu", "menu"); return; }
    targetRef?.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return {
    getRefByTarget,
    handleAction
  };
}
