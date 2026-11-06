const KEY = "ghr_customer_appearance_v1";
export const CUSTOMER_APPEARANCE_EVENT = "ghr:customer-appearance";
export function getCustomerAppearance() {
  try { return localStorage.getItem(KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}
export function setCustomerAppearance(value) {
  const theme = value === "dark" ? "dark" : "light";
  try { localStorage.setItem(KEY, theme); } catch { /* The current session can still change appearance. */ }
  window.dispatchEvent(new CustomEvent(CUSTOMER_APPEARANCE_EVENT, { detail: theme }));
}
export function subscribeCustomerAppearance(callback) {
  const update = () => callback(getCustomerAppearance());
  const local = (event) => callback(event.detail);
  const storage = (event) => { if (event.key === KEY || event.key === null) update(); };
  window.addEventListener(CUSTOMER_APPEARANCE_EVENT, local);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(CUSTOMER_APPEARANCE_EVENT, local); window.removeEventListener("storage", storage); };
}
export default { getCustomerAppearance, setCustomerAppearance, subscribeCustomerAppearance };
