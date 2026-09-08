import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addApplicationRequest,
  fetchMyCtoMemos,
  fetchMyCtoApplications,
} from "../../../../api/cto";
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
  Clock,
  Calendar,
  FileText,
} from "lucide-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import Breadcrumbs from "../../../breadCrumbs";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import * as yup from "yup";

import SelectCtoMemoModal from "./selectCtoMemoModal";
import Forbidden403 from "../../../../pages/forbidden403_FormPage";

const MAX_REASON_LEN = 1000;

const clampNumber = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
};

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

const requiredDaysFromHours = (hours, hoursPerDay = 8) => {
  const h = Number(hours || 0);
  if (!Number.isFinite(h) || h <= 0) return 0;
  return Math.ceil(h / hoursPerDay);
};

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

const AddCtoApplicationForm = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // URL State Detection for Late Filing
  const [searchParams] = useSearchParams();
  const isLateMode = searchParams.get("late") === "true";

  // LOCAL SESSION DATA
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

  const [dateValue, setDateValue] = useState("");
  const [dateError, setDateError] = useState("");

  const [banner, setBanner] = useState({ tone: "error", message: "" });
  const clearBanner = () => setBanner({ tone: "error", message: "" });
  const showBanner = (tone, message) => setBanner({ tone, message });

  const successLatchRef = useRef(false);
  const [successLatchUI, setSuccessLatchUI] = useState(false);
  const submitInFlightRef = useRef(false);

  // CTO Specific States
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [selectedMemos, setSelectedMemos] = useState([]);
  const [maxRequestedHours, setMaxRequestedHours] = useState(0);

  // Late Filing States
  const [lateJustification, setLateJustification] = useState("");
  const [lateAttachment, setLateAttachment] = useState(null);

  const initialState = useMemo(
    () => ({
      leaveType: "Compensatory Time-Off (CTO)",
      requestedHours: "",
      memos: [],
      commutation: "Not Requested",
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

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setSelectedMemos([]);
    setIsMemoModalOpen(false);
    setLateJustification("");
    setLateAttachment(null);

    setDateValue("");
    setDateError("");
    clearBanner();

    successLatchRef.current = false;
    setSuccessLatchUI(false);
    submitInFlightRef.current = false;
  }, [initialState]);

  // LIVE DATABASE DATA
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
  const hasSignature = Boolean(liveProfile.signature);
  const checkingProfile =
    isProfileLoading || (isProfileFetching && !hasSignature);

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
  const hoursPerDay = workingDoc?.hoursPerDay || 8;
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

  const { data: memoResponse, isLoading: memoLoading } = useQuery({
    queryKey: ["myCtoMemos"],
    queryFn: fetchMyCtoMemos,
  });

  const { data: appsResponse, isLoading: appsLoading } = useQuery({
    queryKey: ["ctoApplications"],
    queryFn: fetchMyCtoApplications,
  });

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

  const validMemos = useMemo(() => {
    const list = memoResponse?.memos || [];
    return list.filter(
      (memo) =>
        memo.status?.toLowerCase() !== "rolledback" &&
        Number(memo.remainingHours) > 0,
    );
  }, [memoResponse]);

  useEffect(() => {
    const totalRemaining = validMemos.reduce(
      (sum, m) => sum + Number(m.remainingHours || 0),
      0,
    );
    setMaxRequestedHours(totalRemaining);
  }, [validMemos]);

  // ✅ ENFORCE CSC USAGE MAX LIMIT (40 hours per application max)
  const absoluteMaxAllowed = Math.min(maxRequestedHours || 0, 40);

  const mutation = useMutation({
    mutationFn: addApplicationRequest,
    retry: 0,
  });

  const isBusy = mutation.isPending || successLatchUI || appsLoading;
  const isFormDisabled = !hasSignature || checkingProfile || isBusy;

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

  const requiredDays = useMemo(() => {
    return Math.ceil(Number(formData.requestedHours || 0) / hoursPerDay);
  }, [formData.requestedHours, hoursPerDay]);

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

  useEffect(() => {
    if (!requiredDays) return;
    if (formData.inclusiveDates.length <= requiredDays) return;
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: prev.inclusiveDates.slice(0, requiredDays),
    }));
    showBanner(
      "info",
      `Selected dates were trimmed to ${requiredDays} day(s) based on your input.`,
    );
  }, [requiredDays]);

  const validateDateLogic = useCallback(
    (value) => {
      if (!value) return "";
      if (!isFullISODate(value)) return "";

      const rh = Number(formData.requestedHours || 0);
      if (!rh || rh <= 0) return "Please enter requested hours first.";

      if (isLateMode && value < todayISO) return "Cannot select past dates.";
      if (!isLateMode && value < minDate) return leadTimeMsg;

      if (isNonWorkingDay(value, activeWorkingDays))
        return "Please select a valid scheduled working day.";
      if (formData.inclusiveDates.includes(value))
        return "That date is already selected.";

      if (blockedDates.includes(value)) {
        return "You already have a Pending/Approved application for this date.";
      }

      if (requiredDays > 0 && formData.inclusiveDates.length >= requiredDays) {
        return `You must select exactly ${requiredDays} day(s).`;
      }
      return "";
    },
    [
      formData.requestedHours,
      formData.inclusiveDates,
      minDate,
      isLateMode,
      todayISO,
      leadTimeMsg,
      requiredDays,
      activeWorkingDays,
      blockedDates,
    ],
  );

  useEffect(() => {
    setDateError(validateDateLogic(dateValue));
  }, [dateValue, validateDateLogic]);

  const allocateMemosForHours = useCallback(
    (hours) => {
      let remaining = hours;
      const newSelected = [];
      const newFormMemos = [];

      for (const memo of validMemos) {
        if (remaining <= 0) break;
        const memoId = memo.id || memo._id || memo.memoId;
        const remainingHours = Number(memo.remainingHours || 0);
        const applied = Math.min(remainingHours, remaining);

        if (!memoId || applied <= 0) continue;
        remaining -= applied;
        newSelected.push({ ...memo, id: memoId, appliedHours: applied });
        newFormMemos.push({ memoId, appliedHours: applied });
      }
      return { newSelected, newFormMemos };
    },
    [validMemos],
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    clearBanner();

    if (name === "requestedHours") {
      const requested =
        value === "" ? "" : clampNumber(value, 1, absoluteMaxAllowed);

      if (memoLoading) {
        setFormData((prev) => ({
          ...prev,
          requestedHours: String(requested),
          inclusiveDates: [],
          memos: [],
        }));
        setSelectedMemos([]);
        setDateValue("");
        setDateError("");
        return;
      }

      const { newSelected, newFormMemos } = allocateMemosForHours(
        Number(requested),
      );
      setSelectedMemos(newSelected);
      setFormData((prev) => ({
        ...prev,
        requestedHours: String(requested),
        inclusiveDates: [],
        memos: newFormMemos,
      }));
      setDateValue("");
      setDateError("");
      return;
    }

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

    if (requiredDays > 0 && formData.inclusiveDates.length >= requiredDays) {
      setDateError(`You must select exactly ${requiredDays} day(s).`);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      inclusiveDates: [...prev.inclusiveDates, v],
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
      inclusiveDates: prev.inclusiveDates.filter((d) => d !== date),
    }));
  };

  const validationSchema = useMemo(() => {
    return yup.object().shape({
      requestedHours: yup
        .number()
        .typeError("Must be a valid number.")
        .required("Please enter requested hours.")
        .min(4, "Minimum availment is 4 hours (half-day).") // ✅ CSC Rule
        .max(
          absoluteMaxAllowed,
          `Cannot exceed max allowed (${absoluteMaxAllowed} hrs). Check your credits.`,
        )
        .test(
          "is-block-of-four",
          "CTO must be filed in blocks of 4 or 8 hours.",
          (value) => value % 4 === 0, // ✅ CSC Rule
        )
        .test(
          "memos-loaded",
          "Please wait while memos are loading.",
          () => !memoLoading,
        ),
      commutation: yup
        .string()
        .required("Commutation is required for Organic employees."),
      reason: yup
        .string()
        .trim()
        .required("Reason / Purpose is required.")
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
        .test("required-days-match", function (dates) {
          const reqDays = Math.ceil(
            Number(this.parent.requestedHours || 0) / hoursPerDay,
          );
          if (reqDays <= 0)
            return this.createError({
              message: "Please enter requested hours.",
            });
          if (!dates || dates.length !== reqDays) {
            return this.createError({
              message: `Please select exactly ${reqDays} date(s).`,
            });
          }
          return true;
        })
        .test("lead-time", leadTimeMsg, (dates) => {
          if (!dates) return true;
          if (isLateMode) return true; // Bypass lead-time validation in explicit late mode
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
      memos: yup
        .array()
        .test(
          "sufficient-credits",
          "Insufficient memo credits to cover requested hours.",
          function (memos) {
            const reqHours = this.parent.requestedHours;
            if (!reqHours) return true;
            const sum = (memos || []).reduce(
              (acc, m) => acc + (Number(m.appliedHours) || 0),
              0,
            );
            return sum >= reqHours;
          },
        ),
    });
  }, [
    absoluteMaxAllowed,
    minDate,
    isLateMode,
    leadTimeMsg,
    hasValidApprovalRoute,
    memoLoading,
    hoursPerDay,
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
        employeeType:
          liveProfile.employeeType || sessionAdmin.employeeType || "Organic",
        commutation: formData.commutation,
        reason: String(formData.reason || "").trim(),
        inclusiveDates: Array.from(
          new Set((formData.inclusiveDates || []).filter(Boolean)),
        ).sort(),
        routeId: formData.routeId,
        requestedHours: Number(formData.requestedHours || 0),
        memos: (formData.memos || [])
          .map((m) => ({
            memoId: m.memoId,
            appliedHours: Number(m.appliedHours || 0),
          }))
          .filter((m) => m.memoId && m.appliedHours > 0),
      };

      await validationSchema.validate(rawPayload, { abortEarly: false });

      if (isLateMode && !lateJustification.trim()) {
        showBanner(
          "error",
          "Late filing justification is required to proceed.",
        );
        submitInFlightRef.current = false;
        return;
      }

      if (isLateMode && isAttachmentRequired && !lateAttachment) {
        showBanner(
          "error",
          "A supporting document is required for late filings. Please attach a file.",
        );
        submitInFlightRef.current = false;
        return;
      }

      const formPayload = new FormData();
      formPayload.append("requestedHours", rawPayload.requestedHours);
      formPayload.append("reason", rawPayload.reason);
      formPayload.append("routeId", rawPayload.routeId);
      formPayload.append("employeeType", rawPayload.employeeType);
      formPayload.append("commutation", rawPayload.commutation);

      formPayload.append("memos", JSON.stringify(rawPayload.memos));
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

      toast.success("Organic CTO application submitted successfully!");

      queryClient.invalidateQueries({ queryKey: ["ctoApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myCtoMemos"] });

      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
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

  const dateDisabled = !formData.requestedHours || isFormDisabled;

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
              Civil Service Form No. 6 (Organic CTO Edition)
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
                        Compensatory Time-Off (CTO)
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="flex flex-col md:flex-row border-b transition-colors duration-300 ease-out"
                  style={{ borderColor: borderColor }}
                >
                  <div
                    className="flex-1 p-4 relative border-b md:border-b-0 md:border-r transition-colors duration-300"
                    style={{ borderColor: borderColor }}
                  >
                    <h3 className="text-xs font-bold uppercase mb-2">
                      6.C Number of Hours Applied For
                    </h3>

                    <div
                      className="text-[10px] text-center mb-4"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Maximum Allowed (Per Request):{" "}
                      <span
                        className="font-bold"
                        style={{ color: "var(--app-text)" }}
                      >
                        {absoluteMaxAllowed} hrs
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <input
                        type="number"
                        name="requestedHours"
                        value={formData.requestedHours}
                        onChange={handleChange}
                        min={4}
                        step={4}
                        max={absoluteMaxAllowed}
                        disabled={isFormDisabled}
                        className="border-b-2 w-32 text-center outline-none bg-transparent font-bold text-lg mb-1 disabled:opacity-50 transition-colors duration-300"
                        style={{
                          borderColor: borderColor,
                          color: "var(--app-text)",
                        }}
                      />
                      <span
                        className="text-[10px] uppercase transition-colors duration-300"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Hours
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
                          disabled={dateDisabled}
                          className={`border outline-none p-1.5 text-xs bg-transparent w-full disabled:opacity-50 transition-colors duration-300 ${
                            dateError ? "border-red-500" : ""
                          }`}
                          style={{
                            borderColor: dateError ? "#ef4444" : borderColor,
                            color: "var(--app-text)",
                            backgroundColor: dateDisabled
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

                  <div className="flex-1 p-4 flex flex-col justify-between">
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

                    <div
                      className="border-t pt-4 transition-colors duration-300"
                      style={{ borderColor: borderColor }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3
                          className="text-xs font-bold uppercase transition-colors"
                          style={{ color: "var(--accent)" }}
                        >
                          CTO Memos Required
                        </h3>
                        <button
                          type="button"
                          onClick={() => setIsMemoModalOpen(true)}
                          disabled={isFormDisabled}
                          className="text-[10px] border px-2 py-1 disabled:opacity-50 transition-colors rounded"
                          style={{
                            color: "var(--accent)",
                            borderColor: "var(--accent)",
                            backgroundColor: "transparent",
                          }}
                          onMouseEnter={(e) => {
                            if (e.currentTarget.disabled) return;
                            e.currentTarget.style.backgroundColor =
                              "var(--accent-soft)";
                          }}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          Select Memos
                        </button>
                      </div>
                      {selectedMemos.length === 0 ? (
                        <div
                          className="text-[10px] italic transition-colors"
                          style={{ color: "var(--app-muted)" }}
                        >
                          No memos attached. Required for CTO.
                        </div>
                      ) : (
                        <div className="text-[10px]">
                          {selectedMemos.map((m) => (
                            <div
                              key={m.id}
                              className="flex justify-between border-b border-dashed py-1 transition-colors duration-300"
                              style={{ borderColor: borderColor }}
                            >
                              <span>{m.memoNo}</span>
                              <span className="font-bold">
                                -{m.appliedHours}h
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ✅ LATE FILING SECTION FOR ORGANIC */}
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

                <div
                  className="p-4 border-b transition-colors duration-300 ease-out"
                  style={{ borderColor: borderColor }}
                >
                  <h3 className="text-xs font-bold uppercase mb-2">
                    Reason / Purpose
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
                  appsLoading
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
                          : "Submit CTO Application"}
              </button>
            </div>
          </form>

          <SelectCtoMemoModal
            isOpen={isMemoModalOpen}
            onClose={() => setIsMemoModalOpen(false)}
            requestedHours={formData.requestedHours}
            memos={memoResponse?.memos || []}
            selectedMemos={selectedMemos}
            readOnly={true}
            showProgress={true}
          />
        </div>
      </SkeletonTheme>
    </div>
  );
};

export default AddCtoApplicationForm;
