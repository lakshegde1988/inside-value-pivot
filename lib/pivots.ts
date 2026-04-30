export interface PivotLevels {
  PP: number;
  R1: number;
  R2: number;
  R3: number;
  R4: number;
  R5: number;
  S1: number;
  S2: number;
  S3: number;
  S4: number;
  S5: number;
}

/**
 * Calculate Floor Pivot levels from previous period's HLC.
 * These are used as the CURRENT period's pivot levels.
 */
export function calculateFloorPivots(H: number, L: number, C: number): PivotLevels {
  const PP = (H + L + C) / 3;

  return {
    PP,
    R1: 2 * PP - L,
    R2: PP + (H - L),
    R3: H + 2 * (PP - L),
    R4: PP * 3 + (H - 3 * L),
    R5: PP * 4 + (H - 4 * L),
    S1: 2 * PP - H,
    S2: PP - (H - L),
    S3: L - 2 * (H - PP),
    S4: PP * 3 - (3 * H - L),
    S5: PP * 4 - (4 * H - L),
  };
}

/**
 * Inside Month condition:
 * Current month's R5–S5 range is ENTIRELY within previous month's R5–S5 range.
 * = compression coil setup
 */
export function isInsideMonth(current: PivotLevels, previous: PivotLevels): boolean {
  return current.R5 < previous.R5 && current.S5 > previous.S5;
}

/**
 * Find the nearest pivot level ABOVE the current market price.
 * This is the Buy Point (breakout trigger).
 */
export function findBuyPoint(cmp: number, pivots: PivotLevels): number | null {
  const levels = [pivots.PP, pivots.R1, pivots.R2, pivots.R3, pivots.R4, pivots.R5];
  const above = levels.filter((l) => l > cmp).sort((a, b) => a - b);
  return above[0] ?? null;
}

/**
 * Find the nearest pivot level BELOW the current market price.
 * This is the Stop Loss level.
 */
export function findStopLoss(cmp: number, pivots: PivotLevels): number | null {
  const levels = [pivots.S1, pivots.S2, pivots.S3, pivots.S4, pivots.S5, pivots.PP];
  const below = levels.filter((l) => l < cmp).sort((a, b) => b - a);
  return below[0] ?? null;
}

/**
 * Risk/Reward ratio given entry, SL, target
 */
export function calcRR(entry: number, sl: number, target: number): string {
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(target - entry);
  if (risk === 0) return "∞";
  return `1 : ${(reward / risk).toFixed(1)}`;
}

/**
 * Format pivot level name for display
 */
export const PIVOT_LABELS: (keyof PivotLevels)[] = [
  "R5", "R4", "R3", "R2", "R1", "PP", "S1", "S2", "S3", "S4", "S5",
];

export function pivotColor(key: keyof PivotLevels): string {
  if (key === "PP") return "#3d9bff";
  if (key.startsWith("R")) return "#00d26a";
  return "#ff4757";
}
