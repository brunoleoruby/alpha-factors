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

/** Three-candle swing: one lower high on each side of the pivot. */
export function threePointSwingHighs(candles: Candle[]): SwingPoint[] {
  return findSwings(candles, 1).filter((s) => s.kind === "high");
}

/** Three-candle swing: one higher low on each side of the pivot. */
export function threePointSwingLows(candles: Candle[]): SwingPoint[] {
  return findSwings(candles, 1).filter((s) => s.kind === "low");
}

export function lastThreePointSwingHighs(candles: Candle[], n = 3): SwingPoint[] {
  return threePointSwingHighs(candles).slice(-n);
}

/** Alternate swing high → low → high so the structure can be drawn as a zigzag. */
export function swingZigzag(candles: Candle[]): SwingPoint[] {
  const merged = [...threePointSwingHighs(candles), ...threePointSwingLows(candles)].sort(
    (a, b) => a.time - b.time || (a.kind === "low" ? -1 : 1),
  );
  const out: SwingPoint[] = [];
  for (const point of merged) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(point);
      continue;
    }
    if (last.time === point.time) {
      if (last.kind !== point.kind) out.push(point);
      continue;
    }
    if (last.kind === point.kind) {
      if (point.kind === "high" && point.price >= last.price) out[out.length - 1] = point;
      if (point.kind === "low" && point.price <= last.price) out[out.length - 1] = point;
      continue;
    }
    out.push(point);
  }
  return out;
}
