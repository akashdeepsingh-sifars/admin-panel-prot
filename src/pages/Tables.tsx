import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { WriteModeBar } from '../components/WriteMode';
import { Button, Card, CardHeader, Chip, Empty, PageHeader, Table, Td } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { useStore } from '../store';
import type { AuditEntry, CellValue, DbColumn, DbRow } from '../types';

const PAGE = 25;
const inputCls = 'border-[1.5px] border-border-strong bg-card px-2 py-1.5 text-sm';

function AuditLog({ entries }: { entries: AuditEntry[] }): JSX.Element {
  return (
    <Card className="mt-4">
      <CardHeader title="Audit log" sub="Changes made in this session (prototype: cleared on reload)." />
      {entries.length === 0 ? (
        <Empty title="No changes yet" body="Write-mode changes and mode switches are listed here." />
      ) : (
        <Table head={['When', 'User', 'Action', 'Table', 'Row', 'Detail']}>
          {entries.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap">{fmtDateTime(e.at)}</Td>
              <Td>{e.user}</Td>
              <Td><Chip tone={e.action === 'delete' ? 'critical' : e.action === 'update' ? 'high' : 'neutral'}>{e.action.replace(/_/g, ' ')}</Chip></Td>
              <Td>{e.table}</Td>
              <Td><code className="text-xs">{e.rowId}</code></Td>
              <Td className="max-w-md break-words">{e.detail}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

export function TablesList(): JSX.Element {
  const { tables, audit } = useStore();
  const [q, setQ] = useState('');
  const rows = tables.filter((t) => t.name.includes(q.toLowerCase()) || t.description.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Tables" sub="Every database table, browsable. Read-only until you turn on write mode." />
      <WriteModeBar />
      <Card>
        <div className="border-b border-border px-4 py-3">
          <input className={`${inputCls} w-72 placeholder:text-muted-foreground`} placeholder="Find a table…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Table head={['Table', 'Description', 'Columns', 'Rows']}>
          {rows.map((t) => (
            <tr key={t.name} className="hover:bg-navy-tint/50">
              <Td><Link to={`/tables/${t.name}`} className="font-semibold text-navy hover:underline">{t.name}</Link></Td>
              <Td className="text-muted-foreground">{t.description}</Td>
              <Td>{t.columns.length}</Td>
              <Td>{t.rows.length.toLocaleString()}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <AuditLog entries={audit} />
    </>
  );
}

function Cell({ row, column, tableName }: { row: DbRow; column: DbColumn; tableName: string }): JSX.Element {
  const { writeMode, updateCell } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const value = row[column.name];

  if (column.sensitive) return <span className="text-muted-foreground">•••••• hidden</span>;
  const show = value === null ? <span className="text-muted-foreground">null</span> : typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
  const editable = writeMode && !column.locked;

  const commit = (): void => {
    setEditing(false);
    const raw = draft.trim();
    let next: CellValue = raw;
    if (raw === '' || raw === 'null') next = null;
    else if (column.type === 'int' || column.type === 'numeric') next = Number.isNaN(Number(raw)) ? value : Number(raw);
    else if (column.type === 'bool') next = raw === 'true';
    if (next !== value) updateCell(tableName, String(row.id), column.name, next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-full min-w-[8rem] border-[1.5px] border-navy bg-card px-1 py-0.5 text-sm"
      />
    );
  }
  return editable ? (
    <button
      className="w-full text-left hover:bg-warning-tint"
      title="Click to edit"
      onClick={() => {
        setDraft(value === null ? '' : String(value));
        setEditing(true);
      }}
    >
      {show}
    </button>
  ) : (
    <span>{show}</span>
  );
}

export function TableView(): JSX.Element {
  const { name } = useParams();
  const { tables, audit, writeMode, deleteRow } = useStore();
  const table = tables.find((t) => t.name === name);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!table) return [];
    const needle = q.toLowerCase();
    return needle ? table.rows.filter((r) => table.columns.some((c) => !c.sensitive && String(r[c.name] ?? '').toLowerCase().includes(needle))) : table.rows;
  }, [table, q]);

  if (!table) return <Empty title="Table not found" body="This table does not exist in the sample data." />;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Tables', to: '/tables' }, { label: table.name }]} title={table.name} sub={`${table.description} · ${table.rows.length.toLocaleString()} rows`} />
      <WriteModeBar />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <input className={`${inputCls} w-72 placeholder:text-muted-foreground`} placeholder="Search rows…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <span className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString()} rows{writeMode ? ' · click a cell to edit (Enter saves, Esc cancels). id and created_at are locked.' : ''}
          </span>
          <span className="ml-auto inline-flex items-center gap-2 text-sm">
            <Button variant="secondary" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Prev</Button>
            <span>{cur + 1} / {pages}</span>
            <Button variant="secondary" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
          </span>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <Table head={[...(writeMode ? [''] : []), ...table.columns.map((c) => `${c.name} · ${c.type}`)]}>
            {slice.map((r) => (
              <tr key={String(r.id)} className="hover:bg-navy-tint/40">
                {writeMode && (
                  <Td>
                    {pendingDelete === r.id ? (
                      <span className="inline-flex gap-1">
                        <Button variant="secondary" onClick={() => { deleteRow(table.name, String(r.id)); setPendingDelete(null); }}>Confirm</Button>
                        <Button variant="ghost" onClick={() => setPendingDelete(null)}>No</Button>
                      </span>
                    ) : (
                      <Button variant="ghost" aria-label={`Delete row ${String(r.id)}`} onClick={() => setPendingDelete(String(r.id))}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </Td>
                )}
                {table.columns.map((c) => (
                  <Td key={c.name} className="max-w-xs whitespace-nowrap overflow-hidden text-ellipsis">
                    <Cell row={r} column={c} tableName={table.name} />
                  </Td>
                ))}
              </tr>
            ))}
          </Table>
        </div>
      </Card>
      <AuditLog entries={audit.filter((a) => a.table === table.name)} />
    </>
  );
}
