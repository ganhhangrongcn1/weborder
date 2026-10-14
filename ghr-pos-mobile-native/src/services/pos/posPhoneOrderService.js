import { supabase } from "../supabase/client";

export async function readPhoneCustomerBillStatus(order, branchUuid) {
  const { data, error } = await supabase.from("print_jobs").select("status,error_message")
    .eq("id", order.metadata?.phoneCustomerBillJobId).eq("branch_uuid", branchUuid).maybeSingle();
  return { ok: !error && !!data && data.status !== "failed",
    message: data?.status === "printed" ? " Trạm in đã báo xử lý bill."
      : data && data.status !== "failed" ? " Bill đang chờ trạm in tại quán."
      : " Chưa xác nhận được lệnh in bill. Kiểm tra trạm in tại quán." };
}
