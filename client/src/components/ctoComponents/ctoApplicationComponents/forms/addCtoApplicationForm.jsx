import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApproverSettings } from "../../../../api/cto";
import { addApplicationRequest } from "../../../../api/cto";
import { useAuth } from "../../../../store/authStore";

const AddCtoApplicationForm = () => {
  const queryClient = useQueryClient();
  const { admin } = useAuth();
  const [formData, setFormData] = useState({
    requestedHours: "",
    requestedMinutes: "",
    reason: "",
    approver1: "",
    approver2: "",
    approver3: "",
  });

  const {
    data: approverResponse,
    isLoading: isApproverLoading,
    isError: isApproverError,
  } = useQuery({
    queryKey: ["approverSettings", admin?.provincialOffice],
    queryFn: () => fetchApproverSettings(admin.provincialOffice),
    enabled: !!admin?.provincialOffice,
  });

  console.log(approverResponse);
  // ✅ Populate approvers automatically when data is fetched
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

  const mutation = useMutation({
    mutationFn: addApplicationRequest,
    onSuccess: () => {
      alert("CTO application submitted successfully!");
      setFormData((prev) => ({
        requestedHours: "",
        requestedMinutes: "",
        reason: "",
        approver1: prev.approver1,
        approver2: prev.approver2,
        approver3: prev.approver3,
      }));
      queryClient.invalidateQueries(["myCtoApplications"]);
    },
    onError: (err) => {
      console.error(err);
      alert("Failed to submit CTO application.");
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      requestedHours: Number(formData.requestedHours) || 0,
      requestedMinutes: Number(formData.requestedMinutes) || 0,
      reason: formData.reason,
      approver1: formData.approver1,
      approver2: formData.approver2,
      approver3: formData.approver3,
    };

    console.log("Submitting CTO request:", payload);
    mutation.mutate(payload);
  };

  if (isApproverLoading) return <div>Loading approvers...</div>;
  if (isApproverError) return <div>Failed to load approvers.</div>;

  const approverNames = [
    approverResponse?.data?.level1Approver,
    approverResponse?.data?.level2Approver,
    approverResponse?.data?.level3Approver,
  ];

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-6 border-b pb-2">🕒 Apply for CTO</h2>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* Requested Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Requested Duration
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              name="requestedHours"
              value={formData.requestedHours}
              onChange={handleChange}
              placeholder="Hours"
              min="0"
              className="w-1/2 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="number"
              name="requestedMinutes"
              value={formData.requestedMinutes}
              onChange={handleChange}
              placeholder="Minutes"
              min="0"
              max="59"
              className="w-1/2 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason
          </label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            placeholder="Explain your reason for CTO"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
          />
        </div>

        {/* Approvers (Auto-filled) */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 border-b pb-1">
            Approval Routing
          </h3>

          {approverNames.map((approver, idx) => (
            <div key={idx} className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">
                Approver {idx + 1}
              </label>
              <input
                type="text"
                value={
                  approver
                    ? `${approver.firstName} ${approver.lastName} (${approver.position})`
                    : "Not assigned"
                }
                readOnly
                className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700 outline-0"
              />
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full px-4 py-2 bg-neutral-800 text-white font-medium rounded-md hover:bg-neutral-700 active:scale-96 transition "
        >
          {mutation.isPending ? "Submitting..." : "Submit CTO Application"}
        </button>
      </form>
    </div>
  );
};

export default AddCtoApplicationForm;
