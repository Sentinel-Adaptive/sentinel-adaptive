import { Route, Routes } from "react-router-dom";

import { AppShell } from "./AppShell.js";
import { IncidentDetailPage } from "./pages/IncidentDetailPage.js";
import { IncidentsPage } from "./pages/IncidentsPage.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { SimulationPage } from "./pages/SimulationPage.js";
import { SiteDetailPage } from "./pages/SiteDetailPage.js";
import { SystemPage } from "./pages/SystemPage.js";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route path="sites/:siteId" element={<SiteDetailPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="simulation" element={<SimulationPage />} />
      </Route>
    </Routes>
  );
}
