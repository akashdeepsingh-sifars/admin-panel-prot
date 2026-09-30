import { Link, useParams } from 'react-router-dom';
import { FindingCard } from '../components/FindingCard';
import { Card, CardHeader, Empty, PageHeader, Table, Td } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { DRIVERS, LOADS } from '../sampleData';
import { useStore } from '../store';

export function GpsFindings(): JSX.Element {
  const { runId } = useParams();
  const { findings, reports } = useStore();
  const report = reports[runId ?? '']?.gps;
  if (!report) return <Empty title="No GPS data" body="This run did not include GPS fleet health." />;
  const fs = findings.filter((f) => f.runId === runId && f.section === 'gps');
  return (
    <>
      <PageHeader crumbs={[{ label: 'Runs', to: '/diagnostics/runs' }, { label: runId ?? '', to: `/diagnostics/runs/${runId}` }, { label: 'GPS findings' }]} title="GPS findings" sub="Fleet-level GPS health: drivers whose sampling interval drifted from what is expected." />
      <div className="mb-4 space-y-3">{fs.map((f) => <FindingCard key={f.id} finding={f} />)}</div>
      <Card>
        <CardHeader title="Sampling drift by driver" />
        <Table head={['Driver', 'Device', 'Expected', 'Actual', 'Affected period', 'Loads']}>
          {report.drift.map((d) => (
            <tr key={d.driverId}>
              <Td className="font-semibold">{DRIVERS.find((x) => x.id === d.driverId)?.name}</Td>
              <Td>{d.device}</Td>
              <Td>{d.expectedIntervalS}s</Td>
              <Td className="font-semibold text-destructive-ink">{d.actualIntervalS}s</Td>
              <Td className="whitespace-nowrap">{fmtDateTime(d.affectedFrom)} → {fmtDateTime(d.affectedTo)}</Td>
              <Td>
                {d.loadIds.map((id) => (
                  <Link key={id} to={`/diagnostics/runs/${runId}/shipments/${id}`} className="mr-2 font-semibold text-navy hover:underline">
                    {LOADS.find((l) => l.id === id)?.number}
                  </Link>
                ))}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
