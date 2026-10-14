import { postRecruitmentApplication } from "./repositories/recruitmentRepository.js";
import { shouldWriteDomainToSupabase } from "./repositories/writeThroughPolicy.js";
import { validateRecruitment } from "../../supabase/functions/_shared/recruitmentSchema.js";

export async function submitRecruitmentApplication(form, requestId) {
  if (!shouldWriteDomainToSupabase("recruitment")) {
    throw new Error("Hệ thống nhận hồ sơ đang tạm chưa sẵn sàng. Bạn thử lại sau nha.");
  }
  const { data, errors, valid } = validateRecruitment(form);
  if (!valid) {
    const error = new Error("Bạn kiểm tra các mục được đánh dấu giúp Gánh nha.");
    error.fields = errors;
    throw error;
  }
  return postRecruitmentApplication({ ...data, website: form.website || "" }, requestId);
}
