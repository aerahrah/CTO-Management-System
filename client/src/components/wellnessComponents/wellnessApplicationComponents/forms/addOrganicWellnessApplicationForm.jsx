import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addWellnessApplicationRequest,
  fetchMyWellnessApplications,
} from "../../../../api/wellnessApplication";
import { fetchPublicWorkingDaysGeneralSettings } from "../../../../api/generalSettings";
import { fetchAllApprovalRoutes } from "../../../../api/approvalRoute";
import { getMyProfile } from "../../../../api/employee";
import { useAuth } from "../../../../store/authStore";
import {
  AlertCircle,
  X,
  UserCheck,
  PenTool,
  Loader2,
  UploadCloud,
} from "lucide-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import Breadcrumbs from "../../../breadCrumbs";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import * as yup from "yup";

// ✅ Import your newly extracted Forbidden403 component
import Forbidden403 from "../../../../pages/forbidden403_FormPage";

const MAX_REASON_LEN = 1000;
const MAX_WELLNESS_DAYS = 3;

const clampInt = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const t = Math.trunc(n);
  return Math.min(Math.max(t, min), max);
};

// ✅ UPDATED: Dynamic non-working day checker
const isNonWorkingDay = (iso, activeWorkingDays = [1, 2, 3, 4, 5]) => {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  return !activeWorkingDays.includes(day);
};

const isFullISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

// ✅ UPDATED: Dynamic lead time calculator skipping non-working days
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

  // Skip ahead if we landed on a non-working day
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
      className="rounded-xl border px-3 py-2 text-xs font-medium flex items-start gap-2 mb-4 transition-colors duration-300 ease-out"
      role={tone === "error" ? "alert" : "status"}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.br || borderColor,
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

const AddOrganicWellnessApplicationForm = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // URL State Detection for Late Filing
  const [searchParams] = useSearchParams();
  const isLateMode = searchParams.get("late") === "true";

  // ✅ LOCAL SESSION DATA: Used for immediate UI rendering (Name, Dept)
  const { admin } = useAuth();
  const sessionAdmin = admin || {};

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.15)"
      : "rgba(15,23,42,0.2)";
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

  const [dateValue, setDateValue] = useState("");
  const [dateError, setDateError] = useState("");

  const [banner, setBanner] = useState({ tone: "error", message: "" });
  const clearBanner = () => setBanner({ tone: "error", message: "" });
  const showBanner = (tone, message) => setBanner({ tone, message });

  const successLatchRef = useRef(false);
  const [successLatchUI, setSuccessLatchUI] = useState(false);
  const submitInFlightRef = useRef(false);

  const initialState = useMemo(
    () => ({
      leaveType: "Wellness Leave",
      commutation: "Not Requested", // Required choice for Organic
      inclusiveDates: [],
      reason: "",
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

  // ✅ LIVE DATABASE DATA: Strictly used for signature, salary, and access controls
  const {
    data: profileDataResponse,
    isLoading: isProfileLoading,
    isFetching: isProfileFetching,
  } = useQuery({
    queryKey: ["myProfile"],
    queryFn: getMyProfile,
    refetchOnMount: "always",
  });

  const liveProfile = profileDataResponse || {};

  // Strictly evaluate signature against live profile data
  const hasSignature = Boolean(liveProfile.signature);

  // Block the UI from assuming no signature if we are still loading
  const checkingProfile =
    isProfileLoading || (isProfileFetching && !hasSignature);

  // Pre-format Salary for Display using live profile data
  const salaryText = useMemo(() => {
    if (isProfileLoading) return "Loading...";
    const amt = liveProfile.salary?.amount;
    const sg = liveProfile.salary?.grade;
    if (amt && sg) {
      return `₱${Number(amt).toLocaleString("en-PH", { minimumFractionDigits: 2 })} (SG ${sg})`;
    } else if (amt) {
      return `₱${Number(amt).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
    } else if (sg) {
      return `SG ${sg}`;
    }
    return "N/A";
  }, [liveProfile, isProfileLoading]);

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

  // ✅ EXTRACT NEW SETTINGS WITH DEFAULTS
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

  // ✅ Pass activeWorkingDays
  const minDate = useMemo(
    () => getMinSelectableDateISO(leadTimeDays, activeWorkingDays),
    [leadTimeDays, activeWorkingDays],
  );

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);
  const pickerMinDate = isLateMode ? todayISO : minDate;

  useEffect(() => {
    if (workingDaysIsError) {
      showBanner(
        "info",
        "Could not load Working Days settings. Using default lead time.",
      );
    }
  }, [workingDaysIsError]);

  const { data: routesResponse } = useQuery({
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

  const mutation = useMutation({
    mutationFn: addWellnessApplicationRequest,
    retry: 0,
  });

  const isBusy = mutation.isPending || successLatchUI;

  // ✅ Block form interaction while apps are loading to prevent bypassing
  const isFormDisabled =
    !hasSignature || checkingProfile || isBusy || appsLoading;

  // Find approval route based on live profile ID, falling back to session ID
  const userId =
    liveProfile._id || liveProfile.id || sessionAdmin._id || sessionAdmin.id;

  const myRoute = useMemo(() => {
    if (!routesResponse || !Array.isArray(routesResponse) || !userId)
      return null;
    return routesResponse.find(
      (r) => String(r.createdBy?._id || r.createdBy) === String(userId),
    );
  }, [routesResponse, userId]);

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

  const leadTimeMsg = useMemo(() => {
    if (leadTimeDays <= 0)
      return "Applications must be filed at least 1 day in advance.";
    return `Applications must be filed at least ${leadTimeDays} working day(s) in advance.`;
  }, [leadTimeDays]);

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
  }, [minDate, isLateMode]);

  // ✅ Update Validation Logic Context to include blockedDates & lateMode
  const validateDateLogic = useCallback(
    (value) => {
      if (!value) return "";
      if (!isFullISODate(value)) return "";

      if (isLateMode && value < todayISO) return "Cannot select past dates.";
      if (!isLateMode && value < minDate) return leadTimeMsg;

      if (isNonWorkingDay(value, activeWorkingDays))
        return "Please select a valid scheduled working day.";
      if (formData.inclusiveDates.includes(value))
        return "That date is already selected.";

      // ✅ PREVENT OVERLAPPING WITH EXISTING PENDING/APPROVED DATES
      if (blockedDates.includes(value)) {
        return "You already have a Pending/Approved application for this date.";
      }

      return "";
    },
    [
      formData.inclusiveDates,
      minDate,
      isLateMode,
      todayISO,
      leadTimeMsg,
      activeWorkingDays,
      blockedDates,
    ],
  );

  useEffect(() => {
    setDateError(validateDateLogic(dateValue));
  }, [dateValue, validateDateLogic]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    clearBanner();

    if (name === "reason") {
      setFormData((prev) => ({
        ...prev,
        reason: value.slice(0, MAX_REASON_LEN),
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateInput = (e) => {
    clearBanner();
    const v = e.target.value;
    setDateValue(v);
    setDateError(validateDateLogic(v));
  };

  const handleDateCommit = (e) => {
    clearBanner();
    const v = e.target.value;
    setDateValue(v);

    const err = validateDateLogic(v);
    setDateError(err);
    if (!isFullISODate(v)) return;

    if (workingDaysLoading) {
      showBanner("info", "Working-days settings are still loading.");
      return;
    }
    if (err) return;

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
    if (isFormDisabled) return;
    clearBanner();
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: prev.inclusiveDates.filter((d) => d !== date).sort(),
    }));
  };

  // ✅ Updated Schema constraints with overlap block & late mode bypass
  const validationSchema = useMemo(() => {
    return yup.object().shape({
      commutation: yup
        .string()
        .required("Commutation is required for Organic employees."),
      reason: yup
        .string()
        .trim()
        .required("Reason / Additional Justification is required.")
        .max(
          MAX_REASON_LEN,
          `Remarks cannot exceed ${MAX_REASON_LEN} characters.`,
        ),
      routeId: yup
        .string()
        .required("Please select an approval route.")
        .test(
          "has-active-steps",
          "Your approval workflow has no active approvers.",
          () => hasValidApprovalRoute,
        ),
      inclusiveDates: yup
        .array()
        .of(yup.string())
        .min(1, "Please select at least one inclusive date.")
        .test("lead-time", leadTimeMsg, (dates) => {
          if (!dates) return true;
          if (isLateMode) return true;
          return !dates.some((d) => d < minDate);
        })
        .test(
          "no-weekends",
          "One or more selected dates fall on a non-working day.",
          (dates) =>
            !dates
              ? true
              : !dates.some((d) => isNonWorkingDay(d, activeWorkingDays)),
        )
        .test(
          "no-overlapping-dates",
          "You already have a Pending or Approved application for one or more selected dates.",
          (dates) => {
            if (!dates) return true;
            return !dates.some((d) => blockedDates.includes(d));
          },
        ),
    });
  }, [
    minDate,
    isLateMode,
    leadTimeMsg,
    hasValidApprovalRoute,
    activeWorkingDays,
    blockedDates,
  ]);

  const startSubmit = async () => {
    clearBanner();
    if (
      successLatchRef.current ||
      submitInFlightRef.current ||
      mutation.isPending ||
      successLatchUI ||
      !hasSignature
    )
      return;
    submitInFlightRef.current = true;

    try {
      const rawPayload = {
        // Employee type evaluated from live profile, fallback to session
        employeeType:
          liveProfile.employeeType || sessionAdmin.employeeType || "Organic",
        commutation: formData.commutation,
        reason: String(formData.reason || "").trim(),
        inclusiveDates: Array.from(
          new Set((formData.inclusiveDates || []).filter(Boolean)),
        ).sort(),
        routeId: formData.routeId,
        type: "WELLNESS", // explicit tag for the endpoint
      };

      await validationSchema.validate(rawPayload, { abortEarly: false });

      // ✅ Strict Check: If they clicked "Late Filing", they MUST provide justification
      if (isLateMode && !lateJustification.trim()) {
        showBanner(
          "error",
          "Late filing justification is required to proceed.",
        );
        submitInFlightRef.current = false;
        return;
      }

      // ✅ Strict Check: If late attachment is required by admin, block if missing
      if (isLateMode && isAttachmentRequired && !lateAttachment) {
        showBanner(
          "error",
          "A supporting document is required for late filings. Please attach a file.",
        );
        submitInFlightRef.current = false;
        return;
      }

      // Switch to FormData for multipart submission
      const formPayload = new FormData();
      formPayload.append("employeeType", rawPayload.employeeType);
      formPayload.append("commutation", rawPayload.commutation);
      formPayload.append("reason", rawPayload.reason);
      formPayload.append("routeId", rawPayload.routeId);
      formPayload.append("type", rawPayload.type);
      formPayload.append("clientRequestId", makeClientRequestId());
      formPayload.append(
        "inclusiveDates",
        JSON.stringify(rawPayload.inclusiveDates),
      );

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

      toast.success("Organic Wellness application submitted successfully!");

      // Invalidate relevant unified queries
      queryClient.invalidateQueries({ queryKey: ["organicApplications"] });
      queryClient.invalidateQueries({ queryKey: ["wellnessApplications"] });

      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      // ✅ Specific Yup error handling
      if (err instanceof yup.ValidationError) {
        showBanner("error", err.errors[0]);
        toast.error(err.errors[0]);
      } else {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to submit application.";
        showBanner("error", msg);
        toast.error(msg);
      }
      submitInFlightRef.current = false;
      successLatchRef.current = false;
      setSuccessLatchUI(false);
    }
  };

  // ------------------------------------------------------------------
  // 403 Forbidden Access Guard
  // Wait until profile is finished loading before evaluating type
  // ------------------------------------------------------------------
  const currentEmployeeType =
    liveProfile.employeeType || sessionAdmin.employeeType;
  if (
    !isProfileLoading &&
    profileDataResponse &&
    currentEmployeeType !== "Organic"
  ) {
    return (
      <Forbidden403
        employeeType={currentEmployeeType}
        borderColor={borderColor}
      />
    );
  }

  return (
    <div
      className="w-full max-w-5xl transition-colors duration-300 ease-out pb-12"
      style={{ color: "var(--app-text)" }}
    >
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        <div className="pt-2 pb-6 px-4 md:px-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Breadcrumbs rootLabel="home" rootTo="/app" />
          {isLateMode && (
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              Late Filing Mode Enabled
            </span>
          )}
        </div>

        <div
          className="w-full shadow-lg rounded-sm overflow-hidden transition-colors duration-300 ease-out border"
          style={{
            fontFamily: "Arial, sans-serif",
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
            borderColor: borderColor,
          }}
        >
          {/* Header Block */}
          <div
            className="text-center py-6 border-b-2 transition-colors duration-300 ease-out"
            style={{ borderColor: borderColor }}
          >
            <h1 className="text-2xl font-bold uppercase tracking-wide">
              Application for Leave
            </h1>
            <p
              className="text-xs mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Civil Service Form No. 6 (Wellness Leave Edition)
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              startSubmit();
            }}
            className="flex flex-col"
          >
            <div className="px-6 py-4">
              {/* Missing Signature Warning Block */}
              {checkingProfile ? (
                <div
                  className="mb-6 p-4 rounded flex items-center gap-3 shadow-sm border-l-4 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderLeftColor: "var(--app-muted)",
                  }}
                >
                  <Loader2
                    className="w-5 h-5 animate-spin"
                    style={{ color: "var(--app-muted)" }}
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--app-text)" }}
                  >
                    Checking signature configuration...
                  </span>
                </div>
              ) : !hasSignature ? (
                <div
                  className="mb-6 p-4 rounded flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm border-l-4 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor:
                      resolvedTheme === "dark"
                        ? "rgba(249, 115, 22, 0.1)"
                        : "#fff7ed",
                    borderLeftColor: "#f97316",
                    color: resolvedTheme === "dark" ? "#fed7aa" : "#9a3412",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">
                        E-Signature Required
                      </h4>
                      <p className="text-xs opacity-90">
                        You do not currently have a digital signature
                        configured. A signature is required to file a leave
                        application.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/app/my-profile")}
                    className="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-white text-xs font-bold rounded shadow transition-colors"
                    style={{ backgroundColor: "#ea580c" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#c2410c")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#ea580c")
                    }
                  >
                    <PenTool size={14} /> Upload Signature
                  </button>
                </div>
              ) : null}

              <Banner
                tone={banner.tone}
                message={banner.message}
                borderColor={borderColor}
              />

              {/* ✅ Employee Information Header (with Middle Name & Salary) */}
              <div
                className="mb-6 grid grid-cols-1 md:grid-cols-4 border transition-colors duration-300 ease-out text-sm"
                style={{ borderColor: borderColor }}
              >
                <div
                  className="p-2 border-b md:border-b-0 md:border-r transition-colors duration-300"
                  style={{ borderColor: borderColor }}
                >
                  <span
                    className="text-[10px] uppercase block font-semibold transition-colors"
                    style={{ color: "var(--app-muted)" }}
                  >
                    1. Office/Department
                  </span>
                  <div className="font-semibold mt-1">
                    {/* Prefer live profile, fallback to session, default to ADMIN */}
                    {liveProfile.division ||
                      liveProfile.department ||
                      sessionAdmin.division ||
                      sessionAdmin.department ||
                      "ADMIN AND FINANCE"}
                  </div>
                </div>
                <div
                  className="p-2 border-b md:border-b-0 md:border-r transition-colors duration-300"
                  style={{ borderColor: borderColor }}
                >
                  <span
                    className="text-[10px] uppercase block font-semibold transition-colors"
                    style={{ color: "var(--app-muted)" }}
                  >
                    2. Name (Last, First, Middle)
                  </span>
                  <div className="font-semibold mt-1 uppercase">
                    {`${liveProfile.lastName || sessionAdmin.lastName || ""}, ${liveProfile.firstName || sessionAdmin.firstName || ""} ${liveProfile.middleName || sessionAdmin.middleName || ""}`.trim()}
                  </div>
                </div>
                <div
                  className="p-2 border-b md:border-b-0 md:border-r transition-colors duration-300"
                  style={{ borderColor: borderColor }}
                >
                  <span
                    className="text-[10px] uppercase block font-semibold transition-colors"
                    style={{ color: "var(--app-muted)" }}
                  >
                    3. Position
                  </span>
                  <div className="font-semibold mt-1">
                    {liveProfile.position || sessionAdmin.position || "N/A"}
                  </div>
                </div>
                <div
                  className="p-2 transition-colors duration-300"
                  style={{ backgroundColor: "var(--accent-soft)" }}
                >
                  <span
                    className="text-[10px] uppercase block font-semibold transition-colors"
                    style={{ color: "var(--accent)" }}
                  >
                    4. Salary
                  </span>
                  <div
                    className="font-semibold mt-1 transition-colors"
                    style={{ color: "var(--accent)" }}
                  >
                    {salaryText}
                  </div>
                </div>
              </div>

              {/* DETAILS OF APPLICATION */}
              <div
                className={`border transition-colors duration-300 ease-out ${isFormDisabled ? "opacity-60 pointer-events-none" : ""}`}
                style={{ borderColor: borderColor }}
              >
                <div
                  className="font-bold py-1.5 uppercase text-sm tracking-widest text-center border-b transition-colors duration-300"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                  }}
                >
                  6. Details of Application
                </div>

                {/* ROW 1: Type of Leave */}
                <div
                  className="flex flex-col md:flex-row border-b transition-colors duration-300 ease-out"
                  style={{ borderColor: borderColor }}
                >
                  <div className="flex-1 p-4">
                    <h3 className="text-xs font-bold uppercase mb-3">
                      6.A Type of Leave to be Availed of
                    </h3>
                    <div
                      className="flex items-start gap-2 text-sm p-3 rounded border transition-colors duration-300"
                      style={{
                        backgroundColor: "var(--accent-soft)",
                        borderColor: "rgba(37,99,235,0.18)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        readOnly
                        className="mt-1 shrink-0"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <span
                        className="font-bold transition-colors"
                        style={{ color: "var(--accent)" }}
                      >
                        Wellness Leave
                      </span>
                    </div>
                  </div>
                </div>

                {/* ROW 2: Days / Commutation */}
                <div
                  className="flex flex-col md:flex-row border-b transition-colors duration-300 ease-out"
                  style={{ borderColor: borderColor }}
                >
                  {/* Number of Days */}
                  <div
                    className="flex-1 p-4 relative border-b md:border-b-0 md:border-r transition-colors duration-300"
                    style={{ borderColor: borderColor }}
                  >
                    <h3 className="text-xs font-bold uppercase mb-4">
                      6.C Number of Working Days Applied For
                    </h3>

                    <div className="flex flex-col items-center">
                      <div
                        className="border-b-2 w-32 text-center bg-transparent font-bold text-lg mb-1 py-1 transition-colors duration-300"
                        style={{
                          borderColor: borderColor,
                          color: "var(--app-text)",
                        }}
                      >
                        {formData.inclusiveDates.length}
                      </div>
                      <span
                        className="text-[10px] uppercase transition-colors duration-300"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Day(s)
                      </span>
                    </div>

                    <div
                      className="mt-6 border-t pt-4 transition-colors duration-300"
                      style={{ borderColor: borderColor }}
                    >
                      <h3 className="text-xs font-bold uppercase mb-2 flex justify-between items-center">
                        <span>Inclusive Dates</span>
                        <span className="text-[10px] normal-case font-normal italic text-gray-500">
                          {isLateMode ? "Late Mode Active" : `Min: ${minDate}`}
                        </span>
                      </h3>

                      <div className="flex items-center gap-2 mb-3">
                        <input
                          ref={dateInputRef}
                          type="date"
                          min={pickerMinDate}
                          value={dateValue}
                          onInput={handleDateInput}
                          onChange={handleDateCommit}
                          disabled={isFormDisabled}
                          className={`border outline-none p-1.5 text-xs bg-transparent w-full disabled:opacity-50 transition-colors duration-300 ${
                            dateError ? "border-red-500" : ""
                          }`}
                          style={{
                            borderColor: dateError ? "#ef4444" : borderColor,
                            color: "var(--app-text)",
                            backgroundColor: isFormDisabled
                              ? "var(--app-surface-2)"
                              : "transparent",
                          }}
                        />
                      </div>

                      {dateError && (
                        <div className="text-[10px] text-red-500 font-bold mb-2">
                          {dateError}
                        </div>
                      )}

                      <div
                        className="flex flex-wrap gap-1 min-h-[40px] border border-dashed p-2 transition-colors duration-300"
                        style={{ borderColor: borderColor }}
                      >
                        {formData.inclusiveDates.length === 0 ? (
                          <span
                            className="text-[10px] italic transition-colors"
                            style={{ color: "var(--app-muted)" }}
                          >
                            No dates selected
                          </span>
                        ) : (
                          formData.inclusiveDates.map((date) => (
                            <div
                              key={date}
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors duration-300"
                              style={{
                                backgroundColor: "var(--app-surface-2)",
                                borderColor: borderColor,
                                color: "var(--app-text)",
                              }}
                            >
                              {date}
                              <button
                                type="button"
                                disabled={isFormDisabled}
                                onClick={() => handleDateRemove(date)}
                                className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Commutation */}
                  <div className="flex-1 p-4 flex flex-col justify-start">
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase mb-3">
                        6.D Commutation
                      </h3>
                      <div className="space-y-2">
                        <label
                          className={`flex items-center gap-2 text-xs ${!isFormDisabled ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                        >
                          <input
                            type="radio"
                            name="commutation"
                            value="Not Requested"
                            checked={formData.commutation === "Not Requested"}
                            onChange={handleChange}
                            disabled={isFormDisabled}
                            className="transition-colors"
                            style={{ accentColor: "var(--accent)" }}
                          />
                          Not Requested
                        </label>
                        <label
                          className={`flex items-center gap-2 text-xs ${!isFormDisabled ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                        >
                          <input
                            type="radio"
                            name="commutation"
                            value="Requested"
                            checked={formData.commutation === "Requested"}
                            onChange={handleChange}
                            disabled={isFormDisabled}
                            className="transition-colors"
                            style={{ accentColor: "var(--accent)" }}
                          />
                          Requested
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ✅ LATE FILING SECTION FOR ORGANIC WELLNESS */}
                {isLateMode && (
                  <div
                    className="p-4 border-b transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "rgba(245,158,11,0.05)",
                      borderColor: borderColor,
                    }}
                  >
                    <Banner
                      tone="amber"
                      message="You have opted to file this request late. A justification is required to proceed."
                    />
                    <div className="space-y-4 mt-4">
                      <div>
                        <h3
                          className="text-xs font-bold uppercase mb-2"
                          style={{ color: "#d97706" }}
                        >
                          Late Filing Justification{" "}
                          <span className="text-red-500">*</span>
                        </h3>
                        <textarea
                          value={lateJustification}
                          onChange={(e) => setLateJustification(e.target.value)}
                          disabled={isFormDisabled}
                          className="w-full border p-2 text-xs outline-none resize-none bg-transparent disabled:opacity-50 transition-colors duration-300 rounded"
                          style={{
                            borderColor: borderColor,
                            color: "var(--app-text)",
                            backgroundColor: isFormDisabled
                              ? "var(--app-surface-2)"
                              : "var(--app-surface)",
                          }}
                          rows="3"
                          placeholder="Explain why this request is being filed on short notice..."
                        />
                      </div>
                      <div>
                        <h3
                          className="text-xs font-bold uppercase mb-2 flex items-center gap-2"
                          style={{ color: "#d97706" }}
                        >
                          <UploadCloud size={14} /> Supporting Document{" "}
                          {isAttachmentRequired ? (
                            <span className="text-red-500">*</span>
                          ) : (
                            <span className="normal-case opacity-70">
                              (Optional)
                            </span>
                          )}
                        </h3>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          disabled={isFormDisabled}
                          onChange={(e) => setLateAttachment(e.target.files[0])}
                          className="w-full text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                          style={{ color: "var(--app-text)" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ROW 3: Reason / Custom Digital Fields */}
                <div
                  className="p-4 border-b transition-colors duration-300 ease-out"
                  style={{ borderColor: borderColor }}
                >
                  <h3 className="text-xs font-bold uppercase mb-2">
                    Reason / Additional Justification
                  </h3>
                  <textarea
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    rows="2"
                    maxLength={MAX_REASON_LEN}
                    disabled={isFormDisabled}
                    className="w-full border p-2 text-xs outline-none resize-none bg-transparent disabled:opacity-50 transition-colors duration-300 rounded"
                    style={{
                      borderColor: borderColor,
                      color: "var(--app-text)",
                      backgroundColor: isFormDisabled
                        ? "var(--app-surface-2)"
                        : "transparent",
                    }}
                    placeholder="Enter justification for leave..."
                  />
                </div>

                {/* ROW 4: Approval Workflow Selection */}
                <div
                  className="p-4 transition-colors duration-300 ease-out"
                  style={{ backgroundColor: "var(--accent-soft)" }}
                >
                  <h3
                    className="text-xs font-bold uppercase mb-2 flex items-center gap-1 transition-colors"
                    style={{ color: "var(--accent)" }}
                  >
                    <UserCheck size={14} /> Workflow Approvers
                  </h3>

                  {!hasValidApprovalRoute ? (
                    <div className="text-xs text-red-500 italic">
                      No active approval route found. Please configure your
                      settings.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      {myRoute?.steps
                        ?.filter((s) => s.isEnabled !== false)
                        ?.map((step, idx) => (
                          <div
                            key={idx}
                            className="border px-3 py-1.5 text-xs flex items-center gap-2 min-w-[200px] transition-colors duration-300 rounded shadow-sm"
                            style={{
                              backgroundColor: "var(--app-surface)",
                              borderColor: "rgba(37,99,235,0.18)",
                            }}
                          >
                            <span
                              className="font-bold transition-colors"
                              style={{ color: "var(--accent)" }}
                            >
                              {idx + 1}.
                            </span>
                            <div>
                              <div
                                className="font-bold transition-colors"
                                style={{ color: "var(--app-text)" }}
                              >
                                {step.approver
                                  ? `${step.approver.firstName} ${step.approver.lastName}`
                                  : "Unassigned"}
                              </div>
                              <div
                                className="text-[10px] uppercase transition-colors"
                                style={{ color: "var(--app-muted)" }}
                              >
                                {step.approver?.position}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Submit Footer */}
            <div
              className="border-t px-6 py-4 flex flex-row items-center justify-end gap-3 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => navigate(-1)}
                className="px-6 py-2 rounded border font-semibold text-sm disabled:opacity-50 transition-colors duration-200"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                  color: "var(--app-text)",
                }}
                onMouseEnter={(e) => {
                  if (e.currentTarget.disabled) return;
                  e.currentTarget.style.filter = "brightness(0.95)";
                }}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isFormDisabled ||
                  (workingDaysLoading && !workingDaysIsError) ||
                  !hasValidApprovalRoute ||
                  appsLoading // ✅ Disable button if still loading past apps
                }
                className="px-8 py-2 rounded font-semibold text-sm disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200 text-white"
                style={{ backgroundColor: "var(--accent)" }}
                onMouseEnter={(e) => {
                  if (e.currentTarget.disabled) return;
                  e.currentTarget.style.filter = "brightness(0.95)";
                }}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
              >
                {checkingProfile || appsLoading
                  ? "Checking Status..."
                  : !hasSignature
                    ? "Signature Required"
                    : workingDaysLoading
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

export default AddOrganicWellnessApplicationForm;
