export const ANSWER_FACTORS = Object.freeze({
  pass: 1,
  improve: 0.5,
  fail: 0,
  not_applicable: null
});

export function calculateInspectionScore(answers = []) {
  let earnedWeight = 0;
  let applicableWeight = 0;
  let hasCriticalFailure = false;

  for (const answer of answers) {
    const weight = Number(answer?.weight);
    const factor = ANSWER_FACTORS[answer?.result];
    if (!Number.isFinite(weight) || weight <= 0 || factor === null || factor === undefined) continue;
    applicableWeight += weight;
    earnedWeight += weight * factor;
    if (answer?.isCritical && answer?.result === "fail") hasCriticalFailure = true;
  }

  const score = applicableWeight > 0 ? Math.round((earnedWeight / applicableWeight) * 10000) / 100 : 0;
  let rating = "Không đạt";
  if (!hasCriticalFailure && score >= 90) rating = "Tốt";
  else if (!hasCriticalFailure && score >= 80) rating = "Đạt";
  else if (!hasCriticalFailure && score >= 70) rating = "Cần cải thiện";

  return { score, rating, applicableWeight, earnedWeight, hasCriticalFailure };
}

export function calculateEmployeeCompliance({ penaltyPoints = 0, inspectedAppearances = 0, multiplier = 5 } = {}) {
  const appearances = Number(inspectedAppearances);
  if (!Number.isFinite(appearances) || appearances <= 0) return null;
  const penalty = Math.max(0, Number(penaltyPoints) || 0);
  const factor = Math.max(0, Number(multiplier) || 0);
  return Math.max(0, Math.round((100 - (penalty / appearances) * factor) * 100) / 100);
}
