import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import Select from "react-select";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import { useAuth } from "../../store/authStore";
import {
  Building2,
  Edit2,
  X,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { fetchDesignationOptions } from "../../api/designation";
import {
  fetchApproverSettings,
  upsertApproverSetting,
  fetchApprovers,
} from "../../api/cto";

/* =========================
   Theme
========================= */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* =========================
   Utils
========================= */
const getErrMsg = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message || err?.message || fallback;

const normalizeOptionsResponse = (raw) => {
  const items = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
        ? raw
        : [];
  return items;
};

const getSoftIconStyle = (tone, resolvedTheme, borderColor) => {
  const isDark = resolvedTheme === "dark";

  switch (tone) {
    case "blue":
      return {
        backgroundColor: isDark
          ? "rgba(59,130,246,0.14)"
          : "rgba(59,130,246,0.10)",
        color: isDark ? "#93c5fd" : "#1d4ed8",
        borderColor: isDark ? "rgba(59,130,246,0.24)" : "rgba(59,130,246,0.18)",
      };
    case "rose":
      return {
        backgroundColor: isDark
          ? "rgba(244,63,94,0.14)"
          : "rgba(244,63,94,0.10)",
        color: isDark ? "#fda4af" : "#be123c",
        borderColor: isDark ? "rgba(244,63,94,0.24)" : "rgba(244,63,94,0.18)",
      };
    default:
      return {
        backgroundColor: "var(--app-surface-2)",
        color: "var(--app-muted)",
        borderColor,
      };
  }
};

const getPillStyle = (tone, resolvedTheme) => {
  const isDark = resolvedTheme === "dark";

  switch (tone) {
    case "blue":
      return {
        backgroundColor: isDark
          ? "rgba(59,130,246,0.14)"
          : "rgba(59,130,246,0.10)",
        color: isDark ? "#93c5fd" : "#1d4ed8",
        borderColor: isDark ? "rgba(59,130,246,0.24)" : "rgba(59,130,246,0.18)",
      };
    case "emerald":
      return {
        backgroundColor: isDark
          ? "rgba(16,185,129,0.14)"
          : "rgba(16,185,129,0.10)",
        color: isDark ? "#6ee7b7" : "#047857",
        borderColor: isDark ? "rgba(16,185,129,0.24)" : "rgba(16,185,129,0.18)",
      };
    default:
      return {
        backgroundColor: isDark
          ? "rgba(148,163,184,0.14)"
          : "rgba(148,163,184,0.10)",
        color: isDark ? "#cbd5e1" : "#475569",
        borderColor: isDark
          ? "rgba(148,163,184,0.22)"
          : "rgba(148,163,184,0.18)",
      };
  }
};

/* =========================
   UI Primitives
========================= */
const Card = ({
  title,
  subtitle,
  action,
  children,
  className = "",
  borderColor,
}) => (
  <div
    className={["transition-colors duration-300 ease-out", className].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
      borderRadius: "1rem",
      boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
      backdropFilter: "blur(10px)",
    }}
  >
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 px-6 pt-5">
        <div className="min-w-0">
          {title && (
            <h3
              className="text-sm font-medium truncate transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              className="text-xs mt-0.5 leading-snug transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )}
    <div className="px-6 py-5">{children}</div>
  </div>
);

const SoftIcon = ({ children, tone = "slate", resolvedTheme, borderColor }) => (
  <div
    className="p-2 rounded-xl border shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-colors duration-300 ease-out"
    style={getSoftIconStyle(tone, resolvedTheme, borderColor)}
  >
    {children}
  </div>
);

const Pill = ({ children, tone = "slate", resolvedTheme }) => (
  <span
    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-300 ease-out"
    style={getPillStyle(tone, resolvedTheme)}
  >
    {children}
  </span>
);

const Button = ({
  children,
  variant = "primary",
  disabled,
  onClick,
  className = "",
  type = "button",
  borderColor,
}) => {
  const primaryStyle = {
    backgroundColor: "var(--accent)",
    color: "#fff",
    borderColor: "var(--accent)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  };

  const secondaryStyle = {
    backgroundColor: "var(--app-surface)",
    color: "var(--app-text)",
    borderColor,
  };

  const buttonStyle = variant === "primary" ? primaryStyle : secondaryStyle;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2",
        "px-6 py-2 rounded-xl text-sm font-medium",
        "border transition duration-200 ease-out",
        "active:scale-[0.99]",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
        className,
      ].join(" ")}
      style={buttonStyle}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (variant === "primary") {
          e.currentTarget.style.filter = "brightness(0.95)";
        } else {
          e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
        }
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") {
          e.currentTarget.style.filter = "none";
        } else {
          e.currentTarget.style.backgroundColor = "var(--app-surface)";
        }
      }}
    >
      {children}
    </button>
  );
};

/* =========================
   Select styles
========================= */
const buildSelectStyles = (resolvedTheme, borderColor) => ({
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    borderRadius: "0.9rem",
    borderColor: state.isFocused ? "var(--accent)" : borderColor,
    boxShadow: state.isFocused ? "0 0 0 4px var(--accent-soft)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--accent)" : borderColor,
    },
    backgroundColor: "var(--app-surface)",
    padding: "2px 4px",
  }),
  valueContainer: (base) => ({ ...base, paddingLeft: 10, paddingRight: 10 }),
  input: (base) => ({
    ...base,
    color: "var(--app-text)",
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "var(--app-muted)" }),
  clearIndicator: (base) => ({ ...base, color: "var(--app-muted)" }),
  placeholder: (base) => ({
    ...base,
    fontSize: 13,
    color: "var(--app-muted)",
    fontWeight: 500,
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: 13,
    color: "var(--app-text)",
    fontWeight: 500,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    borderRadius: "0.9rem",
    overflow: "hidden",
    border: `1px solid ${borderColor}`,
    boxShadow: "0 20px 40px rgba(15,23,42,0.10)",
    backgroundColor: "var(--app-surface)",
  }),
  menuList: (base) => ({
    ...base,
    backgroundColor: "var(--app-surface)",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: 13,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: state.isSelected
      ? "var(--accent-soft)"
      : state.isFocused
        ? resolvedTheme === "dark"
          ? "rgba(255,255,255,0.05)"
          : "rgba(2,6,23,0.04)"
        : "var(--app-surface)",
    color: "var(--app-text)",
  }),
});

/* =========================
   Skeletons
========================= */
const HeaderSkeleton = ({ borderColor }) => (
  <div
    className="px-6 py-5 border-b transition-colors duration-300 ease-out"
    style={{
      borderColor,
      backgroundColor: "var(--app-surface-2)",
    }}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-10 w-10 rounded-2xl"
          style={{ backgroundColor: "rgba(148,163,184,0.18)" }}
        />
        <div className="min-w-0">
          <Skeleton height={16} width={160} />
          <div className="mt-2 flex items-center gap-2">
            <Skeleton height={12} width={240} />
            <Skeleton height={18} width={70} borderRadius={999} />
          </div>
        </div>
      </div>
      <Skeleton height={40} width={120} borderRadius={14} />
    </div>
    <div className="mt-3">
      <Skeleton height={10} width={320} />
    </div>
  </div>
);

const ContentSkeleton = ({ borderColor }) => (
  <div className="max-w-3xl mx-auto space-y-6">
    <div
      className="rounded-2xl p-5"
      style={{
        border: `1px solid ${borderColor}`,
        backgroundColor: "var(--app-surface)",
        boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
      }}
    >
      <Skeleton height={12} width={220} />
      <div className="mt-3 space-y-2">
        <Skeleton height={10} width={"90%"} />
        <Skeleton height={10} width={"70%"} />
      </div>
    </div>

    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${borderColor}`,
        backgroundColor: "var(--app-surface)",
        boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
      }}
    >
      <div className="px-6 py-4 border-b" style={{ borderColor }}>
        <Skeleton height={14} width={170} />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton height={10} width={260} />
          <Skeleton height={10} width={120} />
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {[1, 2, 3].map((lvl) => (
          <div key={lvl} className="flex gap-4">
            <div
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: "rgba(148,163,184,0.18)" }}
            />
            <div className="flex-1">
              <Skeleton height={12} width={150} />
              <Skeleton height={10} width={120} className="mt-2" />
              <div
                className="mt-3 rounded-2xl px-4 py-3"
                style={{
                  border: `1px solid ${borderColor}`,
                  backgroundColor: "var(--app-surface)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl"
                    style={{
                      backgroundColor: "rgba(148,163,184,0.12)",
                      border: `1px solid ${borderColor}`,
                    }}
                  />
                  <div className="flex-1">
                    <Skeleton height={12} width={"55%"} />
                    <Skeleton height={10} width={"35%"} className="mt-2" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* =========================
   Main: ApproverSettings
========================= */
const ApproverSettings = () => {
  const queryClient = useQueryClient();
  const { designationId } = useParams();
  const id = designationId ? String(designationId) : "";

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    if (resolvedTheme === "dark") {
      return {
        baseColor: "rgba(255,255,255,0.06)",
        highlightColor: "rgba(255,255,255,0.10)",
      };
    }
    return {
      baseColor: "rgba(15,23,42,0.06)",
      highlightColor: "rgba(15,23,42,0.10)",
    };
  }, [resolvedTheme]);

  const selectStyles = useMemo(
    () => buildSelectStyles(resolvedTheme, borderColor),
    [resolvedTheme, borderColor],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [form, setForm] = useState({
    level1Approver: "",
    level2Approver: "",
    level3Approver: "",
  });

  /* --- Designation cache for header --- */
  const designationQuery = useQuery({
    queryKey: ["designationOptions", "all"],
    queryFn: () => fetchDesignationOptions({}),
    staleTime: 10 * 60 * 1000,
  });

  const allDesignations = useMemo(() => {
    const items = normalizeOptionsResponse(designationQuery.data);
    return items
      .filter((d) => d?._id && d?.name)
      .map((d) => ({ ...d, _id: String(d._id), name: String(d.name) }));
  }, [designationQuery.data]);

  const selectedDesignation = useMemo(() => {
    if (!id) return null;
    return allDesignations.find((d) => d._id === id) || null;
  }, [allDesignations, id]);

  /* --- Approvers list --- */
  const approversQuery = useQuery({
    queryKey: ["approvers"],
    queryFn: fetchApprovers,
    staleTime: 10 * 60 * 1000,
  });

  const approvers = useMemo(() => {
    const raw = approversQuery.data;
    const list = Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw)
          ? raw
          : [];
    return list;
  }, [approversQuery.data]);

  const employeeOptions = useMemo(() => {
    const opts = approvers
      .filter((emp) => emp?._id && (emp?.firstName || emp?.lastName))
      .map((emp) => ({
        value: String(emp._id),
        label:
          `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Unnamed",
        subLabel: emp.position || emp.designation?.name || "Staff",
      }));
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [approvers]);

  /* --- Current setting --- */
  const settingQuery = useQuery({
    queryKey: ["approverSetting", id],
    queryFn: () => fetchApproverSettings(id),
    enabled: Boolean(id),
  });

  const approverSettingData = settingQuery.data?.data;

  useEffect(() => {
    setInlineError("");
    setIsEditing(false);

    if (!id) {
      setForm({ level1Approver: "", level2Approver: "", level3Approver: "" });
      return;
    }

    if (settingQuery.data?.show && approverSettingData) {
      setForm({
        level1Approver: approverSettingData.level1Approver?._id
          ? String(approverSettingData.level1Approver._id)
          : "",
        level2Approver: approverSettingData.level2Approver?._id
          ? String(approverSettingData.level2Approver._id)
          : "",
        level3Approver: approverSettingData.level3Approver?._id
          ? String(approverSettingData.level3Approver._id)
          : "",
      });
    } else {
      setForm({ level1Approver: "", level2Approver: "", level3Approver: "" });
    }
  }, [id, settingQuery.data?.show, approverSettingData]);

  const mutation = useMutation({
    mutationFn: upsertApproverSetting,
    onSuccess: async () => {
      setInlineError("");
      toast.success("Approver routing saved");
      await queryClient.invalidateQueries({
        queryKey: ["approverSetting", id],
      });
      setIsEditing(false);
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to save configuration");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const validateAllApprovers = useCallback(() => {
    const missing = [];
    if (!form.level1Approver) missing.push("Level 1");
    if (!form.level2Approver) missing.push("Level 2");
    if (!form.level3Approver) missing.push("Level 3");

    if (missing.length) {
      const msg = `Please assign all approvers before saving (${missing.join(
        ", ",
      )} missing).`;
      setInlineError(msg);
      toast.error(msg);
      return false;
    }
    return true;
  }, [form.level1Approver, form.level2Approver, form.level3Approver]);

  const handleSave = useCallback(() => {
    if (!id) return;

    setInlineError("");

    if (!validateAllApprovers()) return;

    mutation.mutate({ designation: id, ...form });
  }, [id, form, mutation, validateAllApprovers]);

  const CustomOption = (props) => {
    const { data, innerRef, innerProps, isSelected, isFocused } = props;

    return (
      <div
        ref={innerRef}
        {...innerProps}
        className="px-3 py-2 cursor-pointer border-b last:border-0 transition-colors duration-200 ease-out"
        style={{
          borderColor:
            resolvedTheme === "dark"
              ? "rgba(255,255,255,0.04)"
              : "rgba(15,23,42,0.04)",
          backgroundColor: isSelected
            ? "var(--accent-soft)"
            : isFocused
              ? resolvedTheme === "dark"
                ? "rgba(255,255,255,0.04)"
                : "rgba(37,99,235,0.06)"
              : "var(--app-surface)",
        }}
      >
        <div className="min-w-0">
          <div
            className="text-sm truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-text)" }}
          >
            {data.label}
          </div>
          <div
            className="text-xs truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {data.subLabel}
          </div>
        </div>
      </div>
    );
  };

  const allFilled =
    !!form.level1Approver && !!form.level2Approver && !!form.level3Approver;

  if (!id) {
    return (
      <div
        className="h-full min-h-[460px] flex items-center justify-center p-6 transition-colors duration-300 ease-out"
        style={{ backgroundColor: "var(--app-bg)" }}
      >
        <div className="w-full max-w-2xl">
          <Card
            title="No designation selected"
            subtitle="Select a designation from the left panel to configure routing."
            action={
              <SoftIcon
                tone="slate"
                resolvedTheme={resolvedTheme}
                borderColor={borderColor}
              >
                <Building2 className="h-4 w-4" />
              </SoftIcon>
            }
            borderColor={borderColor}
          >
            <div
              className="flex items-start gap-3 text-sm leading-relaxed transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <SoftIcon
                tone="blue"
                resolvedTheme={resolvedTheme}
                borderColor={borderColor}
              >
                <Info className="h-4 w-4" />
              </SoftIcon>
              <div>
                Assign Level 1 to Level 3 approvers. All levels are required
                before you can save.
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const headerLoading =
    designationQuery.isLoading ||
    designationQuery.isFetching ||
    (!selectedDesignation && designationQuery.isSuccess);

  const contentLoading =
    settingQuery.isLoading ||
    approversQuery.isLoading ||
    designationQuery.isLoading;

  return (
    <div
      className="flex flex-col h-full overflow-hidden rounded-xl border shadow-md transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
      }}
    >
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        {/* HEADER */}
        {headerLoading ? (
          <HeaderSkeleton borderColor={borderColor} />
        ) : (
          <div
            className="px-6 py-2.5 border-b transition-colors duration-300 ease-out"
            style={{
              borderColor,
              backgroundColor: "var(--app-surface-2)",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className="text-lg font-bold transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-text)" }}
                      >
                        Approver routing
                      </h2>
                      <Pill tone="slate" resolvedTheme={resolvedTheme}>
                        {selectedDesignation?.name || "Designation"}
                      </Pill>
                    </div>

                    <p
                      className="text-xs leading-relaxed transition-colors duration-300 ease-out"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Assign all three levels (Level 1, Level 2, Level 3).
                      Saving is disabled until the approvers are complete.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isEditing ? "secondary" : "primary"}
                  onClick={() => {
                    setInlineError("");
                    setIsEditing((v) => !v);
                  }}
                  borderColor={borderColor}
                >
                  {isEditing ? (
                    <>
                      <X size={16} /> Cancel
                    </>
                  ) : (
                    <>
                      <Edit2 size={16} /> Edit
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-6 py-6 cto-scrollbar">
          {contentLoading ? (
            <ContentSkeleton borderColor={borderColor} />
          ) : settingQuery.isError ? (
            <div className="max-w-3xl mx-auto">
              <Card
                title="Unable to load routing"
                subtitle="Please check your connection and try again."
                action={
                  <SoftIcon
                    tone="rose"
                    resolvedTheme={resolvedTheme}
                    borderColor={borderColor}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </SoftIcon>
                }
                borderColor={borderColor}
              >
                <div
                  className="text-sm transition-colors duration-300 ease-out"
                  style={{
                    color: resolvedTheme === "dark" ? "#fda4af" : "#be123c",
                  }}
                >
                  {getErrMsg(
                    settingQuery.error,
                    "Failed to load configuration",
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {inlineError && (
                <div
                  className="rounded-2xl border px-4 py-3 text-sm flex items-start gap-2 transition-colors duration-300 ease-out"
                  style={{
                    borderColor:
                      resolvedTheme === "dark"
                        ? "rgba(244,63,94,0.24)"
                        : "rgba(244,63,94,0.18)",
                    backgroundColor:
                      resolvedTheme === "dark"
                        ? "rgba(244,63,94,0.10)"
                        : "rgba(244,63,94,0.08)",
                    color: resolvedTheme === "dark" ? "#fda4af" : "#be123c",
                  }}
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <span>{inlineError}</span>
                </div>
              )}

              <Card
                subtitle="Assign approvers for each level"
                action={
                  <span
                    className="text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Level 1 → Level 3
                  </span>
                }
                borderColor={borderColor}
              >
                <div className="flex items-start gap-3 mb-5">
                  <SoftIcon
                    tone="slate"
                    resolvedTheme={resolvedTheme}
                    borderColor={borderColor}
                  >
                    <Info className="h-4 w-4" />
                  </SoftIcon>

                  <div
                    className="text-sm leading-relaxed transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    All approver levels are required for a complete routing
                    setup. Please select an approver for Level 1, Level 2, and
                    Level 3 before saving.
                  </div>
                </div>

                <div className="relative">
                  <div
                    className="absolute left-4 top-2 bottom-2 w-px"
                    style={{
                      background:
                        resolvedTheme === "dark"
                          ? "linear-gradient(to bottom, var(--accent), rgba(255,255,255,0.12), transparent)"
                          : "linear-gradient(to bottom, var(--accent), rgba(148,163,184,0.30), transparent)",
                    }}
                  />

                  <div className="space-y-6">
                    {[1, 2, 3].map((level) => {
                      const key = `level${level}Approver`;
                      const selectedValue = employeeOptions.find(
                        (o) => o.value === form[key],
                      );

                      const meta =
                        level === 1
                          ? { note: "Primary review" }
                          : level === 2
                            ? { note: "Secondary review" }
                            : { note: "Final approval" };

                      return (
                        <div key={level} className="relative flex gap-4">
                          <div
                            className="relative z-10 h-10 w-10 rounded-full border-4 shadow-sm flex items-center justify-center transition-colors duration-300 ease-out"
                            style={{
                              borderColor: "var(--app-surface)",
                              backgroundColor: selectedValue
                                ? "var(--accent)"
                                : "var(--app-surface-2)",
                              color: selectedValue
                                ? "#fff"
                                : "var(--app-muted)",
                            }}
                          >
                            <span className="text-xs">{level}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div
                                  className="text-sm transition-colors duration-300 ease-out"
                                  style={{ color: "var(--app-text)" }}
                                >
                                  Level {level} approver
                                </div>
                                <div
                                  className="text-xs mt-0.5 transition-colors duration-300 ease-out"
                                  style={{ color: "var(--app-muted)" }}
                                >
                                  {meta.note}
                                </div>
                              </div>

                              <Pill
                                tone={selectedValue ? "emerald" : "slate"}
                                resolvedTheme={resolvedTheme}
                              >
                                {selectedValue ? "Assigned" : "Required"}
                              </Pill>
                            </div>

                            <div className="mt-3">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <Select
                                    options={employeeOptions}
                                    components={{ Option: CustomOption }}
                                    value={selectedValue || null}
                                    onChange={(selected) =>
                                      setForm((prev) => ({
                                        ...prev,
                                        [key]: selected?.value || "",
                                      }))
                                    }
                                    placeholder="Select an employee..."
                                    isLoading={approversQuery.isLoading}
                                    isDisabled={approversQuery.isLoading}
                                    isClearable={false}
                                    styles={selectStyles}
                                  />
                                  {!form[key] && (
                                    <div
                                      className="text-xs transition-colors duration-300 ease-out"
                                      style={{
                                        color:
                                          resolvedTheme === "dark"
                                            ? "#fda4af"
                                            : "#be123c",
                                      }}
                                    >
                                      This level is required.
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="rounded-2xl border px-4 py-3 transition-colors duration-300 ease-out"
                                  style={{
                                    borderColor: selectedValue
                                      ? borderColor
                                      : resolvedTheme === "dark"
                                        ? "rgba(244,63,94,0.22)"
                                        : "rgba(244,63,94,0.16)",
                                    backgroundColor: selectedValue
                                      ? "var(--app-surface)"
                                      : resolvedTheme === "dark"
                                        ? "rgba(244,63,94,0.06)"
                                        : "rgba(244,63,94,0.04)",
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="h-10 w-10 rounded-xl border flex items-center justify-center transition-colors duration-300 ease-out"
                                      style={
                                        selectedValue
                                          ? {
                                              backgroundColor:
                                                "var(--accent-soft)",
                                              color: "var(--accent)",
                                              borderColor:
                                                "var(--accent-soft2)",
                                            }
                                          : {
                                              backgroundColor:
                                                resolvedTheme === "dark"
                                                  ? "rgba(244,63,94,0.10)"
                                                  : "rgba(244,63,94,0.08)",
                                              color:
                                                resolvedTheme === "dark"
                                                  ? "#fda4af"
                                                  : "#be123c",
                                              borderColor:
                                                resolvedTheme === "dark"
                                                  ? "rgba(244,63,94,0.22)"
                                                  : "rgba(244,63,94,0.16)",
                                            }
                                      }
                                    >
                                      <CheckCircle2 size={18} />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div
                                        className="text-sm truncate transition-colors duration-300 ease-out"
                                        style={{ color: "var(--app-text)" }}
                                      >
                                        {selectedValue?.label ||
                                          "No approver assigned"}
                                      </div>
                                      <div
                                        className="text-xs truncate transition-colors duration-300 ease-out"
                                        style={{ color: "var(--app-muted)" }}
                                      >
                                        {selectedValue?.subLabel ||
                                          "Click Edit to assign an approver"}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {isEditing && (
          <div
            className="px-6 py-1.5 border-t flex items-center justify-end gap-3 transition-colors duration-300 ease-out"
            style={{
              borderColor,
              backgroundColor: "var(--app-surface-2)",
            }}
          >
            <Button
              variant="secondary"
              onClick={() => {
                setInlineError("");
                setIsEditing(false);
              }}
              disabled={mutation.isPending}
              borderColor={borderColor}
            >
              <X size={16} /> Cancel
            </Button>

            <Button
              onClick={handleSave}
              disabled={mutation.isPending || !allFilled}
              className={!allFilled ? "opacity-60" : ""}
              borderColor={borderColor}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Saving...
                </>
              ) : (
                <>
                  <Save size={18} /> Save
                </>
              )}
            </Button>
          </div>
        )}
      </SkeletonTheme>
    </div>
  );
};

export default ApproverSettings;
