"use client";

import React from "react";
import { PivotLevels } from "@/lib/pivots";

export interface HLCSnapshot { H: number; L: number; C: number; }

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
  /** Raw H/L/C used to compute currentPivots — lets you cross-check vs NSE bhav copy */
  currentHLC: HLCSnapshot;
  /** Raw H/L/C used to compute previousPivots */
  previousHLC: HLCSnapshot;
}

type SortKey = "name" | "ppTrend";
type SortDir  = "asc" | "desc";

interface ChartPanelProps {
  results: ScanResult[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}

function fmt(n: number | null | undefined) {
  return n == null || !isFinite(n) ? "—" : n.toFixed(2);
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ChartPanel({ results, sortKey, sortDir, onSort }: ChartPanelProps) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, padding: "16px" }}>
      <div style={{
        flex: 1, minHeight: 0, overflow: "auto",
        background: "var(--bg)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
            <tr>
              <Th>Symbol</Th>
              <ThButton
                active={sortKey === "name"}
                dir={sortKey === "name" ? sortDir : undefined}
                onClick={() => onSort("name")}
              >
                Name
              </ThButton>
              <Th align="right">CMP</Th>
              <Th align="right">Buy</Th>
              <Th align="right">SL</Th>
              <Th align="right">Risk%</Th>
              <ThButton
                active={sortKey === "ppTrend"}
                dir={sortKey === "ppTrend" ? sortDir : undefined}
                onClick={() => onSort("ppTrend")}
              >
                PP
              </ThButton>
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              const riskPct = r.buyPoint && r.stopLoss
                ? ((Math.abs(r.buyPoint - r.stopLoss) / r.buyPoint) * 100)
                : null;
              const trendColor =
                r.ppTrend === "Higher" ? "var(--green)" :
                r.ppTrend === "Lower" ? "var(--red)" : "var(--t3)";
              return (
                <tr key={r.symbol} style={{ borderBottom: "1px solid var(--border)" }}>
                  <Td><span style={{ color: "var(--t1)", fontWeight: 700 }}>{r.symbol}</span></Td>
                  <Td><span style={{ color: "var(--t3)" }}>{r.name}</span></Td>
                  <Td align="right">{fmt(r.cmp)}</Td>
                  <Td align="right" style={{ color: "var(--green)" }}>{fmt(r.buyPoint)}</Td>
                  <Td align="right" style={{ color: "var(--red)" }}>{fmt(r.stopLoss)}</Td>
                  <Td align="right" style={{ color: "var(--t3)" }}>
                    {riskPct == null ? "—" : riskPct.toFixed(1)}
                  </Td>
                  <Td style={{ color: trendColor, fontWeight: 600 }}>{r.ppTrend}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th style={{
      textAlign: align ?? "left",
      padding: "14px 16px",
      fontSize: 11,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--t3)",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg)",
      whiteSpace: "nowrap",
    }}>
      {children}
    </th>
  );
}

function ThButton({
  children,
  active,
  dir,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  dir?: SortDir;
  onClick: () => void;
}) {
  const arrow = !active ? "" : dir === "asc" ? "▲" : "▼";
  return (
    <th style={{
      padding: 0,
      borderBottom: "1px solid var(--border)",
      background: "var(--bg)",
      whiteSpace: "nowrap",
      position: "relative",
    }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "14px 16px",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: active ? "var(--t2)" : "var(--t3)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{children}</span>
        {arrow && <span style={{ fontSize: 10, color: "var(--t3)" }}>{arrow}</span>}
      </button>
    </th>
  );
}

function Td({ children, align, style }: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  style?: React.CSSProperties;
}) {
  return (
    <td style={{
      textAlign: align ?? "left",
      padding: "14px 16px",
      fontSize: 13,
      color: "var(--t2)",
      verticalAlign: "middle",
      whiteSpace: "nowrap",
      ...style,
    }}>
      {children}
    </td>
  );
}
