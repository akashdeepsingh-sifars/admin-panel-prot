import type { DiagnosisRun, Finding, RunScope, Severity } from '../types';

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

export function scopeLabels(run: DiagnosisRun): string[] {
  const labels: string[] = [];
  const order: RunScope[] = ['shipments', 'driver', 'api', 'gps', 'notifications'];
  for (const s of order) {
    if (!run.scopes.includes(s)) continue;
    const target = run.targets.find((t) => t.scope === s);
    labels.push(target ? target.label : { shipments: 'Shipments', driver: 'Driver', api: 'API', gps: 'GPS', notifications: 'Notifications' }[s]);
  }
  return labels;
}
