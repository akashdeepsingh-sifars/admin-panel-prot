import { Link } from 'react-router-dom';
import { haversineM } from '../../lib/geo';
import { fmtDateTime, fmtMeters } from '../../lib/format';
import { DRIVERS } from '../../sampleData';
import { analyzeLoad } from '../../sampleData/analyze';
import type { Load } from '../../types';
import { Card, CardHeader, Chip, KV, Table, Td } from '../ui';

export function OverviewTab({ load, runId }: { load: Load; runId: string }): JSX.Element {
  const a = analyzeLoad(load);
  const drv = (id: string): string => DRIVERS.find((d) => d.id === id)?.name ?? id;
  const finalDriver = DRIVERS.find((d) => d.id === load.finalDriverId);
  const offRoute = load.pings.filter((p) => p.context === 'off_route');
  const maxDev = Math.max(0, ...load.pings.map((p) => p.offRouteM));
  let km = 0;
  for (let i = 1; i < load.pings.length; i++) km += haversineM(load.pings[i - 1].location, load.pings[i].location) / 1000;
  const gapMin = a.gaps.reduce((s, g) => s + g.minutes, 0);
  const stopsMissed = load.stops.filter((s) => !s.arrivedAt);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Load" />
        <div className="px-4 py-2">
          <KV k="Load number">{load.number}</KV>
          <KV k="Status"><span className="capitalize">{load.status.replace('_', ' ')}</span></KV>
          <KV k="Commodity">{load.commodity}</KV>
          <KV k="Equipment">{load.equipment}</KV>
          <KV k="Route">{load.stops[0].dcName} → {load.stops[1].dcName}</KV>
        </div>
      </Card>

      <Card>
        <CardHeader title="People & lifecycle" />
        <div className="px-4 py-2">
          <KV k="Created by">{load.createdBy.name} · {fmtDateTime(load.createdBy.at)}</KV>
          <KV k="Bid accepted by">{load.acceptedBy.name} · {fmtDateTime(load.acceptedBy.at)}</KV>
          <KV k="Assigned carrier">{load.carrier.name}</KV>
          {load.assignments.map((as, i) => (
            <KV key={i} k={as.kind === 'initial' ? 'Assigned driver' : as.kind === 'replacement_before_pickup' ? 'Replacement (before pickup)' : 'Replacement (mid-transit)'}>
              {drv(as.driverId)} <span className="text-xs text-muted-foreground">from {fmtDateTime(as.from)}</span>
              {as.endedBy && <div className="text-xs font-normal text-muted-foreground">{as.endedBy === 'declined' ? 'Declined' : 'Released'} {fmtDateTime(as.to)}</div>}
              {as.reason && as.kind !== 'initial' && <div className="text-xs font-normal text-muted-foreground">{as.reason}</div>}
              {as.endedBy === 'declined' && <div className="text-xs font-normal text-muted-foreground">{as.reason}</div>}
            </KV>
          ))}
        </div>
        <div className="border-t border-border px-4 py-2">
          <div className="py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bids</div>
          {load.bids.map((b) => (
            <KV key={b.id} k={`${b.carrierName} · ${fmtDateTime(b.placedAt)}`}>
              ${b.amountUsd.toLocaleString()} <Chip tone={b.outcome === 'accepted' ? 'ok' : 'neutral'}>{b.outcome}</Chip>
            </KV>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Shipper" />
        <div className="px-4 py-2">
          <KV k="Organisation">{load.shipper.name}</KV>
          <KV k="Contact">{load.shipper.contact.name}</KV>
          <KV k="Phone">{load.shipper.contact.phone}</KV>
          <KV k="Email">{load.shipper.contact.email}</KV>
        </div>
      </Card>
      <Card>
        <CardHeader title="Carrier" />
        <div className="px-4 py-2">
          <KV k="Organisation">{load.carrier.name}</KV>
          <KV k="Contact">{load.carrier.contact.name}</KV>
          <KV k="Phone">{load.carrier.contact.phone}</KV>
          <KV k="Email">{load.carrier.contact.email}</KV>
        </div>
      </Card>

      <Card>
        <CardHeader title="Driver" right={finalDriver && <Link to={`/diagnostics/runs/${runId}/drivers/${finalDriver.id}`} className="text-sm font-semibold text-navy hover:underline">Driver history →</Link>} />
        <div className="px-4 py-2">
          <KV k="Name">{finalDriver?.name}</KV>
          <KV k="Phone">{finalDriver?.phone}</KV>
          <KV k="Device">{finalDriver?.device}</KV>
          <KV k="Lifetime shipments">{finalDriver?.shipmentsCompleted}</KV>
        </div>
      </Card>

      <Card>
        <CardHeader title="Path followed" sub="What the driver's GPS actually did compared with the planned route." />
        <div className="px-4 py-2">
          <KV k="Distance travelled (from pings)">{km.toFixed(0)} km</KV>
          <KV k="Pings on planned route">{load.pings.filter((p) => p.context !== 'off_route').length} of {load.pings.length}</KV>
          <KV k="Off-route pings">{offRoute.length >= 5 ? <span className="text-destructive-ink">{offRoute.length} · max {fmtMeters(maxDev)} away</span> : offRoute.length ? `${offRoute.length} (within GPS noise) · max ${fmtMeters(maxDev)} away` : 'None'}</KV>
          <KV k="GPS off">{a.gaps.length ? <span className="text-destructive-ink">{a.gaps.length} period(s), {gapMin} min total</span> : 'Never'}</KV>
          <KV k="Stops missed">{stopsMissed.length ? <span className="text-destructive-ink">{stopsMissed.map((s) => s.dcName).join(', ')}: never reached</span> : a.missed.length ? <span className="text-destructive-ink">{a.missed.length} geofence crossing(s) not recorded</span> : 'None'}</KV>
        </div>
      </Card>

      {a.handovers.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader title="Driver change while in transit" sub="The rules only allow this while the shipment is parked: the driver parks, the carrier releases and assigns a new driver, the new driver accepts and resumes. GPS and photos stay attributed to whoever sent them." />
          <div className="space-y-4 p-4">
            {a.handovers.map((h, i) => (
              <div key={i} className="border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{drv(h.fromDriverId)} → {drv(h.toDriverId)}</span>
                  <Chip tone={h.issues.length ? 'high' : 'ok'}>{h.issues.length ? 'Needs review' : 'Consistent'}</Chip>
                </div>
                <p className="mb-2 text-sm">Reason given: {h.reason}</p>
                <ol className="mb-2 space-y-1 border-l-4 border-navy pl-3 text-sm">
                  <li><span className="font-semibold">Parked</span> {h.park ? fmtDateTime(h.park.parkedAt) : 'never'}{h.park?.cargoOnBoard ? ' · cargo on board' : ''}</li>
                  <li><span className="font-semibold">{drv(h.fromDriverId)} released</span> {fmtDateTime(h.releasedAt)}</li>
                  <li><span className="font-semibold">{drv(h.toDriverId)} accepted</span> {fmtDateTime(h.at)}</li>
                  <li><span className="font-semibold">Resumed</span> {h.park?.resumedAt ? fmtDateTime(h.park.resumedAt) : 'not yet'}</li>
                </ol>
                <div className="bg-muted px-3 py-1">
                  <KV k="Time parked">{h.parkedMinutes} min (limit 120 min)</KV>
                  <KV k="Previous driver's last ping">{h.lastPing ? fmtDateTime(h.lastPing.recordedAt) : '—'}</KV>
                  <KV k="New driver's first ping">{h.firstPing ? `${fmtDateTime(h.firstPing.recordedAt)} · ${h.firstPing.context.replace('_', ' ')}` : 'Never'}</KV>
                  <KV k="Distance from the parked spot">{(h.resumeDistanceM / 1000).toFixed(1)} km (limit 1 km)</KV>
                  <KV k="GPS silence after resume">{h.silenceAfterResumeMin} min (limit 15 min)</KV>
                </div>
                {h.issues.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-warning-ink">
                    {h.issues.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              How this is treated: the parked time is not counted as a GPS gap; delivery outcome and lateness count against the driver who finished the load; GPS gaps and photos count against the driver who sent them; the earlier driver is not marked "undelivered" for a load someone else completed. A driver change before pickup (driver declines after accepting, carrier assigns a replacement) involves no GPS and is listed under People &amp; lifecycle only.
            </p>
          </div>
        </Card>
      )}

      <Card className="lg:col-span-2">
        <CardHeader title="Stops" />
        <Table head={['Stop', 'Distribution centre', 'Scheduled window', 'Arrived', 'Departed', 'Radius', 'Timing']}>
          {load.stops.map((s) => {
            const late = s.arrivedAt && new Date(s.arrivedAt) > new Date(s.scheduledEnd);
            return (
              <tr key={s.id}>
                <Td className="capitalize font-semibold">{s.kind}</Td>
                <Td>
                  {s.dcName}
                  <div className="text-xs text-muted-foreground">{s.address}</div>
                </Td>
                <Td className="whitespace-nowrap">{fmtDateTime(s.scheduledStart)} → {fmtDateTime(s.scheduledEnd)}</Td>
                <Td className="whitespace-nowrap">{fmtDateTime(s.arrivedAt)}</Td>
                <Td className="whitespace-nowrap">{fmtDateTime(s.departedAt)}</Td>
                <Td>{s.radiusM} m</Td>
                <Td>{!s.arrivedAt ? <Chip tone="critical">Not reached</Chip> : late ? <Chip tone="high">Late</Chip> : <Chip tone="ok">On time</Chip>}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
