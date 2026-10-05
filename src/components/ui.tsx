import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { RunStatus, Severity } from '../types';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const SEV: Record<Severity, string> = {
  critical: 'bg-destructive-tint text-destructive-ink border-destructive',
  high: 'bg-warning-tint text-warning-ink border-warning',
  medium: 'bg-navy-tint text-navy-dark border-navy',
};

export function SeverityBadge({ severity }: { severity: Severity }): JSX.Element {
  return <span className={cx('inline-block border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide', SEV[severity])}>{severity}</span>;
}

export function SeverityMini({ counts }: { counts: Record<Severity, number> }): JSX.Element {
  const total = counts.critical + counts.high + counts.medium;
  if (total === 0) return <span className="text-muted-foreground">0</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold">{total}</span>
      {(['critical', 'high', 'medium'] as Severity[]).map((s) =>
        counts[s] > 0 ? (
          <span key={s} className={cx('border px-1 text-xs font-semibold', SEV[s])} title={s}>
            {counts[s]}
          </span>
        ) : null
      )}
    </span>
  );
}

const STATUS: Record<RunStatus, string> = {
  queued: 'bg-muted text-muted-foreground border-border-strong',
  running: 'bg-warning-tint text-warning-ink border-warning',
  completed: 'bg-lime-tint text-lime-dark border-lime-dark',
  failed: 'bg-destructive-tint text-destructive-ink border-destructive',
  cancelled: 'bg-muted text-muted-foreground border-border-strong',
};

export function StatusBadge({ status }: { status: RunStatus }): JSX.Element {
  return <span className={cx('inline-block border px-1.5 py-0.5 text-xs font-semibold capitalize', STATUS[status])}>{status}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <section className={cx('border border-border bg-card shadow-card', className)}>{children}</section>;
}

export function CardHeader({ title, right, sub }: { title: ReactNode; right?: ReactNode; sub?: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-navy-dark">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'danger' | 'ok' | 'warn' }): JSX.Element {
  const border = tone === 'danger' ? 'border-l-destructive' : tone === 'ok' ? 'border-l-lime-dark' : tone === 'warn' ? 'border-l-warning' : 'border-l-navy';
  return (
    <div className={cx('border border-border border-l-4 bg-card px-3 py-2 shadow-card', border)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function PageHeader({ title, sub, actions, crumbs }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; crumbs?: { label: string; to?: string }[] }): JSX.Element {
  return (
    <div className="mb-4">
      {crumbs && (
        <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={c.label} className="inline-flex items-center gap-1">
              {c.to ? (
                <Link to={c.to} className="font-medium text-navy hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
              {i < crumbs.length - 1 && <ChevronRight size={12} />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-dark">{title}</h1>
          {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Button({ children, variant = 'primary', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }): JSX.Element {
  const styles = {
    primary: 'bg-navy text-white hover:bg-navy-dark border-navy',
    secondary: 'bg-card text-navy-dark border-border-strong hover:bg-navy-tint',
    ghost: 'bg-transparent text-navy border-transparent hover:bg-navy-tint',
  }[variant];
  return (
    <button {...rest} className={cx('inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground', styles, rest.className)}>
      {children}
    </button>
  );
}

export function LinkButton({ to, children, variant = 'primary' }: { to: string; children: ReactNode; variant?: 'primary' | 'secondary' }): JSX.Element {
  const styles = variant === 'primary' ? 'bg-navy text-white hover:bg-navy-dark border-navy' : 'bg-card text-navy-dark border-border-strong hover:bg-navy-tint';
  return (
    <Link to={to} className={cx('inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-semibold', styles)}>
      {children}
    </Link>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-border-strong bg-navy-tint">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-navy-dark">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }): JSX.Element => (
  <td className={cx('border-b border-divider-row px-3 py-2 align-top', className)}>{children}</td>
);

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }): JSX.Element {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm font-semibold text-navy-dark">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Chip({ children, tone = 'medium' }: { children: ReactNode; tone?: Severity | 'neutral' | 'ok' }): JSX.Element {
  const style = tone === 'neutral' ? 'border-border-strong bg-muted' : tone === 'ok' ? 'border-lime-dark bg-lime-tint text-lime-dark' : SEV[tone];
  return <span className={cx('inline-block border px-2 py-0.5 text-xs font-medium', style)}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }): JSX.Element {
  return (
    <div className="mb-4 flex flex-wrap border-b-2 border-border-strong">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx('-mb-0.5 border-b-4 px-4 py-2 text-sm font-semibold', value === t.id ? 'border-navy text-navy-dark' : 'border-transparent text-muted-foreground hover:text-navy-dark')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 bg-navy-tint px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KV({ k, children }: { k: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex justify-between gap-4 border-b border-divider-row py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
