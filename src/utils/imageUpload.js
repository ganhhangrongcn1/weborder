function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Không thể đọc dữ liệu ảnh."));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromObjectUrl(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không thể tải ảnh để xử lý."));
    image.src = objectUrl;
  });
}

export async function processUploadImage(file, options = {}) {
  const {
    maxWidth = 1200,
    quality = 0.75,
    outputType = "image/webp"
  } = options;
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("File tải lên không phải ảnh hợp lệ.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const scale = image.width > maxWidth ? maxWidth / image.width : 1;
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không thể xử lý ảnh trên trình duyệt này.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const outputBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Không thể nén ảnh trên thiết bị này."));
            return;
          }
          resolve(blob);
        },
        outputType,
        quality
      );
    });

    const finalType = outputBlob.type || outputType;
    const extension = finalType === "image/jpeg" ? "jpg" : "webp";
    const safeFileName = `image_${Date.now()}.${extension}`;
    const outputFile = new File([outputBlob], safeFileName, { type: finalType });
    const dataUrl = await readBlobAsDataUrl(outputBlob);

    return {
      file: outputFile,
      dataUrl,
      contentType: finalType,
      width: targetWidth,
      height: targetHeight,
      size: outputFile.size
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
