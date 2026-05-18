import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CalendarDays, ShieldCheck } from "lucide-react";

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

/* Wellness Components */
import MyWellnessApplications from "./components/wellnessComponents/wellnessApplicationComponents/myWellnessApplicationHistory";
import WellnessApplicationApprovals from "./components/wellnessComponents/wellnessApplicationApprovals";
import WellnessApplicationDetails from "./components/wellnessComponents/wellnessApplicationApprovalComponents/wellnessApplicationDetails";
import AllWellnessApplicationsHistory from "./components/wellnessComponents/wellnessApplicationComponents/allWellnessApplicationHistory";
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

// ✅ Role Settings Components
import RolesSettings from "./components/generalSettingsComponents/rolesSettings/rolesSettings";
import AddRole from "./components/generalSettingsComponents/rolesSettings/addRole";
import UpdateRole from "./components/generalSettingsComponents/rolesSettings/updateRole";
import ViewRole from "./components/generalSettingsComponents/rolesSettings/viewRole";

// ✅ Email Notification Settings
import EmailNotificationSettings from "./components/generalSettingsComponents/emailNotificationSetting";

// ✅ Approval Routes (Separated into List and Form)
import ApprovalRoutesList from "./components/generalSettingsComponents/approvalRoutes/approvalRoutesList";
import ApprovalRouteStepForm from "./components/generalSettingsComponents/approvalRoutes/approvalRouteStepForm";

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

/* ✅ Reactive resolved theme for system mode */
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

  const isLoginRoute = location.pathname === "/";

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  return (
    <>
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
          {/* BASE AUTHENTICATED (No special permissions needed) */}
          {/* ===================== */}
          <Route element={<ProtectedRoute />}>
            <Route index element={<CtoDashboard />} />
            <Route
              path="user-preferences"
              element={<UserPreferencesSettings />}
            />
          </Route>

          {/* ===================== */}
          {/* SELF-SERVICE / EMPLOYEE LEVEL */}
          {/* ===================== */}

          {/* View Own Profile */}
          <Route
            element={
              <ProtectedRoute requiredPermission="employees.view_self" />
            }
          >
            <Route path="my-profile" element={<MyProfile />} />
          </Route>

          {/* Edit Own Profile */}
          <Route
            element={
              <ProtectedRoute requiredPermission="employees.edit_self" />
            }
          >
            <Route path="my-profile/edit" element={<UpdateProfile />} />
          </Route>

          {/* Reset Own Password */}
          <Route
            element={
              <ProtectedRoute requiredPermission="employees.reset_password_self" />
            }
          >
            <Route
              path="my-profile/reset-password"
              element={<ResetPassword />}
            />
          </Route>

          {/* View Own Credits/Records */}
          <Route
            element={<ProtectedRoute requiredPermission="cto.view_self" />}
          >
            <Route path="cto-my-credits" element={<MyCtoCredits />} />
          </Route>

          {/* Apply for Leaves */}
          <Route element={<ProtectedRoute requiredPermission="cto.create" />}>
            <Route path="cto-apply" element={<CtoApplication />} />
          </Route>
          <Route
            element={<ProtectedRoute requiredPermission="wellness.view_self" />}
          >
            <Route path="wellness-apply" element={<MyWellnessApplications />} />
          </Route>

          {/* ===================== */}
          {/* RESTRICTED HUBS (Admin & Settings) */}
          {/* ===================== */}

          {/* Settings Hub & Approval Routes */}
          <Route
            element={
              <ProtectedRoute requiredPermission="settings.cto_workflow" />
            }
          >
            <Route path="approval-routes" element={<ApprovalRoutesList />} />
            <Route
              path="approval-routes/step/new"
              element={<ApprovalRouteStepForm />}
            />
            <Route
              path="approval-routes/step/:approverId"
              element={<ApprovalRouteStepForm />}
            />
          </Route>

          {/* ===================== */}
          {/* HR / EMPLOYEES (Separated CRUD) */}
          {/* ===================== */}

          {/* View Employees */}
          <Route
            element={<ProtectedRoute requiredPermission="employees.view" />}
          >
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/:id" element={<EmployeeInformation />} />
          </Route>

          {/* Create/Add Employee */}
          <Route
            element={<ProtectedRoute requiredPermission="employees.create" />}
          >
            <Route
              path="employees/add-employee"
              element={<AddEmployeeForm />}
            />
          </Route>

          {/* Edit/Update Employee */}
          <Route
            element={<ProtectedRoute requiredPermission="employees.edit" />}
          >
            <Route path="employees/:id/update" element={<AddEmployeeForm />} />
          </Route>

          {/* ===================== */}
          {/* CTO GLOBAL VIEWS (Separated) */}
          {/* ===================== */}

          {/* Manage CTO Credits */}
          <Route
            element={<ProtectedRoute requiredPermission="cto.credits_view" />}
          >
            <Route path="cto-credit" element={<CtoCredits />} />
          </Route>

          {/* View All CTO Applications */}
          <Route
            element={
              <ProtectedRoute requiredPermission="cto.applications_view" />
            }
          >
            <Route
              path="cto-all-applications"
              element={<AllCtoApplications />}
            />
          </Route>

          {/* View All CTO Records */}
          <Route
            element={<ProtectedRoute requiredPermission="cto.records_view" />}
          >
            <Route path="cto-records" element={<CtoRecords />}>
              <Route index element={<EmployeeRecordsPlaceholder />} />
              <Route path=":id" element={<CtoEmployeeInformation />} />
            </Route>
          </Route>

          {/* ===================== */}
          {/* WELLNESS GLOBAL VIEWS */}
          {/* ===================== */}

          {/* ✅ View All Wellness Applications */}
          <Route
            element={<ProtectedRoute requiredPermission="wellness.view_all" />}
          >
            <Route
              path="wellness-all-applications"
              element={<AllWellnessApplicationsHistory />}
            />
          </Route>

          {/* ===================== */}
          {/* SYSTEM SETTINGS / AUDIT */}
          {/* ===================== */}

          {/* Audit Logs */}
          <Route element={<ProtectedRoute requiredPermission="audit.view" />}>
            <Route path="audit-logs" element={<AuditLogTable />} />
          </Route>

          {/* CTO Workflow Settings */}
          <Route
            element={
              <ProtectedRoute requiredPermission="settings.cto_workflow" />
            }
          >
            <Route path="cto-settings" element={<CtoSettings />}>
              <Route index element={<CtoSettingsPlaceholder />} />
              <Route path=":designationId" element={<ApproverSettings />} />
            </Route>
          </Route>

          {/* Designations */}
          <Route
            element={
              <ProtectedRoute requiredPermission="designations.manage" />
            }
          >
            <Route path="designations" element={<DesignationSettings />} />
          </Route>

          {/* Roles (Separated CRUD) */}
          <Route element={<ProtectedRoute requiredPermission="roles.view" />}>
            {" "}
            <Route path="roles" element={<RolesSettings />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="roles.manage" />}>
            <Route path="roles/add-role" element={<AddRole />} />
            <Route path="roles/:id" element={<ViewRole />} />
            <Route path="roles/:id/update" element={<UpdateRole />} />
          </Route>

          {/* Projects */}
          <Route
            element={<ProtectedRoute requiredPermission="projects.manage" />}
          >
            <Route path="projects" element={<ProjectSettings />} />
          </Route>

          {/* Backups */}
          <Route
            element={<ProtectedRoute requiredPermission="backups.manage" />}
          >
            <Route path="backups" element={<BackupSettings />} />
          </Route>

          {/* General Core Settings - Separated */}
          <Route
            element={<ProtectedRoute requiredPermission="settings.general" />}
          >
            <Route path="general-settings" element={<WorkingDaysSettings />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="settings.sessions" />}
          >
            <Route path="session-settings" element={<GeneralSettings />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="settings.email" />}
          >
            <Route
              path="email-notification-settings"
              element={<EmailNotificationSettings />}
            />
          </Route>

          {/* ===================== */}
          {/* CTO APPROVALS (Dynamic Guard) */}
          {/* ===================== */}
          <Route
            element={
              <ProtectedRoute requiredPermission="cto.view_application" />
            }
          >
            <Route path="cto-approvals" element={<CtoApplicationApprovals />}>
              <Route index element={<EmployeePlaceholder />} />
              <Route path=":id" element={<CtoApplicationDetails />} />
            </Route>
          </Route>

          {/* ===================== */}
          {/* ✅ WELLNESS APPROVALS (Dynamic Guard) */}
          {/* ===================== */}
          <Route
            element={
              <ProtectedRoute requiredPermission="wellness.view_application" />
            }
          >
            <Route
              path="wellness-approvals"
              element={<WellnessApplicationApprovals />}
            >
              <Route
                index
                element={
                  <EmployeePlaceholder
                    title="No Wellness Request Selected"
                    description="Pick a Wellness request from the list to review dates and approvals."
                    bullets={[
                      {
                        icon: CalendarDays,
                        label: "Requested wellness dates & total days",
                      },
                      {
                        icon: ShieldCheck,
                        label: "Approval progress & remarks",
                      },
                    ]}
                  />
                }
              />
              <Route path=":id" element={<WellnessApplicationDetails />} />
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
        theme={resolvedTheme === "dark" ? "dark" : "light"}
      />
    </>
  );
}

export default App;
