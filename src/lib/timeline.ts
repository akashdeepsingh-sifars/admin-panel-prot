import { DRIVERS } from '../sampleData';
import { analyzeLoad, fenceName } from '../sampleData/analyze';
import type { Load } from '../types';

export type TimelineKind = 'lifecycle' | 'geofence' | 'gap' | 'break' | 'problem' | 'photo' | 'reassign' | 'notification' | 'delivery' | 'flag';

export interface TimelineEvent {
  at: string;
  kind: TimelineKind;
  label: string;
  detail?: string;
  tone: 'critical' | 'high' | 'medium' | 'ok' | 'neutral';
  pingIds?: string[];
  photoId?: string;
}

const ms = (iso: string): number => new Date(iso).getTime();

export function buildTimeline(load: Load): TimelineEvent[] {
  const a = analyzeLoad(load);
  const ev: TimelineEvent[] = [];
  const driverName = (id: string): string => DRIVERS.find((d) => d.id === id)?.name ?? id;
  const stopFence = (id: string): string => {
    const st = load.stops.find((s) => s.id === id);
    return st ? fenceName(st) : 'stop';
  };

  ev.push({ at: load.createdBy.at, kind: 'lifecycle', label: `Load created by ${load.createdBy.name}`, tone: 'neutral' });
  load.bids.forEach((b) => ev.push({ at: b.placedAt, kind: 'lifecycle', label: `Bid $${b.amountUsd.toLocaleString()} from ${b.carrierName} (${b.outcome})`, tone: 'neutral' }));
  ev.push({ at: load.acceptedBy.at, kind: 'lifecycle', label: `Bid accepted by ${load.acceptedBy.name}`, tone: 'neutral' });
  load.assignments.forEach((as, i) => {
    const h = as.kind === 'replacement_mid_transit' ? a.handovers.find((x) => x.at === as.from) : undefined;
    const prev = i > 0 ? load.assignments[i - 1] : undefined;
    const label =
      as.kind === 'initial'
        ? `Assigned to ${driverName(as.driverId)}`
        : as.kind === 'replacement_before_pickup'
          ? `Replacement assigned before pickup: ${driverName(as.driverId)}`
          : as.endedBy === 'declined'
            ? `${driverName(as.driverId)} was offered the parked shipment`
            : `${driverName(as.driverId)} accepted the shipment (replacing ${driverName(a.handovers.find((x) => x.at === as.from)?.fromDriverId ?? prev?.driverId ?? '')})`;
    ev.push({ at: as.from, kind: 'reassign', label, detail: as.kind === 'initial' ? undefined : as.reason, tone: h && h.issues.length ? 'high' : as.kind === 'initial' ? 'neutral' : 'medium' });
    if (as.endedBy) {
      ev.push({
        at: as.to as string,
        kind: 'reassign',
        label: as.endedBy === 'declined' ? `${driverName(as.driverId)} declined ${as.kind === 'replacement_mid_transit' ? 'the shipment during the park' : 'the pickup'}` : `Carrier released ${driverName(as.driverId)}`,
        detail: as.endedBy === 'declined' ? as.reason : undefined,
        tone: 'medium',
      });
    }
  });
  a.handovers.forEach((h) => {
    if (!h.park) return;
    ev.push({ at: h.park.parkedAt, kind: 'break', label: 'Shipment parked by driver', detail: 'Cargo on board. A driver change is only allowed while parked.', tone: 'medium', pingIds: h.lastPing ? [h.lastPing.id] : undefined });
    if (h.park.resumedAt) {
      ev.push({
        at: h.park.resumedAt,
        kind: 'reassign',
        label: `${driverName(h.toDriverId)} resumed the shipment`,
        detail: `Parked ${h.parkedMinutes} min · first ping ${(h.resumeDistanceM / 1000).toFixed(1)} km from the parked spot${h.issues.length ? ` · needs review: ${h.issues.join('; ')}` : ' · looks consistent'}`,
        tone: h.issues.length ? 'high' : 'ok',
        pingIds: h.firstPing ? [h.firstPing.id] : undefined,
      });
    }
  });
  load.geofenceEvents.forEach((g) => {
    ev.push({ at: g.occurredAt, kind: 'geofence', label: `Geofence ${g.transition} · ${stopFence(g.stopId)}`, tone: 'ok' });
    ev.push({
      at: new Date(ms(g.occurredAt) + 60000).toISOString(),
      kind: 'notification',
      label: g.notified ? `Notification sent for geofence ${g.transition}` : `No notification for geofence ${g.transition}`,
      tone: g.notified ? 'neutral' : 'critical',
    });
  });
  a.missed.forEach((m) => ev.push({ at: m.after.recordedAt, kind: 'geofence', label: `Geofence MISSED (${m.transition}): ${fenceName(m.stop)}`, detail: `GPS shows the ${m.transition === 'enter' ? 'entry into' : 'exit from'} this geofence but no event was recorded`, tone: 'critical', pingIds: [m.before.id, m.after.id] }));
  a.gaps.forEach((g) => ev.push({ at: g.before.recordedAt, kind: 'gap', label: `GPS silent for ${g.minutes} min`, detail: `${g.spans}. Likely cause: ${g.inferredCause}`, tone: 'high', pingIds: [g.before.id, g.after.id] }));
  a.frozen.forEach((f) => ev.push({ at: f.pings[0].recordedAt, kind: 'flag', label: `Static location for ${Math.round(f.seconds / 60)} min`, tone: 'medium', pingIds: f.pings.map((p) => p.id) }));
  load.breaks.forEach((b) => ev.push({ at: b.startedAt, kind: 'break', label: `Break / stop (${Math.round((ms(b.endedAt) - ms(b.startedAt)) / 60000)} min)`, tone: 'medium' }));
  load.problems.forEach((p) => ev.push({ at: p.reportedAt, kind: 'problem', label: `Problem reported: ${p.type.replace('_', ' ')}`, detail: p.note, tone: 'critical' }));
  load.photos.forEach((p) =>
    ev.push({ at: p.uploadedAt, kind: 'photo', label: `Photo uploaded (${p.kind.replace('_', ' ')}) · ${p.context.replace('_', ' ')}`, tone: p.onTime ? 'neutral' : 'high', photoId: p.id })
  );
  if (load.deliveryMarkedAt) {
    ev.push({
      at: load.deliveryMarkedAt,
      kind: 'delivery',
      label: 'Marked delivered',
      detail: load.deliveryMarkedDistanceM !== null ? `${load.deliveryMarkedDistanceM} m from stop centre` : undefined,
      tone: load.deliveryMarkedDistanceM !== null && load.deliveryMarkedDistanceM > 250 ? 'critical' : 'ok',
    });
  } else {
    ev.push({ at: load.pings[load.pings.length - 1].recordedAt, kind: 'delivery', label: 'Load closed without delivery', tone: 'critical' });
  }
  return ev.sort((x, y) => ms(x.at) - ms(y.at));
}

export interface PathSegment {
  context: Load['pings'][number]['context'];
  from: string;
  to: string;
  pings: number;
  driverIds: string[];
}

// The path actually followed, as consecutive runs of pings: at the pickup geofence, normal driving, at the drop-off geofence.
export function pathSegments(load: Load): PathSegment[] {
  const out: PathSegment[] = [];
  for (const p of load.pings) {
    const last = out[out.length - 1];
    if (last && last.context === p.context) {
      last.to = p.recordedAt;
      last.pings += 1;
      if (!last.driverIds.includes(p.driverId)) last.driverIds.push(p.driverId);
    } else out.push({ context: p.context, from: p.recordedAt, to: p.recordedAt, pings: 1, driverIds: [p.driverId] });
  }
  return out;
}
