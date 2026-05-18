import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../store/authStore";
import { usePermissions } from "../hooks/usePermissions";
import ForbiddenPage from "../pages/forbiddenPage";

const ProtectedRoute = ({ allowedRoles, requiredPermission }) => {
  // ✅ Removed 'token' - we only need to check for the admin profile now
  const { admin } = useAuth();
  const { can } = usePermissions();

  // ✅ Not logged in (no profile in memory) → redirect to login
  if (!admin) {
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
    const userRole =
      typeof admin.role === "string" ? admin.role : admin.role?.name;
    if (!allowedRoles.includes(userRole)) {
      return <ForbiddenPage />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
