import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../store/authStore";
import { usePermissions } from "../hooks/usePermissions";
import ForbiddenPage from "../pages/forbiddenPage";

const ProtectedRoute = ({ allowedRoles, requiredPermission }) => {
  const { admin, token } = useAuth();
  const { can } = usePermissions();

  // Not logged in → redirect to login
  if (!token || !admin) {
    return <Navigate to="/" replace />;
  }

  // Handle new permission-based system
  if (requiredPermission) {
    if (!can(requiredPermission)) {
      return <ForbiddenPage />;
    }
    return <Outlet />;
  }

  // Logged in but not allowed (legacy fallback)
  if (allowedRoles) {
    const userRole = typeof admin.role === 'string' ? admin.role : admin.role?.name;
    if (!allowedRoles.includes(userRole)) {
      return <ForbiddenPage />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
