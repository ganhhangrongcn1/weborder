export const RECRUITMENT_OPTIONS = {
  gender: ["Nam", "Nữ", "LGBT"],
  branch: [
    "277 Thích Quảng Đức, Phường Thủ Dầu Một, TP.HCM (Bình Dương Cũ)",
    "306A Lê Hồng Phong, Phường Phú Lợi, TP.HCM (Bình Dương Cũ)",
    "113/108 Đường 30/4, Phường Phú Lợi, TP.HCM (Bình Dương Cũ)",
    "64/1 NA5, KDC VietSing, Phường Thuận Giao, TP.HCM (Bình Dương Cũ)"
  ],
  education: ["12/12", "Sinh viên năm 1", "Sinh viên năm 2", "Sinh viên năm 3", "Sinh viên năm 4", "Mục khác"],
  shifts: ["9h - 16h", "16h - 22h30", "Cả 2 ca"],
  workTypes: ["Full ca sáng hoặc chiều", "Part-time", "Đóng gói bánh tráng (linh động theo lịch của quán)"]
};

export const EMPTY_RECRUITMENT_FORM = {
  fullName: "", birthDate: "", phone: "", address: "", gender: "", branch: "",
  education: "", educationOther: "", school: "", shifts: [], workTypes: [],
  impression: "", previousJob: "", selfDescription: "", website: ""
};

export function validateRecruitment(input, today = new Date().toISOString().slice(0, 10)) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const data = {};
  const errors = {};
  const textFields = {
    fullName: 100, birthDate: 10, phone: 30, address: 300, gender: 20, branch: 200,
    education: 40, educationOther: 150, school: 200,
    impression: 2000, previousJob: 2000, selfDescription: 2000
  };
  for (const [key, max] of Object.entries(textFields)) {
    const value = typeof source[key] === "string" ? source[key].trim().normalize("NFC") : "";
    data[key] = value;
    if (!value && key !== "educationOther") errors[key] = "Bạn điền giúp Gánh mục này nha.";
    if (value.length > max) errors[key] = `Bạn viết trong ${max} ký tự giúp Gánh nha.`;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) errors[key] = "Nội dung có ký tự không hợp lệ.";
  }
  data.phone = data.phone.replace(/[\s().-]/g, "").replace(/^\+84/, "0").replace(/^84(?=\d{9}$)/, "0");
  if (!/^0[35789]\d{8}$/.test(data.phone)) errors.phone = "Bạn kiểm tra lại số điện thoại di động Việt Nam nha.";
  const date = new Date(`${data.birthDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate) || Number.isNaN(date.getTime())
      || date.toISOString().slice(0, 10) !== data.birthDate || data.birthDate > today || data.birthDate < "1900-01-01") {
    errors.birthDate = "Bạn chọn ngày sinh hợp lệ nha.";
  }
  for (const key of ["gender", "branch", "education"]) {
    if (!RECRUITMENT_OPTIONS[key].includes(data[key])) errors[key] = "Bạn chọn một lựa chọn trong danh sách nha.";
  }
  if (data.education === "Mục khác" && !data.educationOther) errors.educationOther = "Bạn ghi rõ trình độ học vấn nha.";
  if (data.education !== "Mục khác") data.educationOther = "";
  for (const key of ["shifts", "workTypes"]) {
    const values = Array.isArray(source[key]) ? source[key] : [];
    data[key] = RECRUITMENT_OPTIONS[key].filter((value) => values.includes(value));
    if (!data[key].length || values.some((value) => !RECRUITMENT_OPTIONS[key].includes(value))) {
      errors[key] = "Bạn chọn ít nhất một lựa chọn nha.";
    }
  }
  return { data, errors, valid: Object.keys(errors).length === 0 };
}
