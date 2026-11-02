import { buildBankQrPayload } from "../../shared/pos/bankQrPayload.js";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getPaymentSettings(branch = {}) {
  const metadata = getObject(branch.data || branch.metadata);
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
    )
  };
}

export function getPosQrPaymentConfig(branch = {}, session = null) {
  const baseConfig = getPaymentSettings(branch);
  const snapshot = getObject(session?.providerPayload?.bankTransfer || session?.provider_payload?.bankTransfer);
  const config = session?.provider === "pay2s"
    ? { ...baseConfig, provider: "pay2s", bankBin: toText(snapshot.bankBin), accountNumber: toText(snapshot.accountNumber), accountName: toText(snapshot.accountName) }
    : baseConfig;
  return {
    ...config,
    ready: Boolean(config.bankBin && config.accountNumber && config.accountName)
  };
}

export function buildPosPaymentReference(orderIdentity = {}, branch = {}) {
  const config = getPosQrPaymentConfig(branch);
  const explicitReference = toText(
    orderIdentity.paymentReference ||
    orderIdentity.payment_reference
  );

  if (explicitReference) {
    return explicitReference;
  }

  if (config.provider === "sepay") {
    return toText(orderIdentity.orderCode || orderIdentity.displayOrderCode || "");
  }
  return toText(orderIdentity.displayOrderCode || orderIdentity.orderCode || "");
}

export function isPosQrSessionReadyForDisplay(session = null) {
  return Boolean(
    toText(session?.id)
      && toText(session?.paymentReference || session?.payment_reference)
      && toText(session?.status).toLowerCase() === "pending_payment"
  );
}

export function buildPosQrImageUrl({ branch = {}, amount = 0, orderIdentity = {}, session = null } = {}) {
  const config = getPosQrPaymentConfig(branch, session);
  if (!config.ready) return "";

  const safeAmount = Math.max(0, Math.floor(toNumber(amount)));
  const addInfo = buildPosPaymentReference(orderIdentity, branch);
  const query = new globalThis.URLSearchParams({
    amount: String(safeAmount),
    addInfo,
    accountName: config.accountName
  });

  return `https://img.vietqr.io/image/${config.bankBin}-${config.accountNumber}-compact2.png?${query.toString()}`;
}

export function buildPosQrPayload({ branch = {}, amount = 0, orderIdentity = {}, session = null } = {}) {
  if (!session?.id) return "";
  const config = getPosQrPaymentConfig(branch, session);
  return buildBankQrPayload({ ...config, amount: session.amountExpected ?? session.amount_expected ?? amount,
    reference: buildPosPaymentReference(orderIdentity, branch) });
}
