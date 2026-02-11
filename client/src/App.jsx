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
import ApproverSettings from "./components/generalSettingsComponents/ctoApproverSetting";
import CtoSettingsPlaceholder from "./components/generalSettingsComponents/ctoSettingsPlaceholder";
import ProjectSettings from "./components/generalSettingsComponents/projectSettings/projectSettings";
import DesignationSettings from "./components/generalSettingsComponents/designationSettings/designationSettings";
import BackupSettings from "./components/generalSettingsComponents/backupSettings/backupSettings";

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
          {/* ALL AUTHENTICATED USERS */}
          {/* ===================== */}
          <Route element={<ProtectedRoute />}>
            <Route index element={<CtoDashboard />} />

            <Route path="cto-apply" element={<CtoApplication />} />
            <Route path="cto-my-credits" element={<MyCtoCredits />} />

            <Route path="my-profile" element={<MyProfile />} />
            <Route path="my-profile/edit" element={<UpdateProfile />} />
            <Route
              path="my-profile/reset-password"
              element={<ResetPassword />}
            />

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

            {/* ✅ CTO SETTINGS (NESTED LIKE CtoRecords) */}
            <Route path="cto-settings" element={<CtoSettings />}>
              <Route index element={<CtoSettingsPlaceholder />} />
              <Route path=":designationId" element={<ApproverSettings />} />
            </Route>

            <Route path="designations" element={<DesignationSettings />} />
            <Route path="projects" element={<ProjectSettings />} />
            <Route path="backups" element={<BackupSettings />} />
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
