import { invokeGanhReply } from './repositories/ganhReplyRepository.js';
import { shouldWriteDomainToSupabase } from './repositories/writeThroughPolicy.js';
import { isReadOnlyAdminPreviewEnabled } from './supabase/runtimeFlags.js';

export const GANH_PLATFORMS = [['tiktok','TikTok'],['facebook','Facebook'],['grabfood','GrabFood'],['shopeefood','ShopeeFood'],['google_maps','Google Maps']];
export const BRAIN_LABELS = { identity: 'Brand Identity', voice: 'Brand Voice', knowledge: 'Kiến thức kinh doanh', principles: 'Nguyên tắc', rule: 'Quy tắc bổ sung' };
export const GANH_ENABLED = import.meta.env.VITE_ENABLE_GANH_REPLY === 'true';
const READ_ACTIONS = new Set(['bootstrap','history','detail','stats','list_brain','copy']);
export async function ganhReplyRequest(action, payload = {}) {
  if (!GANH_ENABLED) throw new Error('Gánh Reply chưa được bật trên môi trường này.');
  if (isReadOnlyAdminPreviewEnabled()) throw new Error('Preview chỉ đọc không kết nối dữ liệu Gánh Reply.');
  if (!READ_ACTIONS.has(action) && !shouldWriteDomainToSupabase('ganhReply')) throw new Error('Môi trường đang khóa ghi Supabase.');
  return invokeGanhReply({ ...payload, action });
}
export function readReplyImage(file) {
  if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1000000) {
    return Promise.reject(new Error('Chọn ảnh PNG/JPEG/WebP tối đa 1 MB.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
}
