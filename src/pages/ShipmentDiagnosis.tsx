import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MapLegend, MapView } from '../components/MapView';
import { OverviewTab } from '../components/shipment/OverviewTab';
import { PhotosTab } from '../components/shipment/PhotosTab';
import { PingTable } from '../components/shipment/PingTable';
import { ProblemsTab } from '../components/shipment/ProblemsTab';
import { TimelineTab } from '../components/shipment/TimelineTab';
import { FindingCard } from '../components/FindingCard';
import { Card, CardHeader, Chip, Empty, KV, PageHeader, Tabs } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { patternsForLoad } from '../sampleData/analyze';
import { loadById, RULES } from '../sampleData';
import { useStore } from '../store';
import type { Finding } from '../types';

type Tab = 'findings' | 'overview' | 'map' | 'timeline' | 'photos' | 'problems';

export function ShipmentDiagnosis(): JSX.Element {
  const { runId, loadId } = useParams();
  const { findings } = useStore();
  const load = loadById(loadId ?? '');
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (params.get('tab') as Tab | null) ?? (findings.some((f) => f.runId === runId && f.loadId === loadId && f.section === 'shipment') ? 'findings' : 'overview'));
  const [selectedPing, setSelectedPing] = useState<string | null>(null);
  const [hiPings, setHiPings] = useState<string[]>([]);
  const [hiPhotos, setHiPhotos] = useState<string[]>([]);
  const [showPlanned, setShowPlanned] = useState(true);
  const [showActual, setShowActual] = useState(true);
  const [replay, setReplay] = useState<number | null>(null);

  const fs = useMemo(() => findings.filter((f) => f.runId === runId && f.loadId === loadId && f.section === 'shipment'), [findings, runId, loadId]);
  if (!load) return <Empty title="Load not found" body="This load does not exist in the sample data." />;

  const chips = patternsForLoad(load);
  const visibleCount = replay ?? load.pings.length;
  const selected = load.pings.find((p) => p.id === selectedPing) ?? null;

  const focus = (pingIds: string[], photoIds: string[] = []): void => {
    setHiPings(pingIds);
    setHiPhotos(photoIds);
    setSelectedPing(pingIds[0] ?? null);
    setReplay(null);
    setTab('map');
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: runId ?? '', to: `/diagnostics/runs/${runId}` }, { label: load.number }]}
        title={`Shipment ${load.number}`}
        sub={`${load.stops[0].dcName} → ${load.stops[1].dcName} · ${load.shipper.name} · ${load.carrier.name}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patterns</span>
        {chips.length === 0 ? <Chip tone="ok">No abnormal behaviour detected</Chip> : chips.map((c) => <Chip key={c.key} tone={c.tone}>{c.label}</Chip>)}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'findings', label: 'Findings', count: fs.length },
          { id: 'overview', label: 'Overview' },
          { id: 'map', label: 'Map & pings', count: load.pings.length },
          { id: 'timeline', label: 'Timeline' },
          { id: 'photos', label: 'Photos', count: load.photos.length },
          { id: 'problems', label: 'Problems & breaks', count: load.problems.length + load.breaks.length },
        ]}
      />

      {tab === 'findings' && (
        <div className="space-y-3">
          {fs.length === 0 ? (
            <Card>
              <Empty title="No findings for this shipment" body="Every rule passed. A clean shipment keeps its full record: overview, map, pings, timeline and photos are all still available in the other tabs." />
            </Card>
          ) : (
            fs.map((f: Finding) => <FindingCard key={f.id} finding={f} onFocus={(x) => focus(x.pingIds, x.photoIds)} />)
          )}
          <Card>
            <CardHeader title="Rules checked" sub="What this run looked at for this shipment." />
            <ul className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
              {RULES.filter((r) => r.scope === 'shipment').map((r) => {
                const hits = fs.filter((f) => f.ruleCode === r.code).length;
                return (
                  <li key={r.code} className="flex items-center justify-between gap-3 border-b border-divider-row py-1.5 text-sm">
                    <span>{r.title}</span>
                    {hits > 0 ? <Chip tone="high">{hits} finding{hits > 1 ? 's' : ''}</Chip> : <Chip tone="ok">Passed</Chip>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'overview' && <OverviewTab load={load} runId={runId ?? ''} />}

      {tab === 'map' && (
        <div className="space-y-4">
          <div>
            <MapView load={load} visibleCount={visibleCount} selectedPingId={selectedPing} highlightPingIds={hiPings} highlightPhotoIds={hiPhotos} showPlanned={showPlanned} showActual={showActual} onSelectPing={setSelectedPing} />
            <MapLegend />
          </div>
          <Card>
            <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} className="accent-navy" /> Planned route</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showActual} onChange={(e) => setShowActual(e.target.checked)} className="accent-navy" /> Actual path</label>
              <label className="flex flex-1 items-center gap-3">
                <span className="whitespace-nowrap">Replay</span>
                <input type="range" min={1} max={load.pings.length} value={visibleCount} onChange={(e) => setReplay(Number(e.target.value))} className="flex-1 accent-navy" />
                <span className="w-36 whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(load.pings[visibleCount - 1].recordedAt)}</span>
              </label>
              {(hiPings.length > 0 || hiPhotos.length > 0) && (
                <button className="text-xs font-semibold text-navy hover:underline" onClick={() => { setHiPings([]); setHiPhotos([]); }}>Clear highlight</button>
              )}
            </div>
            {selected && (
              <div className="grid gap-x-8 border-t border-border px-4 py-2 sm:grid-cols-3">
                <div>
                  <KV k="Ping">{selected.id}</KV>
                  <KV k="Recorded">{fmtDateTime(selected.recordedAt)}</KV>
                  <KV k="Position">{selected.location.lat.toFixed(5)}, {selected.location.lng.toFixed(5)}</KV>
                </div>
                <div>
                  <KV k="Context">{selected.context.replace('_', ' ')}</KV>
                  <KV k="Off planned route">{selected.offRouteM} m</KV>
                  <KV k="Accuracy">{selected.accuracyM} m</KV>
                </div>
                <div>
                  <KV k="Battery">{selected.phone.batteryPct}%{selected.phone.charging ? ' · charging' : ''}</KV>
                  <KV k="Network">{selected.phone.network}</KV>
                  <KV k="Location permission">{selected.phone.locationPermission.replace('_', ' ')} · {selected.phone.locationPrecision}</KV>
                </div>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Pings" sub="Click a row to focus it on the map." />
            <PingTable pings={load.pings} selectedId={selectedPing} highlightIds={hiPings} onSelect={(id) => { setSelectedPing(id); }} showDriver={load.assignments.length > 1} />
          </Card>
        </div>
      )}

      {tab === 'timeline' && <TimelineTab load={load} onFocus={(p, ph) => focus(p, ph ? [ph] : [])} />}
      {tab === 'photos' && <PhotosTab load={load} onFocus={(id) => focus([], [id])} />}
      {tab === 'problems' && <ProblemsTab load={load} />}
    </>
  );
}
