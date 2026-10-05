import { AlertTriangle, Bell, Camera, CheckCircle2, Circle, MapPin, PauseCircle, RadioTower, UserCog } from 'lucide-react';
import { fmtDateTime } from '../../lib/format';
import { buildTimeline, pathSegments } from '../../lib/timeline';
import type { TimelineKind } from '../../lib/timeline';
import { DRIVERS } from '../../sampleData';
import type { Load } from '../../types';
import { Card, CardHeader, Chip, Table, Td, cx } from '../ui';

const ICON: Record<TimelineKind, typeof Circle> = {
  lifecycle: Circle,
  geofence: MapPin,
  gap: RadioTower,
  break: PauseCircle,
  problem: AlertTriangle,
  photo: Camera,
  reassign: UserCog,
  notification: Bell,
  delivery: CheckCircle2,
  flag: AlertTriangle,
};
const TONE: Record<string, string> = {
  critical: 'text-destructive border-destructive',
  high: 'text-warning border-warning',
  medium: 'text-navy border-navy',
  ok: 'text-lime-dark border-lime-dark',
  neutral: 'text-muted-foreground border-border-strong',
};

const SEG_LABEL = { pickup: 'At pickup geofence', normal: 'Normal pings', delivery: 'At drop-off geofence' } as const;
const SEG_TONE = { pickup: 'ok', normal: 'medium', delivery: 'high' } as const;

export function TimelineTab({ load, onFocus }: { load: Load; onFocus: (pingIds: string[], photoId?: string) => void }): JSX.Element {
  const events = buildTimeline(load);
  const segments = pathSegments(load);
  const driver = (id: string): string => DRIVERS.find((d) => d.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Path followed" sub="The route the GPS pings actually took, in order. Each stretch is either pings from the pickup geofence, normal pings, or pings from the drop-off geofence." />
        <Table head={['From', 'To', 'Where', 'Pings', 'Driver']}>
          {segments.map((sg, i) => (
            <tr key={i}>
              <Td className="whitespace-nowrap">{fmtDateTime(sg.from)}</Td>
              <Td className="whitespace-nowrap">{fmtDateTime(sg.to)}</Td>
              <Td>
                <Chip tone={SEG_TONE[sg.context]}>{SEG_LABEL[sg.context]}</Chip>
              </Td>
              <Td>{sg.pings}</Td>
              <Td>{sg.driverIds.map(driver).join(', ')}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader title="Events" sub="Lifecycle, GPS, geofence, notifications, photos and problems merged on one axis." />
        <ol className="p-4">
          {events.map((e, i) => {
            const Icon = ICON[e.kind];
            const clickable = (e.pingIds && e.pingIds.length > 0) || e.photoId;
            return (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cx('flex h-7 w-7 items-center justify-center border-2 bg-card', TONE[e.tone])}>
                    <Icon size={14} />
                  </span>
                  {i < events.length - 1 && <span className="w-0.5 flex-1 bg-border-strong" />}
                </div>
                <div className="pb-4">
                  <div className="text-xs text-muted-foreground">{fmtDateTime(e.at)}</div>
                  <div className="text-sm font-medium">{e.label}</div>
                  {e.detail && <div className="text-xs text-muted-foreground">{e.detail}</div>}
                  {clickable && (
                    <button className="mt-0.5 text-xs font-semibold text-navy hover:underline" onClick={() => onFocus(e.pingIds ?? [], e.photoId)}>
                      Show on map
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
