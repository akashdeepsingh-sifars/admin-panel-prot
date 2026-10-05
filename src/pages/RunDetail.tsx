import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, RotateCw } from 'lucide-react';
import { FindingCard } from '../components/FindingCard';
import { Button, Card, CardHeader, Empty, KV, PageHeader, Stat, StatusBadge } from '../components/ui';
import { fmtDateTime, fmtDuration, pct } from '../lib/format';
import { KIND_LABEL, queuedRun, runFindings, severityCounts } from '../lib/runs';
import { CURRENT_USER, useStore } from '../store';
import { ShipmentDiagnosis } from './ShipmentDiagnosis';

// A shipment run opens straight into that one shipment's diagnosis. API and notification runs show their summary.
export function RunDetail(): JSX.Element {
  const { runId } = useParams();
  const nav = useNavigate();
  const { runs, findings, reports, addRun } = useStore();
  const run = runs.find((r) => r.id === runId);

  if (!run) return <Empty title="Run not found" body="This run does not exist in the sample data." />;
  if (run.kind === 'shipment') return <ShipmentDiagnosis run={run} />;

  const all = runFindings(run, findings);
  const counts = severityCounts(all);
  const report = reports[run.id];
  const rerun = (): void => {
    const next = queuedRun(runs, run, CURRENT_USER);
    addRun(next);
    nav(`/diagnostics/runs/${next.id}`);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: run.id }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Run {run.id} <StatusBadge status={run.status} />
          </span>
        }
        sub={`${KIND_LABEL[run.kind]} diagnosis · Window ${fmtDateTime(run.windowStart)} → ${fmtDateTime(run.windowEnd)}`}
        actions={
          <>
            <Button variant="secondary" onClick={rerun}>
              <RotateCw size={14} /> Re-run
            </Button>
            <Button variant="secondary">
              <Download size={14} /> Export
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-x-8 px-4 py-2 sm:grid-cols-3">
          <KV k="Started">{fmtDateTime(run.startedAt)}</KV>
          <KV k="Duration">{fmtDuration(run.durationSec)}</KV>
          <KV k="Created by">{run.createdBy}</KV>
        </div>
      </Card>

      {run.status === 'failed' && (
        <div className="mb-4 border border-destructive bg-destructive-tint px-4 py-3 text-sm text-destructive-ink">
          <strong>Run failed.</strong> {run.error}
        </div>
      )}
      {(run.status === 'queued' || run.status === 'running') && (
        <Card className="mb-4">
          <Empty title={run.status === 'queued' ? 'Waiting in queue' : 'Diagnosis in progress'} body="Findings appear here as soon as the run completes. This page updates on its own." />
        </Card>
      )}

      {run.status === 'completed' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Total findings" value={all.length} tone={all.length ? 'warn' : 'ok'} />
            <Stat label="Critical" value={counts.critical} tone={counts.critical ? 'danger' : undefined} />
            <Stat label="High" value={counts.high} tone={counts.high ? 'warn' : undefined} />
          </div>

          {run.kind === 'api' && report?.api && (
            <Card>
              <CardHeader title="API findings" right={<Link to={`/diagnostics/runs/${run.id}/api`} className="text-sm font-semibold text-navy hover:underline">Open →</Link>} />
              <div className="grid gap-3 p-4 sm:grid-cols-4">
                <Stat label="Requests" value={report.api.totals.requests.toLocaleString()} />
                <Stat label="Success" value={pct(report.api.totals.success, report.api.totals.requests)} tone="ok" />
                <Stat label="Failed" value={(report.api.totals.clientErrors + report.api.totals.serverErrors).toLocaleString()} tone="warn" />
                <Stat label="Rate limited" value={report.api.rateLimited.length} />
              </div>
            </Card>
          )}

          {run.kind === 'notifications' && report?.messaging && (
            <Card>
              <CardHeader title="Notification & email findings" right={<Link to={`/diagnostics/runs/${run.id}/messaging`} className="text-sm font-semibold text-navy hover:underline">Open →</Link>} />
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <Stat label="Sent" value={report.messaging.totals.sent.toLocaleString()} />
                <Stat label="Delivered" value={pct(report.messaging.totals.delivered, report.messaging.totals.sent)} tone="ok" />
                <Stat label="Failed" value={report.messaging.totals.failed} tone="warn" />
              </div>
            </Card>
          )}

          {all.length === 0 ? (
            <Card>
              <Empty title="Nothing abnormal found" body="This run completed and every rule passed for the chosen window." />
            </Card>
          ) : (
            <div className="space-y-3">
              {all.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
