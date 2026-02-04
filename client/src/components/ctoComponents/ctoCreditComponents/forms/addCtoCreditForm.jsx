import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Upload, Users, Clock, FileText, Calendar } from "lucide-react";
import Select from "react-select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApprovers, addCreditRequest } from "../../../../api/cto";
import { toast } from "react-toastify";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const todayISO = () => new Date().toISOString().split("T")[0];

const isLikelyObjectId = (v) =>
  typeof v === "string" && /^[a-fA-F0-9]{24}$/.test(v);

const clampInt = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
};

// best effort UUID / idempotency key
const makeClientRequestId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {}
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const AddCtoCreditForm = ({ onClose, onPendingChange }) => {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ Rapid-click guard (beats React render timing)
  const submitInFlightRef = useRef(false);

  // ✅ Success latch: once success happens, keep disabled until unmount
  const successLatchRef = useRef(false);
  const [successLatchUI, setSuccessLatchUI] = useState(false);

  // UI lock for instant disabling on click (and keeps busy true)
  const [submitLockUI, setSubmitLockUI] = useState(false);

  const initialState = useMemo(
    () => ({
      employees: [],
      duration: { hours: "", minutes: "" },
      memoNo: "",
      memoFile: null,
      dateApproved: "",
    }),
    [],
  );

  const [formData, setFormData] = useState(initialState);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setMenuOpen(false);

    // unlock only when user closes without success OR on unmount
    submitInFlightRef.current = false;
    successLatchRef.current = false;
    setSuccessLatchUI(false);
    setSubmitLockUI(false);
  }, [initialState]);

  // Reset refs on unmount (modal fully removed)
  useEffect(() => {
    return () => {
      submitInFlightRef.current = false;
      successLatchRef.current = false;
    };
  }, []);

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: fetchApprovers,
    staleTime: Infinity,
    enabled: menuOpen,
  });

  const mutation = useMutation({
    mutationFn: addCreditRequest,
    retry: 0,
  });

  // ✅ Busy stays true after success (prevents “click again before close”)
  const busy = mutation.isPending || submitLockUI || successLatchUI;

  // Tell parent modal whether we’re “busy”
  useEffect(() => {
    onPendingChange?.(busy);
  }, [busy, onPendingChange]);

  const employeeOptions = useMemo(
    () =>
      employeesData?.data?.map((emp) => ({
        value: emp._id,
        label: `${emp.firstName} ${emp.lastName}`.trim(),
      })) || [],
    [employeesData],
  );

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (busy) return; // optional hard block while busy

    if (name === "hours") {
      const hours = clampInt(value, 0, 1000);
      setFormData((prev) => ({
        ...prev,
        duration: { ...prev.duration, hours: String(hours) },
      }));
      return;
    }

    if (name === "minutes") {
      const minutes = clampInt(value, 0, 59);
      setFormData((prev) => ({
        ...prev,
        duration: { ...prev.duration, minutes: String(minutes) },
      }));
      return;
    }

    if (name === "memoFile") {
      const file = files?.[0] || null;
      setFormData((prev) => ({ ...prev, memoFile: file }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const sanitizeAndValidate = () => {
    const employees = Array.from(new Set(formData.employees || [])).filter(
      isLikelyObjectId,
    );

    if (employees.length === 0) {
      toast.error("Please select at least one employee.");
      return { ok: false };
    }

    const hours = clampInt(formData.duration.hours, 0, 1000);
    const minutes = clampInt(formData.duration.minutes, 0, 59);
    if (hours === 0 && minutes === 0) {
      toast.error("Please enter a credit duration (hours or minutes).");
      return { ok: false };
    }

    const dateApproved = String(formData.dateApproved || "").trim();
    if (!dateApproved) {
      toast.error("Please select the date approved.");
      return { ok: false };
    }
    if (dateApproved > todayISO()) {
      toast.error("Date approved cannot be in the future.");
      return { ok: false };
    }

    const memoNo = String(formData.memoNo || "")
      .trim()
      .slice(0, 100);

    if (!memoNo) {
      toast.error("Please enter the memo number.");
      return { ok: false };
    }

    const memoFile = formData.memoFile;
    if (!memoFile) {
      toast.error("Please upload the memo PDF.");
      return { ok: false };
    }

    const fileName = String(memoFile.name || "");
    const isPdfByExt = fileName.toLowerCase().endsWith(".pdf");
    const isPdfByType =
      String(memoFile.type || "").toLowerCase() === "application/pdf";

    if (!isPdfByExt && !isPdfByType) {
      toast.error("Memo file must be a PDF.");
      return { ok: false };
    }

    if (memoFile.size && memoFile.size > MAX_PDF_SIZE_BYTES) {
      toast.error("PDF is too large. Please upload a smaller file.");
      return { ok: false };
    }

    const payload = new FormData();
    payload.append("memoFile", memoFile);
    payload.append("memoNo", memoNo);
    payload.append("dateApproved", dateApproved);
    payload.append("employees", JSON.stringify(employees));
    payload.append("duration", JSON.stringify({ hours, minutes }));

    // ✅ optional idempotency key (server can dedupe if supported)
    payload.append("clientRequestId", makeClientRequestId());

    return { ok: true, payload };
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    // ✅ hard success latch
    if (successLatchRef.current) return;

    // ✅ rapid-click lock (beats rerender)
    if (submitInFlightRef.current) return;

    // ✅ if already busy, block
    if (busy) return;

    submitInFlightRef.current = true;
    setSubmitLockUI(true); // instant disable

    const { ok, payload } = sanitizeAndValidate();
    if (!ok) {
      // unlock on validation fail
      submitInFlightRef.current = false;
      setSubmitLockUI(false);
      return;
    }

    try {
      await mutation.mutateAsync(payload);

      // ✅ LATCH AFTER SUCCESS (do NOT unlock until unmount)
      successLatchRef.current = true;
      setSuccessLatchUI(true);

      toast.success("CTO credit added successfully");
      queryClient.invalidateQueries({ queryKey: ["ctoCredits"] });
      queryClient.invalidateQueries({ queryKey: ["allCredits"] });

      // ✅ do NOT reset here (avoid unlocking before modal fully closes)
      onClose?.();
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to submit credit request",
      );

      // allow retry on error
      submitInFlightRef.current = false;
      successLatchRef.current = false;
      setSuccessLatchUI(false);
      setSubmitLockUI(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Clock className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Add CTO Credit
          </h2>
          <p className="text-xs text-gray-500">
            Assign Compensatory Time Credits
          </p>
        </div>
      </div>

      {/* Form wrapper: scrollable content + sticky footer */}
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Scrollable content */}
        <div className="px-4 py-5 space-y-7 max-h-[calc(100vh-22rem)] overflow-y-auto">
          {/* Employees */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-gray-600" />
              </div>
              Employees
            </div>

            <Select
              options={employeeOptions}
              isMulti
              isLoading={isLoading}
              isDisabled={busy}
              value={employeeOptions.filter((o) =>
                (formData.employees || []).includes(o.value),
              )}
              onChange={(selected) =>
                setFormData((p) => ({
                  ...p,
                  employees: selected ? selected.map((s) => s.value) : [],
                }))
              }
              onMenuOpen={() => setMenuOpen(true)}
              placeholder="Search employees"
              classNames={{
                control: ({ isFocused }) =>
                  `min-h-[42px] rounded-lg border ${
                    isFocused
                      ? "border-blue-500 ring-1 ring-blue-200"
                      : "border-gray-300"
                  } ${busy ? "opacity-70" : ""}`,
                option: ({ isFocused, isSelected }) =>
                  `${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : isFocused
                        ? "bg-gray-100"
                        : "bg-white"
                  } px-3 py-2 cursor-pointer`,
                multiValue: () =>
                  "bg-blue-100 text-blue-900 rounded-md px-2 py-1",
              }}
            />
          </div>

          {/* Duration & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                Credit Duration
              </div>

              <div className="flex gap-3">
                <input
                  type="number"
                  name="hours"
                  placeholder="Hours"
                  min="0"
                  value={formData.duration.hours}
                  onChange={handleChange}
                  disabled={busy}
                  className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
                />
                <input
                  type="number"
                  name="minutes"
                  placeholder="Minutes"
                  min="0"
                  max="59"
                  value={formData.duration.minutes}
                  onChange={handleChange}
                  disabled={busy}
                  className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-gray-600" />
                </div>
                Date Approved
              </div>

              <input
                type="date"
                name="dateApproved"
                value={formData.dateApproved}
                onChange={handleChange}
                max={todayISO()}
                disabled={busy}
                className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Memo */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-gray-600" />
                </div>
                Memo Number
              </div>

              <input
                type="text"
                name="memoNo"
                value={formData.memoNo}
                onChange={handleChange}
                placeholder="Enter memo number"
                maxLength={100}
                disabled={busy}
                className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
              />
            </div>

            {/* Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Memo (PDF)
              </label>

              <label
                className={`flex items-center gap-3 px-4 py-3 border border-neutral-600 border-dashed rounded-lg bg-gray-50 transition ${
                  busy
                    ? "opacity-70 cursor-not-allowed"
                    : "hover:bg-gray-100 cursor-pointer"
                }`}
              >
                <Upload className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-700 truncate">
                  {formData.memoFile
                    ? formData.memoFile.name
                    : "Choose PDF file"}
                </span>

                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  name="memoFile"
                  onChange={handleChange}
                  disabled={busy}
                  className="hidden"
                />
              </label>

              {formData.memoFile && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setFormData((p) => ({ ...p, memoFile: null }))}
                  className={`mt-2 text-xs text-red-600 hover:underline ${
                    busy ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Remove file
                </button>
              )}

              <div className="mt-2 text-[10px] text-gray-400">
                Max file size: {Math.round(MAX_PDF_SIZE_BYTES / (1024 * 1024))}
                MB
              </div>
            </div>
          </div>

          <div className="h-4" />
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white/95 backdrop-blur px-4 py-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                // ✅ Only reset if NOT success-latched (avoid unlock before close)
                if (!successLatchRef.current && !mutation.isPending)
                  resetForm();
                onClose?.();
              }}
              disabled={busy}
              className={`w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 font-semibold ${
                busy ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Close
            </button>

            <button
              type="submit"
              disabled={busy}
              className={`w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 ${
                busy ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {mutation.isPending
                ? "Saving..."
                : successLatchUI
                  ? "Saved"
                  : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddCtoCreditForm;
