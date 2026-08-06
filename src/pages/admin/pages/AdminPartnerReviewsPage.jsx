import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import {
  listPartnerReviews,
  listPartnerReviewSources,
  replyToPartnerReview,
  requestPartnerStoreControl,
  requestPartnerReviewWorkerStart,
  savePartnerReviewSource,
  savePartnerReviewWorkerSettings
} from "../../../services/partnerReviewSourceService.js";
import PartnerReviewInbox from "../partner-reviews/PartnerReviewInbox.jsx";
import PartnerReviewOperations from "../partner-reviews/PartnerReviewOperations.jsx";
import PartnerReviewSourceForm from "../partner-reviews/PartnerReviewSourceForm.jsx";
import { textValue } from "../partner-reviews/partnerReviewUi.js";

const EMPTY_SOURCE = {
  id: "",
  platform: "grabfood",
  accountKey: "",
  displayName: "",
  merchantId: "",
  branchUuid: "",
  branchCode: "",
  username: "",
  password: "",
  syncEnabled: true,
  busyEnabled: false,
  loginIdentifierHint: "",
  credentialsConfigured: false
};

const branchUuid = (branch) => textValue(branch?.branch_uuid || branch?.branchUuid || branch?.uuid);
const branchCode = (branch) => textValue(branch?.branch_code || branch?.branchCode);

export default function AdminPartnerReviewsPage({ branches = [] }) {
  const [sources, setSources] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState(EMPTY_SOURCE);
  const [formOpen, setFormOpen] = useState(false);
  const [filters, setFilters] = useState({ sourceId: "", branchUuid: "", rating: "" });
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ sync_interval_minutes: 60 });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [workerStarting, setWorkerStarting] = useState(false);
  const [message, setMessage] = useState("");
  const [storeControlSaving, setStoreControlSaving] = useState("");
  const [replySavingId, setReplySavingId] = useState("");

  const branchOptions = useMemo(
    () => branches.map((branch) => ({
      value: branchUuid(branch),
      code: branchCode(branch),
      label: textValue(branch?.name) || branchCode(branch) || "Chi nhánh"
    })).filter((item) => item.value),
    [branches]
  );

  const loadSources = async () => {
    setLoading(true);
    try {
      const result = await listPartnerReviewSources();
      if (result.ok) {
        setSources(result.sources);
        if (result.settings) setSettings(result.settings);
      } else {
        setMessage(result.message);
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async (nextFilters = filters) => {
    setReviewsLoading(true);
    try {
      const result = await listPartnerReviews({ ...nextFilters, limit: 200 });
      if (result.ok) setReviews(result.reviews);
      else setMessage(result.message);
      return result;
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setMessage("");
      await Promise.all([loadSources(), loadReviews()]);
    };
    loadInitialData();
  }, []);

  const refreshAll = async () => {
    setMessage("");
    await Promise.all([loadSources(), loadReviews()]);
  };

  const updateFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    loadReviews(next);
  };

  const createNew = () => {
    const firstBranch = branchOptions[0];
    setForm({
      ...EMPTY_SOURCE,
      branchUuid: firstBranch?.value || "",
      branchCode: firstBranch?.code || ""
    });
    setFormOpen(true);
    setMessage("");
  };

  const editSource = (source) => {
    setForm({
      id: source.id,
      platform: source.platform,
      accountKey: source.account_key,
      displayName: source.display_name,
      merchantId: source.merchant_id || "",
      branchUuid: source.branch_uuid,
      branchCode: source.branch_code || "",
      username: "",
      password: "",
      syncEnabled: source.sync_enabled !== false,
      busyEnabled: source.busy_enabled === true,
      loginIdentifierHint: source.login_identifier_hint || "",
      credentialsConfigured: source.credentials_configured === true
    });
    setFormOpen(true);
  };

  const selectBranch = (value) => {
    const branch = branchOptions.find((item) => item.value === value);
    setForm((current) => ({ ...current, branchUuid: value, branchCode: branch?.code || "" }));
  };

  const submitSource = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const result = await savePartnerReviewSource(form);
      setMessage(result.message || (result.ok ? "Đã lưu gian hàng." : "Không lưu được gian hàng."));
      if (result.ok) {
        setForm(EMPTY_SOURCE);
        setFormOpen(false);
        await loadSources();
      }
    } finally {
      setSaving(false);
    }
  };

  const saveSchedule = async () => {
    setSettingsSaving(true);
    setMessage("");
    try {
      const result = await savePartnerReviewWorkerSettings(settings.sync_interval_minutes);
      setMessage(result.message || (result.ok ? "Đã cập nhật thời gian đồng bộ." : "Không lưu được thời gian đồng bộ."));
      if (result.ok && result.settings) setSettings(result.settings);
    } finally {
      setSettingsSaving(false);
    }
  };

  const requestWorkerRunNow = async () => {
    setWorkerStarting(true);
    setMessage("");
    try {
      const result = await requestPartnerReviewWorkerStart();
      setMessage(result.message || (result.ok ? "Đã ghi nhận yêu cầu đồng bộ ngay." : "Không gửi được yêu cầu đồng bộ ngay."));
      if (result.ok && result.settings) setSettings(result.settings);
    } finally {
      setWorkerStarting(false);
    }
  };

  const setStoreControl = async (source, action) => {
    const requestKey = `${source.id}:${action}`;
    setStoreControlSaving(requestKey);
    setMessage("");
    try {
      const result = await requestPartnerStoreControl(source.id, action);
      setMessage(result.message || (result.ok ? "Đã gửi lệnh tới worker." : "Không gửi được lệnh tới worker."));
      if (result.ok && result.source) {
        setSources((current) => current.map((item) => item.id === source.id ? result.source : item));
        window.setTimeout(() => loadSources(), 12000);
      }
    } finally {
      setStoreControlSaving("");
    }
  };

  const submitReviewReply = async (review, replyText) => {
    setReplySavingId(review.id);
    setMessage("");
    try {
      const result = await replyToPartnerReview(review.id, replyText);
      setMessage(result.message || (result.ok ? "Đã xếp hàng gửi phản hồi lên Grab." : "Không gửi được phản hồi lên Grab."));
      if (result.ok) {
        await loadReviews();
        window.setTimeout(() => loadReviews(), 15000);
      }
      return result;
    } finally {
      setReplySavingId("");
    }
  };

  return (
    <div className="admin-review-page">
      {message ? (
        <div className="admin-review-page-message" role="status">
          <Icon name="warning" size={17} />
          <span>{message}</span>
          <button type="button" onClick={refreshAll}>Thử lại</button>
        </div>
      ) : null}

      <PartnerReviewInbox
        reviews={reviews}
        loading={reviewsLoading}
        sources={sources}
        branchOptions={branchOptions}
        filters={filters}
        onFilterChange={updateFilter}
        onRefresh={() => loadReviews()}
        onReply={submitReviewReply}
        replySavingId={replySavingId}
      />

      <PartnerReviewOperations
        sources={sources}
        loading={loading}
        settings={settings}
        settingsSaving={settingsSaving}
        workerStarting={workerStarting}
        storeControlSaving={storeControlSaving}
        onSettingsChange={(syncIntervalMinutes) => setSettings((current) => ({ ...current, sync_interval_minutes: syncIntervalMinutes }))}
        onSaveSchedule={saveSchedule}
        onRunNow={requestWorkerRunNow}
        onCreateSource={createNew}
        onEditSource={editSource}
        onStoreControl={setStoreControl}
      />

      <PartnerReviewSourceForm
        form={formOpen ? form : null}
        branchOptions={branchOptions}
        saving={saving}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onSelectBranch={selectBranch}
        onClose={() => setFormOpen(false)}
        onSubmit={submitSource}
      />
    </div>
  );
}
