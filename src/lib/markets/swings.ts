import type { Candle } from "./tv";

export type SwingPoint = {
  time: number;
  price: number;
  kind: "high" | "low";
};

/**
 * Williams-style fractals: a bar is a swing high/low when its high/low is
 * strictly beyond `wing` bars on both sides. Last `wing` bars stay unmarked
 * until they confirm.
 */
export function findSwings(candles: Candle[], wing = 2): SwingPoint[] {
  const points: SwingPoint[] = [];
  if (wing < 1 || candles.length < wing * 2 + 1) return points;
  for (let i = wing; i < candles.length - wing; i++) {
    let swingHigh = true;
    let swingLow = true;
    for (let k = 1; k <= wing; k++) {
      if (candles[i].high <= candles[i - k].high || candles[i].high <= candles[i + k].high) {
        swingHigh = false;
      }
      if (candles[i].low >= candles[i - k].low || candles[i].low >= candles[i + k].low) {
        swingLow = false;
      }
    }
    if (swingHigh) points.push({ time: candles[i].time, price: candles[i].high, kind: "high" });
    if (swingLow) points.push({ time: candles[i].time, price: candles[i].low, kind: "low" });
  }
  return points;
}
