import { supabase } from "../supabase/client";

const mockProducts = [
  {
    id: "bt-demo",
    name: "Bánh tráng demo",
    price: 39000,
    category: "Bánh Tráng",
    image: "",
    optionGroups: []
  }
];

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeOptionGroups(groups = []) {
  return (Array.isArray(groups) ? groups : [])
    .map((group, groupIndex) => ({
      id: toText(group.id || `group-${groupIndex + 1}`),
      name: toText(group.name || group.title || `Tùy chọn ${groupIndex + 1}`),
      required: Boolean(group.required),
      maxSelect: Math.max(1, Math.floor(toNumber(group.maxSelect || group.max_select || 1))),
      options: (Array.isArray(group.options) ? group.options : [])
        .filter((option) => option?.active !== false)
        .map((option, optionIndex) => ({
          id: toText(option.id || `option-${optionIndex + 1}`),
          name: toText(option.name || option.label || `Tùy chọn ${optionIndex + 1}`),
          price: toNumber(option.price || option.extraPrice || option.extra_price, 0)
        }))
        .filter((option) => option.name)
    }))
    .filter((group) => group.name && group.options.length);
}

function normalizeCategoryMap(rows = []) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const id = toText(row?.id);
    const name = toText(row?.name || row?.id);
    if (id && name) map.set(id, name);
  });
  return map;
}

function normalizeProduct(row = {}, index = 0, categoryMap = new Map(), optionGroupMap = new Map()) {
  const metadata = getObject(row.metadata);
  const id = toText(row.id || row.product_id || metadata.id || `product-${index + 1}`);
  const name = toText(row.name || row.product_name || metadata.name || "Món chưa đặt tên");
  const categoryId = toText(row.category_id || metadata.categoryId || metadata.category_id || metadata.category || row.badge);
  const linkedGroups = optionGroupMap.get(id) || [];
  const metadataGroups = Array.isArray(metadata.optionGroups)
    ? metadata.optionGroups
    : Array.isArray(metadata.option_groups)
      ? metadata.option_groups
      : [];

  return {
    ...metadata,
    id,
    name,
    price: toNumber(row.price ?? row.unit_price ?? metadata.price, 0),
    category: categoryMap.get(categoryId) || categoryId || toText(row.badge) || "Khác",
    image: toText(row.image || row.image_url || metadata.image || metadata.imageUrl || metadata.image_url),
    short: toText(row.description || metadata.short || metadata.description),
    badge: toText(row.badge || metadata.badge),
    optionGroups: normalizeOptionGroups(linkedGroups.length ? linkedGroups : metadataGroups),
    active: row.active !== false && metadata.active !== false,
    visible: row.visible !== false && metadata.visible !== false,
    sortOrder: toNumber(row.sort_order ?? metadata.sortOrder, index)
  };
}

async function readCategories() {
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,sort_order,active")
    .order("sort_order", { ascending: true });
  if (error) return new Map();
  return normalizeCategoryMap((data || []).filter((row) => row?.active !== false));
}

async function readOptionGroups() {
  if (!supabase) return new Map();

  try {
    const [{ data: groups, error: groupsError }, { data: options, error: optionsError }, { data: links, error: linksError }] = await Promise.all([
      supabase
        .from("option_groups")
        .select("id,name,required,max_select,active,sort_order,metadata")
        .order("sort_order", { ascending: true }),
      supabase
        .from("option_group_options")
        .select("id,group_id,name,price,active,sort_order,metadata")
        .order("sort_order", { ascending: true }),
      supabase
        .from("product_option_groups")
        .select("product_id,group_id,sort_order,metadata")
        .order("sort_order", { ascending: true })
    ]);

    if (groupsError || optionsError || linksError) return new Map();

    const optionsByGroup = new Map();
    (options || []).forEach((option) => {
      if (option?.active === false) return;
      const groupId = toText(option.group_id);
      const current = optionsByGroup.get(groupId) || [];
      current.push({
        id: toText(option.id),
        name: toText(option.name),
        price: toNumber(option.price, 0),
        active: option.active !== false,
        sortOrder: toNumber(option.sort_order, current.length)
      });
      optionsByGroup.set(groupId, current);
    });

    const groupById = new Map();
    (groups || []).forEach((group) => {
      if (group?.active === false) return;
      const groupId = toText(group.id);
      groupById.set(groupId, {
        id: groupId,
        name: toText(group.name),
        required: Boolean(group.required),
        maxSelect: Math.max(1, Math.floor(toNumber(group.max_select, 1))),
        options: optionsByGroup.get(groupId) || []
      });
    });

    const productGroups = new Map();
    (links || []).forEach((link) => {
      const productId = toText(link.product_id);
      const group = groupById.get(toText(link.group_id));
      if (!productId || !group) return;
      const current = productGroups.get(productId) || [];
      current.push(group);
      productGroups.set(productId, current);
    });

    return productGroups;
  } catch {
    return new Map();
  }
}

async function readProducts({ categoryMap, optionGroupMap }) {
  const selectCandidates = [
    "id,name,description,image,price,original_price,badge,category_id,visible,active,sort_order,metadata",
    "id,name,description,image,price,badge,category_id,visible,active,sort_order,metadata",
    "id,name,image,price,badge,category_id,visible,active,sort_order",
    "id,name,price,category_id,visible,active,sort_order"
  ];

  let lastError = null;
  for (const columns of selectCandidates) {
    const { data, error } = await supabase
      .from("products")
      .select(columns)
      .eq("active", true)
      .eq("visible", true)
      .order("sort_order", { ascending: true })
      .limit(180);

    if (error) {
      lastError = error;
      continue;
    }

    return {
      products: (Array.isArray(data) ? data : [])
        .map((row, index) => normalizeProduct(row, index, categoryMap, optionGroupMap))
        .filter((item) => item.id && item.name && item.active && item.visible),
      error: null
    };
  }

  return {
    products: [],
    error: lastError
  };
}

export async function fetchPosProducts() {
  if (!supabase) {
    return {
      ok: true,
      products: mockProducts,
      message: "Đang dùng menu demo vì chưa có cấu hình Supabase."
    };
  }

  const [categoryMap, optionGroupMap] = await Promise.all([
    readCategories(),
    readOptionGroups()
  ]);
  const { products, error } = await readProducts({ categoryMap, optionGroupMap });

  if (products.length) {
    return {
      ok: true,
      products,
      message: ""
    };
  }

  return {
    ok: true,
    products: mockProducts,
    message: error?.message || "Chưa tải được menu Supabase, đang dùng menu demo."
  };
}
