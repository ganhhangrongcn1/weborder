import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";

export async function auditLoyaltyReconcileBacklog(options = {}) {
  return coreSupabaseRepository.auditLoyaltyReconcileBacklog(options);
}

export async function reconcileLoyaltyBacklog(options = {}) {
  return coreSupabaseRepository.reconcileLoyaltyBacklog(options);
}

export async function auditLoyaltyReconcilePlan(options = {}) {
  return coreSupabaseRepository.auditLoyaltyReconcilePlan(options);
}

export async function reconcileLoyaltyBacklogSafe(options = {}) {
  return coreSupabaseRepository.reconcileLoyaltyBacklogSafe(options);
}

export default {
  auditLoyaltyReconcileBacklog,
  reconcileLoyaltyBacklog,
  auditLoyaltyReconcilePlan,
  reconcileLoyaltyBacklogSafe
};
