import { computeLiveSignals, type LiveSignals } from "@/lib/markets/compute-live-signals";
import { dowForMarket } from "@/lib/markets/dow-theory";
import { fetchEnvironmentQuotes } from "@/lib/markets/environment-quotes";
import { bestCalendarYear, sectorsFor, type SectorMarket } from "@/lib/markets/sector-returns";
import { formatInrFine, formatPct } from "@/lib/format";
import { readPositionFile } from "@/lib/portfolio/store";

export type JournalSnapshot = {
  n: number;
  open: number;
  killed: number;
  survived: number;
};

const DESK_MAP =
  "Whole desk, not only sector analysis. US dashboard / · US pattern desk /desk · US Top 50 /stocks · NSE pattern desk /nse · Nifty 50 /nse/stocks · Market environment /environment · Portfolio /portfolio · Time frame /timeframe · Sector analysis /sector · IPO /ipo. Ask any of those.";

function inferMarket(text: string, fallback: SectorMarket): SectorMarket {
  const q = text.toLowerCase();
  if (/\b(nse|nifty|india|bank nifty|india vix)\b/.test(q)) return "NSE";
  if (/\b(us|usa|s&p|spy|nasdaq|xle|xlk)\b/.test(q)) return "US";
  return fallback;
}

function methodNote(q: string) {
  if (/antonacci|absolute|gate|dual momentum/.test(q)) {
    return "Antonacci dual momentum: rank sectors on relative strength, but if the index 12-month return is negative, the book is cash. That gate is what cuts crash drawdowns.";
  }
  if (/moskowitz|grinblatt|6-month|skip/.test(q)) {
    return "Moskowitz–Grinblatt industry momentum: rank sectors on the past ~6 months. This desk skips the last 21 sessions (Jegadeesh–Titman) then measures 126 sessions.";
  }
  if (/vix|overlay|defensive/.test(q)) {
    return "India VIX / Cboe VIX overlay: below 20 keep cyclicals; above 25 switch the hold list to the strongest defensives (Pharma, FMCG, staples, health, utilities).";
  }
  if (/dow|confirm|hamilton|rhea/.test(q)) {
    return "Dow Theory here: year-end peaks and troughs, pair confirmation (Bank+Auto on NSE, Industrials+Energy on US), and a primary that stays until a previous peak or floor is taken out. It is a structure read, not the 6-month book.";
  }
  if (/wyckoff|phase|accumulation|distribution/.test(q)) {
    return "Phases on this desk reuse Wyckoff names on yearly closes: accumulation, participation, distribution, markdown, or a Dow line.";
  }
  return null;
}

function navNote(q: string) {
  if (/portfolio|blotter/.test(q)) return "Portfolio is the top-header tab. Enter fills there; Save in the header writes the book.";
  if (/time ?frame|journal/.test(q)) return "Time frame is the header tab for dated journal notes. Save is explicit, same as Portfolio.";
  if (/environment|vix|nifty 50 tab/.test(q) && /environment/.test(q)) {
    return "Market environment is the header tab for index, vol, FX, and crude quotes.";
  }
  if (/nifty ?50|top 50|all stocks/.test(q)) {
    return "Open NSE then the Nifty 50 pill, or US then Top 50. Those lists are under each market, not in the top bar.";
  }
  if (/sector/.test(q) && /where|open|tab/.test(q)) return "Sector analysis is in the top header. Live book is at the top of that page; Dow and 2021 history sit below.";
  if (/\bipo\b/.test(q) && /where|open|tab/.test(q)) return "IPO is in the top header. Open, upcoming, and recent NSE issues.";
  return null;
}

function liveReply(book: LiveSignals) {
  const gate = book.absMom == null ? "unread" : formatPct(book.absMom);
  const vix = book.vix == null ? "unread" : book.vix.toFixed(2);
  const hold = book.hold.length ? book.hold.join(", ") : "cash";
  const leaders = book.ranked
    .filter((r) => r.rank > 0)
    .slice(0, 3)
    .map((r) => `${r.sector} ${r.mom6 == null ? "" : formatPct(r.mom6)}`)
    .join("; ");
  return [
    `${book.market} required book.`,
    `12-month gate (${book.benchmark}): ${book.riskOn ? "risk on" : "cash"} at ${gate}.`,
    `Vol (${book.vixYahoo}): ${vix} · ${book.regime ?? "unread"}.`,
    `Hold: ${hold}.`,
    book.note,
    leaders ? `Top 6-month skip-month prints: ${leaders}.` : "",
    "Not a recommendation.",
  ]
    .filter(Boolean)
    .join(" ");
}

function dowReply(market: SectorMarket) {
  const dow = dowForMarket(market);
  const longs = dow.sectors.filter((s) => s.stance === "long").map((s) => s.sector);
  const key = dow.keyPair
    ? `${dow.keyPair.a} / ${dow.keyPair.b}: ${dow.keyPair.confirmed ? "confirmed" : "divergent"}`
    : "no key pair";
  return `${market} Dow reading: ${dow.regime}. ${dow.regimeNote} ${key}. Breadth ${dow.bullCount} bull / ${dow.bearCount} bear / ${dow.mixedCount} open.${longs.length ? ` Stance long: ${longs.join(", ")}.` : ""} Yearly structure, not the live 6-month book.`;
}

function historyReply(market: SectorMarket) {
  const rows = sectorsFor(market);
  const spike = bestCalendarYear(rows);
  const top = rows[0];
  const bottom = rows[rows.length - 1];
  return `${market} since 2021 (desk reference, not live): ${top.sector} leads at ${formatPct(top.cumulative)} CAGR ${formatPct(top.cagr)}. Weakest is ${bottom.sector} at ${formatPct(bottom.cumulative)}. Hottest calendar year: ${spike.sector} ${spike.year}${spike.year === 2026 ? " YTD" : ""} ${formatPct(spike.ret)}.`;
}

async function portfolioReply() {
  const book = await readPositionFile();
  if (!book.positions.length) {
    return "Portfolio blotter is empty. Open Portfolio, import a P&L or enter names, then header Save. Unrealized is ignored; the book is realized plus costs.";
  }
  const realized = book.positions.reduce((sum, row) => sum + row.realizedPnl, 0);
  const open = book.positions.filter((row) => Math.abs(row.openQty) > 1e-12).length;
  const names = new Set(book.positions.map((row) => row.symbol)).size;
  return [
    `Portfolio: ${names} names, ${open} still open.`,
    `Realized ${formatInrFine(realized)}.`,
    "Unrealized is not the score. Open Portfolio to edit; Save writes the file.",
  ].join(" ");
}

async function environmentReply() {
  const { quotes } = await fetchEnvironmentQuotes();
  const pick = (id: string) => quotes.find((q) => q.id === id);
  const line = (id: string, label: string) => {
    const q = pick(id);
    if (!q || q.last == null) return `${label} unread`;
    const pct = q.changePct == null ? "" : ` ${formatPct(q.changePct)}`;
    return `${label} ${q.last}${pct}`;
  };
  return [
    "Market environment (live quotes).",
    line("nifty", "Nifty"),
    line("banknifty", "Bank Nifty"),
    line("indiavix", "India VIX"),
    line("spx", "S&P"),
    line("vix", "VIX"),
    line("wti", "WTI"),
    line("usdinr", "USDINR"),
    "Full tape is under Market environment.",
  ].join(" ");
}

function journalReply(journal?: JournalSnapshot) {
  if (!journal || journal.n === 0) {
    return "Time frame journal is empty on this browser. Open Time frame, add a dated note, then Save.";
  }
  return `Time frame journal: ${journal.n} notes · ${journal.open} open · ${journal.killed} killed · ${journal.survived} survived. Open Time frame to edit. Save is explicit.`;
}

const SYSTEM = `You are the Eminent Corpus desk assistant for the whole app: US/NSE desks, Nifty 50 / Top 50, market environment, portfolio blotter, time-frame journal, sector analysis, and IPO. Answer only from the snapshot JSON. Be concise. Never invent prices or P&L. End with "Not a recommendation" when you discuss holdings.`;

async function polishWithLlm(question: string, snapshot: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Snapshot:\n${snapshot}\n\nQuestion: ${question}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export async function runDeskAgent(input: {
  message: string;
  market?: SectorMarket;
  journal?: JournalSnapshot;
}) {
  const q = input.message.trim();
  const market = inferMarket(q, input.market === "US" ? "US" : "NSE");
  const lower = q.toLowerCase();
  const method = methodNote(lower);
  const nav = navNote(lower);
  const wantHelp = /help|what can you|which (tab|desk)|only sector|whole (app|desk)|desk map|what do you cover/.test(
    lower,
  );
  const wantPortfolio = /portfolio|blotter|p&l|pnl|position|zerodha|fyers|unrealized|realized/.test(lower);
  const wantEnv = /environment|crude|brent|wti|gold|usd\/?inr|dxy|quote tape/.test(lower);
  const wantJournal = /time ?frame|journal|trial|killed|survived|t-stat/.test(lower);
  const wantDow = /dow|confirm|primary|hh|hl|phase|structure/.test(lower);
  const wantHist = /2021|cagr|who paid|histor|since 2021/.test(lower);
  const otherDesk = wantHelp || wantPortfolio || wantEnv || wantJournal || Boolean(nav);
  const wantLive =
    /(?:required )?book|hold|cash|risk on|momentum|12-month gate|sector analysis|vix overlay/.test(lower) ||
    (!method && !otherDesk && !wantDow && !wantHist);

  const used: string[] = [];
  const parts: string[] = [];
  let live: LiveSignals | null = null;

  if (wantHelp) {
    used.push("map");
    parts.push(DESK_MAP);
  }
  if (wantPortfolio) {
    used.push("portfolio");
    parts.push(await portfolioReply());
  }
  if (wantEnv) {
    used.push("environment");
    try {
      parts.push(await environmentReply());
    } catch {
      parts.push("Quote feed is down. Open Market environment.");
    }
  }
  if (wantJournal) {
    used.push("journal");
    parts.push(journalReply(input.journal));
  }

  if (wantLive) {
    try {
      live = await computeLiveSignals(market);
      used.push("live_book");
      parts.push(liveReply(live));
    } catch {
      parts.push("Live sector feed is down. Open Sector analysis in a moment.");
    }
  }

  if (wantDow) {
    used.push("dow");
    parts.push(dowReply(market));
  }
  if (wantHist) {
    used.push("history");
    parts.push(historyReply(market));
  }
  if (method) {
    used.push("method");
    parts.push(method);
  }
  if (nav && !wantPortfolio && !wantJournal && !wantEnv) {
    used.push("nav");
    parts.push(nav);
  }

  if (!parts.length) {
    used.push("map");
    parts.push(DESK_MAP);
  }

  const grounded = parts.join("\n\n");
  const snapshot = JSON.stringify({
    market,
    desks: DESK_MAP,
    live: live
      ? {
          riskOn: live.riskOn,
          absMom: live.absMom,
          vix: live.vix,
          regime: live.regime,
          hold: live.hold,
          note: live.note,
          top: live.ranked.slice(0, 5).map((r) => ({ sector: r.sector, mom6: r.mom6, inBook: r.inBook })),
        }
      : null,
    method,
    nav,
    journal: input.journal ?? null,
  });
  const llm = await polishWithLlm(q, snapshot);
  return {
    market,
    tools: used,
    llm: Boolean(llm),
    reply: llm ?? grounded,
  };
}
