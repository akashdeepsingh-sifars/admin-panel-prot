import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Button, Card, CardHeader, Empty, PageHeader } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { KIND_LABEL, queuedRun } from '../lib/runs';
import { CURRENT_USER, useStore } from '../store';
import { CARRIERS, DRIVERS, LOADS, NOW, RULES, SHIPPERS } from '../sampleData';
import type { Load, RunKind } from '../types';

const PRESETS: { id: string; label: string; hours: number }[] = [
  { id: '1h', label: 'Last 1 h', hours: 1 },
  { id: '24h', label: 'Last 24 h', hours: 24 },
  { id: '7d', label: 'Last 7 days', hours: 168 },
  { id: '30d', label: 'Last 30 days', hours: 720 },
  { id: 'custom', label: 'Custom', hours: 0 },
];
const KIND_INFO: Record<RunKind, string> = {
  shipment: 'Everything about one shipment: GPS, geofences, notifications, photos and problems',
  api: 'Request health, unhandled errors, rate limiting over a time window',
  notifications: 'Push and email delivery failures over a time window',
};
const KINDS: RunKind[] = ['shipment', 'api', 'notifications'];
const inputCls = 'border-[1.5px] border-border-strong bg-card px-2 py-1.5 text-sm';

// Every person tied to a load: organisation contacts, drivers, and whoever created or accepted it.
const peopleOf = (l: Load): string[] => [l.shipper.contact.name, l.carrier.contact.name, l.createdBy.name, l.acceptedBy.name, ...l.assignments.map((a) => DRIVERS.find((d) => d.id === a.driverId)?.name ?? '')].filter(Boolean);
const ALL_USERS = [...new Set(LOADS.flatMap(peopleOf))].sort();

export function NewRun(): JSX.Element {
  const nav = useNavigate();
  const { runs, addRun } = useStore();
  const [kind, setKind] = useState<RunKind>('shipment');
  const [loadId, setLoadId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [carrier, setCarrier] = useState('');
  const [shipper, setShipper] = useState('');
  const [driver, setDriver] = useState('');
  const [user, setUser] = useState('');
  const [q, setQ] = useState('');
  const [preset, setPreset] = useState('24h');
  const [from, setFrom] = useState('2026-09-28T00:00');
  const [to, setTo] = useState('2026-09-29T00:00');
  const [showRules, setShowRules] = useState(false);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return LOADS.filter((l) => {
      const day = l.stops[0].scheduledStart.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (carrier && l.carrier.id !== carrier) return false;
      if (shipper && l.shipper.id !== shipper) return false;
      if (driver && !l.assignments.some((a) => a.driverId === driver)) return false;
      if (user && !peopleOf(l).includes(user)) return false;
      if (needle) {
        const hay = [l.number, l.commodity, l.equipment, l.shipper.name, l.carrier.name, ...l.stops.flatMap((s) => [s.dcName, s.address]), ...peopleOf(l)].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [dateFrom, dateTo, carrier, shipper, driver, user, q]);

  const chosen = LOADS.find((l) => l.id === loadId) ?? null;
  const filtersOn = !!(dateFrom || dateTo || carrier || shipper || driver || user || q);
  const clearFilters = (): void => {
    setDateFrom('');
    setDateTo('');
    setCarrier('');
    setShipper('');
    setDriver('');
    setUser('');
    setQ('');
  };

  const windowLabel = preset === 'custom' ? `${from.replace('T', ' ')} → ${to.replace('T', ' ')}` : PRESETS.find((p) => p.id === preset)?.label ?? '';
  const invalid = kind === 'shipment' && !chosen;
  const summary = kind === 'shipment' ? `Diagnose shipment ${chosen?.number ?? '(none selected)'}` : `Diagnose ${KIND_LABEL[kind]} · ${windowLabel}`;

  const submit = (): void => {
    let windowStart: string | null = null;
    let windowEnd: string | null = null;
    if (kind !== 'shipment') {
      const hours = PRESETS.find((p) => p.id === preset)?.hours ?? 24;
      windowEnd = preset === 'custom' ? `${to}:00.000Z` : NOW;
      windowStart = preset === 'custom' ? `${from}:00.000Z` : new Date(new Date(NOW).getTime() - hours * 3600000).toISOString();
    }
    const run = queuedRun(runs, { kind, loadId: kind === 'shipment' ? loadId : null, windowStart, windowEnd }, CURRENT_USER);
    addRun(run);
    nav(`/diagnostics/runs/${run.id}`);
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: 'New run' }]} title="New run" sub="Choose what to diagnose. A shipment run covers exactly one shipment." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="1. What to diagnose" />
            <div className="grid gap-2 p-4 sm:grid-cols-3">
              {KINDS.map((k) => (
                <label key={k} className={`flex cursor-pointer items-start gap-3 border-[1.5px] p-3 ${kind === k ? 'border-navy bg-navy-tint' : 'border-border-strong bg-card'}`}>
                  <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="mt-0.5 h-4 w-4 accent-navy" />
                  <span>
                    <span className="block text-sm font-semibold">{KIND_LABEL[k]}</span>
                    <span className="block text-xs text-muted-foreground">{KIND_INFO[k]}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          {kind === 'shipment' ? (
            <Card>
              <CardHeader title="2. Pick one shipment" sub="Use the filters to narrow the list, then select the shipment to diagnose. One run diagnoses one shipment." right={filtersOn ? <Button variant="ghost" onClick={clearFilters}>Clear filters</Button> : undefined} />
              <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs font-semibold text-muted-foreground">
                  Shipment date from
                  <input type="date" className={`${inputCls} mt-1 w-full`} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Shipment date to
                  <input type="date" className={`${inputCls} mt-1 w-full`} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Carrier
                  <select className={`${inputCls} mt-1 w-full`} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                    <option value="">All carriers</option>
                    {CARRIERS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Shipper
                  <select className={`${inputCls} mt-1 w-full`} value={shipper} onChange={(e) => setShipper(e.target.value)}>
                    <option value="">All shippers</option>
                    {SHIPPERS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Driver
                  <select className={`${inputCls} mt-1 w-full`} value={driver} onChange={(e) => setDriver(e.target.value)}>
                    <option value="">All drivers</option>
                    {DRIVERS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  User
                  <select className={`${inputCls} mt-1 w-full`} value={user} onChange={(e) => setUser(e.target.value)}>
                    <option value="">Any user</option>
                    {ALL_USERS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Search text
                  <input className={`${inputCls} mt-1 w-full placeholder:text-muted-foreground`} placeholder="Load number, commodity, shipper, carrier, distribution centre, address, person…" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
              </div>
              {matches.length === 0 ? (
                <Empty title="No shipments match" body="Loosen the filters to see more shipments." />
              ) : (
                <div className="max-h-80 overflow-auto">
                  {matches.map((l) => (
                    <label key={l.id} className={`flex cursor-pointer items-center gap-3 border-b border-divider-row px-4 py-2 last:border-0 hover:bg-navy-tint/50 ${loadId === l.id ? 'bg-navy-tint' : ''}`}>
                      <input type="radio" name="load" checked={loadId === l.id} onChange={() => setLoadId(l.id)} className="accent-navy" />
                      <span className="font-semibold">{l.number}</span>
                      <span className="text-sm text-muted-foreground">
                        {l.stops[0].dcName} → {l.stops[1].dcName}
                      </span>
                      <span className="ml-auto text-right text-xs text-muted-foreground">
                        {fmtDateTime(l.stops[0].scheduledStart)}
                        <br />
                        {l.shipper.name} · {l.carrier.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <CardHeader title="2. Time window" />
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
          )}
        </div>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-4">
            <CardHeader title="3. Review" />
            <div className="space-y-3 p-4">
              <p className="text-sm">{summary}</p>
              {invalid && <p className="text-sm font-medium text-destructive-ink">Select one shipment.</p>}
              <p className="text-xs text-muted-foreground">Prototype: a started run finishes after a few seconds with findings from the sample data.</p>
              <Button onClick={submit} disabled={invalid} className="w-full justify-center">
                Start run
              </Button>
              <div>
                <button onClick={() => setShowRules((s) => !s)} className="inline-flex items-center gap-1 text-xs font-semibold text-navy">
                  <ChevronDown size={14} className={showRules ? 'rotate-180' : ''} /> What will be checked
                </button>
                {showRules && (
                  <ul className="mt-2 space-y-2">
                    {RULES.filter((r) => r.scope === (kind === 'shipment' ? 'shipment' : kind === 'api' ? 'api' : 'messaging')).map((r) => (
                      <li key={r.code} className="text-xs">
                        <span className="font-semibold">{r.title}</span> <code className="bg-muted px-1 text-muted-foreground">{r.code}</code>
                        <div className="text-muted-foreground">
                          {r.description}
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
