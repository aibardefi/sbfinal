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

/**
 * How far the collateral can fall before the position is liquidated, as a
 * percentage of its current price.
 *
 * This is the number the borrow screen is really about. An LTV of 72% sounds
 * comfortably short of the 90% trigger, and it is not: it means a 20% dip takes
 * everything. Stating the ratio and leaving the borrower to do that arithmetic
 * under pressure is how a screen technically tells the truth and still misleads.
 *
 * A position with no debt cannot be liquidated at any price, hence 100.
 */
export const dropToLiquidation = (ltv: number) => (ltv > 0 ? (1 - ltv / LIQ_LTV) * 100 : 100);

export type Risk = "low" | "moderate" | "high";

/**
 * The one risk scale on this screen, measured in that headroom rather than in
 * the ratio itself.
 *
 * It replaces the old 80/90 banding outright — deliberately, because two scales
 * is the failure the handover note in `public/design/` warns about, not two
 * *thresholds*. 80 and 90 are still here and still absolute: they are contract
 * facts, they mark the ruler, and `UI_MAX_LTV` still caps what can be borrowed.
 * What they no longer do is decide what colour anything is.
 */
export function riskOf(ltv: number): Risk {
  const drop = dropToLiquidation(ltv);
  if (drop >= 50) return "low";
  if (drop >= 25) return "moderate";
  return "high";
}

export const riskLabel = (r: Risk) =>
  r === "low" ? "Low risk" : r === "moderate" ? "Moderate risk" : "High risk";

/**
 * Two tones, not three.
 *
 * The design's own note: a three-step colour ramp spends its middle step saying
 * "nothing is happening" exactly while the risk doubles. So the fill is the
 * accent until the headroom is thin, and then it is the danger colour.
 *
 * The word from `riskLabel` is always rendered beside it. The prototype drops
 * that on position rows and leaves a bare coloured number, which is a state you
 * cannot read without seeing the colour.
 */
export const riskTone = (r: Risk): "safe" | "danger" => (r === "high" ? "danger" : "safe");

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
