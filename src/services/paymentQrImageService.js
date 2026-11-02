// Keep VietQR's complete image (bank, recipient and amount). Some .png URLs
// redirect to SVG; rasterize the loaded image so long-press saves a real PNG.
export function getPaymentQrRasterSource(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin === "https://img.vietqr.io" && /^\/image\/[^/]+\.png$/.test(parsed.pathname)) {
      // The PNG redirect itself lacks CORS headers. Request the CORS-enabled
      // SVG directly, keeping the exact bank/account/query unchanged.
      parsed.pathname = parsed.pathname.replace(/\.png$/, ".svg");
      return parsed.href;
    }
  } catch { /* Keep unrelated or malformed URLs unchanged. */ }
  return url;
}

export function paymentQrImageToPng(image) {
  const width = image?.naturalWidth;
  const height = image?.naturalHeight;
  if (!width || !height || width > 4096 || height > 4096) {
    throw new Error("Ảnh QR chưa tải xong.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Chưa chuyển được ảnh QR sang PNG.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
