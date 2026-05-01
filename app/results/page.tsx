"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ChartPanel, { type ScanResult } from "@/components/ChartPanel";

type SortKey = "name" | "ppTrend";
type SortDir  = "asc" | "desc";

interface Meta { indexLabel: string; month: string; }

export default function ResultsPage() {
  const router = useRouter();

  const [results,  setResults]  = useState<ScanResult[]>([]);
  const [meta,     setMeta]     = useState<Meta | null>(null);
  const [ready,    setReady]    = useState(false);
  const [sortKey,  setSortKey]  = useState<SortKey>("name");
  const [sortDir,  setSortDir]  = useState<SortDir>("asc");

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

  const sort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const sorted = [...results].sort((a, b) => {
    if (sortKey === "name") {
      const r = (a.name || "").localeCompare(b.name || "");
      return sortDir === "asc" ? r : -r;
    }
    if (sortKey === "ppTrend") {
      const r = a.ppTrend.localeCompare(b.ppTrend);
      return sortDir === "asc" ? r : -r;
    }
    return 0;
  });

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

  return (
    <>
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
          padding: "0 14px", height: 36, flexShrink: 0,
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

          {meta && (
            <span style={{ color: "var(--t3)", fontSize: 11 }}>
              <span className="rp-meta-index">{meta.indexLabel}</span>
            </span>
          )}

          <div style={{ flex: 1 }} />

          <span style={{ color: "var(--t3)", fontSize: 11, flexShrink: 0 }}>
            <span style={{ color: "var(--green)", fontWeight: 600 }}>{sorted.length}</span>
            <span style={{ marginLeft: 3 }}>setups</span>
          </span>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "0 14px 14px" }}>
          <div style={{
            height: "100%",
            border: "1px solid var(--border)",
            borderRadius: 6,
            overflow: "hidden",
            background: "var(--surface)",
          }}>
            <ChartPanel
              results={sorted}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={sort}
            />
          </div>
        </div>
      </div>

      <style>{`
        .rp-back-label  { display: inline !important; }
        .rp-meta-index  { display: inline !important; }

        @media (max-width: 640px) and (orientation: portrait) {
          .rp-back-label { display: none  !important; }
          .rp-meta-index { display: none  !important; }
        }
      `}</style>
    </>
  );
}
