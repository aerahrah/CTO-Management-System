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
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
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
    memos: [], // will be sent to backend
    inclusiveDates: [],
    approver1: "",
    approver2: "",
    approver3: "",
  });

  // ---------------- Fetch Approvers ----------------
  const {
    data: approverResponse,
    isLoading: isApproverLoading,
    isError: isApproverError,
  } = useQuery({
    queryKey: ["approverSettings", admin?.provincialOffice],
    queryFn: () => fetchApproverSettings(admin.provincialOffice),
    enabled: !!admin?.provincialOffice,
  });

  // ---------------- Fetch CTO Memos ----------------
  const { data: memoResponse, isLoading: memoLoading } = useQuery({
    queryKey: ["myCtoMemos"],
    queryFn: fetchMyCtoMemos,
  });

  // ---------------- Submit Mutation ----------------
  const mutation = useMutation({
    mutationFn: addApplicationRequest,
    onSuccess: () => {
      toast.success("CTO application submitted successfully!");
      queryClient.invalidateQueries(["ctoApplications"]);
      setFormData((prev) => ({
        requestedHours: "",
        reason: "",
        memos: [],
        inclusiveDates: [],
        approver1: prev.approver1,
        approver2: prev.approver2,
        approver3: prev.approver3,
      }));
      setSelectedMemos([]);
      setMaxRequestedHours(null);
      onClose?.();
    },
    onError: (err) => {
      console.error(err);
      toast.error(
        err.response?.data?.error || "Failed to submit CTO application"
      );
    },
  });

  // ---------------- Expose submit ----------------
  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(),
  }));

  // ---------------- Handlers ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "requestedHours") {
      const val = Number(value);
      if (isNaN(val) || val <= 0) {
        setFormData((prev) => ({ ...prev, requestedHours: "" }));
        return;
      }

      // Compute applied memos based on remaining hours
      let remaining = val;
      const newSelectedMemos = [];
      const newFormMemos = [];

      for (let memo of memoResponse?.memos || []) {
        if (remaining <= 0) break;

        const availableHours =
          (memo.remainingHours || 0) - (memo.reservedHours || 0);
        if (availableHours <= 0) continue;

        const applied = Math.min(availableHours, remaining);
        remaining -= applied;

        newSelectedMemos.push({
          memoId: memo.id,
          uploadedMemo: memo.uploadedMemo,
          memoNo: memo.memoNo,
          creditedHours: memo.creditedHours,
          usedHours: memo.usedHours,
          reservedHours: memo.reservedHours || 0,
          appliedHours: applied,
          totalHours: memo.totalHours,
          remainingHours: memo.remainingHours,
        });

        newFormMemos.push({
          memoId: memo.id,
          appliedHours: applied,
        });
      }

      setSelectedMemos(newSelectedMemos);
      setFormData((prev) => ({
        ...prev,
        requestedHours: val - remaining,
        memos: newFormMemos,
        inclusiveDates: [], // reset inclusive dates when hours change
      }));

      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateAdd = (e) => {
    const value = e.target.value;
    if (!value) return;

    setFormData((prev) => {
      const maxSelectableDates = Math.ceil(Number(prev.requestedHours) / 8);
      if (!prev.requestedHours) {
        toast.warn("Enter requested hours first.");
        return prev;
      }

      if (prev.inclusiveDates.includes(value)) return prev;

      if (prev.inclusiveDates.length >= maxSelectableDates) {
        toast.warn(
          `You can only select up to ${maxSelectableDates} date(s) for ${prev.requestedHours} hours.`
        );
        return prev;
      }

      return { ...prev, inclusiveDates: [...prev.inclusiveDates, value] };
    });
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

    if (!formData.memos || formData.memos.length === 0) {
      toast.error("No memos selected for CTO application");
      return;
    }

    mutation.mutate({
      requestedHours: Number(formData.requestedHours),
      reason: formData.reason,
      memos: formData.memos, // <-- pass memos to backend
      inclusiveDates: formData.inclusiveDates,
      approver1: formData.approver1,
      approver2: formData.approver2,
      approver3: formData.approver3,
    });
  };

  const approverNames = [
    approverResponse?.data?.level1Approver,
    approverResponse?.data?.level2Approver,
    approverResponse?.data?.level3Approver,
  ];

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
        (sum, memo) =>
          sum + ((memo.remainingHours || 0) - (memo.reservedHours || 0)),
        0
      );
      setMaxRequestedHours(totalRemaining);
    } else {
      setMaxRequestedHours(null);
    }
  }, [memoResponse]);

  // ---------------- UI ----------------
  return (
    <div className="max-w-xl mx-auto">
      <h2 className="flex items-center gap-3 mb-4 border-b pb-2">
        <span className="flex items-center justify-center w-8 h-8 bg-violet-600 rounded-full">
          <Clock className="w-5 h-5 text-white" />
        </span>
        <span className="text-xl font-bold text-gray-800">Apply for CTO</span>
      </h2>

      <div className="space-y-5 overflow-y-auto pr-2 h-122">
        {/* CTO Memo - Read Only Box */}
        <div>
          <label className="block text-sm font-medium mb-1">
            CTO Memos in Use
          </label>
          {memoLoading ? (
            <Skeleton height={38} />
          ) : selectedMemos.length === 0 ? (
            <p className="text-sm text-gray-500">No memos used yet.</p>
          ) : (
            <ul className="text-sm text-gray-600 pl-4 space-y-1 border p-2 rounded-md bg-gray-50 max-h-40 overflow-y-auto">
              {selectedMemos.map((memo) => (
                <li key={memo.memoId}>
                  {memo.memoNo} — Applied: {memo.appliedHours}h / Remaining:{" "}
                  {memo.remainingHours - (memo.reservedHours || 0)}h
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setIsMemoModalOpen(true)}
            className="mt-2 px-3 py-2 text-sm rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
          >
            View Memo Details
          </button>
        </div>

        {/* Inclusive Dates */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Inclusive Dates
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.()}
              className="w-full px-3 py-2 border rounded-md text-left hover:bg-gray-50 flex flex-col items-start gap-1 max-h-40 overflow-y-auto focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <span className="text-gray-400 text-sm">
                {formData.requestedHours
                  ? `Click to add up to ${Math.ceil(
                      Number(formData.requestedHours) / 8
                    )} date(s)`
                  : "Click to add dates"}
              </span>
              {formData.inclusiveDates.map((date) => (
                <div
                  key={date}
                  className="w-full flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
                >
                  <span className="text-sm">{date}</span>
                  <button
                    type="button"
                    className="text-xs text-red-500 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDateRemove(date);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </button>
            <input
              type="date"
              ref={dateInputRef}
              onChange={handleDateAdd}
              className="absolute top-0 left-0 opacity-0 pointer-events-none"
            />
          </div>
        </div>

        {/* Requested Hours */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Requested Hours
          </label>
          <input
            type="number"
            name="requestedHours"
            value={formData.requestedHours}
            onChange={handleChange}
            min="1"
            max={maxRequestedHours || undefined}
            className="w-full px-3 py-2 border rounded-md"
          />
          {maxRequestedHours !== null && (
            <p className="text-xs text-gray-500 mt-1">
              Maximum allowed: {maxRequestedHours} hours
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium mb-1">Reason</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows="3"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Approval Routing */}
        <button
          type="button"
          onClick={() => setShowRouting((prev) => !prev)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors m-0"
        >
          {showRouting ? "Hide Approval Routing" : "View Approval Routing"}
          {showRouting ? (
            <ChevronUp size={16} className="ml-1" />
          ) : (
            <ChevronDown size={16} className="ml-1" />
          )}
        </button>

        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            showRouting ? "max-h-[600px] opacity-100 mt-4" : "max-h-0 opacity-0"
          }`}
        >
          <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">
              Approval Routing
            </h3>
            {isApproverLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, idx) => (
                  <Skeleton key={idx} height={36} />
                ))}
              </div>
            ) : isApproverError ? (
              <p className="text-sm text-red-500 italic">
                Failed to load approvers.
              </p>
            ) : (
              <div className="space-y-2">
                {approverNames.map((approver, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-3 py-2 bg-white border rounded-lg transition hover:shadow-sm"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {approver
                          ? `${approver.firstName} ${approver.lastName}`
                          : "Not Assigned"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {approver?.position || "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Memo Modal */}
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
    </div>
  );
});

export default AddCtoApplicationForm;
