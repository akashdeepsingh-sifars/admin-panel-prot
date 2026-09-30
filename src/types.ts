export type Severity = 'critical' | 'high' | 'medium';
export type RunTrigger = 'manual' | 'scheduled';
export type RunScope = 'shipments' | 'driver' | 'api' | 'gps' | 'notifications';
export type RunStatus = 'scheduled' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type FindingSection = 'shipment' | 'driver' | 'api' | 'gps' | 'messaging';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Person {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface Org {
  id: string;
  name: string;
  contact: Person;
}

export interface Driver extends Person {
  orgId: string;
  device: string;
  shipmentsCompleted: number;
}

export interface Bid {
  id: string;
  carrierName: string;
  amountUsd: number;
  placedAt: string;
  outcome: 'accepted' | 'rejected' | 'expired';
}

export type AssignmentKind = 'initial' | 'replacement_before_pickup' | 'replacement_mid_transit';

export interface DriverAssignment {
  driverId: string;
  from: string;
  to: string | null;
  reason: string;
  kind: AssignmentKind;
  endedBy: 'released' | 'declined' | null;
}

// Mid-transit driver changes go through a park: driver parks (in_transit to parked), carrier
// releases and assigns, new driver accepts and resumes (parked to in_transit).
export interface Park {
  id: string;
  parkedAt: string;
  resumedAt: string | null;
  location: LatLng;
  note: string;
  cargoOnBoard: boolean;
}

export type StopKind = 'pickup' | 'delivery';

export interface Stop {
  id: string;
  kind: StopKind;
  dcName: string;
  address: string;
  location: LatLng;
  radiusM: number;
  scheduledStart: string;
  scheduledEnd: string;
  arrivedAt: string | null;
  departedAt: string | null;
}

export type PingContext = 'on_route' | 'pickup_radius' | 'delivery_radius' | 'off_route';
export type PingFlag = 'duplicate' | 'frozen' | 'after_gap' | 'low_accuracy' | 'same_timestamp';
export type NetworkType = 'wifi' | 'cellular' | 'none';

// Only fields the mobile app can read per GPS sample on both Android and iOS.
export interface PhoneState {
  batteryPct: number;
  charging: boolean;
  powerSave: boolean;
  network: NetworkType;
  locationPermission: 'always' | 'while_using' | 'denied';
  locationPrecision: 'precise' | 'approximate';
  appState: 'foreground' | 'background';
}

export interface Ping {
  id: string;
  driverId: string;
  recordedAt: string;
  receivedAt: string;
  location: LatLng;
  accuracyM: number;
  offlineQueued: boolean;
  context: PingContext;
  offRouteM: number;
  nearestStopId: string | null;
  phone: PhoneState;
  flags: PingFlag[];
}

export type PhotoKind = 'pickup_bol' | 'delivery_pod' | 'damage' | 'other';
export type PhotoContext = 'at_pickup' | 'at_delivery' | 'on_route' | 'elsewhere';

export interface Photo {
  id: string;
  driverId: string;
  kind: PhotoKind;
  uploadedAt: string;
  location: LatLng;
  context: PhotoContext;
  nearestStopId: string;
  distanceToStopM: number;
  minutesFromArrival: number | null;
  onTime: boolean;
  imageHash: string;
  tone: number;
}

export type ProblemType = 'accident' | 'breakdown' | 'delay' | 'cargo_damage' | 'other';

export interface Problem {
  id: string;
  type: ProblemType;
  reportedAt: string;
  location: LatLng;
  reporter: string;
  status: 'open' | 'resolved';
  note: string;
}

export interface Break {
  id: string;
  startedAt: string;
  endedAt: string;
  location: LatLng;
}

export interface GeofenceEvent {
  id: string;
  stopId: string;
  transition: 'enter' | 'exit';
  occurredAt: string;
  notified: boolean;
}

export type LoadStatus = 'in_transit' | 'delivered' | 'cancelled';

export interface Load {
  id: string;
  number: string;
  status: LoadStatus;
  commodity: string;
  equipment: string;
  createdBy: { name: string; at: string };
  bids: Bid[];
  acceptedBy: { name: string; at: string };
  shipper: Org;
  carrier: Org;
  assignments: DriverAssignment[];
  parks: Park[];
  finalDriverId: string;
  stops: Stop[];
  plannedRoute: LatLng[];
  pings: Ping[];
  photos: Photo[];
  problems: Problem[];
  breaks: Break[];
  geofenceEvents: GeofenceEvent[];
  deliveryMarkedAt: string | null;
  deliveryMarkedLocation: LatLng | null;
  deliveryMarkedDistanceM: number | null;
  lateMinutes: number;
}

export type EvidenceValue = string | number | boolean | string[];

export interface FindingComment {
  id: string;
  author: string;
  body: string;
  at: string;
}

export interface Finding {
  id: string;
  runId: string;
  section: FindingSection;
  ruleCode: string;
  severity: Severity;
  detectedAt: string;
  summary: string;
  loadId?: string;
  driverId?: string;
  evidence: Record<string, EvidenceValue>;
  pingIds: string[];
  photoIds: string[];
}

export interface FindingReview {
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  comments: FindingComment[];
}

export interface TargetLabel {
  scope: RunScope;
  label: string;
}

export interface DiagnosisRun {
  id: string;
  trigger: RunTrigger;
  scopes: RunScope[];
  targets: TargetLabel[];
  windowStart: string;
  windowEnd: string;
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  durationSec: number | null;
  createdBy: string;
  scheduleId: string | null;
  loadIds: string[];
  driverIds: string[];
  findingIds: string[];
  error?: string;
}

export type Frequency =
  | { kind: 'once'; runAt: string }
  | { kind: 'hourly' }
  | { kind: 'daily'; timeOfDay: string }
  | { kind: 'weekly'; timeOfDay: string; daysOfWeek: number[] };

export interface Schedule {
  id: string;
  name: string;
  scopes: RunScope[];
  targets: TargetLabel[];
  windowLabel: string;
  frequency: Frequency;
  timezone: string;
  nextRunAt: string | null;
  lastRunId: string | null;
  lastRunAt: string | null;
  enabled: boolean;
}

export interface ApiRouteStat {
  route: string;
  method: string;
  requests: number;
  failures: number;
}

export interface UnhandledError {
  id: string;
  route: string;
  method: string;
  message: string;
  stackSummary: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface RateLimitEvent {
  id: string;
  at: string;
  ip: string;
  device: string;
  userAgent: string;
  user: string;
  route: string;
  method: string;
  payload: Record<string, string>;
  limit: string;
}

export interface ApiReport {
  totals: { requests: number; success: number; clientErrors: number; serverErrors: number };
  byStatus: { status: number; count: number }[];
  byRoute: ApiRouteStat[];
  byErrorType: { type: string; count: number }[];
  unhandledErrors: UnhandledError[];
  rateLimited: RateLimitEvent[];
  series: { label: string; requests: number; failures: number }[];
  topIps: { ip: string; count: number }[];
}

export type Channel = 'push' | 'email' | 'in_app';

export interface FailedMessage {
  id: string;
  at: string;
  channel: Channel;
  recipient: string;
  kind: string;
  loadId: string | null;
  reason: string;
  providerResponse: string;
}

export interface MessagingReport {
  totals: { sent: number; delivered: number; failed: number };
  byChannel: { channel: Channel; sent: number; delivered: number; failed: number }[];
  failureReasons: { channel: Channel; reason: string; count: number }[];
  failedItems: FailedMessage[];
}

export interface GpsDriftRow {
  driverId: string;
  device: string;
  expectedIntervalS: number;
  actualIntervalS: number;
  affectedFrom: string;
  affectedTo: string;
  loadIds: string[];
}

export interface GpsReport {
  drift: GpsDriftRow[];
}

export interface RunReports {
  api?: ApiReport;
  messaging?: MessagingReport;
  gps?: GpsReport;
}

export type CellValue = string | number | boolean | null;
export type ColumnType = 'text' | 'int' | 'numeric' | 'bool' | 'timestamptz' | 'jsonb';

export interface DbColumn {
  name: string;
  type: ColumnType;
  sensitive?: boolean;
  locked?: boolean;
}

export type DbRow = Record<string, CellValue>;

export interface DbTable {
  name: string;
  description: string;
  columns: DbColumn[];
  rows: DbRow[];
}

export interface AuditEntry {
  id: string;
  at: string;
  user: string;
  table: string;
  rowId: string;
  action: 'update' | 'delete' | 'write_mode_on' | 'write_mode_off';
  detail: string;
}
