// Reuses the local worker normalization and API contracts. No browser is launched.
import grabCsrfHeaders from './csrf.ts';
export default function createCollectors(api, requestFetch = fetch) {
const fetch = requestFetch;
const REVIEW_WINDOW_DAYS = 2;
const FINANCE_SNAPSHOT_DAYS = 2;
const FINANCE_DETAIL_LIMIT = 100;
const FINANCE_DETAIL_CONCURRENCY = 2;
const FINANCE_DETAIL_DELAY_MS = 100;
const FEEDBACK_API_URL = 'https://api.grab.com/food/merchant/v1/feedback';
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const cookieHeader = (cookies) => cookies
  .filter((cookie) => !cookie.expires || cookie.expires < 0 || cookie.expires * 1000 > Date.now())
  .map((cookie) => `${cookie.name}=${cookie.value}`)
  .join("; ");

function vietnamDateOnly(offsetDays = 0) {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function grabFinanceSummary(payload) {
  return [payload?.data, payload?.result, payload].find((value) => value && typeof value === "object" && (
    "net_earning" in value || "netEarning" in value || "net_sales" in value || "netSales" in value
  )) || null;
}

function safeMoneyNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : null;
}

function financeHeaders(cookie, merchantId) {
  return {
    accept: "application/json, text/plain, */*",
    cookie,
    merchantid: merchantId,
    origin: "https://merchant.grab.com",
    referer: "https://merchant.grab.com/",
    requestsource: "troyPortal"
  };
}

async function fetchGrabFinanceJson(url, headers, cookieJar = null) {
  const response = await fetch(url, { headers, signal: globalThis.AbortSignal.timeout(30_000) });
  if (cookieJar && typeof response.headers.getSetCookie === "function") {
    for (const value of response.headers.getSetCookie()) {
      await cookieJar.setCookie(value, url);
    }
  }
  if (response.status === 401 || response.status === 403) {
    const error = new Error(`Grab Finance HTTP ${response.status}`);
    error.code = response.status === 401 ? "GRAB_SESSION_EXPIRED" : "GRAB_REQUEST_FORBIDDEN";
    throw error;
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Grab Finance API trả HTTP ${response.status}.`);
  return payload;
}

function feeBreakdownValue(detail, key) {
  const item = Array.isArray(detail?.fee_breakdown)
    ? detail.fee_breakdown.find((entry) => String(entry?.key || "").toUpperCase() === key)
    : null;
  return safeMoneyNumber(item?.value?.amount ?? item?.value) || 0;
}

function vietnamDateFromTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return vietnamDateOnly();
  const date = new Date(timestamp + 7 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function normalizeFinanceTransaction(stub, detail) {
  const category = String(detail?.transaction_category || stub?.transaction_category || "").toLowerCase();
  const amount = safeMoneyNumber(detail?.amount) || 0;
  const taxOnAmount = safeMoneyNumber(detail?.tax_on_amount) || 0;
  return {
    transaction_id: String(detail?.transaction_id || stub?.transaction_id || ""),
    store_id: String(detail?.store_id || stub?.store_id || ""),
    transaction_date: String(stub?.report_date || vietnamDateFromTimestamp(detail?.created_at || stub?.created_at)),
    transaction_updated_at: detail?.updated_at || stub?.updated_at || null,
    transaction_category: category,
    transaction_sub_category: String(detail?.transaction_sub_category || stub?.transaction_sub_category || ""),
    transaction_status: String(detail?.transaction_status || stub?.transaction_status || ""),
    currency: String(detail?.currency || "VND"),
    net_total: safeMoneyNumber(detail?.net_total) || 0,
    net_sales: safeMoneyNumber(detail?.net_sales) || 0,
    order_value: safeMoneyNumber(detail?.order_value) || 0,
    merchant_discount: safeMoneyNumber(detail?.mex_fund_discount) || 0,
    delivery_discount: safeMoneyNumber(detail?.mex_fund_delivery_campaign) || 0,
    voucher_amount: safeMoneyNumber(detail?.mex_issued_voucher) || 0,
    offer_amount: safeMoneyNumber(detail?.offer_amount) || 0,
    advertising_amount: category === "advertisement" ? (safeMoneyNumber(detail?.net_total) || amount) : 0,
    advertising_tax: category === "advertisement" ? taxOnAmount : 0,
    service_fee: safeMoneyNumber(detail?.gf_total_commission ?? detail?.gk_total_commission) || 0,
    channel_commission: safeMoneyNumber(detail?.channel_commission) || 0,
    delivery_commission: safeMoneyNumber(detail?.delivery_commission) || 0,
    commission_tax: safeMoneyNumber(detail?.gf_total_commission_tax ?? detail?.gk_total_commission_tax) || 0,
    vat_amount: feeBreakdownValue(detail, "VAT_AMOUNT"),
    withholding_tax: safeMoneyNumber(detail?.withholding_tax) || feeBreakdownValue(detail, "PIT_AMOUNT"),
    merchant_charges: safeMoneyNumber(detail?.mex_charges) || 0,
    raw_data: {
      fee_breakdown: Array.isArray(detail?.fee_breakdown) ? detail.fee_breakdown : [],
      commissions: Array.isArray(detail?.commissions) ? detail.commissions : [],
      omni_discount_details: detail?.omniDiscountDetails || null
    }
  };
}

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

async function collectFinanceSnapshots(page, merchantId, sourceId, cookieJar = null) {
  if (!merchantId) return { snapshots: [], transactions: [], detailStats: { listed: 0, requested: 0 } };
  const cookies = cookieJar
    ? []
    : await page.cookies("https://merchant.grab.com/", "https://api.grab.com/");
  if (!cookieJar && !cookieHeader(cookies)) throw new Error("Chưa có cookie Grab để đồng bộ tài chính.");
  const request = async (url) => {
    const cookie = cookieJar ? await cookieJar.getCookieString(url) : cookieHeader(cookies);
    return fetchGrabFinanceJson(url, financeHeaders(cookie, merchantId), cookieJar);
  };
  const snapshots = [];
  for (let offset = 0; offset > -FINANCE_SNAPSHOT_DAYS; offset -= 1) {
    const snapshotDate = vietnamDateOnly(offset);
    const query = new URLSearchParams({ from: snapshotDate, to: snapshotDate });
    const payload = await request(`https://merchant.grab.com/mex/finances/v1/transactions/summary?${query}`);
    const summary = grabFinanceSummary(payload);
    const netIncomeAmount = safeMoneyNumber(summary?.net_earning ?? summary?.netEarning);
    if (!summary || !Number.isSafeInteger(netIncomeAmount)) throw new Error(`Không đọc được thu nhập ròng Grab ngày ${snapshotDate}.`);
    snapshots.push({ snapshot_date: snapshotDate, currency: String(summary.currency || "VND"), net_revenue_amount: safeMoneyNumber(summary.net_sales ?? summary.netSales), net_income_amount: netIncomeAmount, raw_data: { source_path: "mex/finances/v1/transactions/summary", summary } });
  }

  const transactionStubs = [];
  for (let dayOffset = 0; dayOffset > -FINANCE_SNAPSHOT_DAYS; dayOffset -= 1) {
    const reportDate = vietnamDateOnly(dayOffset);
    let offset = 0;
    while (transactionStubs.length < 1000) {
      const query = new URLSearchParams({ from: reportDate, to: reportDate, offset: String(offset), limit: "50" });
      const payload = await request(`https://merchant.grab.com/mex/finances/v2/transactions?${query}`);
      const pageData = payload?.data || payload?.result || payload || {};
      const results = Array.isArray(pageData.results) ? pageData.results : [];
      transactionStubs.push(...results.map((item) => ({ ...item, report_date: reportDate })));
      offset += results.length;
      if (results.length < 50) break;
      if (transactionStubs.length >= 1000) throw new Error("FINANCE_PAGE_LIMIT");
    }
  }

  const plan = transactionStubs.length
    ? await api("automation_finance_detail_plan", {
        source_id: sourceId,
        transactions: transactionStubs.map((item) => ({ transaction_id: item.transaction_id, updated_at: item.updated_at }))
      })
    : { required_transaction_ids: [] };
  const requiredIds = new Set((plan.required_transaction_ids || []).slice(0, FINANCE_DETAIL_LIMIT).map(String));
  const required = transactionStubs.filter((item) => requiredIds.has(String(item.transaction_id)));
  const transactions = await mapWithConcurrency(required, FINANCE_DETAIL_CONCURRENCY, async (stub) => {
    const storeId = encodeURIComponent(String(stub.store_id || ""));
    const transactionId = encodeURIComponent(String(stub.transaction_id || ""));
    const payload = await request(`https://merchant.grab.com/mex/finances/v2/stores/${storeId}/transactions/${transactionId}`);
    if (FINANCE_DETAIL_DELAY_MS) await sleep(FINANCE_DETAIL_DELAY_MS);
    return normalizeFinanceTransaction(stub, payload?.data || payload?.result || payload || {});
  });
  return { snapshots, transactions, detailStats: { listed: transactionStubs.length, requested: required.length, remaining: Math.max(0, Number(plan.required_count || required.length) - required.length) } };
}


async function collectFeedbackDirect(page, source, cookieJar = null) {
  const merchantId = String(source.merchant_id || "").trim();
  if (!merchantId) throw new Error("Chưa có Merchant ID để gọi trực tiếp Grab API.");
  const cookies = cookieJar
    ? []
    : await page.cookies("https://api.grab.com/", "https://merchant.grab.com/");
  if (!cookieJar && !cookieHeader(cookies)) throw new Error("Chưa có cookie Grab API trong Chrome profile.");

  const cutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60_000);
  const end = new Date();
  const request = async (path, options = {}) => {
    const url = `${FEEDBACK_API_URL}${path}`;
    const cookie = cookieJar ? await cookieJar.getCookieString(url) : cookieHeader(cookies);
    const response = await fetch(url, {
      ...options,
      headers: {
        accept: "application/json, text/plain, */*",
        cookie,
        merchantid: merchantId,
        origin: "https://merchant.grab.com",
        referer: "https://merchant.grab.com/",
        requestsource: "troyPortal",
        "x-client-id": "GrabMerchant-Portal",
        "x-grabkit-clientid": "grabmerchant-portal",
        ...grabCsrfHeaders(cookie, options.method || "GET"),
        ...(options.body ? { "content-type": "application/json" } : {})
      },
      signal: globalThis.AbortSignal.timeout(30_000)
    });
    if (cookieJar && typeof response.headers.getSetCookie === "function") {
      for (const value of response.headers.getSetCookie()) {
        await cookieJar.setCookie(value, url);
      }
    }
    if (response.status === 401 || response.status === 403) {
      const error = new Error(response.status === 401
        ? "Phiên Grab hết hạn (HTTP 401)."
        : `Grab từ chối ${options.method || "GET"} /feedback${path} (HTTP 403).`);
      error.code = response.status === 401 ? "GRAB_SESSION_EXPIRED" : "GRAB_REQUEST_FORBIDDEN";
      throw error;
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Grab feedback API returned ${response.status}`);
    return body;
  };

  const baseBody = {
    serviceType: "DELIVERY",
    startDate: cutoff.toISOString(),
    endDate: end.toISOString(),
    merchantIDs: [merchantId],
    businessTypeFilter: 0,
    includeEmptyReviews: true
  };
  const reviews = [];
  let nextToken = "";
  let pageCount = 0;
  do {
    const body = await request("/reviews", {
      method: "POST",
      body: JSON.stringify({ ...baseBody, ...(nextToken ? { nextToken } : {}) })
    });
    const pageReviews = body?.reviews == null ? [] : body.reviews;
    if (!Array.isArray(pageReviews)) {
      throw new Error("Grab feedback API trả dữ liệu đánh giá không hợp lệ.");
    }
    reviews.push(...pageReviews);
    nextToken = String(body.nextToken || "");
    pageCount += 1;
    if (nextToken && pageCount >= 50) throw new Error("REVIEW_PAGE_LIMIT");
    if (!pageReviews.length) nextToken = "";
  } while (nextToken);

  const query = new URLSearchParams({
    serviceType: "DELIVERY",
    startDate: cutoff.toISOString(),
    endDate: end.toISOString(),
    "merchantIDs[]": merchantId,
    businessTypeFilter: "0",
    include_empty_reviews: "true"
  });
  const overviewBody = await request(`/overview?${query}`);
  return {
    reviews: reviews.filter((review) => {
      const createdAt = Date.parse(review?.createdAt);
      return Number.isFinite(createdAt) && createdAt >= cutoff.getTime() && createdAt <= end.getTime();
    }),
    overview: overviewBody?.feedbackOverview || {},
    pageCount
  };
}


return {collectFeedbackDirect,collectFinanceSnapshots};
}
