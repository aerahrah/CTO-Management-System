/**
 * PendingApprovalsGuard
 *
 * Data-driven route guard for /app/cto-approvals.
 * Since any role can be configured as an approver by HR, we can't use
 * a static role list. Instead we check the live `teamPendingApprovals`
 * count from the ctoDashboard query.
 *
 *  - Loading  → show nothing (query is already cached by sidebar in most cases)
 *  - count > 0 → render <Outlet />
 *  - count = 0 → render <ForbiddenPage />
 */

import { Outlet, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../store/authStore";
import { fetchDashboard } from "../api/cto";
import ForbiddenPage from "../pages/forbiddenPage";

const PendingApprovalsGuard = () => {
  const { admin, token } = useAuth();

  // Not logged in at all → back to login
  if (!token || !admin) {
    return <Navigate to="/" replace />;
  }

  const adminId = String(admin?.id || admin?._id || "");

  const { data, isLoading } = useQuery({
    queryKey: ["ctoDashboard"],   // same key as sidebar → uses cache, no extra request
    queryFn: fetchDashboard,
    enabled: !!adminId,
    staleTime: 1000 * 60,
  });

  // While the query is in flight for the very first time, render nothing
  // (avoids a flash of the forbidden page before data arrives)
  if (isLoading) return null;

  const pendingCount = Number(data?.teamPendingApprovals || 0);

  if (pendingCount === 0) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
};

export default PendingApprovalsGuard;
