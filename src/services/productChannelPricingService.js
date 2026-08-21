function toPrice(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) && fallbackNumber >= 0 ? fallbackNumber : 0;
}

function getMetadata(value = {}) {
  return value?.metadata && typeof value.metadata === "object" && !Array.isArray(value.metadata)
    ? value.metadata
    : {};
}

export function resolveWebsiteProductPrice(product = {}) {
  const metadata = getMetadata(product);
  return toPrice(metadata.webPrice ?? metadata.web_price ?? product.webPrice ?? product.web_price ?? product.price, 0);
}

export function resolveStoreProductPrice(product = {}) {
  const metadata = getMetadata(product);
  return toPrice(product.pos_price ?? metadata.posPrice ?? metadata.pos_price ?? product.posPrice ?? product.price, 0);
}

export function buildProductChannelPriceMetadata(product = {}) {
  return {
    ...(getMetadata(product)),
    ...product,
    webPrice: toPrice(product.price ?? product.webPrice ?? product.web_price, 0),
    posPrice: toPrice(product.posPrice ?? product.pos_price ?? product.price, 0)
  };
}

export default {
  resolveWebsiteProductPrice,
  resolveStoreProductPrice,
  buildProductChannelPriceMetadata
};
