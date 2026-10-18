import { useEffect } from "react";

export default function usePosPointInputLimit({ usablePoints, pointSpendStep, setPointsInput }) {
  // React only to a changed allowance, not each keystroke while typing an amount.
  useEffect(() => {
    const step = Math.max(1, Number(pointSpendStep) || 1000);
    setPointsInput((current) => {
      const requested = Math.max(0, Number(String(current || "").replace(/\D/g, "")) || 0);
      const adjusted = Math.floor(Math.min(requested, Math.max(0, usablePoints)) / step) * step;
      return adjusted === requested ? current : adjusted > 0 ? String(adjusted) : "";
    });
  }, [usablePoints, pointSpendStep, setPointsInput]);
}
