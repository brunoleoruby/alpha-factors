import { buildThemeIndex, type ThemeIndex } from "@/lib/markets/capped-mcap-index";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TOTAL_MARKET =
  "https://nsearchives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv";

/** IICS Sector (CSV “Industry”) → Macro-Economic Sector. Majority-of-revenue map. */
const MACRO_BY_SECTOR: Record<string, string> = {
  Chemicals: "Commodities",
  "Construction Materials": "Commodities",
  "Forest Materials": "Commodities",
  "Metals & Mining": "Commodities",
  "Automobile and Auto Components": "Consumer Discretionary",
  "Consumer Durables": "Consumer Discretionary",
  "Consumer Services": "Consumer Discretionary",
  "Media Entertainment & Publication": "Consumer Discretionary",
  Realty: "Consumer Discretionary",
  Textiles: "Consumer Discretionary",
  "Oil Gas & Consumable Fuels": "Energy",
  "Fast Moving Consumer Goods": "Fast Moving Consumer Goods",
  "Financial Services": "Financial Services",
  Healthcare: "Healthcare",
  "Capital Goods": "Industrials",
  Construction: "Industrials",
  Defence: "Industrials",
  AI: "Information Technology",
  Transformers: "Industrials",
  "Solar energy": "Utilities",
  "Cloud storage": "Information Technology",
  "EV vehicles": "Consumer Discretionary",
  Insurance: "Financial Services",
  Jewellery: "Consumer Discretionary",
  Mining: "Commodities",
  Sugar: "Fast Moving Consumer Goods",
  "Information Technology": "Information Technology",
  Services: "Services",
  Telecommunication: "Telecommunication",
  Power: "Utilities",
  Utilities: "Utilities",
  Diversified: "Diversified",
};

const DEFENCE_LINE: Record<string, string> = {
  HAL: "Aerospace",
  UNIMECH: "Aerospace",
  TANEJAERO: "Aerospace",
  BEL: "Defence electronics",
  DATAPATTNS: "Defence electronics",
  ASTRAMICRO: "Defence electronics",
  AXISCADES: "Defence electronics",
  APOLLO: "Defence electronics",
  DCXINDIA: "Defence electronics",
  NIBE: "Defence electronics",
  BDL: "Missiles & munitions",
  SOLARINDS: "Missiles & munitions",
  PREMEXPLN: "Missiles & munitions",
  MAZDOCK: "Shipbuilding",
  GRSE: "Shipbuilding",
  COCHINSHIP: "Shipbuilding",
  BEML: "Land systems",
  MIDHANI: "Special materials",
  MTARTECH: "Special materials",
  BHARATFORG: "Forgings",
  ZENTEC: "Training & simulation",
  IDEAFORGE: "Training & simulation",
  PARAS: "Space & electro-optics",
  CYIENTDLM: "Defence manufacturing",
  DYNAMATECH: "Defence manufacturing",
};

const AI_LINE: Record<string, string> = {
  E2E: "GPU cloud",
  NETWEB: "AI servers",
  LATENTVIEW: "Data analytics",
  NEWGEN: "Enterprise AI software",
  INTELLECT: "Enterprise AI software",
  AURIONPRO: "Enterprise AI software",
  NUCLEUS: "Enterprise AI software",
  RAMCOSYS: "Enterprise AI software",
  SUBEX: "Enterprise AI software",
  HAPPSTMNDS: "Digital / AI services",
  PERSISTENT: "Digital / AI services",
  MASTEK: "Digital / AI services",
  BIRLASOFT: "Digital / AI services",
  COFORGE: "Digital / AI services",
  AFFLE: "AI advertising",
  RATEGAIN: "Travel AI",
  MAPMYINDIA: "Geospatial AI",
  TATATECH: "Engineering software",
  LTTS: "Engineering software",
  KPITTECH: "Engineering software",
  TATAELXSI: "Engineering software",
  CYIENT: "Engineering software",
  SASKEN: "Engineering software",
  MOSCHIP: "Semiconductors",
};

const TRANSFORMER_LINE: Record<string, string> = {
  TARIL: "Power transformers",
  VOLTAMP: "Power transformers",
  INDOTECH: "Power transformers",
  SHILCHAR: "Power transformers",
  MARSONS: "Distribution transformers",
  ATLANTAELE: "Power transformers",
  POWERINDIA: "Grid / HV equipment",
  CGPOWER: "Grid / HV equipment",
  SCHNEIDER: "Grid / HV equipment",
  PITTIENG: "Laminations",
  PRECWIRE: "Winding wire",
};

const SOLAR_LINE: Record<string, string> = {
  ADANIGREEN: "Solar generation",
  NTPCGREEN: "Solar generation",
  ACMESOLAR: "Solar generation",
  KPIGREEN: "Solar generation",
  WAAREEENER: "Solar modules",
  PREMIERENE: "Solar modules",
  VIKRAMSOLR: "Solar modules",
  EMMVEE: "Solar modules",
  WEBELSOLAR: "Solar cells",
  SWELECTES: "Solar modules",
  BORORENEW: "Solar glass",
  SWSOLAR: "Solar EPC",
  GENSOL: "Solar EPC",
  UJAAS: "Solar generation",
  SURANASOL: "Solar modules",
  SAATVIK: "Solar modules",
};

const CLOUD_LINE: Record<string, string> = {
  SIFY: "Data centres",
  ANANTRAJ: "Data centres",
  TATACOMM: "Cloud connectivity",
  RAILTEL: "Cloud connectivity",
  BBOX: "Digital infrastructure",
  ITI: "Digital infrastructure",
  INFOBEAN: "Cloud software",
  DATAMATICS: "Cloud software",
};

const EV_LINE: Record<string, string> = {
  OLAELEC: "Electric two-wheelers",
  ATHERENERG: "Electric two-wheelers",
  OLECTRA: "Electric buses",
  JBMA: "Electric buses",
  ATULAUTO: "Electric three-wheelers",
  GREAVESCOT: "Electric last-mile",
  EXICOM: "EV charging",
  SERVOTECH: "EV charging",
  "ARE&M": "EV batteries",
  HBLENGINE: "EV batteries",
  HBLPOWER: "EV batteries",
};

const INSURANCE_LINE: Record<string, string> = {
  LICI: "Life insurance",
  HDFCLIFE: "Life insurance",
  SBILIFE: "Life insurance",
  ICICIPRULI: "Life insurance",
  MFSL: "Life insurance",
  CANHLIFE: "Life insurance",
  ICICIGI: "General insurance",
  NIACL: "General insurance",
  GODIGIT: "General insurance",
  STARHEALTH: "Health insurance",
  NIVABUPA: "Health insurance",
  GICRE: "Reinsurance",
  POLICYBZR: "Insurance distribution",
};

const JEWELLERY_LINE: Record<string, string> = {
  TITAN: "Jewellery retail",
  KALYANKJIL: "Jewellery retail",
  SENCO: "Jewellery retail",
  THANGAMAYL: "Jewellery retail",
  TBZ: "Jewellery retail",
  PCJEWELLER: "Jewellery retail",
  PNGJL: "Jewellery retail",
  DPABHUSHAN: "Jewellery retail",
  MOTISONS: "Jewellery retail",
  RAJESHEXPO: "Gems & diamonds",
  GOLDIAM: "Gems & diamonds",
  SKYGOLD: "Jewellery manufacturing",
  RADHIKA: "Jewellery manufacturing",
};

const MINING_LINE: Record<string, string> = {
  COALINDIA: "Coal",
  NLCINDIA: "Coal",
  NMDC: "Iron ore",
  KIOCL: "Iron ore",
  SANDUMA: "Iron ore",
  HINDZINC: "Base metals mining",
  VEDL: "Base metals mining",
  HINDCOPPER: "Base metals mining",
  GMDC: "Minerals",
  MOIL: "Minerals",
  ASHAPURMIN: "Minerals",
  "20MICRONS": "Minerals",
};

const SUGAR_LINE: Record<string, string> = {
  BALRAMCHIN: "Sugar mills",
  EIDPARRY: "Sugar mills",
  BAJAJHIND: "Sugar mills",
  DHAMPUR: "Sugar mills",
  DALMIASUG: "Sugar mills",
  TRIVENI: "Sugar mills",
  DWARKESH: "Sugar mills",
  UTTAMSUGAR: "Sugar mills",
  AVADHSUGAR: "Sugar mills",
  SHRENUKA: "Sugar mills",
  MAGADHSUGAR: "Sugar mills",
  DHAMPURSUG: "Sugar mills",
  RAJSHREESUG: "Sugar mills",
  KMSUGAR: "Sugar mills",
  RANASUG: "Sugar mills",
  PONNIERODE: "Sugar mills",
  VISHWARAJ: "Sugar mills",
};

export const THEME_INDEXES = [
  { industry: "Defence", id: "ec-defence-15", name: "EC Defence 15" },
  { industry: "AI", id: "ec-ai-15", name: "EC AI 15" },
  { industry: "Transformers", id: "ec-transformers-15", name: "EC Transformers 15" },
  { industry: "Solar energy", id: "ec-solar-15", name: "EC Solar 15" },
  { industry: "Cloud storage", id: "ec-cloud-storage-15", name: "EC Cloud storage 15" },
  { industry: "EV vehicles", id: "ec-ev-15", name: "EC EV 15" },
  { industry: "Insurance", id: "ec-insurance-15", name: "EC Insurance 15" },
  { industry: "Jewellery", id: "ec-jewellery-15", name: "EC Jewellery 15" },
  { industry: "Mining", id: "ec-mining-15", name: "EC Mining 15" },
  { industry: "Sugar", id: "ec-sugar-15", name: "EC Sugar 15" },
] as const;

export type ThemeIndustry = (typeof THEME_INDEXES)[number]["industry"];

function isDefence(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (DEFENCE_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  return /aerospace|defense|defence|shipbuilder|ship yard|aeronautic|ordnance/.test(t);
}

function defenceLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = DEFENCE_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name} ${symbol}`.toLowerCase();
  if (/ship|dock|yard/.test(t)) return "Shipbuilding";
  if (/aero|aircraft|aviation|aeronautic/.test(t)) return "Aerospace";
  if (/missile|ordnance|ammunition|explosive/.test(t)) return "Missiles & munitions";
  if (/electron|radar|microwave|avionics/.test(t)) return "Defence electronics";
  if (/forge/.test(t)) return "Forgings";
  if (/metal|alloy|dhatu/.test(t)) return "Special materials";
  if (/train|simulat|drone|uav/.test(t)) return "Training & simulation";
  if (/space|optic/.test(t)) return "Space & electro-optics";
  if (/beml|vehicle|earth.?moving/.test(t)) return "Land systems";
  return "Defence manufacturing";
}

function isAI(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (AI_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/tcs|infosys|wipro|hcl tech|tech mahindra/.test(t)) return false;
  return /artificial intelligence|machine learning|generative ai|gpu cloud|data analytics|geospatial/.test(t);
}

function aiLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = AI_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name} ${symbol}`.toLowerCase();
  if (/gpu|supercomput|hpc|server/.test(t)) return "AI servers";
  if (/cloud|data cent/.test(t)) return "GPU cloud";
  if (/analytic/.test(t)) return "Data analytics";
  if (/advert|adtech|digital marketing/.test(t)) return "AI advertising";
  if (/travel|hospitality/.test(t)) return "Travel AI";
  if (/map|geo/.test(t)) return "Geospatial AI";
  if (/semiconductor|chip/.test(t)) return "Semiconductors";
  if (/elxsi|kpit|ltts|cyient|sasken|tata tech/.test(t)) return "Engineering software";
  if (/intellect|newgen|aurion|nucleus|ramco|subex/.test(t)) return "Enterprise AI software";
  return "Digital / AI services";
}

function isTransformer(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (TRANSFORMER_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/siemens|\babb\b|bhel|havells|polycab|\bkei\b|finolex|crompton|v-guard|vguard/.test(t)) {
    return false;
  }
  return /\btransformers?\b/.test(t);
}

function transformerLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = TRANSFORMER_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name} ${symbol}`.toLowerCase();
  if (/lamination|stamp/.test(t)) return "Laminations";
  if (/winding|wire|enamel/.test(t)) return "Winding wire";
  if (/hitachi|grid|hvdc|switchgear|t&d|transmission/.test(t)) return "Grid / HV equipment";
  if (/distribution/.test(t)) return "Distribution transformers";
  return "Power transformers";
}

function isSolar(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (SOLAR_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/suzlon|inox.?wind|solar industries|tata power|\bntpc\b(?! green)|reliance/.test(t)) {
    return false;
  }
  return /\bsolar\b|photovoltaic|pv module/.test(t);
}

function solarLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = SOLAR_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name} ${symbol}`.toLowerCase();
  if (/glass|borosil/.test(t)) return "Solar glass";
  if (/epc|sterling|wilson|gensol/.test(t)) return "Solar EPC";
  if (/\bcell\b|wafer/.test(t)) return "Solar cells";
  if (/module|panel|waaree|premier|vikram/.test(t)) return "Solar modules";
  if (/green energy|ipp|generation|power/.test(t)) return "Solar generation";
  return "Solar modules";
}

function isCloud(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (CLOUD_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/tcs|infosys|wipro|hcl tech|tech mahindra|bharti|indus tower/.test(t)) return false;
  return /data.?cent|colocation|co-location|cloud storage|cloud infrastruct/.test(t);
}

function cloudLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = CLOUD_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name} ${symbol}`.toLowerCase();
  if (/data.?cent|colocation|anant raj/.test(t)) return "Data centres";
  if (/rail.?tel|tata comm|connectivity|network/.test(t)) return "Cloud connectivity";
  if (/software|saas/.test(t)) return "Cloud software";
  return "Digital infrastructure";
}

function isEv(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (EV_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (
    /maruti|tata motors|mahindra & mahindra|hero motocorp|tvs motor|bajaj auto|eicher|ashok leyland|bosch/.test(
      t,
    )
  ) {
    return false;
  }
  return /electric vehicle|\be-bus\b|e-scooter|ola electric|ather energy|olectra|ev charging/.test(t);
}

function evLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = EV_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name} ${symbol}`.toLowerCase();
  if (/charg|exicom|servotech/.test(t)) return "EV charging";
  if (/batter|cell|amara raja|hbl/.test(t)) return "EV batteries";
  if (/bus|olectra|jbm/.test(t)) return "Electric buses";
  if (/three.?wheel|3w|atul/.test(t)) return "Electric three-wheelers";
  if (/last.?mile|greaves/.test(t)) return "Electric last-mile";
  return "Electric two-wheelers";
}

function isInsurance(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (INSURANCE_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/max healthcare|hospital|bajaj finserv|hdfc bank|icici bank/.test(t)) return false;
  return /life insurance|general insurance|health insurance|reinsurance|\binsurer\b|insurance corporation/.test(
    t,
  );
}

function insuranceLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = INSURANCE_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name} ${symbol}`.toLowerCase();
  if (/reinsur|gic/.test(t)) return "Reinsurance";
  if (/bazaar|policyb|broker|distribution|fintech/.test(t)) return "Insurance distribution";
  if (/health|star|niva|bupa/.test(t)) return "Health insurance";
  if (/general|non.?life|gic of|new india|digit/.test(t)) return "General insurance";
  return "Life insurance";
}

function isJewellery(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (JEWELLERY_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  return /jewell|jewelry|gems and jewel|precious metals?$|diamond/.test(t);
}

function jewelleryLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = JEWELLERY_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/diamond|gem/.test(t)) return "Gems & diamonds";
  if (/retail|showroom/.test(t)) return "Jewellery retail";
  return "Jewellery manufacturing";
}

function isMining(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (MINING_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/steel|ferro.?alloy|aluminium product|aluminum product/.test(t)) return false;
  return /\bmining\b|\bcoal\b|iron ore|bauxite|manganese|mineral/.test(t);
}

function miningLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = MINING_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/\bcoal\b|lignite/.test(t)) return "Coal";
  if (/iron ore|manganese/.test(t)) return "Iron ore";
  if (/zinc|copper|lead|bauxite/.test(t)) return "Base metals mining";
  return "Minerals";
}

function isSugar(symbol: string, name: string, tvIndustry: string) {
  const sym = symbol.toUpperCase();
  if (SUGAR_LINE[sym]) return true;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  return /\bsugar\b/.test(t);
}

function sugarLine(symbol: string, name: string, tvIndustry: string) {
  const mapped = SUGAR_LINE[symbol.toUpperCase()];
  if (mapped) return mapped;
  const t = `${tvIndustry} ${name}`.toLowerCase();
  if (/ethanol|distiller/.test(t)) return "Sugar / ethanol";
  return "Sugar mills";
}

function themeIndustryOf(symbol: string, name: string, tvIndustry: string, iics: string) {
  if (isDefence(symbol, name, tvIndustry)) return "Defence";
  if (isAI(symbol, name, tvIndustry)) return "AI";
  if (isTransformer(symbol, name, tvIndustry)) return "Transformers";
  if (isSolar(symbol, name, tvIndustry)) return "Solar energy";
  if (isCloud(symbol, name, tvIndustry)) return "Cloud storage";
  if (isEv(symbol, name, tvIndustry)) return "EV vehicles";
  if (isInsurance(symbol, name, tvIndustry)) return "Insurance";
  if (isJewellery(symbol, name, tvIndustry)) return "Jewellery";
  if (isMining(symbol, name, tvIndustry)) return "Mining";
  if (isSugar(symbol, name, tvIndustry)) return "Sugar";
  return iics;
}

export type IndiaListedName = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  basic: string;
  marketCap: number;
};

export type IndiaCapGroup = {
  id: string;
  label: string;
  names: number;
  marketCap: number;
  share: number | null;
};

export type IndiaSectorCapBook = {
  asOf: string;
  source: "NSE Indices";
  mcapSource: "TradingView";
  exchange: "NSE";
  universe: "Nifty Total Market";
  names: number;
  sectors: number;
  industries: number;
  basics: number;
  marketCap: number;
  sectorRows: IndiaCapGroup[];
  industryRows: IndiaCapGroup[];
  basicRows: IndiaCapGroup[];
  stocks: IndiaListedName[];
  defenceIndex: ThemeIndex;
  themeIndexes: Record<string, ThemeIndex>;
};

type TvScan = {
  error?: string;
  data?: { d?: unknown[] }[];
};

let cache: { at: number; book: IndiaSectorCapBook } | null = null;
const CACHE_MS = 60_000;

function label(raw: unknown) {
  const t = String(raw ?? "").trim();
  return t || "Unclassified";
}

function parseCsvLine(line: string) {
  const parts = line.split(",");
  if (parts.length < 5) return null;
  const symbol = parts[parts.length - 3]?.trim();
  const industry = parts[parts.length - 4]?.trim();
  const name = parts.slice(0, parts.length - 4).join(",").trim();
  if (!symbol || !industry || !name) return null;
  return { symbol, name, sector: industry };
}

function groupRows(
  stocks: IndiaListedName[],
  key: "sector" | "industry" | "basic",
  totalCap: number,
): IndiaCapGroup[] {
  const by = new Map<string, { names: number; marketCap: number }>();
  for (const row of stocks) {
    const id = row[key];
    const prev = by.get(id) ?? { names: 0, marketCap: 0 };
    prev.names += 1;
    prev.marketCap += row.marketCap;
    by.set(id, prev);
  }
  return [...by.entries()]
    .map(([id, row]) => ({
      id,
      label: id,
      names: row.names,
      marketCap: row.marketCap,
      share: totalCap > 0 ? row.marketCap / totalCap : null,
    }))
    .sort((a, b) => b.marketCap - a.marketCap);
}

async function fetchTotalMarket() {
  const res = await fetch(TOTAL_MARKET, {
    headers: { Accept: "text/csv,text/plain,*/*", "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`nifty total market ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith("<")) throw new Error("nifty total market html");
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || /^company name/i.test(line)) continue;
    const parsed = parseCsvLine(line);
    if (parsed) rows.push(parsed);
  }
  if (rows.length < 50) throw new Error("nifty total market empty");
  return rows;
}

function basicIndustry(tvIndustry: string, iicsSector: string, name = "", symbol = "") {
  const t = `${tvIndustry} ${name} ${symbol}`.toLowerCase();
  if (iicsSector === "Defence") return defenceLine(symbol, name, tvIndustry);
  if (iicsSector === "AI") return aiLine(symbol, name, tvIndustry);
  if (iicsSector === "Transformers") return transformerLine(symbol, name, tvIndustry);
  if (iicsSector === "Solar energy") return solarLine(symbol, name, tvIndustry);
  if (iicsSector === "Cloud storage") return cloudLine(symbol, name, tvIndustry);
  if (iicsSector === "EV vehicles") return evLine(symbol, name, tvIndustry);
  if (iicsSector === "Insurance") return insuranceLine(symbol, name, tvIndustry);
  if (iicsSector === "Jewellery") return jewelleryLine(symbol, name, tvIndustry);
  if (iicsSector === "Mining") return miningLine(symbol, name, tvIndustry);
  if (iicsSector === "Sugar") return sugarLine(symbol, name, tvIndustry);
  if (iicsSector === "Healthcare") {
    if (/\bcancer\b|\boncology\b|\bctc\b|\bhcg\b|healthcare global/.test(t)) return "Cancer / CTC";
    if (/hospital|nursing management/.test(t)) return "Hospital (treatment)";
    if (/nursing service|diagnostic|patholog|laborator|medical\/nursing services/.test(t)) {
      return "Diagnostic";
    }
    if (/pharma/.test(t)) return "Pharmaceuticals";
    if (/biotech/.test(t)) return "Biotechnology";
    if (/distributor|equipment|supplies/.test(t)) return "Medical equipment & supplies";
    if (/specialt/.test(t)) return "Specialty treatment";
  }
  if (iicsSector === "Financial Services") {
    if (/life.?health|life insurance/.test(t)) return "Life insurance";
    if (/property.?casualty|multi-line insurance|insurance brokers/.test(t)) return "General insurance";
    if (/insurance/.test(t)) return "Insurance";
    if (/major banks|regional banks|\bbank\b/.test(t)) return "Banks";
    if (/investment banks|investment managers|finance.?rental|savings banks|financial conglomerate/.test(t)) {
      return "NBFC / markets";
    }
    if (/real estate investment/.test(t)) return "REIT / InvIT";
  }
  if (iicsSector === "Automobile and Auto Components") {
    if (/motor vehicles|trucks\/construction|automotive aftermarket/.test(t)) return "OEMs (vehicles)";
    if (/auto parts|tires/.test(t)) return "Auto components";
  }
  if (iicsSector === "Information Technology") {
    if (/packaged software|internet software/.test(t)) return "Software products";
    if (/information technology services|data processing/.test(t)) return "IT services";
    if (/semiconductor|electronic equipment|electronic production/.test(t)) return "Electronics / semiconductors";
  }
  if (iicsSector === "Oil Gas & Consumable Fuels") {
    if (/integrated oil|oil refining|oil.?gas pipelines/.test(t)) return "Oil & gas (integrated / refining)";
    if (/oil.?gas production|oilfield/.test(t)) return "Upstream / oilfield";
    if (/\bcoal\b/.test(t)) return "Coal";
  }
  if (iicsSector === "Fast Moving Consumer Goods") {
    if (/household|personal care|household\/personal/.test(t)) return "Personal care / household";
    if (/packaged foods|food: meat|food: specialty/.test(t)) return "Foods";
    if (/beverages: alcoholic/.test(t)) return "Alcoholic beverages";
    if (/beverages/.test(t)) return "Beverages";
    if (/tobacco/.test(t)) return "Tobacco";
  }
  if (iicsSector === "Telecommunication") {
    if (/wireless/.test(t)) return "Wireless";
    if (/telecom/.test(t)) return "Telecom services";
  }
  if (iicsSector === "Power" || iicsSector === "Utilities") {
    if (/electric/.test(t)) return "Electric utilities";
    if (/\bgas\b/.test(t)) return "Gas utilities";
    if (/water/.test(t)) return "Water utilities";
    if (/alternative power|renewable/.test(t)) return "Renewable power";
  }
  if (iicsSector === "Realty") {
    if (/investment trust|reit/.test(t)) return "REIT";
    if (/real estate/.test(t)) return "Real estate development";
  }
  return label(tvIndustry);
}

async function fetchTvMeta() {
  const res = await fetch("https://scanner.tradingview.com/india/scan", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": UA,
      Origin: "https://www.tradingview.com",
      Referer: "https://www.tradingview.com/",
    },
    body: JSON.stringify({
      markets: ["india"],
      filter: [
        { left: "exchange", operation: "equal", right: "NSE" },
        { left: "type", operation: "equal", right: "stock" },
        { left: "is_primary", operation: "equal", right: true },
      ],
      columns: ["name", "industry", "market_cap_basic"],
      range: [0, 5000],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tv mcap ${res.status}`);
  const body = (await res.json()) as TvScan;
  if (body.error) throw new Error(body.error);
  const meta = new Map<string, { industry: string; cap: number }>();
  for (const row of body.data ?? []) {
    const symbol = label(row.d?.[0]).toUpperCase();
    const industry = label(row.d?.[1]);
    const n = Number(row.d?.[2]);
    if (!symbol) continue;
    meta.set(symbol, { industry, cap: Number.isFinite(n) && n > 0 ? n : 0 });
  }
  return meta;
}

export async function fetchIndiaSectorCaps(): Promise<IndiaSectorCapBook> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.book;
  const [listed, meta] = await Promise.all([
    fetchTotalMarket(),
    fetchTvMeta().catch(() => new Map<string, { industry: string; cap: number }>()),
  ]);
  const stocks: IndiaListedName[] = listed.map((row) => {
    const iics = label(row.sector);
    const tv = meta.get(row.symbol.toUpperCase());
    const industry = themeIndustryOf(row.symbol, row.name, tv?.industry ?? "", iics);
    return {
      symbol: row.symbol,
      name: row.name,
      sector: MACRO_BY_SECTOR[industry] ?? MACRO_BY_SECTOR[iics] ?? "Unclassified",
      industry,
      basic: basicIndustry(tv?.industry ?? "", industry, row.name, row.symbol),
      marketCap: tv?.cap ?? 0,
    };
  });
  stocks.sort((a, b) => b.marketCap - a.marketCap);
  const totalCap = stocks.reduce((sum, row) => sum + row.marketCap, 0);
  const sectorRows = groupRows(stocks, "sector", totalCap);
  const industryRows = groupRows(stocks, "industry", totalCap);
  const basicRows = groupRows(stocks, "basic", totalCap);
  const book: IndiaSectorCapBook = {
    asOf: new Date().toISOString(),
    source: "NSE Indices",
    mcapSource: "TradingView",
    exchange: "NSE",
    universe: "Nifty Total Market",
    names: stocks.length,
    sectors: sectorRows.filter((row) => row.id !== "Unclassified").length,
    industries: industryRows.filter((row) => row.id !== "Unclassified").length,
    basics: basicRows.filter((row) => row.id !== "Unclassified").length,
    marketCap: totalCap,
    sectorRows,
    industryRows,
    basicRows,
    stocks,
    themeIndexes: Object.fromEntries(
      THEME_INDEXES.map((theme) => [
        theme.industry,
        buildThemeIndex(
          stocks.filter((row) => row.industry === theme.industry),
          { id: theme.id, name: theme.name },
        ),
      ]),
    ),
    defenceIndex: buildThemeIndex(
      stocks.filter((row) => row.industry === "Defence"),
      { id: "ec-defence-15", name: "EC Defence 15" },
    ),
  };
  cache = { at: Date.now(), book };
  return book;
}
