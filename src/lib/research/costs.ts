/** Default India-style all-in on each fill. Judge P&L after this, never before. */
export const FEE_BPS = 5;
export const SLIPPAGE_BPS = 8;

export function fillCostBps(feeBps = FEE_BPS, slipBps = SLIPPAGE_BPS) {
  return feeBps + slipBps;
}

/** Cost on traded notional (each blotter fill pays once). */
export function notionalCost(notional: number, feeBps = FEE_BPS, slipBps = SLIPPAGE_BPS) {
  return Math.abs(notional) * fillCostBps(feeBps, slipBps) / 10_000;
}

export function netAfterCosts(gross: number, costs: number) {
  return gross - costs;
}
