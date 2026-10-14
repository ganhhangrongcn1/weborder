// Read endpoints observed in GrabMerchant Chrome Network on 2026-09-20.
// These internal APIs require a valid session and can change without notice.
const GRAB_API = Object.freeze({
  portal: "https://merchant.grab.com",
  foodOrigin: "https://api.grab.com",
  openStatus: "food/merchant/v3/open-status",
  // Existing write contract; verify with a read after every write.
  storeStatus: "food/merchant/v1/merchant/status",
  merchants: "food/merchant/v2/merchants",
  menu: "food/merchant/v2/menu",
  orders: "delvplatformapi/merchant/v4/orders-pagination",
  reviews: "food/merchant/v1/feedback/reviews",
  reviewOverview: "food/merchant/v1/feedback/overview",
  financeTransactions: "mex/finances/v1/transactions",
  financeSummary: "mex/finances/v1/transactions/summary",
  advertiserAccess: "admanageruiserver/v3/advertisers/access",
  advertiserPermissions: "admanageruiserver/v3/user-permissions-roles",
  marketingLanding: "mex-app/troy/unifieddemandgen/v1/landing-page"
});

export default GRAB_API;
