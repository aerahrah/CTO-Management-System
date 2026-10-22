// adminConsole.jsx
//
// 🔒 Owner-only admin console — its own full-screen layout (not inside /app),
// built like dashboardPage.jsx: sidebar + top bar + main area.
//   /<ADMIN_CONSOLE_PATH>                      → main menu (AdminConsoleHome)
//   /<ADMIN_CONSOLE_PATH>/cto-applications     → CTO application admin
//   /<ADMIN_CONSOLE_PATH>/cto-credits          → CTO credit memo admin
//   /<ADMIN_CONSOLE_PATH>/wellness-applications → Wellness application admin
//   /<ADMIN_CONSOLE_PATH>/wellness-credits     → Wellness credit admin
//
// Before showing anything, the layout asks the server (GET /api/admin/console/access).
// Accounts that aren't listed in CTO_SYNC_REFS (.env) get your normal 404 page,
// even admins whose role has "*". All links here are relative, so you can change
// ADMIN_CONSOLE_PATH in App.jsx without touching this file.

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useResolvedPath,
} from "react-router-dom";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import API from "../../api/api";
import { checkAdminConsoleAccess } from "../../api/adminConsole";
import {
  fetchCtoAdminApplications,
  searchCtoAdminEmployees,
} from "../../api/adminCtoApplication";
import {
  fetchWellnessAdminCredits,
  searchWellnessAdminEmployees,
} from "../../api/wellnessApplicationAdmin";
import {
  fetchCtoCreditAdminCredits,
  searchCtoCreditAdminEmployees,
} from "../../api/adminCtoCredit";
import {
  fetchWellnessAdminApplications,
  searchWellnessApplicationAdminEmployees,
} from "../../api/adminWellnessApplication";

import { useAuth } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";

import {
  Lock,
  LayoutGrid,
  ArrowLeft,
  Clock3,
  HeartPulse,
  CalendarHeart,
  Coins,
  Timer,
  Activity,
  Files,
  FileClock,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  LogOut,
  Palette,
  ArrowRight,
  UserSearch,
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

/* =====================================================================
   TOOLS — add future admin tools here (sidebar, top bar and main menu use this list)
===================================================================== */

const TOOLS = [
  {
    id: "cto",
    to: "cto-applications",
    label: "CTO Applications",
    icon: Clock3,
    permission: "cto.admin_view",
    description:
      "Find any CTO application and correct its status, hours, dates, memos, approvers and more. Check and fix CTO balances.",
  },
  {
    id: "ctoCredit",
    to: "cto-credits",
    label: "CTO Credit Memos",
    icon: FileClock,
    permission: "cto.credits_admin_view",
    description:
      "Correct any CTO credit memo: memo details and file, who got how many hours, rollbacks. Every change is checked against CSC limits.",
  },
  {
    id: "wellnessApp",
    to: "wellness-applications",
    label: "Wellness Applications",
    icon: CalendarHeart,
    permission: "wellness.applications_admin_view",
    description:
      "Find any Wellness Leave application and correct its status, days, dates, approvers and more. Credit batches and balances follow automatically.",
  },
  {
    id: "wellness",
    to: "wellness-credits",
    label: "Wellness Credits",
    icon: HeartPulse,
    permission: "wellness.admin_view",
    description:
      "Edit wellness credit batches and the employees in them. Check and fix wellness balances.",
  },
];

const STAT_TILES = {
  cto: [
    { key: "PENDING", label: "Pending", tone: "amber" },
    { key: "REVOCATION_REQUESTED", label: "Revocation", tone: "violet" },
    { key: "APPROVED", label: "Approved", tone: "green" },
    { key: "ALL", label: "All", tone: null },
  ],
  ctoCredit: [
    { key: "CREDITED", label: "Credited", tone: "green" },
    { key: "ROLLEDBACK", label: "Rolled back", tone: "red" },
    { key: "ALL", label: "All", tone: null },
  ],
  wellnessApp: [
    { key: "PENDING", label: "Pending", tone: "amber" },
    { key: "REVOCATION_REQUESTED", label: "Revocation", tone: "violet" },
    { key: "APPROVED", label: "Approved", tone: "green" },
    { key: "ALL", label: "All", tone: null },
  ],
  wellness: [
    { key: "CREDITED", label: "Credited", tone: "green" },
    { key: "ROLLEDBACK", label: "Rolled back", tone: "red" },
    { key: "EXPIRED", label: "Expired", tone: "amber" },
    { key: "ALL", label: "All", tone: null },
  ],
};

/* =====================================================================
   HELPERS
===================================================================== */

const BORDER = "var(--app-border, #e5e7eb)";

const TONES = {
  green: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.25)",
    color: "#16a34a",
  },
  red: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.25)",
    color: "#ef4444",
  },
  amber: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.30)",
    color: "#d97706",
  },
  violet: {
    backgroundColor: "rgba(139,92,246,0.10)",
    borderColor: "rgba(139,92,246,0.25)",
    color: "#7c3aed",
  },
  accent: {
    backgroundColor: "var(--accent-soft)",
    borderColor: "var(--accent-soft2)",
    color: "var(--accent)",
  },
};

const NAV_COLLAPSED_KEY = "adminConsole.navCollapsed";
/** Remembered collapsed/expanded choice. */
const readCollapsed = () => {
  let saved = null;
  try {
    saved = window.localStorage.getItem(NAV_COLLAPSED_KEY);
  } catch {
    /* storage blocked */
  }
  return saved === "1"; // starts expanded, like the main app's sidebar
};
const writeCollapsed = (value) => {
  try {
    window.localStorage.setItem(NAV_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    /* storage blocked: just don't remember it */
  }
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fullName = (e) =>
  e?.fullName ||
  `${e?.firstName || ""} ${e?.lastName || ""}`.trim() ||
  "Unknown employee";
const getInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
const shortId = (id) => (id ? String(id).slice(-6).toUpperCase() : "");

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

function useThemeColors() {
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolved = useMemo(() => resolveTheme(prefTheme), [prefTheme]);
  return useMemo(
    () =>
      resolved === "dark"
        ? {
            borderColor: "rgba(255,255,255,0.07)",
            skeleton: {
              baseColor: "rgba(255,255,255,0.06)",
              highlightColor: "rgba(255,255,255,0.10)",
            },
          }
        : {
            borderColor: "rgba(15,23,42,0.10)",
            skeleton: {
              baseColor: "rgba(15,23,42,0.06)",
              highlightColor: "rgba(15,23,42,0.10)",
            },
          },
    [resolved],
  );
}

/** Tools this account's role allows (the server checks again on every request). */
function useAllowedTools() {
  const { can } = usePermissions();
  return TOOLS.filter((t) => can(t.permission));
}

/** Where each tool's status counts come from (same query keys as the tools, so saves refresh them). */
const STATS_SOURCES = {
  cto: {
    key: "ctoAdminApplications",
    fetch: () => fetchCtoAdminApplications({ limit: 1 }),
  },
  ctoCredit: {
    key: "ctoCreditAdminCredits",
    fetch: () => fetchCtoCreditAdminCredits({ limit: 1 }),
  },
  wellnessApp: {
    key: "wellnessAdminApplications",
    fetch: () => fetchWellnessAdminApplications({ limit: 1 }),
  },
  wellness: {
    key: "wellnessAdminCredits",
    fetch: () => fetchWellnessAdminCredits({ limit: 1 }),
  },
};

function useToolStats(toolId, enabled = true) {
  const source = STATS_SOURCES[toolId];
  return useQuery({
    queryKey: [source.key, "consoleStats"],
    queryFn: source.fetch,
    select: (data) => data?.statusCounts || {},
    enabled,
    staleTime: 60_000,
  });
}

/** Closes a popup when clicking/tapping outside it or pressing Escape. */
function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

/* =====================================================================
   LAYOUT  (/<ADMIN_CONSOLE_PATH>/*)
===================================================================== */

export default function AdminConsoleLayout({ notFound = null }) {
  const access = useQuery({
    queryKey: ["adminConsoleAccess"],
    queryFn: checkAdminConsoleAccess,
    retry: false,
    staleTime: 0,
    gcTime: 0, // ask again every time the console is opened
    refetchOnWindowFocus: false,
  });

  // Show nothing until the server says yes, so other people never see the console.
  if (access.isPending) return null;

  if (access.isError) {
    if ([403, 404].includes(access.error?.status)) return notFound;
    return (
      <div
        className="h-screen w-full flex flex-col items-center justify-center gap-3 p-6 text-center"
        style={{ backgroundColor: "var(--app-bg, #f5f5f5)" }}
      >
        <AlertTriangle className="w-8 h-8" style={{ color: "#d97706" }} />
        <p className="text-sm" style={{ color: "var(--app-muted, #64748b)" }}>
          Something went wrong. Please try again.
        </p>
        <button
          type="button"
          onClick={() => access.refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold"
          style={TONES.accent}
        >
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    );
  }

  return <ConsoleShell />;
}

function ConsoleShell() {
  const base = useResolvedPath(".").pathname;
  const location = useLocation();
  const tools = useAllowedTools();
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const setCollapsed = (value) => {
    writeCollapsed(value);
    setCollapsedState(value);
  };
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the phone menu after moving to another page.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const ctoStats = useToolStats(
    "cto",
    tools.some((t) => t.id === "cto"),
  );
  const pendingCto = ctoStats.data?.PENDING || 0;
  const wellnessStats = useToolStats(
    "wellnessApp",
    tools.some((t) => t.id === "wellnessApp"),
  );
  const pendingWellness = wellnessStats.data?.PENDING || 0;

  const menu = useMemo(
    () => buildMenu(base, tools, pendingCto, pendingWellness),
    [base, tools, pendingCto, pendingWellness],
  );

  return (
    <div
      className="flex h-screen w-full overflow-hidden transition-colors"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <AdminSidebar
        menu={menu}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <nav
          className="relative flex-shrink-0 z-30 flex justify-between items-center gap-3 h-14 px-4 lg:px-10 backdrop-blur-md transition-colors"
          style={{
            backgroundColor: "var(--app-surface, rgba(255,255,255,0.80))",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-lg lg:hidden transition hover:bg-[var(--accent-soft)]"
              style={{ color: "var(--app-muted, #475569)" }}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
            <ConsoleTrail base={base} pathname={location.pathname} />
          </div>
          <ProfileMenu />
        </nav>

        <main
          className="flex-1 overflow-y-auto px-1.5 md:py-3 md:px-4 custom-scrollbar transition-colors"
          style={{ backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))" }}
        >
          <div className="max-w-full mx-auto">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ------------------ Sidebar (same look as components/sidebar.jsx) ------------------ */

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

function useAccentVars() {
  const accentKey = useAuth((s) => s.preferences?.accent) || "blue";
  const accentHex = ACCENT_HEX[accentKey] || ACCENT_HEX.blue;
  return useMemo(
    () => ({
      "--accent": accentHex,
      "--accent-soft": hexToRgba(accentHex, 0.1),
      "--accent-soft2": hexToRgba(accentHex, 0.16),
      "--accent-ring": hexToRgba(accentHex, 0.28),
    }),
    [accentHex],
  );
}

const ACTIVE_MAIN_STYLE = {
  backgroundColor: "var(--accent)",
  boxShadow:
    "0 18px 45px -28px var(--accent-ring), 0 10px 30px -20px rgba(2,6,23,0.28)",
  color: "#fff",
};

const normalizePath = (p) => (p || "").replace(/\/+$/, "") || "/";
const subLink = (sub) => (sub.view ? `${sub.path}?view=${sub.view}` : sub.path);

/** The console's menu, in the same shape as your main sidebar's menuItems. */
function buildMenu(base, tools, pendingCto, pendingWellness = 0) {
  const has = (id) => tools.some((t) => t.id === id);
  const items = [
    { name: "Main Menu", icon: LayoutGrid, path: base, exact: true },
  ];
  const ctoSubItems = [];
  if (has("cto")) {
    ctoSubItems.push({
      name: "Applications",
      icon: Files,
      path: `${base}/cto-applications`,
      view: "",
      badge: pendingCto > 0 ? pendingCto : null,
    });
  }
  if (has("ctoCredit")) {
    // no `view`: stays highlighted on both of its tabs and on the edit page
    ctoSubItems.push({
      name: "Credit Memos",
      icon: FileClock,
      path: `${base}/cto-credits`,
    });
  }
  if (has("cto")) {
    ctoSubItems.push({
      name: "Employee Lookup",
      icon: UserSearch,
      path: `${base}/cto-applications`,
      view: "employees",
    });
  }
  if (ctoSubItems.length) {
    items.push({ name: "CTO Admin", icon: Timer, subItems: ctoSubItems });
  }
  const wellnessSubItems = [];
  if (has("wellnessApp")) {
    wellnessSubItems.push({
      name: "Applications",
      icon: Files,
      path: `${base}/wellness-applications`,
      view: "",
      badge: pendingWellness > 0 ? pendingWellness : null,
    });
  }
  if (has("wellness")) {
    wellnessSubItems.push(
      has("wellnessApp")
        ? // no `view`: stays highlighted on both of its tabs and on the edit page
          {
            name: "Credit Batches",
            icon: Coins,
            path: `${base}/wellness-credits`,
          }
        : {
            name: "Credit Batches",
            icon: Files,
            path: `${base}/wellness-credits`,
            view: "",
          },
    );
  }
  if (wellnessSubItems.length) {
    wellnessSubItems.push({
      name: "Employee Lookup",
      icon: UserSearch,
      path: `${base}/${has("wellnessApp") ? "wellness-applications" : "wellness-credits"}`,
      view: "employees",
    });
    items.push({
      name: "Wellness Admin",
      icon: Activity,
      subItems: wellnessSubItems,
    });
  }
  return items;
}

const SubBadge = ({ value }) => (
  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
    {value > 99 ? "99+" : value}
  </span>
);

function AdminSidebar({
  menu,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) {
  const location = useLocation();
  const accentVars = useAccentVars();
  const compact = collapsed && !mobileOpen;

  const [openMenus, setOpenMenus] = useState({
    "CTO Admin": true,
    "Wellness Admin": true,
  });
  const [hoveredItem, setHoveredItem] = useState(null);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen]);

  const here = normalizePath(location.pathname);
  const view = new URLSearchParams(location.search).get("view") || "";
  const isActive = (item) => {
    const target = normalizePath(item.path);
    const pathMatch = item.exact
      ? here === target
      : here === target || here.startsWith(`${target}/`);
    if (!pathMatch) return false;
    return item.view === undefined ? true : view === item.view;
  };

  const mainRowClass = (active) =>
    `flex items-center py-2.5 px-3 rounded-xl cursor-pointer transition-all duration-200 ${
      compact ? "justify-center" : "gap-3"
    } ${active ? "" : "hover:bg-[color:var(--accent-soft)]"}`;

  const MainRowContent = ({ item, active, chevron, open }) => {
    const Icon = item.icon;
    return (
      <>
        <span
          style={{ color: active ? "#fff" : "var(--app-muted)" }}
          className={
            active ? "" : "group-hover/main:text-[color:var(--accent)]"
          }
        >
          <Icon size={18} />
        </span>
        {!compact && (
          <>
            <span
              className="font-semibold whitespace-nowrap text-sm flex-1 text-left"
              style={{ color: active ? "#fff" : "var(--app-text)" }}
            >
              {item.name}
            </span>
            {chevron && (
              <ChevronDown
                size={16}
                style={{ color: active ? "#fff" : "var(--app-muted)" }}
                className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
              />
            )}
          </>
        )}
      </>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{
            backgroundColor: "rgba(2,6,23,0.40)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Admin console"
        style={accentVars}
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r flex flex-col transition-all duration-150 lg:sticky lg:top-0 lg:h-screen flex-shrink-0
        bg-[color:var(--app-surface)] border-[color:var(--app-border)]
        ${collapsed ? "lg:w-20" : "lg:w-72"}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo + collapse / close */}
        <div className="flex flex-shrink-0 items-center h-14 justify-between px-4 border-b border-[color:var(--app-border)]">
          {!compact && (
            <div className="flex items-center gap-2 ml-2 min-w-0">
              <img
                src="/logo_dict.png"
                alt="Logo"
                className="w-24 select-none"
              />
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <Lock size={10} /> Admin
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              mobileOpen ? setMobileOpen(false) : setCollapsed(!collapsed)
            }
            className={`p-2 rounded-lg transition hover:bg-[color:var(--accent-soft)] ${compact ? "mx-auto" : ""}`}
            style={{ color: "var(--app-muted)" }}
            aria-label={
              mobileOpen
                ? "Close menu"
                : collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
            title={
              mobileOpen
                ? "Close menu"
                : collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
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

        {/* Menu */}
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto no-scrollbar app-scrollbar">
          {menu.map((item) => {
            const hasSubItems = item.subItems?.length > 0;
            const isSubItemActive = hasSubItems && item.subItems.some(isActive);
            const isMainItemActive = !!item.path && isActive(item);
            const isOpen = openMenus[item.name] || isSubItemActive;
            const activeMain = isMainItemActive || (isSubItemActive && compact);

            return (
              <div key={item.name} className="relative group/main">
                {hasSubItems ? (
                  <button
                    type="button"
                    onClick={() =>
                      !compact &&
                      setOpenMenus((m) => ({
                        ...m,
                        [item.name]: !m[item.name],
                      }))
                    }
                    onMouseEnter={(e) => {
                      if (!compact) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPopupCoords({ top: rect.top, left: rect.right });
                      setHoveredItem(item.name);
                    }}
                    onMouseLeave={() => setHoveredItem(null)}
                    aria-expanded={compact ? undefined : !!isOpen}
                    aria-label={compact ? item.name : undefined}
                    className={`w-full ${mainRowClass(activeMain)}`}
                    style={
                      activeMain
                        ? ACTIVE_MAIN_STYLE
                        : { color: "var(--app-muted)" }
                    }
                  >
                    <MainRowContent
                      item={item}
                      active={activeMain}
                      chevron
                      open={isOpen}
                    />
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    title={compact ? item.name : undefined}
                    aria-label={compact ? item.name : undefined}
                    aria-current={activeMain ? "page" : undefined}
                    className={mainRowClass(activeMain)}
                    style={
                      activeMain
                        ? ACTIVE_MAIN_STYLE
                        : { color: "var(--app-muted)" }
                    }
                  >
                    <MainRowContent item={item} active={activeMain} />
                  </Link>
                )}

                {/* Sub items (expanded) */}
                {!compact && hasSubItems && isOpen && (
                  <div className="ml-3 mt-1 border-l-2 pl-2 space-y-1 border-[color:var(--app-border)]">
                    {item.subItems.map((sub) => {
                      const subActive = isActive(sub);
                      const SubIcon = sub.icon;
                      return (
                        <Link
                          key={sub.name}
                          to={subLink(sub)}
                          aria-current={subActive ? "page" : undefined}
                          style={
                            subActive
                              ? { backgroundColor: "var(--accent-soft)" }
                              : { color: "var(--app-muted)" }
                          }
                          className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 text-[13px] font-medium transition-all ${
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
                            <SubIcon size={14} />
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
                          {sub.badge ? <SubBadge value={sub.badge} /> : null}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Sub items (collapsed: pop-out on hover) */}
                {compact &&
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
                          const subActive = isActive(sub);
                          const SubIcon = sub.icon;
                          return (
                            <Link
                              key={sub.name}
                              to={subLink(sub)}
                              onClick={() => setHoveredItem(null)}
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
                                <SubIcon size={14} />
                              </span>
                              {sub.name}
                              {sub.badge ? (
                                <SubBadge value={sub.badge} />
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    </div>,
                    document.body,
                  )}

                {/* collapsed: red dot when a group has a count */}
                {compact &&
                  hasSubItems &&
                  item.subItems.some((s) => s.badge) && (
                    <span
                      className="absolute top-1.5 right-3 h-2 w-2 rounded-full bg-red-500"
                      aria-hidden="true"
                    />
                  )}
              </div>
            );
          })}
        </nav>

        {/* Back to the main app */}
        <div className="flex-shrink-0 p-3 border-t border-[color:var(--app-border)]">
          <div className="relative group/main">
            <Link
              to="/app"
              title={compact ? "Back to Main App" : undefined}
              aria-label={compact ? "Back to Main App" : undefined}
              className={mainRowClass(false)}
              style={{ color: "var(--app-muted)" }}
            >
              <MainRowContent
                item={{ name: "Back to Main App", icon: ArrowLeft }}
                active={false}
              />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ------------------ Top bar: where you are ------------------ */

function ConsoleTrail({ base, pathname }) {
  const parts = pathname.slice(base.length).split("/").filter(Boolean);
  const tool = TOOLS.find((t) => t.to === parts[0]);
  const crumbs = [{ label: "Admin Console", to: base }];
  if (tool) crumbs.push({ label: tool.label, to: `${base}/${tool.to}` });
  if (tool && parts[1])
    crumbs.push({ label: `#${shortId(decodeURIComponent(parts[1]))}` });
  if (!tool) crumbs.push({ label: "Main menu" });

  return (
    <ol
      className="flex items-center gap-1.5 min-w-0 text-sm"
      aria-label="You are here"
    >
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <li
            key={c.label}
            className={`items-center gap-1.5 min-w-0 ${last ? "flex" : "hidden sm:flex"}`}
          >
            {i > 0 && (
              <ChevronRight
                size={14}
                className="hidden sm:block flex-none"
                style={{ color: "var(--app-muted, #94a3b8)" }}
              />
            )}
            {last ? (
              <span
                className="font-bold truncate"
                style={{ color: "var(--app-text, #0f172a)" }}
                aria-current="page"
              >
                {c.label}
              </span>
            ) : (
              <Link
                to={c.to}
                className="font-semibold truncate hover:underline"
                style={{ color: "var(--app-muted, #64748b)" }}
              >
                {c.label}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------ Top bar: profile menu (same as the main app's) ------------------ */

function ProfileMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const admin = useAuth((s) => s.admin);
  const logout = useAuth((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));

  const name = admin?.firstName
    ? `${admin.firstName} ${admin.lastName || ""}`.trim()
    : admin?.email || "User";
  const role =
    typeof admin?.role === "object" ? admin?.role?.name : admin?.role;
  const initials =
    admin?.firstName && admin?.lastName
      ? `${admin.firstName[0]}${admin.lastName[0]}`.toUpperCase()
      : admin?.email
        ? admin.email[0].toUpperCase()
        : "U";

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  const handleLogout = async () => {
    try {
      await API.post("/employee/logout");
    } catch (error) {
      console.error("Failed to logout on the server:", error);
    } finally {
      logout?.();
      queryClient.clear();
      navigate("/");
    }
  };

  const itemClass =
    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]";

  return (
    <div className="relative flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 lg:gap-3 pl-2 pr-3 lg:px-4 py-1.5 rounded-full border border-transparent transition-all hover:bg-[var(--accent-soft)] hover:border-[var(--app-border,#e5e7eb)]"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: "var(--accent, #2563EB)" }}
        >
          {initials}
        </span>
        <span className="hidden sm:block text-left">
          <span
            className="block text-sm font-semibold leading-tight truncate max-w-[150px]"
            style={{ color: "var(--app-text, #0f172a)" }}
          >
            {name}
          </span>
          {role && (
            <span
              className="block text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--app-muted, #64748b)" }}
            >
              {role}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--app-muted, #94a3b8)" }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] z-[100] rounded-2xl shadow-2xl py-2"
          style={{
            backgroundColor: "var(--app-surface, #ffffff)",
            border: `1px solid ${BORDER}`,
          }}
        >
          <div
            className="px-4 py-3"
            style={{ borderBottom: `1px solid ${BORDER}` }}
          >
            <p
              className="text-[10px] font-bold uppercase mb-1"
              style={{ color: "var(--app-muted, #64748b)" }}
            >
              Signed in as
            </p>
            <p
              className="text-sm font-bold truncate"
              style={{ color: "var(--app-text, #0f172a)" }}
              title={admin?.email}
            >
              {admin?.email || name}
            </p>
          </div>
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => go("/app")}
              className={itemClass}
              style={{ color: "var(--app-text, #0f172a)" }}
            >
              <ArrowLeft size={16} /> Back to main app
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => go("/app/user-preferences")}
              className={itemClass}
              style={{ color: "var(--app-text, #0f172a)" }}
            >
              <Palette size={16} /> Appearance
            </button>
          </div>
          <div className="h-px my-1" style={{ backgroundColor: BORDER }} />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-[rgba(220,38,38,0.06)]"
            style={{ color: "var(--danger, #dc2626)" }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   MAIN MENU  (/<ADMIN_CONSOLE_PATH>)
===================================================================== */

export function AdminConsoleHome() {
  const { borderColor, skeleton } = useThemeColors();
  const tools = useAllowedTools();

  // No fixed-height box here: the page just grows and the console's main area
  // scrolls it (same as normal pages in the main app).
  return (
    <SkeletonTheme
      baseColor={skeleton.baseColor}
      highlightColor={skeleton.highlightColor}
    >
      <div
        className="w-full pt-2 md:pt-0 pb-6 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-text, #0f172a)" }}
      >
        <div className="pt-2 pb-3 md:pb-6 px-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-sans">
            Admin Console
          </h1>
          <p
            className="text-sm mt-1 max-w-2xl"
            style={{ color: "var(--app-muted)" }}
          >
            Your private tools. Only the accounts listed on the server can open
            this page.
          </p>
        </div>

        {tools.length === 0 ? (
          <div
            className="rounded-xl border p-6 text-sm"
            style={{
              borderColor,
              backgroundColor: "var(--app-surface)",
              color: "var(--app-muted)",
            }}
          >
            Your role doesn't have any admin tool permissions yet (
            <b>cto.admin_view</b>, <b>cto.credits_admin_view</b>,{" "}
            <b>wellness.applications_admin_view</b>, <b>wellness.admin_view</b>
            ).
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} borderColor={borderColor} />
              ))}
            </div>
            <EmployeeJump tools={tools} borderColor={borderColor} />
          </div>
        )}
      </div>
    </SkeletonTheme>
  );
}

const ToolCard = ({ tool, borderColor }) => {
  const stats = useToolStats(tool.id);
  const Icon = tool.icon;
  const counts = stats.data || {};

  return (
    <section
      aria-label={tool.label}
      className="rounded-xl border shadow-sm flex flex-col"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="p-4 md:p-5 flex items-start gap-3">
        <span
          className="h-11 w-11 rounded-xl flex items-center justify-center flex-none"
          style={TONES.accent}
        >
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="text-base font-bold"
            style={{ color: "var(--app-text)" }}
          >
            {tool.label}
          </h2>
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{ color: "var(--app-muted)" }}
          >
            {tool.description}
          </p>
        </div>
      </div>

      <div
        className={`px-4 md:px-5 grid gap-2 ${
          STAT_TILES[tool.id].length === 3
            ? "grid-cols-3"
            : "grid-cols-2 sm:grid-cols-4"
        }`}
      >
        {STAT_TILES[tool.id].map((tile) => {
          const value = counts[tile.key] ?? 0;
          const toned = tile.tone && value > 0;
          return (
            <Link
              key={tile.key}
              to={
                tile.key === "ALL" ? tool.to : `${tool.to}?status=${tile.key}`
              }
              className="rounded-lg border px-3 py-2 transition-transform duration-200 ease-out active:scale-95"
              style={
                toned
                  ? TONES[tile.tone]
                  : { backgroundColor: "var(--app-surface-2)", borderColor }
              }
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wide truncate"
                style={{ color: toned ? undefined : "var(--app-muted)" }}
              >
                {tile.label}
              </div>
              <div
                className="text-lg font-bold"
                style={{ color: toned ? undefined : "var(--app-text)" }}
              >
                {stats.isPending ? (
                  <Skeleton width={28} />
                ) : stats.isError ? (
                  "–"
                ) : (
                  value
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div
        className="mt-4 p-3 md:px-5 border-t flex items-center justify-between gap-3"
        style={{ borderColor }}
      >
        <Link
          to={`${tool.to}?view=employees`}
          className="inline-flex items-center gap-1.5 text-xs font-bold"
          style={{ color: "var(--app-muted)" }}
        >
          <UserSearch size={14} /> Employee lookup
        </Link>
        <Link
          to={tool.to}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-transform duration-200 ease-out active:scale-95"
          style={{ backgroundColor: "var(--accent, #2563EB)" }}
        >
          Open <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
};

/** Search once, then jump to that employee in either tool. */
const EmployeeJump = ({ tools, borderColor }) => {
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 300);
  const hasCto = tools.some((t) => t.id === "cto");
  const hasCtoCredit = tools.some((t) => t.id === "ctoCredit");
  const hasWellnessApp = tools.some((t) => t.id === "wellnessApp");
  const hasWellness = tools.some((t) => t.id === "wellness");
  // any CTO tool → show CTO balances; otherwise wellness
  const searchWith = hasCto
    ? "cto"
    : hasCtoCredit
      ? "ctoCredit"
      : hasWellnessApp
        ? "wellnessApp"
        : "wellness";
  const showsCto = searchWith === "cto" || searchWith === "ctoCredit";

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["adminConsoleEmployeeJump", searchWith, q],
    queryFn: () =>
      searchWith === "cto"
        ? searchCtoAdminEmployees({ q, limit: 8 })
        : searchWith === "ctoCredit"
          ? searchCtoCreditAdminEmployees({ q, limit: 8 })
          : searchWith === "wellnessApp"
            ? searchWellnessApplicationAdminEmployees({ q, limit: 8 })
            : searchWellnessAdminEmployees({ q, limit: 8 }),
    enabled: q.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const results = q ? data?.results || [] : [];

  return (
    <section
      aria-label="Find an employee"
      className="rounded-xl border shadow-sm"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="p-4 md:p-5">
        <h2
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: "var(--app-muted)" }}
        >
          <UserSearch className="w-4 h-4" /> Find an employee
        </h2>
        <div className="relative mt-3">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--app-muted)" }}
          />
          <input
            type="text"
            value={query}
            maxLength={100}
            autoComplete="off"
            aria-label="Search employees"
            placeholder="Type a name, email, position or division..."
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-lg text-sm outline-none border transition-colors duration-200 ease-out focus:border-[color:var(--accent)]"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
            }}
          />
          {isFetching && q ? (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
              style={{ color: "var(--app-muted)" }}
            />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                style={{ color: "var(--app-muted)" }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )
          )}
        </div>
      </div>

      {q && (
        <ul className="border-t" style={{ borderColor }}>
          {isError && (
            <li
              className="px-4 md:px-5 py-3 text-xs"
              style={{ color: "#ef4444" }}
            >
              {error?.message || "Search failed."}
            </li>
          )}
          {!isError && !isFetching && results.length === 0 && (
            <li
              className="px-4 md:px-5 py-3 text-xs"
              style={{ color: "var(--app-muted)" }}
            >
              No employees match “{q}”.
            </li>
          )}
          {results.map((emp) => {
            const id = encodeURIComponent(String(emp._id));
            const balance = showsCto ? emp.ctoBalance : emp.wellnessBalance;
            return (
              <li
                key={emp._id}
                className="px-4 md:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b last:border-b-0"
                style={{ borderColor }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
                    style={TONES.accent}
                  >
                    {getInitials(fullName(emp))}
                  </span>
                  <div className="min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--app-text)" }}
                    >
                      {fullName(emp)}
                    </div>
                    <div
                      className="text-[11px] truncate"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {[emp.position, emp.division, emp.employeeType]
                        .filter(Boolean)
                        .join(" · ")}
                      {balance !== undefined && balance !== null && (
                        <>
                          {" "}
                          ·{" "}
                          {showsCto
                            ? `CTO ${round2(balance)}h`
                            : `Wellness ${round2(balance)}d`}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-none">
                  {hasCto && (
                    <Link
                      to={`cto-applications?view=employees&employee=${id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor,
                        color: "var(--app-text)",
                      }}
                    >
                      <Clock3 size={13} /> CTO
                    </Link>
                  )}
                  {hasCtoCredit && (
                    <Link
                      to={`cto-credits?view=employees&employee=${id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor,
                        color: "var(--app-text)",
                      }}
                    >
                      <FileClock size={13} /> Memos
                    </Link>
                  )}
                  {hasWellnessApp && (
                    <Link
                      to={`wellness-applications?view=employees&employee=${id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor,
                        color: "var(--app-text)",
                      }}
                    >
                      <CalendarHeart size={13} /> Wellness
                    </Link>
                  )}
                  {hasWellness && (
                    <Link
                      to={`wellness-credits?view=employees&employee=${id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor,
                        color: "var(--app-text)",
                      }}
                    >
                      {hasWellnessApp ? (
                        <>
                          <Coins size={13} /> Batches
                        </>
                      ) : (
                        <>
                          <HeartPulse size={13} /> Wellness
                        </>
                      )}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
