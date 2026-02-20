// Sidebar.jsx
import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployees } from "../api/employee";
import { fetchCtoApplicationsPendingRequest } from "../api/cto";
import {
  X,
  UserRound, // For Employee Management
  Settings,
  Sliders,
  Timer, // For CTO Service Parent
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  ChevronDown,
  CirclePlus, // For Credit CTO
  FileClock, // For My Records
  PenLine, // For Apply Leave
  Files, // For All Applications
  UserCheck, // For Pending Approvals
  Archive, // For All Records
  ShieldCheck, // For Audit Logs
  UserCircle, // For My Profile
  MapPin, // For Office Locations
  SlidersHorizontal, // For CTO Settings
  FolderKanban, // Projects icon
  HardDrive, // ✅ NEW: Backup & Restore icon
  CalendarDays, // ✅ NEW: Working Day Settings icon
} from "lucide-react";

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

  const { data: pendingCount = 0, isPending } = useQuery({
    queryKey: ["ctoPendingCount"],
    queryFn: fetchCtoApplicationsPendingRequest,
    staleTime: 5 * 60 * 1000,
  });

  const isLockedOpenRole = ["hr", "supervisor", "employee"].includes(role);

  const [hoveredItem, setHoveredItem] = useState(null);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });
  const [openMenus, setOpenMenus] = useState({});

  // ✅ small security hardening: prevent accidental navigation outside your app base
  const safeNavigate = (path) => {
    if (typeof path !== "string") return;
    if (!path.startsWith("/app")) return;
    navigate(path);
  };

  const menuItems = [
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
          badge: isPending ? "..." : pendingCount > 0 ? pendingCount : null,
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
          // ✅ NEW: Backup & Restore
          name: "Backup & Restore",
          path: "/app/backups",
          icon: <HardDrive size={14} />,
        },
      ],
    },
  ];

  const { mutateAsync } = useMutation({
    mutationFn: getEmployees,
    onSuccess: (data) => queryClient.setQueryData(["employees"], data),
  });

  // ✅ FIX: "/app" should only be active on EXACT "/app" (not "/app/anything")
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
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 lg:sticky lg:top-0 lg:h-screen flex-shrink-0
        ${collapsed ? "lg:w-20" : "lg:w-72"}
        ${
          mobileOpen
            ? "translate-x-0 w-72"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-shrink-0 items-center h-14 justify-between px-4 border-b border-slate-100">
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
            className={`p-2 rounded-lg hover:bg-slate-100 transition text-slate-500 ${
              collapsed && !mobileOpen ? "mx-auto" : ""
            }`}
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

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto no-scrollbar">
          {filteredItems.map((item) => {
            const hasSubItems = item.subItems?.length > 0;

            const isSubItemActive =
              hasSubItems &&
              item.subItems.some((sub) => isActive(sub.path, sub.exact));

            const isMainItemActive = item.path && isActive(item.path);

            const isOpen =
              isLockedOpenRole || openMenus[item.name] || isSubItemActive;

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
                  className={`flex items-center py-2.5 px-3 rounded-xl cursor-pointer transition-all duration-200
                    ${collapsed && !mobileOpen ? "justify-center" : "gap-3"}
                    ${
                      isMainItemActive || (isSubItemActive && collapsed)
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                        : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                    }
                    ${isLockedOpenRole && hasSubItems ? "cursor-default" : ""}`}
                >
                  <div
                    className={
                      isMainItemActive || (isSubItemActive && collapsed)
                        ? "text-white"
                        : "text-slate-400 group-hover/main:text-blue-600"
                    }
                  >
                    {item.icon}
                  </div>

                  {(!collapsed || mobileOpen) && (
                    <>
                      <span className="font-semibold whitespace-nowrap text-sm flex-1">
                        {item.name}
                      </span>
                      {hasSubItems && !isLockedOpenRole && (
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-300 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </>
                  )}
                </div>

                {(!collapsed || mobileOpen) && hasSubItems && isOpen && (
                  <div className="ml-3 mt-1 border-l-2 border-slate-100 pl-2 space-y-1">
                    {item.subItems.map((sub) => (
                      <div
                        key={sub.name}
                        onClick={() => {
                          safeNavigate(sub.path);
                          if (window.innerWidth < 1024) setMobileOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 text-[13px] font-medium transition-all
                          ${
                            isActive(sub.path, sub.exact)
                              ? "text-blue-600 bg-blue-50"
                              : "text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                          }`}
                      >
                        <span
                          className={
                            isActive(sub.path, sub.exact)
                              ? "text-blue-600 bg-slate-50 border-slate-100 p-1.5 rounded-md"
                              : "text-slate-400 bg-slate-50 p-1.5 rounded-md"
                          }
                        >
                          {sub.icon}
                        </span>
                        <span className="flex-1">{sub.name}</span>

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
                    ))}
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
                      }}
                      onMouseEnter={() => setHoveredItem(item.name)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="z-[100]"
                    >
                      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-56 py-2 overflow-hidden">
                        <div className="px-4 py-2 border-b border-slate-50 mb-1 text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                          {item.name}
                        </div>

                        {item.subItems.map((sub) => (
                          <div
                            key={sub.name}
                            onClick={() => {
                              safeNavigate(sub.path);
                              setHoveredItem(null);
                            }}
                            className={`px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center gap-3 ${
                              isActive(sub.path, sub.exact)
                                ? "bg-blue-600 text-white"
                                : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                            }`}
                          >
                            <span
                              className={
                                isActive(sub.path, sub.exact)
                                  ? "text-white"
                                  : "text-slate-400"
                              }
                            >
                              {sub.icon}
                            </span>
                            {sub.name}
                          </div>
                        ))}
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
