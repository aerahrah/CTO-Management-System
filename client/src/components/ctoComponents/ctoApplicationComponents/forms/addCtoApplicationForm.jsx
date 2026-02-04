import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchApproverSettings,
  addApplicationRequest,
  fetchMyCtoMemos,
} from "../../../../api/cto";
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

const getMinSelectableDateISO = () => {
  const date = new Date();
  let count = 0;
  while (count < 5) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
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

const AddCtoApplicationForm = ({ onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const { admin } = useAuth();

  const [showRouting, setShowRouting] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [selectedMemos, setSelectedMemos] = useState([]);
  const [maxRequestedHours, setMaxRequestedHours] = useState(0);

  const dateInputRef = useRef(null);
  const minDate = useMemo(() => getMinSelectableDateISO(), []);

  /**
   * ✅ HARD SUCCESS LATCH
   * Once success happens, keep submit disabled until the component unmounts.
   * This prevents the "button re-enables before modal closes" double submit.
   */
  const successLatchRef = useRef(false); // survives renders
  const [successLatchUI, setSuccessLatchUI] = useState(false); // forces UI disabled

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

    // reset latches (ONLY when user closes without success, or on unmount)
    successLatchRef.current = false;
    setSuccessLatchUI(false);
    submitInFlightRef.current = false;
  }, [initialState]);

  // Optional: ensure we reset when component unmounts (modal removed)
  useEffect(() => {
    return () => {
      // reset refs only (state is gone anyway)
      successLatchRef.current = false;
      submitInFlightRef.current = false;
    };
  }, []);

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

  const handleDateAdd = (e) => {
    const value = e.target.value;
    if (!value) return;

    const requestedHours = Number(formData.requestedHours || 0);
    if (!requestedHours) {
      toast.warn("Please enter requested hours first.");
      e.target.value = "";
      return;
    }

    if (value < minDate) {
      toast.error(
        "Applications must be filed at least 5 working days in advance.",
      );
      e.target.value = "";
      return;
    }

    const maxSelectableDates = Math.ceil(requestedHours / 8);

    if (formData.inclusiveDates.includes(value)) {
      e.target.value = "";
      return;
    }

    if (formData.inclusiveDates.length >= maxSelectableDates) {
      toast.warn(
        `You can only select up to ${maxSelectableDates} day(s) for ${requestedHours} hours.`,
      );
      e.target.value = "";
      return;
    }

    setFormData((prev) => ({
      ...prev,
      inclusiveDates: [...prev.inclusiveDates, value],
    }));

    e.target.value = "";
  };

  const handleDateRemove = (date) => {
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: prev.inclusiveDates.filter((d) => d !== date),
    }));
  };

  const sanitizeAndValidatePayload = () => {
    const requestedHours = Number(formData.requestedHours || 0);

    if (!requestedHours || requestedHours <= 0) {
      toast.error("Please enter requested hours");
      return { ok: false };
    }

    if (requestedHours > (maxRequestedHours || 0)) {
      toast.error("Requested hours exceed your available balance");
      return { ok: false };
    }

    if (memoLoading) {
      toast.warn("Please wait while memos are loading.");
      return { ok: false };
    }

    const memos = (formData.memos || [])
      .map((m) => ({
        memoId: m.memoId,
        appliedHours: Number(m.appliedHours || 0),
      }))
      .filter((m) => m.memoId && m.appliedHours > 0);

    const memoSum = memos.reduce((sum, m) => sum + m.appliedHours, 0);
    if (!memos.length || memoSum < requestedHours) {
      toast.error("Insufficient memo credits to cover requested hours.");
      return { ok: false };
    }

    const inclusiveDates = Array.from(
      new Set((formData.inclusiveDates || []).filter(Boolean)),
    ).sort();

    if (inclusiveDates.length === 0) {
      toast.error("Please select inclusive dates");
      return { ok: false };
    }

    if (inclusiveDates.some((d) => d < minDate)) {
      toast.error(
        "One or more selected dates violate the 5 working days lead time rule.",
      );
      return { ok: false };
    }

    const maxSelectableDates = Math.ceil(requestedHours / 8);
    if (inclusiveDates.length > maxSelectableDates) {
      toast.error(
        `Too many dates selected for ${requestedHours} hours (max ${maxSelectableDates}).`,
      );
      return { ok: false };
    }

    if (!formData.approver1) {
      toast.error("Approver routing is not available. Please contact HR.");
      return { ok: false };
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
    // ✅ if success already happened, never allow another submit while mounted
    if (successLatchRef.current) return;

    // ✅ beat rapid double clicks before state updates
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    // also block if UI says busy
    if (isBusy) return;

    const { ok, payload } = sanitizeAndValidatePayload();
    if (!ok) {
      submitInFlightRef.current = false;
      return;
    }

    try {
      await mutation.mutateAsync(payload);

      // ✅ lock forever until unmount (prevents “re-enable before close”)
      successLatchRef.current = true;
      setSuccessLatchUI(true);

      toast.success("CTO application submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["ctoApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myCtoMemos"] });

      // ✅ DO NOT reset/unlock here — wait for modal to fully close/unmount
      onSuccess?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to submit");

      // allow retry on error
      submitInFlightRef.current = false;
      successLatchRef.current = false;
      setSuccessLatchUI(false);
    }
  };

  const maxDatesPossible =
    Math.ceil(Number(formData.requestedHours || 0) / 8) || 0;

  const progressPercentage =
    maxDatesPossible > 0
      ? (formData.inclusiveDates.length / maxDatesPossible) * 100
      : 0;

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              CTO Application
            </h2>
            <p className="text-xs text-gray-500">
              Compensatory Time-Off Request
            </p>
          </div>
        </div>
        <div className="text-right">
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
        className="flex flex-col h-[calc(100vh-16rem)]"
      >
        {/* Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-7">
          {/* Hours + Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
              />
            </div>

            <div className="space-y-2 relative">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-gray-600" />
                </div>
                Inclusive Dates
              </div>

              <div className="relative">
                <button
                  type="button"
                  disabled={!formData.requestedHours || isBusy}
                  onClick={() => {
                    if (dateInputRef.current?.showPicker)
                      dateInputRef.current.showPicker();
                    else {
                      dateInputRef.current?.focus();
                      dateInputRef.current?.click();
                    }
                  }}
                  className={`w-full h-10 px-3 border rounded-lg flex items-center justify-between transition ${
                    !formData.requestedHours || isBusy
                      ? "bg-gray-50 border-gray-200 cursor-not-allowed text-gray-400"
                      : "border-neutral-400 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-sm">
                    {!formData.requestedHours
                      ? "Enter hours first"
                      : "Select dates..."}
                  </span>
                  <Calendar className="w-4 h-4" />
                </button>

                <input
                  type="date"
                  ref={dateInputRef}
                  min={minDate}
                  onChange={handleDateAdd}
                  className="absolute inset-0 opacity-0 w-full"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>

          {/* Dates Progress */}
          {Number(formData.requestedHours) > 0 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Dates Selected ({formData.inclusiveDates.length} /{" "}
                  {maxDatesPossible})
                </span>
                <span className="text-[10px] text-gray-400 italic">
                  Min. Lead Time: 5 Work Days
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
                      {date}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDateRemove(date)}
                        className="text-blue-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
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
              rows="3"
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
            <div className="flex items-center justify-between">
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
                className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
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
                <div className="p-8 text-center bg-gray-50/50">
                  <p className="text-xs text-gray-400 italic">
                    No hours allocated yet
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
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
                showRouting ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
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
                      <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">
                          {app
                            ? `${app.firstName} ${app.lastName}`
                            : "Not Assigned"}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-tight">
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

        {/* Fixed Footer */}
        <div className="border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              if (mutation.isPending) return;

              // ✅ Only reset if NOT already successfully submitted
              // (prevents unlock during closing animation)
              if (!successLatchRef.current) resetForm();

              onClose?.();
            }}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-sm font-bold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>

          <button
            type="submit"
            disabled={isBusy}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {mutation.isPending
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
