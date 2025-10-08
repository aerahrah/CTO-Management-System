// App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/loginPage";
import Dashboard from "./pages/dashboardPage";
import EmployeesPage from "./pages/employeePage";
import AdminPage from "./pages/adminPage";
import SettingsPage from "./pages/settingsPage";
import CtoPage from "./pages/ctoPage";
import CtoSettings from "./components/generalSettingsComponents/ctoSettings";
// import OfficeLocationSettings from "./generalSettingsComponents/officeLocationSettings"; // 👈 new import

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route path="/dashboard" element={<Dashboard />}>
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="cto" element={<CtoPage />} />
        <Route path="cto-settings" element={<CtoSettings />} />
        {/* <Route path="office-locations" element={<OfficeLocationSettings />} /> */}
      </Route>
      <Route path="*" element={<div>404 - Page Not Found</div>} />
    </Routes>
  );
}

export default App;
