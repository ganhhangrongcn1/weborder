export const PREORDER_WINDOW_CONFIG_KEY = 'ghr_nexpos_preorder_window';
const DAY_MS = 86_400_000;
const boundedDays = value => Number.isInteger(value) && value > 0 ? Math.min(value, 7) : 7;

export function normalizePreorderWindowConfig(value) {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    enabled: config.enabled === true,
    hubIds: Array.isArray(config.hubIds)
      ? [...new Set(config.hubIds.filter(id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)))]
      : [],
    lookbackDays: boundedDays(config.lookbackDays),
    lookaheadDays: boundedDays(config.lookaheadDays)
  };
}

export function getPreorderQueryWindow({ status, hubId, config, fallback, now = Date.now() }) {
  if (status !== 'PRE_ORDER' || !config?.enabled || !config.hubIds.includes(hubId)) return fallback;
  return {
    from: new Date(now - config.lookbackDays * DAY_MS).toISOString(),
    to: new Date(now + config.lookaheadDays * DAY_MS).toISOString()
  };
}
