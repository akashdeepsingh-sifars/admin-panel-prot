import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button, Card, Empty, LinkButton, PageHeader, ScopeBadge, Table, Td } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { useStore } from '../store';
import type { Frequency } from '../types';
import { SCOPE_LABEL } from '../components/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function describeFrequency(f: Frequency): string {
  switch (f.kind) {
    case 'once':
      return `Once, ${fmtDateTime(f.runAt)}`;
    case 'hourly':
      return 'Every hour';
    case 'daily':
      return `Every day at ${f.timeOfDay}`;
    case 'weekly':
      return `Every ${f.daysOfWeek.map((d) => DAYS[d]).join(', ')} at ${f.timeOfDay}`;
  }
}

export function Schedules(): JSX.Element {
  const { schedules, toggleSchedule, deleteSchedule } = useStore();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: 'Schedules' }]}
        title="Schedules"
        sub="Each schedule creates normal runs, tagged Scheduled, in the runs list."
        actions={<LinkButton to="/diagnostics/runs/new">New run / schedule</LinkButton>}
      />
      <Card>
        {schedules.length === 0 ? (
          <Empty title="No schedules" body="Create a run and choose “Schedule” to have it repeat." />
        ) : (
          <Table head={['Name', 'Scope', 'Window', 'Frequency', 'Next run', 'Last run', 'Enabled', '']}>
            {schedules.map((s) => (
              <tr key={s.id}>
                <Td className="font-semibold">{s.name}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {s.scopes.map((sc) => (
                      <ScopeBadge key={sc} label={s.targets.find((t) => t.scope === sc)?.label ?? SCOPE_LABEL[sc]} />
                    ))}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{s.windowLabel}</Td>
                <Td className="whitespace-nowrap">
                  {describeFrequency(s.frequency)}
                  <div className="text-xs text-muted-foreground">{s.timezone}</div>
                </Td>
                <Td className="whitespace-nowrap">{s.enabled ? fmtDateTime(s.nextRunAt) : <span className="text-muted-foreground">Paused</span>}</Td>
                <Td className="whitespace-nowrap">
                  {s.lastRunId ? (
                    <Link to={`/diagnostics/runs/${s.lastRunId}`} className="font-semibold text-navy hover:underline">
                      {s.lastRunId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                  {s.lastRunAt && <div className="text-xs text-muted-foreground">{fmtDateTime(s.lastRunAt)}</div>}
                </Td>
                <Td>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={s.enabled} onChange={() => toggleSchedule(s.id)} className="h-4 w-4 accent-navy" />
                    <span className="text-xs">{s.enabled ? 'On' : 'Off'}</span>
                  </label>
                </Td>
                <Td>
                  <Button variant="ghost" onClick={() => deleteSchedule(s.id)} aria-label={`Delete ${s.name}`}>
                    <Trash2 size={14} />
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
