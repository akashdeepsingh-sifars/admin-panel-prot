import { haversineM } from '../lib/geo';
import { minutesBetween } from '../lib/format';
import type { EvidenceValue, GeofenceEvent, Load, Park, Ping, PingFlag, Severity, Stop } from '../types';

const GAP_MINUTES = 15;
const FROZEN_RADIUS_M = 15;
const FROZEN_MIN_READINGS = 3;
const FROZEN_MIN_SECONDS = 180;
const LOW_ACCURACY_M = 100;
const PARKED_MAX_MIN = 120;
const RESUME_MAX_DISTANCE_M = 1000;
const RESUME_MAX_SILENCE_MIN = 15;
export const LATE_THRESHOLD_MIN = 15;

export interface GapHit {
  before: Ping;
  after: Ping;
  minutes: number;
  inferredCause: string;
}
export interface FrozenHit {
  pings: Ping[];
  seconds: number;
}
export interface HandoverHit {
  at: string;
  fromDriverId: string;
  toDriverId: string;
  reason: string;
  park: Park | null;
  releasedAt: string | null;
  lastPing: Ping | null;
  firstPing: Ping | null;
  parkedMinutes: number;
  resumeDistanceM: number;
  silenceAfterResumeMin: number;
  issues: string[];
}
export interface MissedCrossing {
  stop: Stop;
  transition: 'enter' | 'exit';
  before: Ping;
  after: Ping;
}
export interface LoadAnalysis {
  gaps: GapHit[];
  handovers: HandoverHit[];
  frozen: FrozenHit[];
  dupGroups: Ping[][];
  tsGroups: Ping[][];
  missed: MissedCrossing[];
  notifyMissing: GeofenceEvent[];
}

export interface FindingDraft {
  ruleCode: string;
  severity: Severity;
  summary: string;
  evidence: Record<string, EvidenceValue>;
  pingIds: string[];
  photoIds: string[];
  loadId?: string;
  driverId?: string;
}

const ms = (iso: string): number => new Date(iso).getTime();

function inferCause(p: Ping): string {
  if (p.phone.batteryPct <= 5) return `Battery ${p.phone.batteryPct}%`;
  if (p.phone.locationPermission !== 'always') return 'Location permission downgraded';
  if (p.phone.network === 'none') return 'No network connection';
  return 'Unknown';
}

export function analyzeLoad(load: Load): LoadAnalysis {
  const pings = load.pings;
  const inTransit = pings.filter((p) => p.context === 'on_route' || p.context === 'off_route');

  // A mid-transit driver change goes through a park (driver parks, carrier releases and assigns, new driver
  // resumes). The park explains the silence, so it is judged here instead of as a GPS gap.
  const handovers: HandoverHit[] = [];
  load.assignments.forEach((as, i) => {
    if (as.kind !== 'replacement_mid_transit') return;
    const prev = load.assignments[i - 1];
    const park = load.parks.find((pk) => ms(pk.parkedAt) <= ms(as.from) && ms(as.from) <= ms(pk.resumedAt ?? as.from)) ?? null;
    const lastPing = park ? [...pings].reverse().find((p) => p.driverId === prev.driverId && ms(p.recordedAt) <= ms(park.parkedAt)) ?? null : null;
    const firstPing = pings.find((p) => p.driverId === as.driverId) ?? null;
    const parkedMinutes = park?.resumedAt ? Math.round(minutesBetween(park.parkedAt, park.resumedAt)) : 0;
    const resumeDistanceM = park && firstPing ? Math.round(haversineM(park.location, firstPing.location)) : 0;
    const silenceAfterResumeMin = park?.resumedAt && firstPing ? Math.max(0, Math.round(minutesBetween(park.resumedAt, firstPing.recordedAt))) : 0;
    const issues: string[] = [];
    if (!park) issues.push('Driver changed without the shipment being parked (the rules do not allow a change while in transit)');
    if (!firstPing) issues.push('The new driver never sent GPS');
    if (park && parkedMinutes > PARKED_MAX_MIN) issues.push(`Shipment stayed parked for ${parkedMinutes} min with cargo on board (limit ${PARKED_MAX_MIN} min)`);
    if (park && firstPing && resumeDistanceM > RESUME_MAX_DISTANCE_M) issues.push(`New driver's first ping is ${(resumeDistanceM / 1000).toFixed(1)} km from where the shipment was parked (limit ${(RESUME_MAX_DISTANCE_M / 1000).toFixed(0)} km)`);
    if (park && firstPing && silenceAfterResumeMin > RESUME_MAX_SILENCE_MIN) issues.push(`No GPS from the new driver for ${silenceAfterResumeMin} min after resuming`);
    handovers.push({ at: as.from, fromDriverId: prev.driverId, toDriverId: as.driverId, reason: as.reason, park, releasedAt: prev.to, lastPing, firstPing, parkedMinutes, resumeDistanceM, silenceAfterResumeMin, issues });
  });
  const insidePark = (a: Ping, b: Ping): boolean =>
    load.parks.some((pk) => ms(a.recordedAt) < ms(pk.resumedAt ?? pk.parkedAt) && ms(b.recordedAt) > ms(pk.parkedAt));

  const gaps: GapHit[] = [];
  for (let i = 1; i < pings.length; i++) {
    const m = minutesBetween(pings[i - 1].recordedAt, pings[i].recordedAt);
    if (m >= GAP_MINUTES && !insidePark(pings[i - 1], pings[i])) {
      gaps.push({ before: pings[i - 1], after: pings[i], minutes: Math.round(m), inferredCause: inferCause(pings[i - 1]) });
    }
  }

  const frozen: FrozenHit[] = [];
  let i = 0;
  while (i < inTransit.length) {
    let j = i + 1;
    while (j < inTransit.length && haversineM(inTransit[i].location, inTransit[j].location) <= FROZEN_RADIUS_M) j++;
    const cluster = inTransit.slice(i, j);
    if (cluster.length >= FROZEN_MIN_READINGS) {
      const seconds = (ms(cluster[cluster.length - 1].recordedAt) - ms(cluster[0].recordedAt)) / 1000;
      if (seconds > FROZEN_MIN_SECONDS) frozen.push({ pings: cluster, seconds });
    }
    i = j > i ? j : i + 1;
  }

  const byTs = new Map<string, Ping[]>();
  for (const p of pings) byTs.set(p.recordedAt, [...(byTs.get(p.recordedAt) ?? []), p]);
  const dupGroups: Ping[][] = [];
  const tsGroups: Ping[][] = [];
  for (const group of byTs.values()) {
    if (group.length < 2) continue;
    const hashes = new Set(group.map((p) => `${p.location.lat.toFixed(5)},${p.location.lng.toFixed(5)}`));
    if (hashes.size === 1) dupGroups.push(group);
    else if (Math.max(...group.map((p) => ms(p.receivedAt))) - Math.min(...group.map((p) => ms(p.receivedAt))) > 1000) {
      tsGroups.push(group);
    }
  }

  const missed: MissedCrossing[] = [];
  for (const stop of load.stops) {
    const ctx = stop.kind === 'pickup' ? 'pickup_radius' : 'delivery_radius';
    for (let k = 1; k < pings.length; k++) {
      const wasIn = pings[k - 1].context === ctx;
      const isIn = pings[k].context === ctx;
      if (wasIn === isIn) continue;
      const transition = isIn ? 'enter' : 'exit';
      const covered = load.geofenceEvents.some(
        (e) => e.stopId === stop.id && e.transition === transition && ms(e.occurredAt) >= ms(pings[k - 1].recordedAt) && ms(e.occurredAt) <= ms(pings[k].recordedAt)
      );
      if (!covered) missed.push({ stop, transition, before: pings[k - 1], after: pings[k] });
    }
  }

  return { gaps, handovers, frozen, dupGroups, tsGroups, missed, notifyMissing: load.geofenceEvents.filter((e) => !e.notified) };
}

export function flagPings(load: Load): Load {
  const a = analyzeLoad(load);
  const flags = new Map<string, Set<PingFlag>>();
  const add = (id: string, f: PingFlag): void => {
    flags.set(id, (flags.get(id) ?? new Set()).add(f));
  };
  a.gaps.forEach((g) => add(g.after.id, 'after_gap'));
  a.frozen.forEach((f) => f.pings.forEach((p) => add(p.id, 'frozen')));
  a.dupGroups.forEach((g) => g.forEach((p) => add(p.id, 'duplicate')));
  a.tsGroups.forEach((g) => g.forEach((p) => add(p.id, 'same_timestamp')));
  load.pings.forEach((p) => {
    if (p.accuracyM > LOW_ACCURACY_M) add(p.id, 'low_accuracy');
  });
  return { ...load, pings: load.pings.map((p) => ({ ...p, flags: [...(flags.get(p.id) ?? [])] })) };
}

export function shipmentDrafts(load: Load): FindingDraft[] {
  const a = analyzeLoad(load);
  const out: FindingDraft[] = [];
  const base = { loadId: load.id, photoIds: [] as string[] };

  for (const g of a.dupGroups) {
    out.push({
      ...base,
      ruleCode: 'DUP_EXACT',
      severity: g.length >= 5 ? 'high' : 'medium',
      summary: `Same GPS reading stored ${g.length} times at ${g[0].recordedAt.slice(11, 19)} UTC`,
      evidence: { dupCount: g.length, recordedAt: g[0].recordedAt, receivedAtSpreadSec: Math.round((ms(g[g.length - 1].receivedAt) - ms(g[0].receivedAt)) / 1000) },
      pingIds: g.map((p) => p.id),
    });
  }
  for (const g of a.tsGroups) {
    out.push({
      ...base,
      ruleCode: 'DUP_STORED_SAME_TIMESTAMP',
      severity: 'medium',
      summary: `Two readings share recorded time ${g[0].recordedAt.slice(11, 19)} UTC but positions differ`,
      evidence: { recordedAt: g[0].recordedAt, receivedAtValues: g.map((p) => p.receivedAt) },
      pingIds: g.map((p) => p.id),
    });
  }
  for (const f of a.frozen) {
    out.push({
      ...base,
      ruleCode: 'FROZEN_FIX',
      severity: 'medium',
      summary: `Position unchanged for ${Math.round(f.seconds / 60)} min while in transit (${f.pings.length} readings)`,
      evidence: { readings: f.pings.length, durationSeconds: f.seconds, centroid: `${f.pings[0].location.lat.toFixed(4)}, ${f.pings[0].location.lng.toFixed(4)}` },
      pingIds: f.pings.map((p) => p.id),
    });
  }
  for (const g of a.gaps) {
    out.push({
      ...base,
      ruleCode: 'SILENCE_GAP',
      severity: 'high',
      summary: `No GPS for ${g.minutes} min. Likely cause: ${g.inferredCause}`,
      evidence: {
        gapStart: g.before.recordedAt,
        gapEnd: g.after.recordedAt,
        durationMinutes: g.minutes,
        lastPingBattery: g.before.phone.batteryPct,
        inferredCause: g.inferredCause,
      },
      pingIds: [g.before.id, g.after.id],
    });
  }
  for (const h of a.handovers) {
    if (h.issues.length === 0) continue;
    out.push({
      ...base,
      ruleCode: 'HANDOVER_ANOMALY',
      severity: h.issues.length >= 2 ? 'critical' : 'high',
      summary: `Driver change while in transit looks irregular: ${h.issues.join('; ')}`,
      evidence: { changedAt: h.at, fromDriverId: h.fromDriverId, toDriverId: h.toDriverId, parkedMinutes: h.parkedMinutes, resumeDistanceMetres: h.resumeDistanceM, silenceAfterResumeMinutes: h.silenceAfterResumeMin, reason: h.reason },
      pingIds: [h.lastPing?.id, h.firstPing?.id].filter((x): x is string => !!x),
    });
  }
  for (const e of a.notifyMissing) {
    out.push({
      ...base,
      ruleCode: 'NOTIFY_GAP',
      severity: 'critical',
      summary: `Geofence ${e.transition} at ${load.stops.find((s) => s.id === e.stopId)?.dcName ?? 'stop'} had no notification within 15 min`,
      evidence: { direction: 'missing', geofenceEventId: e.id, transition: e.transition, occurredAt: e.occurredAt },
      pingIds: [],
    });
  }
  for (const m of a.missed) {
    const bothLow = m.before.accuracyM > LOW_ACCURACY_M && m.after.accuracyM > LOW_ACCURACY_M;
    out.push({
      ...base,
      ruleCode: 'FENCE_MISSED',
      severity: bothLow ? 'medium' : 'critical',
      summary: `Driver crossed ${m.stop.dcName} geofence (${m.transition}) but no event was recorded`,
      evidence: { stopId: m.stop.id, crossingType: m.transition, beforeDistanceM: Math.round(haversineM(m.before.location, m.stop.location)), afterDistanceM: Math.round(haversineM(m.after.location, m.stop.location)) },
      pingIds: [m.before.id, m.after.id],
    });
  }
  return out;
}

export function driverDrafts(driverId: string, loads: Load[]): FindingDraft[] {
  // Delivery outcome and lateness belong to the driver who finished the load;
  // GPS gaps and photos belong to whoever sent them, so a handover never blames the wrong driver.
  const mine = loads.filter((l) => l.finalDriverId === driverId);
  const involved = loads.filter((l) => l.assignments.some((a) => a.driverId === driverId));
  const out: FindingDraft[] = [];
  const base = { driverId, pingIds: [] as string[] };

  for (const l of mine) {
    const delivery = l.stops.find((s) => s.kind === 'delivery');
    if (l.deliveryMarkedDistanceM !== null && delivery && l.deliveryMarkedDistanceM > delivery.radiusM) {
      out.push({
        ...base,
        loadId: l.id,
        photoIds: [],
        ruleCode: 'DELIVERED_OUTSIDE_GEOFENCE',
        severity: 'critical',
        summary: `${l.number}: delivery marked ${(l.deliveryMarkedDistanceM / 1000).toFixed(1)} km from the stop (radius ${delivery.radiusM} m)`,
        evidence: { load: l.number, markedAt: l.deliveryMarkedAt ?? '', distanceM: l.deliveryMarkedDistanceM, radiusM: delivery.radiusM },
      });
    }
    if (l.status === 'cancelled') {
      out.push({
        ...base,
        loadId: l.id,
        photoIds: [],
        ruleCode: 'DELIVERY_NOT_COMPLETED',
        severity: 'high',
        summary: `${l.number}: closed without delivery after breakdown; driver's GPS ends at ${l.pings[l.pings.length - 1].recordedAt.slice(11, 16)} UTC`,
        evidence: { load: l.number, lastPing: l.pings[l.pings.length - 1].recordedAt, problems: l.problems.map((p) => p.type) },
      });
    }
  }

  const ownGaps = (l: Load) => analyzeLoad(l).gaps.filter((g) => g.before.driverId === driverId);
  const gapLoads = involved.filter((l) => ownGaps(l).length > 0);
  if (gapLoads.length >= 2) {
    const total = gapLoads.reduce((s, l) => s + ownGaps(l).reduce((x, g) => x + g.minutes, 0), 0);
    out.push({
      ...base,
      photoIds: [],
      ruleCode: 'GPS_OFF_PATTERN',
      severity: 'high',
      summary: `GPS went silent on ${gapLoads.length} shipments (${total} min total)`,
      evidence: { loads: gapLoads.map((l) => l.number), totalMinutes: total },
    });
  }

  const wrongPhotos = involved.flatMap((l) => l.photos.filter((p) => p.driverId === driverId && p.context === 'elsewhere').map((p) => ({ l, p })));
  if (wrongPhotos.length >= 2) {
    out.push({
      ...base,
      photoIds: wrongPhotos.map((x) => x.p.id),
      ruleCode: 'PHOTO_WRONG_LOCATION',
      severity: 'high',
      summary: `${wrongPhotos.length} photos taken away from any stop or route`,
      evidence: { loads: wrongPhotos.map((x) => x.l.number), distancesFromStopKm: wrongPhotos.map((x) => (x.p.distanceToStopM / 1000).toFixed(1)) },
    });
  }

  const byHash = new Map<string, { l: Load; id: string }[]>();
  for (const l of involved) for (const p of l.photos.filter((x) => x.driverId === driverId)) byHash.set(p.imageHash, [...(byHash.get(p.imageHash) ?? []), { l, id: p.id }]);
  for (const [hash, uses] of byHash) {
    if (new Set(uses.map((u) => u.l.id)).size > 1) {
      out.push({
        ...base,
        photoIds: uses.map((u) => u.id),
        ruleCode: 'PHOTO_REUSED',
        severity: 'critical',
        summary: `Same photo used on ${new Set(uses.map((u) => u.l.id)).size} different shipments`,
        evidence: { imageHash: hash, loads: [...new Set(uses.map((u) => u.l.number))] },
      });
    }
  }

  const lateLoads = mine.filter((l) => l.lateMinutes >= LATE_THRESHOLD_MIN);
  if (lateLoads.length >= 3) {
    out.push({
      ...base,
      photoIds: [],
      ruleCode: 'REPEATED_LATE',
      severity: 'medium',
      summary: `Late arrival on ${lateLoads.length} of ${mine.length} recent shipments`,
      evidence: { loads: lateLoads.map((l) => l.number), lateMinutes: lateLoads.map((l) => `${l.lateMinutes} min`) },
    });
  }
  return out;
}

export interface PatternChip {
  key: string;
  label: string;
  tone: 'critical' | 'high' | 'medium';
}

export function patternsForLoad(load: Load): PatternChip[] {
  const a = analyzeLoad(load);
  const chips: PatternChip[] = [];
  if (load.lateMinutes >= LATE_THRESHOLD_MIN) chips.push({ key: 'late', label: `Late arrival (${load.lateMinutes} min)`, tone: 'high' });
  if (a.gaps.length > 0) chips.push({ key: 'nogps', label: `No GPS (${a.gaps.reduce((s, g) => s + g.minutes, 0)} min)`, tone: 'high' });
  if (load.pings.filter((p) => p.context === 'off_route').length >= 5) chips.push({ key: 'offroute', label: 'Left planned route', tone: 'high' });
  if (load.photos.some((p) => p.context === 'elsewhere')) chips.push({ key: 'photos', label: 'Photos outside stops', tone: 'high' });
  if (load.status === 'cancelled') chips.push({ key: 'undelivered', label: 'Delivery not confirmed', tone: 'critical' });
  if (load.deliveryMarkedDistanceM !== null && load.deliveryMarkedDistanceM > 250) chips.push({ key: 'wrongplace', label: 'Marked delivered away from stop', tone: 'critical' });
  if (load.problems.length > 0 && a.gaps.length > 0) chips.push({ key: 'incidentgap', label: 'GPS gap around incident', tone: 'high' });
  if (load.assignments.some((x) => x.kind === 'replacement_before_pickup')) chips.push({ key: 'prereassign', label: 'Driver replaced before pickup', tone: 'medium' });
  if (load.assignments.some((x) => x.kind === 'replacement_mid_transit')) chips.push({ key: 'reassign', label: 'Driver changed mid-transit', tone: 'medium' });
  if (a.handovers.some((h) => h.issues.length > 0)) chips.push({ key: 'handoverissue', label: 'Irregular driver change', tone: 'high' });
  if (a.missed.length > 0) chips.push({ key: 'fence', label: 'Geofence crossing missed', tone: 'critical' });
  if (load.problems.length > 1) chips.push({ key: 'problems', label: 'Repeated problem reports', tone: 'medium' });
  return chips;
}
