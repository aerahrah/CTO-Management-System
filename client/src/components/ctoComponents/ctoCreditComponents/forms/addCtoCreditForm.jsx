import { useState } from "react";
import { Upload } from "lucide-react";
import Select from "react-select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployees } from "../../../../api/employee";
import { addCreditRequest } from "../../../../api/cto";

const AddCtoCreditForm = ({ onSubmit }) => {
  const queryClient = useQueryClient();

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    staleTime: Infinity,
  });

  const [formData, setFormData] = useState({
    employees: [],
    duration: { hours: "", minutes: "" },
    memoNo: "",
    memoFile: null,
    dateApproved: "",
    // approver: null,
  });

  const addCreditMutation = useMutation({
    mutationFn: addCreditRequest,
    onSuccess: () => {
      alert("Credit request submitted!");
      setFormData({
        employees: [],
        duration: { hours: "", minutes: "" },
        memoNo: "",
        memoFile: null,
        dateApproved: "",
      });
      queryClient.invalidateQueries(["ctoCredits"]);
    },
    onError: (err) => {
      console.error(err);
      alert("Failed to submit credit request");
    },
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "hours" || name === "minutes") {
      setFormData((prev) => ({
        ...prev,
        duration: { ...prev.duration, [name]: value },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: files ? files[0] : value,
      }));
    }
  };

  const handleEmployeeChange = (selected) => {
    setFormData((prev) => ({
      ...prev,
      employees: selected ? selected.map((s) => s.value) : [],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = {
      employees: formData.employees,
      duration: {
        hours: Number(formData.duration.hours) || 0,
        minutes: Number(formData.duration.minutes) || 0,
      },
      memoNo: formData.memoNo,
      dateApproved: formData.dateApproved,
      // approver: formData.approver,
    };

    console.log("Submitting:", payload);
    addCreditMutation.mutate(payload);
  };

  if (isLoading) return <div>Loading employees...</div>;

  const employeeOptions = employeesData.data.map((emp) => ({
    value: emp._id,
    label: `${emp.firstName} ${emp.lastName}`,
  }));

  return (
    <>
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
        ➕ Credit CTO
      </h2>
      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* Employees */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Employees
          </label>
          <Select
            options={employeeOptions}
            value={employeeOptions.filter((e) =>
              formData.employees.includes(e.value)
            )}
            isMulti
            onChange={handleEmployeeChange}
            classNamePrefix="react-select"
            placeholder="Search employees..."
            classNames={{
              control: ({ isFocused }) =>
                `border rounded-md px-1 ${
                  isFocused
                    ? "border-blue-500 ring-2 ring-blue-300"
                    : "border-gray-300"
                }`,
              option: ({ isSelected, isFocused }) =>
                `${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : isFocused
                    ? "bg-gray-100"
                    : "bg-white"
                } cursor-pointer px-3 py-2`,
              multiValue: () => "bg-blue-100 text-blue-900 rounded px-2 py-1",
              multiValueRemove: () =>
                "text-blue-600 hover:bg-blue-200 hover:text-blue-900 cursor-pointer px-1",
            }}
          />
        </div>

        {/* Duration (Hours & Minutes) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credit Duration
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              name="hours"
              value={formData.duration.hours}
              onChange={handleChange}
              placeholder="Hours"
              min="0"
              className="w-1/2 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="number"
              name="minutes"
              value={formData.duration.minutes}
              onChange={handleChange}
              placeholder="Minutes"
              min="0"
              max="59"
              className="w-1/2 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Memo No. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Memo Number
          </label>
          <input
            type="text"
            name="memoNo"
            value={formData.memoNo}
            onChange={handleChange}
            placeholder="Enter memo number"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Upload Memo */}
        <div className="flex flex-col gap-6 w-full">
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Memo (PDF)
            </label>

            <div className="flex items-center justify-between border rounded-lg bg-gray-50 px-4 py-2 hover:bg-gray-100 transition">
              <label className="flex items-center gap-2 cursor-pointer flex-1 overflow-hidden">
                <Upload className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-700 truncate overflow-hidden whitespace-nowrap">
                  {formData.memoFile ? formData.memoFile.name : "Choose a file"}
                </span>
                <input
                  type="file"
                  name="memoFile"
                  accept="application/pdf"
                  onChange={handleChange}
                  className="hidden"
                />
              </label>

              {formData.memoFile && (
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, memoFile: null }))
                  }
                  className="ml-3 text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Date Approved */}
          <div className="w-full flex gap-1 flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Approved
            </label>
            <div>
              <input
                type="date"
                name="dateApproved"
                value={formData.dateApproved}
                onChange={handleChange}
                className="w-34 px-3 py-2 border rounded-md focus:ring-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-neutral-800 text-white font-medium rounded-md hover:bg-neutral-700 active:scale-96 transition cursor-pointer"
        >
          Submit Credit Request
        </button>
      </form>
    </>
  );
};

export default AddCtoCreditForm;
