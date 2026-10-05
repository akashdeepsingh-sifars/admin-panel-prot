export interface RuleInfo {
  code: string;
  title: string;
  // Plain-language explanation shown next to every finding and in the rule reference.
  description: string;
  threshold: string | null;
  scope: 'shipment' | 'api' | 'messaging';
}

export const RULES: RuleInfo[] = [
  {
    code: 'STATIC_LOCATION',
    title: 'Static location',
    description: 'The user stayed at one particular location while the load was in transit: several GPS readings came from practically the same spot for a few minutes. Not counted at the pickup or drop-off geofence.',
    threshold: '3+ readings within 15 m over more than 3 min',
    scope: 'shipment',
  },
  {
    code: 'DUP_EXACT',
    title: 'Duplicate GPS',
    description: 'The very same GPS reading (same recorded time, same position) was stored more than once, whether the copies arrived seconds or minutes apart (for example a retry or a late re-send). The extra copies add nothing and can distort distance and timing.',
    threshold: '2+ identical readings (high at 5+)',
    scope: 'shipment',
  },
  {
    code: 'SAME_TIME_DIFFERENT_POSITION',
    title: 'Same time, different position',
    description: 'Two readings carry the same recorded time but show different positions, usually because the phone re-sent a queued reading with drifted coordinates. One of the two cannot be right.',
    threshold: 'copies received more than 1 s apart',
    scope: 'shipment',
  },
  {
    code: 'SILENCE_GAP',
    title: 'GPS silence',
    description: 'No GPS was received for longer than the threshold while the load was moving. The report lists every silent period, where it started and ended, and the likely cause read from the last phone state (battery, network, location permission). Time while the shipment was parked for a driver change is not counted.',
    threshold: '15 min without a ping',
    scope: 'shipment',
  },
  {
    code: 'FENCE_MISSED',
    title: 'Geofence missed',
    description: 'GPS shows the user crossed a stop geofence (entered or left the pickup or drop-off area) but no geofence event was recorded. The finding names the exact geofence that was missed and which crossing it was.',
    threshold: 'critical, unless both surrounding pings had more than 100 m accuracy',
    scope: 'shipment',
  },
  {
    code: 'PICKUP_DELIVERY_NOT_VERIFIED',
    title: 'Pickup or delivery not verified',
    description: 'The user never verified the pickup or the delivery. A stop counts as verified when an arrival was confirmed there or a pickup/delivery photo was taken at the stop. A delivery also needs to be marked delivered.',
    threshold: 'no arrival and no photo at the stop (delivery: or not marked delivered)',
    scope: 'shipment',
  },
  {
    code: 'NOTIFICATION_ANOMALY',
    title: 'Notification anomaly',
    description: 'A notification related to this load did not go out as expected: it was never sent, or it was sent but failed to deliver. Each notification is listed with its type, who it was meant for (driver, shipper or carrier) and its status.',
    threshold: '15 min grace after the event',
    scope: 'shipment',
  },
  {
    code: 'HANDOVER_ANOMALY',
    title: 'Irregular driver change',
    description: 'The driver was changed while the load was moving (park, release, assign, resume) and the change looks wrong: parked too long with cargo aboard, the new driver started far from where the shipment was parked, no GPS after resuming, or the driver changed without a park. Also flagged when the shipment changes hands three or more times. Every ping shows which driver sent it.',
    threshold: 'parked over 120 min, first ping over 1 km from the parked spot, over 15 min silent after resume, or 3+ drivers on one shipment',
    scope: 'shipment',
  },
  { code: 'API_SERVER_ERRORS', title: 'Elevated 5xx rate', description: 'Share of requests failing with a server error is above normal.', threshold: '> 2% of requests', scope: 'api' },
  { code: 'API_UNHANDLED_ERRORS', title: 'Unhandled errors', description: 'Requests crashed with an error that no handler caught.', threshold: 'any', scope: 'api' },
  { code: 'API_RATE_LIMITED', title: 'Rate limiting hit', description: 'Clients exceeded the request limit and were throttled.', threshold: 'any', scope: 'api' },
  { code: 'MSG_HIGH_FAILURE', title: 'High delivery failure', description: 'A large share of notifications or emails failed to deliver.', threshold: '> 10% of sent', scope: 'messaging' },
];

export function ruleInfo(code: string): RuleInfo | undefined {
  return RULES.find((r) => r.code === code);
}
