import usePwaInstallPrompt from "../../hooks/usePwaInstallPrompt.js";

export default function PwaInstallBanner() {
  const { canShowInstallPrompt, dismissInstallPrompt, requestInstall } = usePwaInstallPrompt();

  if (!canShowInstallPrompt) return null;

  return (
    <section className="customer-install-banner" aria-label="Cài đặt ứng dụng Gánh Hàng Rong">
      <div className="customer-install-copy">
        <strong>Cài đặt ứng dụng</strong>
        <span>Cài đặt ứng dụng để truy cập nhanh hơn</span>
      </div>
      <div className="customer-install-actions">
        <button type="button" className="customer-install-later" onClick={dismissInstallPrompt}>
          Để sau
        </button>
        <button type="button" className="customer-install-primary" onClick={requestInstall}>
          Cài đặt
        </button>
      </div>
    </section>
  );
}
