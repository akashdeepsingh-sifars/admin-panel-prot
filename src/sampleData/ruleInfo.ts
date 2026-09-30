export interface RuleInfo {
  code: string;
  title: string;
  meaning: string;
  threshold: string | null;
  scope: 'shipment' | 'driver' | 'fleet' | 'api' | 'messaging';
}

export const RULES: RuleInfo[] = [
  { code: 'DUP_EXACT', title: 'Duplicate GPS reading', meaning: 'Same GPS reading stored more than once.', threshold: '2+ identical readings (high at 5+)', scope: 'shipment' },
  { code: 'DUP_STORED_SAME_TIMESTAMP', title: 'Same time, different position', meaning: 'Same recorded time stored twice with differing positions (resend drift).', threshold: 'received > 1 s apart', scope: 'shipment' },
  { code: 'FROZEN_FIX', title: 'Frozen position', meaning: 'Position did not change while the load was in transit.', threshold: '3+ readings within 15 m over 3 min', scope: 'shipment' },
  { code: 'SILENCE_GAP', title: 'GPS silence', meaning: 'No GPS received for longer than the threshold while in transit.', threshold: '15 min', scope: 'shipment' },
  { code: 'NOTIFY_GAP', title: 'Notification gap', meaning: 'Geofence event without a notification, or a notification without an event.', threshold: '15 min grace', scope: 'shipment' },
  { code: 'FENCE_MISSED', title: 'Geofence missed', meaning: 'Driver crossed a stop geofence but no event was recorded.', threshold: 'critical unless both pings > 100 m accuracy', scope: 'shipment' },
  { code: 'HANDOVER_ANOMALY', title: 'Irregular driver change', meaning: 'A driver was replaced while the load was moving (park, release, assign, resume) and the change looks wrong: parked too long with cargo aboard, the new driver started far from where the shipment was parked, no GPS after resuming, or the driver changed without a park.', threshold: 'parked over 120 min, first ping over 1 km from the parked spot, over 15 min silent after resume', scope: 'shipment' },
  { code: 'SAMPLING_DRIFT', title: 'Sampling drift', meaning: "Driver's GPS sampling interval is drifting from the expected interval.", threshold: null, scope: 'fleet' },
  { code: 'DELIVERED_OUTSIDE_GEOFENCE', title: 'Delivered outside geofence', meaning: "Delivery was marked while the driver was outside the delivery stop's radius.", threshold: 'stop radius', scope: 'driver' },
  { code: 'DELIVERY_NOT_COMPLETED', title: 'Delivery not completed', meaning: 'Load closed or reassigned without a confirmed delivery.', threshold: null, scope: 'driver' },
  { code: 'GPS_OFF_PATTERN', title: 'Repeated GPS-off', meaning: "Repeated GPS-off periods across the driver's shipments.", threshold: '2+ shipments with a gap', scope: 'driver' },
  { code: 'PHOTO_WRONG_LOCATION', title: 'Photo from wrong place', meaning: 'Pickup/delivery photos taken away from the stop.', threshold: '2+ photos', scope: 'driver' },
  { code: 'PHOTO_REUSED', title: 'Photo reused', meaning: 'Same or near-identical photo used for multiple shipments.', threshold: 'same image hash', scope: 'driver' },
  { code: 'REPEATED_LATE', title: 'Repeated late arrivals', meaning: 'Late arrivals across several shipments.', threshold: '3+ shipments, 15+ min late', scope: 'driver' },
  { code: 'API_SERVER_ERRORS', title: 'Elevated 5xx rate', meaning: 'Share of requests failing with a server error is above normal.', threshold: '> 2% of requests', scope: 'api' },
  { code: 'API_UNHANDLED_ERRORS', title: 'Unhandled errors', meaning: 'Requests crashed with an error that no handler caught.', threshold: 'any', scope: 'api' },
  { code: 'API_RATE_LIMITED', title: 'Rate limiting hit', meaning: 'Clients exceeded the request limit and were throttled.', threshold: 'any', scope: 'api' },
  { code: 'MSG_HIGH_FAILURE', title: 'High delivery failure', meaning: 'A large share of notifications or emails failed to deliver.', threshold: '> 10% of sent', scope: 'messaging' },
];

export function ruleInfo(code: string): RuleInfo | undefined {
  return RULES.find((r) => r.code === code);
}
