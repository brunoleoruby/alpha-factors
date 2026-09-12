/** Desk-reference sector total returns, Jan 2021 → 12 Sep 2026. Not live prices. */

export const SECTOR_AS_OF = "12/09/2026";
export const SECTOR_START = "01/01/2021";
export const SECTOR_YEARS = [2021, 2022, 2023, 2024, 2025, 2026] as const;

/** Years from 1 Jan 2021 to 12 Sep 2026 for CAGR. */
export const SECTOR_YEAR_SPAN = 5 + 255 / 365;

export type SectorMarket = "US" | "NSE";

export type SectorSeries = {
  sector: string;
  proxy: string;
  yearly: number[];
};

export type SectorScore = SectorSeries & {
  cumulative: number;
  cagr: number;
};

function productReturn(yearly: number[]) {
  return yearly.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

function cagrFromCumulative(cumulative: number) {
  return (1 + cumulative) ** (1 / SECTOR_YEAR_SPAN) - 1;
}

export function scoreSectors(series: SectorSeries[]): SectorScore[] {
  return series
    .map((row) => {
      const cumulative = productReturn(row.yearly);
      return { ...row, cumulative, cagr: cagrFromCumulative(cumulative) };
    })
    .sort((a, b) => b.cumulative - a.cumulative);
}

/** Calendar-year total returns vs SPDR / GICS sector ETFs, 2026 is YTD. */
export const US_SECTOR_RETURNS: SectorSeries[] = [
  { sector: "Energy", proxy: "XLE", yearly: [0.533, 0.646, -0.013, 0.024, 0.061, 0.048] },
  { sector: "Technology", proxy: "XLK", yearly: [0.347, -0.331, 0.564, 0.217, 0.182, 0.124] },
  { sector: "Communication", proxy: "XLC", yearly: [0.161, -0.376, 0.544, 0.388, 0.221, 0.146] },
  { sector: "Financials", proxy: "XLF", yearly: [0.349, -0.105, 0.121, 0.304, 0.168, 0.092] },
  { sector: "Consumer disc.", proxy: "XLY", yearly: [0.278, -0.363, 0.397, 0.266, 0.114, 0.068] },
  { sector: "Industrials", proxy: "XLI", yearly: [0.211, -0.055, 0.185, 0.174, 0.142, 0.086] },
  { sector: "Health", proxy: "XLV", yearly: [0.26, -0.033, 0.021, 0.026, 0.084, 0.031] },
  { sector: "Utilities", proxy: "XLU", yearly: [0.177, -0.014, -0.071, 0.234, 0.096, 0.082] },
  { sector: "Materials", proxy: "XLB", yearly: [0.273, -0.123, 0.125, 0.068, 0.054, 0.038] },
  { sector: "Real estate", proxy: "XLRE", yearly: [0.461, -0.262, 0.124, 0.042, 0.068, 0.051] },
  { sector: "Consumer staples", proxy: "XLP", yearly: [0.173, -0.023, 0.005, 0.128, 0.072, 0.041] },
  { sector: "Auto", proxy: "TSLA sleeve", yearly: [0.184, -0.382, 0.685, 0.128, -0.084, 0.042] },
];

/** Calendar-year total returns vs Nifty sector indices, 2026 is YTD. */
export const NSE_SECTOR_RETURNS: SectorSeries[] = [
  { sector: "PSU Bank", proxy: "Nifty PSU Bank", yearly: [0.386, 0.712, 0.428, 0.146, 0.082, 0.064] },
  { sector: "Realty", proxy: "Nifty Realty", yearly: [0.542, -0.084, 0.816, 0.324, 0.128, 0.046] },
  { sector: "Infra", proxy: "Nifty Infra", yearly: [0.324, 0.128, 0.386, 0.162, 0.094, 0.068] },
  { sector: "Auto", proxy: "Nifty Auto", yearly: [0.192, 0.154, 0.468, 0.224, 0.086, 0.052] },
  { sector: "Telecom", proxy: "Nifty Telecom", yearly: [0.246, -0.042, 0.184, 0.426, 0.168, 0.084] },
  { sector: "Energy", proxy: "Nifty Energy", yearly: [0.284, 0.246, 0.262, 0.088, 0.042, 0.056] },
  { sector: "Metal", proxy: "Nifty Metal", yearly: [0.658, -0.018, 0.294, 0.062, -0.048, 0.081] },
  { sector: "IT", proxy: "Nifty IT", yearly: [0.596, -0.258, 0.186, 0.124, 0.068, 0.024] },
  { sector: "Pharma", proxy: "Nifty Pharma", yearly: [0.104, -0.116, 0.328, 0.386, 0.142, 0.036] },
  { sector: "Bank", proxy: "Nifty Bank", yearly: [0.138, 0.212, 0.126, 0.084, 0.102, 0.078] },
  { sector: "FMCG", proxy: "Nifty FMCG", yearly: [0.162, 0.184, 0.278, 0.096, 0.064, 0.042] },
  { sector: "Media", proxy: "Nifty Media", yearly: [0.084, -0.186, 0.122, -0.064, 0.048, 0.021] },
];

export function sectorsFor(market: SectorMarket) {
  return scoreSectors(market === "NSE" ? NSE_SECTOR_RETURNS : US_SECTOR_RETURNS);
}

export function bestCalendarYear(rows: SectorScore[]) {
  let best = { year: SECTOR_YEARS[0], sector: rows[0]?.sector ?? "—", ret: -Infinity };
  for (const row of rows) {
    row.yearly.forEach((ret, i) => {
      if (ret > best.ret) best = { year: SECTOR_YEARS[i], sector: row.sector, ret };
    });
  }
  return best;
}
