import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DB_TABLES, FINDINGS, generateResult, NOW, RUN_REPORTS, RUNS, SCHEDULES, SEED_REVIEWS } from './sampleData';
import type { AuditEntry, CellValue, DbTable, DiagnosisRun, Finding, FindingReview, RunReports, Schedule } from './types';

export const CURRENT_USER = 'Bharat Shah';

interface Store {
  runs: DiagnosisRun[];
  schedules: Schedule[];
  findings: Finding[];
  reports: Record<string, RunReports>;
  review: (findingId: string) => FindingReview;
  acknowledge: (findingId: string) => void;
  addComment: (findingId: string, body: string) => void;
  addRun: (run: DiagnosisRun) => void;
  addSchedule: (schedule: Schedule) => void;
  toggleSchedule: (id: string) => void;
  deleteSchedule: (id: string) => void;
  tables: DbTable[];
  audit: AuditEntry[];
  writeMode: boolean;
  setWriteMode: (on: boolean) => void;
  updateCell: (table: string, rowId: string, column: string, value: CellValue) => void;
  deleteRow: (table: string, rowId: string) => void;
}

const EMPTY: FindingReview = { acknowledgedBy: null, acknowledgedAt: null, comments: [] };
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [runs, setRuns] = useState<DiagnosisRun[]>(RUNS);
  const [schedules, setSchedules] = useState<Schedule[]>(SCHEDULES);
  const [findings, setFindings] = useState<Finding[]>(FINDINGS);
  const [reports, setReports] = useState<Record<string, RunReports>>(RUN_REPORTS);
  const [tables, setTables] = useState<DbTable[]>(DB_TABLES);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [writeMode, setWriteModeState] = useState(false);
  const [reviews, setReviews] = useState<Record<string, FindingReview>>(SEED_REVIEWS);

  const review = useCallback((id: string): FindingReview => reviews[id] ?? EMPTY, [reviews]);

  const acknowledge = useCallback((id: string): void => {
    setReviews((prev) => {
      const cur = prev[id] ?? EMPTY;
      const acked = cur.acknowledgedBy !== null;
      return {
        ...prev,
        [id]: acked
          ? { ...cur, acknowledgedBy: null, acknowledgedAt: null }
          : { ...cur, acknowledgedBy: CURRENT_USER, acknowledgedAt: NOW },
      };
    });
  }, []);

  const addComment = useCallback((id: string, body: string): void => {
    setReviews((prev) => {
      const cur = prev[id] ?? EMPTY;
      const comment = { id: `c-${Date.now()}`, author: CURRENT_USER, body, at: new Date().toISOString() };
      return { ...prev, [id]: { ...cur, comments: [...cur.comments, comment] } };
    });
  }, []);

  const log = useCallback((e: Omit<AuditEntry, 'id' | 'at' | 'user'>): void => {
    setAudit((a) => [{ ...e, id: `a-${Date.now()}-${a.length}`, at: new Date().toISOString(), user: CURRENT_USER }, ...a]);
  }, []);

  const setWriteMode = useCallback(
    (on: boolean): void => {
      setWriteModeState(on);
      log({ table: '-', rowId: '-', action: on ? 'write_mode_on' : 'write_mode_off', detail: on ? 'Write mode enabled' : 'Write mode disabled' });
    },
    [log]
  );

  const updateCell = useCallback(
    (table: string, rowId: string, column: string, value: CellValue): void => {
      const old = tables.find((t) => t.name === table)?.rows.find((r) => r.id === rowId)?.[column];
      setTables((ts) => ts.map((t) => (t.name === table ? { ...t, rows: t.rows.map((r) => (r.id === rowId ? { ...r, [column]: value } : r)) } : t)));
      log({ table, rowId, action: 'update', detail: `${column}: ${String(old)} → ${String(value)}` });
    },
    [log, tables]
  );

  const deleteRow = useCallback(
    (table: string, rowId: string): void => {
      setTables((ts) => ts.map((t) => (t.name === table ? { ...t, rows: t.rows.filter((r) => r.id !== rowId) } : t)));
      log({ table, rowId, action: 'delete', detail: 'Row deleted' });
    },
    [log]
  );

  // A run started from the UI moves queued -> running -> completed and then gets findings, like the real worker would.
  const startRun = useCallback((run: DiagnosisRun): void => {
    setRuns((r) => [run, ...r]);
    window.setTimeout(() => {
      setRuns((r) => r.map((x) => (x.id === run.id ? { ...x, status: 'running', startedAt: new Date().toISOString() } : x)));
    }, 1200);
    window.setTimeout(() => {
      const durationSec = 20 + Math.round(Math.random() * 70);
      const result = generateResult({ ...run, durationSec });
      setFindings((f) => [...f, ...result.findings]);
      setReports((rp) => ({ ...rp, [run.id]: result.reports }));
      setRuns((r) => r.map((x) => (x.id === run.id ? { ...x, status: 'completed', durationSec, findingIds: result.findings.map((f) => f.id) } : x)));
    }, 4000);
  }, []);

  const value = useMemo<Store>(
    () => ({
      runs,
      schedules,
      findings,
      reports,
      review,
      acknowledge,
      addComment,
      addRun: startRun,
      addSchedule: (s) => setSchedules((x) => [s, ...x]),
      toggleSchedule: (id) => setSchedules((x) => x.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))),
      deleteSchedule: (id) => setSchedules((x) => x.filter((s) => s.id !== id)),
      tables,
      audit,
      writeMode,
      setWriteMode,
      updateCell,
      deleteRow,
    }),
    [runs, schedules, findings, reports, startRun, review, acknowledge, addComment, tables, audit, writeMode, setWriteMode, updateCell, deleteRow]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}
