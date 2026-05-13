export function createHomeActionHandlers({
  navigate,
  refs
}) {
  const getRefByTarget = (target) => {
    const map = {
      cashback: refs.cashbackRef,
      deliveryApps: refs.deliveryAppsRef,
      fulfillment: refs.fulfillmentRef,
      flashSale: refs.flashSaleRef,
      categorySection: refs.categorySectionRef,
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
    if (["menu", "checkout", "loyalty", "account", "tracking"].includes(target)) {
      navigate(target, target);
      return;
    }
    if (target === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const targetRef = getRefByTarget(target);
    targetRef?.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return {
    getRefByTarget,
    handleAction
  };
}
