import { Outlet } from "react-router-dom";
import { useAuth } from "../store/authStore";
import ForbiddenPage from "../pages/forbiddenPage";

const ProtectedRoute = ({ allowedRoles }) => {
  const { admin, token } = useAuth();

  // Not logged in → redirect to login
  if (!token || !admin) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(admin.role)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
