export const promoTabs = [
  { id: "coupon", label: "Mã giảm giá" },
  { id: "free_shipping", label: "Freeship" },
  { id: "strike_price", label: "Gạch giá món ăn" },
  { id: "flash_sale", label: "Flashsale" },
  { id: "gift_threshold", label: "Chương trình tặng món" }
];

export const promoDefaults = {
  free_shipping: {
    name: "Freeship đơn theo chương trình",
    title: "Freeship",
    text: "Hỗ trợ phí ship theo mốc đơn",
    icon: "bike",
    active: true,
    displayPlaces: ["home", "checkout"],
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
    name: "Gạch giá món ăn",
    title: "Giá sốc",
    text: "Hiển thị giá gạch trên món",
    icon: "sale",
    active: true,
    displayPlaces: ["home", "menu"],
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
    condition: {
      minSubtotal: 0,
      customerType: "all",
      productIds: "",
      categoryIds: "",
      applyScope: "product",
      useTimeWindow: true,
      startTime: "10:00",
      endTime: "13:00",
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
    condition: { minSubtotal: 99000, customerType: "all", productIds: "", categoryIds: "" },
    reward: { type: "gift", value: "", productId: "" },
    startAt: "2026-05-01",
    endAt: "2026-12-31",
    priority: 40
  }
};
