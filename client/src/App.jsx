import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CalendarDays, ShieldCheck } from "lucide-react";
import NotFoundPage from "./pages/notFoundPage";
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
import SalaryGradesSettings from "./components/generalSettingsComponents/salaryGradesSettings";

/* CTO Components */
import CtoDashboard from "./components/ctoComponents/ctoDashboard";
import AddCtoCreditForm from "./components/ctoComponents/ctoCreditComponents/forms/addCtoCreditForm";
import MyCtoApplications from "./components/ctoComponents/ctoApplicationComponents/myCtoApplicationHistory";
import AllCtoApplicationsHistory from "./components/ctoComponents/ctoApplicationComponents/allCtoApplicationHistory";
import MyCtoCreditHistory from "./components/ctoComponents/ctoCreditComponents/myCtoCreditHistory";
import CtoCreditHistory from "./components/ctoComponents/ctoCreditComponents/recentCtoCreditHistory";

import CtoApplicationApprovals from "./components/ctoComponents/ctoApplicationApprovals";
import CtoApplicationDetails from "./components/ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsDetails";
import CtoRecords from "./components/ctoComponents/ctoRecords";
import CtoEmployeeInformation from "./components/ctoComponents/ctoCreditHistory/ctoEmployeeInformation";
import EmployeePlaceholder from "./components/ctoComponents/ctoApplicationApprovalsComponents/ctoEmployeePlaceholder";
import EmployeeRecordsPlaceholder from "./components/ctoComponents/ctoCreditHistory/ctoEmployeeRecordPlaceholder";
import AddCtoApplicationForm from "./components/ctoComponents/ctoApplicationComponents/forms/addCtoApplicationForm";

/* ✅ Revocation Components */
import RevocationApprovals from "./components/revocationComponents/revocationApprovals";
import RevocationDetails from "./components/revocationComponents/revocationDetails";
import RevocationPlaceholder from "./components/revocationComponents/revocationPlaceholder";
import AllRevocationApplicationHistory from "./components/revocationComponents/allRevocationApplicationHistory";

/* Wellness Components */
import WellnessDashboard from "./components/wellnessComponents/wellnessDashboard";
import MyWellnessApplications from "./components/wellnessComponents/wellnessApplicationComponents/myWellnessApplicationHistory";
import WellnessApplicationApprovals from "./components/wellnessComponents/wellnessApplicationApprovals";
import WellnessApplicationDetails from "./components/wellnessComponents/wellnessApplicationApprovalComponents/wellnessApplicationDetails";
import AllWellnessApplicationsHistory from "./components/wellnessComponents/wellnessApplicationComponents/allWellnessApplicationHistory";
import WellnessCreditHistory from "./components/wellnessComponents/wellnessCreditComponents/recentWellnessCreditHistory";
import AddWellnessCreditForm from "./components/wellnessComponents/wellnessCreditComponents/forms/addWellnessCreditForm";
import AddWellnessApplicationForm from "./components/wellnessComponents/wellnessApplicationComponents/forms/addWellnessApplicationForm";
import AddOrganicWellnessApplicationForm from "./components/wellnessComponents/wellnessApplicationComponents/forms/addOrganicWellnessApplicationForm";

/* Leave Credit Components */
import LeaveCreditHistory from "./components/leaveComponents/leaveCreditComponents/recentLeaveCreditHistory";
import AddLeaveCreditForm from "./components/leaveComponents/leaveCreditComponents/forms/addLeaveCreditForm";
import LeaveCreditsRecords from "./components/leaveComponents/updateLeaveComponents/LeaveCreditsRecords";
import LeaveCreditsDetails from "./components/leaveComponents/updateLeaveComponents/LeaveCreditsDetails";

/* Organic Leave Components */
import AddOrganicLeaveApplicationForm from "./components/ctoComponents/ctoApplicationComponents/forms/addOrganicLeaveForm";

/* ✅ Calendar Components */
import MyCalendarPage from "./components/calendarComponents/myCalendarPage";
import CompanyCalendarPage from "./components/calendarComponents/allCalendarPage";
import ProjectTeamCalendarPage from "./components/calendarComponents/ProjectTeamCalendarPage";
import DesignationTeamCalendarPage from "./components/calendarComponents/DesignationTeamCalendarPage";

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
import RevocationSettings from "./components/generalSettingsComponents/revocationSetting";

// Role Settings Components
import RolesSettings from "./components/generalSettingsComponents/rolesSettings/rolesSettings";
import AddRole from "./components/generalSettingsComponents/rolesSettings/addRole";
import UpdateRole from "./components/generalSettingsComponents/rolesSettings/updateRole";
import ViewRole from "./components/generalSettingsComponents/rolesSettings/viewRole";

// Email Notification Settings
import EmailNotificationSettings from "./components/generalSettingsComponents/emailNotificationSetting";

// Approval Routes (Separated into List and Form)
import ApprovalRoutesList from "./components/generalSettingsComponents/approvalRoutes/approvalRoutesList";
import ApprovalRouteStepForm from "./components/generalSettingsComponents/approvalRoutes/approvalRouteStepForm";

// User Preferences Settings (theme + accent)
import UserPreferencesSettings from "./components/generalSettingsComponents/userPreferencesSetting";

/* Profile */
import MyProfile from "./components/userProfile/myProfile";
import UpdateProfile from "./components/userProfile/myProfileUpdate";
import ResetPassword from "./components/userProfile/myProfileResetPassword";

/* Auth */
import ProtectedRoute from "./components/protectedRoute";

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

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

  // Theme State
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
          {/* BASE AUTHENTICATED */}
          {/* ===================== */}
          <Route element={<ProtectedRoute />}>
            <Route index element={<CtoDashboard />} />
            <Route
              path="user-preferences"
              element={<UserPreferencesSettings />}
            />
          </Route>

          {/* ===================== */}
          {/* SELF-SERVICE */}
          {/* ===================== */}

          {/* ✅ Calendar: View Self */}
          <Route
            element={<ProtectedRoute requiredPermission="calendar.view_self" />}
          >
            <Route path="my-calendar" element={<MyCalendarPage />} />
          </Route>

          {/* ✅ Calendar: View Project Team */}
          <Route
            element={
              <ProtectedRoute requiredPermission="calendar.view_project" />
            }
          >
            <Route
              path="project-calendar"
              element={<ProjectTeamCalendarPage />}
            />
          </Route>

          {/* ✅ Calendar: View Designation Team */}
          <Route
            element={
              <ProtectedRoute requiredPermission="calendar.view_designation" />
            }
          >
            <Route
              path="designation-calendar"
              element={<DesignationTeamCalendarPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute requiredPermission="employees.view_self" />
            }
          >
            <Route path="my-profile" element={<MyProfile />} />
          </Route>

          <Route
            element={
              <ProtectedRoute requiredPermission="employees.edit_self" />
            }
          >
            <Route path="my-profile/edit" element={<UpdateProfile />} />
          </Route>

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

          <Route
            element={<ProtectedRoute requiredPermission="cto.view_self" />}
          >
            <Route path="cto-my-credits" element={<MyCtoCreditHistory />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="cto.view_self" />}
          >
            <Route path="cto-apply" element={<MyCtoApplications />} />

            {/* ✅ Forms require cto.manage_self as well */}
            <Route
              element={<ProtectedRoute requiredPermission="cto.manage_self" />}
            >
              <Route path="cto-apply/add" element={<AddCtoApplicationForm />} />
              <Route
                path="cto-apply/organic"
                element={<AddOrganicLeaveApplicationForm />}
              />
            </Route>
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="wellness.view_self" />}
          >
            <Route path="wellness-dashboard" element={<WellnessDashboard />} />
            <Route path="wellness-apply" element={<MyWellnessApplications />} />

            {/* ✅ Forms require wellness.manage_self as well */}
            <Route
              element={
                <ProtectedRoute requiredPermission="wellness.manage_self" />
              }
            >
              <Route
                path="wellness-apply/add"
                element={<AddWellnessApplicationForm />}
              />
              <Route
                path="wellness-apply/organic"
                element={<AddOrganicWellnessApplicationForm />}
              />
            </Route>
          </Route>

          {/* ===================== */}
          {/* RESTRICTED HUBS */}
          {/* ===================== */}

          {/* ✅ Calendar: View All (HR/Admin) */}
          <Route
            element={<ProtectedRoute requiredPermission="calendar.view_all" />}
          >
            <Route path="company-calendar" element={<CompanyCalendarPage />} />
          </Route>

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

          <Route
            element={<ProtectedRoute requiredPermission="employees.view" />}
          >
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/:id" element={<EmployeeInformation />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="employees.create" />}
          >
            <Route
              path="employees/add-employee"
              element={<AddEmployeeForm />}
            />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="employees.edit" />}
          >
            <Route path="employees/:id/update" element={<AddEmployeeForm />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="cto.credits_view" />}
          >
            <Route path="cto-credit" element={<CtoCreditHistory />} />
            <Route path="cto-credit/add" element={<AddCtoCreditForm />} />
          </Route>

          <Route
            element={
              <ProtectedRoute requiredPermission="cto.applications_view" />
            }
          >
            <Route
              path="cto-all-applications"
              element={<AllCtoApplicationsHistory />}
            />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="cto.records_view" />}
          >
            <Route path="cto-records" element={<CtoRecords />}>
              <Route index element={<EmployeeRecordsPlaceholder />} />
              <Route path=":id" element={<CtoEmployeeInformation />} />
            </Route>
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="wellness.manage" />}
          >
            <Route path="wellness-credit" element={<WellnessCreditHistory />} />
            <Route
              path="wellness-credit/add"
              element={<AddWellnessCreditForm />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute requiredPermission="leave_credits.manage" />
            }
          >
            <Route path="leave-credit" element={<LeaveCreditHistory />} />
            <Route path="leave-credit/add" element={<AddLeaveCreditForm />} />
            {/* ✅ Newly Added Leave Balance Direct Edit Routes */}
            <Route path="leave-credits" element={<LeaveCreditsRecords />}>
              <Route index element={<EmployeeRecordsPlaceholder />} />
              <Route path=":id" element={<LeaveCreditsDetails />} />
            </Route>
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="wellness.view_all" />}
          >
            <Route
              path="wellness-all-applications"
              element={<AllWellnessApplicationsHistory />}
            />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="audit.view" />}>
            <Route path="audit-logs" element={<AuditLogTable />} />
          </Route>

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

          <Route
            element={
              <ProtectedRoute requiredPermission="designations.manage" />
            }
          >
            <Route path="designations" element={<DesignationSettings />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="roles.view" />}>
            <Route path="roles" element={<RolesSettings />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="roles.manage" />}>
            <Route path="roles/add-role" element={<AddRole />} />
            <Route path="roles/:id" element={<ViewRole />} />
            <Route path="roles/:id/update" element={<UpdateRole />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="projects.manage" />}
          >
            <Route path="projects" element={<ProjectSettings />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="backups.manage" />}
          >
            <Route path="backups" element={<BackupSettings />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredPermission="settings.general" />}
          >
            <Route path="general-settings" element={<WorkingDaysSettings />} />
          </Route>

          {/* ✅ Added Revocation Settings Route */}
          <Route
            element={
              <ProtectedRoute requiredPermission="settings.revocation_workflow" />
            }
          >
            <Route
              path="revocation-settings"
              element={<RevocationSettings />}
            />
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

          <Route
            element={<ProtectedRoute requiredPermission="salary_grades.view" />}
          >
            <Route path="salary-grades" element={<SalaryGradesSettings />} />
          </Route>

          {/* ===================== */}
          {/* APPROVALS             */}
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

          {/* ===================== */}
          {/* REVOCATIONS (HR ONLY) */}
          {/* ===================== */}
          <Route
            element={
              <ProtectedRoute requiredPermission="revocation.view_application" />
            }
          >
            <Route
              path="all-revocations"
              element={<AllRevocationApplicationHistory />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute requiredPermission="revocation.manage_application" />
            }
          >
            <Route path="leave-revocations" element={<RevocationApprovals />}>
              <Route index element={<RevocationPlaceholder />} />
              <Route path=":id" element={<RevocationDetails />} />
            </Route>
          </Route>
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<NotFoundPage />} />
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
