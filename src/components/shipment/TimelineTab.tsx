import { AlertTriangle, Bell, Camera, CheckCircle2, Circle, MapPin, PauseCircle, RadioTower, UserCog } from 'lucide-react';
import { fmtDateTime } from '../../lib/format';
import { buildTimeline } from '../../lib/timeline';
import type { TimelineKind } from '../../lib/timeline';
import { analyzeLoad } from '../../sampleData/analyze';
import type { Load } from '../../types';
import { Card, CardHeader, cx } from '../ui';

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

export function TimelineTab({ load, onFocus }: { load: Load; onFocus: (pingIds: string[], photoId?: string) => void }): JSX.Element {
  const events = buildTimeline(load);
  const a = analyzeLoad(load);
  const start = new Date(load.pings[0].recordedAt).getTime();
  const end = new Date(load.pings[load.pings.length - 1].recordedAt).getTime();
  const span = Math.max(end - start, 1);
  const pos = (iso: string): number => Math.max(0, Math.min(100, ((new Date(iso).getTime() - start) / span) * 100));
  const width = (a: string, b: string): number => Math.max(0.4, pos(b) - pos(a));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Trip strip" sub="Time flows left to right across the whole trip. Red = GPS silent, amber = break/stop, blue = shipment parked (driver change), green = time inside a stop radius." />
        <div className="p-4">
          <div className="relative h-10 border border-border-strong bg-muted">
            {load.stops.map((s) =>
              s.arrivedAt ? (
                <div key={s.id} className="absolute top-0 h-full bg-lime-tint" style={{ left: `${pos(s.arrivedAt)}%`, width: `${width(s.arrivedAt, s.departedAt ?? load.pings[load.pings.length - 1].recordedAt)}%` }} title={s.dcName} />
              ) : null
            )}
            {a.gaps.map((g, i) => (
              <div key={i} className="absolute top-0 h-full bg-destructive" style={{ left: `${pos(g.before.recordedAt)}%`, width: `${width(g.before.recordedAt, g.after.recordedAt)}%` }} title={`GPS silent ${g.minutes} min`} />
            ))}
            {load.breaks.map((b) => (
              <div key={b.id} className="absolute top-2 h-6 bg-warning" style={{ left: `${pos(b.startedAt)}%`, width: `${width(b.startedAt, b.endedAt)}%` }} title="Break" />
            ))}
            {load.parks.map((pk) => (
              <div key={pk.id} className="absolute top-0 h-full bg-navy/60" style={{ left: `${pos(pk.parkedAt)}%`, width: `${width(pk.parkedAt, pk.resumedAt ?? pk.parkedAt)}%` }} title="Shipment parked" />
            ))}
            {load.problems.map((p) => (
              <div key={p.id} className="absolute top-0 h-full w-1 bg-navy-dark" style={{ left: `${pos(p.reportedAt)}%` }} title={`Problem: ${p.type}`} />
            ))}
            {load.photos.map((p) => (
              <div key={p.id} className={cx('absolute bottom-0 h-3 w-1.5', p.onTime ? 'bg-navy' : 'bg-warning')} style={{ left: `${pos(p.uploadedAt)}%` }} title="Photo" />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{fmtDateTime(load.pings[0].recordedAt)}</span>
            <span>{fmtDateTime(load.pings[load.pings.length - 1].recordedAt)}</span>
          </div>
        </div>
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
