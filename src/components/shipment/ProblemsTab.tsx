import { analyzeLoad } from '../../sampleData/analyze';
import { fmtDateTime, minutesBetween } from '../../lib/format';
import type { Load } from '../../types';
import { Card, CardHeader, Chip, Empty, KV, Table, Td } from '../ui';

export function ProblemsTab({ load }: { load: Load }): JSX.Element {
  const a = analyzeLoad(load);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Reported problems & incidents" />
        {load.problems.length === 0 ? (
          <Empty title="No problems reported" body="The driver reported no incidents on this load." />
        ) : (
          <div className="space-y-4 p-4">
            {load.problems.map((p) => {
              const before = [...load.pings].reverse().find((x) => x.recordedAt <= p.reportedAt);
              const after = load.pings.find((x) => x.recordedAt > p.reportedAt);
              const gapAfter = after && before ? minutesBetween(before.recordedAt, after.recordedAt) : null;
              const brk = load.breaks.find((b) => b.startedAt >= p.reportedAt && minutesBetween(p.reportedAt, b.startedAt) < 5);
              const gapNear = a.gaps.find((g) => Math.abs(minutesBetween(g.before.recordedAt, p.reportedAt)) < 90);
              return (
                <div key={p.id} className="border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold capitalize">{p.type.replace('_', ' ')}</span>
                    <Chip tone={p.status === 'open' ? 'critical' : 'ok'}>{p.status}</Chip>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(p.reportedAt)} · reported by {p.reporter}</span>
                  </div>
                  <p className="mb-3 text-sm">{p.note}</p>
                  <div className="bg-muted px-3 py-1">
                    <div className="py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inferred signals</div>
                    <KV k="Last GPS ping before report">{before ? fmtDateTime(before.recordedAt) : '—'}</KV>
                    <KV k="Next GPS ping after report">{after ? fmtDateTime(after.recordedAt) : <span className="font-semibold text-destructive-ink">None: GPS ends here</span>}</KV>
                    <KV k="Silence spanning the report">{gapAfter !== null && gapAfter >= 5 ? `${Math.round(gapAfter)} min` : 'No'}</KV>
                    <KV k="Break started">{brk ? `${fmtDateTime(brk.startedAt)} (${Math.round(minutesBetween(brk.startedAt, brk.endedAt))} min)` : 'No break logged'}</KV>
                    <KV k="GPS gap within 90 min">{gapNear ? `${gapNear.minutes} min gap (${gapNear.inferredCause})` : 'None'}</KV>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Breaks & stops" />
        {load.breaks.length === 0 ? (
          <Empty title="No breaks" body="No breaks or unplanned stops were logged." />
        ) : (
          <Table head={['Started', 'Ended', 'Duration', 'Location']}>
            {load.breaks.map((b) => (
              <tr key={b.id}>
                <Td>{fmtDateTime(b.startedAt)}</Td>
                <Td>{fmtDateTime(b.endedAt)}</Td>
                <Td>{Math.round(minutesBetween(b.startedAt, b.endedAt))} min</Td>
                <Td>{b.location.lat.toFixed(4)}, {b.location.lng.toFixed(4)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
