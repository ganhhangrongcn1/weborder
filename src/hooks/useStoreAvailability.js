export default function useStoreAvailability(branches = []) {
  const activeBranches = branches.filter(Boolean);
  const deliveryBranches = activeBranches.filter((branch) => branch?.shipEnabled !== false);
  const pickupBranches = activeBranches.filter((branch) => branch?.pickupEnabled !== false);

  const getBranchOpenClose = (branch) => {
    const defaultOpen = "09:00";
    const defaultClose = "21:00";
    if (branch?.openTime && branch?.closeTime) return { open: branch.openTime, close: branch.closeTime };
    const matched = String(branch?.time || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!matched) return { open: defaultOpen, close: defaultClose };
    const normalize = (value) => {
      const [h, m] = String(value).split(":");
      return `${String(Number(h)).padStart(2, "0")}:${String(Number(m)).padStart(2, "0")}`;
    };
    return { open: normalize(matched[1]), close: normalize(matched[2]) };
  };

  const isBranchOpenNow = (branch) => {
    const { open, close } = getBranchOpenClose(branch);
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    return current >= oh * 60 + om && current <= ch * 60 + cm;
  };

  const buildStoreOfflineNotice = () => ({
    type: "offline",
    badge: "Đang đóng cửa",
    title: "Quán hiện đang tạm ngưng nhận đơn",
    description: "Bạn có thể mua trên các nền tảng giao hàng như GrabFood, ShopeeFood hoặc Xanh SM Ngon."
  });

  const buildDeliveryDisabledNotice = () => ({
    type: "delivery_off",
    badge: "Tạm dừng giao hàng",
    title: "Quán tạm ngưng giao hàng online",
    description: "Bạn có thể chuyển sang Tự đến lấy hoặc đặt qua GrabFood, ShopeeFood, Xanh SM Ngon để được phục vụ nhanh."
  });

  const buildPickupDisabledNotice = () => ({
    type: "pickup_off",
    badge: "Tạm dừng đến lấy",
    title: "Quán tạm ngưng phục vụ tự đến lấy",
    description: "Bạn vui lòng chọn Giao hàng hoặc đặt qua các nền tảng giao hàng để thuận tiện hơn."
  });

  const buildOutOfHoursNotice = (branch) => {
    if (!branch) {
      return {
        type: "out_of_hours",
        badge: "Ngoài giờ phục vụ",
        title: "Quán đang nghỉ ngoài giờ hoạt động",
        description: "Quán sẽ mở lại theo giờ hoạt động của từng chi nhánh. Mong bạn thông cảm và quay lại sau nhé."
      };
    }
    const { open, close } = getBranchOpenClose(branch);
    return {
      type: "out_of_hours",
      badge: "Ngoài giờ phục vụ",
      title: "Chi nhánh này đang nghỉ nhận đơn",
      description: `Chi nhánh ${branch.name} nhận đơn từ ${open} đến ${close}. Bạn vui lòng quay lại trong khung giờ phục vụ hoặc chọn nền tảng giao hàng để đặt ngay.`
    };
  };

  const getStoreBlockNotice = () => {
    if (!deliveryBranches.length && !pickupBranches.length) return buildStoreOfflineNotice();
    const openNowDelivery = deliveryBranches.find((branch) => isBranchOpenNow(branch));
    const openNowPickup = pickupBranches.find((branch) => isBranchOpenNow(branch));
    if (!openNowDelivery && !openNowPickup) return buildOutOfHoursNotice();
    return null;
  };

  return {
    activeBranches,
    deliveryBranches,
    pickupBranches,
    getBranchOpenClose,
    isBranchOpenNow,
    buildStoreOfflineNotice,
    buildDeliveryDisabledNotice,
    buildPickupDisabledNotice,
    buildOutOfHoursNotice,
    getStoreBlockNotice
  };
}
