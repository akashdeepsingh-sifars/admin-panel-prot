import { loadById } from '../sampleData';
import type { DiagnosisRun, Finding, RunKind, Severity } from '../types';

export function severityCounts(findings: Finding[]): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0 };
  findings.forEach((f) => {
    c[f.severity] += 1;
  });
  return c;
}

export function runFindings(run: DiagnosisRun, all: Finding[]): Finding[] {
  return all.filter((f) => f.runId === run.id);
}

export const KIND_LABEL: Record<RunKind, string> = { shipment: 'Shipment', api: 'API', notifications: 'Notifications' };

export function runTarget(run: DiagnosisRun): string {
  if (run.kind === 'shipment') return loadById(run.loadId ?? '')?.number ?? run.loadId ?? '—';
  return 'Time window';
}

export function nextRunId(runs: DiagnosisRun[]): string {
  return `R-${Math.max(...runs.map((r) => Number(r.id.slice(2)))) + 1}`;
}

// A queued copy of an earlier run (same kind, shipment and window), used by Re-run and New run.
export function queuedRun(runs: DiagnosisRun[], from: Pick<DiagnosisRun, 'kind' | 'loadId' | 'windowStart' | 'windowEnd'>, createdBy: string): DiagnosisRun {
  return {
    id: nextRunId(runs),
    kind: from.kind,
    loadId: from.loadId,
    windowStart: from.windowStart,
    windowEnd: from.windowEnd,
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    durationSec: null,
    createdBy,
    findingIds: [],
  };
}
