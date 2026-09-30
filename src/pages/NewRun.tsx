import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Button, Card, CardHeader, PageHeader, SCOPE_LABEL } from '../components/ui';
import { CURRENT_USER, useStore } from '../store';
import { DRIVERS, LOADS, NOW, RULES } from '../sampleData';
import type { DiagnosisRun, Frequency, RunScope, Schedule, TargetLabel } from '../types';

type ShipmentMode = 'loads' | 'driver-loads' | 'window';
type When = 'now' | 'schedule';
type FreqKind = Frequency['kind'];

const PRESETS: { id: string; label: string; hours: number }[] = [
  { id: '1h', label: 'Last 1 h', hours: 1 },
  { id: '24h', label: 'Last 24 h', hours: 24 },
  { id: '7d', label: 'Last 7 days', hours: 168 },
  { id: '30d', label: 'Last 30 days', hours: 720 },
  { id: 'custom', label: 'Custom', hours: 0 },
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCOPE_INFO: Record<RunScope, string> = {
  shipments: 'GPS, geofence and notification rules on loads',
  driver: 'Delivery integrity over a driver’s past shipments',
  api: 'Request health, unhandled errors, rate limiting',
  gps: 'Fleet-level GPS health (sampling drift)',
  notifications: 'Push and email delivery failures',
};
const ALL_SCOPES: RunScope[] = ['shipments', 'driver', 'api', 'gps', 'notifications'];
const inputCls = 'border-[1.5px] border-border-strong bg-card px-2 py-1.5 text-sm';

export function NewRun(): JSX.Element {
  const nav = useNavigate();
  const { runs, addRun, addSchedule } = useStore();
  const [scopes, setScopes] = useState<RunScope[]>([]);
  const [mode, setMode] = useState<ShipmentMode>('loads');
  const [loadIds, setLoadIds] = useState<string[]>([]);
  const [shipDriver, setShipDriver] = useState('drv-2');
  const [driverIds, setDriverIds] = useState<string[]>([]);
  const [preset, setPreset] = useState('24h');
  const [from, setFrom] = useState('2026-09-28T00:00');
  const [to, setTo] = useState('2026-09-29T00:00');
  const [when, setWhen] = useState<When>('now');
  const [freq, setFreq] = useState<FreqKind>('daily');
  const [timeOfDay, setTimeOfDay] = useState('02:00');
  const [days, setDays] = useState<number[]>([1]);
  const [onceAt, setOnceAt] = useState('2026-10-01T09:00');
  const [name, setName] = useState('');
  const [showRules, setShowRules] = useState(false);

  const toggle = <T,>(list: T[], v: T, set: (x: T[]) => void): void => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const allScopesSelected = scopes.length === ALL_SCOPES.length;
  const has = (s: RunScope): boolean => scopes.includes(s);
  const allLoadIds = LOADS.map((l) => l.id);
  const allDriverIds = DRIVERS.map((d) => d.id);
  const driverName = (id: string): string => DRIVERS.find((d) => d.id === id)?.name ?? id;

  const windowLabel = preset === 'custom' ? `${from.replace('T', ' ')} → ${to.replace('T', ' ')}` : PRESETS.find((p) => p.id === preset)?.label ?? '';

  const targets = useMemo<TargetLabel[]>(() => {
    const t: TargetLabel[] = [];
    if (has('shipments')) {
      if (mode === 'loads') t.push({ scope: 'shipments', label: loadIds.length === allLoadIds.length ? 'All loads' : `Load${loadIds.length > 1 ? 's' : ''} ${loadIds.map((id) => LOADS.find((l) => l.id === id)?.number).join(', ')}` });
      if (mode === 'driver-loads') t.push({ scope: 'shipments', label: `${driverName(shipDriver)}’s loads` });
      if (mode === 'window') t.push({ scope: 'shipments', label: 'All loads in window' });
    }
    if (has('driver')) t.push({ scope: 'driver', label: driverIds.length === allDriverIds.length ? 'All drivers' : `Driver: ${driverIds.map(driverName).join(', ')}` });
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes, mode, loadIds, shipDriver, driverIds]);

  const frequency: Frequency =
    freq === 'once' ? { kind: 'once', runAt: `${onceAt}:00.000Z` } : freq === 'hourly' ? { kind: 'hourly' } : freq === 'daily' ? { kind: 'daily', timeOfDay } : { kind: 'weekly', timeOfDay, daysOfWeek: days };

  const missingLoads = has('shipments') && mode === 'loads' && loadIds.length === 0;
  const missingDrivers = has('driver') && driverIds.length === 0;
  const invalid = scopes.length === 0 || missingLoads || missingDrivers || (when === 'schedule' && !name.trim());

  // Loads covered by the shipments scope. The prototype's sample loads do not depend on the time window.
  const shipmentLoadIds = !has('shipments')
    ? []
    : mode === 'loads'
      ? loadIds
      : mode === 'driver-loads'
        ? LOADS.filter((l) => l.assignments.some((a) => a.driverId === shipDriver)).map((l) => l.id)
        : allLoadIds;

  const summary = `Diagnose ${scopes.length === 0 ? 'nothing yet' : scopes.map((s) => (s === 'shipments' || s === 'driver' ? targets.find((t) => t.scope === s)?.label ?? SCOPE_LABEL[s] : SCOPE_LABEL[s])).join(' + ')} · ${windowLabel} · ${
    when === 'now'
      ? 'run now'
      : `schedule "${name || 'unnamed'}" (${freq === 'once' ? 'once' : freq === 'hourly' ? 'hourly' : freq === 'daily' ? `daily ${timeOfDay}` : `weekly ${days.map((d) => DAYS[d]).join('/')} ${timeOfDay}`})`
  }`;

  const submit = (): void => {
    if (when === 'now') {
      const preview = PRESETS.find((p) => p.id === preset);
      const end = preset === 'custom' ? `${to}:00.000Z` : NOW;
      const start = preset === 'custom' ? `${from}:00.000Z` : new Date(new Date(NOW).getTime() - (preview?.hours ?? 24) * 3600000).toISOString();
      const run: DiagnosisRun = {
        id: `R-${Math.max(...runs.map((r) => Number(r.id.slice(2)))) + 1}`,
        trigger: 'manual',
        scopes,
        targets,
        windowStart: start,
        windowEnd: end,
        status: 'queued',
        createdAt: new Date().toISOString(),
        startedAt: null,
        durationSec: null,
        createdBy: CURRENT_USER,
        scheduleId: null,
        loadIds: shipmentLoadIds,
        driverIds: has('driver') ? driverIds : [],
        findingIds: [],
      };
      addRun(run);
      nav(`/diagnostics/runs/${run.id}`);
    } else {
      const s: Schedule = {
        id: `SCH-${Date.now() % 10000}`,
        name: name.trim(),
        scopes,
        targets,
        windowLabel,
        frequency,
        timezone: 'UTC',
        nextRunAt: freq === 'once' ? `${onceAt}:00.000Z` : NOW,
        lastRunId: null,
        lastRunAt: null,
        enabled: true,
      };
      addSchedule(s);
      nav('/diagnostics/schedules');
    }
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: 'New run' }]} title="New run" sub="Choose what to diagnose, for whom, over what time, and whether to run now or schedule it." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="1. What to diagnose" sub="Pick at least one scope." right={<Button variant="secondary" onClick={() => setScopes(allScopesSelected ? [] : ALL_SCOPES)}>{allScopesSelected ? 'Clear all' : 'Select all'}</Button>} />
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {(Object.keys(SCOPE_INFO) as RunScope[]).map((s) => (
                <label key={s} className={`flex cursor-pointer items-start gap-3 border-[1.5px] p-3 ${has(s) ? 'border-navy bg-navy-tint' : 'border-border-strong bg-card'}`}>
                  <input type="checkbox" checked={has(s)} onChange={() => toggle(scopes, s, setScopes)} className="mt-0.5 h-4 w-4 accent-navy" />
                  <span>
                    <span className="block text-sm font-semibold">{SCOPE_LABEL[s]}</span>
                    <span className="block text-xs text-muted-foreground">{SCOPE_INFO[s]}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          {(has('shipments') || has('driver')) && (
            <Card>
              <CardHeader title="2. Target" sub="Choose what to cover. API, GPS and notifications are fleet-wide and need no target." />
              <div className="space-y-5 p-4">
                {has('shipments') && (
                  <div>
                    <div className="mb-2 text-sm font-semibold">Shipments</div>
                    <div className="mb-3 flex flex-wrap gap-4 text-sm">
                      {(
                        [
                          ['loads', 'Specific load(s)'],
                          ['driver-loads', 'A driver’s loads'],
                          ['window', 'All loads active in the window'],
                        ] as [ShipmentMode, string][]
                      ).map(([v, l]) => (
                        <label key={v} className="inline-flex items-center gap-2">
                          <input type="radio" name="mode" checked={mode === v} onChange={() => setMode(v)} className="accent-navy" /> {l}
                        </label>
                      ))}
                    </div>
                    {mode === 'loads' && (
                      <div className="max-h-52 overflow-auto border border-border">
                        {LOADS.map((l) => (
                          <label key={l.id} className="flex cursor-pointer items-center gap-3 border-b border-divider-row px-3 py-2 last:border-0 hover:bg-navy-tint/50">
                            <input type="checkbox" checked={loadIds.includes(l.id)} onChange={() => toggle(loadIds, l.id, setLoadIds)} className="accent-navy" />
                            <span className="font-semibold">{l.number}</span>
                            <span className="text-muted-foreground">
                              {l.stops[0].dcName} → {l.stops[1].dcName}
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">{driverName(l.finalDriverId)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {mode === 'driver-loads' && (
                      <select className={inputCls} value={shipDriver} onChange={(e) => setShipDriver(e.target.value)}>
                        {DRIVERS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {mode === 'window' && <p className="text-sm text-muted-foreground">Every load active in the time window chosen below will be diagnosed.</p>}
                    {mode === 'loads' && (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <Button variant="secondary" onClick={() => setLoadIds(loadIds.length === allLoadIds.length ? [] : allLoadIds)}>{loadIds.length === allLoadIds.length ? 'Clear all loads' : 'Select all loads'}</Button>
                        <span className={loadIds.length === 0 ? 'font-semibold text-destructive-ink' : 'text-muted-foreground'}>{loadIds.length === 0 ? 'Tick at least one load.' : `${loadIds.length} selected`}</span>
                      </div>
                    )}
                  </div>
                )}
                {has('driver') && (
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-sm font-semibold">Driver(s)</span>
                      <Button variant="secondary" onClick={() => setDriverIds(driverIds.length === allDriverIds.length ? [] : allDriverIds)}>{driverIds.length === allDriverIds.length ? 'Clear all drivers' : 'Select all drivers'}</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DRIVERS.map((d) => (
                        <label key={d.id} className={`flex cursor-pointer items-center gap-2 border-[1.5px] px-3 py-1.5 text-sm ${driverIds.includes(d.id) ? 'border-navy bg-navy-tint' : 'border-border-strong'}`}>
                          <input type="checkbox" checked={driverIds.includes(d.id)} onChange={() => toggle(driverIds, d.id, setDriverIds)} className="accent-navy" />
                          {d.name}
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Their shipments completed within the lookback window below are reviewed.</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="3. Time window" sub={has('driver') ? 'For Driver scope this is the lookback range.' : undefined} />
            <div className="flex flex-wrap items-center gap-2 p-4">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => setPreset(p.id)} className={`border-[1.5px] px-3 py-1.5 text-sm font-semibold ${preset === p.id ? 'border-navy bg-navy text-white' : 'border-border-strong bg-card'}`}>
                  {p.label}
                </button>
              ))}
              {preset === 'custom' && (
                <span className="ml-2 inline-flex items-center gap-2 text-sm">
                  <input type="datetime-local" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /> →
                  <input type="datetime-local" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
                </span>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="4. When" />
            <div className="space-y-3 p-4">
              <div className="flex gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} className="accent-navy" /> Run now
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={when === 'schedule'} onChange={() => setWhen('schedule')} className="accent-navy" /> Schedule
                </label>
              </div>
              {when === 'schedule' && (
                <div className="space-y-3 border border-border bg-muted p-3">
                  <input className={`${inputCls} w-full max-w-sm placeholder:text-muted-foreground`} placeholder="Schedule name, e.g. Nightly shipment sweep" value={name} onChange={(e) => setName(e.target.value)} />
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <select className={inputCls} value={freq} onChange={(e) => setFreq(e.target.value as FreqKind)}>
                      <option value="once">One time</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    {freq === 'once' && <input type="datetime-local" className={inputCls} value={onceAt} onChange={(e) => setOnceAt(e.target.value)} />}
                    {(freq === 'daily' || freq === 'weekly') && (
                      <label className="inline-flex items-center gap-2">
                        at <input type="time" className={inputCls} value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} /> UTC
                      </label>
                    )}
                    {freq === 'weekly' && (
                      <span className="inline-flex gap-1">
                        {DAYS.map((d, i) => (
                          <button key={d} onClick={() => toggle(days, i, setDays)} className={`border-[1.5px] px-2 py-1 text-xs font-semibold ${days.includes(i) ? 'border-navy bg-navy text-white' : 'border-border-strong bg-card'}`}>
                            {d}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-4">
            <CardHeader title="5. Review" />
            <div className="space-y-3 p-4">
              <p className="text-sm">{summary}</p>
              {scopes.length === 0 && <p className="text-sm font-medium text-destructive-ink">Pick at least one scope.</p>}
              {missingLoads && <p className="text-sm font-medium text-destructive-ink">Tick at least one load.</p>}
              {missingDrivers && <p className="text-sm font-medium text-destructive-ink">Tick at least one driver.</p>}
              <p className="text-xs text-muted-foreground">Prototype: sample loads ignore the time window, and a started run finishes after a few seconds with findings from the sample data.</p>
              {when === 'schedule' && !name.trim() && <p className="text-sm font-medium text-destructive-ink">Give the schedule a name.</p>}
              <Button onClick={submit} disabled={invalid} className="w-full justify-center">
                {when === 'now' ? 'Start run' : 'Create schedule'}
              </Button>
              <div>
                <button onClick={() => setShowRules((s) => !s)} className="inline-flex items-center gap-1 text-xs font-semibold text-navy">
                  <ChevronDown size={14} className={showRules ? 'rotate-180' : ''} /> What will be checked
                </button>
                {showRules && (
                  <ul className="mt-2 space-y-2">
                    {RULES.filter((r) =>
                      scopes.some((s) => (s === 'shipments' && r.scope === 'shipment') || (s === 'driver' && r.scope === 'driver') || (s === 'gps' && r.scope === 'fleet') || (s === 'api' && r.scope === 'api') || (s === 'notifications' && r.scope === 'messaging'))
                    ).map((r) => (
                      <li key={r.code} className="text-xs">
                        <span className="font-semibold">{r.title}</span> <code className="bg-muted px-1 text-muted-foreground">{r.code}</code>
                        <div className="text-muted-foreground">
                          {r.meaning}
                          {r.threshold ? ` (${r.threshold})` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
