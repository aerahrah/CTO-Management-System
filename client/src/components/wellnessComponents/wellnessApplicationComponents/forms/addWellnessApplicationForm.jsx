import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addWellnessApplicationRequest } from "../../../../api/wellnessApplication";
import { fetchWorkingDaysGeneralSettings } from "../../../../api/generalSettings";
import { fetchAllApprovalRoutes } from "../../../../api/approvalRoute";
import { getMyWellnessBalance } from "../../../../api/employee";
import { useAuth } from "../../../../store/authStore";
import {
  Calendar,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  HeartPulse,
  Layers,
  Info,
} from "lucide-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";

const MAX_REASON_LEN = 500;
const MAX_WELLNESS_DAYS = 3;

/* ------------------ Helpers ------------------ */
const clampInt = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const t = Math.trunc(n);
  return Math.min(Math.max(t, min), max);
};

const isWeekendISO = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
};

const isFullISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

/**
 * Lead-time rule: Must have N working days between today (exclusive) and selected date (exclusive).
 */
const getMinSelectableDateISO = (leadTimeDays = 5) => {
  const lead = Number(leadTimeDays);
  const date = new Date();

  if (!Number.isFinite(lead) || lead <= 0) {
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  }

  let count = 0;
  while (count < lead) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
  }

  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString().split("T")[0];
};

/* ------------------ Resolve theme ------------------ */
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
   Validation Logic
========================= */
const validateDate = ({
  value,
  inclusiveDates,
  minDate,
  leadTimeMsg,
  maxWellnessDays,
}) => {
  if (!value) return "";
  if (!isFullISODate(value)) return "";

  if (value < minDate) return leadTimeMsg;
  if (isWeekendISO(value)) return "Please select a working day (Mon–Fri).";
  if (inclusiveDates.includes(value)) return "That date is already selected.";

  const tempDates = [...inclusiveDates, value];

  // We explicitly removed the 3-day max check here so it doesn't instantly block selection,
  // relying instead on the submit-time validation to show the toast as requested.

  if (tempDates.length > maxWellnessDays) {
    return `You only have ${maxWellnessDays} Wellness Day(s) left.`;
  }

  return "";
};

/* =========================
   Banner Component
========================= */
const Banner = ({ tone = "error", message, borderColor }) => {
  if (!message) return null;

  const palette =
    tone === "info"
      ? {
          bg: "rgba(37,99,235,0.10)",
          br: "rgba(37,99,235,0.18)",
          fg: "var(--app-text)",
          icon: "var(--accent)",
        }
      : tone === "success"
        ? {
            bg: "rgba(34,197,94,0.12)",
            br: "rgba(34,197,94,0.20)",
            fg: "var(--app-text)",
            icon: "#16a34a",
          }
        : {
            bg: "rgba(239,68,68,0.10)",
            br: "rgba(239,68,68,0.18)",
            fg: "var(--app-text)",
            icon: "#ef4444",
          };

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs font-medium flex items-start gap-2 transition-colors duration-300 ease-out"
      role={tone === "error" ? "alert" : "status"}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.br || borderColor || "var(--app-border)",
        color: palette.fg,
      }}
    >
      <AlertCircle
        className="w-4 h-4 mt-0.5 shrink-0 opacity-90"
        style={{ color: palette.icon }}
      />
      <div className="leading-relaxed">{message}</div>
    </div>
  );
};

/* =========================
   Main Form Component
========================= */
const AddWellnessApplicationForm = ({ onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const { admin, user } = useAuth();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    const base =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.06)";
    const highlight =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(15,23,42,0.10)";
    return {
      baseColor: `var(--skeleton-base, ${base})`,
      highlightColor: `var(--skeleton-highlight, ${highlight})`,
    };
  }, [resolvedTheme]);

  const [showRouting, setShowRouting] = useState(false);
  const dateInputRef = useRef(null);

  // Date input states
  const [dateValue, setDateValue] = useState("");
  const [dateError, setDateError] = useState("");

  const [banner, setBanner] = useState({ tone: "error", message: "" });
  const clearBanner = () => setBanner({ tone: "error", message: "" });
  const showBanner = (tone, message) => setBanner({ tone, message });

  // Submission Latches
  const successLatchRef = useRef(false);
  const [successLatchUI, setSuccessLatchUI] = useState(false);
  const submitInFlightRef = useRef(false);

  const initialState = useMemo(
    () => ({
      reason: "",
      inclusiveDates: [],
      routeId: "",
    }),
    [],
  );

  const [formData, setFormData] = useState(initialState);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setShowRouting(false);
    setDateValue("");
    setDateError("");
    clearBanner();
    successLatchRef.current = false;
    setSuccessLatchUI(false);
    submitInFlightRef.current = false;
  }, [initialState]);

  useEffect(() => {
    return () => {
      successLatchRef.current = false;
      submitInFlightRef.current = false;
    };
  }, []);

  // Fetch Working Days for Lead Time
  const {
    data: workingDaysRes,
    isLoading: workingDaysLoading,
    isError: workingDaysIsError,
  } = useQuery({
    queryKey: ["workingDaysSettings"],
    queryFn: fetchWorkingDaysGeneralSettings,
    staleTime: 1000 * 60 * 5,
  });

  const workingDoc = workingDaysRes?.data;
  const leadTimeDays = useMemo(() => {
    const enabled =
      typeof workingDoc?.workingDaysEnable === "boolean"
        ? workingDoc.workingDaysEnable
        : true;
    if (!enabled) return 0;
    return clampInt(workingDoc?.workingDaysValue, 1, 7, 5);
  }, [workingDoc]);

  const minDate = useMemo(
    () => getMinSelectableDateISO(leadTimeDays),
    [leadTimeDays],
  );

  const leadTimeMsg = useMemo(() => {
    if (leadTimeDays <= 0)
      return "Requests require at least 1 day advance notice.";
    return `Requests require at least ${leadTimeDays} working day(s) advance notice.`;
  }, [leadTimeDays]);

  useEffect(() => {
    if (workingDaysIsError) {
      showBanner(
        "info",
        "Could not load Working Days settings. Using default lead time.",
      );
    }
  }, [workingDaysIsError]);

  // Fetch Balances
  const { data: balanceData, isLoading: isBalanceLoading } = useQuery({
    queryKey: ["myWellnessBalance"],
    queryFn: getMyWellnessBalance,
  });

  const maxWellnessDays =
    balanceData?.data?.wellnessDays ?? user?.balances?.wellnessDays ?? 0;

  // Fetch Approval Routes
  const { data: routesResponse, isLoading: isRoutesLoading } = useQuery({
    queryKey: ["approvalRoutes"],
    queryFn: fetchAllApprovalRoutes,
  });

  // Auto-select route
  useEffect(() => {
    if (routesResponse && Array.isArray(routesResponse) && !formData.routeId) {
      const myRoute = routesResponse.find(
        (r) =>
          String(r.createdBy?._id || r.createdBy) ===
          String(admin?.id || admin?._id),
      );
      if (myRoute) {
        setFormData((prev) => ({ ...prev, routeId: myRoute._id }));
      }
    }
  }, [routesResponse, admin, formData.routeId]);

  const mutation = useMutation({
    mutationFn: addWellnessApplicationRequest,
    retry: 0,
  });

  const isBusy = mutation.isPending || successLatchUI;

  // Validate typed dates instantly
  useEffect(() => {
    const err = validateDate({
      value: dateValue,
      inclusiveDates: formData.inclusiveDates,
      minDate,
      leadTimeMsg,
      maxWellnessDays,
    });
    setDateError(err);
  }, [
    dateValue,
    formData.inclusiveDates,
    minDate,
    leadTimeMsg,
    maxWellnessDays,
  ]);

  // Strip invalid dates if lead time config shifts
  useEffect(() => {
    if (!formData.inclusiveDates?.length) return;
    const filtered = formData.inclusiveDates.filter((d) => d >= minDate);
    if (filtered.length !== formData.inclusiveDates.length) {
      setFormData((prev) => ({ ...prev, inclusiveDates: filtered }));
      showBanner("info", "Some selected dates were removed (lead-time rule).");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate]);

  const handleDateInput = (e) => {
    clearBanner();
    setDateValue(e.target.value);
  };

  const handleDateCommit = (e) => {
    clearBanner();
    const v = e.target.value;
    setDateValue(v);

    const err = validateDate({
      value: v,
      inclusiveDates: formData.inclusiveDates,
      minDate,
      leadTimeMsg,
      maxWellnessDays,
    });
    setDateError(err);

    if (!isFullISODate(v) || err) return;

    if (workingDaysLoading) {
      showBanner("info", "Working-days settings are still loading.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      inclusiveDates: [...prev.inclusiveDates, v].sort(),
    }));

    setDateValue("");
    setDateError("");
    try {
      dateInputRef.current?.focus?.();
    } catch {}
  };

  const handleDateRemove = (date) => {
    clearBanner();
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: prev.inclusiveDates.filter((d) => d !== date),
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    clearBanner();
    if (name === "reason") {
      setFormData((prev) => ({
        ...prev,
        reason: value.slice(0, MAX_REASON_LEN),
      }));
    }
  };

  const sanitizeAndValidatePayload = () => {
    if (formData.inclusiveDates.length === 0) {
      return { ok: false, message: "Please select at least 1 date." };
    }

    // 🚨 Triggers the toast error if they try to submit more than 3 days
    if (formData.inclusiveDates.length > MAX_WELLNESS_DAYS) {
      return {
        ok: false,
        message: `Maximum of ${MAX_WELLNESS_DAYS} days allowed per request.`,
        isToastOnly: true, // We can catch this flag to throw a toast
      };
    }

    if (!formData.routeId) {
      return { ok: false, message: "Please select an approval route." };
    }

    const reason = String(formData.reason || "")
      .trim()
      .slice(0, MAX_REASON_LEN);
    if (!reason) {
      return {
        ok: false,
        message: "Please provide a reason or justification.",
      };
    }

    return {
      ok: true,
      payload: {
        inclusiveDates: formData.inclusiveDates,
        reason,
        routeId: formData.routeId,
      },
    };
  };

  const startSubmit = async () => {
    clearBanner();

    if (successLatchRef.current || submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    if (mutation.isPending || successLatchUI) return;

    const result = sanitizeAndValidatePayload();
    if (!result.ok) {
      if (result.isToastOnly) {
        toast.error(result.message);
      } else {
        showBanner("error", result.message);
      }
      submitInFlightRef.current = false;
      return;
    }

    try {
      await mutation.mutateAsync(result.payload);

      successLatchRef.current = true;
      setSuccessLatchUI(true);
      toast.success("Wellness Leave submitted successfully!");

      queryClient.invalidateQueries({ queryKey: ["myWellnessApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myWellnessBalance"] });

      onSuccess?.();
      if (!onSuccess) onClose?.();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to submit request.";
      showBanner("error", msg);
      submitInFlightRef.current = false;
      successLatchRef.current = false;
      setSuccessLatchUI(false);
    }
  };

  const leadTimeLabel = useMemo(() => {
    if (workingDaysLoading) return "Min. Lead Time: Loading…";
    if (leadTimeDays <= 0) return "Min. Lead Time: 1 day";
    return `Min. Lead Time: ${leadTimeDays} Work Day${
      leadTimeDays === 1 ? "" : "s"
    }`;
  }, [leadTimeDays, workingDaysLoading]);

  const dateDisabled = isBusy || workingDaysLoading;

  return (
    <div
      className="w-full max-w-xl mx-auto rounded-xl overflow-hidden border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
        color: "var(--app-text)",
      }}
    >
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        {/* Header */}
        <div
          className="px-4 py-4 border-b flex items-start sm:items-center justify-between gap-3 transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--accent-soft)",
                borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
                color: "var(--accent)",
              }}
            >
              <HeartPulse className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">Wellness Leave</h2>
              <p
                className="text-xs truncate"
                style={{ color: "var(--app-muted)" }}
              >
                Day-based wellness request
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
              style={{ color: "var(--app-muted)" }}
            >
              Available
            </p>
            {isBalanceLoading ? (
              <Skeleton width={40} />
            ) : (
              <p
                className="text-sm font-extrabold"
                style={{ color: "var(--accent)" }}
              >
                {maxWellnessDays} Day(s)
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startSubmit();
          }}
          className="flex flex-col h-[calc(100dvh-16rem)] sm:h-[calc(100vh-16rem)]"
        >
          {/* Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 cto-scrollbar">
            <Banner
              tone={banner.tone}
              message={banner.message}
              borderColor={borderColor}
            />

            {/* Total Days & Inclusive Dates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: "var(--app-text)" }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center border"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      borderColor: borderColor,
                      color: "var(--app-muted)",
                    }}
                  >
                    <Layers className="w-4 h-4" />
                  </div>
                  Total Days Selected
                </div>
                <div
                  className="w-full h-11 sm:h-10 px-3 rounded-lg border flex items-center transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                  }}
                >
                  <span
                    className="font-bold text-sm"
                    style={{ color: "var(--accent)" }}
                  >
                    {formData.inclusiveDates.length} Day(s)
                  </span>
                </div>
                {formData.inclusiveDates.length > 0 && (
                  <div
                    className="text-[10px] leading-relaxed"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Remaining allowance:{" "}
                    <span style={{ color: "var(--app-text)", fontWeight: 700 }}>
                      {Math.max(
                        0,
                        maxWellnessDays - formData.inclusiveDates.length,
                      )}
                    </span>{" "}
                    day(s)
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: "var(--app-text)" }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center border"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      borderColor: borderColor,
                      color: "var(--app-muted)",
                    }}
                  >
                    <Calendar className="w-4 h-4" />
                  </div>
                  Add Inclusive Date
                </div>

                <div className="relative">
                  <input
                    ref={dateInputRef}
                    type="date"
                    min={minDate}
                    value={dateValue}
                    onInput={handleDateInput}
                    onChange={handleDateCommit}
                    disabled={dateDisabled}
                    aria-invalid={!!dateError}
                    className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out text-[16px] sm:text-sm"
                    style={{
                      backgroundColor: dateDisabled
                        ? "var(--app-surface-2)"
                        : dateError
                          ? "rgba(239,68,68,0.08)"
                          : "var(--app-surface)",
                      borderColor: dateError
                        ? "rgba(239,68,68,0.22)"
                        : borderColor,
                      color: dateDisabled
                        ? "var(--app-muted)"
                        : "var(--app-text)",
                    }}
                  />
                </div>

                {dateError ? (
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: "#ef4444" }}
                  >
                    {dateError}
                  </div>
                ) : (
                  <div
                    className="text-[10px] leading-relaxed"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Earliest selectable date:{" "}
                    <span style={{ color: "var(--app-text)", fontWeight: 700 }}>
                      {minDate}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Dates Display */}
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--app-muted)" }}
                >
                  Selected Dates
                </span>
                <span
                  className="text-[10px] italic"
                  style={{ color: "var(--app-muted)" }}
                >
                  {leadTimeLabel}
                </span>
              </div>

              <div
                className="flex flex-wrap gap-2 p-3 rounded-xl border min-h-[50px] transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "rgba(37,99,235,0.06)",
                  borderColor: "rgba(37,99,235,0.14)",
                }}
              >
                {formData.inclusiveDates.length === 0 ? (
                  <p
                    className="text-xs italic flex items-center gap-2"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <Info size={14} style={{ color: "var(--app-muted)" }} /> No
                    dates selected yet
                  </p>
                ) : (
                  formData.inclusiveDates.map((date) => (
                    <div
                      key={date}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm border transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor:
                          "var(--accent-soft2, rgba(37,99,235,0.18))",
                        color: "var(--accent)",
                      }}
                    >
                      <span className="truncate max-w-[150px]">{date}</span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDateRemove(date)}
                        className="transition-colors disabled:opacity-50"
                        style={{ color: "var(--app-muted)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#ef4444")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--app-muted)")
                        }
                        aria-label={`Remove ${date}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <div
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "var(--app-text)" }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center border"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                    color: "var(--app-muted)",
                  }}
                >
                  <FileText className="w-4 h-4" />
                </div>
                Reason / Justification
              </div>

              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows="4"
                maxLength={MAX_REASON_LEN}
                placeholder="Provide details for your wellness leave..."
                disabled={isBusy}
                className="w-full p-3 rounded-lg outline-none resize-none text-sm border transition-colors duration-200 ease-out"
                style={{
                  backgroundColor: isBusy
                    ? "var(--app-surface-2)"
                    : "var(--app-surface)",
                  borderColor: borderColor,
                  color: isBusy ? "var(--app-muted)" : "var(--app-text)",
                }}
              />

              <div
                className="text-[10px] text-right"
                style={{ color: "var(--app-muted)" }}
              >
                {String(formData.reason || "").length}/{MAX_REASON_LEN}
              </div>
            </div>

            {/* Approval Routing */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setShowRouting((s) => !s)}
                className="w-full flex items-center justify-between p-3 rounded-lg border transition-colors duration-200 ease-out disabled:opacity-60"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                  color: "var(--app-text)",
                }}
              >
                <div className="flex items-center gap-2 text-sm font-bold">
                  <UserCheck size={16} style={{ color: "var(--app-muted)" }} />
                  Approval Routing
                </div>
                {showRouting ? (
                  <ChevronUp size={16} style={{ color: "var(--app-muted)" }} />
                ) : (
                  <ChevronDown
                    size={16}
                    style={{ color: "var(--app-muted)" }}
                  />
                )}
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  showRouting
                    ? "max-h-[420px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-3 pt-1 px-1">
                  {isRoutesLoading ? (
                    <Skeleton height={40} borderRadius={8} />
                  ) : !formData.routeId ? (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-2">
                      <AlertCircle size={14} />
                      You haven't set up an approval route yet.
                      <a
                        href="/app/approval-routes"
                        className="underline font-bold"
                      >
                        Set it up here
                      </a>
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-lg border bg-[color:var(--app-surface-2)] border-[color:var(--app-border)]">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1">
                        Active Workflow
                      </p>
                      <p className="text-sm font-bold text-[color:var(--app-text)]">
                        {routesResponse?.find((r) => r._id === formData.routeId)
                          ?.name || "Personal Workflow"}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 mt-2 max-h-[250px] overflow-y-auto pr-1 cto-scrollbar">
                    {formData.routeId &&
                      routesResponse
                        ?.find((r) => r._id === formData.routeId)
                        ?.steps?.filter((s) => s.isEnabled !== false)
                        ?.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 rounded-lg shadow-sm border transition-colors duration-300 ease-out"
                            style={{
                              backgroundColor: "var(--app-surface)",
                              borderColor: borderColor,
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 border"
                              style={{
                                backgroundColor: "var(--accent-soft)",
                                color: "var(--accent)",
                                borderColor:
                                  "var(--accent-soft2, rgba(37,99,235,0.18))",
                              }}
                            >
                              {idx + 1}
                            </div>

                            <div className="min-w-0">
                              <p
                                className="text-xs font-semibold truncate"
                                style={{ color: "var(--app-text)" }}
                              >
                                {step.approver
                                  ? `${step.approver.firstName} ${step.approver.lastName}`
                                  : "Not Assigned"}
                              </p>
                              <p
                                className="text-[10px] uppercase tracking-tight truncate"
                                style={{ color: "var(--app-muted)" }}
                              >
                                {step.approver?.position ||
                                  "Position not specified"}
                              </p>
                            </div>
                          </div>
                        ))}
                    {!formData.routeId && !isRoutesLoading && (
                      <div
                        className="p-3 text-center text-xs italic"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Please select an approval route to proceed.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div
            className="border-t px-4 py-3 flex flex-row items-stretch sm:items-center gap-2 sm:gap-3 sticky bottom-0 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
            }}
          >
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                if (mutation.isPending) return;
                if (!successLatchRef.current) resetForm();
                onClose?.();
              }}
              className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 rounded-lg border font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor: borderColor,
                color: "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.filter = "brightness(0.98)";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
            >
              Close
            </button>

            <button
              type="submit"
              disabled={
                isBusy ||
                (workingDaysLoading && !workingDaysIsError) ||
                formData.inclusiveDates.length === 0 ||
                !!dateError
              }
              className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 rounded-lg font-bold disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200 ease-out shadow-sm"
              style={{
                backgroundColor: "var(--accent)",
                border: "1px solid var(--accent)",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.filter = "brightness(0.95)";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
            >
              {workingDaysLoading
                ? "Loading..."
                : mutation.isPending
                  ? "Submitting..."
                  : successLatchUI
                    ? "Submitted"
                    : "Submit Request"}
            </button>
          </div>
        </form>
      </SkeletonTheme>
    </div>
  );
};

export default AddWellnessApplicationForm;
