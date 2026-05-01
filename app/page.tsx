"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { calculateFloorPivots, isInsideMonth, findBuyPoint, findStopLoss } from "@/lib/pivots";
import { getScanMode, currentMonthLabel, nextMonthLabel } from "@/lib/yahoo";
import type { ScanResult } from "@/components/ChartPanel";

// ─── Config ───────────────────────────────────────────────────────────────────

type IndexKey = "all" | "largecaps" | "midcaps" | "smallcaps" | "microcaps";

const INDICES: Record<IndexKey, { label: string; sub: string; file: string }> = {
  all:       { label: "All",   sub: "Nifty 500",    file: "/stocks.json"    },
  largecaps: { label: "Large", sub: "Nifty 100",    file: "/largecaps.json" },
  midcaps:   { label: "Mid",   sub: "Midcap 150",   file: "/midcaps.json"   },
  smallcaps: { label: "Small", sub: "Smallcap 250", file: "/smallcaps.json" },
  microcaps: { label: "Micro", sub: "Microcap 250", file: "/microcaps.json" },
};
const INDEX_KEYS: IndexKey[] = ["all", "largecaps", "midcaps", "smallcaps", "microcaps"];

type StockEntry = { Symbol: string; Name: string };

const BATCH = 10;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();

  const [idx,        setIdx]        = useState<IndexKey>("all");
  const [stocks,     setStocks]     = useState<StockEntry[]>([]);
  const [idxLoading, setIdxLoading] = useState(false);
  const [idxError,   setIdxError]   = useState<string | null>(null);

  const [mode, setMode] = useState<"current_month" | "next_month">(getScanMode);

  const [scanning,  setScanning]  = useState(false);
  const [done,      setDone]      = useState(0);
  const [found,     setFound]     = useState(0);
  const [errs,      setErrs]      = useState(0);
  const [finished,  setFinished]  = useState(false);

  const resultsRef = useRef<ScanResult[]>([]);
  const abort      = useRef(false);

  const monthLabel = mode === "current_month" ? currentMonthLabel() : nextMonthLabel();

  // Load stocks when index changes
  useEffect(() => {
    setIdxLoading(true); setIdxError(null); setStocks([]);
    setFinished(false); setDone(0); setFound(0); setErrs(0);
    resultsRef.current = [];
    fetch(INDICES[idx].file)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: StockEntry[]) => {
        if (!Array.isArray(d) || !d.length) throw new Error("Empty or invalid JSON");
        setStocks(d);
      })
      .catch(e => setIdxError(e.message))
      .finally(() => setIdxLoading(false));
  }, [idx]);

  // ── Scan ───────────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    if (scanning || !stocks.length) return;
    abort.current    = false;
    resultsRef.current = [];
    setScanning(true); setDone(0); setFound(0); setErrs(0); setFinished(false);

    for (let i = 0; i < stocks.length; i += BATCH) {
      if (abort.current) break;
      const batch = stocks.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async s => {
        if (abort.current) return;
        try {
          const res  = await fetch(`/api/chart/${encodeURIComponent(s.Symbol + ".NS")}?interval=1mo&range=12mo`);
          const data = await res.json();
          const bars: { date: string; open: number; high: number; low: number; close: number }[] = data.bars || [];
          if (bars.length < 3) return;

          const now = new Date();
          const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

          // Separate the current partial month bar from fully-closed months.
          // A bar whose YYYY-MM equals thisYM is the current (incomplete) bar.
          // Everything strictly less than thisYM is a closed month.
          const currBar     = bars.find(b => b.date.substring(0, 7) === thisYM);
          const closedBars  = bars
            .filter(b => b.date.substring(0, 7) < thisYM)
            // Guard against degenerate bars (first trading day of month,
            // Yahoo sometimes returns a 1-candle bar for the current month
            // stamped one day early — these have H == L, so drop them).
            .filter(b => b.high > b.low);

          if (closedBars.length < 2) return;

          // Use the last two fully-closed months by position (most recent first).
          // This is the original logic that worked — date filtering above already
          // removed any degenerate partial bar that could corrupt these positions.
          const n       = closedBars.length;
          const lastBar  = closedBars[n - 1]; // last complete month  (e.g. April)
          const prev2Bar = closedBars[n - 2]; // month before that    (e.g. March)

          let hlcCurr: typeof bars[0], hlcPrev: typeof bars[0], cmp: number;
          if (mode === "current_month") {
            hlcCurr = lastBar;   // April HLC  → May pivots
            hlcPrev = prev2Bar;  // March HLC  → April pivots
            cmp = currBar?.close ?? lastBar.close;
          } else {
            if (!currBar) return;
            hlcCurr = currBar;  // current month HLC → next month pivots
            hlcPrev = lastBar;  // last complete HLC → current month pivots
            cmp = currBar.close;
          }

          const currP = calculateFloorPivots(hlcCurr.high, hlcCurr.low, hlcCurr.close);
          const prevP = calculateFloorPivots(hlcPrev.high, hlcPrev.low, hlcPrev.close);
          if (!isInsideMonth(currP, prevP)) return;

          const result: ScanResult = {
            symbol: s.Symbol,
            name:   s.Name,
            cmp,
            currentPivots:  currP,
            previousPivots: prevP,
            buyPoint: findBuyPoint(cmp, currP),
            stopLoss: findStopLoss(cmp, currP),
            ppTrend:  currP.PP > prevP.PP ? "Higher" : currP.PP < prevP.PP ? "Lower" : "Equal",
            currentPivotSourceMonth:  hlcCurr.date.substring(0, 7),
            previousPivotSourceMonth: hlcPrev.date.substring(0, 7),
            // Raw input data — visible in pivot table for cross-checking vs TradingView / NSE
            currentHLC:  { H: hlcCurr.high, L: hlcCurr.low,  C: hlcCurr.close },
            previousHLC: { H: hlcPrev.high, L: hlcPrev.low,  C: hlcPrev.close },
          };

          resultsRef.current.push(result);
          setFound(resultsRef.current.length);
        } catch { setErrs(e => e + 1); }
      }));

      setDone(c => Math.min(c + BATCH, stocks.length));
      await new Promise(r => setTimeout(r, 120));
    }

    // Persist to sessionStorage for the results page
    try {
      sessionStorage.setItem("pivot_results", JSON.stringify(resultsRef.current));
      sessionStorage.setItem("pivot_meta", JSON.stringify({
        index: idx,
        indexLabel: INDICES[idx].sub,
        month: monthLabel,
        mode,
        count: resultsRef.current.length,
        scannedAt: Date.now(),
      }));
    } catch {}

    setScanning(false);
    setFinished(true);
  }, [scanning, stocks, mode, idx, monthLabel]);

  const stopScan = () => { abort.current = true; setScanning(false); setFinished(done > 0); };

  const showResults = () => router.push("/results");

  const pct = stocks.length ? (done / stocks.length) * 100 : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px",
    }}>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 36 }}>

        {/* Title */}
        <div>
          <div style={{ color: "var(--t3)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
            NSE · Floor Pivot · Inside Month
          </div>
          <div style={{ color: "var(--t1)", fontSize: 26, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
            Breakout<br />
            <span style={{ color: "var(--green)" }}>Scanner</span>
          </div>
        </div>

        {/* Index selector */}
        <div>
          <div style={{ color: "var(--t3)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
            Universe
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {INDEX_KEYS.map(k => {
              const active = k === idx;
              return (
                <button key={k} onClick={() => { if (!scanning) setIdx(k); }}
                  disabled={scanning}
                  style={{
                    padding: "6px 14px", borderRadius: 4, border: "1px solid",
                    borderColor: active ? "var(--green)" : "var(--border2)",
                    background: active ? "#0a1f12" : "transparent",
                    color: active ? "var(--green)" : "var(--t2)",
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    cursor: scanning ? "not-allowed" : "pointer",
                    opacity: scanning && !active ? 0.4 : 1,
                    transition: "all 0.12s",
                  }}>
                  {INDICES[k].label}
                  {!idxLoading && active && stocks.length > 0 && (
                    <span style={{ color: "var(--t3)", marginLeft: 5, fontSize: 10 }}>
                      {stocks.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {idxError && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "flex-start", color: "#f87171", fontSize: 11 }}>
              <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{idxError} — ensure <code>public{INDICES[idx].file}</code> exists</span>
            </div>
          )}
        </div>

        {/* Month selector */}
        <div>
          <div style={{ color: "var(--t3)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
            Period
          </div>
          <div style={{ display: "flex", gap: 1, background: "var(--border)", borderRadius: 5, padding: 2, width: "fit-content" }}>
            {(["current_month", "next_month"] as const).map(m => (
              <button key={m} onClick={() => { if (!scanning) setMode(m); }}
                disabled={scanning}
                style={{
                  padding: "7px 20px", border: "none", borderRadius: 4, cursor: scanning ? "not-allowed" : "pointer",
                  background: mode === m ? "var(--surface)" : "transparent",
                  color: mode === m ? "var(--t1)" : "var(--t2)",
                  fontSize: 12, fontWeight: mode === m ? 600 : 400,
                  transition: "all 0.12s",
                }}>
                {m === "current_month" ? "Current" : "Next"} Month
              </button>
            ))}
          </div>
          <div style={{ color: "var(--t3)", fontSize: 10, marginTop: 6 }}>
            Calculating pivots for <span style={{ color: "var(--t2)" }}>{monthLabel}</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Action area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Scan / Stop button */}
          {!scanning ? (
            <button onClick={runScan}
              disabled={idxLoading || !!idxError || !stocks.length}
              style={{
                padding: "11px 0", borderRadius: 5, border: "none",
                background: "var(--green)", color: "#000",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                opacity: idxLoading || !!idxError || !stocks.length ? 0.35 : 1,
                letterSpacing: "0.04em",
                transition: "opacity 0.15s",
              }}>
              {idxLoading ? "Loading…" : `Scan ${stocks.length ? stocks.length : ""} stocks`}
            </button>
          ) : (
            <button onClick={stopScan}
              style={{
                padding: "11px 0", borderRadius: 5,
                background: "transparent", border: "1px solid var(--border2)",
                color: "var(--red)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
              Stop
            </button>
          )}

          {/* Progress */}
          {(scanning || done > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ height: 2, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                <div
                  className={scanning ? "scan-bar" : ""}
                  style={{
                    height: "100%", width: `${pct}%`,
                    background: scanning ? undefined : "var(--green)",
                    borderRadius: 2, transition: "width 0.3s",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "var(--t3)" }}>
                  {done} / {stocks.length} scanned
                </span>
                <span style={{ color: "var(--t3)" }}>
                  <span style={{ color: "var(--green)", fontWeight: 600 }}>{found}</span> setups
                  {errs > 0 && <span style={{ color: "var(--t3)", marginLeft: 8 }}>{errs} errors</span>}
                </span>
              </div>
            </div>
          )}

          {/* Show Results button — appears after scan finishes */}
          {finished && found > 0 && !scanning && (
            <button onClick={showResults}
              style={{
                padding: "11px 0", borderRadius: 5, border: "1px solid var(--green)",
                background: "transparent", color: "var(--green)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                letterSpacing: "0.03em",
                animation: "fadeSlideUp 0.3s ease both",
              }}>
              Show Results →
            </button>
          )}

          {finished && found === 0 && !scanning && (
            <div style={{ textAlign: "center", color: "var(--t3)", fontSize: 12, padding: "8px 0" }}>
              No inside month setups found in {INDICES[idx].sub} for {monthLabel}.
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
