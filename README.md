# Pivot Scanner — Inside Month Breakout Finder

A Next.js 14 stock scanner for NSE that finds **Inside Month Floor Pivot** compression setups. When the current month's R5–S5 pivot range is entirely contained within the previous month's range, it signals a compression coil with potential for 20–50%+ explosive breakouts.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
├── page.tsx                      ← Main scanner UI
├── picks/page.tsx                ← Top Picks page (curated watchlist)
├── api/chart/[symbol]/route.ts   ← Yahoo Finance proxy (CORS + crumb auth)
├── layout.tsx                    ← Dark mode root layout
└── globals.css                   ← Dark theme CSS variables

components/
└── ChartModal.tsx                ← Chart modal with carousel + pivot table

lib/
├── pivots.ts                     ← Floor pivot formulas + scan logic
└── yahoo.ts                      ← Yahoo Finance fetch helpers

public/
└── stocks.json                   ← Nifty 500 stock list
```

---

## Floor Pivot Formulas

```
PP = (H + L + C) / 3
R1 = (2 × PP) − L
R2 = PP + (H − L)
R3 = H + 2 × (PP − L)
R4 = (PP × 3) + (H − (3 × L))
R5 = (PP × 4) + (H − (4 × L))
S1 = (2 × PP) − H
S2 = PP − (H − L)
S3 = L − 2 × (H − PP)
S4 = (PP × 3) − ((3 × H) − L)
S5 = (PP × 4) − ((4 × H) − L)
```

Pivot inputs use **previous month's HLC** to calculate current month's levels (correct Floor Pivot methodology).

---

## Inside Month Condition

```
Current Month R5 < Previous Month R5
AND
Current Month S5 > Previous Month S5
```

---

## Scan Modes

- **Current Month** — Uses last complete month's HLC to compute this month's pivots
- **Next Month** — Active in last 2 days of month; uses current month HLC to preview next month's pivots

---

## Data Source

Yahoo Finance public API via a Next.js proxy route at `/api/chart/[symbol]`.

- Handles CORS and Yahoo's crumb authentication automatically
- Results cached for 5 minutes (300s) with stale-while-revalidate
- Batches 10 stocks at a time with 120ms delay to avoid rate limiting

---

## Features

- ✅ Live streaming results (renders matches as they're found)
- ✅ Sortable table: CMP, Buy Point, Stop Loss, Risk %, PP Trend
- ✅ Chart modal with Lightweight Charts v4, pivot lines, carousel
- ✅ Mobile responsive with slide-out sidebar drawer
- ✅ Export CSV
- ✅ Pagination (15 per page)
- ✅ Top Picks page at `/picks`

---

## Extending

### Add more stocks

Edit `public/stocks.json`:
```json
[{ "Symbol": "YOURSTOCK", "Name": "Your Stock Name" }]
```

### Change batch size / delay

In `app/page.tsx`:
```ts
const BATCH_SIZE = 10;        // concurrent fetches
await sleep(120);              // ms between batches
```

### Deploy to Vercel

```bash
npx vercel
```

No environment variables needed — Yahoo Finance access is anonymous.
