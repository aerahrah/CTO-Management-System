import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom"; // ✅ Added useNavigate
import { addApplicationRequest, fetchMyCtoMemos } from "../../../../api/cto";
import { fetchPublicWorkingDaysGeneralSettings } from "../../../../api/generalSettings";
import { fetchAllApprovalRoutes } from "../../../../api/approvalRoute";
import { useAuth } from "../../../../store/authStore";
import {
  Clock,
  Calendar,
  FileText,
  UserCheck,
  AlertCircle,
  X,
} from "lucide-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import Breadcrumbs from "../../../breadCrumbs"; // ✅ Added Breadcrumbs
import "react-loading-skeleton/dist/skeleton.css";
import SelectCtoMemoModal from "./selectCtoMemoModal";
import { toast } from "react-toastify";
import * as yup from "yup";

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

const isWeekendISO = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
};

const isFullISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

const requiredDaysFromHours = (hours) => {
  const h = Number(hours || 0);
  if (!Number.isFinite(h) || h <= 0) return 0;
  return Math.ceil(h / 8);
};

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

const validateDate = ({
  value,
  requestedHours,
  inclusiveDates,
  minDate,
  leadTimeMsg,
}) => {
  if (!value) return "";
  if (!isFullISODate(value)) return "";

  const rh = Number(requestedHours || 0);
  if (!rh || rh <= 0) return "Please enter requested hours first.";
  if (value < minDate) return leadTimeMsg;
  if (isWeekendISO(value)) return "Please select a working day (Mon–Fri).";
  if (inclusiveDates.includes(value)) return "That date is already selected.";

  const requiredDays = requiredDaysFromHours(rh);
  if (requiredDays > 0 && inclusiveDates.length >= requiredDays) {
    return `You must select exactly ${requiredDays} day(s) for ${rh} hours.`;
  }

  return "";
};

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

const AddCtoApplicationForm = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate(); // ✅ Setup navigation
  const { admin } = useAuth();

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

  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [selectedMemos, setSelectedMemos] = useState([]);
  const [maxRequestedHours, setMaxRequestedHours] = useState(0);

  const dateInputRef = useRef(null);

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
      requestedHours: "",
      reason: "",
      memos: [],
      inclusiveDates: [],
      routeId: "",
    }),
    [],
  );

  const [formData, setFormData] = useState(initialState);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setSelectedMemos([]);
    setIsMemoModalOpen(false);

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

  useEffect(() => {
    if (workingDaysIsError) {
      showBanner(
        "info",
        "Could not load Working Days settings. Using default lead time.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingDaysIsError]);

  const { data: routesResponse, isLoading: isRoutesLoading } = useQuery({
    queryKey: ["approvalRoutes"],
    queryFn: fetchAllApprovalRoutes,
  });

  const { data: memoResponse, isLoading: memoLoading } = useQuery({
    queryKey: ["myCtoMemos"],
    queryFn: fetchMyCtoMemos,
  });

  const mutation = useMutation({
    mutationFn: addApplicationRequest,
    retry: 0,
  });

  const isBusy = mutation.isPending || successLatchUI;

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

  const leadTimeMsg = useMemo(() => {
    if (leadTimeDays <= 0)
      return "Applications must be filed at least 1 day in advance.";
    return `Applications must be filed at least ${leadTimeDays} working day(s) in advance.`;
  }, [leadTimeDays]);

  const requiredDays = useMemo(
    () => requiredDaysFromHours(formData.requestedHours),
    [formData.requestedHours],
  );

  useEffect(() => {
    if (!formData.inclusiveDates?.length) return;
    const filtered = formData.inclusiveDates.filter((d) => d >= minDate);
    if (filtered.length !== formData.inclusiveDates.length) {
      setFormData((prev) => ({ ...prev, inclusiveDates: filtered }));
      showBanner("info", "Some selected dates were removed (lead-time rule).");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate]);

  useEffect(() => {
    if (!requiredDays) return;
    if (formData.inclusiveDates.length <= requiredDays) return;
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: prev.inclusiveDates.slice(0, requiredDays),
    }));
    showBanner(
      "info",
      `Selected dates were trimmed to ${requiredDays} day(s) based on requested hours.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredDays]);

  useEffect(() => {
    const err = validateDate({
      value: dateValue,
      requestedHours: formData.requestedHours,
      inclusiveDates: formData.inclusiveDates,
      minDate,
      leadTimeMsg,
    });
    setDateError(err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dateValue,
    formData.requestedHours,
    formData.inclusiveDates,
    minDate,
    leadTimeMsg,
  ]);

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

        newSelected.push({
          ...memo,
          id: memoId,
          appliedHours: applied,
        });

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
      const cap = Math.min(maxRequestedHours || 0, 300);
      const requested = value === "" ? "" : clampNumber(value, 1, cap);

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

    const err = validateDate({
      value: v,
      requestedHours: formData.requestedHours,
      inclusiveDates: formData.inclusiveDates,
      minDate,
      leadTimeMsg,
    });

    setDateError(err);
  };

  const handleDateCommit = (e) => {
    clearBanner();
    const v = e.target.value;
    setDateValue(v);

    const err = validateDate({
      value: v,
      requestedHours: formData.requestedHours,
      inclusiveDates: formData.inclusiveDates,
      minDate,
      leadTimeMsg,
    });

    setDateError(err);
    if (!isFullISODate(v)) return;

    if (workingDaysLoading) {
      showBanner("info", "Working-days settings are still loading.");
      return;
    }
    if (err) return;

    const rh = Number(formData.requestedHours || 0);
    const reqDays = requiredDaysFromHours(rh);

    if (reqDays > 0 && formData.inclusiveDates.length >= reqDays) {
      setDateError(
        `You must select exactly ${reqDays} day(s) for ${rh} hours.`,
      );
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
        .typeError("Requested hours must be a valid number.")
        .required("Please enter requested hours.")
        .min(1, "Requested hours must be at least 1.")
        .max(
          Math.min(maxRequestedHours || 0, 300),
          `Requested hours exceed available balance or logical limit (${Math.min(maxRequestedHours || 0, 300)}).`,
        )
        .test(
          "memos-loaded",
          "Please wait while memos are loading.",
          () => !memoLoading,
        )
        .test(
          "working-days-loaded",
          "Please wait while working-days settings are loading.",
          () => !workingDaysLoading,
        ),
      reason: yup
        .string()
        .trim()
        .max(
          MAX_REASON_LEN,
          `Reason cannot exceed ${MAX_REASON_LEN} characters.`,
        ),
      routeId: yup.string().required("Please select an approval route."),
      inclusiveDates: yup
        .array()
        .of(yup.string())
        .test("required-days-match", function (dates) {
          const reqHours = this.parent.requestedHours;
          const reqDays = requiredDaysFromHours(reqHours);
          if (reqDays <= 0)
            return this.createError({
              message: "Please enter requested hours.",
            });
          if (!dates || dates.length !== reqDays) {
            return this.createError({
              message: `Please select exactly ${reqDays} date(s) for ${reqHours} hour(s).`,
            });
          }
          return true;
        })
        .test("lead-time", leadTimeMsg, (dates) => {
          if (!dates) return true;
          return !dates.some((d) => d < minDate);
        })
        .test(
          "no-weekends",
          "One or more selected dates are not working days (Mon–Fri).",
          (dates) => {
            if (!dates) return true;
            return !dates.some((d) => isWeekendISO(d));
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
    maxRequestedHours,
    memoLoading,
    workingDaysLoading,
    minDate,
    leadTimeMsg,
  ]);

  const startSubmit = async () => {
    clearBanner();

    if (successLatchRef.current) return;
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    if (mutation.isPending || successLatchUI) return;

    try {
      const rawPayload = {
        requestedHours: Number(formData.requestedHours || 0),
        reason: String(formData.reason || "").trim(),
        memos: (formData.memos || [])
          .map((m) => ({
            memoId: m.memoId,
            appliedHours: Number(m.appliedHours || 0),
          }))
          .filter((m) => m.memoId && m.appliedHours > 0),
        inclusiveDates: Array.from(
          new Set((formData.inclusiveDates || []).filter(Boolean)),
        ).sort(),
        routeId: formData.routeId,
      };

      const validatedPayload = await validationSchema.validate(rawPayload, {
        abortEarly: false,
      });

      validatedPayload.clientRequestId = makeClientRequestId();

      await mutation.mutateAsync(validatedPayload);

      successLatchRef.current = true;
      setSuccessLatchUI(true);

      toast.success("CTO application submitted successfully!");

      queryClient.invalidateQueries({ queryKey: ["ctoApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myCtoMemos"] });

      // ✅ Redirect back to list page upon success
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        showBanner("error", err.errors[0]);
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

  const maxDatesPossible = requiredDays;
  const progressPercentage =
    maxDatesPossible > 0
      ? (formData.inclusiveDates.length / maxDatesPossible) * 100
      : 0;

  const leadTimeLabel = useMemo(() => {
    if (workingDaysLoading) return "Min. Lead Time: Loading…";
    if (leadTimeDays <= 0) return "Min. Lead Time: 1 day";
    return `Min. Lead Time: ${leadTimeDays} Work Day${leadTimeDays === 1 ? "" : "s"}`;
  }, [leadTimeDays, workingDaysLoading]);

  const dateDisabled = !formData.requestedHours || isBusy || workingDaysLoading;

  return (
    <div
      className="w-full max-w-4xl transition-colors duration-300 ease-out pb-12"
      style={{ color: "var(--app-text)" }}
    >
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        {/* ✅ PAGE HEADER WITH BREADCRUMBS */}
        <div className="pt-2 pb-6 px-4 md:px-0">
          <Breadcrumbs rootLabel="home" rootTo="/app" />
          <h1
            className="text-2xl md:text-3xl font-bold tracking-tight font-sans mt-2"
            style={{ color: "var(--app-text)" }}
          >
            New CTO Application
          </h1>
          <p
            className="block text-sm mt-1 max-w-2xl"
            style={{ color: "var(--app-muted)" }}
          >
            File a new Compensatory Time-Off request and allocate your earned
            hours.
          </p>
        </div>

        {/* ✅ FORM CARD (Removed fixed heights) */}
        <div
          className="w-full rounded-xl overflow-hidden border shadow-sm transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
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
                <Clock className="w-6 h-6" />
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
              <p
                className="text-sm font-extrabold"
                style={{ color: "var(--accent)" }}
              >
                {maxRequestedHours || 0} hrs
              </p>
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
                      <Clock className="w-4 h-4" />
                    </div>
                    Requested Hours
                  </div>

                  <input
                    type="number"
                    name="requestedHours"
                    value={formData.requestedHours}
                    onChange={handleChange}
                    placeholder="1"
                    min={1}
                    max={300}
                    disabled={isBusy}
                    className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out"
                    style={{
                      backgroundColor: isBusy
                        ? "var(--app-surface-2)"
                        : "var(--app-surface)",
                      borderColor: borderColor,
                      color: isBusy ? "var(--app-muted)" : "var(--app-text)",
                    }}
                  />

                  {!!Number(formData.requestedHours || 0) &&
                  requiredDays > 0 ? (
                    <div
                      className="text-[10px] leading-relaxed"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Required dates for{" "}
                      <span
                        style={{ color: "var(--app-text)", fontWeight: 700 }}
                      >
                        {Number(formData.requestedHours || 0)}
                      </span>{" "}
                      hour(s):{" "}
                      <span
                        style={{ color: "var(--app-text)", fontWeight: 700 }}
                      >
                        {requiredDays}
                      </span>{" "}
                      day(s)
                    </div>
                  ) : null}
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
                    Inclusive Dates
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
                      <span
                        style={{ color: "var(--app-text)", fontWeight: 700 }}
                      >
                        {minDate}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {Number(formData.requestedHours) > 0 && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Dates Selected ({formData.inclusiveDates.length} /{" "}
                      {requiredDays})
                    </span>
                    <span
                      className="text-[10px] italic"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {leadTimeLabel}
                    </span>
                  </div>

                  <div
                    className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--app-border)" }}
                  >
                    <div
                      className="h-full transition-all duration-500 ease-out"
                      style={{
                        width: `${progressPercentage}%`,
                        backgroundColor: "var(--accent)",
                      }}
                    />
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
                        <AlertCircle
                          size={14}
                          style={{ color: "var(--app-muted)" }}
                        />{" "}
                        No dates selected yet
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

                  {requiredDays > 0 &&
                  formData.inclusiveDates.length > 0 &&
                  formData.inclusiveDates.length !== requiredDays ? (
                    <div
                      className="text-[11px] font-semibold"
                      style={{ color: "#ef4444" }}
                    >
                      Please select exactly {requiredDays} date(s) for{" "}
                      {Number(formData.requestedHours || 0)} hour(s).
                    </div>
                  ) : null}
                </div>
              )}

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
                  placeholder="Type your justification here..."
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

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
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
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    Credit Deductions
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setIsMemoModalOpen(true)}
                    className="text-xs font-bold disabled:opacity-50 shrink-0"
                    style={{ color: "var(--accent)" }}
                  >
                    View Memos
                  </button>
                </div>

                <div
                  className="rounded-lg overflow-hidden border transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
                  }}
                >
                  {memoLoading ? (
                    <div className="p-4">
                      <Skeleton height={30} count={2} />
                    </div>
                  ) : selectedMemos.length === 0 ? (
                    <div
                      className="p-6 sm:p-8 text-center"
                      style={{ backgroundColor: "var(--app-surface-2)" }}
                    >
                      <p
                        className="text-xs italic"
                        style={{ color: "var(--app-muted)" }}
                      >
                        No hours allocated yet
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[420px] w-full text-left text-sm">
                        <thead
                          className="border-b"
                          style={{
                            backgroundColor: "var(--app-surface-2)",
                            borderColor: borderColor,
                          }}
                        >
                          <tr>
                            <th
                              className="px-4 py-2 text-[10px] uppercase font-bold"
                              style={{ color: "var(--app-muted)" }}
                            >
                              Memo Reference
                            </th>
                            <th
                              className="px-4 py-2 text-[10px] uppercase font-bold text-right"
                              style={{ color: "var(--app-muted)" }}
                            >
                              Deduction
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMemos.map((memo) => (
                            <tr
                              key={memo.id}
                              className="transition-colors"
                              style={{
                                backgroundColor: "var(--app-surface)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "var(--app-surface-2)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "var(--app-surface)";
                              }}
                            >
                              <td
                                className="px-4 py-2.5 font-semibold"
                                style={{ color: "var(--app-text)" }}
                              >
                                {memo.memoNo}
                              </td>
                              <td
                                className="px-4 py-2.5 text-right font-extrabold"
                                style={{ color: "var(--accent)" }}
                              >
                                -{memo.appliedHours}h
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ CLEANED UP APPROVAL ROUTING (No collapse, no name, just steps) */}
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
                  ) : !formData.routeId ? (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-2">
                      <AlertCircle size={14} />
                      You haven't set up an approval route yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {routesResponse
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
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                  navigate(-1); // ✅ Navigate back on cancel
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
                disabled={isBusy || (workingDaysLoading && !workingDaysIsError)}
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
                {workingDaysLoading
                  ? "Loading..."
                  : mutation.isPending
                    ? "Submitting..."
                    : successLatchUI
                      ? "Submitted"
                      : "Submit Application"}
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
