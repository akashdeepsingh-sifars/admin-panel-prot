import { useRef, useState } from 'react';

// Short id in the table; hovering shows the full id in a box that stays open so it can be selected or copied.
export function ShortId({ id }: { id: string }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const open = (): void => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom - 2, left: r.left });
  };
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the id is still selectable in the box.
    }
  };

  return (
    <span ref={ref} onMouseEnter={open} onMouseLeave={() => setPos(null)} onClick={(e) => e.stopPropagation()} className="inline-block">
      <span className="cursor-default">{id.slice(0, 5)}…</span>
      {pos && (
        <span style={{ top: pos.top, left: pos.left }} className="fixed z-[1000] flex items-center gap-2 border border-border-strong bg-card px-2 py-1.5 shadow-card-md">
          <span className="select-all font-mono text-xs text-foreground">{id}</span>
          <button type="button" onClick={copy} className="border border-border-strong bg-navy-tint px-2 py-0.5 text-xs font-semibold text-navy-dark hover:bg-navy hover:text-white">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      )}
    </span>
  );
}
