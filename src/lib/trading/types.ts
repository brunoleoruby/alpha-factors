export const FACTOR_IDS = [
  "momentum",
  "meanReversion",
  "lowVol",
  "value",
  "quality",
  "liquidity",
] as const;

export type FactorId = (typeof FACTOR_IDS)[number];

export type FactorWeights = Record<FactorId, number>;

export type StrategyConfig = {
  capital: number;
  longCount: number;
  shortCount: number;
  rebalanceEvery: number;
  costBps: number;
  weights: FactorWeights;
};

export type Instrument = {
  symbol: string;
  name: string;
  sector: string;
  startPrice: number;
  /** True factor DNA used only to simulate prices — not shown as “cheating” labels in the UI. */
  dna: {
    value: number;
    quality: number;
    vol: number;
    momentumBias: number;
    liquidity: number;
  };
};

export type Bar = {
  date: string;
  close: number;
  volume: number;
  earningsYield: number;
  roe: number;
};

export type Market = {
  dates: string[];
  series: Record<string, Bar[]>;
};

export type FactorSnapshot = {
  symbol: string;
  raw: Record<FactorId, number>;
  z: Record<FactorId, number>;
  composite: number;
};

export type TargetWeight = {
  symbol: string;
  weight: number;
  side: "long" | "short";
  composite: number;
};

export type Position = {
  symbol: string;
  shares: number;
  avgPrice: number;
  marketValue: number;
  weight: number;
  unrealizedPnl: number;
};

export type Trade = {
  date: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  notional: number;
  cost: number;
  reason: "rebalance" | "open";
};

export type EquityPoint = {
  date: string;
  equity: number;
  cash: number;
  drawdown: number;
};

export type BacktestResult = {
  equity: EquityPoint[];
  trades: Trade[];
  positions: Position[];
  rankings: FactorSnapshot[];
  targets: TargetWeight[];
  lastDate: string;
  asOfIndex: number;
  stats: PerformanceStats;
};

export type PerformanceStats = {
  totalReturn: number;
  cagr: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  tradeCount: number;
  longExposure: number;
  shortExposure: number;
};

export type LiveState = {
  market: Market;
  asOfIndex: number;
  cash: number;
  holdings: Record<string, { shares: number; avgPrice: number }>;
  trades: Trade[];
  equity: EquityPoint[];
  lastRebalanceIndex: number;
  rankings: FactorSnapshot[];
  targets: TargetWeight[];
  positions: Position[];
  stats: PerformanceStats;
};
