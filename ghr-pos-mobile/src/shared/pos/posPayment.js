function toText(value = "") {
  return String(value || "").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getPaymentSettings(branch = {}) {
  const metadata = getObject(branch.metadata);
  const paymentSettings = getObject(branch.paymentSettings || metadata.paymentSettings);
  const banking = getObject(paymentSettings.banking || metadata.banking);
  const sepay = getObject(paymentSettings.sepay || metadata.sepay);

  return {
    provider: toText(
      paymentSettings.provider ||
      metadata.paymentProvider ||
      metadata.provider ||
      "vietqr"
    ).toLowerCase() || "vietqr",
    bankBin: toText(
      paymentSettings.bankBin ||
      paymentSettings.bankCode ||
      banking.bankBin ||
      banking.bankCode ||
      metadata.bankBin ||
      metadata.bankCode ||
      branch.bankBin ||
      branch.bankCode
    ),
    accountNumber: toText(
      paymentSettings.accountNumber ||
      banking.accountNumber ||
      metadata.accountNumber ||
      branch.accountNumber
    ),
    accountName: toText(
      paymentSettings.accountName ||
      banking.accountName ||
      metadata.accountName ||
      branch.accountName
    )
  };
}

export function getPosQrPaymentConfig(branch = {}) {
  const config = getPaymentSettings(branch);
  return {
    ...config,
    ready: Boolean(config.bankBin && config.accountNumber && config.accountName)
  };
}

export function normalizeCashReceived(value = "") {
  return Math.max(0, Math.floor(toNumber(String(value).replace(/[^\d]/g, ""))));
}

export function calculateCashChange(total = 0, cashReceived = 0) {
  return Math.max(0, normalizeCashReceived(cashReceived) - Math.max(0, Math.floor(toNumber(total))));
}

export function buildPosPaymentReference(orderIdentity = {}, branch = {}) {
  const config = getPosQrPaymentConfig(branch);
  if (config.provider === "sepay") {
    return toText(orderIdentity.orderCode || orderIdentity.displayOrderCode || "");
  }
  return toText(orderIdentity.displayOrderCode || orderIdentity.orderCode || "");
}
