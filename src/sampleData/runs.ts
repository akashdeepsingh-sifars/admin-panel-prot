import type { ApiReport, DiagnosisRun, Finding, MessagingReport, RunKind, RunReports } from '../types';
import { shipmentDrafts } from './analyze';
import type { FindingDraft } from './analyze';
import { LOADS } from './loads';
import { NOW } from './people';
import { makeApiReport, makeMessagingReport } from './reports';

interface RunDef {
  id: string;
  kind: RunKind;
  loadId?: string;
  windowStart?: string;
  windowEnd?: string;
  status: DiagnosisRun['status'];
  createdAt: string;
  durationSec: number | null;
  createdBy: string;
  error?: string;
}

const W24 = { windowStart: '2026-09-28T00:00:00.000Z', windowEnd: '2026-09-29T00:00:00.000Z' };

// One shipment run diagnoses exactly one load.
const DEFS: RunDef[] = [
  { id: 'R-1050', kind: 'shipment', loadId: 'L9', status: 'completed', createdAt: '2026-09-29T11:40:00.000Z', durationSec: 19, createdBy: 'Rhea Kapoor' },
  { id: 'R-1049', kind: 'shipment', loadId: 'L8', status: 'completed', createdAt: '2026-09-29T11:20:00.000Z', durationSec: 24, createdBy: 'Rhea Kapoor' },
  { id: 'R-1048', kind: 'shipment', loadId: 'L7', status: 'completed', createdAt: '2026-09-29T11:00:00.000Z', durationSec: 22, createdBy: 'Bharat Shah' },
  { id: 'R-1047', kind: 'shipment', loadId: 'L5', status: 'completed', createdAt: '2026-09-29T10:50:00.000Z', durationSec: 31, createdBy: 'Bharat Shah' },
  { id: 'R-1046', kind: 'shipment', loadId: 'L4', status: 'completed', createdAt: '2026-09-29T10:30:00.000Z', durationSec: 28, createdBy: 'Akashdeep Singh' },
  { id: 'R-1052', kind: 'shipment', loadId: 'L10', status: 'completed', createdAt: '2026-09-29T12:05:00.000Z', durationSec: 33, createdBy: 'Bharat Shah' },
  { id: 'R-1051', kind: 'shipment', loadId: 'L3', status: 'completed', createdAt: '2026-09-29T11:50:00.000Z', durationSec: 27, createdBy: 'Rhea Kapoor' },
  { id: 'R-1043', kind: 'shipment', loadId: 'L3', status: 'running', createdAt: '2026-09-29T11:58:00.000Z', durationSec: null, createdBy: 'Bharat Shah' },
  { id: 'R-1042', kind: 'shipment', loadId: 'L2', status: 'completed', createdAt: '2026-09-29T10:12:00.000Z', durationSec: 41, createdBy: 'Bharat Shah' },
  { id: 'R-1041', kind: 'shipment', loadId: 'L6', status: 'completed', createdAt: '2026-09-29T09:30:00.000Z', durationSec: 63, createdBy: 'Akashdeep Singh' },
  { id: 'R-1039', kind: 'api', ...W24, status: 'completed', createdAt: '2026-09-29T08:45:00.000Z', durationSec: 18, createdBy: 'Rhea Kapoor' },
  { id: 'R-1038', kind: 'api', windowStart: '2026-09-29T10:00:00.000Z', windowEnd: '2026-09-29T11:00:00.000Z', status: 'completed', createdAt: '2026-09-29T11:00:00.000Z', durationSec: 9, createdBy: 'Bharat Shah' },
  { id: 'R-1037', kind: 'notifications', ...W24, status: 'completed', createdAt: '2026-09-29T07:20:00.000Z', durationSec: 14, createdBy: 'Bharat Shah' },
  { id: 'R-1035', kind: 'shipment', loadId: 'L1', status: 'completed', createdAt: '2026-09-29T06:40:00.000Z', durationSec: 17, createdBy: 'Rhea Kapoor' },
  { id: 'R-1034', kind: 'shipment', loadId: 'L7', status: 'failed', createdAt: '2026-09-28T22:10:00.000Z', durationSec: 30, createdBy: 'Akashdeep Singh', error: 'Diagnosis worker lost database connection after 30 s (ECONNRESET). No findings were written.' },
];

const REPORTS: Record<string, RunReports> = {
  'R-1039': { api: makeApiReport(39, 18420, 24, '2026-09-29T00:00:00.000Z') },
  'R-1038': { api: makeApiReport(38, 2140, 1, '2026-09-29T11:00:00.000Z') },
  'R-1037': { messaging: makeMessagingReport(37, '2026-09-29T00:00:00.000Z') },
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
    evidence: d.evidence,
    pingIds: d.pingIds,
    photoIds: d.photoIds,
  };
}

export interface RunInput {
  id: string;
  kind: RunKind;
  loadId: string | null;
  createdAt: string;
  durationSec: number | null;
  windowStart: string | null;
  windowEnd: string | null;
}

// Runs the same finding logic for a run created in the UI, with freshly generated API / notification reports.
export function generateResult(run: RunInput): { findings: Finding[]; reports: RunReports } {
  const seed = Number(run.id.replace(/\D/g, '')) || 7;
  const end = run.windowEnd ?? NOW;
  const hours = Math.max(1, Math.round((new Date(end).getTime() - new Date(run.windowStart ?? end).getTime()) / 3600000));
  const reports: RunReports = {};
  if (run.kind === 'api') reports.api = makeApiReport(seed, Math.min(60000, 800 * hours + 4000), Math.min(hours, 48), end);
  if (run.kind === 'notifications') reports.messaging = makeMessagingReport(seed, end);
  return { findings: findingsForInput(run, reports), reports };
}

function findingsFor(run: RunDef): Finding[] {
  if (run.status !== 'completed') return [];
  return findingsForInput({ ...run, loadId: run.loadId ?? null, windowStart: run.windowStart ?? null, windowEnd: run.windowEnd ?? null }, REPORTS[run.id]);
}

function findingsForInput(run: RunInput, rep: RunReports | undefined): Finding[] {
  const out: Finding[] = [];
  let n = 1;
  const push = (drafts: FindingDraft[], section: Finding['section']): void => {
    drafts.forEach((d) => out.push(toFinding(run, d, n++, section)));
  };
  if (run.kind === 'shipment' && run.loadId) {
    const load = LOADS.find((l) => l.id === run.loadId);
    if (load) push(shipmentDrafts(load), 'shipment');
  }
  if (run.kind === 'api' && rep?.api) push(apiDrafts(rep.api), 'api');
  if (run.kind === 'notifications' && rep?.messaging) push(messagingDrafts(rep.messaging), 'messaging');
  return out;
}

export const FINDINGS: Finding[] = DEFS.flatMap(findingsFor);

export const RUNS: DiagnosisRun[] = DEFS.map((d) => ({
  id: d.id,
  kind: d.kind,
  loadId: d.loadId ?? null,
  windowStart: d.windowStart ?? null,
  windowEnd: d.windowEnd ?? null,
  status: d.status,
  createdAt: d.createdAt,
  startedAt: d.createdAt,
  durationSec: d.durationSec,
  createdBy: d.createdBy,
  findingIds: FINDINGS.filter((f) => f.runId === d.id).map((f) => f.id),
  error: d.error,
}));

export const RUN_REPORTS = REPORTS;
