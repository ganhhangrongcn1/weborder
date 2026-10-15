import { postRecruitmentApplication, recruitmentRequest } from "./repositories/recruitmentRepository.js";
import { shouldWriteDomainToSupabase } from "./repositories/writeThroughPolicy.js";
import { validateConfiguredApplication } from "../../supabase/functions/_shared/recruitmentForm.js";

export const loadRecruitmentForm = () => recruitmentRequest({ action: "get_form" });

export async function submitRecruitmentApplication(form, requestId, settings) {
  if (!shouldWriteDomainToSupabase("recruitment")) {
    throw new Error("Hệ thống nhận hồ sơ đang tạm chưa sẵn sàng. Bạn thử lại sau nha.");
  }
  const { data, errors, valid } = validateConfiguredApplication(form, settings.config, new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }));
  if (!valid) {
    const error = new Error("Bạn kiểm tra các mục được đánh dấu giúp Gánh nha.");
    error.fields = errors;
    throw error;
  }
  return postRecruitmentApplication({ ...data, website: form.website || "" }, requestId, settings.revision);
}
