const ADMIN_ORDER_SOURCE_TONES = {
  pickup: {
    background: "#f3e8ff",
    soft: "#faf5ff",
    border: "#d8b4fe",
    color: "#7e22ce",
    strong: "#581c87"
  },
  qr: {
    background: "#f5f3ff",
    soft: "#faf5ff",
    border: "#c4b5fd",
    color: "#6d28d9",
    strong: "#4c1d95"
  },
  website: {
    background: "#eff6ff",
    soft: "#f8fbff",
    border: "#bfdbfe",
    color: "#1d4ed8",
    strong: "#1e3a8a"
  },
  delivery: {
    background: "#dcfce7",
    soft: "#f0fdf4",
    border: "#86efac",
    color: "#15803d",
    strong: "#14532d"
  },
  grab: {
    background: "#dcfce7",
    soft: "#ecfdf5",
    border: "#86efac",
    color: "#15803d",
    strong: "#14532d"
  },
  shopee: {
    background: "#fef2f2",
    soft: "#fff7ed",
    border: "#fecaca",
    color: "#dc2626",
    strong: "#991b1b"
  },
  xanhngon: {
    background: "#ecfdf5",
    soft: "#f0fdfa",
    border: "#99f6e4",
    color: "#047857",
    strong: "#064e3b"
  },
  neutral: {
    background: "#f1f5f9",
    soft: "#f8fafc",
    border: "#cbd5e1",
    color: "#475569",
    strong: "#334155"
  }
};

function normalizePlatform(platform = "") {
  return String(platform || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getKitchenPlatformTone(platform = "") {
  const value = normalizePlatform(platform);

  if (value.includes("grab")) return ADMIN_ORDER_SOURCE_TONES.grab;
  if (value.includes("shopee")) return ADMIN_ORDER_SOURCE_TONES.shopee;
  if (value.includes("xanh")) return ADMIN_ORDER_SOURCE_TONES.xanhngon;
  if (value.includes("qr")) return ADMIN_ORDER_SOURCE_TONES.qr;
  if (value.includes("pickup") || value.includes("tu lay") || value.includes("den lay")) {
    return ADMIN_ORDER_SOURCE_TONES.pickup;
  }
  if (value.includes("ship") || value.includes("delivery") || value.includes("giao")) {
    return ADMIN_ORDER_SOURCE_TONES.delivery;
  }
  if (value.includes("website") || value.includes("web")) return ADMIN_ORDER_SOURCE_TONES.website;

  return ADMIN_ORDER_SOURCE_TONES.neutral;
}

export function getKitchenOrderTheme(order = {}) {
  const status = String(order.kitchenStatus || "").toLowerCase();

  if (status === "cancelled") {
    return {
      background: "linear-gradient(135deg, #fee2e2 0%, #fff1f2 100%)",
      border: "#ef4444",
      button: "#ef4444",
      code: "#991b1b",
      text: "#7f1d1d"
    };
  }

  if (["done", "ready"].includes(status)) {
    return {
      background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
      border: "#94a3b8",
      button: "#64748b",
      code: "#475569",
      text: "#334155"
    };
  }

  const tone = getKitchenPlatformTone(order.platform || order.source || "");

  return {
    background: `linear-gradient(135deg, ${tone.background} 0%, ${tone.soft} 100%)`,
    border: tone.color,
    button: tone.color,
    code: tone.color,
    text: tone.strong
  };
}
