import type { Load, LoadNotification, NotificationRecipient, NotificationType } from '../types';
import { DRIVERS } from './people';

const ms = (iso: string): number => new Date(iso).getTime();

// Small deterministic hash so the same load always yields the same sample notification outcomes.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  bid_accepted: 'Bid accepted',
  driver_assigned: 'Driver assigned',
  driver_replaced: 'Driver replaced',
  arrived_pickup: 'Arrived at pickup',
  left_pickup: 'Left pickup',
  arrived_delivery: 'Arrived at delivery',
  delivered: 'Delivered',
};

// Sample notification log for one load. Geofence notifications follow the recorded geofence events:
// an event without its notification shows up as "missing".
export function notificationsForLoad(load: Load): LoadNotification[] {
  const out: LoadNotification[] = [];
  const driverName = (id: string): string => DRIVERS.find((d) => d.id === id)?.name ?? id;
  const person = (r: NotificationRecipient, driverId?: string): string => (r === 'shipper' ? load.shipper.contact.name : r === 'carrier' ? load.carrier.contact.name : driverName(driverId ?? load.finalDriverId));

  const add = (type: NotificationType, recipient: NotificationRecipient, expectedAt: string, opts: { driverId?: string; missing?: boolean } = {}): void => {
    const id = `${load.id}-N${out.length + 1}`;
    const channel = recipient === 'driver' ? 'push' : hash(id) % 2 === 0 ? 'email' : 'push';
    const base = { id, type, recipient, recipientName: person(recipient, opts.driverId), channel, expectedAt } as const;
    if (opts.missing) {
      out.push({ ...base, sentAt: null, status: 'missing', reason: 'No notification was created for this event' });
      return;
    }
    if (hash(id + load.id) % 29 === 0) {
      out.push({ ...base, sentAt: new Date(ms(expectedAt) + 60000).toISOString(), status: 'failed', reason: channel === 'email' ? 'Mailbox unavailable (provider 550)' : 'Device token expired' });
      return;
    }
    out.push({ ...base, sentAt: new Date(ms(expectedAt) + 45000).toISOString(), status: 'delivered' });
  };

  add('bid_accepted', 'carrier', load.acceptedBy.at);
  add('bid_accepted', 'shipper', load.acceptedBy.at);
  load.assignments.forEach((as, i) => {
    add(i === 0 ? 'driver_assigned' : 'driver_replaced', 'driver', as.from, { driverId: as.driverId });
    if (i > 0) {
      add('driver_replaced', 'carrier', as.from);
      add('driver_replaced', 'shipper', as.from);
    }
  });
  load.geofenceEvents.forEach((g) => {
    const stop = load.stops.find((s) => s.id === g.stopId);
    if (!stop) return;
    const type: NotificationType = stop.kind === 'pickup' ? (g.transition === 'enter' ? 'arrived_pickup' : 'left_pickup') : 'arrived_delivery';
    add(type, 'shipper', g.occurredAt, { missing: !g.notified });
    add(type, 'carrier', g.occurredAt, { missing: !g.notified });
  });
  if (load.deliveryMarkedAt) {
    add('delivered', 'shipper', load.deliveryMarkedAt);
    add('delivered', 'carrier', load.deliveryMarkedAt);
  }
  return out.sort((a, b) => ms(a.expectedAt) - ms(b.expectedAt));
}
