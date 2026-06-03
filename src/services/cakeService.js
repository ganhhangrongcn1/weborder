import { adminConfigRepository } from "./repositories/adminConfigRepository.js";
import { isSupabaseEnabled } from "./repositories/dataSource.js";
import { getSupabaseClient } from "./supabase/supabaseClient.js";
import { getSupabaseAdminAuthClient } from "./supabase/supabaseRuntimeClient.js";

export const CAKE_PRODUCTS_CONFIG_KEY = "ghr_cake_products";
export const CAKE_SETTINGS_CONFIG_KEY = "ghr_cake_settings";

export const DEFAULT_CAKE_SHIPPING_CONFIG = {
  baseFeeFirst3Km: 25000,
  feePerNextKm: 8000,
  freeShipThreshold: 0,
  supportShippingEnabled: false,
  maxSupportShipFee: 0,
  customerNote: "Bánh sinh nhật cần giao cẩn thận nên phí ship sẽ được tính riêng.",
  maxRadiusKm: 12,
  sourceBranchId: ""
};

export const CAKE_ADDON_MODES = {
  paid: "paid",
  includedSet: "included_set",
  chibiOnly: "chibi_only",
  none: "none"
};

export const DEFAULT_CAKE_FULFILLMENT_CONFIG = {
  pickupEnabled: true,
  pickupBranchIds: [],
  deliveryEnabled: true,
  deliverySourceBranchId: "",
  minPickupLeadMinutes: 120
};

export const DEFAULT_CAKE_SETTINGS = {
  zaloPhone: "0788422424",
  shippingConfig: DEFAULT_CAKE_SHIPPING_CONFIG,
  cakeFulfillment: DEFAULT_CAKE_FULFILLMENT_CONFIG,
  orderNotice: "Đặt trước tối thiểu 2 - 4 tiếng để shop chuẩn bị bánh đẹp nhất.",
  pickupAddress: "Gánh Hàng Rong",
  featuredProductIds: [
    "set-trai-tim-couple",
    "set-banh-trang-cuon-bo-18cm",
    "set-cuon-bo-mix-ps-muoi-tac-18cm",
    "set-banh-trang-cuon-tron-mix-topping-18cm"
  ],
  addonCatalog: {
    chibi: {
      enabled: true,
      name: "Hình chibi cá nhân hóa",
      price: 20000,
      image: "/cake-addons/chibi.jpg",
      description: "Hình chibi làm theo yêu cầu riêng."
    },
    decoration: {
      enabled: true,
      name: "Phụ kiện trang trí theo yêu cầu",
      price: 20000,
      description: "Có 3 mẫu phụ kiện đi kèm để khách chọn.",
      referenceImages: [
        "/cake-addons/phu-kien-thuc-te-1.jpg",
        "/cake-addons/phu-kien-thuc-te-2.jpg",
        "/cake-addons/phu-kien-thuc-te-3.jpg",
        "/cake-addons/phu-kien-thuc-te-4.jpg"
      ],
      options: [
        { id: "pk-1", name: "Mẫu phụ kiện 1", price: 20000, image: "/cake-addons/phu-kien-mau-1.jpg" },
        { id: "pk-2", name: "Mẫu phụ kiện 2", price: 20000, image: "/cake-addons/phu-kien-mau-2.jpg" },
        { id: "pk-3", name: "Mẫu phụ kiện 3", price: 20000, image: "/cake-addons/phu-kien-mau-3.jpg" }
      ]
    }
  }
};

export const DEFAULT_CAKE_PRODUCTS = [
  {
    id: "set-trai-tim-couple",
    name: "Set trái tim couple",
    price: 80000,
    image: "/cake-products/set-trai-tim-couple.jpg",
    size: "Set 2 phần hình trái tim",
    serving: "1 - 2 người",
    description: "Set nhỏ xinh cho 2 người, phù hợp sinh nhật thân mật hoặc tặng bất ngờ.",
    ingredients: ["Bánh tráng phơi sương mỡ hành", "Tóp mỡ rim mắm tỏi", "Chà bông", "Trứng cút", "Rau răm", "Xoài"],
    accessories: ["Dụng cụ ăn uống", "Nến Led"],
    active: true
  },
  {
    id: "set-banh-trang-cuon-bo-18cm",
    name: "Set bánh tráng cuốn bơ 18cm",
    price: 150000,
    image: "/cake-products/set-banh-trang-cuon-bo-18cm.jpg",
    size: "Size hộp 18cm - đường kính bánh 16cm",
    serving: "3 - 4 người",
    description: "Bánh tráng cuốn bơ phủ chà bông, vị béo nhẹ, dễ ăn.",
    ingredients: ["Bánh tráng cuốn bơ", "Chà bông", "Bơ trứng gà", "Trứng cút", "Rau răm", "Xoài", "Sốt me bơ", "Sốt sate bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    active: true
  },
  {
    id: "set-cuon-bo-mix-ps-muoi-tac-18cm",
    name: "Set cuốn bơ mix phơi sương muối tắc 18cm",
    price: 150000,
    image: "/cake-products/set-cuon-bo-mix-ps-muoi-tac-18cm.jpg",
    size: "Size hộp 18cm - đường kính bánh 16cm",
    serving: "3 - 4 người",
    description: "Set cuốn bơ mix bánh tráng phơi sương muối tắc, sốt me bơ và sate bơ.",
    ingredients: ["Bánh tráng phơi sương muối tắc", "Bánh tráng cuốn bơ", "Khô bò đỏ hoặc tóp mỡ", "Trứng cút", "Sốt sate bơ", "Sốt me bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led"],
    active: true
  },
  {
    id: "set-banh-trang-cuon-tron-mix-topping-18cm",
    name: "Set bánh tráng cuốn trộn mix topping 18cm",
    price: 170000,
    image: "/cake-products/set-banh-trang-cuon-tron-mix-topping-18cm.jpg",
    size: "Size hộp 18cm - đường kính bánh 16cm",
    serving: "3 - 4 người",
    description: "Bánh tráng phơi sương cuốn trộn nhiều topping, phù hợp nhóm nhỏ.",
    ingredients: ["Bánh tráng phơi sương cuốn trộn", "Tóp mỡ rim mắm tỏi", "Khô bò đỏ", "Khô bò giòn", "Chà bông", "Khô bò đen", "Trứng cút"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    active: true
  },
  {
    id: "set-banh-trang-cuon-tron-mix-topping-21cm",
    name: "Set bánh tráng cuốn trộn mix topping 21cm",
    price: 220000,
    image: "/cake-products/set-banh-trang-cuon-tron-mix-topping-21cm.jpg",
    size: "Size hộp 21cm - đường kính bánh 19cm",
    serving: "5 - 6 người",
    description: "Phiên bản lớn của set cuốn trộn mix topping, hợp tiệc sinh nhật nhỏ.",
    ingredients: ["Bánh tráng phơi sương cuốn trộn", "Tóp mỡ rim mắm tỏi", "Khô bò đỏ", "Khô bò giòn", "Chà bông", "Khô bò đen", "Trứng cút"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    active: true
  },
  {
    id: "set-cuon-bo-mix-ps-muoi-tac-21cm",
    name: "Set cuốn bơ mix phơi sương muối tắc 21cm",
    price: 220000,
    image: "/cake-products/set-cuon-bo-mix-ps-muoi-tac-21cm.jpg",
    size: "Size hộp 21cm - đường kính bánh 19cm",
    serving: "5 - 6 người",
    description: "Bánh tráng phơi sương muối tắc mix cuốn bơ, vị chua cay béo dễ ghiền.",
    ingredients: ["Bánh tráng phơi sương muối tắc", "Bánh tráng cuốn bơ", "Khô bò đỏ hoặc tóp mỡ", "Trứng cút", "Sốt sate bơ", "Sốt me bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led"],
    active: true
  },
  {
    id: "set-banh-trang-2-tang",
    name: "Set bánh tráng 2 tầng",
    price: 250000,
    image: "/cake-products/set-banh-trang-2-tang.jpg",
    size: "Size hộp 21cm - đường kính bánh 19cm",
    serving: "5 - 6 người",
    description: "Mẫu 2 tầng nổi bật, có thể thêm hình chibi cá nhân hóa.",
    ingredients: ["Bánh tráng cuốn bơ", "Bánh tráng phơi sương muối tắc", "Tóp mỡ rim mắm tỏi", "Trứng cút", "Kèm sốt sate bơ, me bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    addOns: [{ name: "Hình chibi cá nhân hóa", price: 20000 }],
    active: true
  },
  {
    id: "set-banh-trang-3-tang",
    name: "Set bánh tráng 3 tầng",
    price: 320000,
    image: "/cake-products/set-banh-trang-3-tang.jpg",
    size: "Size hộp 26cm - đường kính bánh 22cm",
    serving: "8 - 10 người",
    description: "Mẫu 3 tầng cho tiệc đông người, trang trí bắt mắt.",
    ingredients: ["Bánh tráng cuốn bơ", "Bánh tráng phơi sương cuốn trộn", "Bánh tráng phơi sương muối tắc", "Tóp mỡ rim mắm tỏi", "Trứng cút", "Kèm sốt sate bơ, me bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    addOns: [{ name: "Hình chibi cá nhân hóa", price: 20000 }],
    active: true
  },
  {
    id: "set-trai-tim-cuon-bo-mix-ps-muoi-tac",
    name: "Set bánh tráng trái tim cuốn bơ mix phơi sương muối tắc",
    price: 220000,
    image: "/cake-products/set-trai-tim-cuon-bo-mix-ps-muoi-tac.jpg",
    size: "Size hộp 21cm - đường kính bánh 19cm",
    serving: "5 - 6 người",
    description: "Mẫu trái tim dễ thương, hợp tặng sinh nhật hoặc kỷ niệm.",
    ingredients: ["Bánh tráng cuốn bơ", "Bánh tráng phơi sương muối tắc", "Tóp mỡ rim mắm tỏi", "Trứng cút", "Kèm sốt sate bơ, me bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    active: true
  },
  {
    id: "set-banh-trang-mix-4-loai",
    name: "Set bánh tráng mix 4 loại",
    price: 240000,
    image: "/cake-products/set-banh-trang-mix-4-loai.jpg",
    size: "Size hộp 21cm - đường kính bánh 19cm",
    serving: "5 - 6 người",
    description: "Một set có 4 vị bánh tráng khác nhau, dễ chọn cho nhóm đông.",
    ingredients: ["Bánh tráng cuốn bơ", "Bánh tráng phơi sương tóp mỡ", "Bánh tráng phơi sương cuốn tóp mỡ", "Bánh tráng phơi sương cuốn trộn", "Kèm sốt sate bơ, me bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    active: true
  },
  {
    id: "set-banh-trang-2-tang-full-cuon",
    name: "Set bánh tráng 2 tầng full cuốn",
    price: 270000,
    image: "/cake-products/set-banh-trang-2-tang-full-cuon.jpg",
    size: "Size hộp 21cm - đường kính bánh 19cm",
    serving: "5 - 6 người",
    description: "Mẫu 2 tầng full cuốn, trang trí nổi bật, có thể thêm hình chibi.",
    ingredients: ["Bánh tráng cuốn bơ", "Bánh tráng phơi sương cuốn trứng", "Tóp mỡ rim mắm tỏi", "Trứng cút", "Kèm 2 sốt sate bơ, 2 me bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    addOns: [{ name: "Hình chibi cá nhân hóa", price: 20000 }],
    active: true
  },
  {
    id: "set-trai-tim-2-tang",
    name: "Set trái tim 2 tầng",
    price: 320000,
    image: "/cake-products/set-trai-tim-2-tang.jpg",
    size: "Size hộp 26cm - đường kính bánh 24cm",
    serving: "7 - 8 người",
    description: "Mẫu trái tim 2 tầng lớn, kèm phụ kiện trang trí tiệc.",
    ingredients: ["Bánh tráng cuốn bơ", "Bánh tráng phơi sương muối tắc", "Tóp mỡ rim mắm tỏi", "Trứng cút", "Kèm sốt sate bơ, me bơ"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday", "Set phụ kiện vương miện, trái tim, bướm, bông cúc"],
    addonMode: CAKE_ADDON_MODES.includedSet,
    useSharedAddons: false,
    active: true
  },
  {
    id: "set-banh-4-tang",
    name: "Set bánh 4 tầng",
    price: 500000,
    image: "/cake-products/set-banh-4-tang.jpg",
    size: "Size hộp 28cm - đường kính bánh 26cm",
    serving: "12 - 15 người",
    description: "Mẫu lớn nhất cho tiệc đông người, nhiều tầng và nhiều loại cuốn.",
    ingredients: ["Bánh tráng cuốn bơ", "Bánh tráng cuốn trứng", "Bánh tráng cuốn trộn", "Bánh tráng phơi sương muối tắc", "Tóp mỡ rim mắm tỏi", "Trứng cút", "Kèm sốt sate bơ, me bơ, muối béo, bơ bò"],
    accessories: ["Dụng cụ ăn uống", "Nến Led", "Sticker tên theo yêu cầu", "Que cắm Happy Birthday"],
    active: true
  }
];

function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCakeAddonMode(product = {}) {
  const mode = String(product.addonMode || "").trim();
  if (Object.values(CAKE_ADDON_MODES).includes(mode)) return mode;
  if (product.useSharedAddons === false) {
    return product.id === "set-trai-tim-2-tang" ? CAKE_ADDON_MODES.includedSet : CAKE_ADDON_MODES.none;
  }
  return CAKE_ADDON_MODES.paid;
}

export function normalizeCakeProduct(product = {}) {
  const id = String(product.id || `cake-${Date.now()}`).trim();
  const addonMode = normalizeCakeAddonMode({ ...product, id });
  return {
    id,
    name: String(product.name || "Mẫu bánh mới").trim(),
    price: Number(product.price || 0),
    image: String(product.image || "").trim(),
    size: String(product.size || "").trim(),
    serving: String(product.serving || "").trim(),
    description: String(product.description || "").trim(),
    ingredients: normalizeStringList(product.ingredients),
    accessories: normalizeStringList(product.accessories),
    addOns: Array.isArray(product.addOns) ? product.addOns.map((item) => ({
      name: String(item?.name || "").trim(),
      price: Number(item?.price || 0)
    })).filter((item) => item.name) : [],
    addonMode,
    useSharedAddons: addonMode !== CAKE_ADDON_MODES.none,
    active: product.active !== false
  };
}

export function normalizeCakeSettings(settings = {}) {
  const shippingConfig = {
    ...DEFAULT_CAKE_SHIPPING_CONFIG,
    ...(settings.shippingConfig || {})
  };
  const cakeFulfillmentSource = {
    ...DEFAULT_CAKE_FULFILLMENT_CONFIG,
    ...(settings.cakeFulfillment || {})
  };
  const sourceAddons = settings.addonCatalog || {};
  const defaultAddons = DEFAULT_CAKE_SETTINGS.addonCatalog;
  const chibi = {
    ...defaultAddons.chibi,
    ...(sourceAddons.chibi || {})
  };
  const decoration = {
    ...defaultAddons.decoration,
    ...(sourceAddons.decoration || {})
  };
  const decorationOptionsSource = Array.isArray(sourceAddons.decoration?.options)
    ? sourceAddons.decoration.options
    : defaultAddons.decoration.options;
  const decorationOptions = decorationOptionsSource
    .map((item, index) => ({
      id: String(item?.id || `pk-${index + 1}`),
      name: String(item?.name || `Mẫu phụ kiện ${index + 1}`).trim(),
      price: Number(item?.price ?? decoration.price ?? 0),
      image: String(item?.image || "").trim()
    }))
    .filter((item) => item.name);
  const referenceImages = Array.isArray(sourceAddons.decoration?.referenceImages)
    ? sourceAddons.decoration.referenceImages
    : defaultAddons.decoration.referenceImages;

  return {
    ...DEFAULT_CAKE_SETTINGS,
    ...settings,
    zaloPhone: String(settings.zaloPhone || DEFAULT_CAKE_SETTINGS.zaloPhone).replace(/\D/g, "") || DEFAULT_CAKE_SETTINGS.zaloPhone,
    pickupAddress: String(settings.pickupAddress || DEFAULT_CAKE_SETTINGS.pickupAddress).trim(),
    orderNotice: String(settings.orderNotice || DEFAULT_CAKE_SETTINGS.orderNotice).trim(),
    featuredProductIds: Array.isArray(settings.featuredProductIds)
      ? settings.featuredProductIds.map((item) => String(item || "").trim()).filter(Boolean)
      : DEFAULT_CAKE_SETTINGS.featuredProductIds,
    shippingConfig: {
      ...shippingConfig,
      baseFeeFirst3Km: Number(shippingConfig.baseFeeFirst3Km || DEFAULT_CAKE_SHIPPING_CONFIG.baseFeeFirst3Km),
      feePerNextKm: Number(shippingConfig.feePerNextKm || DEFAULT_CAKE_SHIPPING_CONFIG.feePerNextKm),
      freeShipThreshold: Number(shippingConfig.freeShipThreshold || 0),
      supportShippingEnabled: Boolean(shippingConfig.supportShippingEnabled),
      maxSupportShipFee: Number(shippingConfig.maxSupportShipFee || 0),
      maxRadiusKm: Number(shippingConfig.maxRadiusKm || DEFAULT_CAKE_SHIPPING_CONFIG.maxRadiusKm),
      customerNote: String(shippingConfig.customerNote || "").trim(),
      sourceBranchId: String(shippingConfig.sourceBranchId || "").trim()
    },
    cakeFulfillment: {
      pickupEnabled: cakeFulfillmentSource.pickupEnabled !== false,
      pickupBranchIds: Array.isArray(cakeFulfillmentSource.pickupBranchIds)
        ? cakeFulfillmentSource.pickupBranchIds.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      deliveryEnabled: cakeFulfillmentSource.deliveryEnabled !== false,
      deliverySourceBranchId: String(cakeFulfillmentSource.deliverySourceBranchId || shippingConfig.sourceBranchId || "").trim(),
      minPickupLeadMinutes: Math.max(0, Number(cakeFulfillmentSource.minPickupLeadMinutes || DEFAULT_CAKE_FULFILLMENT_CONFIG.minPickupLeadMinutes))
    },
    addonCatalog: {
      chibi: {
        enabled: Boolean(chibi.enabled ?? true),
        name: String(chibi.name || defaultAddons.chibi.name).trim(),
        price: Number(chibi.price ?? defaultAddons.chibi.price ?? 0),
        image: String(chibi.image || "").trim(),
        description: String(chibi.description || "").trim()
      },
      decoration: {
        enabled: Boolean(decoration.enabled ?? true),
        name: String(decoration.name || defaultAddons.decoration.name).trim(),
        price: Number(decoration.price ?? defaultAddons.decoration.price ?? 0),
        description: String(decoration.description || "").trim(),
        referenceImages: (Array.isArray(referenceImages) ? referenceImages : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean),
        options: decorationOptions
      }
    }
  };
}

export function loadCakeProducts() {
  const saved = adminConfigRepository.get(CAKE_PRODUCTS_CONFIG_KEY, DEFAULT_CAKE_PRODUCTS);
  return (Array.isArray(saved) && saved.length ? saved : DEFAULT_CAKE_PRODUCTS).map(normalizeCakeProduct);
}

async function loadCakeConfigFromSupabase(key) {
  if (!isSupabaseEnabled()) return undefined;
  const client = getSupabaseClient();
  if (!client) return undefined;

  const { data, error } = await client
    .from("app_configs")
    .select("value")
    .eq("id", key)
    .maybeSingle();

  if (error) {
    throw new Error(`Không đọc được cấu hình bánh từ Supabase (${key}): ${error.message}`);
  }

  if (!data) {
    throw new Error(`Thiếu cấu hình bánh trên Supabase: ${key}.`);
  }

  return data.value;
}

export async function loadCakeProductsAsync() {
  const supabaseValue = await loadCakeConfigFromSupabase(CAKE_PRODUCTS_CONFIG_KEY);
  if (supabaseValue !== undefined) {
    if (!Array.isArray(supabaseValue)) {
      throw new Error("Danh sách bánh trên Supabase không đúng định dạng.");
    }
    if (!supabaseValue.length) {
      throw new Error("Danh sách bánh trên Supabase đang rỗng.");
    }
    return supabaseValue.map(normalizeCakeProduct);
  }

  const saved = await adminConfigRepository.getAsync(CAKE_PRODUCTS_CONFIG_KEY, DEFAULT_CAKE_PRODUCTS);
  return (Array.isArray(saved) && saved.length ? saved : DEFAULT_CAKE_PRODUCTS).map(normalizeCakeProduct);
}

export async function saveCakeProductsAsync(products) {
  const next = (Array.isArray(products) ? products : []).map(normalizeCakeProduct);
  await adminConfigRepository.setAsync(CAKE_PRODUCTS_CONFIG_KEY, next);
  return next;
}

export function loadCakeSettings() {
  const saved = adminConfigRepository.get(CAKE_SETTINGS_CONFIG_KEY, DEFAULT_CAKE_SETTINGS);
  return normalizeCakeSettings(saved);
}

export async function loadCakeSettingsAsync() {
  const supabaseValue = await loadCakeConfigFromSupabase(CAKE_SETTINGS_CONFIG_KEY);
  if (supabaseValue !== undefined) {
    if (!supabaseValue || typeof supabaseValue !== "object" || Array.isArray(supabaseValue)) {
      throw new Error("Cấu hình bánh trên Supabase không đúng định dạng.");
    }
    return normalizeCakeSettings(supabaseValue);
  }

  const saved = await adminConfigRepository.getAsync(CAKE_SETTINGS_CONFIG_KEY, DEFAULT_CAKE_SETTINGS);
  return normalizeCakeSettings(saved);
}

export async function saveCakeSettingsAsync(settings) {
  const next = normalizeCakeSettings(settings);
  await adminConfigRepository.setAsync(CAKE_SETTINGS_CONFIG_KEY, next);
  return next;
}

export async function createCakeOrder(order) {
  const client = getSupabaseClient();
  const orderCode = `BK${Date.now().toString().slice(-8)}`;
  const payload = {
    order_code: orderCode,
    cake_id: order.cakeId,
    cake_name: order.cakeName,
    cake_price: Number(order.cakePrice || 0),
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    pickup_time: order.pickupTime || null,
    cake_message: order.cakeMessage || "",
    fulfillment_type: order.fulfillmentType || "pickup",
    delivery_address: order.deliveryAddress || "",
    delivery_lat: order.deliveryLat ?? null,
    delivery_lng: order.deliveryLng ?? null,
    distance_km: order.distanceKm ?? null,
    shipping_fee: order.shippingFee ?? null,
    note: order.note || "",
    status: "new",
    metadata: order.metadata || {}
  };

  if (!client) {
    return { ok: false, orderCode, error: "missing_supabase_client" };
  }

  const { data, error } = await client
    .from("cake_orders")
    .insert(payload);

  if (error) {
    console.warn("[cakeService] create cake order failed", error);
    return { ok: false, orderCode, error: error.message };
  }

  return { ok: true, orderCode, id: data?.id || "" };
}

function mapCakeOrderRow(row = {}) {
  return {
    id: row.id || "",
    orderCode: row.order_code || "",
    cakeId: row.cake_id || "",
    cakeName: row.cake_name || "",
    cakePrice: Number(row.cake_price || 0),
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    pickupTime: row.pickup_time || "",
    cakeMessage: row.cake_message || "",
    fulfillmentType: row.fulfillment_type || "pickup",
    deliveryAddress: row.delivery_address || "",
    deliveryLat: row.delivery_lat ?? null,
    deliveryLng: row.delivery_lng ?? null,
    distanceKm: row.distance_km ?? null,
    shippingFee: row.shipping_fee ?? null,
    note: row.note || "",
    status: row.status || "new",
    metadata: row.metadata || {},
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

export async function listCakeOrders({ limit = 80 } = {}) {
  const client = getSupabaseAdminAuthClient() || getSupabaseClient();
  if (!client) return { ok: false, orders: [], error: "missing_supabase_client" };

  const { data, error } = await client
    .from("cake_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[cakeService] list cake orders failed", error);
    return { ok: false, orders: [], error: error.message };
  }

  return { ok: true, orders: (data || []).map(mapCakeOrderRow), error: "" };
}

export async function updateCakeOrderStatus(orderId, status) {
  const client = getSupabaseAdminAuthClient() || getSupabaseClient();
  if (!client) return { ok: false, error: "missing_supabase_client" };

  const { data, error } = await client
    .from("cake_orders")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) {
    console.warn("[cakeService] update cake order failed", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, order: mapCakeOrderRow(data), error: "" };
}

function formatCakePickupDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function buildCakeZaloMessage({ product, form, addressInfo, shippingFee, orderCode, selectedAddOns = {}, addOnTotal = 0, finalTotal = 0 }) {
  const fulfillmentLabel = form.fulfillmentType === "delivery" ? "Giao hàng" : "Khách ghé lấy";
  const cakeTotal = Number(finalTotal || Number(product?.price || 0));
  const hasConfirmedShippingFee = form.fulfillmentType === "delivery" && shippingFee !== null && shippingFee !== undefined;
  const confirmedShippingFee = hasConfirmedShippingFee ? Number(shippingFee || 0) : 0;
  const addOnLines = [];
  if (selectedAddOns?.chibi?.selected) {
    addOnLines.push(`- ${selectedAddOns.chibi.name} (+${Number(selectedAddOns.chibi.price || 0).toLocaleString("vi-VN")}đ)`);
  }
  if (selectedAddOns?.decoration?.selected) {
    const optionLabel = selectedAddOns?.decoration?.optionName ? ` (${selectedAddOns.decoration.optionName})` : "";
    const decorationPrice = Number(selectedAddOns.decoration.price || 0);
    const decorationPriceText = decorationPrice > 0 ? `+${decorationPrice.toLocaleString("vi-VN")}đ` : "Đã bao gồm";
    addOnLines.push(`- ${selectedAddOns.decoration.name}${optionLabel} (${decorationPriceText})`);
  }
  const priceLines = [
    "💰 Chi phí tạm tính",
    `- Bánh + phụ kiện: ${cakeTotal.toLocaleString("vi-VN")}đ`,
    form.fulfillmentType === "delivery"
      ? `- Phí giao bánh: ${hasConfirmedShippingFee ? `${confirmedShippingFee.toLocaleString("vi-VN")}đ` : "Shop xác nhận sau"}`
      : "",
    hasConfirmedShippingFee ? `- Tổng tạm tính: ${(cakeTotal + confirmedShippingFee).toLocaleString("vi-VN")}đ` : ""
  ];
  const receivingLines = [
    "🚚 Hình thức nhận",
    `- ${fulfillmentLabel}`,
    form.fulfillmentType === "pickup" ? `- Chi nhánh: ${[form.pickupBranchName, form.pickupBranchAddress].filter(Boolean).join(" - ")}` : "",
    form.fulfillmentType === "delivery" ? `- Địa chỉ giao: ${addressInfo?.addressText || form.deliveryAddress || ""}` : "",
    form.fulfillmentType === "delivery" && addressInfo?.distanceKm ? `- Khoảng cách: ${Number(addressInfo.distanceKm).toFixed(1)}km` : ""
  ];
  const noteLines = [
    "📝 Ghi chú cho shop",
    selectedAddOns?.chibi?.selected ? "- Vui lòng liên hệ khách để xin ảnh làm chibi trước khi in." : "",
    form.addOnNote ? `- Ghi chú phụ kiện: ${form.addOnNote}` : "",
    form.note ? `- Ghi chú thêm: ${form.note}` : ""
  ];
  const lines = [
    "🎂 ĐƠN BÁNH SINH NHẬT BÁNH TRÁNG",
    "",
    `🧾 Mã đơn: ${orderCode || "Chưa có"}`,
    `🍰 Mẫu bánh: ${product?.name || ""}`,
    product?.serving ? `👥 Khẩu phần: ${product.serving}` : "",
    "",
    ...priceLines,
    "",
    addOnLines.length ? "🎁 Phụ kiện theo yêu cầu" : "",
    ...addOnLines,
    "",
    "👤 Thông tin khách",
    `- Tên khách: ${form.customerName || ""}`,
    `- SĐT: ${form.customerPhone || ""}`,
    "",
    "⏰ Thời gian nhận bánh",
    `- ${formatCakePickupDateTime(form.pickupTime)}`,
    form.cakeMessage ? `- Chữ trên bánh: ${form.cakeMessage}` : "",
    "",
    ...receivingLines,
    "",
    ...noteLines
  ];
  return lines.filter((line) => String(line || "").trim()).join("\n");
}
