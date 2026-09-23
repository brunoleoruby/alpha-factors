import type { IpoBoardKind, IpoBook, IpoIssue, IpoSleeve } from "@/lib/markets/nse-ipo";

export type ChittorSub = {
  name: string;
  nse: string | null;
  live: boolean;
  close: string | null;
  open: string | null;
  listing: string | null;
  price: string | null;
  qib: number | null;
  nii: number | null;
  retail: number | null;
  total: number | null;
  applications: string | null;
  asOn: string | null;
  slug: string | null;
  ipoId: number | null;
  sector: string | null;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function istNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function fyLabel(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m >= 4) return `${y}-${String(y + 1).slice(2)}`;
  return `${y - 1}-${String(y).slice(2)}`;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function companyName(html: string) {
  return stripTags(html).replace(/\s+(O|CT|P|LT)$/i, "").trim();
}

export function nameKey(raw: string) {
  return raw
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/\b(limited|ltd\.?|pvt\.?|private|ipo)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function isLive(companyHtml: string, highlight: unknown) {
  if (/\b(O|CT)<\/span>/i.test(companyHtml)) return true;
  return String(highlight ?? "").includes("green");
}

type RawRow = {
  Company?: string;
  "~id"?: number | string;
  "~nse_symbol"?: string;
  "~URLRewrite_Folder_Name"?: string;
  "~Highlight_Row"?: string;
  "~Issue_Close_Date"?: string;
  "~Issue_Open_Date"?: string;
  "Closing Date"?: string;
  "Opening Date"?: string;
  "Listing Date"?: string;
  "Issue Price (Rs.)"?: string;
  "~ListingDate"?: string;
  "QIB (x)"?: unknown;
  "NII (x)"?: unknown;
  "Retail (x)"?: unknown;
  "Total (x)"?: unknown;
  Applications?: string;
  "Subscription as on"?: string;
};

function parseStamp(raw: string | null): number {
  if (!raw) return 0;
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

function startIstToday() {
  const d = istNow();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function priceOf(row: RawRow) {
  const v = (row["Issue Price (Rs.)"] ?? "").trim();
  return v && v !== "-" ? v : null;
}

function listingOf(row: RawRow) {
  const iso = (row["~ListingDate"] ?? "").trim();
  if (iso && iso !== "-") return iso.slice(0, 10);
  const label = (row["Listing Date"] ?? "").trim();
  return label && label !== "-" ? label : null;
}

function decodeHtml(raw: string) {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const sectorCache = new Map<number, string>();
let industryCache: { at: number; map: Record<string, string> } | null = null;

function grab(html: string, headers: Record<string, string>) {
  return fetch(html, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
}

async function industryMap(): Promise<Record<string, string>> {
  if (industryCache && Date.now() - industryCache.at < 12 * 60 * 60 * 1000) return industryCache.map;
  try {
    const res = await grab("https://www.chittorgarh.com/report/sector-wise-ipo-list-in-india/96/", {
      Accept: "text/html",
      "User-Agent": UA,
    });
    if (!res.ok) return industryCache?.map ?? {};
    const html = await res.text();
    const out: Record<string, string> = {};
    for (const m of html.matchAll(/<option[^>]*value="(\d+)"[^>]*>([^<]+)/gi)) {
      const label = decodeHtml(m[2]);
      if (!label || /^select/i.test(label)) continue;
      out[m[1]] = label;
    }
    industryCache = { at: Date.now(), map: out };
    return out;
  } catch {
    return industryCache?.map ?? {};
  }
}

function parseSector(html: string, map: Record<string, string>): string | null {
  const listed = html.match(/Recently Listed IPOs in ([^<]{2,80})/i);
  if (listed) return decodeHtml(listed[1]);
  const id =
    html.match(/industry\\":\\"(\d+)/) ??
    html.match(/"industry"\s*:\s*"(\d+)"/) ??
    html.match(/industry\\":(\d+)/);
  if (id?.[1] && map[id[1]]) return map[id[1]];
  return null;
}

async function sectorFromPage(slug: string, ipoId: number, map: Record<string, string>): Promise<string | null> {
  const hit = sectorCache.get(ipoId);
  if (hit) return hit;
  try {
    const res = await grab(`https://www.chittorgarh.com/ipo/${slug}/${ipoId}/`, {
      Accept: "text/html",
      "User-Agent": UA,
      Referer: "https://www.chittorgarh.com/",
    });
    if (!res.ok) return null;
    const sector = parseSector(await res.text(), map);
    if (sector) sectorCache.set(ipoId, sector);
    return sector;
  } catch {
    return null;
  }
}

async function mapPool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
}

async function fillSectors(rows: ChittorSub[]): Promise<ChittorSub[]> {
  const map = await industryMap();
  const need = rows.filter((row) => row.slug && row.ipoId && !row.sector);
  await mapPool(need, 10, async (row) => {
    row.sector = await sectorFromPage(row.slug!, row.ipoId!, map);
  });
  return rows;
}

function hrefMeta(html: string) {
  const m = html.match(/\/ipo\/([^/"']+)\/(\d+)/i);
  const ipoId = m?.[2] ? Number(m[2]) : NaN;
  return {
    slug: m?.[1] ?? null,
    ipoId: Number.isFinite(ipoId) ? ipoId : null,
  };
}

function mergeBook(primary: ChittorSub[], extra: ChittorSub[]) {
  const byKey = new Map(extra.map((row) => [nameKey(row.name), row]));
  const merged = primary.map((row) => {
    const cal = byKey.get(nameKey(row.name));
    if (!cal) return row;
    return {
      ...row,
      nse: row.nse || cal.nse,
      open: row.open || cal.open,
      close: row.close || cal.close,
      listing: row.listing || cal.listing,
      price: row.price || cal.price,
      slug: row.slug || cal.slug,
      ipoId: row.ipoId || cal.ipoId,
    };
  });
  const seen = new Set(merged.map((row) => nameKey(row.name)));
  return [...merged, ...extra.filter((row) => !seen.has(nameKey(row.name)))];
}

async function readCalendar(board: IpoBoardKind): Promise<ChittorSub[]> {
  const d = istNow();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const fy = fyLabel(d);
  const sleeve = board === "sme" ? "sme" : "mainboard";
  const url = `https://webnodejs.chittorgarh.com/cloud/report/data-read/82/1/${month}/${year}/${fy}/0/${sleeve}/0?search=`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
      Origin: "https://www.chittorgarh.com",
      Referer: "https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`chittor cal ${board} ${res.status}`);
  const body = (await res.json()) as { reportTableData?: RawRow[] };
  return (body.reportTableData ?? [])
    .map((row) => {
      const html = row.Company ?? "";
      const name = companyName(html);
      if (!name) return null;
      const href = hrefMeta(html);
      const idRaw = row["~id"];
      const fromField = typeof idRaw === "number" ? idRaw : Number(idRaw);
      const ipoId = Number.isFinite(fromField) ? fromField : href.ipoId;
      return {
        name,
        nse: (row["~nse_symbol"] ?? "").trim().toUpperCase() || null,
        live: false,
        close: row["Closing Date"] ?? null,
        open: row["~Issue_Open_Date"] ?? row["Opening Date"] ?? null,
        listing: listingOf(row),
        price: priceOf(row),
        qib: null,
        nii: null,
        retail: null,
        total: null,
        applications: null,
        asOn: null,
        slug: (row["~URLRewrite_Folder_Name"] ?? "").trim() || href.slug,
        ipoId,
        sector: null,
      } satisfies ChittorSub;
    })
    .filter((row): row is ChittorSub => row != null);
}

async function readBoard(board: IpoBoardKind): Promise<ChittorSub[]> {
  const d = istNow();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const fy = fyLabel(d);
  const sleeve = board === "sme" ? "sme" : "mainboard";
  const stamp = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const url = `https://webnodejs.chittorgarh.com/cloud/report/data-read/21/1/${month}/${year}/${fy}/0/${sleeve}/0?search=&v=${stamp}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
      Origin: "https://www.chittorgarh.com",
      Referer: "https://www.chittorgarh.com/report/live-ipo-subscription/21/",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`chittor ${board} ${res.status}`);
  const body = (await res.json()) as { reportTableData?: RawRow[] };
  return (body.reportTableData ?? [])
    .map((row) => {
      const html = row.Company ?? "";
      const name = companyName(html);
      if (!name) return null;
      const idRaw = row["~id"];
      const ipoId = typeof idRaw === "number" ? idRaw : Number(idRaw);
      return {
        name,
        nse: (row["~nse_symbol"] ?? "").trim().toUpperCase() || null,
        live: isLive(html, row["~Highlight_Row"]),
        close: row["Closing Date"] ?? null,
        open: row["~Issue_Open_Date"] ?? row["Opening Date"] ?? null,
        listing: listingOf(row),
        price: priceOf(row),
        qib: num(row["QIB (x)"]),
        nii: num(row["NII (x)"]),
        retail: num(row["Retail (x)"]),
        total: num(row["Total (x)"]),
        applications: row.Applications ?? null,
        asOn: row["Subscription as on"] ?? null,
        slug: (row["~URLRewrite_Folder_Name"] ?? "").trim() || null,
        ipoId: Number.isFinite(ipoId) ? ipoId : null,
        sector: null,
      } satisfies ChittorSub;
    })
    .filter((row): row is ChittorSub => row != null);
}

let subsCache: { at: number; main: ChittorSub[]; sme: ChittorSub[] } | null = null;

export async function fetchChittorSubs() {
  if (subsCache && Date.now() - subsCache.at < 45_000) return subsCache;
  const [main, sme, mainCal, smeCal] = await Promise.all([
    readBoard("main").catch(() => []),
    readBoard("sme").catch(() => []),
    readCalendar("main").catch(() => []),
    readCalendar("sme").catch(() => []),
  ]);
  subsCache = { at: Date.now(), main: mergeBook(main, mainCal), sme: mergeBook(sme, smeCal) };
  return subsCache;
}

function toIssue(item: ChittorSub, board: IpoBoardKind, bucket: IpoIssue["bucket"]): IpoIssue {
  return {
    id: `${board}-${bucket}-${nameKey(item.name) || item.name}`,
    board,
    symbol: item.nse || "—",
    name: item.name,
    series: board === "sme" ? "SME" : "EQ",
    status: bucket === "open" ? "Active" : bucket === "upcoming" ? "Forthcoming" : "Closed",
    price: item.price,
    start: item.open,
    end: item.close,
    listing: item.listing,
    shares: null,
    subscribed: item.total,
    qib: item.qib,
    nii: item.nii,
    retail: item.retail,
    applications: item.applications,
    subAsOn: item.asOn,
    sector: item.sector,
    bucket,
  };
}

function sleeveFromBook(book: ChittorSub[], board: IpoBoardKind): IpoSleeve {
  const today = startIstToday();
  const cutoff = today - 90 * 24 * 60 * 60 * 1000;
  const open: ChittorSub[] = [];
  const upcoming: ChittorSub[] = [];
  const recent: ChittorSub[] = [];
  const seen = new Set<string>();
  for (const row of book) {
    const key = nameKey(row.name);
    if (!key || seen.has(key)) continue;
    const openDay = parseStamp(row.open);
    const closeDay = parseStamp(row.close);
    const inWindow = openDay > 0 && closeDay > 0 && openDay <= today && closeDay >= today;
    if (row.live || inWindow) {
      seen.add(key);
      open.push(row);
      continue;
    }
    if (openDay > today) {
      seen.add(key);
      upcoming.push(row);
      continue;
    }
    const day = closeDay || openDay;
    if (day >= cutoff) {
      seen.add(key);
      recent.push(row);
    }
  }
  recent.sort((a, b) => parseStamp(b.close) - parseStamp(a.close));
  return {
    open: open.map((row) => toIssue(row, board, "open")),
    upcoming: upcoming.map((row) => toIssue(row, board, "upcoming")),
    recent: recent.slice(0, 40).map((row) => toIssue(row, board, "recent")),
  };
}

function sectorTargets(sleeve: IpoSleeve, book: ChittorSub[], recent: boolean) {
  const openKeys = new Set([...sleeve.open, ...sleeve.upcoming].map((row) => nameKey(row.name)));
  const recentKeys = recent ? new Set(sleeve.recent.slice(0, 16).map((row) => nameKey(row.name))) : new Set<string>();
  return book.filter((row) => {
    const k = nameKey(row.name);
    return row.live || openKeys.has(k) || recentKeys.has(k);
  });
}

function paintCached(book: ChittorSub[]) {
  for (const row of book) {
    if (row.sector || !row.ipoId) continue;
    const hit = sectorCache.get(row.ipoId);
    if (hit) row.sector = hit;
  }
}

function withSectors(sleeve: IpoSleeve, book: ChittorSub[]): IpoSleeve {
  const byName = new Map(book.filter((row) => row.sector).map((row) => [nameKey(row.name), row.sector]));
  const paint = (row: IpoIssue): IpoIssue => ({
    ...row,
    sector: byName.get(nameKey(row.name)) ?? row.sector,
  });
  return {
    open: sleeve.open.map(paint),
    upcoming: sleeve.upcoming.map(paint),
    recent: sleeve.recent.map(paint),
  };
}

async function attachSectors(sleeve: IpoSleeve, book: ChittorSub[], recent: boolean): Promise<IpoSleeve> {
  await fillSectors(sectorTargets(sleeve, book, recent));
  return withSectors(sleeve, book);
}

export async function fetchChittorIpoBook(opts?: { scrape?: boolean }): Promise<IpoBook> {
  const chittor = await fetchChittorSubs();
  paintCached(chittor.main);
  paintCached(chittor.sme);
  let main = sleeveFromBook(chittor.main, "main");
  let sme = sleeveFromBook(chittor.sme, "sme");
  if (opts?.scrape) {
    [main, sme] = await Promise.all([
      attachSectors(main, chittor.main, false),
      attachSectors(sme, chittor.sme, false),
    ]);
  } else {
    main = withSectors(main, chittor.main);
    sme = withSectors(sme, chittor.sme);
  }
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
      main: { open: [], upcoming: [], recent: [] },
      sme: { open: [], upcoming: [], recent: [] },
      error: "No IPO tape",
    };
  }
  return {
    asOf: new Date().toISOString(),
    main,
    sme,
  };
}
