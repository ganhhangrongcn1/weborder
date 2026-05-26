import { useEffect, useState } from "react";
import {
  loadCakeProducts,
  loadCakeProductsAsync,
  loadCakeSettings,
  loadCakeSettingsAsync
} from "../services/cakeService.js";

export default function useCakeProducts() {
  const [products, setProducts] = useState(() => loadCakeProducts());
  const [settings, setSettings] = useState(() => loadCakeSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([loadCakeProductsAsync(), loadCakeSettingsAsync()])
      .then(([nextProducts, nextSettings]) => {
        if (!alive) return;
        setProducts(nextProducts);
        setSettings(nextSettings);
      })
      .catch((error) => {
        console.warn("[useCakeProducts] load failed", error);
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
    loading
  };
}
