import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { BudgetPage } from "./pages/BudgetPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FleetPage } from "./pages/FleetPage";
import { FuelPage } from "./pages/FuelPage";
import { LedgerPage } from "./pages/LedgerPage";
import { RoutesPage } from "./pages/RoutesPage";
import { ScenariosPage } from "./pages/ScenariosPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VariancePage } from "./pages/VariancePage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/fuel" element={<FuelPage />} />
        <Route path="/fleet" element={<FleetPage />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/variance" element={<VariancePage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
