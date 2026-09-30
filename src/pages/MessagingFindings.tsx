import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FindingCard } from '../components/FindingCard';
import { Card, CardHeader, Chip, Empty, PageHeader, Stat, Table, Td } from '../components/ui';
import { fmtDateTime, pct } from '../lib/format';
import { channelLabel } from '../sampleData/reports';
import { useStore } from '../store';
import type { Channel } from '../types';

export function MessagingFindings(): JSX.Element {
  const { runId } = useParams();
  const { findings, reports } = useStore();
  const [channel, setChannel] = useState<Channel | ''>('');
  const report = reports[runId ?? '']?.messaging;
  if (!report) return <Empty title="No notification data" body="This run did not include notifications & email." />;
  const fs = findings.filter((f) => f.runId === runId && f.section === 'messaging');
  const reasons = report.failureReasons.filter((r) => !channel || r.channel === channel);
  const items = report.failedItems.filter((r) => !channel || r.channel === channel);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: runId ?? '', to: `/diagnostics/runs/${runId}` }, { label: 'Notifications & email' }]} title="Notification & email findings" sub="Push, email and in-app delivery health for the run window." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Sent" value={report.totals.sent.toLocaleString()} />
        <Stat label="Delivered" value={pct(report.totals.delivered, report.totals.sent)} tone="ok" />
        <Stat label="Failed" value={report.totals.failed} tone="danger" />
      </div>
      <div className="mb-4 space-y-3">{fs.map((f) => <FindingCard key={f.id} finding={f} />)}</div>

      <div className="mb-3 flex gap-2">
        {(['', 'push', 'email', 'in_app'] as (Channel | '')[]).map((c) => (
          <button key={c || 'all'} onClick={() => setChannel(c)} className={`border-[1.5px] px-3 py-1 text-sm font-semibold ${channel === c ? 'border-navy bg-navy text-white' : 'border-border-strong bg-card'}`}>
            {c ? channelLabel(c) : 'All channels'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="By channel" />
          <Table head={['Channel', 'Sent', 'Delivered', 'Failed', 'Fail rate']}>
            {report.byChannel.filter((c) => !channel || c.channel === channel).map((c) => (
              <tr key={c.channel}>
                <Td className="font-semibold">{channelLabel(c.channel)}</Td>
                <Td>{c.sent.toLocaleString()}</Td>
                <Td>{c.delivered.toLocaleString()}</Td>
                <Td>{c.failed}</Td>
                <Td><Chip tone={c.failed / c.sent > 0.1 ? 'critical' : 'ok'}>{pct(c.failed, c.sent)}</Chip></Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card>
          <CardHeader title="Why they failed" />
          <Table head={['Channel', 'Reason', 'Count']}>
            {reasons.map((r) => (
              <tr key={r.channel + r.reason}>
                <Td>{channelLabel(r.channel)}</Td>
                <Td>{r.reason}</Td>
                <Td className="font-semibold">{r.count}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Failed items" sub="Recipients are masked." />
        <Table head={['Time', 'Channel', 'Recipient', 'Kind', 'Related load', 'Reason', 'Provider response']}>
          {items.map((i) => (
            <tr key={i.id}>
              <Td className="whitespace-nowrap">{fmtDateTime(i.at)}</Td>
              <Td>{channelLabel(i.channel)}</Td>
              <Td>{i.recipient}</Td>
              <Td><code className="text-xs">{i.kind}</code></Td>
              <Td>{i.loadId ? <Link to={`/diagnostics/runs/${runId}/shipments/${i.loadId}`} className="font-semibold text-navy hover:underline">{i.loadId === 'L3' ? 'FF-10260' : i.loadId}</Link> : '—'}</Td>
              <Td>{i.reason}</Td>
              <Td><code className="text-xs">{i.providerResponse}</code></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
