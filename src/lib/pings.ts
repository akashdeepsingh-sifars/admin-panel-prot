import type { Ping } from '../types';

export interface IntervalStats {
  avgSec: number;
  minSec: number;
  maxSec: number;
  count: number;
}

// Seconds between each ping and the one before it (first ping has none).
export function pingIntervals(pings: Ping[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 1; i < pings.length; i++) out.set(pings[i].id, (new Date(pings[i].recordedAt).getTime() - new Date(pings[i - 1].recordedAt).getTime()) / 1000);
  return out;
}

export function intervalStats(pings: Ping[]): IntervalStats | null {
  const v = [...pingIntervals(pings).values()];
  if (v.length === 0) return null;
  return { avgSec: v.reduce((s, x) => s + x, 0) / v.length, minSec: Math.min(...v), maxSec: Math.max(...v), count: v.length };
}

export function fmtInterval(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${Math.round(sec % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
