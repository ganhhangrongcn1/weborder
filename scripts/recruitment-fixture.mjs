import { RECRUITMENT_OPTIONS } from "../supabase/functions/_shared/recruitmentSchema.js";

// Synthetic fixture only. Never submit this to production/n8n/Zalo.
export const application = {
  fullName: "Ứng viên kiểm thử CÔ LẬP", birthDate: "2000-02-29", phone: "0900000000",
  address: "Địa chỉ kiểm thử", gender: "LGBT", branch: RECRUITMENT_OPTIONS.branch[3],
  education: "Mục khác", educationOther: "Dữ liệu kiểm thử", school: "Không đang đi học",
  shifts: [RECRUITMENT_OPTIONS.shifts[2]], workTypes: [RECRUITMENT_OPTIONS.workTypes[1]],
  impression: "Dữ liệu giả, không gửi Zalo", previousJob: "Chưa từng đi làm", selfDescription: "Kiểm thử"
};
