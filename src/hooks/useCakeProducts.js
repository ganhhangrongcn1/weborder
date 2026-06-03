import { useEffect, useState } from "react";
import {
  DEFAULT_CAKE_SETTINGS,
  loadCakeProducts,
  loadCakeProductsAsync,
  loadCakeSettings,
  loadCakeSettingsAsync,
  normalizeCakeSettings
} from "../services/cakeService.js";
import { isSupabaseEnabled } from "../services/repositories/dataSource.js";

export default function useCakeProducts() {
  const useSupabaseFirst = isSupabaseEnabled();
  const [products, setProducts] = useState(() => (useSupabaseFirst ? [] : loadCakeProducts()));
  const [settings, setSettings] = useState(() => (useSupabaseFirst ? normalizeCakeSettings(DEFAULT_CAKE_SETTINGS) : loadCakeSettings()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    Promise.all([loadCakeProductsAsync(), loadCakeSettingsAsync()])
      .then(([nextProducts, nextSettings]) => {
        if (!alive) return;
        setProducts(nextProducts);
        setSettings(nextSettings);
      })
      .catch((error) => {
        console.warn("[useCakeProducts] load failed", error);
        if (!alive) return;
        setError(error?.message || "Không tải được dữ liệu bánh từ Supabase.");
        if (!useSupabaseFirst) {
          setProducts(loadCakeProducts());
          setSettings(loadCakeSettings());
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return {
    products: products.filter((product) => product.active !== false),
    allProducts: products,
    settings,
    loading,
    error,
    source: useSupabaseFirst ? "supabase" : "local"
  };
}
