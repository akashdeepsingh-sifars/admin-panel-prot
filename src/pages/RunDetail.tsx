import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, RotateCw } from 'lucide-react';
import { Button, Card, CardHeader, Chip, Empty, KV, PageHeader, ScopeBadge, SeverityBadge, SeverityMini, Stat, StatusBadge, Table, Td, TriggerBadge } from '../components/ui';
import { fmtDateTime, fmtDuration, pct } from '../lib/format';
import { runFindings, scopeLabels, severityCounts } from '../lib/runs';
import { DRIVERS, LOADS, ruleInfo } from '../sampleData';
import { useStore } from '../store';
import type { Finding, Severity } from '../types';

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium'];
const worst = (fs: Finding[]): Severity | null => SEV_ORDER.find((s) => fs.some((f) => f.severity === s)) ?? null;

export function RunDetail(): JSX.Element {
  const { runId } = useParams();
  const { runs, findings, reports, review } = useStore();
  const [onlyOpen, setOnlyOpen] = useState(false);
  const run = runs.find((r) => r.id === runId);
  const all = useMemo(() => (run ? runFindings(run, findings) : []), [run, findings]);

  if (!run) return <Empty title="Run not found" body="This run does not exist in the sample data." />;
  const fs = onlyOpen ? all.filter((f) => review(f.id).acknowledgedBy === null) : all;
  const bySection = (s: Finding['section']): Finding[] => fs.filter((f) => f.section === s);
  const counts = severityCounts(all);
  const report = reports[run.id];
  const ackedCount = all.filter((f) => review(f.id).acknowledgedBy !== null).length;

  const shipmentLoads = run.loadIds.map((id) => LOADS.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l);
  const loadsAffected = new Set(all.filter((f) => f.loadId).map((f) => f.loadId)).size;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: run.id }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Run {run.id} <StatusBadge status={run.status} /> <TriggerBadge trigger={run.trigger} />
          </span>
        }
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {scopeLabels(run).map((l) => (
              <ScopeBadge key={l} label={l} />
            ))}
            <span>
              Window {fmtDateTime(run.windowStart)} → {fmtDateTime(run.windowEnd)}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary">
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
      {run.status === 'scheduled' && (
        <Card className="mb-4">
          <Empty title="Not started yet" body="This run is scheduled and has not started." />
        </Card>
      )}

      {run.status === 'completed' && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Total findings" value={all.length} tone={all.length ? 'warn' : 'ok'} />
            <Stat label="Critical" value={counts.critical} tone={counts.critical ? 'danger' : undefined} />
            <Stat label="High" value={counts.high} tone={counts.high ? 'warn' : undefined} />
            <Stat label="Loads affected" value={loadsAffected} />
            <Stat label="Acknowledged" value={`${ackedCount} / ${all.length}`} tone={ackedCount === all.length ? 'ok' : undefined} />
          </div>

          {all.length === 0 ? (
            <Card>
              <Empty title="Nothing abnormal found" body="This run completed and every rule passed for the chosen scope and window." />
            </Card>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-navy-dark">Findings by section</h2>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="h-4 w-4 accent-navy" /> Unacknowledged only
                </label>
              </div>

              <div className="space-y-4">
                {run.scopes.includes('shipments') && (
                  <Card>
                    <CardHeader title="Shipment findings" sub="Open a load for the full monitoring view: route, pings, phone state, photos and timeline." right={<SeverityMini counts={severityCounts(bySection('shipment'))} />} />
                    <Table head={['Load', 'Shipper → Carrier', 'Driver', 'Status', 'Findings', 'Worst', 'Rules']}>
                      {shipmentLoads.map((l) => {
                        const lf = bySection('shipment').filter((f) => f.loadId === l.id);
                        return (
                          <tr key={l.id} className="hover:bg-navy-tint/50">
                            <Td>
                              <Link to={`/diagnostics/runs/${run.id}/shipments/${l.id}`} className="font-semibold text-navy hover:underline">
                                {l.number}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {l.stops[0].dcName} → {l.stops[1].dcName}
                              </div>
                            </Td>
                            <Td>
                              {l.shipper.name} → {l.carrier.name}
                            </Td>
                            <Td>{DRIVERS.find((d) => d.id === l.finalDriverId)?.name}</Td>
                            <Td className="capitalize">{l.status.replace('_', ' ')}</Td>
                            <Td>{lf.length}</Td>
                            <Td>{worst(lf) ? <SeverityBadge severity={worst(lf) as Severity} /> : <Chip tone="ok">Clean</Chip>}</Td>
                            <Td>
                              <div className="flex flex-wrap gap-1">
                                {[...new Set(lf.map((f) => f.ruleCode))].map((c) => (
                                  <Chip key={c} tone="neutral">
                                    {c}
                                  </Chip>
                                ))}
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </Table>
                  </Card>
                )}

                {run.scopes.includes('driver') && (
                  <Card>
                    <CardHeader title="Driver findings" sub="Did the driver deliver properly, or try to cheat the system: not delivering, marking delivered from wrong places, tampering with GPS, reusing photos." right={<SeverityMini counts={severityCounts(bySection('driver'))} />} />
                    <Table head={['Driver', 'Shipments reviewed', 'Findings', 'Worst', 'Rules']}>
                      {run.driverIds.map((id) => {
                        const d = DRIVERS.find((x) => x.id === id);
                        const df = bySection('driver').filter((f) => f.driverId === id);
                        return (
                          <tr key={id} className="hover:bg-navy-tint/50">
                            <Td>
                              <Link to={`/diagnostics/runs/${run.id}/drivers/${id}`} className="font-semibold text-navy hover:underline">
                                {d?.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">{d?.device}</div>
                            </Td>
                            <Td>{LOADS.filter((l) => l.finalDriverId === id).length}</Td>
                            <Td>{df.length}</Td>
                            <Td>{worst(df) ? <SeverityBadge severity={worst(df) as Severity} /> : <Chip tone="ok">Clean</Chip>}</Td>
                            <Td>
                              <div className="flex flex-wrap gap-1">
                                {df.map((f) => (
                                  <Chip key={f.id} tone="neutral">
                                    {f.ruleCode}
                                  </Chip>
                                ))}
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </Table>
                  </Card>
                )}

                {run.scopes.includes('api') && report?.api && (
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

                {run.scopes.includes('gps') && report?.gps && (
                  <Card>
                    <CardHeader title="GPS findings" right={<Link to={`/diagnostics/runs/${run.id}/gps`} className="text-sm font-semibold text-navy hover:underline">Open →</Link>} />
                    <div className="p-4 text-sm">{report.gps.drift.length} drivers show GPS sampling drift.</div>
                  </Card>
                )}

                {run.scopes.includes('notifications') && report?.messaging && (
                  <Card>
                    <CardHeader title="Notification & email findings" right={<Link to={`/diagnostics/runs/${run.id}/messaging`} className="text-sm font-semibold text-navy hover:underline">Open →</Link>} />
                    <div className="grid gap-3 p-4 sm:grid-cols-3">
                      <Stat label="Sent" value={report.messaging.totals.sent.toLocaleString()} />
                      <Stat label="Delivered" value={pct(report.messaging.totals.delivered, report.messaging.totals.sent)} tone="ok" />
                      <Stat label="Failed" value={report.messaging.totals.failed} tone="warn" />
                    </div>
                  </Card>
                )}

                <Card>
                  <CardHeader title="What this run noticed" sub="One line per finding, grouped by section." />
                  <div className="space-y-4 p-4">
                    {(['shipment', 'driver', 'api', 'gps', 'messaging'] as const).map((sec) => {
                      const items = bySection(sec);
                      if (items.length === 0) return null;
                      return (
                        <div key={sec}>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sec === 'messaging' ? 'Notifications & email' : sec}</div>
                          <ul className="space-y-1">
                            {items.map((f) => (
                              <li key={f.id} className="flex items-start gap-2 text-sm">
                                <SeverityBadge severity={f.severity} />
                                <span>
                                  {f.summary} <span className="text-muted-foreground">({ruleInfo(f.ruleCode)?.title ?? f.ruleCode})</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
