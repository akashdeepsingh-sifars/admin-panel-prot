import { mulberry32 } from '../lib/geo';
import type { ApiReport, Channel, MessagingReport, RateLimitEvent } from '../types';

export function makeApiReport(seed: number, requests: number, hours: number, endISO: string): ApiReport {
  const rnd = mulberry32(seed);
  const serverErrors = Math.round(requests * (0.024 + rnd() * 0.01));
  const clientErrors = Math.round(requests * (0.05 + rnd() * 0.02));
  const success = requests - serverErrors - clientErrors;
  const end = new Date(endISO).getTime();
  const buckets = 12;
  const series = Array.from({ length: buckets }, (_, i) => {
    const r = Math.round((requests / buckets) * (0.7 + rnd() * 0.6));
    const spike = i === 8 ? 3.2 : 1;
    return {
      label: new Date(end - ((buckets - 1 - i) * hours * 3600000) / buckets).toISOString().slice(11, 16),
      requests: r,
      failures: Math.round(r * 0.07 * spike),
    };
  });
  const user = ['drv-2', 'drv-4', 'anon', 'drv-1'];
  const ips = ['203.0.113.24', '198.51.100.77', '192.0.2.146', '203.0.113.90'];
  const devices = ['Galaxy A14 · Android 13', 'iPhone 12 · iOS 17', 'Pixel 8 · Android 15', 'Unknown (curl)'];
  const rateLimited: RateLimitEvent[] = Array.from({ length: 7 }, (_, i) => {
    const login = i % 3 === 0;
    return {
      id: `rl-${seed}-${i}`,
      at: new Date(end - (i + 1) * (hours * 3600000) / 9).toISOString(),
      ip: ips[i % ips.length],
      device: devices[i % devices.length],
      userAgent: login ? 'curl/8.4.0' : `FreightFlowDriver/2.4.1 (${devices[i % devices.length]})`,
      user: login ? 'anonymous' : user[i % user.length],
      route: login ? '/api/v1/auth/login' : '/api/v1/driver-locations',
      method: 'POST',
      payload: (login
        ? { email: '[PII redacted]', deviceId: `dev-${1000 + i}` }
        : { loadId: 'FF-10245', lat: '32.7412', lng: '-96.8031', accuracyM: '9', recordedAt: '2026-09-28T09:41:02Z', driverName: '[PII redacted]' }) as Record<string, string>,
      limit: login ? '10 requests / min / IP' : '120 requests / min / user',
    };
  });
  return {
    totals: { requests, success, clientErrors, serverErrors },
    byStatus: [
      { status: 200, count: Math.round(success * 0.93) },
      { status: 201, count: Math.round(success * 0.07) },
      { status: 400, count: Math.round(clientErrors * 0.35) },
      { status: 401, count: Math.round(clientErrors * 0.3) },
      { status: 404, count: Math.round(clientErrors * 0.2) },
      { status: 429, count: Math.round(clientErrors * 0.15) },
      { status: 500, count: Math.round(serverErrors * 0.7) },
      { status: 502, count: Math.round(serverErrors * 0.2) },
      { status: 504, count: Math.round(serverErrors * 0.1) },
    ],
    byRoute: [
      { route: '/api/v1/driver-locations', method: 'POST', requests: Math.round(requests * 0.52), failures: Math.round(requests * 0.052) },
      { route: '/api/v1/loads/:id/status', method: 'PATCH', requests: Math.round(requests * 0.12), failures: Math.round(requests * 0.014) },
      { route: '/api/v1/auth/login', method: 'POST', requests: Math.round(requests * 0.08), failures: Math.round(requests * 0.021) },
      { route: '/api/v1/loads/:id/bids', method: 'POST', requests: Math.round(requests * 0.06), failures: Math.round(requests * 0.019) },
      { route: '/api/v1/files/upload', method: 'POST', requests: Math.round(requests * 0.05), failures: Math.round(requests * 0.011) },
      { route: '/api/v1/loads', method: 'GET', requests: Math.round(requests * 0.17), failures: Math.round(requests * 0.004) },
    ],
    byErrorType: [
      { type: 'Validation', count: Math.round(clientErrors * 0.35) },
      { type: 'Auth', count: Math.round(clientErrors * 0.3) },
      { type: 'Not found', count: Math.round(clientErrors * 0.2) },
      { type: 'Rate limited', count: Math.round(clientErrors * 0.15) },
      { type: 'Unhandled error', count: Math.round(serverErrors * 0.55) },
      { type: 'Timeout', count: Math.round(serverErrors * 0.3) },
      { type: 'Upstream (provider)', count: Math.round(serverErrors * 0.15) },
    ],
    unhandledErrors: [
      {
        id: `ue-${seed}-1`,
        route: '/api/v1/loads/:id/bids',
        method: 'POST',
        message: "TypeError: Cannot read properties of undefined (reading 'amount')",
        stackSummary: 'bids/services/createBid.ts:48 → bids/controllers/post.ts:22',
        count: 41,
        firstSeen: new Date(end - hours * 3600000 * 0.8).toISOString(),
        lastSeen: new Date(end - 600000).toISOString(),
      },
      {
        id: `ue-${seed}-2`,
        route: '/api/v1/files/upload',
        method: 'POST',
        message: 'Error: S3 PutObject timed out after 30000ms',
        stackSummary: 'files/services/upload.ts:91 → utilities/s3/put.ts:33',
        count: 17,
        firstSeen: new Date(end - hours * 3600000 * 0.5).toISOString(),
        lastSeen: new Date(end - 1800000).toISOString(),
      },
    ],
    rateLimited,
    series,
    topIps: ips.map((ip, i) => ({ ip, count: Math.round(60 / (i + 1)) })),
  };
}

const CHANNEL_LABEL: Record<Channel, string> = { push: 'Push', email: 'Email', in_app: 'In-app' };
export const channelLabel = (c: Channel): string => CHANNEL_LABEL[c];

export function makeMessagingReport(seed: number, end: string): MessagingReport {
  const rnd = mulberry32(seed);
  const push = { channel: 'push' as const, sent: 1840, failed: 96 };
  const email = { channel: 'email' as const, sent: 620, failed: 118 };
  const inApp = { channel: 'in_app' as const, sent: 2210, failed: 4 };
  const byChannel = [push, email, inApp].map((c) => ({ ...c, delivered: c.sent - c.failed }));
  const sent = byChannel.reduce((s, c) => s + c.sent, 0);
  const failed = byChannel.reduce((s, c) => s + c.failed, 0);
  const failureReasons = [
    { channel: 'push' as const, reason: 'Invalid or expired device token', count: 71 },
    { channel: 'push' as const, reason: 'Provider error (FCM 503)', count: 25 },
    { channel: 'email' as const, reason: 'Hard bounce: mailbox does not exist', count: 64 },
    { channel: 'email' as const, reason: 'Soft bounce: mailbox full', count: 22 },
    { channel: 'email' as const, reason: 'Rejected as spam by recipient server', count: 19 },
    { channel: 'email' as const, reason: 'Template render error', count: 13 },
    { channel: 'in_app' as const, reason: 'Recipient session not found', count: 4 },
  ];
  const kinds = ['driver.geofence.entered', 'driver.geofence.exited', 'load.assigned', 'bid.received', 'invite.driver'];
  const failedItems = failureReasons.flatMap((r, ri) =>
    Array.from({ length: 2 }, (_, i) => ({
      id: `fm-${seed}-${ri}-${i}`,
      at: new Date(new Date(end).getTime() - (ri * 2 + i + 1) * 23 * 60000).toISOString(),
      channel: r.channel,
      recipient: r.channel === 'email' ? `${'jkmnpqrs'[Math.floor(rnd() * 8)]}***@example.com` : `device …${1000 + Math.floor(rnd() * 8999)}`,
      kind: kinds[(ri + i) % kinds.length],
      loadId: kinds[(ri + i) % kinds.length].startsWith('driver.geofence') ? 'L3' : null,
      reason: r.reason,
      providerResponse: r.channel === 'email' ? '550 5.1.1 User unknown' : r.channel === 'push' ? 'UNREGISTERED' : 'n/a',
    }))
  );
  return { totals: { sent, delivered: sent - failed, failed }, byChannel, failureReasons, failedItems };
}
