import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Edit2,
  X,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Building2,
  Save,
} from "lucide-react";
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

  useEffect(() => {
    if (approverSetting?.show) {
      const data = approverSetting.data;
      setForm({
        level1Approver: data.level1Approver?._id || "",
        level2Approver: data.level2Approver?._id || "",
        level3Approver: data.level3Approver?._id || "",
      });
    } else {
      setForm({ level1Approver: "", level2Approver: "", level3Approver: "" });
    }
    setIsEditing(false);
  }, [approverSetting]);

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
      designation: selectedOffice._id,
      ...form,
    });
  };

  // --- RENDERS ---

  if (!selectedOffice) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-neutral-50/50 border-2 border-dashed border-neutral-200 rounded-2xl p-8 text-center m-4">
        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
          <Building2 className="w-10 h-10 text-neutral-300" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-800 mb-1">
          No Office Selected
        </h3>
        <p className="text-sm text-neutral-500 max-w-xs">
          Select a provincial office from the sidebar to configure its specific
          approval workflow.
        </p>
      </div>
    );
  }

  const employeeOptions = employeesData.map((emp) => ({
    value: emp._id,
    label: `${emp.firstName} ${emp.lastName}`,
    subLabel: emp.position || "Staff",
  }));

  // Custom Option component for Select to show Position
  const CustomOption = (props) => {
    const { data, innerRef, innerProps } = props;
    return (
      <div
        ref={innerRef}
        {...innerProps}
        className="px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors border-b border-neutral-50 last:border-0"
      >
        <div className="text-sm font-medium text-neutral-800">{data.label}</div>
        <div className="text-xs text-neutral-500">{data.subLabel}</div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden ">
      {/* --- HEADER --- */}
      <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-neutral-800">
              Workflow Settings
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              {selectedOffice.code}
            </span>
            <span className="text-sm text-neutral-500 font-medium">
              {selectedOffice.name}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm
            ${
              isEditing
                ? "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                : "bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95"
            }`}
        >
          {isEditing ? (
            <>
              <X size={16} /> Cancel
            </>
          ) : (
            <>
              <Edit2 size={16} /> Edit Workflow
            </>
          )}
        </button>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto py-5 px-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
            <p className="text-sm text-neutral-500">
              Loading configurations...
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-aut">
            <div className="mb-6">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Approval Sequence
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Define the chain of command for CTO applications. Requests will
                flow sequentially from Level 1 to Level 3.
              </p>
            </div>

            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-neutral-200 before:to-transparent">
              {[1, 2, 3].map((level) => {
                const selectedValue = employeeOptions.find(
                  (o) => o.value === form[`level${level}Approver`],
                );

                return (
                  <div
                    key={level}
                    className="relative flex items-start gap-6 group"
                  >
                    {/* Level Indicator Dot */}
                    <div
                      className={`absolute left-0 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-colors
                      ${selectedValue ? "bg-blue-600 text-white" : "bg-neutral-200 text-neutral-500"}`}
                    >
                      <span className="text-xs font-bold">{level}</span>
                    </div>

                    <div className="flex-1 ml-12">
                      <div className="mb-2">
                        <h4 className="text-sm font-bold text-neutral-800">
                          Level {level} Approver
                        </h4>
                        <p className="text-xs text-neutral-400">
                          {level === 1
                            ? "Primary Reviewer"
                            : level === 2
                              ? "Secondary Reviewer"
                              : "Final Authority"}
                        </p>
                      </div>

                      {isEditing ? (
                        <Select
                          options={employeeOptions}
                          components={{ Option: CustomOption }}
                          value={selectedValue}
                          onChange={(selected) =>
                            setForm((prev) => ({
                              ...prev,
                              [`level${level}Approver`]: selected?.value || "",
                            }))
                          }
                          placeholder="Select an employee..."
                          className="react-select-container"
                          classNamePrefix="react-select"
                          isClearable
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              borderRadius: "0.5rem",
                              padding: "2px",
                              borderColor: state.isFocused
                                ? "#3b82f6"
                                : "#e5e7eb",
                              boxShadow: state.isFocused
                                ? "0 0 0 2px rgba(59, 130, 246, 0.1)"
                                : "none",
                              "&:hover": { borderColor: "#3b82f6" },
                            }),
                          }}
                        />
                      ) : (
                        <div
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                          ${selectedValue ? "bg-white border-neutral-200 shadow-sm" : "bg-neutral-50 border-neutral-100 italic"}`}
                        >
                          <div
                            className={`p-2 rounded-lg ${selectedValue ? "bg-blue-50 text-blue-600" : "bg-neutral-100 text-neutral-300"}`}
                          >
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-neutral-700">
                              {selectedValue?.label || "No approver assigned"}
                            </div>
                            {selectedValue && (
                              <div className="text-xs text-neutral-500">
                                {selectedValue.subLabel}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* --- FOOTER ACTIONS --- */}
      {isEditing && (
        <div className="p-2 border-t border-neutral-100 bg-neutral-50/50 flex justify-end px-6">
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 scale-90 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md shadow-blue-100 active:scale-85"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Saving...
              </>
            ) : (
              <>
                <Save size={18} /> Save Configurations
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ApproverSettings;
