import { supabase } from "../supabase/client";
import { normalizeReceiptTemplate, RECEIPT_TEMPLATE_KEY } from "./receiptTemplate";

let cache = normalizeReceiptTemplate();
let checkedAt = 0;
let pending;

export async function loadPosReceiptTemplate() {
  if (Date.now() - checkedAt < 60000) return cache;
  if (pending) return pending;
  pending = (async () => {
    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const { data, error } = await supabase.from("app_configs").select("value")
        .eq("id", RECEIPT_TEMPLATE_KEY).maybeSingle().abortSignal(controller.signal);
      if (!error) cache = normalizeReceiptTemplate(data?.value);
    } catch { /* Preserve printing and last successful config when offline. */ }
    finally { clearTimeout(timeout); checkedAt = Date.now(); }
    return cache;
  })().finally(() => { pending = null; });
  return pending;
}
