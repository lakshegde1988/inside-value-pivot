"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus, ArrowLeft } from "lucide-react";
import ChartPanel, { type ScanResult } from "@/components/ChartPanel";

type SortKey = "symbol" | "riskPct" | "ppTrend";
type SortDir  = "asc" | "desc";

function riskOf(bp: number | null, sl: number | null) {
  return bp && sl ? (Math.abs(bp - sl) / bp) * 100 : null;
}

interface Meta { indexLabel: string; month: string; }

export default function ResultsPage() {
  const router = useRouter();

  const [results,  setResults]  = useState<ScanResult[]>([]);
  const [meta,     setMeta]     = useState<Meta | null>(null);
  const [selected, setSelected] = useState(0);
  const [ready,    setReady]    = useState(false);
  const [sortKey,  setSortKey]  = useState<SortKey>("symbol");
  const [sortDir,  setSortDir]  = useState<SortDir>("asc");

  const slimListRef    = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw     = sessionStorage.getItem("pivot_results");
      const rawMeta = sessionStorage.getItem("pivot_meta");
      if (!raw) { router.replace("/"); return; }
      const parsed = JSON.parse(raw) as ScanResult[];
      if (!parsed.length) { router.replace("/"); return; }
      setResults(parsed);
      if (rawMeta) setMeta(JSON.parse(rawMeta));
      setReady(true);
    } catch {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const sort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const sorted = [...results].sort((a, b) => {
    if (sortKey === "symbol") {
      const r = a.symbol.localeCompare(b.symbol);
      return sortDir === "asc" ? r : -r;
    }
    if (sortKey === "riskPct") {
      const av = riskOf(a.buyPoint, a.stopLoss) ?? 0;
      const bv = riskOf(b.buyPoint, b.stopLoss) ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    }
    if (sortKey === "ppTrend") {
      const r = a.ppTrend.localeCompare(b.ppTrend);
      return sortDir === "asc" ? r : -r;
    }
    return 0;
  });

  const goPrev = useCallback(() => setSelected(s => Math.max(0, s - 1)), []);
  const goNext = useCallback(() => setSelected(s => Math.min(sorted.length - 1, s + 1)), [sorted.length]);

  useEffect(() => {
    setSelected(s => Math.min(s, Math.max(0, sorted.length - 1)));
  }, [sorted.length]);

  if (!ready) {
    return (
      <div style={{
        height: "100dvh", background: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: "var(--t3)", fontSize: 12 }}>Loading…</span>
      </div>
    );
  }

  const SORT_BTNS: { k: SortKey; label: string }[] = [
    { k: "symbol",  label: "A–Z"  },
    { k: "riskPct", label: "Risk" },
    { k: "ppTrend", label: "PP"   },
  ];

  return (
    <>
      {/*
        Portrait mobile: full-width chart panel, slim list hidden
        Landscape / desktop: slim list 160px left + chart panel right
      */}
      <div style={{
        background: "var(--bg)",
        /* Use dvh so mobile browser chrome doesn't cause overflow */
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        /* center within page for wide viewports */
        maxWidth: "80rem",
        margin: "0 auto",
      }}>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 14px", height: 44, flexShrink: 0,
          borderBottom: "1px solid var(--border)",
        }}>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "none", border: "none", color: "var(--t3)",
              cursor: "pointer", display: "flex", alignItems: "center",
              gap: 4, fontSize: 11, padding: "4px 0",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--t2)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
          >
            <ArrowLeft size={13} />
            <span className="rp-back-label">Scanner</span>
          </button>

          <span style={{ color: "var(--border2)", fontSize: 12 }}>|</span>

          {meta && (
            <span style={{ color: "var(--t3)", fontSize: 11 }}>
              <span className="rp-meta-index">{meta.indexLabel} · </span>
              <span style={{ color: "var(--t2)" }}>{meta.month}</span>
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Sort buttons */}
          <div style={{ display: "flex", gap: 3 }}>
            {SORT_BTNS.map(({ k, label }) => {
              const active = sortKey === k;
              return (
                <button
                  key={k}
                  onClick={() => sort(k)}
                  style={{
                    padding: "3px 7px", borderRadius: 3, border: "1px solid",
                    borderColor: active ? "var(--green)" : "var(--border)",
                    background: active ? "#0a1f12" : "transparent",
                    color: active ? "var(--green)" : "var(--t3)",
                    fontSize: 10, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 2,
                  }}
                >
                  {label}
                  {active
                    ? sortDir === "asc"
                      ? <ChevronUp size={9} />
                      : <ChevronDown size={9} />
                    : null}
                </button>
              );
            })}
          </div>

          <span style={{ color: "var(--t3)", fontSize: 11, flexShrink: 0 }}>
            <span style={{ color: "var(--green)", fontWeight: 600 }}>{sorted.length}</span>
          </span>
        </div>

        {/* ── Body: slim list + chart ──────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

          {/* Slim list — hidden on portrait mobile via CSS */}
          <div
            ref={slimListRef}
            className="rp-slim-list"
            style={{
              width: 160, flexShrink: 0,
              borderRight: "1px solid var(--border)",
              overflowY: "auto",
            }}
          >
            {sorted.map((r, i) => {
              const isActive = i === selected;
              return (
                <div
                  key={r.symbol}
                  ref={isActive ? selectedRowRef : undefined}
                  onClick={() => setSelected(i)}
                  style={{
                    padding: "10px 12px", cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    borderLeft: `2px solid ${isActive ? "var(--green)" : "transparent"}`,
                    background: isActive ? "var(--surface)" : "transparent",
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#0e0e0e"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: 600, marginBottom: 3,
                    color: isActive ? "var(--t1)" : "var(--t2)",
                  }}>
                    {r.symbol}
                  </div>
                  <span style={{
                    fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3,
                    color: r.ppTrend === "Higher" ? "var(--green)"
                      : r.ppTrend === "Lower" ? "var(--red)" : "var(--t3)",
                  }}>
                    {r.ppTrend === "Higher" ? <TrendingUp size={9} />
                      : r.ppTrend === "Lower" ? <TrendingDown size={9} />
                      : <Minus size={9} />}
                    {r.ppTrend}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Chart panel — always visible, full width on mobile */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
            {sorted[selected] && (
              <ChartPanel
                result={sorted[selected]}
                idx={selected}
                total={sorted.length}
                onPrev={goPrev}
                onNext={goNext}
                onClose={() => router.push("/")}
              />
            )}
          </div>

        </div>
      </div>

      <style>{`
        /* ── Defaults (desktop / landscape) ── */
        .rp-slim-list   { display: block  !important; }
        .rp-back-label  { display: inline !important; }
        .rp-meta-index  { display: inline !important; }

        /* ── Portrait mobile ≤ 640px ── */
        @media (max-width: 640px) and (orientation: portrait) {
          .rp-slim-list  { display: none  !important; }
          .rp-back-label { display: none  !important; }
          .rp-meta-index { display: none  !important; }
        }
      `}</style>
    </>
  );
}
