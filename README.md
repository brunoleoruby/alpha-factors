# News pattern desk

Algorithm that **reads stock headlines**, names the event, finds similar past prints, and estimates how the name usually behaved afterward. A paper book trades only the high-confidence patterns.

This is **not** a classic factor model (value, momentum, quality). The signal is the news pattern.

## What the algorithm does

1. **Classify** — keyword and phrase rules map a headline to an event (earnings beat/miss, guidance raise/cut, upgrade/downgrade, M&A, legal, outage, buyback, offering, and so on) plus sentiment and intensity.
2. **Rhyme** — TF-IDF cosine similarity against earlier headlines, with a boost for the same event type. Only history dated *before* the print is used.
3. **Behavior** — similarity-weighted average of those neighbors' 1-day and 5-day returns, hit rate, and fade/reversal rate.
4. **Structure flags** — a **cascade** is the same event on the same name within two days; an **echo** is a near-duplicate already on the tape.
5. **Ticket** — long or short if confidence and expected move clear the bars you set.

Paste any headline in **Read a headline** to run the same stack by hand.

## Data

Headlines and subsequent returns are **simulated** so the matcher has a labeled history without a Bloomberg or news-API key. Swap the corpus later for a real wire; the recognizer stays the same.

## Run locally

```bash
npm install
npm run dev -- --port 43123 --hostname 0.0.0.0
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test   # classifier + neighbor-search smoke
```

## Layout

- `src/lib/news/` — taxonomy, classifier, TF-IDF, corpus, pattern match, paper engine
- `src/components/desk/` — tape, inspector, controls
