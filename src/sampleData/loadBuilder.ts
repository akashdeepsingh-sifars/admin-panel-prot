import { distToPolylineM, haversineM, mulberry32, offsetLatLng, pointAtFraction } from '../lib/geo';
import type {
  Break,
  DriverAssignment,
  Park,
  GeofenceEvent,
  LatLng,
  Load,
  Photo,
  PhotoContext,
  PhotoKind,
  Ping,
  PingContext,
  PhoneState,
  Problem,
  ProblemType,
  Stop,
  StopKind,
} from '../types';
import { flagPings } from './analyze';
import { CARRIERS, DRIVERS, SHIPPERS } from './people';

export type GapCause = 'offline' | 'battery_dead' | 'permission_revoked' | 'park';

export interface GapSpec {
  startFrac: number;
  minutes: number;
  cause: GapCause;
}
export interface FrozenSpec {
  atFrac: number;
  minutes: number;
  kind: 'break' | 'stuck';
}
export interface OffRouteSpec {
  fromFrac: number;
  toFrac: number;
  offsetKm: number;
}
export interface PhotoSpec {
  kind: PhotoKind;
  stopKind: StopKind;
  where: 'stop' | 'route' | 'elsewhere';
  minutesFromArrival: number;
  routeFrac?: number;
  imageHash: string;
}

export interface LoadSpec {
  key: string;
  seed: number;
  number: string;
  commodity: string;
  equipment: string;
  route: LatLng[];
  pickup: { name: string; address: string };
  delivery: { name: string; address: string };
  startISO: string;
  driveMinutes: number;
  shipperIdx: number;
  carrierIdx: number;
  driverId: string;
  // Mid-transit change: driver parks, carrier releases and assigns, new driver resumes.
  reassign?: { atFrac: number; toDriverId: string; reason: string; parkMinutes: number; resumeOffsetKm?: number };
  // Before pickup: the first driver declined after accepting and the carrier assigned driverId.
  preReassign?: { fromDriverId: string; declineReason: string };
  gaps?: GapSpec[];
  frozen?: FrozenSpec[];
  offRoute?: OffRouteSpec[];
  dupAtFrac?: number[];
  dupTsAtFrac?: number[];
  lateMinutes?: number;
  fenceMissedDelivery?: boolean;
  notifyGapPickupExit?: boolean;
  stopAtFrac?: number;
  deliveredMarkedOffsetKm?: number;
  photos: PhotoSpec[];
  problem?: { atFrac: number; type: ProblemType; note: string };
}

const STOP_RADIUS_M = 250;
const DWELL_MIN = 20;
const APPROACH_MIN = 6;
const OFF_ROUTE_THRESHOLD_M = 500;
const MIN = 60000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function phoneFor(rnd: () => number, t: number, totalT: number, atStop: boolean): PhoneState {
  const battery = Math.max(6, Math.round(92 - (t / Math.max(totalT, 1)) * 48 + (rnd() - 0.5) * 2));
  return {
    batteryPct: battery,
    charging: !atStop && rnd() < 0.35,
    powerSave: battery < 20,
    network: atStop && rnd() < 0.85 ? 'wifi' : 'cellular',
    locationPermission: 'always',
    locationPrecision: 'precise',
    appState: atStop ? 'foreground' : rnd() < 0.15 ? 'foreground' : 'background',
  };
}

function applyCause(phone: PhoneState, cause: GapCause): PhoneState {
  switch (cause) {
    case 'offline':
      return { ...phone, network: 'none' };
    case 'battery_dead':
      return { ...phone, batteryPct: 3, powerSave: true, charging: false };
    case 'park':
      return phone;
    case 'permission_revoked':
      return { ...phone, locationPermission: 'while_using', locationPrecision: 'approximate', appState: 'background' };
  }
}

interface RawPing {
  id: string;
  driverId: string;
  recordedAtMs: number;
  receivedAtMs: number;
  location: LatLng;
  accuracyM: number;
  offlineQueued: boolean;
  phone: PhoneState;
}

export function buildLoad(spec: LoadSpec): Load {
  const rnd = mulberry32(spec.seed);
  const startMs = new Date(spec.startISO).getTime();
  const D = spec.driveMinutes;
  const route = spec.route;

  // Breaks extend the trip; stuck GPS windows do not (position teleports afterwards).
  // A park (driver change) pauses the truck exactly like a break: it resumes from the same spot.
  const pauseSpecs = [
    ...(spec.frozen ?? []).filter((f) => f.kind === 'break').map((b) => ({ atFrac: b.atFrac, minutes: b.minutes, kind: 'break' as 'break' | 'park' })),
    ...(spec.reassign ? [{ atFrac: spec.reassign.atFrac, minutes: spec.reassign.parkMinutes, kind: 'park' as 'break' | 'park' }] : []),
  ];
  let prior = 0;
  const breakWindows = [...pauseSpecs]
    .sort((a, b) => a.atFrac - b.atFrac)
    .map((b) => {
      const start = DWELL_MIN + b.atFrac * D + prior;
      prior += b.minutes;
      return { startT: start, minutes: b.minutes, atFrac: b.atFrac, kind: b.kind };
    });
  const totalBreak = prior;
  const deliveryT = DWELL_MIN + D + totalBreak;
  const endT = deliveryT + DWELL_MIN;
  const stuckWindows = (spec.frozen ?? [])
    .filter((f) => f.kind === 'stuck')
    .map((f) => ({ startT: DWELL_MIN + f.atFrac * D + totalBreak * f.atFrac, minutes: f.minutes, atFrac: f.atFrac }));
  const parkWindow = breakWindows.find((w) => w.kind === 'park');
  const handoverT = parkWindow ? parkWindow.startT : Infinity;
  const handoverGap = parkWindow ? parkWindow.minutes : 0;
  const gapWindows = [
    ...(spec.gaps ?? []).map((g) => ({
      startT: DWELL_MIN + g.startFrac * D + totalBreak * g.startFrac,
      minutes: g.minutes,
      cause: g.cause,
    })),
    ...(handoverGap > 0 ? [{ startT: handoverT, minutes: handoverGap, cause: 'park' as GapCause }] : []),
  ];

  const fractionAt = (t: number): number => {
    let paused = 0;
    for (const w of breakWindows) {
      if (t >= w.startT + w.minutes) paused += w.minutes;
      else if (t >= w.startT) paused += t - w.startT;
    }
    return (t - DWELL_MIN - paused) / D;
  };

  const raw: RawPing[] = [];
  let seq = 0;
  const cutoffFrac = spec.stopAtFrac ?? Infinity;

  for (let t = -APPROACH_MIN; t <= endT; t += 1) {
    const inGap = gapWindows.some((g) => t >= g.startT && t < g.startT + g.minutes);
    if (inGap) continue;

    let loc: LatLng;
    let atStop = false;
    if (t < 0) {
      const p = pointAtFraction(route, 0);
      loc = offsetLatLng(p, -t * 0.15, 180);
    } else if (t < DWELL_MIN) {
      const p = pointAtFraction(route, 0);
      loc = { lat: p.lat + (rnd() - 0.5) * 0.0008, lng: p.lng + (rnd() - 0.5) * 0.0008 };
      atStop = true;
    } else if (t <= deliveryT) {
      let f = fractionAt(t);
      if (f > cutoffFrac) break;
      const stuck = stuckWindows.find((w) => t >= w.startT && t < w.startT + w.minutes);
      if (stuck) f = stuck.atFrac;
      f = Math.max(0, Math.min(1, f));
      const p = pointAtFraction(route, f);
      loc = { lat: p.lat, lng: p.lng };
      const off = (spec.offRoute ?? []).find((o) => f >= o.fromFrac && f <= o.toFrac);
      if (off) {
        const w = Math.sin((Math.PI * (f - off.fromFrac)) / (off.toFrac - off.fromFrac));
        loc = offsetLatLng(p, off.offsetKm * w, 90);
      }
      const hEnd = handoverT + handoverGap;
      if (spec.reassign?.resumeOffsetKm && t >= hEnd && t < hEnd + 6) {
        loc = offsetLatLng(p, spec.reassign.resumeOffsetKm * (1 - (t - hEnd) / 6), 90);
      }
      const inBreak = breakWindows.some((w) => t >= w.startT && t < w.startT + w.minutes);
      const jitter = inBreak ? 0.00002 : 0.0003;
      if (!stuck) loc = { lat: loc.lat + (rnd() - 0.5) * jitter, lng: loc.lng + (rnd() - 0.5) * jitter };
      atStop = t === DWELL_MIN || t === deliveryT ? true : false;
    } else {
      const p = pointAtFraction(route, 1);
      loc = { lat: p.lat + (rnd() - 0.5) * 0.0008, lng: p.lng + (rnd() - 0.5) * 0.0008 };
      atStop = true;
    }

    let phone = phoneFor(rnd, t, endT, atStop);
    for (const g of gapWindows) {
      const untilGap = g.startT - t;
      if (untilGap > 0 && untilGap <= 6) phone = applyCause(phone, g.cause);
    }
    const lowAcc = rnd() < 0.03;
    const offline = rnd() < 0.03;
    const recordedAtMs = startMs + t * MIN;
    raw.push({
      id: `${spec.key}-r${seq++}`,
      driverId: spec.reassign && t >= handoverT ? spec.reassign.toDriverId : spec.driverId,
      recordedAtMs,
      receivedAtMs: recordedAtMs + (offline ? (3 + rnd() * 5) * MIN : (1 + rnd() * 2) * 1000),
      location: loc,
      accuracyM: lowAcc ? Math.round(110 + rnd() * 120) : Math.round(5 + rnd() * 15),
      offlineQueued: offline,
      phone,
    });
  }

  // Exact duplicates and same-timestamp drift, injected next to the nearest ping.
  const nearestIdx = (frac: number): number => {
    const target = startMs + (DWELL_MIN + frac * D + totalBreak * frac) * MIN;
    let best = 0;
    for (let i = 0; i < raw.length; i++) {
      if (Math.abs(raw[i].recordedAtMs - target) < Math.abs(raw[best].recordedAtMs - target)) best = i;
    }
    return best;
  };
  for (const frac of spec.dupAtFrac ?? []) {
    const src = raw[nearestIdx(frac)];
    for (let n = 1; n <= 2; n++) {
      raw.push({ ...src, id: `${spec.key}-r${seq++}`, receivedAtMs: src.receivedAtMs + n * 3000 });
    }
  }
  for (const frac of spec.dupTsAtFrac ?? []) {
    const src = raw[nearestIdx(frac)];
    raw.push({
      ...src,
      id: `${spec.key}-r${seq++}`,
      location: { lat: src.location.lat + 0.0003, lng: src.location.lng + 0.0002 },
      receivedAtMs: src.receivedAtMs + 9000,
    });
  }
  raw.sort((a, b) => a.recordedAtMs - b.recordedAtMs || a.receivedAtMs - b.receivedAtMs);

  // Stops.
  const pickupLoc = { lat: route[0].lat, lng: route[0].lng };
  const deliveryLoc = { lat: route[route.length - 1].lat, lng: route[route.length - 1].lng };
  const deliveryArrivalMs = startMs + deliveryT * MIN;
  const late = spec.lateMinutes ?? 0;
  const deliveryEndMs = late > 0 ? deliveryArrivalMs - late * MIN : deliveryArrivalMs + 45 * MIN;
  const stops: Stop[] = [
    {
      id: `${spec.key}-stop-1`,
      kind: 'pickup',
      dcName: spec.pickup.name,
      address: spec.pickup.address,
      location: pickupLoc,
      radiusM: STOP_RADIUS_M,
      scheduledStart: iso(startMs - 30 * MIN),
      scheduledEnd: iso(startMs + 30 * MIN),
      arrivedAt: null,
      departedAt: null,
    },
    {
      id: `${spec.key}-stop-2`,
      kind: 'delivery',
      dcName: spec.delivery.name,
      address: spec.delivery.address,
      location: deliveryLoc,
      radiusM: STOP_RADIUS_M,
      scheduledStart: iso(deliveryEndMs - 120 * MIN),
      scheduledEnd: iso(deliveryEndMs),
      arrivedAt: null,
      departedAt: null,
    },
  ];

  // Classify pings.
  const pings: Ping[] = raw.map((r, i) => {
    const dPick = haversineM(r.location, pickupLoc);
    const dDel = haversineM(r.location, deliveryLoc);
    const offRouteM = distToPolylineM(r.location, route);
    let context: PingContext;
    if (dPick <= STOP_RADIUS_M) context = 'pickup_radius';
    else if (dDel <= STOP_RADIUS_M) context = 'delivery_radius';
    else context = offRouteM > OFF_ROUTE_THRESHOLD_M ? 'off_route' : 'on_route';
    return {
      id: `${spec.key}-p${i + 1}`,
      driverId: r.driverId,
      recordedAt: iso(r.recordedAtMs),
      receivedAt: iso(r.receivedAtMs),
      location: r.location,
      accuracyM: r.accuracyM,
      offlineQueued: r.offlineQueued,
      context,
      offRouteM: Math.round(offRouteM),
      nearestStopId: dPick <= dDel ? stops[0].id : stops[1].id,
      phone: r.phone,
      flags: [],
    };
  });

  // Geofence crossings derived from pings.
  const geofenceEvents: GeofenceEvent[] = [];
  const stopCtx: Record<string, PingContext> = { [stops[0].id]: 'pickup_radius', [stops[1].id]: 'delivery_radius' };
  for (const stop of stops) {
    let inside = false;
    let entered = false;
    for (const p of pings) {
      const isIn = p.context === stopCtx[stop.id];
      if (isIn === inside) continue;
      inside = isIn;
      if (isIn && !entered) {
        entered = true;
        stop.arrivedAt = p.recordedAt;
        const missed = spec.fenceMissedDelivery && stop.kind === 'delivery';
        if (!missed) {
          geofenceEvents.push({ id: `${stop.id}-enter`, stopId: stop.id, transition: 'enter', occurredAt: p.recordedAt, notified: true });
        }
      } else if (!isIn && entered && !stop.departedAt) {
        stop.departedAt = p.recordedAt;
        geofenceEvents.push({
          id: `${stop.id}-exit`,
          stopId: stop.id,
          transition: 'exit',
          occurredAt: p.recordedAt,
          notified: !(spec.notifyGapPickupExit && stop.kind === 'pickup'),
        });
      }
    }
  }

  // Photos.
  const photos: Photo[] = spec.photos.map((ps, i) => {
    const stop = stops.find((s) => s.kind === ps.stopKind) as Stop;
    const arrival = stop.arrivedAt ? new Date(stop.arrivedAt).getTime() : deliveryArrivalMs;
    const at = arrival + ps.minutesFromArrival * MIN;
    let loc: LatLng;
    if (ps.where === 'stop') {
      loc = { lat: stop.location.lat + (rnd() - 0.5) * 0.0006, lng: stop.location.lng + (rnd() - 0.5) * 0.0006 };
    } else if (ps.where === 'route') {
      const p = pointAtFraction(route, ps.routeFrac ?? 0.5);
      loc = { lat: p.lat, lng: p.lng };
    } else {
      const p = pointAtFraction(route, ps.routeFrac ?? 0.6);
      loc = offsetLatLng(p, 6 + rnd() * 3, 90);
    }
    const dStop = haversineM(loc, stop.location);
    const offRoute = distToPolylineM(loc, route);
    let context: PhotoContext;
    if (haversineM(loc, pickupLoc) <= STOP_RADIUS_M) context = 'at_pickup';
    else if (haversineM(loc, deliveryLoc) <= STOP_RADIUS_M) context = 'at_delivery';
    else context = offRoute > OFF_ROUTE_THRESHOLD_M ? 'elsewhere' : 'on_route';
    const expectedCtx: PhotoContext = ps.stopKind === 'pickup' ? 'at_pickup' : 'at_delivery';
    return {
      id: `${spec.key}-ph${i + 1}`,
      driverId: spec.reassign && at >= startMs + (handoverT + handoverGap) * MIN ? spec.reassign.toDriverId : spec.driverId,
      kind: ps.kind,
      uploadedAt: iso(at),
      location: loc,
      context,
      nearestStopId: stop.id,
      distanceToStopM: Math.round(dStop),
      minutesFromArrival: ps.minutesFromArrival,
      onTime: context === expectedCtx && ps.minutesFromArrival >= -5 && ps.minutesFromArrival <= 30,
      imageHash: ps.imageHash,
      tone: Math.floor(rnd() * 5),
    };
  });

  // Problems and breaks.
  const problems: Problem[] = [];
  const breakList: Break[] = breakWindows.filter((w) => w.kind === 'break').map((w, i) => {
    const p = pointAtFraction(route, w.atFrac);
    return {
      id: `${spec.key}-brk${i + 1}`,
      startedAt: iso(startMs + w.startT * MIN),
      endedAt: iso(startMs + (w.startT + w.minutes) * MIN),
      location: { lat: p.lat, lng: p.lng },
    };
  });
  if (spec.problem) {
    const t = DWELL_MIN + spec.problem.atFrac * D + totalBreak * spec.problem.atFrac;
    const p = pointAtFraction(route, spec.problem.atFrac);
    problems.push({
      id: `${spec.key}-prob1`,
      type: spec.problem.type,
      reportedAt: iso(startMs + t * MIN),
      location: { lat: p.lat, lng: p.lng },
      reporter: DRIVERS.find((d) => d.id === spec.driverId)?.name ?? 'Driver',
      status: spec.stopAtFrac ? 'open' : 'resolved',
      note: spec.problem.note,
    });
    if (spec.problem.type === 'accident' || spec.problem.type === 'breakdown') {
      breakList.push({
        id: `${spec.key}-brk-incident`,
        startedAt: iso(startMs + t * MIN),
        endedAt: iso(startMs + (t + 25) * MIN),
        location: { lat: p.lat, lng: p.lng },
      });
    }
  }

  // Assignments.
  const acceptedAt = startMs - 26 * 60 * MIN;
  const assignments: DriverAssignment[] = [];
  if (spec.preReassign) {
    assignments.push({ driverId: spec.preReassign.fromDriverId, from: iso(acceptedAt + 30 * MIN), to: iso(acceptedAt + 5 * 60 * MIN), reason: `Declined pickup: ${spec.preReassign.declineReason}`, kind: 'initial', endedBy: 'declined' });
    assignments.push({ driverId: spec.driverId, from: iso(acceptedAt + 5 * 60 * MIN + 6 * MIN), to: null, reason: 'Carrier assigned a replacement before pickup', kind: 'replacement_before_pickup', endedBy: null });
  } else {
    assignments.push({ driverId: spec.driverId, from: iso(acceptedAt + 60 * MIN), to: null, reason: 'Initial assignment', kind: 'initial', endedBy: null });
  }
  let finalDriverId = spec.driverId;
  const parks: Park[] = [];
  if (spec.reassign && parkWindow) {
    const parkedMs = startMs + parkWindow.startT * MIN;
    const at = pointAtFraction(route, parkWindow.atFrac);
    parks.push({ id: `${spec.key}-park1`, parkedAt: iso(parkedMs), resumedAt: iso(parkedMs + parkWindow.minutes * MIN), location: { lat: at.lat, lng: at.lng }, note: 'Parked by driver', cargoOnBoard: true });
    assignments[assignments.length - 1].to = iso(parkedMs + 2 * MIN);
    assignments[assignments.length - 1].endedBy = 'released';
    assignments.push({ driverId: spec.reassign.toDriverId, from: iso(parkedMs + 4 * MIN), to: null, reason: spec.reassign.reason, kind: 'replacement_mid_transit', endedBy: null });
    finalDriverId = spec.reassign.toDriverId;
  }

  const shipper = SHIPPERS[spec.shipperIdx];
  const carrier = CARRIERS[spec.carrierIdx];
  const delivered = spec.stopAtFrac === undefined;
  const marked = delivered ? deliveryArrivalMs + 8 * MIN : null;
  const markedLoc = delivered
    ? offsetLatLng({ ...deliveryLoc, bearingDeg: 0 }, spec.deliveredMarkedOffsetKm ?? 0.04, 45)
    : null;

  const load: Load = {
    id: spec.key,
    number: spec.number,
    status: delivered ? 'delivered' : 'cancelled',
    commodity: spec.commodity,
    equipment: spec.equipment,
    createdBy: { name: shipper.contact.name, at: iso(startMs - 72 * 60 * MIN) },
    bids: [
      { id: `${spec.key}-b1`, carrierName: CARRIERS[1 - spec.carrierIdx].name, amountUsd: 2350 + Math.round(rnd() * 300), placedAt: iso(startMs - 60 * 60 * MIN), outcome: 'rejected' },
      { id: `${spec.key}-b2`, carrierName: carrier.name, amountUsd: 2150 + Math.round(rnd() * 200), placedAt: iso(startMs - 58 * 60 * MIN), outcome: 'accepted' },
      { id: `${spec.key}-b3`, carrierName: CARRIERS[1 - spec.carrierIdx].name, amountUsd: 2500, placedAt: iso(startMs - 40 * 60 * MIN), outcome: 'expired' },
    ],
    acceptedBy: { name: shipper.contact.name, at: iso(acceptedAt) },
    shipper,
    carrier,
    assignments,
    parks,
    finalDriverId,
    stops,
    plannedRoute: route,
    pings,
    photos,
    problems,
    breaks: breakList,
    geofenceEvents,
    deliveryMarkedAt: marked ? iso(marked) : null,
    deliveryMarkedLocation: markedLoc,
    deliveryMarkedDistanceM: markedLoc ? Math.round(haversineM(markedLoc, deliveryLoc)) : null,
    lateMinutes: delivered ? late : 0,
  };
  return flagPings(load);
}
