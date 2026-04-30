import { NextRequest, NextResponse } from "next/server";

// Module-level cache for crumb (shared across requests in the same process)
let crumbCache: { crumb: string; cookie: string; ts: number } | null = null;
const CRUMB_TTL_MS = 30 * 60 * 1000; // 30 minutes

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
};

async function refreshCrumb(): Promise<{ crumb: string; cookie: string }> {
  // Step 1: Get session cookie
  const cookieRes = await fetch("https://finance.yahoo.com/", {
    headers: HEADERS,
    redirect: "follow",
  });
  const rawCookies = cookieRes.headers.get("set-cookie") || "";
  // Extract just the A3 / GUC / etc. cookies needed
  const cookieStr = rawCookies
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  // Step 2: Get crumb
  const crumbRes = await fetch(
    "https://query1.finance.yahoo.com/v1/test/getcrumb",
    {
      headers: {
        ...HEADERS,
        Cookie: cookieStr,
      },
    }
  );
  const crumb = await crumbRes.text();

  return { crumb: crumb.trim(), cookie: cookieStr };
}

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  const now = Date.now();
  if (crumbCache && now - crumbCache.ts < CRUMB_TTL_MS && crumbCache.crumb) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }
  const fresh = await refreshCrumb();
  crumbCache = { ...fresh, ts: now };
  return fresh;
}

function parseYahooResponse(json: any): {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}[] {
  const result = json?.chart?.result?.[0];
  if (!result) return [];

  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const { open, high, low, close, volume } = quote;

  return timestamps
    .map((ts, i) => ({
      // Add 12 hours (43200s) before extracting the date so that midnight-IST
      // timestamps (which land at 18:30 UTC the previous day) still resolve to
      // the correct calendar date.  The resulting YYYY-MM-DD string is stable
      // regardless of the server's local timezone.
      date: (() => {
        const d = new Date((ts + 43200) * 1000);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      })(),
      open: open?.[i] ?? null,
      high: high?.[i] ?? null,
      low: low?.[i] ?? null,
      close: close?.[i] ?? null,
      volume: volume?.[i] ?? 0,
    }))
    .filter(
      (b) =>
        b.open != null &&
        b.high != null &&
        b.low != null &&
        b.close != null &&
        isFinite(b.open) &&
        isFinite(b.high) &&
        isFinite(b.low) &&
        isFinite(b.close)
    ) as any;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = decodeURIComponent(params.symbol);
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") || "1mo";
  const range = searchParams.get("range") || "6mo";

  // Try v8 endpoint first (no crumb needed usually)
  const baseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
  const queryParams = new URLSearchParams({
    interval,
    range,
    includePrePost: "false",
    events: "div,splits",
  });

  try {
    // Attempt 1: Simple fetch (works for many cases)
    const res1 = await fetch(`${baseUrl}?${queryParams}`, {
      headers: HEADERS,
      next: { revalidate: 300 },
    });

    if (res1.ok) {
      const json = await res1.json();
      const bars = parseYahooResponse(json);
      if (bars.length > 0) {
        return NextResponse.json(
          { bars, symbol },
          {
            headers: {
              "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            },
          }
        );
      }
    }

    // Attempt 2: With crumb auth
    const { crumb, cookie } = await getCrumb();
    queryParams.set("crumb", crumb);

    const res2 = await fetch(`${baseUrl}?${queryParams}`, {
      headers: {
        ...HEADERS,
        Cookie: cookie,
      },
    });

    if (!res2.ok) {
      const errText = await res2.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Yahoo Finance error ${res2.status}: ${errText.slice(0, 200)}`,
          bars: [],
        },
        { status: res2.status }
      );
    }

    const json2 = await res2.json();
    const bars2 = parseYahooResponse(json2);

    return NextResponse.json(
      { bars: bars2, symbol },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: any) {
    console.error(`[chart/${symbol}]`, err);
    return NextResponse.json(
      { error: err?.message || "Unknown error", bars: [] },
      { status: 500 }
    );
  }
}
