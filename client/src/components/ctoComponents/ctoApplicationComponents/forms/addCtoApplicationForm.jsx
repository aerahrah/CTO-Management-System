import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchApproverSettings,
  addApplicationRequest,
  fetchMyCtoMemos,
} from "../../../../api/cto";
import { useAuth } from "../../../../store/authStore";
import { CustomButton } from "../../../customButton";
import { Clock } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import SelectCtoMemoModal from "./selectCtoMemoModal";
import "react-loading-skeleton/dist/skeleton.css";

const AddCtoApplicationForm = () => {
  const queryClient = useQueryClient();
  const { admin } = useAuth();

  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [selectedMemos, setSelectedMemos] = useState([]);

  const [formData, setFormData] = useState({
    requestedHours: "",
    reason: "",
    memoId: [],
    inclusiveDates: [],
    approver1: "",
    approver2: "",
    approver3: "",
  });
  const dateInputRef = useRef(null);
  /* ---------------- APPROVER SETTINGS ---------------- */
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

  /* ---------------- CTO MEMOS ---------------- */
  const { data: memoResponse, isLoading: memoLoading } = useQuery({
    queryKey: ["myCtoMemos"],
    queryFn: fetchMyCtoMemos,
  });

  /* ---------------- SUBMIT ---------------- */
  const mutation = useMutation({
    mutationFn: addApplicationRequest,
    onSuccess: () => {
      alert("CTO application submitted successfully!");
      queryClient.invalidateQueries(["myCtoApplications"]);
      setFormData((prev) => ({
        ...prev,
        requestedHours: "",
        reason: "",
        memoId: [],
        inclusiveDates: [],
      }));
      setSelectedMemos([]);
    },
    onError: (err) => {
      console.error(err);
      alert(err.response?.data?.error || "Failed to submit CTO application");
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
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

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      requestedHours: Number(formData.requestedHours),
      reason: formData.reason,
      memoId: formData.memoId,
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

      <form className="space-y-5" onSubmit={handleSubmit}>
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
                {/* Always show the "Click to select memos" as the first line */}
                <span className="text-gray-400 text-sm">
                  Click to select memos
                </span>

                {selectedMemos.length > 0 &&
                  selectedMemos.map((m, index) => (
                    <div
                      key={m._id}
                      className="w-full flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
                    >
                      <span className="text-sm">
                        {m.memoNo} (Hours: {m.totalHours})
                      </span>
                      {index === selectedMemos.length - 1 && (
                        <button
                          type="button"
                          className="text-xs text-red-500 ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedMemos = [...selectedMemos];
                            const removed = updatedMemos.pop();
                            setSelectedMemos(updatedMemos);
                            setFormData((prev) => ({
                              ...prev,
                              memoId: prev.memoId.filter(
                                (id) => id !== removed._id
                              ),
                            }));
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
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
              {/* Always show "Click to add date" */}
              <span className="text-gray-400 text-sm">Click to add date</span>

              {formData.inclusiveDates.length > 0 &&
                formData.inclusiveDates.map((date) => (
                  <div
                    key={date}
                    className="w-full flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
                  >
                    <span className="text-sm">{date}</span>
                    {/* Remove button now shown for all dates */}
                    <button
                      type="button"
                      className="text-xs text-red-500 ml-2"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent button from triggering date picker
                        handleDateRemove(date);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </button>

            {/* Hidden date input for triggering picker */}
            <input
              type="date"
              ref={dateInputRef}
              onChange={handleDateAdd}
              className="absolute top-0 left-0 opacity-0 pointer-events-none" // Fix position
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
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium mb-1">Reason</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows="3"
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Approval Routing */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 border-b pb-1">
            Approval Routing
          </h3>

          {isApproverLoading ? (
            [...Array(3)].map((_, idx) => <Skeleton key={idx} height={38} />)
          ) : isApproverError ? (
            <p className="text-red-500 italic">Failed to load approvers.</p>
          ) : (
            approverNames.map((approver, idx) => (
              <input
                key={idx}
                readOnly
                className="w-full px-4 py-2 border bg-gray-50 rounded"
                value={
                  approver
                    ? `${approver.firstName} ${approver.lastName} (${approver.position})`
                    : "Not assigned"
                }
              />
            ))
          )}
        </div>

        <CustomButton
          type="submit"
          className="w-full py-2"
          label={
            mutation.isPending ? "Submitting..." : "Submit CTO Application"
          }
          variant="save"
          disabled={mutation.isPending}
        />
      </form>

      <SelectCtoMemoModal
        isOpen={isMemoModalOpen}
        onClose={() => setIsMemoModalOpen(false)}
        memos={memoResponse?.memos || []}
        selectedMemos={selectedMemos}
        onSelect={(memo) => {
          setSelectedMemos((prev) => [...prev, memo]);
          setFormData((prev) => ({
            ...prev,
            memoId: [...prev.memoId, memo._id],
          }));
        }}
      />
    </div>
  );
};

export default AddCtoApplicationForm;
