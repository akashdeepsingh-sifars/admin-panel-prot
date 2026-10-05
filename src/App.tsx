import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ApiFindings } from './pages/ApiFindings';
import { MessagingFindings } from './pages/MessagingFindings';
import { NewRun } from './pages/NewRun';
import { RunDetail } from './pages/RunDetail';
import { RunsList } from './pages/RunsList';
import { TableView, TablesList } from './pages/Tables';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/diagnostics/runs" replace />} />
        <Route path="/diagnostics/runs" element={<RunsList />} />
        <Route path="/diagnostics/runs/new" element={<NewRun />} />
        <Route path="/diagnostics/runs/:runId" element={<RunDetail />} />
        <Route path="/diagnostics/runs/:runId/api" element={<ApiFindings />} />
        <Route path="/diagnostics/runs/:runId/messaging" element={<MessagingFindings />} />
        <Route path="/tables" element={<TablesList />} />
        <Route path="/tables/:name" element={<TableView />} />
        <Route path="*" element={<Navigate to="/diagnostics/runs" replace />} />
      </Route>
    </Routes>
  );
}
