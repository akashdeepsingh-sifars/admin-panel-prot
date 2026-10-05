import { haversineM } from '../lib/geo';
import { minutesBetween } from '../lib/format';
import { DRIVERS } from './people';
import type { EvidenceValue, Load, LoadNotification, Park, Ping, Severity, Stop } from '../types';
import { NOTIFICATION_LABEL, notificationsForLoad } from './notifications';

const GAP_MINUTES = 15;
const FROZEN_RADIUS_M = 15;
const FROZEN_MIN_READINGS = 3;
const FROZEN_MIN_SECONDS = 180;
const LOW_ACCURACY_M = 100;
const MANY_DRIVERS = 3;
const PARKED_MAX_MIN = 120;
const RESUME_MAX_DISTANCE_M = 1000;
const RESUME_MAX_SILENCE_MIN = 15;

export interface GapHit {
  before: Ping;
  after: Ping;
  minutes: number;
  inferredCause: string;
  // Where the silence started and ended, so a gap that spans a geofence is explained.
  startedAt: string;
  endedAt: string;
  spans: string;
}
export interface UnverifiedStop {
  stop: Stop;
  reason: string;
}
export interface FrozenHit {
  pings: Ping[];
  seconds: number;
}
export interface ChainStep {
  driverId: string;
  from: string;
  to: string;
  driveMinutes: number;
  pings: number;
  photos: number;
}
export interface DriverChain {
  steps: ChainStep[];
  changes: number;
  totalParkedMinutes: number;
}
export interface HandoverHit {
  declinedDriverIds: string[];
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
  chain: DriverChain;
  frozen: FrozenHit[];
  dupGroups: Ping[][];
  tsGroups: Ping[][];
  missed: MissedCrossing[];
  notifications: LoadNotification[];
  notifyIssues: LoadNotification[];
  unverified: UnverifiedStop[];
}

export const fenceName = (stop: Stop): string => `${stop.kind === 'pickup' ? 'Pickup' : 'Drop-off'} geofence · ${stop.dcName} (${stop.radiusM} m)`;
const placeOf = (load: Load, p: Ping): string => {
  if (p.context === 'normal') return 'on the road';
  const stop = load.stops.find((s) => s.kind === (p.context === 'pickup' ? 'pickup' : 'delivery'));
  return `inside the ${stop ? fenceName(stop) : p.context}`;
};

export interface FindingDraft {
  ruleCode: string;
  severity: Severity;
  summary: string;
  evidence: Record<string, EvidenceValue>;
  pingIds: string[];
  photoIds: string[];
  loadId?: string;
}

const ms = (iso: string): number => new Date(iso).getTime();
const fmtSpread = (sec: number): string => (sec < 90 ? `${sec} s` : `${Math.round(sec / 60)} min`);

function inferCause(p: Ping): string {
  if (p.phone.batteryPct <= 5) return `Battery ${p.phone.batteryPct}%`;
  if (p.phone.locationPermission !== 'always') return 'Location permission downgraded';
  if (p.phone.network === 'none') return 'No network connection';
  return 'Unknown';
}

export function analyzeLoad(load: Load): LoadAnalysis {
  const pings = load.pings;
  const inTransit = pings.filter((p) => p.context === 'normal');

  // A mid-transit driver change goes through a park (driver parks, carrier releases and assigns, new driver
  // resumes). The park explains the silence, so it is judged here instead of as a GPS gap.
  const handovers: HandoverHit[] = [];
  load.assignments.forEach((as, i) => {
    // A driver offered the shipment during a park who declined never drove, so there is nothing to judge for them.
    if (as.kind !== 'replacement_mid_transit' || as.endedBy === 'declined') return;
    // The change is judged from the last driver who actually drove, skipping anyone who declined.
    const prev = [...load.assignments.slice(0, i)].reverse().find((a) => a.endedBy !== 'declined') ?? load.assignments[0];
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
    const declinedDriverIds = load.assignments
      .filter((a) => a.kind === 'replacement_mid_transit' && a.endedBy === 'declined' && park && ms(a.from) >= ms(park.parkedAt) && ms(a.from) <= ms(park.resumedAt ?? a.from))
      .map((a) => a.driverId);
    handovers.push({ declinedDriverIds, at: as.from, fromDriverId: prev.driverId, toDriverId: as.driverId, reason: as.reason, park, releasedAt: prev.to, lastPing, firstPing, parkedMinutes, resumeDistanceM, silenceAfterResumeMin, issues });
  });
  // Who drove, in order, and how long the shipment sat parked in total.
  const steps: ChainStep[] = [];
  for (const p of pings) {
    const last = steps[steps.length - 1];
    if (last && last.driverId === p.driverId) {
      last.to = p.recordedAt;
      last.pings += 1;
    } else {
      steps.push({ driverId: p.driverId, from: p.recordedAt, to: p.recordedAt, driveMinutes: 0, pings: 1, photos: 0 });
    }
  }
  for (const st of steps) {
    st.driveMinutes = Math.round(minutesBetween(st.from, st.to));
    st.photos = load.photos.filter((ph) => ph.driverId === st.driverId).length;
  }
  const chain: DriverChain = {
    steps,
    changes: Math.max(0, steps.length - 1),
    totalParkedMinutes: load.parks.reduce((s, pk) => s + (pk.resumedAt ? Math.round(minutesBetween(pk.parkedAt, pk.resumedAt)) : 0), 0),
  };

  const insidePark = (a: Ping, b: Ping): boolean =>
    load.parks.some((pk) => ms(a.recordedAt) < ms(pk.resumedAt ?? pk.parkedAt) && ms(b.recordedAt) > ms(pk.parkedAt));

  const gaps: GapHit[] = [];
  for (let i = 1; i < pings.length; i++) {
    const m = minutesBetween(pings[i - 1].recordedAt, pings[i].recordedAt);
    if (m >= GAP_MINUTES && !insidePark(pings[i - 1], pings[i])) {
      gaps.push({
        before: pings[i - 1],
        after: pings[i],
        minutes: Math.round(m),
        inferredCause: inferCause(pings[i - 1]),
        startedAt: pings[i - 1].recordedAt,
        endedAt: pings[i].recordedAt,
        spans: pings[i - 1].context === pings[i].context ? `Silent ${placeOf(load, pings[i - 1])}` : `Started ${placeOf(load, pings[i - 1])}, ended ${placeOf(load, pings[i])}`,
      });
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
    const spread = Math.max(...group.map((p) => ms(p.receivedAt))) - Math.min(...group.map((p) => ms(p.receivedAt)));
    if (hashes.size === 1) dupGroups.push(group);
    else if (spread > 1000) tsGroups.push(group);
  }

  const missed: MissedCrossing[] = [];
  for (const stop of load.stops) {
    const ctx = stop.kind === 'pickup' ? 'pickup' : 'delivery';
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

  const notifications = notificationsForLoad(load);
  const notifyIssues = notifications.filter((n) => n.status !== 'delivered');

  // A stop is verified when an arrival was confirmed there or a pickup/delivery photo was taken at the stop.
  const unverified: UnverifiedStop[] = [];
  for (const stop of load.stops) {
    const photoCtx = stop.kind === 'pickup' ? 'at_pickup' : 'at_delivery';
    const arrived = stop.arrivedAt !== null;
    const photo = load.photos.some((ph) => ph.context === photoCtx);
    if (stop.kind === 'pickup' && !arrived && !photo) unverified.push({ stop, reason: 'No arrival was confirmed and no pickup photo was taken at the stop' });
    if (stop.kind === 'delivery') {
      if (!arrived && !photo) unverified.push({ stop, reason: 'No arrival was confirmed and no delivery photo was taken at the stop' });
      else if (load.deliveryMarkedAt === null) unverified.push({ stop, reason: 'The load was never marked as delivered' });
    }
  }

  return { gaps, handovers, chain, frozen, dupGroups, tsGroups, missed, notifications, notifyIssues, unverified };
}

export function shipmentDrafts(load: Load): FindingDraft[] {
  const a = analyzeLoad(load);
  const out: FindingDraft[] = [];
  const base = { loadId: load.id, photoIds: [] as string[] };
  const at = (g: Ping[]): string => g[0].recordedAt.slice(11, 19);
  const driverName = (id: string): string => DRIVERS.find((d) => d.id === id)?.name ?? id;
  const driverOf = (pings: Ping[]): string => driverName(pings[0].driverId);

  for (const g of a.dupGroups) {
    out.push({
      ...base,
      ruleCode: 'DUP_EXACT',
      severity: g.length >= 5 ? 'high' : 'medium',
      summary: `Same GPS reading stored ${g.length} times at ${at(g)} UTC (copies arrived ${fmtSpread(Math.round((ms(g[g.length - 1].receivedAt) - ms(g[0].receivedAt)) / 1000))} apart)`,
      evidence: { dupCount: g.length, recordedAt: g[0].recordedAt, driver: driverOf(g), receivedAtSpreadSec: Math.round((ms(g[g.length - 1].receivedAt) - ms(g[0].receivedAt)) / 1000) },
      pingIds: g.map((p) => p.id),
    });
  }
  for (const g of a.tsGroups) {
    out.push({
      ...base,
      ruleCode: 'SAME_TIME_DIFFERENT_POSITION',
      severity: 'medium',
      summary: `Two readings share recorded time ${at(g)} UTC but their positions differ`,
      evidence: { recordedAt: g[0].recordedAt, driver: driverOf(g), receivedAtValues: g.map((p) => p.receivedAt) },
      pingIds: g.map((p) => p.id),
    });
  }
  for (const f of a.frozen) {
    out.push({
      ...base,
      ruleCode: 'STATIC_LOCATION',
      severity: 'medium',
      summary: `Static at one location for ${Math.round(f.seconds / 60)} min while in transit (${f.pings.length} readings)`,
      evidence: { driver: driverOf(f.pings), readings: f.pings.length, durationSeconds: f.seconds, from: f.pings[0].recordedAt, to: f.pings[f.pings.length - 1].recordedAt, location: `${f.pings[0].location.lat.toFixed(4)}, ${f.pings[0].location.lng.toFixed(4)}` },
      pingIds: f.pings.map((p) => p.id),
    });
  }
  for (const g of a.gaps) {
    out.push({
      ...base,
      ruleCode: 'SILENCE_GAP',
      severity: 'high',
      summary: `No GPS for ${g.minutes} min. ${g.spans}. Likely cause: ${g.inferredCause}`,
      evidence: {
        driver: driverName(g.before.driverId),
        gapStart: g.startedAt,
        gapEnd: g.endedAt,
        durationMinutes: g.minutes,
        where: g.spans,
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
      summary: `Driver change from ${driverName(h.fromDriverId)} to ${driverName(h.toDriverId)} looks irregular: ${h.issues.join('; ')}`,
      evidence: { changedAt: h.at, fromDriver: driverName(h.fromDriverId), toDriver: driverName(h.toDriverId), parkedMinutes: h.parkedMinutes, resumeDistanceMetres: h.resumeDistanceM, silenceAfterResumeMinutes: h.silenceAfterResumeMin, reason: h.reason },
      pingIds: [h.lastPing?.id, h.firstPing?.id].filter((x): x is string => !!x),
    });
  }
  if (a.chain.steps.length >= MANY_DRIVERS) {
    const names = a.chain.steps.map((st) => driverName(st.driverId));
    out.push({
      ...base,
      ruleCode: 'HANDOVER_ANOMALY',
      severity: 'high',
      summary: `Shipment changed hands ${a.chain.changes} times (${names.join(' → ')}) and sat parked ${a.chain.totalParkedMinutes} min in total`,
      evidence: { drivers: names, changes: a.chain.changes, totalParkedMinutes: a.chain.totalParkedMinutes, limit: `${MANY_DRIVERS - 1} drivers` },
      pingIds: [],
    });
  }
  for (const n of a.notifyIssues) {
    out.push({
      ...base,
      ruleCode: 'NOTIFICATION_ANOMALY',
      severity: n.status === 'missing' ? 'critical' : 'high',
      summary: `${NOTIFICATION_LABEL[n.type]} notification for the ${n.recipient} (${n.recipientName}) was ${n.status === 'missing' ? 'never sent' : 'sent but failed'}`,
      evidence: { notificationType: NOTIFICATION_LABEL[n.type], recipient: n.recipient, recipientName: n.recipientName, status: n.status, channel: n.channel, expectedAt: n.expectedAt, reason: n.reason ?? '' },
      pingIds: [],
    });
  }
  for (const m of a.missed) {
    const bothLow = m.before.accuracyM > LOW_ACCURACY_M && m.after.accuracyM > LOW_ACCURACY_M;
    out.push({
      ...base,
      ruleCode: 'FENCE_MISSED',
      severity: bothLow ? 'medium' : 'critical',
      summary: `Missed geofence: ${fenceName(m.stop)}. The ${m.transition === 'enter' ? 'entry into' : 'exit from'} the geofence was crossed but no event was recorded`,
      evidence: { geofence: fenceName(m.stop), stopId: m.stop.id, stopKind: m.stop.kind, crossing: m.transition, beforeDistanceM: Math.round(haversineM(m.before.location, m.stop.location)), afterDistanceM: Math.round(haversineM(m.after.location, m.stop.location)) },
      pingIds: [m.before.id, m.after.id],
    });
  }
  for (const u of a.unverified) {
    out.push({
      ...base,
      ruleCode: 'PICKUP_DELIVERY_NOT_VERIFIED',
      severity: 'high',
      summary: `${u.stop.kind === 'pickup' ? 'Pickup' : 'Delivery'} at ${u.stop.dcName} was not verified. ${u.reason}`,
      evidence: { stop: u.stop.dcName, stopKind: u.stop.kind, reason: u.reason, arrivedAt: u.stop.arrivedAt ?? 'never', markedDeliveredAt: u.stop.kind === 'delivery' ? load.deliveryMarkedAt ?? 'never' : 'n/a' },
      pingIds: [],
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
  if (a.gaps.length > 0) chips.push({ key: 'nogps', label: `GPS silence (${a.gaps.length} gap${a.gaps.length > 1 ? 's' : ''}, ${a.gaps.reduce((s, g) => s + g.minutes, 0)} min)`, tone: 'high' });
  if (a.frozen.length > 0) chips.push({ key: 'static', label: 'Static location', tone: 'medium' });
  if (a.dupGroups.length > 0) chips.push({ key: 'dup', label: 'Duplicate GPS', tone: 'medium' });
  if (a.tsGroups.length > 0) chips.push({ key: 'ts', label: 'Same time, different position', tone: 'medium' });
  if (a.missed.length > 0) chips.push({ key: 'fence', label: `Geofence missed (${a.missed.map((m) => `${m.stop.kind} ${m.transition}`).join(', ')})`, tone: 'critical' });
  if (a.unverified.length > 0) chips.push({ key: 'unverified', label: 'Pickup/delivery not verified', tone: 'high' });
  if (a.notifyIssues.length > 0) chips.push({ key: 'notify', label: `Notification anomaly (${a.notifyIssues.length})`, tone: 'critical' });
  if (a.chain.steps.length >= MANY_DRIVERS) chips.push({ key: 'manydrivers', label: `${a.chain.steps.length} drivers on one shipment`, tone: 'high' });
  if (a.handovers.some((h) => h.issues.length > 0)) chips.push({ key: 'handoverissue', label: 'Irregular driver change', tone: 'high' });
  else if (a.chain.changes > 0) chips.push({ key: 'reassign', label: `Driver changed mid-transit${a.chain.changes > 1 ? ` (${a.chain.changes} times)` : ''}`, tone: 'medium' });
  return chips;
}
