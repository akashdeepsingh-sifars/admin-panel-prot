import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { fmtDateTime } from '../lib/format';
import { ruleInfo } from '../sampleData';
import { CURRENT_USER, useStore } from '../store';
import type { Finding } from '../types';
import { Button, Chip, SeverityBadge, cx } from './ui';

interface Props {
  finding: Finding;
  onFocus?: (finding: Finding) => void;
  to?: string;
  toLabel?: string;
}

export function FindingCard({ finding, onFocus, to, toLabel }: Props): JSX.Element {
  const { review, acknowledge, addComment } = useStore();
  const r = review(finding.id);
  const info = ruleInfo(finding.ruleCode);
  const [open, setOpen] = useState(false);
  const [showComments, setShowComments] = useState(r.comments.length > 0);
  const [draft, setDraft] = useState('');
  const acked = r.acknowledgedBy !== null;

  return (
    <article className={cx('border border-border border-l-4 bg-card shadow-card', finding.severity === 'critical' ? 'border-l-destructive' : finding.severity === 'high' ? 'border-l-warning' : 'border-l-navy')}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <span className="text-sm font-semibold text-navy-dark">{info?.title ?? finding.ruleCode}</span>
            <code className="bg-muted px-1 text-xs text-muted-foreground">{finding.ruleCode}</code>
            {acked && <Chip tone="ok">Acknowledged</Chip>}
          </div>
          <p className="mt-1.5 text-sm">{finding.summary}</p>
          {info && <p className="mt-1 text-xs text-muted-foreground">{info.meaning}{info.threshold ? ` Threshold: ${info.threshold}.` : ''}</p>}
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
          <Button variant={acked ? 'ghost' : 'secondary'} onClick={() => acknowledge(finding.id)}>
            <CheckCircle2 size={14} />
            {acked ? 'Undo' : 'Acknowledge'}
          </Button>
          <Button variant="ghost" onClick={() => setShowComments((s) => !s)}>
            <MessageSquare size={14} />
            {r.comments.length}
          </Button>
        </div>
      </div>

      <div className="border-t border-divider-row px-4 py-1.5">
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-semibold text-navy">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Evidence
        </button>
        {open && (
          <pre className="mt-1 max-h-56 overflow-auto border border-border bg-muted p-2 text-xs">{JSON.stringify(finding.evidence, null, 2)}</pre>
        )}
      </div>

      {acked && (
        <p className="border-t border-divider-row bg-lime-tint px-4 py-1.5 text-xs text-lime-dark">
          Acknowledged by {r.acknowledgedBy} · {fmtDateTime(r.acknowledgedAt)}
        </p>
      )}

      {showComments && (
        <div className="border-t border-divider-row bg-muted px-4 py-3">
          {r.comments.length === 0 && <p className="mb-2 text-xs text-muted-foreground">No comments yet.</p>}
          <ul className="mb-2 space-y-2">
            {r.comments.map((c) => (
              <li key={c.id} className="border border-border bg-card px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.author}</span> · {fmtDateTime(c.at)}
                </div>
                {c.body}
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              addComment(finding.id, draft.trim());
              setDraft('');
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Comment as ${CURRENT_USER}`} className="flex-1 border-[1.5px] border-border-strong bg-card px-2 py-1.5 text-sm placeholder:text-muted-foreground" />
            <Button type="submit" disabled={!draft.trim()}>
              Post
            </Button>
          </form>
        </div>
      )}
    </article>
  );
}
