// App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* Pages */
import Login from "./pages/loginPage";
import Dashboard from "./pages/dashboardPage";
import EmployeesPage from "./pages/employeePage";
import AdminPage from "./pages/adminPage";
import SettingsPage from "./pages/settingsPage";
import AuditLogTable from "./pages/auditPage";
// import AppOverviewPage from "./pages/appOverviewPage"; // ✅ HOME (/app)

/* CTO Components */
import CtoDashboard from "./components/ctoComponents/ctoDashboard";
import CtoCredits from "./components/ctoComponents/ctoCredits";
import CtoApplication from "./components/ctoComponents/ctoApplication";
import MyCtoCredits from "./components/ctoComponents/myCtoCredits";
import AllCtoApplications from "./components/ctoComponents/ctoAllApplications";
import CtoApplicationApprovals from "./components/ctoComponents/ctoApplicationApprovals";
import CtoApplicationDetails from "./components/ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsDetails";
import CtoRecords from "./components/ctoComponents/ctoRecords";
import CtoEmployeeInformation from "./components/ctoComponents/ctoCreditHistory/ctoEmployeeInformation";
import EmployeePlaceholder from "./components/ctoComponents/ctoApplicationApprovalsComponents/ctoEmployeePlaceholder";
import EmployeeRecordsPlaceholder from "./components/ctoComponents/ctoCreditHistory/ctoEmployeeRecordPlaceholder";

/* Employee Components */
import AddEmployeeForm from "./components/employeeDashboard/forms/addEmployeeForm";
import EmployeeInformation from "./components/employeeDashboard/employeeInformation";

/* Settings */
import CtoSettings from "./components/generalSettingsComponents/ctoSettings";
import OfficeLocationSettingsPage from "./components/generalSettingsComponents/OfficeLocationSettings/officeLocationSettingsPage";
import ProjectSettings from "./components/generalSettingsComponents/projectSettings/projectSettings";
/* Profile */
import MyProfile from "./components/userProfile/myProfile";
import UpdateProfile from "./components/userProfile/myProfileUpdate";
import ResetPassword from "./components/userProfile/myProfileResetPassword";

/* Auth */
import ProtectedRoute from "./components/protectedRoute";

function App() {
  return (
    <>
      <Routes>
        {/* PUBLIC */}
        <Route path="/" element={<Login />} />

        {/* APP LAYOUT */}
        <Route path="/app" element={<Dashboard />}>
          {/* ===================== */}
          {/* ALL AUTHENTICATED USERS (HOME lives here) */}
          {/* ===================== */}
          <Route element={<ProtectedRoute />}>
            {/* ✅ DEFAULT HOME: /app */}
            <Route index element={<CtoDashboard />} />

            {/* Optional: keep /app/overview as an alias (safe to keep)
            <Route path="overview" element={<AppOverviewPage />} /> */}
            {/* 
            <Route path="cto-dashboard" element={<CtoDashboard />} /> */}
            <Route path="cto-apply" element={<CtoApplication />} />
            <Route path="cto-my-credits" element={<MyCtoCredits />} />

            <Route path="my-profile" element={<MyProfile />} />
            <Route path="my-profile/edit" element={<UpdateProfile />} />
            <Route
              path="my-profile/reset-password"
              element={<ResetPassword />}
            />

            {/* Optional admin page if you still need it */}
            <Route path="admin" element={<AdminPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ===================== */}
          {/* ADMIN + HR ROUTES */}
          {/* ===================== */}
          <Route element={<ProtectedRoute allowedRoles={["admin", "hr"]} />}>
            <Route path="employees" element={<EmployeesPage />} />
            <Route
              path="employees/add-employee"
              element={<AddEmployeeForm />}
            />
            <Route path="employees/:id" element={<EmployeeInformation />} />
            <Route path="employees/:id/update" element={<AddEmployeeForm />} />

            <Route path="audit-logs" element={<AuditLogTable />} />

            <Route path="cto-credit" element={<CtoCredits />} />
            <Route
              path="cto-all-applications"
              element={<AllCtoApplications />}
            />

            <Route path="cto-records" element={<CtoRecords />}>
              <Route index element={<EmployeeRecordsPlaceholder />} />
              <Route path=":id" element={<CtoEmployeeInformation />} />
            </Route>

            <Route path="cto-settings" element={<CtoSettings />} />
            <Route
              path="designations"
              element={<OfficeLocationSettingsPage />}
            />
            <Route path="projects" element={<ProjectSettings />} />
          </Route>

          {/* ===================== */}
          {/* ADMIN + SUPERVISOR */}
          {/* ===================== */}
          <Route
            element={<ProtectedRoute allowedRoles={["admin", "supervisor"]} />}
          >
            <Route path="cto-approvals" element={<CtoApplicationApprovals />}>
              <Route index element={<EmployeePlaceholder />} />
              <Route path=":id" element={<CtoApplicationDetails />} />
            </Route>
          </Route>
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<div>404 - Page Not Found</div>} />
      </Routes>

      {/* TOASTS */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
      />
    </>
  );
}

export default App;
