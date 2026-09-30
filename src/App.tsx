import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ApiFindings } from './pages/ApiFindings';
import { DriverDiagnosis } from './pages/DriverDiagnosis';
import { GpsFindings } from './pages/GpsFindings';
import { MessagingFindings } from './pages/MessagingFindings';
import { NewRun } from './pages/NewRun';
import { RunDetail } from './pages/RunDetail';
import { RunsList } from './pages/RunsList';
import { TableView, TablesList } from './pages/Tables';
import { Schedules } from './pages/Schedules';
import { ShipmentDiagnosis } from './pages/ShipmentDiagnosis';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/diagnostics/runs" replace />} />
        <Route path="/diagnostics/runs" element={<RunsList />} />
        <Route path="/diagnostics/runs/new" element={<NewRun />} />
        <Route path="/diagnostics/schedules" element={<Schedules />} />
        <Route path="/diagnostics/runs/:runId" element={<RunDetail />} />
        <Route path="/diagnostics/runs/:runId/shipments/:loadId" element={<ShipmentDiagnosis />} />
        <Route path="/diagnostics/runs/:runId/drivers/:driverId" element={<DriverDiagnosis />} />
        <Route path="/diagnostics/runs/:runId/api" element={<ApiFindings />} />
        <Route path="/diagnostics/runs/:runId/messaging" element={<MessagingFindings />} />
        <Route path="/diagnostics/runs/:runId/gps" element={<GpsFindings />} />
        <Route path="/tables" element={<TablesList />} />
        <Route path="/tables/:name" element={<TableView />} />
        <Route path="*" element={<Navigate to="/diagnostics/runs" replace />} />
      </Route>
    </Routes>
  );
}
