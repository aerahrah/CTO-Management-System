import { useAuth } from "../store/authStore";

export const usePermissions = () => {
  const { admin } = useAuth(); // "admin" holds the logged-in user profile

  // Backwards compatibility during migration: if role is still a string (e.g. "admin"), simulate wildcard
  let permissions = [];

  if (admin?.role?.permissions) {
    permissions = admin.role.permissions;
  } else if (typeof admin?.role === "string" && admin.role === "admin") {
    permissions = ["*"];
  }

  const can = (requiredPermission) => {
    // Admin wildcard access
    if (permissions.includes("*")) return true;

    // Exact match
    return permissions.includes(requiredPermission);
  };

  return { can, permissions, role: admin?.role };
};
