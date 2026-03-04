// Sidebar.jsx
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployees } from "../api/employee";
import { fetchCtoApplicationsPendingRequest } from "../api/cto";
import { useAuth } from "../store/authStore";
import ScrollbarsSync from "./scrollbarSync";

import {
  X,
  UserRound,
  Settings,
  Sliders,
  Timer,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  ChevronDown,
  CirclePlus,
  FileClock,
  PenLine,
  Files,
  UserCheck,
  Archive,
  ShieldCheck,
  UserCircle,
  MapPin,
  SlidersHorizontal,
  FolderKanban,
  HardDrive,
  CalendarDays,
  Mail,
  Palette,
} from "lucide-react";

/* =========================
   Accent helpers (same as before)
========================= */
const ACCENT_HEX = {
  blue: "#2563EB",
  pink: "#DB2777",
  green: "#16A34A",
  violet: "#7C3AED",
  amber: "#D97706",
  teal: "#0D9488",
  indigo: "#4F46E5",
  rose: "#E11D48",
  cyan: "#0891B2",
  lime: "#65A30D",
  orange: "#EA580C",
};

const hexToRgba = (hex, alpha = 1) => {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(37,99,235,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const Sidebar = ({
  admin,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const role = admin?.role;

  // ✅ Reusable scrollbar sync (themes html/body + any .app-scrollbar containers)
  // (same pattern as UserPreferencesSettings)
  // NOTE: This component injects the CSS once and updates --scroll-* vars from ThemeSync vars.
  // It will theme this sidebar nav by adding `app-scrollbar` on the scroll container below.
  // It also themes the main page scrollbar via html/body classes.
  // eslint-disable-next-line react/jsx-no-useless-fragment
  // (keep it rendered once here—sidebar is always mounted)
  // (returns null)
  // ✅
  // ⬇
  // (see JSX)
  const preferences = useAuth((s) => s.preferences);

  // Read prefs (accent is still used for active states)
  const accentKey = preferences?.accent || "blue";
  const accentHex = ACCENT_HEX[accentKey] || ACCENT_HEX.blue;

  const accentVars = useMemo(() => {
    const soft = hexToRgba(accentHex, 0.1);
    const soft2 = hexToRgba(accentHex, 0.16);
    const ring = hexToRgba(accentHex, 0.28);
    return {
      "--accent": accentHex,
      "--accent-soft": soft,
      "--accent-soft2": soft2,
      "--accent-ring": ring,
    };
  }, [accentHex]);

  const adminId = String(admin?.id || admin?._id || "");
  const canSeePendingApprovals = ["admin", "supervisor"].includes(role);

  const { data: pendingCount = 0, isPending } = useQuery({
    queryKey: ["ctoPendingCount", adminId],
    queryFn: fetchCtoApplicationsPendingRequest,
    enabled: !!adminId && canSeePendingApprovals,
    staleTime: 1000 * 30,
  });

  const isLockedOpenRole = ["hr", "supervisor", "employee"].includes(role);

  const [hoveredItem, setHoveredItem] = useState(null);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });
  const [openMenus, setOpenMenus] = useState({});

  const safeNavigate = (path) => {
    if (typeof path !== "string") return;
    if (!path.startsWith("/app")) return;
    navigate(path);
  };

  const menuItems = useMemo(
    () => [
      {
        name: "CTO Service",
        icon: <Timer size={18} />,
        roles: ["admin", "hr", "supervisor", "employee"],
        subItems: [
          {
            name: "Dashboard",
            path: "/app",
            icon: <LayoutDashboard size={14} />,
            exact: true,
          },
          {
            name: "Credit CTO",
            path: "/app/cto-credit",
            icon: <CirclePlus size={14} />,
            roles: ["admin", "hr"],
          },
          {
            name: "My CTO Records",
            path: "/app/cto-my-credits",
            icon: <FileClock size={14} />,
          },
          {
            name: "Apply CTO Leave",
            path: "/app/cto-apply",
            icon: <PenLine size={14} />,
          },
          {
            name: "All CTO Applications",
            path: "/app/cto-all-applications",
            icon: <Files size={14} />,
            roles: ["admin", "hr"],
          },
          {
            name: "Pending Approvals",
            path: "/app/cto-approvals",
            icon: <UserCheck size={14} />,
            roles: ["admin", "supervisor"],
            badge: !canSeePendingApprovals
              ? null
              : isPending
                ? "..."
                : pendingCount > 0
                  ? pendingCount
                  : null,
          },
          {
            name: "All CTO Records",
            path: "/app/cto-records",
            icon: <Archive size={14} />,
            roles: ["admin", "hr"],
          },
        ],
      },
      {
        name: "Employee Management",
        icon: <UserRound size={18} />,
        path: "/app/employees",
        roles: ["admin", "hr"],
      },
      {
        name: "My Profile",
        icon: <UserCircle size={18} />,
        path: "/app/my-profile",
      },
      {
        name: "Appearance",
        icon: <Palette size={18} />,
        path: "/app/user-preferences",
        roles: ["admin", "hr", "supervisor", "employee"],
      },
      {
        name: "Audit Logs",
        icon: <ShieldCheck size={18} />,
        path: "/app/audit-logs",
        roles: ["admin", "hr"],
      },
      {
        name: "General Settings",
        icon: <Settings size={18} />,
        roles: ["admin", "hr"],
        subItems: [
          {
            name: "CTO Routing Settings",
            path: "/app/cto-settings",
            icon: <SlidersHorizontal size={14} />,
          },
          {
            name: "Designations Settings",
            path: "/app/designations",
            icon: <MapPin size={14} />,
          },
          {
            name: "Projects Settings",
            path: "/app/projects",
            icon: <FolderKanban size={14} />,
          },
          {
            name: "Session Settings",
            path: "/app/session-settings",
            icon: <Sliders size={14} />,
          },
          {
            name: "Working Day Settings",
            path: "/app/general-settings",
            icon: <CalendarDays size={14} />,
          },
          {
            name: "Email Notifications",
            path: "/app/email-notification-settings",
            icon: <Mail size={14} />,
          },
          {
            name: "Backup & Restore",
            path: "/app/backups",
            icon: <HardDrive size={14} />,
          },
        ],
      },
    ],
    [canSeePendingApprovals, isPending, pendingCount],
  );

  const { mutateAsync } = useMutation({
    mutationFn: getEmployees,
    onSuccess: (data) => queryClient.setQueryData(["employees"], data),
  });

  const normalize = (p) => (p || "").replace(/\/+$/, "") || "/";
  const isActive = (path, exact = false) => {
    const current = normalize(location.pathname);
    const target = normalize(path);

    if (exact) return current === target;
    return current === target || current.startsWith(target + "/");
  };

  const toggleMenu = (name) => {
    if (isLockedOpenRole) return;
    setOpenMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleItemClick = async (item) => {
    if (item.subItems) {
      if (isLockedOpenRole) return;
      if (collapsed && !mobileOpen) return;
      toggleMenu(item.name);
    } else {
      if (item.name === "Employee Management") await mutateAsync();

      if (item.path === "/app/cto-approvals" && canSeePendingApprovals) {
        queryClient.invalidateQueries({
          queryKey: ["ctoPendingCount", adminId],
        });
      }

      safeNavigate(item.path);
      if (window.innerWidth < 1024) setMobileOpen(false);
    }
  };

  const filteredItems = menuItems
    .filter((item) => !item.roles || item.roles.includes(role))
    .map((item) => ({
      ...item,
      subItems: item.subItems?.filter(
        (sub) => !sub.roles || sub.roles.includes(role),
      ),
    }));

  return (
    <>
      {/* ✅ Inject themed scrollbars + keep vars synced with ThemeSync */}
      <ScrollbarsSync />

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{
            backgroundColor: "rgba(2,6,23,0.40)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        style={accentVars}
        className={`fixed inset-y-0 left-0 z-50 border-r flex flex-col transition-all duration-150 lg:sticky lg:top-0 lg:h-screen flex-shrink-0
        bg-[color:var(--app-surface)] border-[color:var(--app-border)]
        ${collapsed ? "lg:w-20" : "lg:w-72"}
        ${
          mobileOpen
            ? "translate-x-0 w-72"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-shrink-0 items-center h-14 justify-between px-4 border-b border-[color:var(--app-border)]">
          {(!collapsed || mobileOpen) && (
            <img
              src="/logo_dict.png"
              alt="Logo"
              className="w-24 select-none ml-2"
            />
          )}

          <button
            onClick={() =>
              mobileOpen ? setMobileOpen(false) : setCollapsed(!collapsed)
            }
            className={`p-2 rounded-lg transition ${
              collapsed && !mobileOpen ? "mx-auto" : ""
            }`}
            style={{
              color: "var(--app-muted)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--accent-soft)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            type="button"
          >
            {mobileOpen ? (
              <X size={20} />
            ) : collapsed ? (
              <ChevronsRight size={20} />
            ) : (
              <ChevronsLeft size={20} />
            )}
          </button>
        </div>

        {/* ✅ Use ScrollbarsSync styling by using .app-scrollbar on the scroll container */}
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto no-scrollbar app-scrollbar">
          {filteredItems.map((item) => {
            const hasSubItems = item.subItems?.length > 0;

            const isSubItemActive =
              hasSubItems &&
              item.subItems.some((sub) => isActive(sub.path, sub.exact));

            const isMainItemActive = item.path && isActive(item.path);

            const isOpen =
              isLockedOpenRole || openMenus[item.name] || isSubItemActive;

            const activeMain =
              isMainItemActive || (isSubItemActive && collapsed);

            return (
              <div key={item.name} className="relative group/main">
                <div
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={(e) => {
                    if (collapsed && !mobileOpen && hasSubItems) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPopupCoords({ top: rect.top, left: rect.right });
                      setHoveredItem(item.name);
                    }
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={
                    activeMain
                      ? {
                          backgroundColor: "var(--accent)",
                          boxShadow:
                            "0 18px 45px -28px var(--accent-ring), 0 10px 30px -20px rgba(2,6,23,0.28)",
                          color: "#fff",
                        }
                      : {
                          color: "var(--app-muted)",
                        }
                  }
                  className={`flex items-center py-2.5 px-3 rounded-xl cursor-pointer transition-all duration-200
                    ${collapsed && !mobileOpen ? "justify-center" : "gap-3"}
                    ${activeMain ? "" : "hover:bg-[color:var(--accent-soft)]"}
                    ${isLockedOpenRole && hasSubItems ? "cursor-default" : ""}`}
                >
                  <div
                    style={{
                      color: activeMain ? "#fff" : "var(--app-muted)",
                    }}
                    className={
                      activeMain
                        ? ""
                        : "group-hover/main:text-[color:var(--accent)]"
                    }
                  >
                    {item.icon}
                  </div>

                  {(!collapsed || mobileOpen) && (
                    <>
                      <span
                        className="font-semibold whitespace-nowrap text-sm flex-1"
                        style={{
                          color: activeMain ? "#fff" : "var(--app-text)",
                        }}
                      >
                        {item.name}
                      </span>

                      {hasSubItems && !isLockedOpenRole && (
                        <ChevronDown
                          size={16}
                          style={{
                            color: activeMain ? "#fff" : "var(--app-muted)",
                          }}
                          className={`transition-transform duration-150 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </>
                  )}
                </div>

                {(!collapsed || mobileOpen) && hasSubItems && isOpen && (
                  <div className="ml-3 mt-1 border-l-2 pl-2 space-y-1 border-[color:var(--app-border)]">
                    {item.subItems.map((sub) => {
                      const subActive = isActive(sub.path, sub.exact);

                      return (
                        <div
                          key={sub.name}
                          onClick={() => {
                            if (
                              sub.path === "/app/cto-approvals" &&
                              canSeePendingApprovals
                            ) {
                              queryClient.invalidateQueries({
                                queryKey: ["ctoPendingCount", adminId],
                              });
                            }

                            safeNavigate(sub.path);
                            if (window.innerWidth < 1024) setMobileOpen(false);
                          }}
                          style={
                            subActive
                              ? { backgroundColor: "var(--accent-soft)" }
                              : { color: "var(--app-muted)" }
                          }
                          className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 text-[13px] font-medium transition-all
                            ${
                              subActive
                                ? "text-[color:var(--accent)]"
                                : "hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent)]"
                            }`}
                        >
                          <span
                            className="bg-[color:var(--app-surface)]/60 border border-[color:var(--app-border)] p-1.5 rounded-md"
                            style={{
                              color: subActive
                                ? "var(--accent)"
                                : "var(--app-muted)",
                            }}
                          >
                            {sub.icon}
                          </span>

                          <span
                            className="flex-1"
                            style={{
                              color: subActive
                                ? "var(--accent)"
                                : "var(--app-text)",
                            }}
                          >
                            {sub.name}
                          </span>

                          {sub.badge !== undefined && sub.badge !== null && (
                            <span
                              className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sub.badge === "..."
                                  ? "bg-gray-300 text-gray-800 animate-pulse"
                                  : "bg-red-500 text-white"
                              }`}
                            >
                              {sub.badge}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {collapsed &&
                  !mobileOpen &&
                  hasSubItems &&
                  hoveredItem === item.name &&
                  createPortal(
                    <div
                      style={{
                        position: "fixed",
                        top: popupCoords.top,
                        left: popupCoords.left,
                        paddingLeft: "10px",
                        ...accentVars,
                      }}
                      onMouseEnter={() => setHoveredItem(item.name)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="z-[100]"
                    >
                      <div className="border shadow-2xl rounded-2xl w-56 py-2 overflow-hidden bg-[color:var(--app-surface)] border-[color:var(--app-border)]">
                        <div
                          className="px-4 py-2 border-b mb-1 text-[11px] font-bold uppercase tracking-tight"
                          style={{
                            borderColor: "var(--app-border)",
                            color: "var(--app-muted)",
                          }}
                        >
                          {item.name}
                        </div>

                        {item.subItems.map((sub) => {
                          const subActive = isActive(sub.path, sub.exact);

                          return (
                            <div
                              key={sub.name}
                              onClick={() => {
                                if (
                                  sub.path === "/app/cto-approvals" &&
                                  canSeePendingApprovals
                                ) {
                                  queryClient.invalidateQueries({
                                    queryKey: ["ctoPendingCount", adminId],
                                  });
                                }

                                safeNavigate(sub.path);
                                setHoveredItem(null);
                              }}
                              style={
                                subActive
                                  ? {
                                      backgroundColor: "var(--accent)",
                                      color: "#fff",
                                      boxShadow:
                                        "0 12px 28px -22px var(--accent-ring)",
                                    }
                                  : { color: "var(--app-muted)" }
                              }
                              className={`px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center gap-3 ${
                                subActive
                                  ? ""
                                  : "hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent)]"
                              }`}
                            >
                              <span
                                style={{
                                  color: subActive
                                    ? "#fff"
                                    : "var(--app-muted)",
                                }}
                              >
                                {sub.icon}
                              </span>
                              {sub.name}
                            </div>
                          );
                        })}
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
