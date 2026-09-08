import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addWellnessApplicationRequest,
  fetchMyWellnessApplications,
} from "../../../../api/wellnessApplication";
import { fetchPublicWorkingDaysGeneralSettings } from "../../../../api/generalSettings";
import { fetchAllApprovalRoutes } from "../../../../api/approvalRoute";
import { getMyWellnessBalance } from "../../../../api/employee";
import { useAuth } from "../../../../store/authStore";
import Breadcrumbs from "../../../breadCrumbs";
import {
  Calendar,
  FileText,
  UserCheck,
  AlertCircle,
  X,
  HeartPulse,
  Layers,
  ArrowLeft,
  UploadCloud,
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

const isNonWorkingDay = (iso, activeWorkingDays = [1, 2, 3, 4, 5]) => {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  return !activeWorkingDays.includes(day);
};

const isFullISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

const getMinSelectableDateISO = (
  leadTimeDays = 5,
  activeWorkingDays = [1, 2, 3, 4, 5],
) => {
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
    if (activeWorkingDays.includes(day)) count++;
  }

  date.setDate(date.getDate() + 1);

  while (!activeWorkingDays.includes(date.getDay())) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString().split("T")[0];
};

const makeClientRequestId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {}
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
  blockedDates,
  minDate,
  isLateMode,
  todayISO,
  leadTimeMsg,
  maxWellnessDays,
  activeWorkingDays,
}) => {
  if (!value) return "";
  if (!isFullISODate(value)) return "";

  // Late Filing rules vs Normal rules
  if (isLateMode && value < todayISO) return "Cannot select past dates.";
  if (!isLateMode && value < minDate) return leadTimeMsg;

  if (isNonWorkingDay(value, activeWorkingDays))
    return "Please select a valid scheduled working day.";
  if (inclusiveDates.includes(value)) return "That date is already selected.";

  // ✅ PREVENT OVERLAPPING WITH EXISTING PENDING/APPROVED DATES
  if (blockedDates.includes(value)) {
    return "You already have a Pending/Approved application for this date.";
  }

  const tempDates = [...inclusiveDates, value];

  if (tempDates.length > maxWellnessDays) {
    return `You only have ${maxWellnessDays} Wellness Day(s) left.`;
  }

  if (tempDates.length > MAX_WELLNESS_DAYS) {
    return `Maximum of ${MAX_WELLNESS_DAYS} days allowed per request.`;
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
        : tone === "amber"
          ? {
              bg: "rgba(245,158,11,0.10)",
              br: "rgba(245,158,11,0.25)",
              fg: "var(--app-text)",
              icon: "#f59e0b",
            }
          : {
              bg: "rgba(239,68,68,0.10)",
              br: "rgba(239,68,68,0.18)",
              fg: "var(--app-text)",
              icon: "#ef4444",
            };

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs font-medium flex items-start gap-2 transition-colors duration-300 ease-out mb-6"
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
const AddWellnessApplicationForm = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { admin, user } = useAuth();

  const [searchParams] = useSearchParams();
  const isLateMode = searchParams.get("late") === "true";

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

  const dateInputRef = useRef(null);

  // Late Filing States
  const [lateJustification, setLateJustification] = useState("");
  const [lateAttachment, setLateAttachment] = useState(null);

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
    queryFn: fetchPublicWorkingDaysGeneralSettings,
    staleTime: 1000 * 60 * 5,
  });

  const workingDoc = workingDaysRes?.data;

  const activeWorkingDays = workingDoc?.activeWorkingDays || [1, 2, 3, 4, 5];
  const isAttachmentRequired = Boolean(
    workingDoc?.lateFilingAttachmentRequired,
  );

  const leadTimeDays = useMemo(() => {
    const enabled =
      typeof workingDoc?.workingDaysEnable === "boolean"
        ? workingDoc.workingDaysEnable
        : true;
    if (!enabled) return 0;
    return clampInt(workingDoc?.workingDaysValue, 1, 7, 5);
  }, [workingDoc]);

  const minDate = useMemo(
    () => getMinSelectableDateISO(leadTimeDays, activeWorkingDays),
    [leadTimeDays, activeWorkingDays],
  );

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Date Picker minimum changes depending on explicit mode
  const pickerMinDate = isLateMode ? todayISO : minDate;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ✅ NEW: Fetch the user's Wellness applications to determine overlapping dates
  const { data: appsResponse, isLoading: appsLoading } = useQuery({
    queryKey: ["myWellnessApplications"],
    queryFn: fetchMyWellnessApplications,
  });

  // ✅ NEW: Extract all dates from PENDING or APPROVED applications
  const blockedDates = useMemo(() => {
    const apps =
      appsResponse?.data?.data || appsResponse?.data || appsResponse || [];
    if (!Array.isArray(apps)) return [];

    const blocked = [];
    apps.forEach((app) => {
      if (app.overallStatus === "PENDING" || app.overallStatus === "APPROVED") {
        if (Array.isArray(app.inclusiveDates)) {
          app.inclusiveDates.forEach((d) => {
            if (!d) return;
            const dateString =
              typeof d === "string" ? d : new Date(d).toISOString();
            const shortDate = dateString.split("T")[0];
            if (shortDate) blocked.push(shortDate);
          });
        }
      }
    });
    return Array.from(new Set(blocked));
  }, [appsResponse]);

  // Auto-select route
  const myRoute = useMemo(() => {
    if (!routesResponse || !Array.isArray(routesResponse)) return null;
    return routesResponse.find(
      (r) =>
        String(r.createdBy?._id || r.createdBy) ===
        String(admin?.id || admin?._id),
    );
  }, [routesResponse, admin]);

  const hasValidApprovalRoute = useMemo(() => {
    if (!myRoute) return false;
    if (!myRoute.steps || myRoute.steps.length === 0) return false;
    return myRoute.steps.some(
      (step) => step.isEnabled !== false && step.approver,
    );
  }, [myRoute]);

  useEffect(() => {
    if (myRoute && !formData.routeId) {
      setFormData((prev) => ({ ...prev, routeId: myRoute._id }));
    }
  }, [myRoute, formData.routeId]);

  const mutation = useMutation({
    mutationFn: addWellnessApplicationRequest,
    retry: 0,
  });

  const isBusy = mutation.isPending || successLatchUI || appsLoading;

  // Validate typed dates instantly
  useEffect(() => {
    const err = validateDate({
      value: dateValue,
      inclusiveDates: formData.inclusiveDates,
      blockedDates,
      minDate,
      isLateMode,
      todayISO,
      leadTimeMsg,
      maxWellnessDays,
      activeWorkingDays,
    });
    setDateError(err);
  }, [
    dateValue,
    formData.inclusiveDates,
    blockedDates,
    minDate,
    isLateMode,
    todayISO,
    leadTimeMsg,
    maxWellnessDays,
    activeWorkingDays,
  ]);

  // Strip invalid dates if lead time config shifts (only if NOT late mode)
  useEffect(() => {
    if (!formData.inclusiveDates?.length) return;
    if (!isLateMode) {
      const filtered = formData.inclusiveDates.filter((d) => d >= minDate);
      if (filtered.length !== formData.inclusiveDates.length) {
        setFormData((prev) => ({ ...prev, inclusiveDates: filtered }));
        showBanner(
          "info",
          "Some selected dates were removed (lead-time rule). Use 'Late Filing' to bypass.",
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate, isLateMode]);

  const handleDateInput = (e) => {
    clearBanner();
    setDateValue(e.target.value);

    const err = validateDate({
      value: e.target.value,
      inclusiveDates: formData.inclusiveDates,
      blockedDates,
      minDate,
      isLateMode,
      todayISO,
      leadTimeMsg,
      maxWellnessDays,
      activeWorkingDays,
    });
    setDateError(err);
  };

  const handleDateCommit = (e) => {
    clearBanner();
    const v = e.target.value;
    setDateValue(v);

    const err = validateDate({
      value: v,
      inclusiveDates: formData.inclusiveDates,
      blockedDates,
      minDate,
      isLateMode,
      todayISO,
      leadTimeMsg,
      maxWellnessDays,
      activeWorkingDays,
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

    if (formData.inclusiveDates.length > MAX_WELLNESS_DAYS) {
      return {
        ok: false,
        message: `Maximum of ${MAX_WELLNESS_DAYS} days allowed per request.`,
        isToastOnly: true,
      };
    }

    if (formData.inclusiveDates.length > maxWellnessDays) {
      return {
        ok: false,
        message: `You only have ${maxWellnessDays} Wellness Day(s) left.`,
        isToastOnly: true,
      };
    }

    const overlaps = formData.inclusiveDates.filter((d) =>
      blockedDates.includes(d),
    );
    if (overlaps.length > 0) {
      return {
        ok: false,
        message: `You already have a Pending or Approved application for: ${overlaps.join(", ")}`,
        isToastOnly: true,
      };
    }

    if (!formData.routeId) {
      return { ok: false, message: "Please select an approval route." };
    }

    if (!hasValidApprovalRoute) {
      return {
        ok: false,
        message:
          "Your approval workflow has no active approvers. Please check your settings.",
      };
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
        clientRequestId: makeClientRequestId(),
        employeeType: admin?.employeeType || "JO",
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

    // ✅ Strict Check: If late mode, require justification
    if (isLateMode && !lateJustification.trim()) {
      showBanner("error", "Late filing justification is required to proceed.");
      submitInFlightRef.current = false;
      return;
    }

    // ✅ Strict Check: If late mode & attachment required, block if missing
    if (isLateMode && isAttachmentRequired && !lateAttachment) {
      showBanner(
        "error",
        "A supporting document is required for late filings. Please attach a file.",
      );
      submitInFlightRef.current = false;
      return;
    }

    try {
      // ✅ Switch to FormData for multipart submission
      const formPayload = new FormData();
      formPayload.append("reason", result.payload.reason);
      formPayload.append("routeId", result.payload.routeId);
      formPayload.append("employeeType", result.payload.employeeType);
      formPayload.append(
        "inclusiveDates",
        JSON.stringify(result.payload.inclusiveDates),
      );
      formPayload.append("clientRequestId", result.payload.clientRequestId);

      if (isLateMode) {
        formPayload.append(
          "lateFiling",
          JSON.stringify({
            isLateFiling: true,
            justification: lateJustification.trim(),
          }),
        );
        if (lateAttachment) {
          formPayload.append("file", lateAttachment);
        }
      }

      await mutation.mutateAsync(formPayload);

      successLatchRef.current = true;
      setSuccessLatchUI(true);
      toast.success("Wellness Leave submitted successfully!");

      queryClient.invalidateQueries({ queryKey: ["myWellnessApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myWellnessBalance"] });

      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit request.";
      showBanner("error", msg);
      toast.error(msg);
      submitInFlightRef.current = false;
      successLatchRef.current = false;
      setSuccessLatchUI(false);
    }
  };

  const leadTimeLabel = useMemo(() => {
    if (isLateMode) return "Late Filing Allowed";
    if (workingDaysLoading) return "Min. Lead Time: Loading…";
    if (leadTimeDays <= 0) return "Min. Lead Time: 1 day";
    return `Min. Lead Time: ${leadTimeDays} Work Day${
      leadTimeDays === 1 ? "" : "s"
    }`;
  }, [leadTimeDays, workingDaysLoading, isLateMode]);

  // ✅ Disabled while fetching applications
  const dateDisabled = isBusy || workingDaysLoading || appsLoading;

  return (
    <div
      className="w-full max-w-4xl transition-colors duration-300 ease-out pb-12"
      style={{ color: "var(--app-text)" }}
    >
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        {/* Page Header */}
        <div className="pt-2 pb-6 px-4 md:px-0">
          <Breadcrumbs rootLabel="home" rootTo="/app" />
          <h1
            className="text-2xl md:text-3xl font-bold tracking-tight font-sans mt-2"
            style={{ color: "var(--app-text)" }}
          >
            New Wellness Leave
            {isLateMode && (
              <span className="ml-3 text-sm font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 align-middle">
                Late Filing Enabled
              </span>
            )}
          </h1>
          <p
            className="block text-sm mt-1 max-w-2xl"
            style={{ color: "var(--app-muted)" }}
          >
            File a new day-based Wellness Leave request for approval.
          </p>
        </div>

        {/* Form Card */}
        <div
          className="w-full rounded-xl overflow-hidden border shadow-sm transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          {/* Card Header */}
          <div
            className="px-6 py-5 border-b flex items-center justify-between gap-3 transition-colors duration-300 ease-out"
            style={{ borderColor: borderColor }}
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
                <HeartPulse className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate">
                  Request Details
                </h2>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Available Balance
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
            className="flex flex-col"
          >
            <div className="px-6 py-6 space-y-8">
              <Banner
                tone={banner.tone}
                message={banner.message}
                borderColor={borderColor}
              />

              {/* Total Days & Inclusive Dates Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
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
                      backgroundColor: isBusy
                        ? "var(--app-surface-2)"
                        : "var(--app-surface)",
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
                      <span
                        style={{ color: "var(--app-text)", fontWeight: 700 }}
                      >
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
                      min={pickerMinDate}
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
                      <span
                        style={{ color: "var(--app-text)", fontWeight: 700 }}
                      >
                        {pickerMinDate}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Dates Display */}
              {formData.inclusiveDates.length > 0 && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Dates Selected ({formData.inclusiveDates.length} /{" "}
                      {Math.min(MAX_WELLNESS_DAYS, maxWellnessDays)} Max)
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
                    {formData.inclusiveDates.map((date) => (
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
                    ))}
                  </div>
                </div>
              )}

              {/* ✅ LATE FILING UI BLOCK */}
              {isLateMode && (
                <div
                  className="space-y-4 p-5 rounded-xl border transition-colors duration-300 ease-out animate-in fade-in"
                  style={{
                    backgroundColor:
                      resolvedTheme === "dark"
                        ? "rgba(245,158,11,0.05)"
                        : "#fffbeb",
                    borderColor:
                      resolvedTheme === "dark"
                        ? "rgba(245,158,11,0.2)"
                        : "#fde68a",
                  }}
                >
                  <Banner
                    tone="amber"
                    message="You have opted to file this request late. A justification is required to proceed."
                  />

                  <div className="space-y-2 mt-4">
                    <label
                      className="text-sm font-bold flex items-center gap-2"
                      style={{
                        color: resolvedTheme === "dark" ? "#fcd34d" : "#b45309",
                      }}
                    >
                      Late Filing Justification{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={lateJustification}
                      onChange={(e) => setLateJustification(e.target.value)}
                      disabled={isBusy}
                      className="w-full p-3 rounded-lg outline-none resize-none text-sm border transition-colors"
                      style={{
                        backgroundColor: isBusy
                          ? "var(--app-surface-2)"
                          : "var(--app-surface)",
                        borderColor:
                          resolvedTheme === "dark"
                            ? "rgba(245,158,11,0.3)"
                            : "#fcd34d",
                        color: "var(--app-text)",
                      }}
                      rows={3}
                      placeholder="Explain why this request is being filed on short notice..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-bold flex items-center gap-2"
                      style={{
                        color: resolvedTheme === "dark" ? "#fcd34d" : "#b45309",
                      }}
                    >
                      <UploadCloud size={16} />
                      Supporting Document{" "}
                      {isAttachmentRequired ? (
                        <span className="text-red-500">*</span>
                      ) : (
                        <span className="text-xs font-normal opacity-70">
                          (Optional)
                        </span>
                      )}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={isBusy}
                      onChange={(e) => setLateAttachment(e.target.files[0])}
                      className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold cursor-pointer transition-colors"
                      style={{
                        color: "var(--app-text)",
                      }}
                    />
                    <style>{`
                      input[type="file"]::file-selector-button {
                        background-color: ${resolvedTheme === "dark" ? "rgba(245,158,11,0.1)" : "#fef3c7"};
                        color: ${resolvedTheme === "dark" ? "#fcd34d" : "#b45309"};
                        transition: background-color 0.2s;
                      }
                      input[type="file"]::file-selector-button:hover {
                        background-color: ${resolvedTheme === "dark" ? "rgba(245,158,11,0.2)" : "#fde68a"};
                      }
                    `}</style>
                  </div>
                </div>
              )}

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
              <div
                className="space-y-3 pt-6 mt-6 border-t transition-colors duration-300 ease-out"
                style={{ borderColor: borderColor }}
              >
                <div
                  className="flex items-center gap-2 text-sm font-bold"
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
                    <UserCheck className="w-4 h-4" />
                  </div>
                  Approval Steps
                </div>

                <div className="space-y-2 mt-2">
                  {isRoutesLoading ? (
                    <Skeleton height={40} borderRadius={8} count={2} />
                  ) : !hasValidApprovalRoute ? (
                    <div
                      className="p-3 rounded-lg border flex items-start sm:items-center gap-2 text-xs font-medium transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "rgba(245,158,11,0.10)",
                        borderColor: "rgba(245,158,11,0.30)",
                        color: resolvedTheme === "dark" ? "#fcd34d" : "#b45309",
                      }}
                    >
                      <AlertCircle
                        size={14}
                        className="shrink-0 mt-0.5 sm:mt-0"
                      />
                      <span>
                        You need an active approval route to submit an
                        application. Please configure your approval route
                        settings and ensure at least one approver is enabled.
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {myRoute?.steps
                        ?.filter((s) => s.isEnabled !== false)
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
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div
              className="border-t px-6 py-4 flex flex-row items-stretch sm:items-center justify-end gap-3 sticky bottom-0 transition-colors duration-300 ease-out"
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
                  navigate(-1);
                }}
                className="px-6 py-2.5 sm:py-2 rounded-lg border font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
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
                Back
              </button>

              <button
                type="submit"
                disabled={
                  isBusy ||
                  (workingDaysLoading && !workingDaysIsError) ||
                  !hasValidApprovalRoute ||
                  formData.inclusiveDates.length === 0 ||
                  appsLoading // ✅ Disable button if still loading past apps
                }
                className="w-full sm:w-auto px-8 py-2.5 sm:py-2 rounded-lg font-bold disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
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
                {workingDaysLoading || appsLoading
                  ? "Loading..."
                  : mutation.isPending
                    ? "Submitting..."
                    : successLatchUI
                      ? "Submitted"
                      : "Submit Application"}
              </button>
            </div>
          </form>
        </div>
      </SkeletonTheme>
    </div>
  );
};

export default AddWellnessApplicationForm;
