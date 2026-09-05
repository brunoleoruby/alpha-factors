export function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function std(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((acc, x) => acc + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function zscore(values: number[]) {
  const m = mean(values);
  const s = std(values);
  if (s < 1e-12) return values.map(() => 0);
  return values.map((x) => (x - m) / s);
}

export function returnsFromPrices(closes: number[], lookback: number) {
  if (closes.length <= lookback) return 0;
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - lookback];
  if (then <= 0) return 0;
  return now / then - 1;
}

export function realizedVol(closes: number[], window: number) {
  if (closes.length < window + 1) return 0;
  const slice = closes.slice(-window - 1);
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    rets.push(Math.log(slice[i] / slice[i - 1]));
  }
  return std(rets) * Math.sqrt(252);
}

export function maxDrawdown(equity: number[]) {
  let peak = equity[0] ?? 0;
  let dd = 0;
  for (const value of equity) {
    peak = Math.max(peak, value);
    if (peak > 0) dd = Math.min(dd, value / peak - 1);
  }
  return dd;
}

export function sharpe(dailyReturns: number[]) {
  if (dailyReturns.length < 2) return 0;
  const m = mean(dailyReturns);
  const s = std(dailyReturns);
  if (s < 1e-12) return 0;
  return (m * 252) / (s * Math.sqrt(252));
}

export function cagr(start: number, end: number, days: number) {
  if (start <= 0 || days <= 0) return 0;
  return Math.pow(end / start, 252 / days) - 1;
}
