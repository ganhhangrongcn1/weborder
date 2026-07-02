export const promoTabs = [
  {
    id: "coupon",
    label: "Voucher",
    description: "Mã nhập ở checkout / loyalty"
  },
  {
    id: "free_shipping",
    label: "Hỗ trợ ship",
    description: "Hỗ trợ phí ship theo mốc đơn"
  },
  {
    id: "strike_price",
    label: "Giảm giá món",
    description: "Giá ưu đãi hiển thị trên menu"
  },
  {
    id: "flash_sale",
    label: "Flash sale",
    description: "Giảm sâu theo khung giờ và số suất"
  },
  {
    id: "gift_threshold",
    label: "Tặng món",
    description: "Đủ mốc đơn sẽ gợi ý quà tặng"
  }
];

export const promoDefaults = {
  free_shipping: {
    name: "Hỗ trợ ship theo mốc đơn",
    title: "Hỗ trợ ship",
    text: "Hỗ trợ phí ship theo mốc đơn",
    icon: "bike",
    active: true,
    displayPlaces: ["home", "checkout"],
    salesChannels: ["web"],
    condition: {
      minSubtotal: 150000,
      customerType: "all",
      productIds: "",
      categoryIds: "",
      maxSupportShipFee: 0
    },
    reward: {
      type: "shipping_discount",
      value: "full"
    },
    startAt: "2026-05-01",
    endAt: "2026-12-31",
    priority: 10
  },
  strike_price: {
    name: "Giảm giá món ăn",
    title: "Giá ưu đãi",
    text: "Hiển thị giá ưu đãi trên menu",
    icon: "sale",
    active: true,
    displayPlaces: ["home", "menu"],
    salesChannels: ["web", "qr"],
    condition: {
      minSubtotal: 0,
      customerType: "all",
      productIds: "",
      categoryIds: "",
      applyScope: "all",
      useTimeWindow: false,
      startTime: "09:00",
      endTime: "21:00",
      noStackWithOtherPromotions: false,
      minDiscountToShow: 5,
      minFinalPrice: 0
    },
    reward: {
      type: "percent_discount",
      value: 10,
      roundMode: "none"
    },
    startAt: "2026-05-01",
    endAt: "2026-12-31",
    priority: 20
  },
  flash_sale: {
    name: "Flashsale",
    title: "Flash Sale",
    text: "Giảm sâu theo khung giờ",
    icon: "sale",
    active: true,
    displayPlaces: ["home", "menu"],
    salesChannels: ["web", "qr"],
    condition: {
      minSubtotal: 0,
      customerType: "all",
      productIds: "",
      categoryIds: "",
      applyScope: "product",
      useTimeWindow: true,
      startTime: "10:00",
      endTime: "13:00",
      weekdays: [],
      totalSlots: 50,
      soldCount: 0,
      maxPerCustomer: 2,
      noStackWithOtherPromotions: true
    },
    reward: { type: "percent_discount", value: 20, roundMode: "none" },
    startAt: "2026-05-01",
    endAt: "2026-12-31",
    priority: 30
  },
  gift_threshold: {
    name: "Chương trình tặng món",
    title: "Tặng món theo mốc",
    text: "Đạt mốc tự động tặng món",
    icon: "gift",
    active: true,
    displayPlaces: ["checkout", "home"],
    salesChannels: ["web", "qr"],
    condition: { minSubtotal: 99000, customerType: "all", productIds: "", categoryIds: "" },
    reward: { type: "gift", value: "", productId: "" },
    startAt: "2026-05-01",
    endAt: "2026-12-31",
    priority: 40
  }
};
