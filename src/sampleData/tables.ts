import { UUID_RE, uuidFor } from '../lib/ids';
import type { DbColumn, DbRow, DbTable } from '../types';
import { LOADS } from './loads';
import { CARRIERS, DRIVERS, SHIPPERS } from './people';
import { FINDINGS, RUNS } from './runs';

const col = (name: string, type: DbColumn['type'] = 'text', extra: Partial<DbColumn> = {}): DbColumn => ({ name, type, ...extra });
const ID = col('id');
const CREATED = col('created_at', 'timestamptz');

const orgs = [...SHIPPERS.map((o) => ({ o, kind: 'shipper' })), ...CARRIERS.map((o) => ({ o, kind: 'carrier' }))];

const RAW_TABLES: DbTable[] = [
  {
    name: 'organizations',
    description: 'Shippers and carriers',
    columns: [ID, col('name'), col('kind'), col('contact_name'), col('contact_email'), CREATED],
    rows: orgs.map(({ o, kind }) => ({ id: o.id, name: o.name, kind, contact_name: o.contact.name, contact_email: o.contact.email, created_at: '2026-01-12T09:00:00.000Z' })),
  },
  {
    name: 'users',
    description: 'Drivers and organisation contacts',
    columns: [ID, col('name'), col('email'), col('phone'), col('role'), col('org_id'), col('device'), col('password_hash', 'text', { sensitive: true }), CREATED],
    rows: [
      ...DRIVERS.map((d) => ({ id: d.id, name: d.name, email: d.email, phone: d.phone, role: 'driver', org_id: d.orgId, device: d.device, password_hash: '$argon2id$…', created_at: '2026-02-03T10:00:00.000Z' })),
      ...orgs.map(({ o }) => ({ id: o.contact.id, name: o.contact.name, email: o.contact.email, phone: o.contact.phone, role: 'org.owner', org_id: o.id, device: null, password_hash: '$argon2id$…', created_at: '2026-01-12T09:05:00.000Z' })),
    ],
  },
  {
    name: 'loads',
    description: 'Shipments',
    columns: [ID, col('number'), col('status'), col('commodity'), col('equipment'), col('shipper_id'), col('carrier_id'), col('driver_id'), col('late_minutes', 'int'), col('delivery_marked_at', 'timestamptz'), col('delivery_marked_distance_m', 'int'), CREATED],
    rows: LOADS.map((l) => ({ id: l.id, number: l.number, status: l.status, commodity: l.commodity, equipment: l.equipment, shipper_id: l.shipper.id, carrier_id: l.carrier.id, driver_id: l.finalDriverId, late_minutes: l.lateMinutes, delivery_marked_at: l.deliveryMarkedAt, delivery_marked_distance_m: l.deliveryMarkedDistanceM, created_at: l.createdBy.at })),
  },
  {
    name: 'driver_crew_assignments',
    description: 'Driver assignments per load, including releases and declines',
    columns: [ID, col('load_id'), col('driver_user_id'), col('kind'), col('status'), col('reason'), col('accepted_at', 'timestamptz'), col('ended_at', 'timestamptz')],
    rows: LOADS.flatMap((l) => l.assignments.map((a, i) => ({ id: `${l.id}-asg${i + 1}`, load_id: l.id, driver_user_id: a.driverId, kind: a.kind, status: a.endedBy ?? 'accepted', reason: a.reason, accepted_at: a.from, ended_at: a.to }))),
  },
  {
    name: 'load_parks',
    description: 'Times a shipment was parked (driver change or driver cannot continue)',
    columns: [ID, col('load_id'), col('parked_at', 'timestamptz'), col('resumed_at', 'timestamptz'), col('latitude', 'numeric'), col('longitude', 'numeric'), col('note'), col('cargo_on_board', 'bool')],
    rows: LOADS.flatMap((l) => l.parks.map((p) => ({ id: p.id, load_id: l.id, parked_at: p.parkedAt, resumed_at: p.resumedAt, latitude: p.location.lat, longitude: p.location.lng, note: p.note, cargo_on_board: p.cargoOnBoard }))),
  },
  {
    name: 'load_stops',
    description: 'Pickup and delivery stops per load',
    columns: [ID, col('load_id'), col('kind'), col('dc_name'), col('address'), col('latitude', 'numeric'), col('longitude', 'numeric'), col('geofence_radius_m', 'int'), col('scheduled_start', 'timestamptz'), col('scheduled_end', 'timestamptz'), col('arrived_at', 'timestamptz'), col('departed_at', 'timestamptz')],
    rows: LOADS.flatMap((l) => l.stops.map((s) => ({ id: s.id, load_id: l.id, kind: s.kind, dc_name: s.dcName, address: s.address, latitude: s.location.lat, longitude: s.location.lng, geofence_radius_m: s.radiusM, scheduled_start: s.scheduledStart, scheduled_end: s.scheduledEnd, arrived_at: s.arrivedAt, departed_at: s.departedAt }))),
  },
  {
    name: 'driver_locations',
    description: 'Raw GPS pings from driver phones',
    columns: [ID, col('load_id'), col('driver_user_id'), col('point_lat', 'numeric'), col('point_lng', 'numeric'), col('accuracy_m', 'int'), col('recorded_at', 'timestamptz'), col('received_at', 'timestamptz'), col('was_offline_queued', 'bool'), col('battery_pct', 'int'), col('is_charging', 'bool'), col('power_save', 'bool'), col('network_type'), col('location_permission'), col('location_context'), col('os'), col('os_version'), col('app_version')],
    rows: LOADS.flatMap((l) =>
      l.pings.map((p) => ({ id: p.id, load_id: l.id, driver_user_id: p.driverId, point_lat: p.location.lat, point_lng: p.location.lng, accuracy_m: p.accuracyM, recorded_at: p.recordedAt, received_at: p.receivedAt, was_offline_queued: p.offlineQueued, battery_pct: p.phone.batteryPct, is_charging: p.phone.charging, power_save: p.phone.powerSave, network_type: p.phone.network, location_permission: p.phone.locationPermission, location_context: p.context, os: p.phone.os, os_version: p.phone.osVersion, app_version: p.phone.appVersion }))
    ),
  },
  {
    name: 'geofence_events',
    description: 'Enter/exit events detected at stops',
    columns: [ID, col('load_id'), col('load_stop_id'), col('transition'), col('occurred_at', 'timestamptz'), col('notified', 'bool')],
    rows: LOADS.flatMap((l) => l.geofenceEvents.map((g) => ({ id: g.id, load_id: l.id, load_stop_id: g.stopId, transition: g.transition, occurred_at: g.occurredAt, notified: g.notified }))),
  },
  {
    name: 'load_photos',
    description: 'Driver uploads at pickup and delivery',
    columns: [ID, col('load_id'), col('kind'), col('uploaded_at', 'timestamptz'), col('latitude', 'numeric'), col('longitude', 'numeric'), col('context'), col('distance_to_stop_m', 'int'), col('image_hash')],
    rows: LOADS.flatMap((l) => l.photos.map((p) => ({ id: p.id, load_id: l.id, kind: p.kind, uploaded_at: p.uploadedAt, latitude: p.location.lat, longitude: p.location.lng, context: p.context, distance_to_stop_m: p.distanceToStopM, image_hash: p.imageHash }))),
  },
  {
    name: 'diagnosis_runs',
    description: 'One row per diagnosis run',
    columns: [ID, col('kind'), col('load_id'), col('status'), col('window_start', 'timestamptz'), col('window_end', 'timestamptz'), col('created_by'), col('error'), CREATED],
    rows: RUNS.map((r) => ({ id: r.id, kind: r.kind, load_id: r.loadId, status: r.status, window_start: r.windowStart, window_end: r.windowEnd, created_by: r.createdBy, error: r.error ?? null, created_at: r.createdAt })),
  },
  {
    name: 'diagnosis_findings',
    description: 'Findings linked to runs (all sections)',
    columns: [ID, col('run_id'), col('section'), col('rule_code'), col('severity'), col('load_id'), col('summary'), col('detected_at', 'timestamptz')],
    rows: FINDINGS.map((f) => ({ id: f.id, run_id: f.runId, section: f.section, rule_code: f.ruleCode, severity: f.severity, load_id: f.loadId ?? null, summary: f.summary, detected_at: f.detectedAt })),
  },
  {
    name: 'service_configs',
    description: 'Encrypted third-party credentials. Values are never shown.',
    columns: [ID, col('service'), col('value_encrypted', 'text', { sensitive: true }), col('updated_at', 'timestamptz')],
    rows: [
      { id: 'sc-1', service: 'fcm', value_encrypted: 'AES-256-GCM…', updated_at: '2026-08-02T09:00:00.000Z' },
      { id: 'sc-2', service: 'email-provider', value_encrypted: 'AES-256-GCM…', updated_at: '2026-08-02T09:00:00.000Z' },
      { id: 'sc-3', service: 'fmcsa', value_encrypted: 'AES-256-GCM…', updated_at: '2026-08-20T13:30:00.000Z' },
    ],
  },
];

// Database ids are UUIDs. The sample sources use short ids (L3, drv-2, R-1042), so each id and foreign key
// is mapped to a stable UUID per entity kind; references keep pointing at the right rows.
const TABLE_KIND: Record<string, string> = { organizations: 'org', users: 'user', loads: 'load', load_stops: 'stop', diagnosis_runs: 'run' };
const FK_KIND: Record<string, string> = { load_id: 'load', driver_id: 'user', driver_user_id: 'user', shipper_id: 'org', carrier_id: 'org', org_id: 'org', load_stop_id: 'stop', run_id: 'run' };

function toUuid(value: DbRow[string], kind: string): DbRow[string] {
  return typeof value === 'string' && !UUID_RE.test(value) ? uuidFor(`${kind}:${value}`) : value;
}

export const DB_TABLES: DbTable[] = RAW_TABLES.map((t) => ({
  ...t,
  rows: t.rows.map((r) => {
    const out: DbRow = { ...r };
    for (const c of t.columns) {
      if (c.name === 'id') out[c.name] = toUuid(r[c.name], TABLE_KIND[t.name] ?? t.name);
      else if (FK_KIND[c.name]) out[c.name] = toUuid(r[c.name], FK_KIND[c.name]);
    }
    return out;
  }),
}));
