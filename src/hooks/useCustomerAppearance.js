import { useEffect, useLayoutEffect, useState } from "react";
import { getCustomerAppearance, setCustomerAppearance, subscribeCustomerAppearance } from "../services/customerAppearanceService.js";

export default function useCustomerAppearance(applyToDocument = false) {
  const [theme, setTheme] = useState(getCustomerAppearance);
  useEffect(() => subscribeCustomerAppearance(setTheme), []);
  useLayoutEffect(() => {
    if (!applyToDocument || !window.matchMedia("(display-mode: standalone)").matches) return undefined;
    const viewport = document.querySelector('meta[name="viewport"]');
    const previous = viewport?.getAttribute("content");
    if (!viewport || !previous || /viewport-fit\s*=/.test(previous)) return undefined;
    viewport.setAttribute("content", `${previous}, viewport-fit=cover`);
    return () => viewport.setAttribute("content", previous);
  }, [applyToDocument]);
  useLayoutEffect(() => {
    if (!applyToDocument) return undefined;
    document.documentElement.setAttribute("data-customer-theme", theme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const previousColor = themeMeta?.getAttribute("content");
    themeMeta?.setAttribute("content", theme === "dark" ? "#000000" : "#ffffff");
    return () => {
      document.documentElement.removeAttribute("data-customer-theme");
      if (previousColor != null) themeMeta?.setAttribute("content", previousColor);
    };
  }, [applyToDocument, theme]);
  return { theme, setTheme: setCustomerAppearance };
}
