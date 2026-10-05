import { RULES } from '../../sampleData';
import type { Finding } from '../../types';
import { Card, CardHeader, Chip } from '../ui';

// Every shipment rule with its plain-language description, and whether it fired for this shipment.
export function RuleReference({ findings }: { findings: Finding[] }): JSX.Element {
  return (
    <Card>
      <CardHeader title="Rule reference" sub="Every rule checked for this shipment, what it means, and when it fires." />
      <ul>
        {RULES.filter((r) => r.scope === 'shipment').map((r) => {
          const hits = findings.filter((f) => f.ruleCode === r.code).length;
          return (
            <li key={r.code} className="border-b border-divider-row px-4 py-3 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-navy-dark">{r.title}</span>
                <code className="bg-muted px-1 text-xs text-muted-foreground">{r.code}</code>
                <span className="ml-auto">{hits > 0 ? <Chip tone="high">{hits} finding{hits > 1 ? 's' : ''}</Chip> : <Chip tone="ok">Passed</Chip>}</span>
              </div>
              <p className="mt-1 text-sm">{r.description}</p>
              {r.threshold && <p className="mt-0.5 text-xs text-muted-foreground">Threshold: {r.threshold}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
