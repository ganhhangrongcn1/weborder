import { bottomTabToPath, customerPageToPath } from "../../app/routeState.js";

export function createNavigationActions({
  setPage,
  setActiveTab,
  setSelectedProduct,
  setSelectedSpice,
  setSelectedToppings,
  setQuantity,
  setEditingCartId,
  setNote,
  setIsOptionModalOpen,
  storeProducts,
  spiceLevels,
  storeToppings,
  getDefaultOrderChoices,
  getStoreBlockNotice,
  onStoreBlocked,
  onRouteChange
}) {
  const tryBlockStoreAction = () => {
    const notice = getStoreBlockNotice?.();
    if (!notice) return false;
    onStoreBlocked?.(notice);
    return true;
  };

  function navigate(nextPage, nextTab = nextPage) {
    setPage(nextPage);
    setActiveTab(nextTab);
    const nextPath = customerPageToPath(nextPage, nextTab);
    onRouteChange?.(nextPath);
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function openProduct(product) {
    if (tryBlockStoreAction()) return;
    const defaults = getDefaultOrderChoices(product);
    setSelectedProduct(product);
    setSelectedSpice(defaults.spice);
    setSelectedToppings(defaults.toppings);
    setQuantity(1);
    navigate("detail", "home");
  }

  function openOptionModal(product) {
    if (tryBlockStoreAction()) return;
    setEditingCartId(null);
    const defaults = getDefaultOrderChoices(product);
    setSelectedProduct(product);
    setSelectedSpice(defaults.spice);
    setSelectedToppings(defaults.toppings);
    setNote("");
    setQuantity(1);
    setIsOptionModalOpen(true);
  }

  function openOptionModalFromHome(product) {
    openOptionModal(product);
  }

  function openCartItemEditor(item) {
    const isAddon = String(item?.id || "").startsWith("addon-");
    if (isAddon) return;
    const sourceProduct = storeProducts.find(product => product.id === item.id);
    const editableProduct = sourceProduct ? {
      ...sourceProduct,
      ...item,
      optionGroups: sourceProduct.optionGroups || item.optionGroups || []
    } : item;
    setEditingCartId(item.cartId);
    setSelectedProduct(editableProduct);
    setSelectedSpice(item.spice || spiceLevels[1]);
    setSelectedToppings(item.toppings || []);
    setNote(item.note || "");
    setQuantity(item.quantity || 1);
    setIsOptionModalOpen(true);
  }

  function closeOptionModal() {
    setIsOptionModalOpen(false);
    setEditingCartId(null);
  }

  function handleBottomNav(tab) {
    if (tab === "menu" && tryBlockStoreAction()) return;
    const pageMap = {
      home: "home",
      menu: "menu",
      orders: "tracking",
      rewards: "loyalty",
      account: "account"
    };
    setPage(pageMap[tab] || "home");
    setActiveTab(tab);
    onRouteChange?.(bottomTabToPath(tab));
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  return {
    navigate,
    openProduct,
    openOptionModal,
    openOptionModalFromHome,
    openCartItemEditor,
    closeOptionModal,
    handleBottomNav
  };
}
