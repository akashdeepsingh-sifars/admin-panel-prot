import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RotateCw } from 'lucide-react';
import { MapLegend, MapView } from '../components/MapView';
import { NotificationsTab } from '../components/shipment/NotificationsTab';
import { OverviewTab } from '../components/shipment/OverviewTab';
import { PhotosTab } from '../components/shipment/PhotosTab';
import { PingTable } from '../components/shipment/PingTable';
import { ProblemsTab } from '../components/shipment/ProblemsTab';
import { RuleReference } from '../components/shipment/RuleReference';
import { SilenceGaps } from '../components/shipment/SilenceGaps';
import { TimelineTab } from '../components/shipment/TimelineTab';
import { FindingCard } from '../components/FindingCard';
import { Button, Card, CardHeader, Chip, Empty, KV, PageHeader, StatusBadge, Tabs } from '../components/ui';
import { fmtDateTime, fmtDuration } from '../lib/format';
import { queuedRun } from '../lib/runs';
import { patternsForLoad } from '../sampleData/analyze';
import { DRIVERS, loadById } from '../sampleData';
import { CURRENT_USER, useStore } from '../store';
import type { DiagnosisRun, Finding } from '../types';

type Tab = 'findings' | 'overview' | 'map' | 'timeline' | 'photos' | 'problems' | 'notifications';

// One shipment run = one shipment. Everything about that shipment is shown, even when no rule fired.
export function ShipmentDiagnosis({ run }: { run: DiagnosisRun }): JSX.Element {
  const nav = useNavigate();
  const { findings, runs, addRun } = useStore();
  const load = loadById(run.loadId ?? '');
  const [tab, setTab] = useState<Tab>('findings');
  const [selectedPing, setSelectedPing] = useState<string | null>(null);
  const [hiPings, setHiPings] = useState<string[]>([]);
  const [hiPhotos, setHiPhotos] = useState<string[]>([]);
  const [showActual, setShowActual] = useState(true);

  const fs = useMemo(() => findings.filter((f) => f.runId === run.id && f.section === 'shipment'), [findings, run.id]);
  if (!load) return <Empty title="Shipment not found" body="This shipment does not exist in the sample data." />;

  const chips = patternsForLoad(load);
  const selected = load.pings.find((p) => p.id === selectedPing) ?? null;
  const drv = (id: string): string => DRIVERS.find((d) => d.id === id)?.name ?? id;
  const multiDriver = new Set(load.pings.map((p) => p.driverId)).size > 1;

  const focus = (pingIds: string[], photoIds: string[] = []): void => {
    setHiPings(pingIds);
    setHiPhotos(photoIds);
    setSelectedPing(pingIds[0] ?? null);
    setTab('map');
  };

  const rerun = (): void => {
    const next = queuedRun(runs, run, CURRENT_USER);
    addRun(next);
    nav(`/diagnostics/runs/${next.id}`);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: run.id }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Shipment {load.number} <StatusBadge status={run.status} />
          </span>
        }
        sub={`Run ${run.id} · ${load.stops[0].dcName} → ${load.stops[1].dcName} · ${load.shipper.name} · ${load.carrier.name}`}
        actions={
          <>
            <Button variant="secondary" onClick={rerun}>
              <RotateCw size={14} /> Re-run
            </Button>
            <Button variant="secondary">
              <Download size={14} /> Export
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-x-8 px-4 py-2 sm:grid-cols-3">
          <KV k="Started">{fmtDateTime(run.startedAt)}</KV>
          <KV k="Duration">{fmtDuration(run.durationSec)}</KV>
          <KV k="Created by">{run.createdBy}</KV>
        </div>
      </Card>

      {run.status === 'failed' && (
        <div className="mb-4 border border-destructive bg-destructive-tint px-4 py-3 text-sm text-destructive-ink">
          <strong>Run failed.</strong> {run.error}
        </div>
      )}
      {(run.status === 'queued' || run.status === 'running') && (
        <Card>
          <Empty title={run.status === 'queued' ? 'Waiting in queue' : 'Diagnosis in progress'} body="The shipment's findings and full record appear here as soon as the run completes. This page updates on its own." />
        </Card>
      )}

      {run.status === 'completed' && (
        <>
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
              { id: 'notifications', label: 'Notifications' },
            ]}
          />

          {tab === 'findings' && (
            <div className="space-y-3">
              {fs.length === 0 ? (
                <Card>
                  <Empty title="No abnormality found for this shipment" body="Every rule passed. The full record of this shipment (overview, map, pings, timeline, photos, problems and notifications) is still available in the other tabs." />
                </Card>
              ) : (
                fs.map((f: Finding) => <FindingCard key={f.id} finding={f} onFocus={(x) => focus(x.pingIds, x.photoIds)} />)
              )}
              <SilenceGaps load={load} onFocus={(ids) => focus(ids)} />
              <RuleReference findings={fs} />
            </div>
          )}

          {tab === 'overview' && <OverviewTab load={load} />}

          {tab === 'map' && (
            <div className="space-y-4">
              <div>
                <MapView load={load} selectedPingId={selectedPing} highlightPingIds={hiPings} highlightPhotoIds={hiPhotos} showActual={showActual} onSelectPing={setSelectedPing} />
                <MapLegend />
              </div>
              <Card>
                <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showActual} onChange={(e) => setShowActual(e.target.checked)} className="accent-navy" /> Path followed</label>
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
                      <KV k="Sent by">{drv(selected.driverId)}</KV>
                      <KV k="Location">{selected.context === 'normal' ? 'Normal' : selected.context === 'pickup' ? 'Pickup geofence' : 'Drop-off geofence'}</KV>
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
                <CardHeader title="Pings" sub={multiDriver ? 'Click a row to focus it on the map. The driver column shows which driver each ping belongs to.' : 'Click a row to focus it on the map.'} />
                <PingTable pings={load.pings} selectedId={selectedPing} highlightIds={hiPings} onSelect={setSelectedPing} showDriver={multiDriver || load.assignments.length > 1} />
              </Card>
            </div>
          )}

          {tab === 'timeline' && <TimelineTab load={load} onFocus={(p, ph) => focus(p, ph ? [ph] : [])} />}
          {tab === 'photos' && <PhotosTab load={load} onFocus={(id) => focus([], [id])} />}
          {tab === 'problems' && <ProblemsTab load={load} />}
          {tab === 'notifications' && <NotificationsTab load={load} />}
        </>
      )}
    </>
  );
}
