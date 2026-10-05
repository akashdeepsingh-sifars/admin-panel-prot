import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Database, ListChecks, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { getTimezone, setTimezone, TIMEZONES } from '../lib/format';
import { cx } from './ui';

const NEW_RUN = '/diagnostics/runs/new';

// Runs stays highlighted on every run sub-page (shipment, API, notifications), but not on New run.
const NAV: { to: string; label: string; icon: typeof ListChecks; active: (path: string) => boolean }[] = [
  { to: '/diagnostics/runs', label: 'Runs', icon: ListChecks, active: (p) => p.startsWith('/diagnostics/runs') && p !== NEW_RUN },
  { to: NEW_RUN, label: 'New run', icon: PlusCircle, active: (p) => p === NEW_RUN },
  { to: '/tables', label: 'Tables', icon: Database, active: (p) => p.startsWith('/tables') },
];

export function Layout(): JSX.Element {
  const { pathname } = useLocation();
  const [tz, setTz] = useState(getTimezone);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 h-screen w-56 shrink-0 self-start overflow-y-auto bg-navy-dark text-white">
        <div className="border-b border-white/20 px-4 py-4">
          <div className="text-base font-bold">FreightFlow</div>
          <div className="text-xs text-white/80">Admin panel</div>
        </div>
        <nav className="py-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={cx('flex items-center gap-2 border-l-4 px-4 py-2.5 text-sm font-semibold', n.active(pathname) ? 'border-lime-brand bg-lime-brand/20 text-white' : 'border-transparent text-white/80 hover:bg-white/10')}
            >
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="border-b border-warning bg-warning-tint px-6 py-1.5 text-xs font-medium text-warning-ink">
          <div className="flex items-center gap-4">
            <span>Prototype · all data on screen is sample data. Nothing here is connected to the backend.</span>
            <label className="ml-auto flex items-center gap-2 font-semibold">
              Show times in
              <select
                className="border-[1.5px] border-border-strong bg-card px-2 py-0.5 text-xs font-normal text-foreground"
                value={tz}
                onChange={(e) => { setTimezone(e.target.value); setTz(e.target.value); }}
              >
                {TIMEZONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          </div>
        </div>
        <main className="mx-auto max-w-[1400px] px-6 py-5">
          <Outlet key={tz} />
        </main>
      </div>
    </div>
  );
}
