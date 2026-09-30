import { Link, useParams } from 'react-router-dom';
import { FindingCard } from '../components/FindingCard';
import { Card, CardHeader, Chip, Empty, KV, PageHeader, SeverityBadge, Stat, Table, Td } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { DRIVERS, LOADS } from '../sampleData';
import { analyzeLoad, patternsForLoad } from '../sampleData/analyze';
import { useStore } from '../store';

export function DriverDiagnosis(): JSX.Element {
  const { runId, driverId } = useParams();
  const { findings } = useStore();
  const driver = DRIVERS.find((d) => d.id === driverId);
  if (!driver) return <Empty title="Driver not found" body="This driver does not exist in the sample data." />;

  const loads = LOADS.filter((l) => l.assignments.some((a) => a.driverId === driver.id));
  const finished = (l: (typeof LOADS)[number]): boolean => l.finalDriverId === driver.id;
  const role = (l: (typeof LOADS)[number]): string => {
    const mine = l.assignments.find((a) => a.driverId === driver.id);
    if (!mine) return '—';
    if (mine.endedBy === 'declined') return `Declined before pickup ${fmtDateTime(mine.to)}`;
    if (mine.kind === 'replacement_before_pickup') return 'Replacement before pickup, full trip';
    if (mine.kind === 'replacement_mid_transit') return `Took over ${fmtDateTime(mine.from)}`;
    return mine.endedBy === 'released' ? `Started, released ${fmtDateTime(mine.to)}` : 'Full trip';
  };
  const fs = findings.filter((f) => f.runId === runId && f.driverId === driver.id && f.section === 'driver');
  const done = loads.filter(finished);
  const onTime = done.filter((l) => l.status === 'delivered' && l.lateMinutes < 15).length;
  const gaps = loads.flatMap((l) => analyzeLoad(l).gaps.filter((g) => g.before.driverId === driver.id).map((g) => ({ l, g })));
  const photos = loads.flatMap((l) => l.photos.filter((p) => p.driverId === driver.id).map((p) => ({ l, p })));
  const hashUse = new Map<string, number>();
  photos.forEach(({ p }) => hashUse.set(p.imageHash, (hashUse.get(p.imageHash) ?? 0) + 1));
  const patterns = new Map<string, number>();
  loads.forEach((l) => patternsForLoad(l).forEach((c) => patterns.set(c.label.replace(/ \(.*\)/, ''), (patterns.get(c.label.replace(/ \(.*\)/, '')) ?? 0) + 1)));

  return (
    <>
      <PageHeader crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: runId ?? '', to: `/diagnostics/runs/${runId}` }, { label: driver.name }]} title={`Driver ${driver.name}`} sub={`${driver.device} · ${driver.phone}`} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Shipments reviewed" value={loads.length} />
        <Stat label="On-time rate" value={done.length ? `${Math.round((onTime / done.length) * 100)}%` : '—'} tone={onTime === done.length ? 'ok' : 'warn'} />
        <Stat label="GPS-silent periods" value={gaps.length} tone={gaps.length ? 'danger' : 'ok'} />
        <Stat label="Findings" value={fs.length} tone={fs.length ? 'danger' : 'ok'} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patterns across shipments</span>
        {patterns.size === 0 ? <Chip tone="ok">None</Chip> : [...patterns].map(([label, n]) => <Chip key={label} tone={n >= 2 ? 'high' : 'medium'}>{label} ×{n}</Chip>)}
      </div>

      <h2 className="mb-2 text-base font-semibold text-navy-dark">Findings for this driver</h2>
      <div className="mb-6 space-y-3">
        {fs.length === 0 ? (
          <Card><Empty title="No findings" body="This driver's shipments passed every driver rule in this run." /></Card>
        ) : (
          fs.map((f) => <FindingCard key={f.id} finding={f} to={f.loadId ? `/diagnostics/runs/${runId}/shipments/${f.loadId}` : undefined} toLabel="Open shipment" />)
        )}
      </div>

      <Card className="mb-4">
        <CardHeader title="Shipments" sub="Delivery outcome versus where the delivery was marked." />
        <Table head={['Load', 'Role', 'Outcome', 'Delivery marked', 'Timing', 'GPS silent', 'Photos', 'Patterns']}>
          {loads.map((l) => {
            const delivery = l.stops[1];
            const outside = l.deliveryMarkedDistanceM !== null && l.deliveryMarkedDistanceM > delivery.radiusM;
            const g = analyzeLoad(l).gaps.filter((x) => x.before.driverId === driver.id);
            const mineDone = finished(l);
            return (
              <tr key={l.id}>
                <Td>
                  <Link to={`/diagnostics/runs/${runId}/shipments/${l.id}`} className="font-semibold text-navy hover:underline">{l.number}</Link>
                  <div className="text-xs text-muted-foreground">{l.stops[0].dcName} → {delivery.dcName}</div>
                </Td>
                <Td className="text-xs">{role(l)}</Td>
                <Td>{!mineDone ? <Chip tone="neutral">{l.assignments.find((x) => x.driverId === driver.id)?.endedBy === 'declined' ? 'Declined' : 'Handed over'}</Chip> : l.status === 'delivered' ? <Chip tone="ok">Delivered</Chip> : <Chip tone="critical">Not delivered</Chip>}</Td>
                <Td>
                  {mineDone && l.deliveryMarkedAt ? (
                    <>
                      {fmtDateTime(l.deliveryMarkedAt)}
                      <div className="text-xs">{outside ? <span className="font-semibold text-destructive-ink">{((l.deliveryMarkedDistanceM ?? 0) / 1000).toFixed(1)} km outside geofence</span> : <span className="text-muted-foreground">Inside geofence</span>}</div>
                    </>
                  ) : '—'}
                </Td>
                <Td>{!mineDone ? '—' : l.lateMinutes >= 15 ? <Chip tone="high">{l.lateMinutes} min late</Chip> : <Chip tone="ok">On time</Chip>}</Td>
                <Td>{g.length ? <span className="font-semibold text-destructive-ink">{g.reduce((s, x) => s + x.minutes, 0)} min</span> : '—'}</Td>
                <Td>{l.photos.filter((p) => p.driverId === driver.id && p.context === 'elsewhere').length ? <Chip tone="critical">{l.photos.filter((p) => p.driverId === driver.id && p.context === 'elsewhere').length} off-place</Chip> : `${l.photos.filter((p) => p.driverId === driver.id).length} ok`}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">{patternsForLoad(l).map((c) => <Chip key={c.key} tone={c.tone}>{c.label}</Chip>)}</div>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="GPS behaviour" sub="Silent periods across shipments and phone state just before." />
          {gaps.length === 0 ? <Empty title="No GPS gaps" body="GPS stayed continuous across the driver's shipments." /> : (
            <Table head={['Load', 'Silent', 'Duration', 'Phone before gap']}>
              {gaps.map(({ l, g }, i) => (
                <tr key={i}>
                  <Td>{l.number}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(g.before.recordedAt)}</Td>
                  <Td>{g.minutes} min</Td>
                  <Td>{g.inferredCause} · battery {g.before.phone.batteryPct}%</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Photo history" sub="Repeated image hashes mean the same photo was reused." />
          <Table head={['Load', 'Photo', 'Where', 'Timing', 'Image hash']}>
            {photos.map(({ l, p }) => (
              <tr key={p.id}>
                <Td>{l.number}</Td>
                <Td className="capitalize">{p.kind.replace('_', ' ')}</Td>
                <Td><Chip tone={p.context === 'elsewhere' ? 'critical' : p.context === 'on_route' ? 'high' : 'ok'}>{p.context.replace('_', ' ')}</Chip></Td>
                <Td>{p.onTime ? 'On time' : 'Off time / place'}</Td>
                <Td>
                  <code className="text-xs">{p.imageHash}</code>
                  {(hashUse.get(p.imageHash) ?? 0) > 1 && <div className="mt-0.5"><SeverityBadge severity="critical" /> <span className="text-xs">reused ×{hashUse.get(p.imageHash)}</span></div>}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="Driver profile" />
        <div className="grid gap-x-8 px-4 py-2 sm:grid-cols-3">
          <KV k="Phone">{driver.phone}</KV>
          <KV k="Device">{driver.device}</KV>
          <KV k="Lifetime shipments">{driver.shipmentsCompleted}</KV>
        </div>
      </Card>
    </>
  );
}
