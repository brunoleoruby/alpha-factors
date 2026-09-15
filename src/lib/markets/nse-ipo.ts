const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const NSE_HOME = "https://www.nseindia.com";
const NSE_REFERER = `${NSE_HOME}/market-data/all-upcoming-issues-ipo`;

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

type NseCurrent = {
  companyName?: string;
  symbol?: string;
  series?: string;
  status?: string;
  issuePrice?: string;
  issueStartDate?: string;
  issueEndDate?: string;
  issueSize?: string | number;
  noOfTime?: string | number;
};

type NsePast = {
  company?: string;
  companyName?: string;
  symbol?: string;
  securityType?: string;
  issuePrice?: string;
  priceRange?: string;
  ipoStartDate?: string;
  ipoEndDate?: string;
  listingDate?: string;
};

function emptySleeve(): IpoSleeve {
  return { open: [], upcoming: [], recent: [] };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

function cookieHeader(res: Response) {
  const parts = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return parts
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function nseSession(): Promise<string> {
  const res = await fetch(NSE_REFERER, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": UA,
      Referer: NSE_HOME,
    },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`nse home ${res.status}`);
  const cookie = cookieHeader(res);
  if (!cookie) throw new Error("nse cookie empty");
  return cookie;
}

async function nseJson<T>(path: string, cookie: string): Promise<T> {
  const res = await fetch(`${NSE_HOME}${path}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
      Referer: NSE_REFERER,
      Cookie: cookie,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`nse ${path} ${res.status}`);
  return (await res.json()) as T;
}

function dmy(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function boardFromSeries(series: string | null | undefined): IpoBoardKind | null {
  const s = (series ?? "").trim().toUpperCase();
  if (s === "SME" || s === "SM" || s === "ST" || s === "EMERGE") return "sme";
  if (s === "EQ") return "main";
  return null;
}

function fromCurrent(row: NseCurrent, bucket: IpoIssue["bucket"], hint?: IpoBoardKind): IpoIssue | null {
  const symbol = (row.symbol ?? "").trim().toUpperCase();
  const name = (row.companyName ?? "").trim();
  if (!symbol && !name) return null;
  const board = boardFromSeries(row.series) ?? hint ?? null;
  if (!board) return null;
  return {
    id: `${board}-${bucket}-${symbol || name}`,
    board,
    symbol: symbol || "—",
    name: name || symbol,
    series: row.series ?? null,
    status: row.status ?? null,
    price: row.issuePrice ?? null,
    start: row.issueStartDate ?? null,
    end: row.issueEndDate ?? null,
    listing: null,
    shares: num(row.issueSize),
    subscribed: num(row.noOfTime),
    bucket,
  };
}

function fromPast(row: NsePast): IpoIssue | null {
  const symbol = (row.symbol ?? "").trim().toUpperCase();
  const name = (row.company ?? row.companyName ?? "").trim();
  if (!symbol && !name) return null;
  const board = boardFromSeries(row.securityType);
  if (!board) return null;
  const price = row.priceRange && row.priceRange !== "-" ? row.priceRange : row.issuePrice;
  return {
    id: `${board}-recent-${symbol || name}`,
    board,
    symbol: symbol || "—",
    name: name || symbol,
    series: row.securityType ?? null,
    status: "Closed",
    price: price && price !== "-" ? price : null,
    start: row.ipoStartDate ?? null,
    end: row.ipoEndDate ?? null,
    listing: row.listingDate && row.listingDate !== "-" ? row.listingDate : null,
    shares: null,
    subscribed: null,
    bucket: "recent",
  };
}

function parseIssueDay(raw: string | null): number {
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function isOpenStatus(status: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "active" || s === "open" || s.includes("open");
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sleeveFrom(
  current: IpoIssue[],
  upcomingAll: IpoIssue[],
  past: IpoIssue[],
  board: IpoBoardKind,
): IpoSleeve {
  const cur = current.filter((row) => row.board === board);
  const up = upcomingAll.filter((row) => row.board === board);
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const today = startOfToday();

  const openMap = new Map<string, IpoIssue>();
  for (const row of cur) {
    if (isOpenStatus(row.status) || !row.status) openMap.set(row.symbol, { ...row, bucket: "open" });
  }
  for (const row of up) {
    if (isOpenStatus(row.status) && !openMap.has(row.symbol)) {
      openMap.set(row.symbol, { ...row, bucket: "open", id: `${board}-open-${row.symbol}` });
    }
  }
  for (const row of past.filter((r) => r.board === board)) {
    const end = parseIssueDay(row.end);
    if (end >= today && !row.listing && !openMap.has(row.symbol)) {
      openMap.set(row.symbol, { ...row, bucket: "open", status: "Active", id: `${board}-open-${row.symbol}` });
    }
  }
  const open = [...openMap.values()];
  const openSyms = new Set(open.map((row) => row.symbol));
  const upcoming = up.filter((row) => !openSyms.has(row.symbol) && !isOpenStatus(row.status));
  const recent = past
    .filter((row) => row.board === board && !openSyms.has(row.symbol))
    .filter((row) => {
      const day = parseIssueDay(row.end) || parseIssueDay(row.start);
      return day === 0 || day >= cutoff;
    })
    .sort((a, b) => (parseIssueDay(b.end) || parseIssueDay(b.start)) - (parseIssueDay(a.end) || parseIssueDay(a.start)))
    .slice(0, 40);

  return { open, upcoming, recent };
}

export async function fetchNseIpoBook(): Promise<IpoBook> {
  const cookie = await nseSession();
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const pastPath = `/api/public-past-issues?from=${dmy(from)}&to=${dmy(to)}`;

  const [currentRaw, upcomingMainRaw, upcomingSmeRaw, pastRaw] = await Promise.all([
    nseJson<unknown>("/api/ipo-current-issue", cookie).catch(() => []),
    nseJson<unknown>("/api/all-upcoming-issues?category=ipo", cookie).catch(() => []),
    nseJson<unknown>("/api/all-upcoming-issues?category=sme", cookie).catch(() => []),
    nseJson<unknown>(pastPath, cookie).catch(() => []),
  ]);

  const current = asList<NseCurrent>(currentRaw)
    .map((row) => fromCurrent(row, "open"))
    .filter((row): row is IpoIssue => row != null);
  const upcomingMain = asList<NseCurrent>(upcomingMainRaw)
    .map((row) => fromCurrent(row, "upcoming", "main"))
    .filter((row): row is IpoIssue => row != null);
  const upcomingSme = asList<NseCurrent>(upcomingSmeRaw)
    .map((row) => fromCurrent(row, "upcoming", "sme"))
    .filter((row): row is IpoIssue => row != null);
  const past = asList<NsePast>(pastRaw)
    .map(fromPast)
    .filter((row): row is IpoIssue => row != null);

  const upcomingAll = [...upcomingMain, ...upcomingSme];
  const main = sleeveFrom(current, upcomingAll, past, "main");
  const sme = sleeveFrom(current, upcomingAll, past, "sme");

  if (
    !main.open.length &&
    !main.upcoming.length &&
    !main.recent.length &&
    !sme.open.length &&
    !sme.upcoming.length &&
    !sme.recent.length
  ) {
    return {
      asOf: new Date().toISOString(),
      main: emptySleeve(),
      sme: emptySleeve(),
      error: "No IPO tape",
    };
  }

  return {
    asOf: new Date().toISOString(),
    main,
    sme,
  };
}

export function sleeveCounts(sleeve: IpoSleeve) {
  return `${sleeve.open.length} open · ${sleeve.upcoming.length} upcoming · ${sleeve.recent.length} recent`;
}
