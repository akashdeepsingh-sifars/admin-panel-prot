import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Empty, PageHeader, Table, Td } from '../components/ui';
import { ShortId } from '../components/ShortId';
import { UUID_RE } from '../lib/ids';
import { useStore } from '../store';

const PAGE = 25;
const inputCls = 'border-[1.5px] border-border-strong bg-card px-2 py-1.5 text-sm';

export function TablesList(): JSX.Element {
  const { tables } = useStore();
  const [q, setQ] = useState('');
  const rows = tables.filter((t) => t.name.includes(q.toLowerCase()) || t.description.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Tables" sub="Every database table, browsable. Read-only." />
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
    </>
  );
}

export function TableView(): JSX.Element {
  const { name } = useParams();
  const { tables } = useStore();
  const table = tables.find((t) => t.name === name);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

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
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <input className={`${inputCls} w-72 placeholder:text-muted-foreground`} placeholder="Search rows…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <span className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString()} rows
          </span>
          <span className="ml-auto inline-flex items-center gap-2 text-sm">
            <Button variant="secondary" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Prev</Button>
            <span>{cur + 1} / {pages}</span>
            <Button variant="secondary" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
          </span>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <Table head={table.columns.map((c) => `${c.name} · ${c.type}`)}>
            {slice.map((r) => (
              <tr key={String(r.id)} className="hover:bg-navy-tint/40">
                {table.columns.map((c) => (
                  <Td key={c.name} className="max-w-xs whitespace-nowrap overflow-hidden text-ellipsis">
                    {c.sensitive ? <span className="text-muted-foreground">•••••• hidden</span> : (c.name === 'id' || c.name.endsWith('_id')) && typeof r[c.name] === 'string' && UUID_RE.test(String(r[c.name])) ? <span className="font-mono text-xs"><ShortId id={String(r[c.name])} /></span> : r[c.name] === null ? <span className="text-muted-foreground">null</span> : typeof r[c.name] === 'boolean' ? (r[c.name] ? 'true' : 'false') : String(r[c.name])}
                  </Td>
                ))}
              </tr>
            ))}
          </Table>
        </div>
      </Card>
    </>
  );
}
