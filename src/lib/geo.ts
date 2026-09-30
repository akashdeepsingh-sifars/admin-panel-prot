import type { LatLng } from '../types';

const EARTH_M = 6371000;
const toRad = (d: number): number => (d * Math.PI) / 180;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

// Equirectangular projection around the point; accurate enough at route scale.
function distToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos(toRad(p.lat));
  const ax = (a.lng - p.lng) * k;
  const ay = a.lat - p.lat;
  const bx = (b.lng - p.lng) * k;
  const by = b.lat - p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt(cx * cx + cy * cy) * (Math.PI / 180) * EARTH_M;
}

export function distToPolylineM(p: LatLng, line: LatLng[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    best = Math.min(best, distToSegmentM(p, line[i - 1], line[i]));
  }
  return best;
}

export interface RoutePoint extends LatLng {
  bearingDeg: number;
}

export function pointAtFraction(line: LatLng[], fraction: number): RoutePoint {
  const f = Math.max(0, Math.min(1, fraction));
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = haversineM(line[i - 1], line[i]);
    lens.push(d);
    total += d;
  }
  let target = f * total;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) {
      const t = lens[i] === 0 ? 0 : Math.min(1, target / lens[i]);
      const a = line[i];
      const b = line[i + 1];
      const dLng = toRad(b.lng - a.lng);
      const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
      const x =
        Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
        Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        bearingDeg: (Math.atan2(y, x) * 180) / Math.PI,
      };
    }
    target -= lens[i];
  }
  return { ...line[line.length - 1], bearingDeg: 0 };
}

export function offsetLatLng(p: RoutePoint, km: number, sideDeg: number): LatLng {
  const b = toRad(p.bearingDeg + sideDeg);
  return {
    lat: p.lat + (Math.cos(b) * km) / 111,
    lng: p.lng + (Math.sin(b) * km) / (111 * Math.cos(toRad(p.lat))),
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
