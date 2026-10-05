import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DB_TABLES, FINDINGS, generateResult, RUN_REPORTS, RUNS } from './sampleData';
import type { DbTable, DiagnosisRun, Finding, RunReports } from './types';

export const CURRENT_USER = 'Bharat Shah';

interface Store {
  runs: DiagnosisRun[];
  findings: Finding[];
  reports: Record<string, RunReports>;
  addRun: (run: DiagnosisRun) => void;
  tables: DbTable[];
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [runs, setRuns] = useState<DiagnosisRun[]>(RUNS);
  const [findings, setFindings] = useState<Finding[]>(FINDINGS);
  const [reports, setReports] = useState<Record<string, RunReports>>(RUN_REPORTS);

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

  const value = useMemo<Store>(() => ({ runs, findings, reports, addRun: startRun, tables: DB_TABLES }), [runs, findings, reports, startRun]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}
