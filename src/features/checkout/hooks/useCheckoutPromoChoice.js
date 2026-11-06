import { useCallback, useEffect, useState } from "react";
import { findLowestValueEligibleCheckoutPromo } from "../checkoutPricing.js";

export default function useCheckoutPromoChoice(promoCodes, voucherIntent) {
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [manuallySelected, setManuallySelected] = useState(false);
  const selectPromo = useCallback((promo) => {
    setManuallySelected(true);
    setSelectedPromo(promo);
  }, []);

  useEffect(() => {
    if (!selectedPromo) return;
    const refreshed = promoCodes.find((promo) => promo.id === selectedPromo.id);
    if (!refreshed || (!refreshed.freeShip && Number(refreshed.discount || 0) <= 0)) {
      setSelectedPromo(null);
    } else if (Number(refreshed.discount || 0) !== Number(selectedPromo.discount || 0) ||
      refreshed.code !== selectedPromo.code || refreshed.condition !== selectedPromo.condition) {
      setSelectedPromo(refreshed);
    }
  }, [promoCodes, selectedPromo]);

  useEffect(() => {
    if (voucherIntent || selectedPromo || manuallySelected) return;
    const automaticPromo = findLowestValueEligibleCheckoutPromo(promoCodes);
    if (automaticPromo) setSelectedPromo(automaticPromo);
  }, [promoCodes, selectedPromo, voucherIntent, manuallySelected]);

  return { selectedPromo, setSelectedPromo, selectPromo };
}
