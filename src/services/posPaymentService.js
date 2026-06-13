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
      paymentSettings.bank_id ||
      banking.bankBin ||
      banking.bankCode ||
      metadata.bankBin ||
      metadata.bankCode ||
      branch.bankBin ||
      branch.bankCode
    ),
    bankName: toText(
      paymentSettings.bankName ||
      banking.bankName ||
      metadata.bankName ||
      branch.bankName
    ),
    accountNumber: toText(
      paymentSettings.accountNumber ||
      paymentSettings.bankAccountNumber ||
      banking.accountNumber ||
      metadata.accountNumber ||
      metadata.bankAccountNumber ||
      branch.accountNumber ||
      branch.bankAccountNumber
    ),
    accountName: toText(
      paymentSettings.accountName ||
      paymentSettings.bankAccountName ||
      banking.accountName ||
      metadata.accountName ||
      metadata.bankAccountName ||
      branch.accountName ||
      branch.bankAccountName
    ),
    sepayBankAccountId: toText(
      paymentSettings.sepayBankAccountId ||
      paymentSettings.sepay_account_id ||
      sepay.bankAccountId ||
      sepay.accountId ||
      metadata.sepayBankAccountId ||
      metadata.sepay_account_id
    ),
    sepayMerchantCode: toText(
      paymentSettings.sepayMerchantCode ||
      paymentSettings.sepay_store_code ||
      sepay.merchantCode ||
      sepay.storeCode ||
      metadata.sepayMerchantCode ||
      metadata.sepay_store_code
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

export function buildPosQrImageUrl({ branch = {}, amount = 0, orderIdentity = {} } = {}) {
  const config = getPosQrPaymentConfig(branch);
  if (!config.ready) return "";

  const safeAmount = Math.max(0, Math.floor(toNumber(amount)));
  const addInfo = buildPosPaymentReference(orderIdentity, branch);
  const query = new URLSearchParams({
    amount: String(safeAmount),
    addInfo,
    accountName: config.accountName
  });

  return `https://img.vietqr.io/image/${config.bankBin}-${config.accountNumber}-compact2.png?${query.toString()}`;
}
