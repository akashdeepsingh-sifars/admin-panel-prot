import type { ApiReport, DiagnosisRun, Finding, FindingReview, MessagingReport, RunReports, RunScope, Schedule, TargetLabel } from '../types';
import { driverDrafts, shipmentDrafts } from './analyze';
import type { FindingDraft } from './analyze';
import { LOADS } from './loads';
import { NOW } from './people';
import { makeApiReport, makeGpsReport, makeMessagingReport } from './reports';

interface RunDef {
  id: string;
  trigger: 'manual' | 'scheduled';
  scopes: RunScope[];
  targets: TargetLabel[];
  windowStart: string;
  windowEnd: string;
  status: DiagnosisRun['status'];
  createdAt: string;
  durationSec: number | null;
  createdBy: string;
  scheduleId?: string;
  loadIds?: string[];
  driverIds?: string[];
  error?: string;
}

const allLoadIds = LOADS.map((l) => l.id);
const W24 = { windowStart: '2026-09-28T00:00:00.000Z', windowEnd: '2026-09-29T00:00:00.000Z' };

const DEFS: RunDef[] = [
  { id: 'R-1043', trigger: 'manual', scopes: ['shipments'], targets: [{ scope: 'shipments', label: 'Load FF-10260' }], windowStart: '2026-09-28T12:00:00.000Z', windowEnd: NOW, status: 'running', createdAt: '2026-09-29T11:58:00.000Z', durationSec: null, createdBy: 'Bharat Shah', loadIds: ['L3'] },
  { id: 'R-1042', trigger: 'manual', scopes: ['shipments'], targets: [{ scope: 'shipments', label: 'Load FF-10245' }], windowStart: '2026-09-28T08:00:00.000Z', windowEnd: '2026-09-28T14:00:00.000Z', status: 'completed', createdAt: '2026-09-29T10:12:00.000Z', durationSec: 41, createdBy: 'Bharat Shah', loadIds: ['L2'] },
  { id: 'R-1041', trigger: 'manual', scopes: ['driver'], targets: [{ scope: 'driver', label: 'Driver: Ivan Petrov' }], windowStart: '2026-09-01T00:00:00.000Z', windowEnd: NOW, status: 'completed', createdAt: '2026-09-29T09:30:00.000Z', durationSec: 63, createdBy: 'Akashdeep Singh', driverIds: ['drv-2'] },
  { id: 'R-1040', trigger: 'scheduled', scopes: ['shipments'], targets: [{ scope: 'shipments', label: 'All loads in window' }], ...W24, status: 'completed', createdAt: '2026-09-29T02:00:00.000Z', durationSec: 212, createdBy: 'Scheduler', scheduleId: 'SCH-1', loadIds: allLoadIds },
  { id: 'R-1039', trigger: 'manual', scopes: ['shipments', 'api', 'notifications'], targets: [{ scope: 'shipments', label: 'Driver Lena Ortiz’s loads' }], windowStart: '2026-09-28T00:00:00.000Z', windowEnd: '2026-09-29T00:00:00.000Z', status: 'completed', createdAt: '2026-09-29T08:45:00.000Z', durationSec: 118, createdBy: 'Rhea Kapoor', loadIds: ['L3', 'L8', 'L9'] },
  { id: 'R-1038', trigger: 'scheduled', scopes: ['api'], targets: [], windowStart: '2026-09-29T10:00:00.000Z', windowEnd: '2026-09-29T11:00:00.000Z', status: 'completed', createdAt: '2026-09-29T11:00:00.000Z', durationSec: 9, createdBy: 'Scheduler', scheduleId: 'SCH-2' },
  { id: 'R-1037', trigger: 'manual', scopes: ['notifications'], targets: [], windowStart: '2026-09-28T00:00:00.000Z', windowEnd: '2026-09-29T00:00:00.000Z', status: 'completed', createdAt: '2026-09-29T07:20:00.000Z', durationSec: 14, createdBy: 'Bharat Shah' },
  { id: 'R-1036', trigger: 'manual', scopes: ['gps'], targets: [], windowStart: '2026-09-28T00:00:00.000Z', windowEnd: '2026-09-29T00:00:00.000Z', status: 'completed', createdAt: '2026-09-29T07:05:00.000Z', durationSec: 22, createdBy: 'Bharat Shah' },
  { id: 'R-1035', trigger: 'manual', scopes: ['shipments'], targets: [{ scope: 'shipments', label: 'Load FF-10231' }], windowStart: '2026-09-28T12:00:00.000Z', windowEnd: '2026-09-28T18:00:00.000Z', status: 'completed', createdAt: '2026-09-29T06:40:00.000Z', durationSec: 17, createdBy: 'Rhea Kapoor', loadIds: ['L1'] },
  { id: 'R-1034', trigger: 'manual', scopes: ['shipments', 'driver'], targets: [{ scope: 'shipments', label: 'All loads in window' }, { scope: 'driver', label: 'Driver: Marcus Reed' }], ...W24, status: 'failed', createdAt: '2026-09-28T22:10:00.000Z', durationSec: 30, createdBy: 'Akashdeep Singh', loadIds: allLoadIds, driverIds: ['drv-1'], error: 'Diagnosis worker lost database connection after 30 s (ECONNRESET). No findings were written.' },
  { id: 'R-1033', trigger: 'scheduled', scopes: ['api'], targets: [], windowStart: '2026-09-29T12:00:00.000Z', windowEnd: '2026-09-29T13:00:00.000Z', status: 'scheduled', createdAt: '2026-09-29T11:00:00.000Z', durationSec: null, createdBy: 'Scheduler', scheduleId: 'SCH-2' },
];

const REPORTS: Record<string, RunReports> = {
  'R-1039': {
    api: makeApiReport(39, 18420, 24, '2026-09-29T00:00:00.000Z'),
    messaging: makeMessagingReport(39, '2026-09-29T00:00:00.000Z'),
  },
  'R-1038': { api: makeApiReport(38, 2140, 1, '2026-09-29T11:00:00.000Z') },
  'R-1037': { messaging: makeMessagingReport(37, '2026-09-29T00:00:00.000Z') },
  'R-1036': { gps: makeGpsReport() },
};

function apiDrafts(r: ApiReport): FindingDraft[] {
  const out: FindingDraft[] = [];
  const rate = r.totals.serverErrors / r.totals.requests;
  if (rate > 0.02) {
    out.push({ ruleCode: 'API_SERVER_ERRORS', severity: 'high', summary: `${(rate * 100).toFixed(1)}% of requests failed with a server error (${r.totals.serverErrors} of ${r.totals.requests})`, evidence: { serverErrors: r.totals.serverErrors, requests: r.totals.requests }, pingIds: [], photoIds: [] });
  }
  if (r.unhandledErrors.length > 0) {
    out.push({ ruleCode: 'API_UNHANDLED_ERRORS', severity: 'high', summary: `${r.unhandledErrors.length} unhandled error types, ${r.unhandledErrors.reduce((s, e) => s + e.count, 0)} occurrences`, evidence: { routes: r.unhandledErrors.map((e) => `${e.method} ${e.route}`) }, pingIds: [], photoIds: [] });
  }
  if (r.rateLimited.length > 0) {
    out.push({ ruleCode: 'API_RATE_LIMITED', severity: 'medium', summary: `${r.rateLimited.length} requests rate limited from ${new Set(r.rateLimited.map((e) => e.ip)).size} IPs`, evidence: { ips: [...new Set(r.rateLimited.map((e) => e.ip))] }, pingIds: [], photoIds: [] });
  }
  return out;
}

function messagingDrafts(r: MessagingReport): FindingDraft[] {
  return r.byChannel
    .filter((c) => c.failed / c.sent > 0.1)
    .map((c) => ({ ruleCode: 'MSG_HIGH_FAILURE', severity: 'medium' as const, summary: `${c.channel === 'email' ? 'Email' : 'Push'} failure rate ${((c.failed / c.sent) * 100).toFixed(1)}% (${c.failed} of ${c.sent})`, evidence: { channel: c.channel, failed: c.failed, sent: c.sent }, pingIds: [], photoIds: [] }));
}

function gpsDrafts(): FindingDraft[] {
  return makeGpsReport().drift.map((d) => ({ ruleCode: 'SAMPLING_DRIFT', severity: 'medium' as const, driverId: d.driverId, summary: `GPS interval ${d.actualIntervalS}s vs expected ${d.expectedIntervalS}s on ${d.device}`, evidence: { expectedS: d.expectedIntervalS, actualS: d.actualIntervalS, device: d.device }, pingIds: [], photoIds: [] }));
}

function toFinding(run: Pick<RunDef, 'id' | 'createdAt' | 'durationSec'>, d: FindingDraft, n: number, section: Finding['section']): Finding {
  return {
    id: `${run.id}-F${n}`,
    runId: run.id,
    section,
    ruleCode: d.ruleCode,
    severity: d.severity,
    detectedAt: new Date(new Date(run.createdAt).getTime() + (run.durationSec ?? 10) * 1000).toISOString(),
    summary: d.summary,
    loadId: d.loadId,
    driverId: d.driverId,
    evidence: d.evidence,
    pingIds: d.pingIds,
    photoIds: d.photoIds,
  };
}

export interface RunInput {
  id: string;
  scopes: RunScope[];
  loadIds: string[];
  driverIds: string[];
  createdAt: string;
  durationSec: number | null;
  windowStart: string;
  windowEnd: string;
}

// Runs the same finding logic for a run created in the UI, with freshly generated fleet reports.
export function generateResult(run: RunInput): { findings: Finding[]; reports: RunReports } {
  const seed = Number(run.id.replace(/\D/g, '')) || 7;
  const hours = Math.max(1, Math.round((new Date(run.windowEnd).getTime() - new Date(run.windowStart).getTime()) / 3600000));
  const reports: RunReports = {};
  if (run.scopes.includes('api')) reports.api = makeApiReport(seed, Math.min(60000, 800 * hours + 4000), Math.min(hours, 48), run.windowEnd);
  if (run.scopes.includes('notifications')) reports.messaging = makeMessagingReport(seed, run.windowEnd);
  if (run.scopes.includes('gps')) reports.gps = makeGpsReport();
  return { findings: findingsForInput(run, reports), reports };
}

function findingsFor(run: RunDef): Finding[] {
  if (run.status !== 'completed') return [];
  return findingsForInput({ ...run, loadIds: run.loadIds ?? [], driverIds: run.driverIds ?? [] }, REPORTS[run.id]);
}

function findingsForInput(run: RunInput, rep: RunReports | undefined): Finding[] {
  const out: Finding[] = [];
  let n = 1;
  const push = (drafts: FindingDraft[], section: Finding['section']): void => {
    drafts.forEach((d) => out.push(toFinding(run, d, n++, section)));
  };
  if (run.scopes.includes('shipments')) run.loadIds.forEach((id) => push(shipmentDrafts(LOADS.find((l) => l.id === id)!), 'shipment'));
  if (run.scopes.includes('driver')) run.driverIds.forEach((id) => push(driverDrafts(id, LOADS), 'driver'));
  if (run.scopes.includes('api') && rep?.api) push(apiDrafts(rep.api), 'api');
  if (run.scopes.includes('notifications') && rep?.messaging) push(messagingDrafts(rep.messaging), 'messaging');
  if (run.scopes.includes('gps')) push(gpsDrafts(), 'gps');
  return out;
}

export const FINDINGS: Finding[] = DEFS.flatMap(findingsFor);

export const RUNS: DiagnosisRun[] = DEFS.map((d) => ({
  id: d.id,
  trigger: d.trigger,
  scopes: d.scopes,
  targets: d.targets,
  windowStart: d.windowStart,
  windowEnd: d.windowEnd,
  status: d.status,
  createdAt: d.createdAt,
  startedAt: d.status === 'scheduled' ? null : d.createdAt,
  durationSec: d.durationSec,
  createdBy: d.createdBy,
  scheduleId: d.scheduleId ?? null,
  loadIds: d.loadIds ?? [],
  driverIds: d.driverIds ?? [],
  findingIds: FINDINGS.filter((f) => f.runId === d.id).map((f) => f.id),
  error: d.error,
}));

export const RUN_REPORTS = REPORTS;

export const SEED_REVIEWS: Record<string, FindingReview> = {
  'R-1042-F1': {
    acknowledgedBy: 'Bharat Shah',
    acknowledgedAt: '2026-09-29T10:30:00.000Z',
    comments: [
      { id: 'c1', author: 'Bharat Shah', body: 'Driver confirmed the phone had no network during a rest stop. Coaching scheduled.', at: '2026-09-29T10:31:00.000Z' },
      { id: 'c2', author: 'Rhea Kapoor', body: 'Checking whether this repeats on other loads for this driver.', at: '2026-09-29T10:45:00.000Z' },
    ],
  },
};

export const SCHEDULES: Schedule[] = [
  { id: 'SCH-1', name: 'Nightly shipment sweep', scopes: ['shipments'], targets: [{ scope: 'shipments', label: 'All loads in window' }], windowLabel: 'Last 24 h', frequency: { kind: 'daily', timeOfDay: '02:00' }, timezone: 'UTC', nextRunAt: '2026-09-30T02:00:00.000Z', lastRunId: 'R-1040', lastRunAt: '2026-09-29T02:00:00.000Z', enabled: true },
  { id: 'SCH-2', name: 'Hourly API health', scopes: ['api'], targets: [], windowLabel: 'Last 1 h', frequency: { kind: 'hourly' }, timezone: 'UTC', nextRunAt: '2026-09-29T12:00:00.000Z', lastRunId: 'R-1038', lastRunAt: '2026-09-29T11:00:00.000Z', enabled: true },
  { id: 'SCH-3', name: 'Weekly driver integrity review', scopes: ['driver'], targets: [{ scope: 'driver', label: 'All drivers with 3+ loads' }], windowLabel: 'Last 30 days', frequency: { kind: 'weekly', timeOfDay: '06:00', daysOfWeek: [1] }, timezone: 'UTC', nextRunAt: '2026-10-05T06:00:00.000Z', lastRunId: null, lastRunAt: null, enabled: true },
  { id: 'SCH-4', name: 'One-off GPS check after release', scopes: ['gps'], targets: [], windowLabel: 'Last 6 h', frequency: { kind: 'once', runAt: '2026-10-01T09:00:00.000Z' }, timezone: 'UTC', nextRunAt: '2026-10-01T09:00:00.000Z', lastRunId: null, lastRunAt: null, enabled: false },
];
