export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: activeTz,
  }) + ` ${tzName(new Date(iso))}`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: activeTz,
  });
}

export interface TimezoneOption {
  id: string;
  label: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { id: 'UTC', label: 'UTC' },
  { id: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { id: 'Europe/London', label: 'Europe/London' },
  { id: 'Europe/Berlin', label: 'Europe/Berlin' },
  { id: 'Asia/Dubai', label: 'Asia/Dubai' },
  { id: 'Asia/Singapore', label: 'Asia/Singapore' },
  { id: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { id: 'Australia/Sydney', label: 'Australia/Sydney' },
  { id: 'America/New_York', label: 'America/New_York' },
  { id: 'America/Chicago', label: 'America/Chicago' },
  { id: 'America/Denver', label: 'America/Denver' },
  { id: 'America/Los_Angeles', label: 'America/Los_Angeles' },
];

const TZ_KEY = 'admin-panel-timezone';

function loadTimezone(): string {
  try {
    const v = window.localStorage.getItem(TZ_KEY);
    return v && TIMEZONES.some((t) => t.id === v) ? v : 'UTC';
  } catch {
    return 'UTC';
  }
}

// Display-only. Data stays UTC; every formatter below reads the active zone.
let activeTz = loadTimezone();

export const getTimezone = (): string => activeTz;

export function setTimezone(id: string): void {
  activeTz = id;
  try {
    window.localStorage.setItem(TZ_KEY, id);
  } catch {
    /* storage unavailable: choice just won't persist */
  }
}

function tzName(d: Date): string {
  if (activeTz === 'UTC') return 'UTC';
  return new Intl.DateTimeFormat('en-US', { timeZone: activeTz, timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? activeTz;
}

export function fmtDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function pct(part: number, whole: number): string {
  return whole === 0 ? '0%' : `${((part / whole) * 100).toFixed(1)}%`;
}

export const minutesBetween = (a: string, b: string): number =>
  (new Date(b).getTime() - new Date(a).getTime()) / 60000;
