export const ENV_SHARE_IDS = [
  "nifty",
  "giftnifty",
  "indiavix",
  "spx",
  "ndx",
  "usdinr",
  "gold",
  "wti",
] as const;

export type EnvShareId = (typeof ENV_SHARE_IDS)[number];

export type EnvShareChance = {
  id: string;
  prevClose: number | null;
  last: number | null;
  changePct: number | null;
  chance1d?: number;
  hitRate?: number;
  regime?: string;
  structure?: string;
  sampleSize?: number;
};
