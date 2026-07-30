/**
 * Position health thresholds, mirrored from the contract so the UI and
 * CBLending.sol can't drift apart.
 *
 *   MAX_LTV_BPS        = 8_000  → 80%  most you may borrow to
 *   LIQ_THRESHOLD_BPS  = 9_000  → 90%  you can be liquidated
 *
 * Copied from `sbprotocol/app/src/health.ts` rather than rewritten. Two numbers
 * that must agree with a contract should exist once, and every ruler mark and
 * every status colour on the borrow screen is computed from these — never from a
 * percentage typed into CSS, which is how the two drift apart without anyone
 * noticing.
 */
export const MAX_LTV = 80;
export const LIQ_LTV = 90;

export type Health = "safe" | "warn" | "danger";

export function healthOf(ltv: number): Health {
  if (ltv >= LIQ_LTV) return "danger";
  if (ltv >= MAX_LTV) return "warn";
  return "safe";
}

export const healthLabel = (h: Health) =>
  h === "safe" ? "Healthy" : h === "warn" ? "At risk" : "Liquidatable";

/**
 * The contract rounds three ways in its own favour — collateral value down, debt
 * value up, and the final ratio up. A borrow computed at exactly 80% therefore
 * lands on 8001 bps on-chain and reverts. Everything the UI offers as a maximum
 * is shaded by this much first, so "Max" is a number that actually goes through.
 *
 * 25 bps — a quarter of one percent — is far more than the rounding can cost and
 * still invisible on a slider that reads whole percentages.
 */
export const SAFETY_BPS = 25;

/**
 * The LTV the UI will actually let you reach, as a whole percentage.
 *
 * Floored, not just shaded: every figure on this screen is displayed as an
 * integer, and a cap of 79.75 that renders as "80%" would contradict the very
 * sentence explaining why 80 is out of reach.
 */
export const UI_MAX_LTV = Math.floor(MAX_LTV - SAFETY_BPS / 100);

/**
 * Where a mark sits on the ruler, as a percentage of its width.
 *
 * Every ruler on the screen is drawn on the same 0→100 scale, so the 80 and 90
 * marks land in the same place on every one of them — which is the whole reason
 * four positions can be compared at a glance. Dividing by LIQ_LTV instead would
 * put 80% at 89% of the bar and quietly destroy that.
 */
export const rulerPct = (ltv: number) => Math.max(0, Math.min(100, ltv));
