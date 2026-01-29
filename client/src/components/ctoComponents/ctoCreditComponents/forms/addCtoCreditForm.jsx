import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Upload, Users, Clock, FileText, Calendar } from "lucide-react";
import Select from "react-select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApprovers } from "../../../../api/cto";
import { addCreditRequest } from "../../../../api/cto";
import { toast } from "react-toastify";

const AddCtoCreditForm = forwardRef(({ onClose }, ref) => {
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [formData, setFormData] = useState({
    employees: [],
    duration: { hours: "", minutes: "" },
    memoNo: "",
    memoFile: null,
    dateApproved: "",
  });

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: fetchApprovers,
    staleTime: Infinity,
    enabled: menuOpen,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: addCreditRequest,
    onSuccess: () => {
      toast.success("CTO credit added successfully");
      queryClient.invalidateQueries(["ctoCredits"]);
      onClose?.();
    },
    onError: (err) => {
      console.log("Mutation error:", err);
      toast.error(
        err.response?.data?.error ||
          err.message ||
          "Failed to submit credit request",
      );
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

  const handleSubmit = (e) => {
    e?.preventDefault();

    if (isPending) return;

    const payload = new FormData();
    payload.append("memoFile", formData.memoFile);
    payload.append("memoNo", formData.memoNo);
    payload.append("dateApproved", formData.dateApproved);
    payload.append("employees", JSON.stringify(formData.employees));
    payload.append(
      "duration",
      JSON.stringify({
        hours: Number(formData.duration.hours) || 0,
        minutes: Number(formData.duration.minutes) || 0,
      }),
    );

    mutate(payload);
  };

  useImperativeHandle(ref, () => ({
    submit() {
      if (isPending) return;
      handleSubmit();
    },
    isPending,
  }));

  const employeeOptions =
    employeesData?.data?.map((emp) => ({
      value: emp._id,
      label: `${emp.firstName} ${emp.lastName}`,
    })) || [];

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl border border-gray-200 ">
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

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="px-4 py-5 space-y-7 h-[calc(100vh-16rem)] overflow-y-auto"
      >
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
                }`,
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
                className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                name="minutes"
                placeholder="Minutes"
                min="0"
                max="59"
                value={formData.duration.minutes}
                onChange={handleChange}
                className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
              max={new Date().toISOString().split("T")[0]} // <-- prevents future dates
              className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full h-10 px-3 border-neutral-400 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Memo (PDF)
            </label>
            <label className="flex items-center gap-3 px-4 py-3 border border-neutral-600 border-dashed rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition">
              <Upload className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700 truncate">
                {formData.memoFile ? formData.memoFile.name : "Choose PDF file"}
              </span>
              <input
                type="file"
                accept="application/pdf"
                name="memoFile"
                onChange={handleChange}
                className="hidden"
              />
            </label>

            {formData.memoFile && (
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, memoFile: null }))}
                className="mt-2 text-xs text-red-600 hover:underline"
              >
                Remove file
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
});

export default AddCtoCreditForm;
