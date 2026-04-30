export interface OHLCBar {
  date: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FetchBarsResult {
  bars: OHLCBar[];
  symbol: string;
  error?: string;
}

/**
 * Fetch monthly OHLC bars via our Next.js proxy
 * (avoids CORS + handles Yahoo crumb auth server-side)
 */
export async function fetchMonthlyBars(symbol: string): Promise<OHLCBar[]> {
  const res = await fetch(
    `/api/chart/${encodeURIComponent(symbol)}?interval=1mo&range=6mo`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  const data: FetchBarsResult = await res.json();
  if (data.error) throw new Error(data.error);
  return data.bars;
}

/**
 * Fetch daily OHLC bars for chart rendering
 */
export async function fetchDailyBars(symbol: string): Promise<OHLCBar[]> {
  const res = await fetch(
    `/api/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  const data: FetchBarsResult = await res.json();
  if (data.error) throw new Error(data.error);
  return data.bars;
}

/**
 * Determine scan mode based on current date.
 * Last trading day of month → "next_month" mode (uses current month HLC for next month pivots)
 * Otherwise → "current_month" mode
 */
export function getScanMode(): "current_month" | "next_month" {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  // If today is within last 2 days of month, switch to next-month mode
  return now.getDate() >= lastDay - 1 ? "next_month" : "current_month";
}

/**
 * Get current month label like "Apr 2026"
 */
export function currentMonthLabel(): string {
  return new Date().toLocaleString("en-IN", { month: "short", year: "numeric" });
}

/**
 * Get next month label like "May 2026"
 */
export function nextMonthLabel(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}
