"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import ChartPanel, { type ScanResult } from "@/components/ChartPanel";

type SortKey = "name" | "ppTrend";
type SortDir  = "asc" | "desc";

interface Meta { indexLabel: string; month: string; }

const PAGE_SIZE = 20;

export default function ResultsPage() {
  const router = useRouter();

  const [results,  setResults]  = useState<ScanResult[]>([]);
  const [meta,     setMeta]     = useState<Meta | null>(null);
  const [ready,    setReady]    = useState(false);
  const [sortKey,  setSortKey]  = useState<SortKey>("name");
  const [sortDir,  setSortDir]  = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);

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
    setCurrentPage(1);
  };

  const sorted = [...results].sort((a, b) => {
    if (sortKey === "name") {
      const r = a.name.localeCompare(b.name);
      return sortDir === "asc" ? r : -r;
    }
    if (sortKey === "ppTrend") {
      const r = a.ppTrend.localeCompare(b.ppTrend);
      return sortDir === "asc" ? r : -r;
    }
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedResults = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

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
    <div style={{
      background: "var(--bg)",
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      maxWidth: "72rem",
      margin: "0 auto",
    }}>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 16px", height: 48, flexShrink: 0,
        borderBottom: "1px solid var(--border)",
      }}>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "none", border: "none", color: "var(--t3)",
            cursor: "pointer", display: "flex", alignItems: "center",
            gap: 6, fontSize: 12, padding: "6px 0",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--t2)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
        >
          <ArrowLeft size={14} />
          <span>Scanner</span>
        </button>

        {meta && (
          <span style={{ color: "var(--t3)", fontSize: 12 }}>
            {meta.indexLabel} · {meta.month}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <span style={{ color: "var(--t3)", fontSize: 12 }}>
          <span style={{ color: "var(--green)", fontWeight: 600 }}>{sorted.length}</span>
          <span style={{ marginLeft: 4 }}>setups</span>
        </span>
      </div>

      {/* ── Results table ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <ChartPanel
          results={paginatedResults}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={sort}
        />
      </div>

      {/* ── Footer pagination ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 48, flexShrink: 0,
        borderTop: "1px solid var(--border)",
      }}>
        <span style={{ color: "var(--t3)", fontSize: 12 }}>
          Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length}
        </span>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              background: "none", border: "1px solid var(--border)",
              padding: "6px 12px", borderRadius: 4,
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              color: currentPage === 1 ? "var(--t3)" : "var(--t2)",
              fontSize: 12, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          <span style={{ color: "var(--t2)", fontSize: 12, fontWeight: 600 }}>
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              background: "none", border: "1px solid var(--border)",
              padding: "6px 12px", borderRadius: 4,
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              color: currentPage === totalPages ? "var(--t3)" : "var(--t2)",
              fontSize: 12, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
