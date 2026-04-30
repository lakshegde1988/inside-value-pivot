"use client";

import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PivotLevels } from "@/lib/pivots";
import type { OHLCBar } from "@/lib/yahoo";

export interface ScanResult {
  symbol: string;
  name: string;
  cmp: number;
  currentPivots: PivotLevels;
  previousPivots: PivotLevels;
  buyPoint: number | null;
  stopLoss: number | null;
  ppTrend: "Higher" | "Lower" | "Equal";
  currentPivotSourceMonth: string;
  previousPivotSourceMonth: string;
}

interface ChartPanelProps {
  result: ScanResult;
  idx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

function fmt(n: number | null | undefined) {
  return n == null || !isFinite(n) ? "—" : n.toFixed(2);
}
function fmtP(n: number) {
  return isFinite(n) ? n.toFixed(0) : "—";
}

// ── Simple pivot table ────────────────────────────────────────────────────────
function PivotTable({ pivots, cmp }: { pivots: PivotLevels; cmp: number }) {
  const rows: { label: string; value: number }[] = [
    { label: "R5", value: pivots.R5 },
    { label: "R4", value: pivots.R4 },
    { label: "R3", value: pivots.R3 },
    { label: "R2", value: pivots.R2 },
    { label: "R1", value: pivots.R1 },
    { label: "PP", value: pivots.PP },
    { label: "S1", value: pivots.S1 },
    { label: "S2", value: pivots.S2 },
    { label: "S3", value: pivots.S3 },
    { label: "S4", value: pivots.S4 },
    { label: "S5", value: pivots.S5 },
  ];

  return (
    <div style={{ padding: "4px 0" }}>
      {rows.map(({ label, value }) => {
        const isR  = label.startsWith("R");
        const isPP = label === "PP";
        const color = isPP ? "#3b82f6" : isR ? "#22c55e" : "#ef4444";
        const isBold = Math.abs(value - cmp) === Math.min(...rows.map(r => Math.abs(r.value - cmp)));
        return (
          <div key={label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "4px 10px",
            background: isBold ? "#ffffff08" : "transparent",
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: "0.06em" }}>{label}</span>
            <span style={{ fontSize: 11, color: isFinite(value) ? color : "var(--t3)", fontWeight: 500 }}>
              {isFinite(value) ? fmtP(value) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ChartPanel({ result, idx, total, onPrev, onNext, onClose }: ChartPanelProps) {
  const [bars, setBars]       = React.useState<OHLCBar[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError]     = React.useState<string | null>(null);
  const containerRef          = useRef<HTMLDivElement>(null);
  const chartRef              = useRef<any>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  onPrev();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "Escape")     onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onPrev, onNext, onClose]);

  useEffect(() => {
    setLoading(true); setError(null); setBars([]);
    fetch(`/api/chart/${encodeURIComponent(result.symbol + ".NS")}?interval=1d&range=3mo`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setBars(d.bars || []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [result.symbol]);

  useEffect(() => {
    if (!containerRef.current || loading || bars.length === 0) return;
    let cleanup: (() => void) | undefined;

    const init = async () => {
      const { createChart, ColorType, CrosshairMode } = await import("lightweight-charts");
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

      const el = containerRef.current!;
      const chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: "#0c0c0c" },
          textColor: "#555",
          fontFamily: "'SF Mono','JetBrains Mono',ui-monospace,monospace",
          fontSize: 10,
        },
        grid:      { vertLines: { visible: false }, horzLines: { visible: false } },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#252525", width: 1, style: 2 },
          horzLine: { color: "#252525", width: 1, style: 2 },
        },
        rightPriceScale: { borderColor: "#1e1e1e", textColor: "#555" },
        timeScale:       { borderColor: "#1e1e1e", timeVisible: true, secondsVisible: false, rightOffset: 8 },
        width:  el.clientWidth,
        height: el.clientHeight,
      });

      const candles = chart.addCandlestickSeries({
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
        priceScaleId: "right",
      });
      candles.setData(bars.map(b => ({
        time: b.date.split("T")[0] as any,
        open: b.open, high: b.high, low: b.low, close: b.close,
      })));

      const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, borderVisible: false });
      chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.05, bottom: 0.22 } });
      vol.setData(bars.map(b => ({
        time: b.date.split("T")[0] as any,
        value: b.volume,
        color: b.close >= b.open ? "#22c55e33" : "#ef444433",
      })));

      const p = result.currentPivots;
      ([
        { price: p.R5, color: "#22c55e33" }, { price: p.R4, color: "#22c55e22" },
        { price: p.R3, color: "#22c55e22" }, { price: p.R2, color: "#22c55e33" },
        { price: p.R1, color: "#22c55e55" }, { price: p.PP, color: "#3b82f666" },
        { price: p.S1, color: "#ef444455" }, { price: p.S2, color: "#ef444433" },
        { price: p.S3, color: "#ef444422" }, { price: p.S4, color: "#ef444422" },
        { price: p.S5, color: "#ef444433" },
      ] as { price: number; color: string }[]).forEach(({ price, color }) => {
        if (!isFinite(price)) return;
        candles.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      });

      if (result.buyPoint) candles.createPriceLine({
        price: result.buyPoint, color: "#22c55e", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "BUY",
      });
      if (result.stopLoss) candles.createPriceLine({
        price: result.stopLoss, color: "#ef4444", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "SL",
      });

      chart.timeScale().fitContent();
      chartRef.current = chart;

      const ro = new ResizeObserver(() => {
        if (chartRef.current && el) {
          chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight });
        }
      });
      ro.observe(el);
      cleanup = () => ro.disconnect();
    };

    init();
    return () => {
      cleanup?.();
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [bars, loading, result]);

  const { currentPivots, buyPoint, stopLoss, ppTrend, cmp } = result;
  const riskPct = buyPoint && stopLoss
    ? ((Math.abs(buyPoint - stopLoss) / buyPoint) * 100).toFixed(1)
    : null;

  return (
    <>
      {/*
        Layout (portrait mobile ≤640px):
          [header — symbol + close only, 40px]
          [stats bar — CMP Buy SL Risk PP, 32px]
          [chart canvas — flex 1]
          [pivot table — 136px fixed]
          [footer nav — 38px]

        Layout (landscape / desktop):
          [header — symbol + all stats + close, 44px]
          [body row: chart flex-1 | pivot sidebar 170px]
          [footer nav — 38px]
      */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0c0c0c" }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 12px", height: 44, flexShrink: 0,
          borderBottom: "1px solid #1e1e1e",
        }}>
          <span style={{ color: "#e2e2e2", fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0 }}>
            {result.symbol}
            <span className="cp-name" style={{ color: "#333", fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
              {result.name}
            </span>
          </span>

          {/* Stats — hidden on portrait, shown on landscape/desktop */}
          <div className="cp-stats" style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
            <Stat label="CMP"  value={`₹${fmt(cmp)}`}       color="#e2e2e2" />
            {buyPoint && <Stat label="Buy"  value={`₹${fmt(buyPoint)}`}  color="#22c55e" />}
            {stopLoss && <Stat label="SL"   value={`₹${fmt(stopLoss)}`}  color="#ef4444" />}
            {riskPct  && <Stat label="Risk" value={`${riskPct}%`}        color="#f59e0b" />}
            <Stat label="PP" value={ppTrend}
              color={ppTrend === "Higher" ? "#22c55e" : ppTrend === "Lower" ? "#ef4444" : "#555"} />
          </div>

          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "#333", cursor: "pointer",
              padding: 6, display: "flex", alignItems: "center", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#e2e2e2")}
            onMouseLeave={e => (e.currentTarget.style.color = "#333")}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Mobile-only stats bar ───────────────────────────────────── */}
        <div className="cp-statsbar" style={{
          display: "none", /* shown via media query */
          gap: 0, borderBottom: "1px solid #1a1a1a", flexShrink: 0,
        }}>
          {[
            { label: "CMP",  value: `₹${fmt(cmp)}`,       color: "#e2e2e2" },
            ...(buyPoint ? [{ label: "Buy",  value: `₹${fmt(buyPoint)}`,  color: "#22c55e" }] : []),
            ...(stopLoss ? [{ label: "SL",   value: `₹${fmt(stopLoss)}`,  color: "#ef4444" }] : []),
            ...(riskPct  ? [{ label: "Risk", value: `${riskPct}%`,        color: "#f59e0b" }] : []),
            { label: "PP", value: ppTrend,
              color: ppTrend === "Higher" ? "#22c55e" : ppTrend === "Lower" ? "#ef4444" : "#555" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, textAlign: "center", padding: "5px 4px",
              borderRight: "1px solid #1a1a1a" }}>
              <div style={{ color: "#2a2a2a", fontSize: 9, marginBottom: 1 }}>{label}</div>
              <div style={{ color, fontSize: 11, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

          {/* Chart + mobile pivot below */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
            {/* Chart canvas — this must be flex:1 with minHeight:0 so it doesn't collapse */}
            <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
              {loading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#2a2a2a", fontSize: 11 }}>Loading…</span>
                </div>
              )}
              {error && !loading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#ef4444", fontSize: 11 }}>{error}</span>
                </div>
              )}
              <div
                ref={containerRef}
                style={{ width: "100%", height: "100%", display: loading || error ? "none" : "block" }}
              />
            </div>

            {/* Mobile-only pivot table — fixed height below chart */}
            <div className="cp-pivot-mobile" style={{
              display: "none", /* shown via media query */
              flexShrink: 0, height: 150,
              borderTop: "1px solid #1a1a1a", overflowY: "auto",
            }}>
              <PivotTable pivots={currentPivots} cmp={cmp} />
            </div>
          </div>

          {/* Desktop-only pivot sidebar */}
          <div className="cp-pivot-desktop" style={{
            width: 170, flexShrink: 0,
            borderLeft: "1px solid #1a1a1a",
            display: "flex", flexDirection: "column", overflowY: "auto",
          }}>
            <div style={{ padding: "7px 10px 4px", color: "#2a2a2a", fontSize: 9,
              letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid #1a1a1a" }}>
              Pivot Levels
            </div>
            <PivotTable pivots={currentPivots} cmp={cmp} />
          </div>

        </div>

        {/* ── Footer nav ─────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px", height: 38, borderTop: "1px solid #1e1e1e", flexShrink: 0,
        }}>
          <button onClick={onPrev} disabled={idx === 0}
            style={{ background: "none", border: "none", padding: "4px 8px",
              cursor: idx === 0 ? "not-allowed" : "pointer",
              color: idx === 0 ? "#252525" : "#666",
              display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ color: "#333", fontSize: 11 }}>{idx + 1} / {total}</span>
          <button onClick={onNext} disabled={idx === total - 1}
            style={{ background: "none", border: "none", padding: "4px 8px",
              cursor: idx === total - 1 ? "not-allowed" : "pointer",
              color: idx === total - 1 ? "#252525" : "#666",
              display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            Next <ChevronRight size={14} />
          </button>
        </div>

      </div>

      <style>{`
        /* ── Desktop / landscape default ── */
        .cp-stats        { display: flex   !important; }
        .cp-statsbar     { display: none   !important; }
        .cp-name         { display: inline !important; }
        .cp-pivot-desktop{ display: flex   !important; }
        .cp-pivot-mobile { display: none   !important; }

        /* ── Portrait mobile ≤ 640px ── */
        @media (max-width: 640px) and (orientation: portrait) {
          .cp-stats        { display: none  !important; }
          .cp-statsbar     { display: flex  !important; }
          .cp-name         { display: none  !important; }
          .cp-pivot-desktop{ display: none  !important; }
          .cp-pivot-mobile { display: block !important; }
        }
      `}</style>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ color: "#2a2a2a", fontSize: 9, marginBottom: 1 }}>{label}</div>
      <div style={{ color, fontSize: 11, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
