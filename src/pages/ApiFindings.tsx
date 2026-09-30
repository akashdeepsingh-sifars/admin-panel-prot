import { useParams } from 'react-router-dom';
import { FindingCard } from '../components/FindingCard';
import { Card, CardHeader, Chip, Empty, PageHeader, Stat, Table, Td } from '../components/ui';
import { fmtDateTime, pct } from '../lib/format';
import { useStore } from '../store';

function Bars({ rows, color = 'bg-navy' }: { rows: { label: string; value: number; sub?: number }[]; color?: string }): JSX.Element {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-1.5 p-4">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between"><span>{r.label}</span><span className="font-medium">{r.value.toLocaleString()}</span></div>
          <div className="h-2 bg-muted"><div className={`h-2 ${color}`} style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function ApiFindings(): JSX.Element {
  const { runId } = useParams();
  const { findings, reports } = useStore();
  const report = reports[runId ?? '']?.api;
  if (!report) return <Empty title="No API data" body="This run did not include API health." />;
  const t = report.totals;
  const maxSeries = Math.max(...report.series.map((s) => s.requests));
  const fs = findings.filter((f) => f.runId === runId && f.section === 'api');

  return (
    <>
      <PageHeader crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: runId ?? '', to: `/diagnostics/runs/${runId}` }, { label: 'API findings' }]} title="API findings" sub="Request health for the run window (snapshot, not live)." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Requests" value={t.requests.toLocaleString()} />
        <Stat label="Success rate" value={pct(t.success, t.requests)} tone="ok" />
        <Stat label="4xx" value={t.clientErrors.toLocaleString()} tone="warn" />
        <Stat label="5xx" value={t.serverErrors.toLocaleString()} tone="danger" />
        <Stat label="Rate limited" value={report.rateLimited.length} />
      </div>
      <div className="mb-4 space-y-3">{fs.map((f) => <FindingCard key={f.id} finding={f} />)}</div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Requests vs failures over time" />
          <div className="flex h-40 items-end gap-1.5 p-4">
            {report.series.map((s) => (
              <div key={s.label} className="flex flex-1 flex-col items-center justify-end" title={`${s.label}: ${s.requests} requests, ${s.failures} failed`}>
                <div className="flex w-full flex-col justify-end" style={{ height: '100px' }}>
                  <div className="w-full bg-destructive" style={{ height: `${(s.failures / maxSeries) * 100}%` }} />
                  <div className="w-full bg-navy" style={{ height: `${((s.requests - s.failures) / maxSeries) * 100}%` }} />
                </div>
                <span className="mt-1 text-[10px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="px-4 pb-3 text-xs text-muted-foreground"><span className="inline-block h-2 w-2 bg-navy" /> ok &nbsp; <span className="inline-block h-2 w-2 bg-destructive" /> failed</p>
        </Card>
        <Card><CardHeader title="Failures by status code" /><Bars rows={report.byStatus.filter((s) => s.status >= 400).map((s) => ({ label: String(s.status), value: s.count }))} color="bg-warning" /></Card>
        <Card><CardHeader title="Failures by error type" /><Bars rows={report.byErrorType.map((e) => ({ label: e.type, value: e.count }))} color="bg-destructive" /></Card>
        <Card>
          <CardHeader title="Top failing routes" />
          <Table head={['Route', 'Requests', 'Failures', 'Fail rate']}>
            {[...report.byRoute].sort((a, b) => b.failures - a.failures).map((r) => (
              <tr key={r.route + r.method}>
                <Td><Chip tone="neutral">{r.method}</Chip> <code className="text-xs">{r.route}</code></Td>
                <Td>{r.requests.toLocaleString()}</Td>
                <Td>{r.failures.toLocaleString()}</Td>
                <Td>{pct(r.failures, r.requests)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Unhandled errors" sub="Errors no handler caught." />
        <Table head={['Route', 'Error', 'Where', 'Count', 'First seen', 'Last seen']}>
          {report.unhandledErrors.map((e) => (
            <tr key={e.id}>
              <Td><Chip tone="neutral">{e.method}</Chip> <code className="text-xs">{e.route}</code></Td>
              <Td className="max-w-sm">{e.message}</Td>
              <Td><code className="text-xs">{e.stackSummary}</code></Td>
              <Td className="font-semibold">{e.count}</Td>
              <Td className="whitespace-nowrap">{fmtDateTime(e.firstSeen)}</Td>
              <Td className="whitespace-nowrap">{fmtDateTime(e.lastSeen)}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Rate limiting" sub="Payloads have PII redacted. Tokens, passwords and OTPs are never stored." />
        <Table head={['Time', 'IP', 'Device', 'User', 'Request', 'Payload', 'Limit hit']}>
          {report.rateLimited.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap">{fmtDateTime(e.at)}</Td>
              <Td><code className="text-xs">{e.ip}</code></Td>
              <Td>{e.device}<div className="text-xs text-muted-foreground">{e.userAgent}</div></Td>
              <Td>{e.user}</Td>
              <Td><Chip tone="neutral">{e.method}</Chip> <code className="text-xs">{e.route}</code></Td>
              <Td>
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-navy">View</summary>
                  <pre className="mt-1 max-w-xs overflow-auto border border-border bg-muted p-2 text-xs">{JSON.stringify(e.payload, null, 2)}</pre>
                </details>
              </Td>
              <Td>{e.limit}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card className="mt-4"><CardHeader title="Top offending IPs" /><Bars rows={report.topIps.map((i) => ({ label: i.ip, value: i.count }))} /></Card>
    </>
  );
}
