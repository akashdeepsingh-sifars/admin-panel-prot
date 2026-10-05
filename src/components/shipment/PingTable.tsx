import { useMemo, useState } from 'react';
import { fmtTime } from '../../lib/format';
import { fmtInterval, intervalStats, pingIntervals } from '../../lib/pings';
import { DRIVERS } from '../../sampleData';
import type { Ping, PingContext } from '../../types';
import { ShortId } from '../ShortId';
import { Chip, Stat, Table, Td, cx } from '../ui';

const CTX_LABEL: Record<PingContext, string> = { pickup: 'Pickup geofence', normal: 'Normal', delivery: 'Drop-off geofence' };

interface Props {
  pings: Ping[];
  selectedId: string | null;
  highlightIds: string[];
  onSelect: (id: string) => void;
  showDriver?: boolean;
}

export function PingTable({ pings, selectedId, highlightIds, onSelect, showDriver }: Props): JSX.Element {
  const [ctx, setCtx] = useState<PingContext | ''>('');
  const [q, setQ] = useState('');
  const hi = new Set(highlightIds);
  const intervals = useMemo(() => pingIntervals(pings), [pings]);
  const stats = useMemo(() => intervalStats(pings), [pings]);
  const rows = useMemo(
    () => pings.filter((p) => (!ctx || p.context === ctx) && (!q || p.recordedAt.includes(q) || p.id.includes(q) || `${p.location.lat.toFixed(5)},${p.location.lng.toFixed(5)}`.includes(q))),
    [pings, ctx, q]
  );
  const sel = 'border-[1.5px] border-border-strong bg-card px-2 py-1 text-sm';

  return (
    <div>
      {stats && (
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-4">
          <Stat label="Average ping interval" value={fmtInterval(stats.avgSec)} />
          <Stat label="Shortest interval" value={fmtInterval(stats.minSec)} />
          <Stat label="Longest interval" value={fmtInterval(stats.maxSec)} tone={stats.maxSec >= 15 * 60 ? 'warn' : undefined} />
          <Stat label="Pings" value={pings.length} />
        </div>
      )}
      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">Interval = time between a ping and the one before it. The average is taken over every consecutive pair of pings.</p>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <select className={sel} value={ctx} onChange={(e) => setCtx(e.target.value as PingContext | '')}>
          <option value="">All locations</option>
          {(Object.keys(CTX_LABEL) as PingContext[]).map((c) => (
            <option key={c} value={c}>
              {CTX_LABEL[c]}
            </option>
          ))}
        </select>
        <input className={`${sel} w-72 placeholder:text-muted-foreground`} placeholder="Time, ping id or coordinates…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} of {pings.length} pings · Phone state is captured on the phone at each GPS sample
        </span>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <Table head={['Ping ID', 'Recorded', ...(showDriver ? ['Driver'] : []), 'Received', 'Interval', 'Location context', 'Latitude', 'Longitude', 'GPS accuracy', 'Battery', 'Network', 'Location perm.', 'App']}>
          {rows.map((p) => (
            <tr key={p.id} onClick={() => onSelect(p.id)} className={cx('cursor-pointer hover:bg-navy-tint/60', p.id === selectedId && 'bg-navy-tint', hi.has(p.id) && 'bg-warning-tint')}>
              <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground"><ShortId id={p.id} /></Td>
              <Td className="whitespace-nowrap font-medium">{fmtTime(p.recordedAt)}</Td>
              {showDriver && <Td className="whitespace-nowrap">{DRIVERS.find((d) => d.id === p.driverId)?.name}</Td>}
              <Td className="whitespace-nowrap text-muted-foreground">
                {fmtTime(p.receivedAt)}
                {p.offlineQueued && (
                  <span title="Stored on the phone first and uploaded later, usually because it had no connection. The recorded time and position are still correct.">
                    <Chip tone="neutral">Uploaded late</Chip>
                  </span>
                )}
              </Td>
              <Td className={cx('whitespace-nowrap', (intervals.get(p.id) ?? 0) >= 15 * 60 && 'font-semibold text-warning-ink')}>{intervals.has(p.id) ? fmtInterval(intervals.get(p.id) as number) : '—'}</Td>
              <Td className="whitespace-nowrap">
                <Chip tone={p.context === 'normal' ? 'medium' : 'ok'}>{CTX_LABEL[p.context]}</Chip>
              </Td>
              <Td className="whitespace-nowrap font-mono text-xs">{p.location.lat.toFixed(5)}</Td>
              <Td className="whitespace-nowrap font-mono text-xs">{p.location.lng.toFixed(5)}</Td>
              <Td>{p.accuracyM} m</Td>
              <Td className={p.phone.batteryPct < 15 ? 'font-semibold text-destructive-ink' : ''}>
                {p.phone.batteryPct}%
                {p.phone.charging && <span className="text-xs text-muted-foreground"> · charging</span>}
                {p.phone.powerSave && <span className="text-xs text-muted-foreground"> · saver</span>}
              </Td>
              <Td className={p.phone.network === 'none' ? 'font-semibold text-destructive-ink' : ''}>{p.phone.network === 'wifi' ? 'Wi-Fi' : p.phone.network === 'cellular' ? 'Cellular' : 'None'}</Td>
              <Td className={p.phone.locationPermission !== 'always' || p.phone.locationPrecision === 'approximate' ? 'font-semibold text-warning-ink' : ''}>
                {p.phone.locationPermission.replace('_', ' ')}
                {p.phone.locationPrecision === 'approximate' && <span className="text-xs"> · approx.</span>}
              </Td>
              <Td>{p.phone.appState}</Td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
