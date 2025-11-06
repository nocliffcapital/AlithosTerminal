/**
 * pm-math — lightweight math helpers for prediction-market terminals
 * Supports: conversions, fee-aware EV/Break-even/Kelly, LMSR, CPMM (XYK)
 */

// ---------- Helpers ----------
export const EPS = 1e-12;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const clampProb = (p: number) => clamp(p, EPS, 1 - EPS);

// ---------- Conversions ----------
export const probToLogit = (p: number) => Math.log(clampProb(p) / (1 - clampProb(p)));
export const logitToProb = (z: number) => 1 / (1 + Math.exp(-z));
export const probToDecimalOdds = (p: number) => 1 / clampProb(p);
export const decimalOddsToProb = (odds: number) => 1 / odds;
export const probToUSOdds = (p: number) => (p >= 0.5 ? -(p / (1 - p)) * 100 : ((1 - p) / p) * 100);
export const usOddsToProb = (us: number) => (us > 0 ? 100 / (us + 100) : (-us) / (100 - us));

// ---------- Break-even, EV, Kelly (profit-fee model) ----------
/** Break-even probability given entry price c (0..1) and win-only profit fee f */
export const breakEvenProb = (c: number, f: number) => c / (c + (1 - f) * (1 - c));
/** Break-even entry price for belief p and profit fee f */
export const breakEvenCost = (p: number, f: number) => (p * (1 - f)) / (1 - p + p * (1 - f));
/** Expected profit per $ staked (buy YES at cost c, payout 1, profit fee f on wins) */
export const evPerDollar = (p: number, c: number, f: number) => p * (1 - f) * (1 - c) - (1 - p) * c;

/**
 * Kelly fraction of bankroll for buying YES at cost c, belief p, profit fee f.
 * b = net odds per $ staked = ((1-f)*(1-c))/c
 * f* = (b*p - (1-p)) / b
 * @param frac fractional Kelly in [0,1]
 * @param fMax cap in [0,1]
 * @param allowNegative if true, return negative Kelly when edge<0 (for shorting workflows)
 */
export function kellyFraction(
  p: number,
  c: number,
  profitFee: number,
  frac: number = 1,
  fMax: number = 1,
  allowNegative: boolean = false
) {
  const b = ((1 - profitFee) * (1 - c)) / c;
  const fStar = (b * p - (1 - p)) / b; // full Kelly
  const fAdj = fStar * frac;
  const bounded = allowNegative ? clamp(fAdj, -fMax, fMax) : clamp(Math.max(0, fAdj), 0, fMax);
  return bounded;
}

// ---------- LMSR (Log Market Scoring Rule) ----------
/** Cost function C(qy, qn) = b ln( e^{qy/b} + e^{qn/b} ) */
export const lmsrCost = (qy: number, qn: number, b: number) =>
  b * Math.log(Math.exp(qy / b) + Math.exp(qn / b));

/** Binary price p_y = e^{qy/b} / (e^{qy/b}+e^{qn/b}) */
export const lmsrPrice = (qy: number, qn: number, b: number) =>
  Math.exp(qy / b) / (Math.exp(qy / b) + Math.exp(qn / b));

export const lmsrPriceFromSkew = (s: number, b: number) => 1 / (1 + Math.exp(-s / b)); // s = qy - qn
export const lmsrSkewFromPrice = (p: number, b: number) => b * Math.log(clampProb(p) / (1 - clampProb(p)));

/** Cost to buy dYes (holding qn fixed) */
export const lmsrCostDeltaYes = (qy: number, qn: number, b: number, dYes: number) =>
  lmsrCost(qy + dYes, qn, b) - lmsrCost(qy, qn, b);

/**
 * Trade to a target price pTarget by increasing qy only (qn fixed).
 * dq = b*(logit(pT) - logit(p0)); cost = C(qy+dq,qn) - C(qy,qn)
 */
export function lmsrTradeToTargetPrice(qy: number, qn: number, b: number, pTarget: number) {
  const p0 = lmsrPrice(qy, qn, b);
  const logit = (p: number) => Math.log(clampProb(p) / (1 - clampProb(p)));
  const dq = b * (logit(pTarget) - logit(p0));
  const cost = lmsrCostDeltaYes(qy, qn, b, dq);
  const qyNew = qy + dq;
  const pNew = lmsrPrice(qyNew, qn, b);
  return { dqYes: dq, cost, qyNew, qnNew: qn, p0, pNew };
}

// ---------- CPMM (XYK) YES/NO ----------
// Mapping: r = y/x (NO per YES), p = y/(x+y). Buy YES: take out dx YES, add dy NO.
export const cpmmProb = (x: number, y: number) => y / (x + y);
export const cpmmSpotRatio = (x: number, y: number) => y / x;

/** Cost (NO paid) to buy dx YES; feeIn applies to NO sent in (pool receives (1-feeIn)*NO) */
export function cpmmBuyYesCost(x: number, y: number, dx: number, feeIn: number = 0) {
  if (dx <= 0) throw new Error("dx must be > 0");
  if (dx >= x) throw new Error("dx too large");
  const k = x * y;
  const x1 = x - dx;
  const y1 = k / x1;
  const dyEff = y1 - y; // NO effectively added to pool
  const dyPaid = dyEff / (1 - feeIn);
  const avgPriceNOperYES = dyPaid / dx;
  const rEnd = y1 / x1;
  const pEnd = y1 / (x1 + y1);
  return { dyEff, dyPaid, avgPriceNOperYES, x1, y1, rEnd, pEnd };
}

/** Compute trade needed to reach target probability pTarget; returns YES out and NO paid */
export function cpmmTradeToTargetProb(x: number, y: number, pTarget: number, feeIn: number = 0) {
  if (!(pTarget > 0 && pTarget < 1)) throw new Error("pTarget must be in (0,1)");
  const k = x * y;
  const rTarget = pTarget / (1 - pTarget);
  const x1 = Math.sqrt(k / rTarget);
  const y1 = Math.sqrt(k * rTarget);
  if (x1 >= x) throw new Error("Target probability is below current; use sell path or adjust");
  const dxOutYes = x - x1; // YES received by trader
  const dyEffIn = y1 - y; // NO added to pool
  const dyPaid = dyEffIn / (1 - feeIn);
  const avgPriceNOperYES = dyPaid / dxOutYes;
  return { dxOutYes, dyEffIn, dyPaid, avgPriceNOperYES, x1, y1, rTarget, p0: y / (x + y), pNew: y1 / (x1 + y1) };
}

/** Sell YES: add dxIn YES, receive NO; feeOut applies to NO leaving the pool */
export function cpmmSellYesReceiveNo(x: number, y: number, dxIn: number, feeOut: number = 0) {
  if (dxIn <= 0) throw new Error("dxIn must be > 0");
  const k = x * y;
  const x1 = x + dxIn;
  const y1 = k / x1;
  const dyOutEff = y - y1; // NO that leaves the pool pre-fee
  const dyToUser = dyOutEff * (1 - feeOut);
  const avgNOperYES = dyToUser / dxIn;
  const pEnd = y1 / (x1 + y1);
  return { dyToUser, dyOutEff, avgNOperYES, x1, y1, pEnd };
}

/** Slippage summary for buying dx YES */
export function cpmmSlippageSummary(x: number, y: number, dx: number, feeIn: number = 0) {
  const r0 = y / x;
  const t = cpmmBuyYesCost(x, y, dx, feeIn);
  const rAvg = t.dyPaid / dx;
  const r1 = t.y1 / t.x1;
  const slipPct = (rAvg / r0 - 1) * 100;
  return { r0, r1, rAvg, slipPct, p0: y / (x + y), p1: t.pEnd };
}

// ---------- Default export (handy for quick import) ----------
export default {
  EPS, clamp, clampProb,
  probToLogit, logitToProb, probToDecimalOdds, decimalOddsToProb, probToUSOdds, usOddsToProb,
  breakEvenProb, breakEvenCost, evPerDollar, kellyFraction,
  lmsrCost, lmsrPrice, lmsrPriceFromSkew, lmsrSkewFromPrice, lmsrCostDeltaYes, lmsrTradeToTargetPrice,
  cpmmProb, cpmmSpotRatio, cpmmBuyYesCost, cpmmTradeToTargetProb, cpmmSellYesReceiveNo, cpmmSlippageSummary,
};

