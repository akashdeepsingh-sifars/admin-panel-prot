import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Plus } from 'lucide-react';
import { Card, Empty, LinkButton, ScopeBadge, SeverityMini, StatusBadge, Table, Td, TriggerBadge } from '../components/ui';
import { fmtDateTime, fmtDuration } from '../lib/format';
import { runFindings, scopeLabels, severityCounts } from '../lib/runs';
import { useStore } from '../store';
import type { RunScope, RunStatus, RunTrigger, Severity } from '../types';
import { PageHeader } from '../components/ui';

const selectCls = 'border-[1.5px] border-border-strong bg-card px-2 py-1.5 text-sm';

export function RunsList(): JSX.Element {
  const { runs, findings } = useStore();
  const [trigger, setTrigger] = useState<RunTrigger | ''>('');
  const [scope, setScope] = useState<RunScope | ''>('');
  const [status, setStatus] = useState<RunStatus | ''>('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [q, setQ] = useState('');

  const rows = useMemo(
    () =>
      runs
        .filter((r) => (!trigger || r.trigger === trigger) && (!scope || r.scopes.includes(scope)) && (!status || r.status === status))
        .map((r) => ({ run: r, fs: runFindings(r, findings) }))
        .filter((x) => !severity || x.fs.some((f) => f.severity === severity))
        .filter((x) => {
          if (!q.trim()) return true;
          const needle = q.toLowerCase();
          return (
            x.run.id.toLowerCase().includes(needle) ||
            x.run.targets.some((t) => t.label.toLowerCase().includes(needle)) ||
            x.fs.some((f) => f.summary.toLowerCase().includes(needle))
          );
        })
        .sort((a, b) => b.run.createdAt.localeCompare(a.run.createdAt)),
    [runs, findings, trigger, scope, status, severity, q]
  );

  return (
    <>
      <PageHeader
        title="Diagnosis runs"
        sub="Every diagnosis is a run. Open one to see only what that run found."
        actions={
          <>
            <LinkButton to="/diagnostics/schedules" variant="secondary">
              <CalendarClock size={16} /> Schedules
            </LinkButton>
            <LinkButton to="/diagnostics/runs/new">
              <Plus size={16} /> New run
            </LinkButton>
          </>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search run, load, driver, finding…" className={`${selectCls} w-72 placeholder:text-muted-foreground`} />
          <select className={selectCls} value={trigger} onChange={(e) => setTrigger(e.target.value as RunTrigger | '')}>
            <option value="">All triggers</option>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
          </select>
          <select className={selectCls} value={scope} onChange={(e) => setScope(e.target.value as RunScope | '')}>
            <option value="">All scopes</option>
            <option value="shipments">Shipments</option>
            <option value="driver">Driver</option>
            <option value="api">API</option>
            <option value="gps">GPS</option>
            <option value="notifications">Notifications</option>
          </select>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as RunStatus | '')}>
            <option value="">All statuses</option>
            {(['scheduled', 'queued', 'running', 'completed', 'failed'] as RunStatus[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className={selectCls} value={severity} onChange={(e) => setSeverity(e.target.value as Severity | '')}>
            <option value="">Any severity</option>
            <option value="critical">Has critical</option>
            <option value="high">Has high</option>
            <option value="medium">Has medium</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty title="No runs match" body="A run is one diagnosis over a chosen scope and time window. Adjust the filters, or start a new run." action={<LinkButton to="/diagnostics/runs/new">Start a run</LinkButton>} />
        ) : (
          <Table head={['Run', 'Trigger', 'Scope', 'Status', 'Started', 'Duration', 'Findings', 'Created by']}>
            {rows.map(({ run, fs }) => (
              <tr key={run.id} className="hover:bg-navy-tint/50">
                <Td>
                  <Link to={`/diagnostics/runs/${run.id}`} className="font-semibold text-navy hover:underline">
                    {run.id}
                  </Link>
                </Td>
                <Td>
                  <TriggerBadge trigger={run.trigger} />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {scopeLabels(run).map((l) => (
                      <ScopeBadge key={l} label={l} />
                    ))}
                  </div>
                </Td>
                <Td>
                  <StatusBadge status={run.status} />
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(run.startedAt)}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDuration(run.durationSec)}</Td>
                <Td>{run.status === 'completed' ? <SeverityMini counts={severityCounts(fs)} /> : <span className="text-muted-foreground">—</span>}</Td>
                <Td className="whitespace-nowrap">{run.createdBy}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
