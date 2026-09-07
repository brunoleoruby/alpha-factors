# News Pattern Desk

Local desktop software that **reads stock headlines**, names the event, finds similar past prints, and estimates how the name usually behaved afterward.

## Save onto this Windows PC (Documents)

Origin CLI is **WSL only**, not PowerShell. Repo: [varun-g-v/alpha-factors](https://cursor.com/codebase/varun-g-v/alpha-factors) (private).

```bash
# Run in WSL (Origin CLI is not available in PowerShell)
curl -fsSL https://downloads.cursor.com/origin/install.sh | sh
origin auth login

# Clone into your Windows Documents folder
WIN_HOME=$(wslpath "$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')")
origin repo clone varun-g-v/alpha-factors "$WIN_HOME/Documents/alpha-factors"
```

If `origin` is not found:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Then in File Explorer open `Documents\alpha-factors` and double-click `Start Desk.bat` (install [Node.js](https://nodejs.org) first if needed).

Origin CLI docs: https://cursor.com/docs/origin/cli

## Run after it is on disk

1. Install [Node.js 20+](https://nodejs.org) (this includes `npm`).
2. Copy this project folder onto the machine.
3. **Windows:** double-click `Start Desk.bat`  
   **Mac / Linux:** double-click `start-desk.sh`, or in a terminal:

```bash
chmod +x start-desk.sh
./start-desk.sh
```

The first launch runs `npm install`, starts the local engine, and opens a **native window** (not a browser tab). Close the window to quit.

Later launches:

```bash
npm run desktop
```

Settings (confidence bars, hold period, cascade/echo) are remembered in this user profile.

### If the window does not open

- Confirm Node is on your PATH (`node -v`).
- From the project folder: `npm install` then `npm run desktop`.
- Linux may need Chromium libraries for Electron (`libnss3`, `libatk1.0`, `libgbm1`).

## What the algorithm does

1. **Classify** — map a headline to an event (earnings, guidance, M&A, legal, insider trading / PIT, promoter pledge, QIP/block, USFDA, credit-rating cut, outage, …).
2. **Rhyme** — TF-IDF cosine vs earlier headlines of the same type.
3. **Behavior** — typical 1-day / 5-day path, hit rate, fade rate.
4. **Neural** — a small MLP trained on earlier labeled prints maps non-linear sentiment and alternative-data flags (wire vs local source, SEBI/RBI/FII language, intensity) into its own 1d/5d move; the desk blends that with the neighbor path.
5. **Flags** — cascade (same name, same event within two days) and echo (near-duplicate).
6. **Ticket** — paper long/short only when confidence and expected move clear your bars.

Paste any headline in **Read a headline** to run the same stack by hand.

Headlines and subsequent returns are **simulated** so it runs offline with no news-vendor key.

## Browser (optional)

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:43123 — same engine, in a tab.

## Exchanges

- **US** — `/` — US names, USD paper book.
- **NSE** — `/nse` — National Stock Exchange of India, rupee paper book, Indian headline templates (SEBI, RBI, QIP).
- **All stocks (US)** — `/stocks` — directory plus a TradingView chart page per name (`/stocks/AAPL`).
- **Market environment** — `/nse/environment` (NSE) and `/environment` (US) — six columns: Indian indices, USA indices, Asia indices, commodity, currency, crude oil. Delayed Yahoo quotes.
- **Polycab case** — `/nse/cases/polycab` — IT search / CBDT window, classified and rhymed.
- **Insider trading** — `/nse/cases/insider` — PIT / UPSI event type, worked through Infosys June 2021 (SEBI interim order, mild large-cap close, SAT then dismissal).
- **Pledge · QIP · USFDA · Rating** — `/nse/cases/tape-events` — promoter pledge, QIP/block, USFDA 483, credit-rating cut.

Charts use TradingView Lightweight Charts for every name. Switch 15m / 1H / 1D / 1W / 1M and use **Swings** to mark fractal highs and lows as dots on that timeframe. NSE cash names cannot use TradingView’s public embed; Open on TradingView still goes to the full site.
