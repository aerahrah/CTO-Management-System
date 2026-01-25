import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
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

const AddCtoApplicationForm = forwardRef(({ onClose }, ref) => {
  const queryClient = useQueryClient();
  const { admin } = useAuth();
  const [showRouting, setShowRouting] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [selectedMemos, setSelectedMemos] = useState([]);
  const [maxRequestedHours, setMaxRequestedHours] = useState(null);
  const dateInputRef = useRef(null);

  const [formData, setFormData] = useState({
    requestedHours: "",
    reason: "",
    memos: [],
    inclusiveDates: [],
    approver1: "",
    approver2: "",
    approver3: "",
  });
  console.log(admin);

  // --- Helper: Get date after 5 working days ---
  const getMinSelectableDate = () => {
    let date = new Date();
    let count = 0;
    while (count < 5) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) {
        // Skip Sunday (0) and Saturday (6)
        count++;
      }
    }
    return date.toISOString().split("T")[0];
  };

  const minDate = getMinSelectableDate();

  // ---------------- Queries & Mutations ----------------
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
    onSuccess: () => {
      toast.success("CTO application submitted successfully!");
      queryClient.invalidateQueries(["ctoApplications"]);
      onClose?.();
    },
    onError: (err) =>
      toast.error(err.response?.data?.error || "Failed to submit"),
  });

  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(),
  }));

  // ---------------- Handlers ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "requestedHours") {
      let val = Number(value);
      if (isNaN(val) || val < 0) val = 0;
      if (maxRequestedHours !== null && val > maxRequestedHours)
        val = maxRequestedHours;

      setFormData((prev) => ({
        ...prev,
        requestedHours: val,
        inclusiveDates: [],
      }));

      let remaining = val;
      const newSelectedMemos = [];
      const newFormMemos = [];
      for (let memo of memoResponse?.memos || []) {
        if (remaining <= 0) break;
        const availableHours = memo.remainingHours || 0;
        if (availableHours <= 0) continue;
        const applied = Math.min(availableHours, remaining);
        remaining -= applied;
        newSelectedMemos.push({ ...memo, appliedHours: applied });
        newFormMemos.push({ memoId: memo.id, appliedHours: applied });
      }
      setSelectedMemos(newSelectedMemos);
      setFormData((prev) => ({ ...prev, memos: newFormMemos }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateAdd = (e) => {
    const value = e.target.value;
    if (!value) return;

    // Rule 1: Hours must be entered
    if (!formData.requestedHours || formData.requestedHours <= 0) {
      toast.warn("Please enter requested hours first.");
      e.target.value = "";
      return;
    }

    // Rule 2: 5 Working Days Lead Time
    if (value < minDate) {
      toast.error(
        "Applications must be filed at least 5 working days in advance.",
      );
      e.target.value = "";
      return;
    }

    const maxSelectableDates = Math.ceil(Number(formData.requestedHours) / 8);

    if (formData.inclusiveDates.includes(value)) {
      e.target.value = "";
      return;
    }

    if (formData.inclusiveDates.length >= maxSelectableDates) {
      toast.warn(
        `You can only select up to ${maxSelectableDates} days for ${formData.requestedHours} hours.`,
      );
      e.target.value = "";
      return;
    }

    setFormData((prev) => ({
      ...prev,
      inclusiveDates: [...prev.inclusiveDates, value],
    }));
    e.target.value = ""; // Reset to allow re-selecting same date if removed
  };

  const handleDateRemove = (date) => {
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: prev.inclusiveDates.filter((d) => d !== date),
    }));
  };

  const handleSubmit = () => {
    if (!formData.requestedHours || formData.requestedHours <= 0) {
      toast.error("Please enter requested hours");
      return;
    }
    if (formData.inclusiveDates.length === 0) {
      toast.error("Please select inclusive dates");
      return;
    }
    mutation.mutate(formData);
  };

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

  useEffect(() => {
    if (memoResponse?.memos) {
      const totalRemaining = memoResponse.memos.reduce(
        (sum, m) => sum + (m.remainingHours || 0),
        0,
      );
      setMaxRequestedHours(totalRemaining);
    }
  }, [memoResponse]);

  const maxDatesPossible = Math.ceil(Number(formData.requestedHours) / 8);
  const progressPercentage =
    maxDatesPossible > 0
      ? (formData.inclusiveDates.length / maxDatesPossible) * 100
      : 0;

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl border border-gray-200">
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

      <div className="px-4 py-5 space-y-7 h-[calc(100vh-16rem)] overflow-y-auto">
        {/* Step 1 & 2: Hours and Dates */}
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
              className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="space-y-2 relative">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-gray-600" />
              </div>
              Inclusive Dates
            </div>

            {/* Improved Wrapper for Positioning */}
            <div className="relative">
              <button
                type="button"
                disabled={!formData.requestedHours}
                onClick={() => dateInputRef.current?.showPicker?.()}
                className={`w-full h-10 px-3 border rounded-lg flex items-center justify-between transition ${
                  !formData.requestedHours
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

              {/* Hidden but correctly anchored input */}
              <input
                type="date"
                ref={dateInputRef}
                min={minDate}
                onChange={handleDateAdd}
                className="absolute inset-0 opacity-0 pointer-events-none w-full"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Dates Progress Section */}
        {formData.requestedHours > 0 && (
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

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* Date Tags */}
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
                      onClick={() => handleDateRemove(date)}
                      className="text-blue-300 hover:text-red-500 transition-colors"
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
            placeholder="Type your justification here..."
            className="w-full p-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm"
          />
        </div>

        {/* Deductions Table */}
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
              onClick={() => setIsMemoModalOpen(true)}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              View Ledgers
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
                      key={memo.memoId}
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
            onClick={() => setShowRouting(!showRouting)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
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
});

export default AddCtoApplicationForm;
