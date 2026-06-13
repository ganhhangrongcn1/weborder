import { useMemo, useState } from "react";
import { createQrPngDataUrl, createQrSvg, downloadFile } from "../services/qrCodeService.js";

const DEFAULT_QR_TEXT = "https://ganhhangrong.vn/banhkembanhtrang";

const makeFileSafeName = (value) => {
  const text = String(value || "qrcode")
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return text || "qrcode";
};

export default function useQrCodeTool() {
  const [qrText, setQrText] = useState(DEFAULT_QR_TEXT);
  const [darkColor, setDarkColor] = useState("#111111");
  const [lightColor, setLightColor] = useState("#ffffff");

  const normalizedText = qrText.trim();
  const svgMarkup = useMemo(
    () =>
      createQrSvg(normalizedText || DEFAULT_QR_TEXT, {
        darkColor,
        lightColor,
      }),
    [darkColor, lightColor, normalizedText]
  );

  const previewDataUrl = useMemo(
    () =>
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`,
    [svgMarkup]
  );

  const downloadSvg = () => {
    const filename = `${makeFileSafeName(normalizedText)}.svg`;
    downloadFile(svgMarkup, filename, "image/svg+xml;charset=utf-8");
  };

  const downloadPng = () => {
    const dataUrl = createQrPngDataUrl(normalizedText || DEFAULT_QR_TEXT, {
      moduleSize: 20,
      darkColor,
      lightColor,
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${makeFileSafeName(normalizedText)}.png`;
    link.click();
  };

  const resetForm = () => {
    setQrText(DEFAULT_QR_TEXT);
    setDarkColor("#111111");
    setLightColor("#ffffff");
  };

  return {
    qrText,
    setQrText,
    darkColor,
    setDarkColor,
    lightColor,
    setLightColor,
    previewDataUrl,
    downloadSvg,
    downloadPng,
    resetForm,
  };
}
