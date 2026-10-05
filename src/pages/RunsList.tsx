import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Card, Chip, Empty, LinkButton, StatusBadge, Table, Td } from '../components/ui';
import { fmtDateTime, fmtDuration } from '../lib/format';
import { KIND_LABEL, runFindings, runTarget } from '../lib/runs';
import { ruleInfo } from '../sampleData';
import { useStore } from '../store';
import type { Finding, RunKind, RunStatus, Severity } from '../types';
import { PageHeader } from '../components/ui';

const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };
const MAX_CHIPS = 3;

// One chip per rule that fired (named, with a count when it fired more than once), worst first.
function FindingsSummary({ findings }: { findings: Finding[] }): JSX.Element {
  if (findings.length === 0) return <Chip tone="ok">Nothing found</Chip>;
  const byRule = new Map<string, { title: string; count: number; worst: Severity }>();
  for (const f of findings) {
    const cur = byRule.get(f.ruleCode);
    byRule.set(f.ruleCode, {
      title: ruleInfo(f.ruleCode)?.title ?? f.ruleCode,
      count: (cur?.count ?? 0) + 1,
      worst: cur && SEV_RANK[cur.worst] < SEV_RANK[f.severity] ? cur.worst : f.severity,
    });
  }
  const rules = [...byRule.values()].sort((a, b) => SEV_RANK[a.worst] - SEV_RANK[b.worst] || b.count - a.count);
  const label = (r: { title: string; count: number }): string => (r.count > 1 ? `${r.title} ×${r.count}` : r.title);
  const shown = rules.slice(0, MAX_CHIPS);
  const rest = rules.slice(MAX_CHIPS);
  return (
    <div className="flex max-w-md flex-wrap gap-1">
      {shown.map((r) => (
        <Chip key={r.title} tone={r.worst}>
          {label(r)}
        </Chip>
      ))}
      {rest.length > 0 && (
        <span title={rest.map(label).join(', ')}>
          <Chip tone="neutral">+{rest.length} more</Chip>
        </span>
      )}
    </div>
  );
}

const selectCls = 'border-[1.5px] border-border-strong bg-card px-2 py-1.5 text-sm';

export function RunsList(): JSX.Element {
  const { runs, findings } = useStore();
  const [kind, setKind] = useState<RunKind | ''>('');
  const [status, setStatus] = useState<RunStatus | ''>('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [q, setQ] = useState('');

  const rows = useMemo(
    () =>
      runs
        .filter((r) => (!kind || r.kind === kind) && (!status || r.status === status))
        .map((r) => ({ run: r, fs: runFindings(r, findings) }))
        .filter((x) => !severity || x.fs.some((f) => f.severity === severity))
        .filter((x) => {
          if (!q.trim()) return true;
          const needle = q.toLowerCase();
          return (
            x.run.id.toLowerCase().includes(needle) ||
            runTarget(x.run).toLowerCase().includes(needle) ||
            x.fs.some((f) => f.summary.toLowerCase().includes(needle))
          );
        })
        .sort((a, b) => b.run.createdAt.localeCompare(a.run.createdAt)),
    [runs, findings, kind, status, severity, q]
  );

  return (
    <>
      <PageHeader
        title="Diagnosis runs"
        sub="Every diagnosis is a run. A shipment run covers one shipment; API and notification runs cover a time window."
        actions={
          <>
            <LinkButton to="/diagnostics/runs/new">
              <Plus size={16} /> New run
            </LinkButton>
          </>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search run, shipment, finding…" className={`${selectCls} w-72 placeholder:text-muted-foreground`} />
          <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as RunKind | '')}>
            <option value="">All types</option>
            <option value="shipment">Shipment</option>
            <option value="api">API</option>
            <option value="notifications">Notifications</option>
          </select>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as RunStatus | '')}>
            <option value="">All statuses</option>
            {(['queued', 'running', 'completed', 'failed'] as RunStatus[]).map((s) => (
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
          <Table head={['Run', 'Type', 'Target', 'Status', 'Started', 'Duration', 'Findings', 'Created by']}>
            {rows.map(({ run, fs }) => (
              <tr key={run.id} className="hover:bg-navy-tint/50">
                <Td className="whitespace-nowrap">
                  <Link to={`/diagnostics/runs/${run.id}`} className="font-semibold text-navy hover:underline">
                    {run.id}
                  </Link>
                </Td>
                <Td>{KIND_LABEL[run.kind]}</Td>
                <Td className="whitespace-nowrap">
                  {run.kind === 'shipment' ? (
                    <span className="font-semibold">{runTarget(run)}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {fmtDateTime(run.windowStart)} → {fmtDateTime(run.windowEnd)}
                    </span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={run.status} />
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(run.startedAt)}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDuration(run.durationSec)}</Td>
                <Td>{run.status === 'completed' ? <FindingsSummary findings={fs} /> : <span className="text-muted-foreground">—</span>}</Td>
                <Td className="whitespace-nowrap">{run.createdBy}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
