export const PAGES = ["membership", "checkin", "history", "corrections", "training", "account", "branch"];
export function parseDestination(hash) {
  const params = new URLSearchParams(String(hash || "").replace(/^#\/?/, ""));
  const page = params.get("page");
  return { page: PAGES.includes(page) ? page : "checkin", branch: (params.get("branch") || "").slice(0, 80) };
}
export function destinationHash(page, branch = "") {
  if (!PAGES.includes(page)) throw new Error("Trang không hợp lệ.");
  return "#" + new URLSearchParams({ page, ...(branch ? { branch } : {}) });
}
export function phoneHref(phone) {
  const value = String(phone || "").replace(/[ .()-]/g, "");
  return /^\+?\d{9,15}$/.test(value) ? "tel:" + value : null;
}
export function zaloHref(value) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "zalo.me" && url.pathname !== "/" ? url.href : null; } catch { return null; }
}

export function externalHref(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
