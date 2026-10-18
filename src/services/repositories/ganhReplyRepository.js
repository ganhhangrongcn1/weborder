import { getSupabaseAdminAuthClient, initSupabaseAdminAuthClient } from '../supabase/supabaseRuntimeClient.js';

export async function invokeGanhReply(payload) {
  const client = getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient();
  if (!client) throw new Error('Supabase Admin chưa sẵn sàng.');
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('Vui lòng đăng nhập tài khoản quản trị.');
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const { data, error } = await client.functions.invoke('ganh-reply-api', {
      body: payload, headers: { Authorization: `Bearer ${sessionData.session.access_token}` }, signal: controller.signal
    });
    if (error) {
      let message = 'Không kết nối được Gánh Reply.';
      try { message = (await error.context?.json())?.message || message; } catch { /* No raw server details. */ }
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.message || 'Thao tác chưa hoàn tất.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Yêu cầu đang chậm. Kiểm tra lịch sử trước khi thử lại.');
    throw error;
  } finally { clearTimeout(timer); }
}
