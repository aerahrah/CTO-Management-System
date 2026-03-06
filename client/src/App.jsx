import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import SessionGuard from "./components/sessionExpiredModal";

/* ✅ Global theme + scrollbar sync (mount once) */
import ThemeSync from "./components/themeSync";
import ScrollbarsSync from "./components/scrollbarSync";
import { useAuth } from "./store/authStore";

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
import GeneralSettings from "./components/generalSettingsComponents/generalSettings";
import WorkingDaysSettings from "./components/generalSettingsComponents/workingDaysSettings";

// ✅ Email Notification Settings
import EmailNotificationSettings from "./components/generalSettingsComponents/emailNotificationSetting";

// ✅ User Preferences Settings (theme + accent)
import UserPreferencesSettings from "./components/generalSettingsComponents/userPreferencesSetting";

/* Profile */
import MyProfile from "./components/userProfile/myProfile";
import UpdateProfile from "./components/userProfile/myProfileUpdate";
import ResetPassword from "./components/userProfile/myProfileResetPassword";

/* Auth */
import ProtectedRoute from "./components/protectedRoute";

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ✅ Reactive resolved theme for system mode (for ToastContainer + any other global uses) */
function useResolvedTheme(prefTheme) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined")
      return prefTheme === "dark" ? "dark" : "light";
    return resolveTheme(prefTheme);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prefTheme !== "system") {
      setTheme(prefTheme === "dark" ? "dark" : "light");
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(mq.matches ? "dark" : "light");

    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [prefTheme]);

  return theme;
}

function App() {
  const location = useLocation();

  // ✅ Don't mount SessionGuard on login ("/")
  const isLoginRoute = location.pathname === "/";

  // ✅ Global theme (single source of truth)
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  return (
    <>
      {/* ✅ Mount these ONCE so you don't need them in every component */}
      {!isLoginRoute && (
        <>
          <ThemeSync />
          <ScrollbarsSync className="cto-scrollbar" applyToDocument={true} />
          <SessionGuard />
        </>
      )}

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

            {/* User Preferences */}
            <Route
              path="user-preferences"
              element={<UserPreferencesSettings />}
            />
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

            {/* CTO SETTINGS (nested like CtoRecords) */}
            <Route path="cto-settings" element={<CtoSettings />}>
              <Route index element={<CtoSettingsPlaceholder />} />
              <Route path=":designationId" element={<ApproverSettings />} />
            </Route>

            <Route path="designations" element={<DesignationSettings />} />
            <Route path="projects" element={<ProjectSettings />} />
            <Route path="backups" element={<BackupSettings />} />
            <Route path="general-settings" element={<WorkingDaysSettings />} />
            <Route path="session-settings" element={<GeneralSettings />} />

            {/* Email notification settings */}
            <Route
              path="email-notification-settings"
              element={<EmailNotificationSettings />}
            />
          </Route>

          {/* ===================== */}
          {/* ADMIN + SUPERVISOR + HR + EMPLOYEE */}
          {/* ===================== */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["admin", "supervisor", "hr", "employee"]}
              />
            }
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

      {/* TOASTS (theme matches user/system) */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme={resolvedTheme === "dark" ? "dark" : "light"}
      />
    </>
  );
}

export default App;
