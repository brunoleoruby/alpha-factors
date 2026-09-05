# News Pattern Desk

Local desktop software that **reads stock headlines**, names the event, finds similar past prints, and estimates how the name usually behaved afterward.

## Run it on your PC (like an installed app)

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

1. **Classify** — map a headline to an event (earnings, guidance, M&A, legal, outage, …).
2. **Rhyme** — TF-IDF cosine vs earlier headlines of the same type.
3. **Behavior** — typical 1-day / 5-day path, hit rate, fade rate.
4. **Flags** — cascade (same name, same event within two days) and echo (near-duplicate).
5. **Ticket** — paper long/short only when confidence and expected move clear your bars.

Paste any headline in **Read a headline** to run the same stack by hand.

Headlines and subsequent returns are **simulated** so it runs offline with no news-vendor key.

## Browser (optional)

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:43123 — same engine, in a tab.
