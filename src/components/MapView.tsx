import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { MAP_COLORS } from '../lib/theme';
import { fmtTime } from '../lib/format';
import { DRIVERS } from '../sampleData';
import { analyzeLoad, fenceName } from '../sampleData/analyze';
import type { Load, Ping, PingContext } from '../types';

interface Props {
  load: Load;
  selectedPingId: string | null;
  highlightPingIds: string[];
  highlightPhotoIds: string[];
  showActual: boolean;
  onSelectPing: (id: string) => void;
}

const ll = (p: { lat: number; lng: number }): LatLngExpression => [p.lat, p.lng];
const CTX_COLOR: Record<PingContext, string> = {
  pickup: MAP_COLORS.limeDark,
  normal: MAP_COLORS.navy,
  delivery: MAP_COLORS.destructive,
};
const CTX_LABEL: Record<PingContext, string> = { pickup: 'pickup geofence', normal: 'normal', delivery: 'drop-off geofence' };
const driverName = (id: string): string => DRIVERS.find((d) => d.id === id)?.name ?? id;

function Fit({ load, focus }: { load: Load; focus: Ping | null }): null {
  const map = useMap();
  useEffect(() => {
    const pts = [...load.stops.map((s) => s.location), ...load.pings.map((p) => p.location)];
    const b: LatLngBoundsExpression = [
      [Math.min(...pts.map((p) => p.lat)), Math.min(...pts.map((p) => p.lng))],
      [Math.max(...pts.map((p) => p.lat)), Math.max(...pts.map((p) => p.lng))],
    ];
    map.fitBounds(b, { padding: [30, 30] });
  }, [load, map]);
  useEffect(() => {
    if (focus) map.flyTo(ll(focus.location), Math.max(map.getZoom(), 11), { duration: 0.5 });
  }, [focus, map]);
  return null;
}

export function MapView({ load, selectedPingId, highlightPingIds, highlightPhotoIds, showActual, onSelectPing }: Props): JSX.Element {
  const visible = load.pings;
  const selected = load.pings.find((p) => p.id === selectedPingId) ?? null;
  const hi = new Set(highlightPingIds);
  const a = analyzeLoad(load);

  // Path segments coloured by context.
  const segments: { color: string; pts: LatLngExpression[] }[] = [];
  visible.forEach((p, i) => {
    const color = CTX_COLOR[p.context];
    const prev = segments[segments.length - 1];
    if (prev && prev.color === color) prev.pts.push(ll(p.location));
    else segments.push({ color, pts: i > 0 ? [ll(visible[i - 1].location), ll(p.location)] : [ll(p.location)] });
  });

  return (
    <MapContainer center={ll(load.stops[0].location)} zoom={7} scrollWheelZoom className="h-[460px] w-full border border-border-strong">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit load={load} focus={selected} />

      {load.stops.map((s) => (
        <Circle key={s.id} center={ll(s.location)} radius={s.radiusM} pathOptions={{ color: MAP_COLORS.limeDark, fillColor: MAP_COLORS.lime, fillOpacity: 0.25, weight: 2 }}>
          <Tooltip sticky>
            {s.kind === 'pickup' ? 'Pickup' : 'Delivery'} · {s.dcName} · radius {s.radiusM} m
          </Tooltip>
        </Circle>
      ))}

      {showActual && segments.map((s, i) => <Polyline key={i} positions={s.pts} pathOptions={{ color: s.color, weight: 3, opacity: 0.85 }} />)}

      {a.gaps.map((g, i) => (
        <Polyline key={`gap-${i}`} positions={[ll(g.before.location), ll(g.after.location)]} pathOptions={{ color: MAP_COLORS.warning, weight: 4, dashArray: '10 8' }}>
          <Tooltip sticky>
            GPS silent {g.minutes} min · {g.inferredCause}
          </Tooltip>
        </Polyline>
      ))}
      {a.handovers.map((h, i) =>
        h.park ? (
          <Circle key={`park-${i}`} center={ll(h.park.location)} radius={400} pathOptions={{ color: MAP_COLORS.navyDark, fillColor: MAP_COLORS.navy, fillOpacity: 0.2, weight: 3, dashArray: '4 4' }}>
            <Tooltip sticky>
              Parked here for the driver change · {h.parkedMinutes} min
            </Tooltip>
          </Circle>
        ) : null
      )}
      {a.handovers.map((h, i) =>
        h.park && h.firstPing ? (
          <Polyline key={`ho-${i}`} positions={[ll(h.park.location), ll(h.firstPing.location)]} pathOptions={{ color: h.issues.length ? MAP_COLORS.destructive : MAP_COLORS.navyDark, weight: 4, dashArray: '2 8' }}>
            <Tooltip sticky>
              New driver's first ping · {(h.resumeDistanceM / 1000).toFixed(1)} km from the parked spot{h.issues.length ? ' · needs review' : ''}
            </Tooltip>
          </Polyline>
        ) : null
      )}
      {a.handovers.map((h, i) =>
        h.firstPing ? (
          <CircleMarker key={`hom-${i}`} center={ll(h.firstPing.location)} radius={10} pathOptions={{ color: h.issues.length ? MAP_COLORS.destructive : MAP_COLORS.navyDark, fillColor: MAP_COLORS.white, fillOpacity: 1, weight: 4 }}>
            <Tooltip sticky>New driver's first ping</Tooltip>
          </CircleMarker>
        ) : null
      )}
      {a.frozen.map((f, i) => (
        <Circle key={`fz-${i}`} center={ll(f.pings[0].location)} radius={120} pathOptions={{ color: MAP_COLORS.warning, fillOpacity: 0.15, weight: 2 }}>
          <Tooltip sticky>Static location · {Math.round(f.seconds / 60)} min</Tooltip>
        </Circle>
      ))}
      {a.missed.map((m, i) => (
        <CircleMarker key={`ms-${i}`} center={ll(m.after.location)} radius={11} pathOptions={{ color: MAP_COLORS.destructive, fillOpacity: 0, weight: 3 }}>
          <Tooltip sticky>Missed geofence ({m.transition}) · {fenceName(m.stop)}</Tooltip>
        </CircleMarker>
      ))}
      {a.dupGroups.map((g, i) => (
        <CircleMarker key={`dp-${i}`} center={ll(g[0].location)} radius={9} pathOptions={{ color: MAP_COLORS.navyDark, fillOpacity: 0, weight: 2, dashArray: '3 3' }}>
          <Tooltip sticky>{g.length} duplicate readings</Tooltip>
        </CircleMarker>
      ))}

      {visible.map((p) => {
        const isSel = p.id === selectedPingId;
        const isHi = hi.has(p.id);
        return (
          <CircleMarker
            key={p.id}
            center={ll(p.location)}
            radius={isSel ? 9 : isHi ? 7 : 3}
            pathOptions={{ color: isSel || isHi ? MAP_COLORS.navyDark : CTX_COLOR[p.context], fillColor: isHi ? MAP_COLORS.warning : CTX_COLOR[p.context], fillOpacity: 1, weight: isSel || isHi ? 3 : 1 }}
            eventHandlers={{ click: () => onSelectPing(p.id) }}
          >
            <Tooltip>
              {fmtTime(p.recordedAt)} · {CTX_LABEL[p.context]}{load.assignments.length > 1 ? ` · ${driverName(p.driverId)}` : ''}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {load.photos.map((ph) => (
        <CircleMarker
          key={ph.id}
          center={ll(ph.location)}
          radius={highlightPhotoIds.includes(ph.id) ? 11 : 7}
          pathOptions={{ color: MAP_COLORS.navyDark, fillColor: ph.onTime ? MAP_COLORS.white : MAP_COLORS.warning, fillOpacity: 1, weight: 3 }}
        >
          <Tooltip>
            Photo · {ph.kind.replace('_', ' ')} · {ph.context.replace('_', ' ')} · {(ph.distanceToStopM / 1000).toFixed(1)} km from stop
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export function MapLegend(): JSX.Element {
  const items: [string, string][] = [
    [MAP_COLORS.limeDark, 'Ping at pickup geofence'],
    [MAP_COLORS.navy, 'Normal ping'],
    [MAP_COLORS.destructive, 'Ping at drop-off geofence'],
    [MAP_COLORS.warning, 'GPS silence / static location / highlighted'],
    [MAP_COLORS.white, 'Photo (amber = off-time or wrong place)'],
    [MAP_COLORS.navyDark, 'Parked for driver change / new driver start (red = needs review)'],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border border-t-0 border-border bg-card px-3 py-2 text-xs">
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-border-strong" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}
