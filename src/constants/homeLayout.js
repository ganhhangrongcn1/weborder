// Home currently uses a fixed layout. The legacy featuredProducts key hosts the stamp card.
// Keep this key so existing banner/popup destinations continue to work.
export const HOME_BLOCK_RENDER_ORDER = [
  "hero", "featuredProducts", "fulfillment", "promoVouchers", "reviewRewards", "flashSale", "deliveryApps"
];
