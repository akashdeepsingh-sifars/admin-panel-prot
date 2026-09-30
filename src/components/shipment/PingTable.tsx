import { useMemo, useState } from 'react';
import { fmtTime } from '../../lib/format';
import { DRIVERS } from '../../sampleData';
import type { Ping, PingContext, PingFlag } from '../../types';
import { Chip, Table, Td, cx } from '../ui';

const CTX_LABEL: Record<PingContext, string> = { on_route: 'On route', pickup_radius: 'Pickup radius', delivery_radius: 'Delivery radius', off_route: 'Off route' };
const FLAG_LABEL: Record<PingFlag, string> = { duplicate: 'Duplicate', frozen: 'Frozen', after_gap: 'After gap', low_accuracy: 'Low accuracy', same_timestamp: 'Same timestamp' };

interface Props {
  pings: Ping[];
  selectedId: string | null;
  highlightIds: string[];
  onSelect: (id: string) => void;
  showDriver?: boolean;
}

export function PingTable({ pings, selectedId, highlightIds, onSelect, showDriver }: Props): JSX.Element {
  const [ctx, setCtx] = useState<PingContext | ''>('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [q, setQ] = useState('');
  const hi = new Set(highlightIds);
  const rows = useMemo(
    () =>
      pings.filter((p) => (!ctx || p.context === ctx) && (!flaggedOnly || p.flags.length > 0) && (!q || p.recordedAt.includes(q) || p.id.includes(q) || `${p.location.lat.toFixed(5)},${p.location.lng.toFixed(5)}`.includes(q))),
    [pings, ctx, flaggedOnly, q]
  );
  const sel = 'border-[1.5px] border-border-strong bg-card px-2 py-1 text-sm';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <select className={sel} value={ctx} onChange={(e) => setCtx(e.target.value as PingContext | '')}>
          <option value="">All locations</option>
          {(Object.keys(CTX_LABEL) as PingContext[]).map((c) => (
            <option key={c} value={c}>
              {CTX_LABEL[c]}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} className="accent-navy" /> Flagged only
        </label>
        <input className={`${sel} w-44 placeholder:text-muted-foreground`} placeholder="Time, ping id or coordinates…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} of {pings.length} pings · Phone state is captured on the phone at each GPS sample
        </span>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <Table head={['Recorded', ...(showDriver ? ['Driver'] : []), 'Received', 'Location context', 'Latitude', 'Longitude', 'GPS accuracy', 'Battery', 'Network', 'Location perm.', 'App', 'Flags']}>
          {rows.map((p) => (
            <tr key={p.id} onClick={() => onSelect(p.id)} className={cx('cursor-pointer hover:bg-navy-tint/60', p.id === selectedId && 'bg-navy-tint', hi.has(p.id) && 'bg-warning-tint')}>
              <Td className="whitespace-nowrap font-medium">{fmtTime(p.recordedAt)}</Td>
              {showDriver && <Td className="whitespace-nowrap">{DRIVERS.find((d) => d.id === p.driverId)?.name}</Td>}
              <Td className="whitespace-nowrap text-muted-foreground">
                {fmtTime(p.receivedAt)}
                {p.offlineQueued && <Chip tone="neutral">queued</Chip>}
              </Td>
              <Td className="whitespace-nowrap">
                <Chip tone={p.context === 'off_route' ? 'critical' : p.context === 'on_route' ? 'medium' : 'ok'}>{CTX_LABEL[p.context]}</Chip>
                {p.context === 'off_route' && <span className="ml-1 text-xs text-muted-foreground">{(p.offRouteM / 1000).toFixed(1)} km</span>}
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
              <Td>
                <div className="flex flex-wrap gap-1">
                  {p.flags.map((f) => (
                    <Chip key={f} tone="high">
                      {FLAG_LABEL[f]}
                    </Chip>
                  ))}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
