import { useState } from 'react';
import { fmtDateTime } from '../../lib/format';
import { NOTIFICATION_LABEL } from '../../sampleData';
import { analyzeLoad } from '../../sampleData/analyze';
import type { Load, NotificationRecipient, NotificationStatus } from '../../types';
import { Card, CardHeader, Chip, Empty, Stat, Table, Td } from '../ui';

const STATUS_TONE: Record<NotificationStatus, 'ok' | 'high' | 'critical'> = { delivered: 'ok', failed: 'high', missing: 'critical' };
const STATUS_LABEL: Record<NotificationStatus, string> = { delivered: 'Delivered', failed: 'Failed', missing: 'Never sent' };
const ROLE_LABEL: Record<NotificationRecipient, string> = { driver: 'Driver', shipper: 'Shipper', carrier: 'Carrier' };
const sel = 'border-[1.5px] border-border-strong bg-card px-2 py-1 text-sm';

export function NotificationsTab({ load }: { load: Load }): JSX.Element {
  const { notifications } = analyzeLoad(load);
  const [role, setRole] = useState<NotificationRecipient | ''>('');
  const [status, setStatus] = useState<NotificationStatus | ''>('');
  const rows = notifications.filter((n) => (!role || n.recipient === role) && (!status || n.status === status));
  const count = (s: NotificationStatus): number => notifications.filter((n) => n.status === s).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Notifications for this load" value={notifications.length} />
        <Stat label="Delivered" value={count('delivered')} tone="ok" />
        <Stat label="Failed" value={count('failed')} tone={count('failed') ? 'warn' : undefined} />
        <Stat label="Never sent" value={count('missing')} tone={count('missing') ? 'danger' : undefined} />
      </div>
      <Card>
        <CardHeader title="Notifications" sub="Every notification this load should have produced, who it was meant for, and what happened to it." />
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <select className={sel} value={role} onChange={(e) => setRole(e.target.value as NotificationRecipient | '')}>
            <option value="">All recipients</option>
            {(Object.keys(ROLE_LABEL) as NotificationRecipient[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value as NotificationStatus | '')}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as NotificationStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {rows.length} of {notifications.length}
          </span>
        </div>
        {rows.length === 0 ? (
          <Empty title="No notifications match" body="Change the recipient or status filter." />
        ) : (
          <Table head={['Type', 'Meant for', 'Recipient', 'Channel', 'Event time', 'Sent', 'Status', 'Detail']}>
            {rows.map((n) => (
              <tr key={n.id}>
                <Td className="whitespace-nowrap font-medium">{NOTIFICATION_LABEL[n.type]}</Td>
                <Td>
                  <Chip tone="neutral">{ROLE_LABEL[n.recipient]}</Chip>
                </Td>
                <Td className="whitespace-nowrap">{n.recipientName}</Td>
                <Td className="capitalize">{n.channel.replace('_', ' ')}</Td>
                <Td className="whitespace-nowrap">{fmtDateTime(n.expectedAt)}</Td>
                <Td className="whitespace-nowrap">{fmtDateTime(n.sentAt)}</Td>
                <Td>
                  <Chip tone={STATUS_TONE[n.status]}>{STATUS_LABEL[n.status]}</Chip>
                </Td>
                <Td className="text-xs text-muted-foreground">{n.reason ?? '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
