const text = (value) => String(value ?? "").trim();

export function normalizePaymentPhone(value) {
  const digits = text(value).replace(/\D/g, "");
  return /^84\d{9}$/.test(digits) ? `0${digits.slice(2)}` : digits;
}

export async function resolveBankTransferRoute(settings = {}, phone = "", requestedProvider = "sepay") {
  if (requestedProvider === "momo") return { provider: "momo", providerPayload: {} };
  const mode = text(settings.pay2sMode).toLowerCase();
  const testHashes = Array.isArray(settings.pay2sTestPhoneHashes) ? settings.pay2sTestPhoneHashes : [];
  const normalizedPhone = normalizePaymentPhone(phone);
  const phoneHash = mode === "test" && /^0\d{9}$/.test(normalizedPhone)
    ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizedPhone)))).map((byte) => byte.toString(16).padStart(2, "0")).join("") : "";
  const usePay2s = mode === "live" || (mode === "test" && phoneHash && testHashes.includes(phoneHash));
  if (!usePay2s) return { provider: "sepay", providerPayload: {} };
  const separateAccount = [settings.pay2sBankBin, settings.pay2sAccountNumber, settings.pay2sAccountName].some((value) => text(value));
  const accountNumber = text(separateAccount ? settings.pay2sAccountNumber : settings.accountNumber || settings.bankAccountNumber);
  const bankBin = text(separateAccount ? settings.pay2sBankBin : settings.bankBin || settings.bankCode);
  const accountName = text(separateAccount ? settings.pay2sAccountName : settings.accountName || settings.bankAccountName);
  if (!accountNumber || !bankBin || !accountName) {
    throw new Error("Chi nhánh chưa đủ thông tin tài khoản để thử Pay2S.");
  }
  return {
    provider: "pay2s",
    providerPayload: { bankTransfer: { provider: "pay2s", accountNumber, accountName, bankBin,
      bankName: separateAccount ? text(settings.pay2sBankName) || (bankBin === "970422" ? "MB Bank" : bankBin) : text(settings.bankName), mode } }
  };
}

export async function loadBankTransferRoute(client, branchUuid, phone, requestedProvider) {
  if (requestedProvider === "momo") return { provider: "momo", providerPayload: {} };
  const { data, error } = await client.from("branches").select("data,metadata").eq("branch_uuid", branchUuid).maybeSingle();
  if (error) throw new Error("Chưa đọc được cấu hình thanh toán của chi nhánh. Vui lòng thử lại.");
  const settings = data?.data?.paymentSettings || data?.metadata?.paymentSettings || {};
  const route = await resolveBankTransferRoute(settings, phone, requestedProvider);
  if (route.provider === "pay2s" && !Deno.env.get("PAY2S_WEBHOOK_TOKEN")) {
    throw new Error("Pay2S chưa được cấu hình nhận thanh toán. Vui lòng giữ chế độ SePay.");
  }
  return route;
}
