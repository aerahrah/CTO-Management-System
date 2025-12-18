// App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Login from "./pages/loginPage";
import Dashboard from "./pages/dashboardPage";
import EmployeesPage from "./pages/employeePage";
import AdminPage from "./pages/adminPage";
import SettingsPage from "./pages/settingsPage";
import CtoPage from "./pages/ctoPage";
import CtoSettings from "./components/generalSettingsComponents/ctoSettings";
import CtoRecords from "./components/ctoComponents/ctoRecords";
import CtoApplication from "./components/ctoComponents/ctoApplication";
import CtoApplicationApprovals from "./components/ctoComponents/ctoApplicationApprovals";
import CtoCredits from "./components/ctoComponents/ctoCredits";
import CtoDashboard from "./components/ctoComponents/ctoDashboard";
import OfficeLocationSettingsPage from "./components/generalSettingsComponents/OfficeLocationSettings/officeLocationSettingsPage";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={<Dashboard />}>
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="cto" element={<CtoPage />} />
          <Route path="cto-settings" element={<CtoSettings />} />
          <Route
            path="office-locations"
            element={<OfficeLocationSettingsPage />}
          />
          <Route path="cto/credit" element={<CtoCredits />} />
          <Route path="cto/apply" element={<CtoApplication />} />
          <Route path="cto/approvals" element={<CtoApplicationApprovals />} />
          <Route path="cto/records" element={<CtoRecords />} />
          <Route path="cto/dashboard" element={<CtoDashboard />} />
        </Route>

        <Route path="*" element={<div>404 - Page Not Found</div>} />
      </Routes>

      {/* Toastify container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}

export default App;
