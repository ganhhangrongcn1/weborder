import useGrabAutomationSettings from "../../../hooks/useGrabAutomationSettings.js";
import { AdminButton, AdminCard, AdminInput } from "../ui/index.js";

export default function GrabAutomationSettings() {
  const {
    config,
    dirty,
    loading,
    saving,
    message,
    updateConfig,
    save
  } = useGrabAutomationSettings();

  const disabled = loading || saving;

  return (
    <AdminCard className="admin-panel admin-store-panel admin-grab-automation">
      <div className="admin-panel-head">
        <div>
          <h2>Tự động thời gian Grab</h2>
          <p className="admin-branch-toolbar__hint">
            Tự xác nhận tổng thời gian chuẩn bị khi đơn Grab mới vào hệ thống.
          </p>
        </div>
        <AdminButton
          variant={dirty ? "primary" : "secondary"}
          className={!dirty || disabled ? "opacity-70 cursor-not-allowed" : ""}
          disabled={!dirty || disabled}
          onClick={save}
        >
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </AdminButton>
      </div>

      {message ? <p className="admin-store-message">{message}</p> : null}

      <div className="admin-grab-automation__controls">
        <div className="admin-grab-automation__toggle">
          <span>
            <strong>Tự động xác nhận thời gian</strong>
            <small>Nút hoàn thành món trong Kitchen vẫn hoạt động riêng.</small>
          </span>
          <label className="admin-switch" aria-label="Bật tự động thời gian Grab">
            <input
              type="checkbox"
              checked={Boolean(config.grabAutoPrepEnabled)}
              disabled={disabled}
              onChange={(event) => updateConfig({ grabAutoPrepEnabled: event.target.checked })}
            />
            <span />
          </label>
        </div>

        <label className="admin-grab-automation__minutes">
          <span>Thời gian chuẩn bị</span>
          <div>
            <AdminInput
              className="admin-input"
              type="number"
              min="1"
              max="30"
              step="1"
              value={config.grabPrepMinutes}
              disabled={disabled || !config.grabAutoPrepEnabled}
              onChange={(event) => updateConfig({ grabPrepMinutes: event.target.value })}
            />
            <strong>phút</strong>
          </div>
          <small>Chỉ nâng đơn thấp hơn mức này, không giảm thời gian đang cao hơn.</small>
        </label>
      </div>
    </AdminCard>
  );
}
