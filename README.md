# Factor desk

Paper-trading desk that ranks a 24-name universe on six factors, builds a long (optional short) book from the composite score, and rebalances on a schedule.

This is **simulated market data** and **paper fills only**. It is not connected to a broker.

## Factors

| Factor | What it measures |
| --- | --- |
| Momentum | Blend of 21-day and 63-day return |
| Mean reversion | Distance below the 20-day average |
| Low volatility | Negative 21-day realized vol |
| Value | Simulated earnings yield |
| Quality | Simulated ROE |
| Liquidity | Log average dollar volume |

Weights are z-scored cross-sectionally, then mixed into one composite. The top names are bought (score-weighted). If shorts are on, the bottom names are sold for a 50/50 long-short book.

## Run locally

```bash
npm install
npm run dev -- --port 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

- **Rebuild paper book** regenerates the synthetic history and reruns the backtest.
- **Run live paper** appends a new simulated session about once a second and rebalances when due.
- Strategy settings persist in `localStorage`.

## Stack

Next.js, TypeScript, Tailwind, shadcn/ui, Recharts. The scoring and portfolio engine lives in `src/lib/trading/`.
