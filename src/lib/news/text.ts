const STOP = new Set([
  "the",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "with",
  "after",
  "as",
  "by",
  "from",
  "at",
  "is",
  "its",
  "it",
  "into",
  "over",
  "than",
  "this",
  "that",
  "says",
  "said",
  "report",
  "reports",
  "source",
]);

export function normalizeHeadline(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9%$+\-. ]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenize(text: string) {
  return normalizeHeadline(text)
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function ngrams(tokens: string[], n = 2) {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - n + 1; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

export function features(text: string) {
  const tokens = tokenize(text);
  return [...tokens, ...ngrams(tokens, 2)];
}
