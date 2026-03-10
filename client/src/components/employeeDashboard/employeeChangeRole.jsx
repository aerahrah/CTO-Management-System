import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "react-toastify";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../store/authStore";
import {
  ShieldCheck,
  Users2,
  Briefcase,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { updateEmployeeRole } from "../../api/employee";

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

const getRoleTone = (roleId, resolvedTheme) => {
  const isDark = resolvedTheme === "dark";

  const tones = {
    employee: {
      pill: {
        backgroundColor: isDark
          ? "rgba(148,163,184,0.14)"
          : "rgba(148,163,184,0.10)",
        color: isDark ? "#cbd5e1" : "#475569",
        borderColor: isDark
          ? "rgba(148,163,184,0.22)"
          : "rgba(148,163,184,0.18)",
      },
    },
    supervisor: {
      pill: {
        backgroundColor: isDark
          ? "rgba(245,158,11,0.14)"
          : "rgba(245,158,11,0.10)",
        color: isDark ? "#fcd34d" : "#b45309",
        borderColor: isDark ? "rgba(245,158,11,0.28)" : "rgba(245,158,11,0.18)",
      },
    },
    hr: {
      pill: {
        backgroundColor: isDark
          ? "rgba(99,102,241,0.14)"
          : "rgba(99,102,241,0.10)",
        color: isDark ? "#c7d2fe" : "#4338ca",
        borderColor: isDark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.18)",
      },
    },
    admin: {
      pill: {
        backgroundColor: isDark
          ? "rgba(244,63,94,0.14)"
          : "rgba(244,63,94,0.10)",
        color: isDark ? "#fda4af" : "#be123c",
        borderColor: isDark ? "rgba(244,63,94,0.28)" : "rgba(244,63,94,0.18)",
      },
    },
  };

  return tones[roleId] || tones.employee;
};

const roleDetailsBase = [
  {
    id: "employee",
    label: "Employee",
    desc: "Basic access to personal profile and CTO",
    icon: User,
  },
  {
    id: "supervisor",
    label: "Supervisor",
    desc: "Can manage team approvals.",
    icon: Briefcase,
  },
  {
    id: "hr",
    label: "HR Manager",
    desc: "Full access to employee records and CTOs.",
    icon: Users2,
  },
  {
    id: "admin",
    label: "System Admin",
    desc: "Total control over system settings and roles.",
    icon: ShieldCheck,
  },
];

const EmployeeRoleChanger = forwardRef(
  (
    {
      employeeId,
      currentRole,
      onRoleUpdated,
      onCancel,
      onPendingChange,
      onDirtyChange,
    },
    ref,
  ) => {
    const queryClient = useQueryClient();

    const prefTheme = useAuth((s) => s.preferences?.theme || "system");
    const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

    const borderColor = useMemo(() => {
      return resolvedTheme === "dark"
        ? "rgba(255,255,255,0.07)"
        : "rgba(15,23,42,0.10)";
    }, [resolvedTheme]);

    const currentPillStyle = useMemo(() => {
      return resolvedTheme === "dark"
        ? {
            backgroundColor: "rgba(148,163,184,0.14)",
            color: "#cbd5e1",
            borderColor: "rgba(148,163,184,0.22)",
          }
        : {
            backgroundColor: "rgba(148,163,184,0.10)",
            color: "#475569",
            borderColor: "rgba(148,163,184,0.18)",
          };
    }, [resolvedTheme]);

    const selectedCardStyle = useMemo(() => {
      return {
        backgroundColor: "var(--accent-soft)",
        borderColor: "var(--accent)",
      };
    }, []);

    const submitLockRef = useRef(false);
    const submittedSuccessRef = useRef(false);

    const [selectedRole, setSelectedRole] = useState(currentRole || "employee");
    const [lockAfterSuccess, setLockAfterSuccess] = useState(false);

    useEffect(() => {
      setSelectedRole(currentRole || "employee");
      setLockAfterSuccess(false);
      submitLockRef.current = false;
      submittedSuccessRef.current = false;
    }, [employeeId, currentRole]);

    const dirty = useMemo(
      () => (currentRole || "employee") !== selectedRole,
      [currentRole, selectedRole],
    );

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    const mutation = useMutation({
      mutationFn: (newRole) =>
        updateEmployeeRole(employeeId, { role: newRole }),
      retry: 0,
      onSuccess: (updatedEmployee) => {
        const newRole =
          updatedEmployee?.employee?.role || selectedRole || "employee";

        toast.success(
          `Access level updated to ${String(newRole).toUpperCase()}`,
        );

        queryClient.invalidateQueries({ queryKey: ["employees"] });
        queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });

        submittedSuccessRef.current = true;
        setLockAfterSuccess(true);

        onRoleUpdated?.(updatedEmployee);
      },
      onError: (err) => {
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to update permissions",
        );
      },
      onSettled: () => {
        submitLockRef.current = false;
        onPendingChange?.(false);
      },
    });

    const busy =
      mutation.isPending || submitLockRef.current || lockAfterSuccess;

    useEffect(() => {
      onPendingChange?.(busy);
    }, [busy, onPendingChange]);

    const submit = async () => {
      if (submittedSuccessRef.current) return;
      if (busy) return;

      if (submitLockRef.current) return;
      submitLockRef.current = true;
      onPendingChange?.(true);

      if (!dirty) {
        toast.info("Role is already set to " + selectedRole);
        submitLockRef.current = false;
        onPendingChange?.(false);
        return;
      }

      try {
        await mutation.mutateAsync(selectedRole);
      } catch {
        // handled by mutation
      }
    };

    const cancel = () => {
      onCancel?.();
    };

    useImperativeHandle(ref, () => ({
      submit,
      cancel,
      isLoading: busy,
      isDirty: dirty,
      reset: () => setSelectedRole(currentRole || "employee"),
    }));

    return (
      <div className="flex flex-col">
        <div className="px-1 pb-3 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto cto-scrollbar">
          <div className="flex items-center justify-between gap-3">
            <div
              className="text-xs font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Select Access Level
            </div>

            <div
              className="text-[11px] flex items-center gap-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <AlertCircle size={12} />
              Changes apply immediately
            </div>
          </div>

          <div className="space-y-2">
            {roleDetailsBase.map((role) => {
              const Icon = role.icon;
              const isActive = selectedRole === role.id;
              const isCurrent = (currentRole || "employee") === role.id;
              const tone = getRoleTone(role.id, resolvedTheme);

              return (
                <button
                  key={role.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full flex items-start gap-3 p-4 rounded-2xl border transition text-left ${
                    busy ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  style={
                    isActive
                      ? selectedCardStyle
                      : {
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                        }
                  }
                  onMouseEnter={(e) => {
                    if (busy || isActive) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (busy || isActive) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface)";
                  }}
                >
                  <div
                    className="p-3 rounded-xl border flex-none transition-colors duration-300 ease-out"
                    style={
                      isActive
                        ? {
                            backgroundColor: "var(--accent)",
                            color: "#fff",
                            borderColor: "var(--accent)",
                          }
                        : {
                            backgroundColor: "var(--app-surface)",
                            color: "var(--app-muted)",
                            borderColor,
                          }
                    }
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-bold text-sm transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-text)" }}
                      >
                        {role.label}
                      </span>

                      {isCurrent && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={currentPillStyle}
                        >
                          Current
                        </span>
                      )}

                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={tone.pill}
                      >
                        {role.id.toUpperCase()}
                      </span>
                    </div>

                    <p
                      className="text-xs mt-1 transition-colors duration-300 ease-out"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {role.desc}
                    </p>
                  </div>

                  {isActive && (
                    <CheckCircle2
                      className="w-5 h-5 flex-none mt-1"
                      style={{ color: "var(--accent)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <div
              className="text-[11px] transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Selected:{" "}
              <span
                className="font-bold transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                {String(selectedRole).toUpperCase()}
              </span>
              {!dirty && (
                <span
                  className="ml-2 italic"
                  style={{ color: "var(--app-muted)" }}
                >
                  (no changes)
                </span>
              )}
              {lockAfterSuccess && (
                <span
                  className="ml-2 font-bold"
                  style={{
                    color: resolvedTheme === "dark" ? "#6ee7b7" : "#047857",
                  }}
                >
                  (updated)
                </span>
              )}
            </div>
          </div>

          <div className="h-3" />
        </div>

        <div
          className="sticky bottom-0 z-10 border-t px-1 pt-3 backdrop-blur transition-colors duration-300 ease-out"
          style={{
            borderColor,
            backgroundColor:
              resolvedTheme === "dark"
                ? "rgba(15,23,42,0.92)"
                : "rgba(255,255,255,0.95)",
          }}
        >
          <div className="flex gap-3">
            <button
              type="button"
              onClick={cancel}
              className="w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ease-out border"
              style={{
                borderColor,
                backgroundColor: "var(--app-surface-2)",
                color: "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={busy || !dirty}
              className={`w-full px-4 py-2 rounded-lg font-semibold transition-all duration-200 ease-out ${
                busy || !dirty ? "opacity-70 cursor-not-allowed" : ""
              }`}
              style={{
                backgroundColor: "var(--accent)",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                if (busy || !dirty) return;
                e.currentTarget.style.filter = "brightness(0.95)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "none";
              }}
            >
              {lockAfterSuccess
                ? "Updated"
                : busy
                  ? "Saving..."
                  : "Confirm Role Change"}
            </button>
          </div>

          {mutation.isPending && (
            <div
              className="mt-2 text-[11px] flex items-center gap-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Updating role…
            </div>
          )}
        </div>
      </div>
    );
  },
);

EmployeeRoleChanger.displayName = "EmployeeRoleChanger";
export default EmployeeRoleChanger;
