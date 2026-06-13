import useQrCodeTool from "../hooks/useQrCodeTool.js";
import "../styles/qr-code-tool.css";

const presetLinks = [
  {
    label: "Bánh kem bánh tráng",
    value: "https://ganhhangrong.vn/banhkembanhtrang",
  },
  {
    label: "Trang chủ",
    value: "https://ganhhangrong.vn/home",
  },
  {
    label: "Menu",
    value: "https://ganhhangrong.vn/menu",
  },
];

export default function QrCodeToolPage() {
  const {
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
  } = useQrCodeTool();

  return (
    <main className="qr-tool-page">
      <section className="qr-tool-shell" aria-label="Công cụ tạo QR code">
        <div className="qr-tool-main">
          <div className="qr-tool-heading">
            <p className="qr-tool-kicker">Gánh Hàng Rong</p>
            <h1>Tạo QR code</h1>
          </div>

          <div className="qr-tool-field">
            <label htmlFor="qrText">Link hoặc nội dung</label>
            <textarea
              id="qrText"
              value={qrText}
              onChange={(event) => setQrText(event.target.value)}
              rows={4}
              placeholder="Nhập link cần tạo QR"
            />
          </div>

          <div className="qr-tool-presets" aria-label="Link có sẵn">
            {presetLinks.map((item) => (
              <button key={item.value} type="button" onClick={() => setQrText(item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="qr-tool-colors">
            <label>
              <span>Màu QR</span>
              <input type="color" value={darkColor} onChange={(event) => setDarkColor(event.target.value)} />
            </label>
            <label>
              <span>Nền</span>
              <input type="color" value={lightColor} onChange={(event) => setLightColor(event.target.value)} />
            </label>
          </div>

          <div className="qr-tool-actions">
            <button type="button" className="qr-tool-primary" onClick={downloadPng}>
              Tải PNG
            </button>
            <button type="button" onClick={downloadSvg}>
              Tải SVG
            </button>
            <button type="button" onClick={resetForm}>
              Mặc định
            </button>
          </div>
        </div>

        <aside className="qr-tool-preview" aria-label="Xem trước QR code">
          <div className="qr-tool-preview-frame">
            <img src={previewDataUrl} alt="QR code xem trước" />
          </div>
          <p>Quét thử bằng camera điện thoại trước khi in.</p>
        </aside>
      </section>
    </main>
  );
}
