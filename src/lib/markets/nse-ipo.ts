export type IpoBoardKind = "main" | "sme";

export type IpoIssue = {
  id: string;
  board: IpoBoardKind;
  symbol: string;
  name: string;
  series: string | null;
  status: string | null;
  price: string | null;
  start: string | null;
  end: string | null;
  listing: string | null;
  shares: number | null;
  subscribed: number | null;
  qib?: number | null;
  nii?: number | null;
  retail?: number | null;
  applications?: string | null;
  subAsOn?: string | null;
  sector?: string | null;
  bucket: "open" | "upcoming" | "recent";
};

export type IpoSleeve = {
  open: IpoIssue[];
  upcoming: IpoIssue[];
  recent: IpoIssue[];
};

export type IpoBook = {
  asOf: string;
  main: IpoSleeve;
  sme: IpoSleeve;
  error?: string;
};

export function sleeveCounts(sleeve: IpoSleeve) {
  return `${sleeve.open.length} open · ${sleeve.upcoming.length} upcoming · ${sleeve.recent.length} recent`;
}
