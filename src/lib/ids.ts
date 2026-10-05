import { mulberry32 } from './geo';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Deterministic UUID-shaped ids so sample rows look like real database ids and stay the same on every reload.
export function uuidFor(label: string): string {
  let h = 2166136261;
  for (const c of label) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const rnd = mulberry32(h >>> 0);
  const hex = (n: number): string => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(rnd() * 4)]}${hex(3)}-${hex(12)}`;
}
