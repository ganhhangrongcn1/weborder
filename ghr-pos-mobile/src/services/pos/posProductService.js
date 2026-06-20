import { supabase } from "../supabase/client";

export async function fetchPosProducts() {
  if (!supabase) {
    return { ok: false, products: [], message: "Thiếu cấu hình Supabase." };
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,category_id,badge,visible,active,sort_order")
    .eq("active", true)
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .limit(80);

  if (error) {
    return { ok: false, products: [], message: error.message || "Không tải được menu POS." };
  }

  return {
    ok: true,
    products: (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price || 0),
      category: item.badge || item.category_id || ""
    })),
    message: ""
  };
}
