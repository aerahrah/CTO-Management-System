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
import { CustomButton } from "../../../customButton";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import SelectCtoMemoModal from "./selectCtoMemoModal";

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

  // Fetch approver settings
  const {
    data: approverResponse,
    isLoading: isApproverLoading,
    isError: isApproverError,
  } = useQuery({
    queryKey: ["approverSettings", admin?.provincialOffice],
    queryFn: () => fetchApproverSettings(admin.provincialOffice),
    enabled: !!admin?.provincialOffice,
  });

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

  // Fetch CTO memos
  const { data: memoResponse, isLoading: memoLoading } = useQuery({
    queryKey: ["myCtoMemos"],
    queryFn: fetchMyCtoMemos,
  });

  // Mutation to submit CTO application
  const mutation = useMutation({
    mutationFn: addApplicationRequest,
    onSuccess: () => {
      alert("CTO application submitted successfully!");
      queryClient.invalidateQueries(["ctoApplications"]);
      setFormData({
        requestedHours: "",
        reason: "",
        memos: [],
        inclusiveDates: [],
        approver1: formData.approver1,
        approver2: formData.approver2,
        approver3: formData.approver3,
      });
      setSelectedMemos([]);
      setMaxRequestedHours(null);
      onClose?.();
    },
    onError: (err) => {
      console.error(err);
      alert(err.response?.data?.error || "Failed to submit CTO application");
    },
  });

  // Expose submit function to parent
  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(),
  }));

  /* ---------------- Handlers ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "requestedHours") {
      let val = Number(value);
      if (maxRequestedHours !== null && val > maxRequestedHours)
        val = maxRequestedHours;

      // Distribute appliedHours across memos
      let remaining = val;
      const updatedMemos = selectedMemos.map((m) => {
        const take = Math.min(m.totalHours, remaining);
        remaining -= take;
        return { ...m, appliedHours: take };
      });

      setSelectedMemos(updatedMemos);

      // Update formData.memos appliedHours
      const updatedFormMemos = formData.memos.map((fm) => {
        const matched = updatedMemos.find((m) => m.memoId === fm.memoId);
        return { ...fm, appliedHours: matched?.appliedHours || 0 };
      });

      setFormData((prev) => ({
        ...prev,
        requestedHours: val,
        memos: updatedFormMemos,
      }));

      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateAdd = (e) => {
    const value = e.target.value;
    if (!value) return;
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: prev.inclusiveDates.includes(value)
        ? prev.inclusiveDates
        : [...prev.inclusiveDates, value],
    }));
  };

  const handleDateRemove = (date) => {
    setFormData((prev) => ({
      ...prev,
      inclusiveDates: prev.inclusiveDates.filter((d) => d !== date),
    }));
  };

  const handleRemoveMemo = (memoId) => {
    const updatedMemos = selectedMemos.filter((m) => m.memoId !== memoId);
    setSelectedMemos(updatedMemos);
    setFormData((prev) => ({
      ...prev,
      memos: prev.memos.filter((m) => m.memoId !== memoId),
    }));

    const cumulativeMax = updatedMemos.reduce(
      (acc, m) => acc + m.totalHours,
      0
    );
    setMaxRequestedHours(cumulativeMax);

    if (formData.requestedHours > cumulativeMax) {
      setFormData((prev) => ({
        ...prev,
        requestedHours: cumulativeMax,
      }));
    }
  };

  const handleSubmit = () => {
    mutation.mutate({
      requestedHours: Number(formData.requestedHours),
      reason: formData.reason,
      memos: formData.memos,
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

  /* ---------------- UI ---------------- */
  return (
    <div className="max-w-xl mx-auto">
      <h2 className="flex items-center gap-3 mb-4 border-b pb-2">
        <span className="flex items-center justify-center w-8 h-8 bg-violet-600 rounded-full">
          <Clock className="w-5 h-5 text-white" />
        </span>
        <span className="text-xl font-bold text-gray-800">Apply for CTO</span>
      </h2>

      <div className="space-y-5 overflow-y-auto pr-2 h-122">
        {/* CTO Memo */}
        <div>
          <label className="block text-sm font-medium mb-1">CTO Memo</label>
          {memoLoading ? (
            <Skeleton height={38} />
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setIsMemoModalOpen(true)}
                className="w-full px-3 py-2 border rounded-md text-left hover:bg-gray-50 flex flex-col items-start gap-1 max-h-40 overflow-y-auto"
              >
                <span className="text-gray-400 text-sm">
                  Click to select memos
                </span>
                {selectedMemos.length > 0 &&
                  selectedMemos.map((m, index) => {
                    const isLast = index === selectedMemos.length - 1;
                    return (
                      <div
                        key={m.memoId}
                        className="w-full flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
                      >
                        <span className="text-sm">
                          {m.memoNo} (Applied / Total: {m.appliedHours || 0} /{" "}
                          {m.totalHours})
                        </span>
                        {isLast && (
                          <div
                            type="button"
                            className="text-xs text-red-500 ml-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMemo(m.memoId);
                            }}
                          >
                            Remove
                          </div>
                        )}
                      </div>
                    );
                  })}
              </button>
            </div>
          )}
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
              <span className="text-gray-400 text-sm">Click to add date</span>
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
          {maxRequestedHours && (
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

        {/* Memo Selection Modal */}
        <SelectCtoMemoModal
          isOpen={isMemoModalOpen}
          onClose={() => setIsMemoModalOpen(false)}
          memos={memoResponse?.memos || []}
          selectedMemos={selectedMemos}
          onSelect={(memo) => {
            if (selectedMemos.some((m) => m.memoId === memo.id)) return;

            const newEntry = {
              memoId: memo.id,
              uploadedMemo: memo.uploadedMemo,
              memoNo: memo.memoNo,
              totalHours: memo.totalHours,
              appliedHours: 0,
            };

            const updatedMemos = [...selectedMemos, newEntry];
            setSelectedMemos(updatedMemos);

            setFormData((prev) => ({
              ...prev,
              memos: [
                ...prev.memos,
                { memoId: memo.id, uploadedMemo: memo.uploadedMemo },
              ],
            }));

            const cumulativeMax = updatedMemos.reduce(
              (acc, m) => acc + m.totalHours,
              0
            );
            setMaxRequestedHours(cumulativeMax);
          }}
        />
      </div>
    </div>
  );
});

export default AddCtoApplicationForm;
