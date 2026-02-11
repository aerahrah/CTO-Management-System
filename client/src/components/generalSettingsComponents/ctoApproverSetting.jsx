import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import Select from "react-select";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
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

/* =========================
   UI Primitives (MINIMALIST)
========================= */
const Card = ({ title, subtitle, action, children, className = "" }) => (
  <div
    className={["bg-white/80 backdrop-blur", "transition", className].join(" ")}
  >
    {(title || action) && (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {title && (
            <h3 className="text-sm font-medium text-slate-900 truncate">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
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

const SoftIcon = ({ children, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-100 text-slate-600 border-slate-200/60",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <div
      className={[
        "p-2 rounded-xl border",
        "shadow-[0_1px_0_rgba(15,23,42,0.03)]",
        tones[tone],
      ].join(" ")}
    >
      {children}
    </div>
  );
};

const Pill = ({ children, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  return (
    <span
      className={[
        "inline-flex items-center",
        "px-2.5 py-1",
        "rounded-full",
        "text-xs font-medium",
        "border",
        tones[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
};

const Button = ({
  children,
  variant = "primary",
  disabled,
  onClick,
  className = "",
  type = "button",
}) => {
  const styles =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600 shadow-sm"
      : "bg-white/70 text-slate-800 hover:bg-white border-slate-200/70 hover:border-slate-300/70";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2",
        "px-6 py-2 rounded-xl text-sm font-medium",
        "border transition",
        "active:scale-[0.99]",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
        styles,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
};

/* =========================
   Select styles (minimal, blue-600)
========================= */
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    borderRadius: "0.9rem",
    borderColor: state.isFocused ? "#93c5fd" : "rgba(226,232,240,0.9)",
    boxShadow: state.isFocused ? "0 0 0 4px rgba(37,99,235,0.10)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#93c5fd" : "rgba(148,163,184,0.7)",
    },
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: "2px 4px",
  }),
  valueContainer: (base) => ({ ...base, paddingLeft: 10, paddingRight: 10 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "rgba(100,116,139,0.8)" }),
  clearIndicator: (base) => ({ ...base, color: "rgba(100,116,139,0.8)" }),
  placeholder: (base) => ({
    ...base,
    fontSize: 13,
    color: "rgba(100,116,139,0.85)",
    fontWeight: 500,
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 500,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    borderRadius: "0.9rem",
    overflow: "hidden",
    border: "1px solid rgba(226,232,240,0.9)",
    boxShadow: "0 20px 40px rgba(15,23,42,0.10)",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: 13,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: state.isSelected
      ? "rgba(37,99,235,0.10)"
      : state.isFocused
        ? "rgba(2,6,23,0.04)"
        : "white",
    color: "#0f172a",
  }),
};

/* =========================
   Skeletons (match minimalist concept)
========================= */
const HeaderSkeleton = () => (
  <div className="px-6 py-5 border-b border-slate-200/60 bg-white/70">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-2xl bg-slate-200/70" />
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

const ContentSkeleton = () => (
  <div className="max-w-3xl mx-auto space-y-6">
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <Skeleton height={12} width={220} />
      <div className="mt-3 space-y-2">
        <Skeleton height={10} width={"90%"} />
        <Skeleton height={10} width={"70%"} />
      </div>
    </div>

    <div className="rounded-2xl border border-slate-200/70 bg-white/80 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="px-6 py-4 border-b border-slate-200/60">
        <Skeleton height={14} width={170} />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton height={10} width={260} />
          <Skeleton height={10} width={120} />
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {[1, 2, 3].map((lvl) => (
          <div key={lvl} className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-slate-200/70" />
            <div className="flex-1">
              <Skeleton height={12} width={150} />
              <Skeleton height={10} width={120} className="mt-2" />
              <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200/60" />
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, settingQuery.data?.show]);

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

    // ✅ enforce complete assignment
    if (!validateAllApprovers()) return;

    mutation.mutate({ designation: id, ...form });
  }, [id, form, mutation, validateAllApprovers]);

  const CustomOption = (props) => {
    const { data, innerRef, innerProps, isSelected } = props;
    return (
      <div
        ref={innerRef}
        {...innerProps}
        className={[
          "px-3 py-2 cursor-pointer border-b border-slate-50 last:border-0 transition-colors",
          isSelected ? "bg-blue-50" : "hover:bg-blue-50/60",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="text-sm text-slate-900 truncate">{data.label}</div>
          <div className="text-xs text-slate-500 truncate">{data.subLabel}</div>
        </div>
      </div>
    );
  };

  const allFilled =
    !!form.level1Approver && !!form.level2Approver && !!form.level3Approver;

  /* =========================
     Empty (no id)
  ========================= */
  if (!id) {
    return (
      <div className="h-full min-h-[460px] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <Card
            title="No designation selected"
            subtitle="Select a designation from the left panel to configure routing."
            action={
              <SoftIcon tone="slate">
                <Building2 className="h-4 w-4" />
              </SoftIcon>
            }
          >
            <div className="flex items-start gap-3 text-sm text-slate-600">
              <SoftIcon tone="blue">
                <Info className="h-4 w-4" />
              </SoftIcon>
              <div className="leading-relaxed">
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
    <div className="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-200/70 shadow-md">
      {/* HEADER */}
      {headerLoading ? (
        <HeaderSkeleton />
      ) : (
        <div className="px-6 py-2.5 border-b border-slate-200/60 bg-neutral-50/50">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      Approver routing
                    </h2>
                    <Pill tone="slate">
                      {selectedDesignation?.name || "Designation"}
                    </Pill>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Assign all three levels (Level 1, Level 2, Level 3). Saving
                    is disabled until the approvers are complete.
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

      {/* CONTENT (keep overflow-y-auto) */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {contentLoading ? (
          <ContentSkeleton />
        ) : settingQuery.isError ? (
          <div className="max-w-3xl mx-auto">
            <Card
              title="Unable to load routing"
              subtitle="Please check your connection and try again."
              action={
                <SoftIcon tone="rose">
                  <AlertTriangle className="h-4 w-4" />
                </SoftIcon>
              }
            >
              <div className="text-sm text-rose-700">
                {getErrMsg(settingQuery.error, "Failed to load configuration")}
              </div>
            </Card>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Inline error */}
            {inlineError && (
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>{inlineError}</span>
              </div>
            )}

            {/* Single card for all levels */}
            <Card
              subtitle="Assign approvers for each level"
              action={
                <span className="text-xs text-slate-400">
                  Level 1 → Level 3
                </span>
              }
            >
              <div className="flex items-start gap-3 mb-5">
                <SoftIcon tone="slate">
                  <Info className="h-4 w-4" />
                </SoftIcon>
                <div className="text-sm text-slate-600 leading-relaxed">
                  All approver levels are required for a complete routing setup.
                  Please select an approver for Level 1, Level 2, and Level 3
                  before saving.
                </div>
              </div>

              <div className="relative">
                {/* Line */}
                <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-blue-600 via-slate-200 to-transparent" />

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
                        {/* Dot */}
                        <div
                          className={[
                            "relative z-10 h-10 w-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
                            selectedValue
                              ? "bg-blue-600 text-white"
                              : "bg-slate-200 text-slate-600",
                          ].join(" ")}
                        >
                          <span className="text-xs">{level}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm text-slate-900">
                                Level {level} approver
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {meta.note}
                              </div>
                            </div>

                            <Pill tone={selectedValue ? "emerald" : "slate"}>
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
                                  isClearable={false} // ✅ prevent clearing (enforce complete)
                                  styles={selectStyles}
                                />
                                {!form[key] && (
                                  <div className="text-xs text-rose-600">
                                    This level is required.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                className={[
                                  "rounded-2xl border px-4 py-3",
                                  "bg-white/70",
                                  selectedValue
                                    ? "border-slate-200/70"
                                    : "border-rose-200/70 bg-rose-50/40",
                                ].join(" ")}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={[
                                      "h-10 w-10 rounded-xl border flex items-center justify-center",
                                      selectedValue
                                        ? "bg-blue-50 text-blue-700 border-blue-100"
                                        : "bg-rose-50 text-rose-700 border-rose-200/70",
                                    ].join(" ")}
                                  >
                                    <CheckCircle2 size={18} />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm text-slate-900 truncate">
                                      {selectedValue?.label ||
                                        "No approver assigned"}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
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
        <div className="px-6 py-1.5 border-t border-slate-200/60 bg-neutral-50/70 flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setInlineError("");
              setIsEditing(false);
            }}
            disabled={mutation.isPending}
          >
            <X size={16} /> Cancel
          </Button>

          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !allFilled}
            className={!allFilled ? "opacity-60" : ""}
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
    </div>
  );
};

export default ApproverSettings;
