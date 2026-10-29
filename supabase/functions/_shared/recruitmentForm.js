import { RECRUITMENT_OPTIONS, validateRecruitment } from "./recruitmentSchema.js";

const labels = {
  fullName: "Họ và tên", birthDate: "Ngày tháng năm sinh", phone: "Số điện thoại", address: "Nơi ở của bạn",
  gender: "Giới tính của bạn", branch: "Cửa hàng bạn muốn ứng tuyển", education: "Trình độ học vấn",
  school: "Nếu đang đi học thì bạn đang học trường nào?", shifts: "Khung giờ bạn có thể làm việc",
  workTypes: "Thời gian bạn muốn làm việc tại cửa hàng", impression: "Cảm nhận của bạn về Gánh Hàng Rong",
  previousJob: "Mô tả công việc và mức lương gần nhất của bạn", selfDescription: "Bạn hãy tự nhận xét về bản thân mình"
};
export const DEFAULT_RECRUITMENT_CONFIG = {
  accepting: true,
  introduction: "Chúng mình sẽ chủ động liên hệ lại khi bạn phù hợp với các tiêu chí của bên cửa hàng.",
  successMessage: "Cảm ơn bạn đã dành thời gian chia sẻ. Chúng mình sẽ chủ động liên hệ lại khi bạn phù hợp với các tiêu chí của bên cửa hàng.",
  questions: Object.entries(labels).map(([id, label]) => ({
    id, label, required: true, active: true,
    type: id === "birthDate" ? "date" : id === "phone" ? "tel" : ["impression", "previousJob", "selfDescription"].includes(id)
      ? "textarea" : ["shifts", "workTypes"].includes(id) ? "checkbox" : RECRUITMENT_OPTIONS[id] ? "radio" : "text",
    ...(RECRUITMENT_OPTIONS[id] ? { options: [...RECRUITMENT_OPTIONS[id]] } : {})
  }))
};
const core = new Map(DEFAULT_RECRUITMENT_CONFIG.questions.map((q) => [q.id, q]));
export function validateFormConfig(input) {
  if (!input || typeof input.accepting !== "boolean" || !Array.isArray(input.questions)
    || input.questions.length < 13 || input.questions.length > 30) throw new Error("Cấu hình câu hỏi không hợp lệ.");
  const text = (value, max) => {
    if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Nội dung cấu hình không hợp lệ hoặc quá dài.");
    return value.trim();
  };
  const ids = new Set();
  const questions = input.questions.map((q) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(q.id) || ids.has(q.id) || ["educationOther", "website", "_form", "__proto__", "constructor", "prototype"].includes(q.id)) {
      throw new Error("Mã câu hỏi không hợp lệ hoặc bị trùng.");
    }
    ids.add(q.id);
    const original = core.get(q.id);
    if (!original && !q.id.startsWith("extra_")) throw new Error("Câu hỏi mới cần mã riêng.");
    if (!["text", "textarea", "radio", "checkbox", "date", "tel"].includes(q.type) || (original && q.type !== original.type)) throw new Error("Loại câu hỏi không hợp lệ.");
    const result = { id: q.id, label: text(q.label, 200), type: q.type, required: q.required === true, active: q.active === true };
    if (["fullName", "phone", "branch"].includes(q.id) && (!result.active || !result.required)) throw new Error("Họ tên, điện thoại và chi nhánh luôn bắt buộc.");
    if (["radio", "checkbox"].includes(q.type)) {
      if (!Array.isArray(q.options) || !q.options.length || q.options.length > 20) throw new Error("Cần từ 1 đến 20 lựa chọn.");
      result.options = q.options.map((value) => text(value, 200));
      if (new Set(result.options).size !== result.options.length) throw new Error("Lựa chọn không được trùng nhau.");
      if (q.id === "branch") {
        if (result.options.some((option) => !RECRUITMENT_OPTIONS.branch.includes(option))) {
          throw new Error("Giữ mã chi nhánh cố định để phân loại hồ sơ.");
        }
        // Visibility may change; stable branch labels and canonical ordering do not.
        result.options = RECRUITMENT_OPTIONS.branch.filter((option) => result.options.includes(option));
      }
    }
    return result;
  });
  if ([...core.keys()].some((key) => !ids.has(key))) throw new Error("Ẩn câu hỏi gốc thay vì xóa để giữ lịch sử.");
  return { accepting: input.accepting, introduction: text(input.introduction, 1000), successMessage: text(input.successMessage, 1000), questions };
}

export function validateConfiguredApplication(input, config, today) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const base = validateRecruitment(source, today);
  const data = {};
  const errors = {};
  for (const q of config.questions.filter((item) => item.active)) {
    const value = source[q.id];
    const empty = value == null || value === "" || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length);
    if (!q.required && empty) { data[q.id] = q.type === "checkbox" ? [] : ""; continue; }
    if (q.type === "checkbox") {
      const values = Array.isArray(value) ? value : [];
      data[q.id] = q.options.filter((option) => values.includes(option));
      if (!data[q.id].length || values.some((option) => !q.options.includes(option))) errors[q.id] = "Bạn chọn ít nhất một mục hợp lệ nha.";
    } else if (q.type === "radio") {
      data[q.id] = typeof value === "string" ? value : "";
      if (!q.options.includes(data[q.id])) errors[q.id] = "Bạn chọn một mục trong danh sách nha.";
    } else {
      data[q.id] = typeof value === "string" ? value.trim().normalize("NFC") : "";
      const max = q.type === "textarea" ? 2000 : q.id === "address" ? 300 : 200;
      if (!data[q.id] || data[q.id].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(data[q.id])) errors[q.id] = `Bạn điền nội dung hợp lệ, tối đa ${max} ký tự nha.`;
      if (q.type === "tel") {
        data[q.id] = data[q.id].replace(/[\s().-]/g, "").replace(/^\+84/, "0").replace(/^84(?=\d{9}$)/, "0");
        if (!/^0[35789]\d{8}$/.test(data[q.id])) errors[q.id] = "Bạn kiểm tra lại số điện thoại nha.";
      }
      if (q.type === "date") {
        const date = new Date(`${data[q.id]}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data[q.id]) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== data[q.id]
          || (q.id === "birthDate" && (data[q.id] > today || data[q.id] < "1900-01-01"))) errors[q.id] = "Bạn chọn ngày hợp lệ nha.";
      }
      if (q.id === "fullName" && base.errors.fullName) errors.fullName = base.errors.fullName;
    }
  }
  if (data.education === "Mục khác") {
    data.educationOther = typeof source.educationOther === "string" ? source.educationOther.trim() : "";
    if (!data.educationOther || data.educationOther.length > 150) errors.educationOther = "Bạn ghi rõ trình độ học vấn nha.";
  } else data.educationOther = "";
  return { data, errors, valid: !Object.keys(errors).length };
}
