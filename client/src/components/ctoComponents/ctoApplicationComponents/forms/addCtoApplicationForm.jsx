import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchApproverSettings,
  addApplicationRequest,
  fetchMyCtoMemos,
} from "../../../../api/cto";
import { fetchWorkingDaysGeneralSettings } from "../../../../api/generalSettings";
import { useAuth } from "../../../../store/authStore";
import {
  Clock,
  Calendar,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import SelectCtoMemoModal from "./selectCtoMemoModal";
import { toast } from "react-toastify";

const MAX_REASON_LEN = 500;

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

/**
 * Lead-time rule:
 * "At least N working days in advance" means there must be N working days
 * between today (exclusive) and the selected date (exclusive).
 */
const getMinSelectableDateISO = (leadTimeDays = 5) => {
  const lead = Number(leadTimeDays);
  const date = new Date();

  // If disabled/invalid => earliest is tomorrow
  if (!Number.isFinite(lead) || lead <= 0) {
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  }

  // Count working days that must pass BEFORE the selected date
  let count = 0;
  while (count < lead) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
  }

  // Earliest selectable is the NEXT day after those working days have passed
  date.setDate(date.getDate() + 1);

  // Ensure min date is not weekend
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

// ✅ validation that supports "typing" (inline errors) + "commit" (no toast spam)
const validateDate = ({
  value,
  requestedHours,
  inclusiveDates,
  minDate,
  leadTimeMsg,
}) => {
  if (!value) return "";

  // while typing partial values, don't error-spam
  if (!isFullISODate(value)) return "";

  const rh = Number(requestedHours || 0);
  if (!rh || rh <= 0) return "Please enter requested hours first.";

  if (value < minDate) return leadTimeMsg;

  if (isWeekendISO(value)) return "Please select a working day (Mon–Fri).";

  if (inclusiveDates.includes(value)) return "That date is already selected.";

  // ✅ REQUIRED DAYS RULE: required dates = ceil(hours/8)
  const requiredDays = requiredDaysFromHours(rh);

  // If user already selected the required number of dates, stop adding more
  if (requiredDays > 0 && inclusiveDates.length >= requiredDays) {
    return `You must select exactly ${requiredDays} day(s) for ${rh} hours.`;
  }

  return "";
};

const Banner = ({ tone = "error", message }) => {
  if (!message) return null;

  const styles =
    tone === "info"
      ? "border-blue-100 bg-blue-50 text-blue-800"
      : tone === "success"
        ? "border-emerald-100 bg-emerald-50 text-emerald-800"
        : "border-rose-100 bg-rose-50 text-rose-800";

  return (
    <div
      className={[
        "rounded-xl border px-3 py-2 text-xs font-medium flex items-start gap-2",
        styles,
      ].join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
      <div className="leading-relaxed">{message}</div>
    </div>
  );
};

const AddCtoApplicationForm = ({ onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const { admin } = useAuth();

  const [showRouting, setShowRouting] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [selectedMemos, setSelectedMemos] = useState([]);
  const [maxRequestedHours, setMaxRequestedHours] = useState(0);

  const dateInputRef = useRef(null);

  // ✅ date input UX: show errors while typing (inline), no toast per error
  const [dateValue, setDateValue] = useState("");
  const [dateError, setDateError] = useState("");

  // ✅ single banner for form-level errors/notices (instead of toasts)
  const [banner, setBanner] = useState({ tone: "error", message: "" });
  const clearBanner = () => setBanner({ tone: "error", message: "" });
  const showBanner = (tone, message) => setBanner({ tone, message });

  /**
   * ✅ HARD SUCCESS LATCH
   * Once success happens, keep submit disabled until the component unmounts.
   */
  const successLatchRef = useRef(false);
  const [successLatchUI, setSuccessLatchUI] = useState(false);

  // For ultra-fast double clicks BEFORE react rerender:
  const submitInFlightRef = useRef(false);

  const initialState = useMemo(
    () => ({
      requestedHours: "",
      reason: "",
      memos: [],
      inclusiveDates: [],
      approver1: "",
      approver2: "",
      approver3: "",
    }),
    [],
  );

  const [formData, setFormData] = useState(initialState);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setSelectedMemos([]);
    setShowRouting(false);
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

  // ✅ Working Days Settings (Lead time source)
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

    // using workingDaysValue as lead time days
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

  const { data: approverResponse, isLoading: isApproverLoading } = useQuery({
    queryKey: ["approverSettings", admin?.designation],
    queryFn: () => fetchApproverSettings(admin.designation),
    enabled: !!admin?.designation,
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
    if (approverResponse?.data) {
      const a = approverResponse.data;
      setFormData((prev) => ({
        ...prev,
        approver1: a.level1Approver?._id || "",
        approver2: a.level2Approver?._id || "",
        approver3: a.level3Approver?._id || "",
      }));
    }
  }, [approverResponse]);

  const leadTimeMsg = useMemo(() => {
    if (leadTimeDays <= 0)
      return "Applications must be filed at least 1 day in advance.";
    return `Applications must be filed at least ${leadTimeDays} working day(s) in advance.`;
  }, [leadTimeDays]);

  const requiredDays = useMemo(
    () => requiredDaysFromHours(formData.requestedHours),
    [formData.requestedHours],
  );

  // If min date changes (settings load), drop any dates that become invalid
  useEffect(() => {
    if (!formData.inclusiveDates?.length) return;
    const filtered = formData.inclusiveDates.filter((d) => d >= minDate);
    if (filtered.length !== formData.inclusiveDates.length) {
      setFormData((prev) => ({ ...prev, inclusiveDates: filtered }));
      showBanner("info", "Some selected dates were removed (lead-time rule).");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate]);

  // ✅ If requiredDays decreases (hours changed), trim extra selected dates
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

  // Re-validate currently typed date when rules change
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
      const cap = maxRequestedHours || 0;
      const requested = clampNumber(value, 0, cap);

      if (memoLoading) {
        setFormData((prev) => ({
          ...prev,
          requestedHours: requested === 0 ? "" : String(requested),
          inclusiveDates: [],
          memos: [],
        }));
        setSelectedMemos([]);
        setDateValue("");
        setDateError("");
        return;
      }

      const { newSelected, newFormMemos } = allocateMemosForHours(requested);
      setSelectedMemos(newSelected);
      setFormData((prev) => ({
        ...prev,
        requestedHours: requested === 0 ? "" : String(requested),
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

  // ✅ while typing (or selecting) update value + show inline error immediately
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

  // ✅ on commit add date only if valid AND does not exceed requiredDays
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

    // don't commit until it's a complete date
    if (!isFullISODate(v)) return;

    if (workingDaysLoading) {
      showBanner("info", "Working-days settings are still loading.");
      return;
    }

    if (err) return;

    const rh = Number(formData.requestedHours || 0);
    const reqDays = requiredDaysFromHours(rh);

    // ✅ hard guard (even if validateDate already caught it)
    if (reqDays > 0 && formData.inclusiveDates.length >= reqDays) {
      setDateError(
        `You must select exactly ${reqDays} day(s) for ${rh} hours.`,
      );
      return;
    }

    // ✅ add
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: [...prev.inclusiveDates, v],
    }));

    // ✅ clear for next pick
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

  const sanitizeAndValidatePayload = () => {
    const requestedHours = Number(formData.requestedHours || 0);

    if (!requestedHours || requestedHours <= 0) {
      return { ok: false, message: "Please enter requested hours." };
    }

    if (requestedHours > (maxRequestedHours || 0)) {
      return {
        ok: false,
        message: "Requested hours exceed your available balance.",
      };
    }

    if (memoLoading) {
      return { ok: false, message: "Please wait while memos are loading." };
    }

    if (workingDaysLoading) {
      return {
        ok: false,
        message: "Please wait while working-days settings are loading.",
      };
    }

    const memos = (formData.memos || [])
      .map((m) => ({
        memoId: m.memoId,
        appliedHours: Number(m.appliedHours || 0),
      }))
      .filter((m) => m.memoId && m.appliedHours > 0);

    const memoSum = memos.reduce((sum, m) => sum + m.appliedHours, 0);
    if (!memos.length || memoSum < requestedHours) {
      return {
        ok: false,
        message: "Insufficient memo credits to cover requested hours.",
      };
    }

    const inclusiveDates = Array.from(
      new Set((formData.inclusiveDates || []).filter(Boolean)),
    ).sort();

    // ✅ REQUIRED DAYS RULE (FIX):
    // must select EXACTLY ceil(requestedHours/8) days
    const reqDays = requiredDaysFromHours(requestedHours);

    if (reqDays <= 0) {
      return { ok: false, message: "Please enter requested hours." };
    }

    if (inclusiveDates.length !== reqDays) {
      return {
        ok: false,
        message: `Please select exactly ${reqDays} date(s) for ${requestedHours} hour(s).`,
      };
    }

    if (inclusiveDates.some((d) => d < minDate)) {
      return { ok: false, message: leadTimeMsg };
    }

    if (inclusiveDates.some((d) => isWeekendISO(d))) {
      return {
        ok: false,
        message: "One or more selected dates are not working days (Mon–Fri).",
      };
    }

    if (!formData.approver1) {
      return {
        ok: false,
        message: "Approver routing is not available. Please contact HR.",
      };
    }

    const reason = String(formData.reason || "")
      .trim()
      .slice(0, MAX_REASON_LEN);

    return {
      ok: true,
      payload: {
        clientRequestId: makeClientRequestId(),
        requestedHours,
        reason,
        memos,
        inclusiveDates,
        approver1: formData.approver1 || "",
        approver2: formData.approver2 || "",
        approver3: formData.approver3 || "",
      },
    };
  };

  const startSubmit = async () => {
    clearBanner();

    if (successLatchRef.current) return;
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    if (isBusy) return;

    const result = sanitizeAndValidatePayload();
    if (!result.ok) {
      showBanner("error", result.message || "Please review the form.");
      submitInFlightRef.current = false;
      return;
    }

    try {
      await mutation.mutateAsync(result.payload);

      successLatchRef.current = true;
      setSuccessLatchUI(true);

      toast.success("CTO application submitted successfully!");

      queryClient.invalidateQueries({ queryKey: ["ctoApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myCtoMemos"] });

      onSuccess?.();
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to submit";
      showBanner("error", msg);
      toast.error(msg);

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
    <div className="w-full max-w-xl mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              CTO Application
            </h2>
            <p className="text-xs text-gray-500 truncate">
              Compensatory Time-Off Request
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            Available
          </p>
          <p className="text-sm font-bold text-blue-600">
            {maxRequestedHours || 0} hrs
          </p>
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
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {/* Banner */}
          <Banner tone={banner.tone} message={banner.message} />

          {/* Hours + Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                Requested Hours
              </div>
              <input
                type="number"
                name="requestedHours"
                value={formData.requestedHours}
                onChange={handleChange}
                placeholder="0"
                min={0}
                disabled={isBusy}
                className="w-full h-11 sm:h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
              />
              {!!Number(formData.requestedHours || 0) && requiredDays > 0 ? (
                <div className="text-[10px] text-gray-400 leading-relaxed">
                  Required dates for{" "}
                  <span className="font-semibold text-gray-600">
                    {Number(formData.requestedHours || 0)}
                  </span>{" "}
                  hour(s):{" "}
                  <span className="font-semibold text-gray-600">
                    {requiredDays}
                  </span>{" "}
                  day(s)
                </div>
              ) : null}
            </div>

            {/* Date picker - inline error while typing */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-gray-600" />
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
                  className={[
                    "w-full h-11 sm:h-10 px-3 border rounded-lg outline-none transition",
                    "text-[16px] sm:text-sm",
                    dateDisabled
                      ? "bg-gray-50 border-gray-200 cursor-not-allowed text-gray-400"
                      : dateError
                        ? "border-rose-300 bg-rose-50/40 focus:ring-1 focus:ring-rose-300 focus:border-rose-400"
                        : "border-neutral-400 text-gray-700 hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500",
                  ].join(" ")}
                />
              </div>

              {dateError ? (
                <div className="text-[11px] text-rose-700 font-medium">
                  {dateError}
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 leading-relaxed">
                  Earliest selectable date:{" "}
                  <span className="font-semibold text-gray-500">{minDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dates Progress */}
          {Number(formData.requestedHours) > 0 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Dates Selected ({formData.inclusiveDates.length} /{" "}
                  {requiredDays})
                </span>
                <span className="text-[10px] text-gray-400 italic">
                  {leadTimeLabel}
                </span>
              </div>

              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-2 p-3 bg-blue-50/30 rounded-xl border border-blue-50/50 min-h-[50px]">
                {formData.inclusiveDates.length === 0 ? (
                  <p className="text-xs text-blue-400/70 italic flex items-center gap-2">
                    <AlertCircle size={14} /> No dates selected yet
                  </p>
                ) : (
                  formData.inclusiveDates.map((date) => (
                    <div
                      key={date}
                      className="flex items-center gap-2 px-2.5 py-1 bg-white border border-blue-100 rounded-lg text-xs font-semibold text-blue-700 shadow-sm"
                    >
                      <span className="truncate max-w-[150px]">{date}</span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDateRemove(date)}
                        className="text-blue-300 hover:text-red-500 transition-colors disabled:opacity-50"
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
                <div className="text-[11px] text-rose-700 font-medium">
                  Please select exactly {requiredDays} date(s) for{" "}
                  {Number(formData.requestedHours || 0)} hour(s).
                </div>
              ) : null}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-600" />
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
              className="w-full p-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm disabled:bg-gray-50"
            />
            <div className="text-[10px] text-gray-400 text-right">
              {String(formData.reason || "").length}/{MAX_REASON_LEN}
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-gray-600" />
                </div>
                Credit Deductions
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setIsMemoModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50 shrink-0"
              >
                View Memos
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              {memoLoading ? (
                <div className="p-4">
                  <Skeleton height={30} count={2} />
                </div>
              ) : selectedMemos.length === 0 ? (
                <div className="p-6 sm:p-8 text-center bg-gray-50/50">
                  <p className="text-xs text-gray-400 italic">
                    No hours allocated yet
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[420px] w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-gray-500 text-[10px] uppercase">
                          Memo Reference
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-500 text-[10px] uppercase text-right">
                          Deduction
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedMemos.map((memo) => (
                        <tr
                          key={memo.id}
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-medium text-gray-700">
                            {memo.memoNo}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-blue-600">
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

          {/* Approval Routing */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowRouting((s) => !s)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition disabled:opacity-60"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <UserCheck size={16} className="text-gray-500" />
                Approval Routing
              </div>
              {showRouting ? (
                <ChevronUp size={16} className="text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                showRouting ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="space-y-2 pt-1">
                {isApproverLoading ? (
                  <Skeleton height={50} count={3} borderRadius={8} />
                ) : (
                  [
                    approverResponse?.data?.level1Approver,
                    approverResponse?.data?.level2Approver,
                    approverResponse?.data?.level3Approver,
                  ].map((app, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg shadow-sm"
                    >
                      <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {app
                            ? `${app.firstName} ${app.lastName}`
                            : "Not Assigned"}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-tight truncate">
                          {app?.position || "Position not specified"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="border-t border-gray-100 bg-white px-4 py-3 flex flex-row items-stretch sm:items-center gap-2 sm:gap-3 sticky bottom-0">
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              if (mutation.isPending) return;
              if (!successLatchRef.current) resetForm();
              onClose?.();
            }}
            className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 rounded border border-gray-200 bg-neutral-100 hover:bg-neutral-200/70 cursor-pointer font-semibold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>

          <button
            type="submit"
            disabled={isBusy || workingDaysLoading}
            className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {workingDaysLoading
              ? "Loading..."
              : mutation.isPending
                ? "Submitting..."
                : successLatchUI
                  ? "Submitted"
                  : "Submit"}
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
  );
};

export default AddCtoApplicationForm;
