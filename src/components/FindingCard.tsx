import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { fmtDateTime } from '../lib/format';
import { ruleInfo } from '../sampleData';
import type { Finding } from '../types';
import { Button, SeverityBadge, cx } from './ui';

interface Props {
  finding: Finding;
  onFocus?: (finding: Finding) => void;
  to?: string;
  toLabel?: string;
}

export function FindingCard({ finding, onFocus, to, toLabel }: Props): JSX.Element {
  const info = ruleInfo(finding.ruleCode);
  const [open, setOpen] = useState(false);

  return (
    <article className={cx('border border-border border-l-4 bg-card shadow-card', finding.severity === 'critical' ? 'border-l-destructive' : finding.severity === 'high' ? 'border-l-warning' : 'border-l-navy')}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <span className="text-sm font-semibold text-navy-dark">{info?.title ?? finding.ruleCode}</span>
            <code className="bg-muted px-1 text-xs text-muted-foreground">{finding.ruleCode}</code>
          </div>
          <p className="mt-1.5 text-sm">{finding.summary}</p>
          {info && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-semibold">What this rule means: </span>
              {info.description}
              {info.threshold ? ` Threshold: ${info.threshold}.` : ''}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Detected {fmtDateTime(finding.detectedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onFocus && (finding.pingIds.length > 0 || finding.photoIds.length > 0) && (
            <Button variant="secondary" onClick={() => onFocus(finding)}>
              Show on map
            </Button>
          )}
          {to && (
            <Link to={to} className="text-sm font-semibold text-navy hover:underline">
              {toLabel ?? 'Open'} →
            </Link>
          )}
        </div>
      </div>

      <div className="border-t border-divider-row px-4 py-1.5">
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-semibold text-navy">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Evidence
        </button>
        {open && <pre className="mt-1 max-h-56 overflow-auto border border-border bg-muted p-2 text-xs">{JSON.stringify(finding.evidence, null, 2)}</pre>}
      </div>
    </article>
  );
}
