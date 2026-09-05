import { gaussian, hashString, mulberry32 } from "./rng";
import type { Bar, Market } from "./types";
import { UNIVERSE } from "./universe";

function tradingDates(count: number, start = "2025-01-02") {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Builds a synthetic cross-section whose returns load on value, quality,
 * momentum continuation, and a market factor — so weighted factor books
 * actually behave differently from each other.
 */
export function generateMarket(seed = 42, bars = 260): Market {
  const dates = tradingDates(bars);
  const series: Market["series"] = {};
  const marketShock = dates.map((_, i) => {
    const rand = mulberry32(seed + i * 9973);
    return 0.00025 + 0.009 * gaussian(rand);
  });

  for (const name of UNIVERSE) {
    const rand = mulberry32(seed ^ hashString(name.symbol));
    const barsForName: Bar[] = [];
    let price = name.startPrice;
    let ey = clamp(0.045 - name.dna.value * 0.012 + (rand() - 0.5) * 0.01, 0.005, 0.12);
    let roe = clamp(0.14 + name.dna.quality * 0.06 + (rand() - 0.5) * 0.03, -0.08, 0.45);
    let volume = 4_000_000 * (0.6 + name.dna.liquidity);

    for (let t = 0; t < dates.length; t++) {
      const idio = name.dna.vol * 0.012 * gaussian(rand);
      const premia =
        0.00018 * name.dna.value +
        0.00022 * name.dna.quality +
        0.00016 * name.dna.momentumBias -
        0.00008 * name.dna.vol;
      const momCarry =
        t > 20
          ? 0.08 *
            Math.log(price / barsForName[t - 21].close) *
            Math.max(0, name.dna.momentumBias)
          : 0;
      const ret = marketShock[t] * (0.7 + 0.3 * name.dna.vol) + premia + momCarry / 21 + idio;
      price = Math.max(1.5, price * Math.exp(ret));
      ey = clamp(ey + (rand() - 0.5) * 0.0008, 0.004, 0.14);
      roe = clamp(roe + (rand() - 0.5) * 0.0012, -0.12, 0.5);
      volume = Math.max(200_000, volume * (0.92 + 0.16 * rand()));

      barsForName.push({
        date: dates[t],
        close: Number(price.toFixed(2)),
        volume: Math.round(volume),
        earningsYield: Number(ey.toFixed(4)),
        roe: Number(roe.toFixed(4)),
      });
    }
    series[name.symbol] = barsForName;
  }

  return { dates, series };
}

export function appendBar(market: Market, seed = 42): Market {
  const last = market.dates[market.dates.length - 1];
  const cursor = new Date(`${last}T00:00:00Z`);
  do {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  } while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6);
  const date = cursor.toISOString().slice(0, 10);
  const t = market.dates.length;
  const marketShock = 0.00025 + 0.009 * gaussian(mulberry32(seed + t * 9973));

  const series: Market["series"] = {};
  for (const name of UNIVERSE) {
    const hist = market.series[name.symbol];
    const prev = hist[hist.length - 1];
    const rand = mulberry32((seed ^ hashString(name.symbol) ^ (t * 7919)) >>> 0);
    const idio = name.dna.vol * 0.012 * gaussian(rand);
    const premia =
      0.00018 * name.dna.value +
      0.00022 * name.dna.quality +
      0.00016 * name.dna.momentumBias -
      0.00008 * name.dna.vol;
    const lookback = hist[hist.length - 21] ?? hist[0];
    const momCarry = 0.08 * Math.log(prev.close / lookback.close) * Math.max(0, name.dna.momentumBias);
    const ret = marketShock * (0.7 + 0.3 * name.dna.vol) + premia + momCarry / 21 + idio;
    const close = Math.max(1.5, prev.close * Math.exp(ret));
    series[name.symbol] = [
      ...hist,
      {
        date,
        close: Number(close.toFixed(2)),
        volume: Math.max(200_000, Math.round(prev.volume * (0.92 + 0.16 * rand()))),
        earningsYield: Number(
          Math.min(0.14, Math.max(0.004, prev.earningsYield + (rand() - 0.5) * 0.0008)).toFixed(4),
        ),
        roe: Number(Math.min(0.5, Math.max(-0.12, prev.roe + (rand() - 0.5) * 0.0012)).toFixed(4)),
      },
    ];
  }

  return { dates: [...market.dates, date], series };
}
