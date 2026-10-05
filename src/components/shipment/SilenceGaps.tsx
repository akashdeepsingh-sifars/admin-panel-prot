import { fmtDateTime } from '../../lib/format';
import { DRIVERS } from '../../sampleData';
import { analyzeLoad } from '../../sampleData/analyze';
import type { Load } from '../../types';
import { Button, Card, CardHeader, Table, Td } from '../ui';

// Every silent GPS period for the shipment, explained.
export function SilenceGaps({ load, onFocus }: { load: Load; onFocus: (pingIds: string[]) => void }): JSX.Element {
  const { gaps } = analyzeLoad(load);
  return (
    <Card>
      <CardHeader title="GPS silence gaps" sub="A silence gap is a stretch of 15 minutes or more with no GPS ping while the load was moving. Time parked for a driver change is not counted." />
      {gaps.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">No silence gaps. Pings arrived at least every 15 minutes for the whole shipment.</p>
      ) : (
        <Table head={['Started', 'Ended', 'Length', 'Driver', 'Where', 'Likely cause', 'Last ping battery', '']}>
          {gaps.map((g, i) => (
            <tr key={i}>
              <Td className="whitespace-nowrap">{fmtDateTime(g.startedAt)}</Td>
              <Td className="whitespace-nowrap">{fmtDateTime(g.endedAt)}</Td>
              <Td className="whitespace-nowrap font-semibold">{g.minutes} min</Td>
              <Td className="whitespace-nowrap">{DRIVERS.find((d) => d.id === g.before.driverId)?.name}</Td>
              <Td>{g.spans}</Td>
              <Td>{g.inferredCause}</Td>
              <Td>{g.before.phone.batteryPct}%</Td>
              <Td>
                <Button variant="ghost" onClick={() => onFocus([g.before.id, g.after.id])}>
                  Show on map
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
