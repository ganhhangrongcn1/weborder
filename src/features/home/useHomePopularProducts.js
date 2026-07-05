import { useEffect, useState } from "react";
import { getCustomerPopularProductIds } from "../../services/popularProductService.js";

export default function useHomePopularProducts({
  enabled = true,
  days = 30,
  limit = 12
} = {}) {
  const [popularProductIds, setPopularProductIds] = useState([]);

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setPopularProductIds([]);
      return () => {
        active = false;
      };
    }

    getCustomerPopularProductIds({ days, limit }).then((productIds) => {
      if (active) setPopularProductIds(productIds);
    });

    return () => {
      active = false;
    };
  }, [days, enabled, limit]);

  return popularProductIds;
}
