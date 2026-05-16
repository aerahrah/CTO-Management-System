import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Search,
  Eye,
  ChevronRight,
} from "lucide-react";

import { getRoles, deleteRole } from "../../../api/role";
import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";

/* =========================
   Helpers & Theme Logic
========================= */
const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

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

/* =========================
   UI Primitives
========================= */
const Card = ({ children, className = "", borderColor, onClick }) => (
  <div
    onClick={onClick}
    className={[
      "rounded-xl overflow-hidden transition-all duration-300 ease-out",
      onClick
        ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
        : "shadow-sm",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
    }}
  >
    {children}
  </div>
);

const PrimaryButton = ({
  children,
  disabled,
  onClick,
  className = "",
  borderColor,
  theme,
}) => {
  const disabledBg =
    theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ease-out active:scale-[0.98]",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "var(--accent)",
        color: disabled ? "var(--app-muted)" : "#ffffff",
        border: `1px solid ${disabled ? borderColor : "var(--accent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        boxShadow: disabled ? "none" : "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      {children}
    </button>
  );
};

const GhostButton = ({
  children,
  disabled,
  onClick,
  className = "",
  borderColor,
  theme,
  danger,
}) => {
  const disabledBg =
    theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ease-out active:scale-[0.98]",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "transparent",
        color: disabled
          ? "var(--app-muted)"
          : danger
            ? "#ef4444"
            : "var(--app-text)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : borderColor}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.backgroundColor =
            theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
};

const SkeletonLine = ({ width = "100%", height = 16, theme }) => (
  <div
    className="rounded animate-pulse"
    style={{
      width,
      height,
      backgroundColor:
        theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
    }}
  />
);

const SkeletonCard = ({ theme, borderColor }) => (
  <Card
    borderColor={borderColor}
    className="p-5 flex flex-col justify-between h-48"
  >
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <SkeletonLine width="60%" height={24} theme={theme} />
        <SkeletonLine width={24} height={24} theme={theme} />
      </div>
      <div className="space-y-2">
        <SkeletonLine width="100%" height={14} theme={theme} />
        <SkeletonLine width="80%" height={14} theme={theme} />
      </div>
    </div>
    <div
      className="pt-4 border-t mt-4 flex justify-between"
      style={{ borderColor }}
    >
      <SkeletonLine width="30%" height={20} theme={theme} />
      <SkeletonLine width="20%" height={14} theme={theme} />
    </div>
  </Card>
);

/* =========================
   Main Component
========================= */
export default function RolesSettings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.07)"
        : "rgba(15,23,42,0.08)",
    [resolvedTheme],
  );
  const subtleBg = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.01)",
    [resolvedTheme],
  );
  const inputBg = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.02)",
    [resolvedTheme],
  );

  const [search, setSearch] = useState("");

  const {
    data: roles,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
  });

  const deleteMut = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted successfully");
    },
    onError: (err) => {
      toast.error(getErrMsg(err, "Failed to delete role"));
    },
  });

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)),
    );
  }, [roles, search]);

  const handleCreateNew = () => {
    navigate("/app/roles/add-role");
  };

  const handleView = (id) => {
    navigate(`/app/roles/${id}`);
  };

  const handleEdit = (id) => {
    navigate(`/app/roles/${id}/update`);
  };

  const handleDelete = (id) => {
    if (
      window.confirm(
        "Are you sure you want to delete this role? This action cannot be undone.",
      )
    ) {
      deleteMut.mutate(id);
    }
  };

  const handleRefetch = async () => {
    await refetch();
    toast.info("Roles refreshed");
  };

  return (
    <div
      className="w-full flex-1 flex h-full flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="px-1 w-full mx-auto py-2 pb-8">
        <Breadcrumbs
          items={[
            { label: "SETTINGS", to: "/app/settings" },
            { label: "ROLES & PERMISSIONS", to: "/app/roles" },
          ]}
        />

        {/* Header Area */}
        <div
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2 mb-8 border-b pb-6"
          style={{ borderColor }}
        >
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out flex items-center gap-3"
              style={{ color: "var(--app-text)" }}
            >
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              Roles & Permissions
            </h1>
            <p
              className="text-sm mt-2 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Manage system roles, define access controls, and group
              capabilities across your workspace.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <GhostButton
              onClick={handleRefetch}
              disabled={isLoading || isRefetching}
              borderColor={borderColor}
              theme={resolvedTheme}
            >
              <RotateCcw
                className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {isRefetching ? "Refreshing..." : "Refresh"}
              </span>
            </GhostButton>
            <PrimaryButton
              onClick={handleCreateNew}
              borderColor={borderColor}
              theme={resolvedTheme}
            >
              <Plus className="w-4 h-4" />
              New Role
            </PrimaryButton>
          </div>
        </div>

        {/* Toolbar for List View */}
        <div className="mb-6 relative max-w-md">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--app-muted)" }}
          />
          <input
            type="text"
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-lg text-sm outline-none transition-all duration-200 ease-out focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            style={{
              backgroundColor: inputBg,
              border: `1px solid ${borderColor}`,
              color: "var(--app-text)",
            }}
          />
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isLoading ? (
            <>
              <SkeletonCard theme={resolvedTheme} borderColor={borderColor} />
              <SkeletonCard theme={resolvedTheme} borderColor={borderColor} />
              <SkeletonCard theme={resolvedTheme} borderColor={borderColor} />
            </>
          ) : filteredRoles.length === 0 ? (
            <div
              className="col-span-full flex flex-col items-center justify-center py-24 px-4 text-center rounded-xl border"
              style={{ borderColor, backgroundColor: subtleBg }}
            >
              <div
                className="p-5 rounded-full mb-4 shadow-sm"
                style={{
                  backgroundColor: "var(--app-surface)",
                  border: `1px solid ${borderColor}`,
                }}
              >
                <Search
                  className="w-8 h-8"
                  style={{ color: "var(--app-muted)", opacity: 0.7 }}
                />
              </div>
              <h3
                className="text-lg font-bold"
                style={{ color: "var(--app-text)" }}
              >
                No Roles Found
              </h3>
              <p
                className="text-sm max-w-sm mt-2 leading-relaxed"
                style={{ color: "var(--app-muted)" }}
              >
                Try adjusting your search criteria or create a new role to get
                started.
              </p>
            </div>
          ) : (
            filteredRoles.map((role) => (
              <Card
                key={role._id}
                borderColor={borderColor}
                onClick={() => handleView(role._id)}
                className="flex flex-col h-full group relative"
              >
                <div className="p-6 flex-1 flex flex-col min-h-0">
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0 pr-2">
                      <h3
                        className="font-bold text-base transition-colors duration-300 ease-out flex items-center gap-2 group-hover:text-[var(--accent)]"
                        style={{ color: "var(--app-text)" }}
                      >
                        {role.name}
                        {role.isSystem && (
                          <div
                            className="flex items-center justify-center p-1 rounded-md"
                            style={{
                              backgroundColor: "rgba(245,158,11,0.12)",
                              color: "#d97706",
                            }}
                            title="System Protected Role"
                          >
                            <ShieldAlert size={12} />
                          </div>
                        )}
                      </h3>
                    </div>
                    {/* Actions Menu */}
                    <div
                      className="flex flex-none items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-200"
                      onClick={(e) => e.stopPropagation()} // Prevent clicking actions from opening the card
                    >
                      <button
                        onClick={() => handleView(role._id)}
                        className="p-2 rounded-lg transition-colors duration-200 ease-out hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: "var(--app-muted)" }}
                        title="View Role"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleEdit(role._id)}
                        className="p-2 rounded-lg transition-colors duration-200 ease-out hover:bg-[var(--accent-soft)]"
                        style={{ color: "var(--accent)" }}
                        title="Edit Role"
                      >
                        <Pencil size={15} />
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDelete(role._id)}
                          className="p-2 rounded-lg transition-colors duration-200 ease-out hover:bg-red-500/10"
                          style={{ color: "#ef4444" }}
                          title="Delete Role"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p
                    className="text-sm leading-relaxed transition-colors duration-300 ease-out line-clamp-3"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {role.description || "No description provided."}
                  </p>
                </div>

                <div
                  className="px-6 py-4 border-t flex items-center justify-between transition-colors duration-300 ease-out"
                  style={{ borderColor, backgroundColor: subtleBg }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        border: `1px solid ${borderColor}`,
                        color: "var(--app-text)",
                      }}
                    >
                      {role.permissions.includes("*")
                        ? "All Permissions"
                        : `${role.permissions.length} Permissions`}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {role.isSystem ? "System" : "Custom"}
                    </span>
                  </div>

                  <ChevronRight
                    className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
                    style={{ color: "var(--app-muted)" }}
                  />
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
