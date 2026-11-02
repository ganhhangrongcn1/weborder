// Keep VietQR's complete image (bank, recipient and amount). Some .png URLs
// redirect to SVG; rasterize the loaded image so long-press saves a real PNG.
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
