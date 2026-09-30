import { Camera, ExternalLink } from 'lucide-react';
import { fmtDateTime } from '../../lib/format';
import { DRIVERS } from '../../sampleData';
import type { Load, PhotoContext } from '../../types';
import { Button, Card, CardHeader, Chip, Empty, KV, cx } from '../ui';

const TONES = ['bg-navy-tint', 'bg-lime-tint', 'bg-warning-tint', 'bg-muted', 'bg-destructive-tint'];
const CTX: Record<PhotoContext, string> = { at_pickup: 'At pickup', at_delivery: 'At delivery', on_route: 'On route', elsewhere: 'Elsewhere' };

export function PhotosTab({ load, onFocus }: { load: Load; onFocus: (photoId: string) => void }): JSX.Element {
  if (load.photos.length === 0) return <Card><Empty title="No photos uploaded" body="The driver uploaded no pickup or delivery photos for this load." /></Card>;
  return (
    <Card>
      <CardHeader title="Photos & documents" sub="Where and when each upload was taken, compared with the stops." />
      <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {load.photos.map((p) => {
          const stop = load.stops.find((s) => s.id === p.nearestStopId);
          return (
            <div key={p.id} className="border border-border bg-card shadow-card">
              <div className={cx('flex h-32 items-center justify-center', TONES[p.tone])}>
                <Camera size={28} className="text-muted-foreground" />
              </div>
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold capitalize">{p.kind.replace('_', ' ')}</span>
                  <Chip tone={p.context === 'elsewhere' ? 'critical' : p.context === 'on_route' ? 'high' : 'ok'}>{CTX[p.context]}</Chip>
                  <Chip tone={p.onTime ? 'ok' : 'high'}>{p.onTime ? 'On time' : 'Off time / place'}</Chip>
                </div>
                <div>
                  <KV k="Uploaded">{fmtDateTime(p.uploadedAt)}</KV>
                  <KV k="Uploaded by">{DRIVERS.find((d) => d.id === p.driverId)?.name}</KV>
                  <KV k="Nearest stop">{stop?.dcName}</KV>
                  <KV k="Distance to stop">{p.distanceToStopM >= 1000 ? `${(p.distanceToStopM / 1000).toFixed(1)} km` : `${p.distanceToStopM} m`}</KV>
                  <KV k="Vs. arrival">{p.minutesFromArrival !== null ? `${p.minutesFromArrival > 0 ? '+' : ''}${p.minutesFromArrival} min` : '—'}</KV>
                  <KV k="Image hash">
                    <code className="text-xs">{p.imageHash}</code>
                  </KV>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => onFocus(p.id)}>
                    Show on map
                  </Button>
                  <Button variant="ghost" title="Real app: FileLink fetches a fresh signed URL per click">
                    <ExternalLink size={14} /> Open file
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
