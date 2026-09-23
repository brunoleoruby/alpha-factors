export type SpreadGate = {
  id: string;
  label: string;
  test: string;
};

export const SPREAD_UNIVERSE = "Nifty 50";

export const SPREAD_LAW =
  "S_t = log P^A_t − β_t log P^B_t,  dS_t = κ(μ − S_t) dt + σ dW_t. β_t from Kalman. Trade only if the spread looks stationary (ADF rejects a unit root, Hurst H < 0.5).";

export const SPREAD_GATES: SpreadGate[] = [
  { id: "adf", label: "ADF", test: "Unit root rejected on the spread" },
  { id: "halfLife", label: "Half-life", test: "OU half-life inside a tradable band" },
  { id: "hurst", label: "Hurst", test: "H < 0.5 (mean-reverting)" },
  { id: "rmt", label: "RMT", test: "Marchenko–Pastur cleaned covariance, not raw" },
  { id: "kalman", label: "Kalman β", test: "Hedge ratio finite and stable enough to size" },
  { id: "hmm", label: "HMM regime", test: "Not in a stress state" },
  { id: "cost", label: "Costs", test: "Expected move covers charges" },
];

export const SPREAD_ACTION =
  "Enter only when enough gates pass (start at 6/7). Size on cleaned covariance. Paper first. Deflated Sharpe / PBO can still say luck — then the engine does not claim an edge.";
