function hash32(value = "", seed = 0) {
  let hash = (2166136261 ^ seed) >>> 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function toHex(value = 0) {
  return Number(value >>> 0).toString(16).padStart(8, "0");
}

export function isOrderItemUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

export function createDeterministicOrderItemUuid(value = "") {
  const text = String(value || "");
  const hex = [
    hash32(text, 0x9e3779b9),
    hash32(text, 0x85ebca6b),
    hash32(text, 0xc2b2ae35),
    hash32(text, 0x27d4eb2f)
  ].map(toHex).join("").split("");

  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function buildOrderItemStableId(orderId = "", item = {}, index = 0) {
  const sourceItemId = String(item?.sourceItemId || item?.source_item_id || item?.rowId || "").trim();
  if (isOrderItemUuid(sourceItemId)) return sourceItemId;

  const itemIdentity = String(
    item?.cartId ||
    item?.cart_id ||
    item?.id ||
    item?.productId ||
    item?.product_id ||
    item?.name ||
    item?.productName ||
    "item"
  ).trim();

  return createDeterministicOrderItemUuid(`${String(orderId || "").trim()}|${itemIdentity}|${Number(index) || 0}`);
}
