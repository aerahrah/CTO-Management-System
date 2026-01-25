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
// import CtoPage from "./pages/ctoPage";
import CtoSettings from "./components/generalSettingsComponents/ctoSettings";
import CtoRecords from "./components/ctoComponents/ctoRecords";
import CtoApplication from "./components/ctoComponents/ctoApplication";
import CtoApplicationApprovals from "./components/ctoComponents/ctoApplicationApprovals";
import CtoCredits from "./components/ctoComponents/ctoCredits";
import CtoDashboard from "./components/ctoComponents/ctoDashboard";
import OfficeLocationSettingsPage from "./components/generalSettingsComponents/OfficeLocationSettings/officeLocationSettingsPage";
import ProtectedRoute from "./components/protectedRoute";
import MyCtoCredits from "./components/ctoComponents/myCtoCredits";
import AddEmployeeForm from "./components/employeeDashboard/forms/addEmployeeForm";
import EmployeeInformation from "./components/employeeDashboard/employeeInformation";
import AllCtoApplications from "./components/ctoComponents/ctoAllApplications";
import CtoApplicationDetails from "./components/ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsDetails";
import CtoEmployeeInformation from "./components/ctoComponents/ctoCreditHistory/ctoEmployeeInformation";
import MyProfile from "./components/userProfile/myProfile";
import UpdateProfile from "./components/userProfile/myProfileUpdate";
import ResetPassword from "./components/userProfile/myProfileResetPassword";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={<Dashboard />}>
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="employees/add-employee" element={<AddEmployeeForm />} />
          <Route path="employees/:id" element={<EmployeeInformation />} />
          <Route path="employees/:id/update" element={<AddEmployeeForm />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="my-profile" element={<MyProfile />} />
          <Route path="my-profile/edit" element={<UpdateProfile />} />
          <Route path="my-profile/reset-password" element={<ResetPassword />} />
          {/* <Route path="cto" element={<CtoPage />} /> */}
          <Route path="cto-settings" element={<CtoSettings />} />
          <Route
            path="office-locations"
            element={<OfficeLocationSettingsPage />}
          />
          <Route element={<ProtectedRoute allowedRoles={["admin", "hr"]} />}>
            <Route path="/dashboard/cto/credit" element={<CtoCredits />} />
          </Route>
          <Route path="cto/apply" element={<CtoApplication />} />
          <Route path="cto/all-applications" element={<AllCtoApplications />} />
          <Route path="cto/approvals" element={<CtoApplicationApprovals />}>
            {/* Default content if no application is selected */}
            <Route
              index
              element={
                <div className="text-center p-10">
                  Select an application to view details.
                </div>
              }
            />

            <Route path=":id" element={<CtoApplicationDetails />} />
          </Route>

          <Route path="cto/records" element={<CtoRecords />}>
            {/* Default content if no application is selected */}
            <Route
              index
              element={
                <div className="text-center p-10">
                  Select an employee to view details.
                </div>
              }
            />

            <Route path=":id" element={<CtoEmployeeInformation />} />
          </Route>
          <Route path="cto/dashboard" element={<CtoDashboard />} />
          <Route path="cto/my-credits" element={<MyCtoCredits />} />
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
