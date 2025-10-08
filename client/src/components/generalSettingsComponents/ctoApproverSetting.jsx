import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Edit2 } from "lucide-react";
import Select from "react-select";
import { fetchApproverSettings, upsertApproverSetting } from "../../api/cto";
import { getEmployees } from "../../api/employee";

const ApproverSettings = ({ selectedOffice }) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    level1Approver: "",
    level2Approver: "",
    level3Approver: "",
  });

  // Fetch employees
  const { data: employeesResponse } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    staleTime: Infinity,
  });

  const employeesData = Array.isArray(employeesResponse?.data)
    ? employeesResponse.data
    : [];

  // Fetch approver settings
  const {
    data: approverSetting,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["approverSetting", selectedOffice?._id],
    queryFn: () => fetchApproverSettings(selectedOffice?._id),
    enabled: !!selectedOffice,
  });

  // Sync form when approverSetting changes
  useEffect(() => {
    if (approverSetting?.show) {
      const data = approverSetting.data;
      setForm({
        level1Approver: data.level1Approver?._id || "",
        level2Approver: data.level2Approver?._id || "",
        level3Approver: data.level3Approver?._id || "",
      });
      setIsEditing(false); // view mode
    } else {
      setForm({ level1Approver: "", level2Approver: "", level3Approver: "" });
      setIsEditing(false); // view mode
    }
  }, [approverSetting]);

  // Mutation for saving
  const mutation = useMutation({
    mutationFn: upsertApproverSetting,
    onSuccess: () => {
      queryClient.invalidateQueries(["approverSetting", selectedOffice?._id]);
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    if (!selectedOffice) return;
    mutation.mutate({
      provincialOffice: selectedOffice._id,
      ...form,
    });
  };

  if (!selectedOffice) {
    return (
      <div className="flex flex-col items-center justify-center h-[80%] bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
        <svg
          className="w-12 h-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 28 28"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-gray-600 text-lg font-medium mb-2">
          No provincial office selected
        </p>
        <p className="text-gray-400 text-md italic">
          Please select a provincial office from the list to configure
          approvers.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-500 font-medium">
        {error?.response?.data?.message || "Error fetching approvers"}
      </div>
    );
  }

  // Map employees to options for Select
  const employeeOptions = employeesData.map((emp) => ({
    value: emp._id,
    label: `${emp.firstName} ${emp.lastName} – ${emp.position}`,
  }));

  return (
    <div className="bg-white p-2">
      <div className="mb-6 border-b pb-3 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Approver Settings
          </h2>
          <p className="text-gray-600 mt-1">
            Provincial Office:{" "}
            <span className="font-medium text-blue-600">
              {selectedOffice.name} ({selectedOffice.code})
            </span>
          </p>
        </div>
        <button
          onClick={() => setIsEditing((prev) => !prev)}
          className=" bg-neutral-800 flex items-center gap-2 px-6 py-2.5 text-white rounded-sm hover:bg-neutral-800/90 text-sm font-medium shadow-sm transition hover:cursor-pointer active:scale-96"
        >
          <Edit2 size={16} /> {isEditing ? "Cancel" : "Edit"}
        </button>
      </div>

      {!approverSetting?.show && (
        <p className="text-gray-700 mb-4">
          {approverSetting?.message ||
            "No approver for this provincial office."}
        </p>
      )}
      <div className="space-y-5">
        {[1, 2, 3].map((level) => {
          const selectedValue =
            employeeOptions.find(
              (o) => o.value === form[`level${level}Approver`]
            ) || null;

          return (
            <div key={level}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level {level} Approver
              </label>

              {isEditing ? (
                <Select
                  options={employeeOptions}
                  value={selectedValue}
                  onChange={(selected) =>
                    setForm((prev) => ({
                      ...prev,
                      [`level${level}Approver`]: selected ? selected.value : "",
                    }))
                  }
                  isClearable
                  placeholder="Select approver..."
                  classNames={{
                    control: ({ isFocused }) =>
                      `border rounded-md px-2 py-1 ${
                        isFocused
                          ? "border-blue-500 ring-2 ring-blue-200"
                          : "border-gray-300"
                      }`,
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={selectedValue?.label || "None"}
                  readOnly
                  className="w-full p-2 border rounded bg-gray-50 text-gray-700"
                />
              )}
            </div>
          );
        })}

        {isEditing && (
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className=" bg-neutral-800 px-6 py-2.5 text-white rounded-sm hover:bg-neutral-800/90 text-sm font-medium shadow-sm transition hover:cursor-pointer active:scale-96 w-full"
          >
            {mutation.isPending ? "Saving..." : "Save Approvers"}
          </button>
        )}
      </div>
    </div>
  );
};

export default ApproverSettings;
