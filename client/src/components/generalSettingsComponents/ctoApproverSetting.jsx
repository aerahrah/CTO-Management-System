// src/components/cto/ctoApproverSetting.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Edit2,
  X,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Save,
} from "lucide-react";
import Select from "react-select";
import {
  fetchApproverSettings,
  upsertApproverSetting,
  fetchApprovers,
} from "../../api/cto";

const getErrMsg = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message || err?.message || fallback;

const StatusPill = ({ status }) => {
  const s = status || "Active";
  const map = {
    Active: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Inactive: "bg-gray-50 text-gray-700 border-gray-100",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        map[s] || map.Inactive
      }`}
    >
      {s}
    </span>
  );
};

// ✅ match your select style system (rounded-xl, indigo ring)
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    borderRadius: "0.75rem",
    borderColor: state.isFocused ? "#a5b4fc" : "rgba(226,232,240,0.9)",
    boxShadow: state.isFocused ? "0 0 0 4px rgba(99,102,241,0.12)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#a5b4fc" : "rgba(148,163,184,0.7)",
    },
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: "2px",
  }),
  valueContainer: (base) => ({
    ...base,
    paddingLeft: 10,
    paddingRight: 10,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "rgba(100,116,139,0.8)",
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgba(100,116,139,0.8)",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    borderRadius: "0.75rem",
    overflow: "hidden",
    border: "1px solid rgba(226,232,240,0.9)",
    boxShadow: "0 20px 40px rgba(15,23,42,0.08)",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: 13,
    backgroundColor: state.isSelected
      ? "rgba(99,102,241,0.10)"
      : state.isFocused
        ? "rgba(2,6,23,0.04)"
        : "white",
    color: "#0f172a",
  }),
};

const ApproverSettings = ({ selectedDesignation }) => {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [form, setForm] = useState({
    level1Approver: "",
    level2Approver: "",
    level3Approver: "",
  });

  const designationId = selectedDesignation?._id
    ? String(selectedDesignation._id)
    : "";

  /* ---------- Approvers list ---------- */
  const approversQuery = useQuery({
    queryKey: ["approvers"],
    queryFn: fetchApprovers,
    staleTime: 10 * 60 * 1000,
  });

  const approvers = useMemo(() => {
    const raw = approversQuery.data;
    const list = Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw)
          ? raw
          : [];
    return list;
  }, [approversQuery.data]);

  const employeeOptions = useMemo(() => {
    const opts = approvers
      .filter((emp) => emp?._id && (emp?.firstName || emp?.lastName))
      .map((emp) => ({
        value: String(emp._id),
        label:
          `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Unnamed",
        subLabel: emp.position || emp.designation?.name || "Staff",
      }));

    // stable sort
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [approvers]);

  /* ---------- Current designation setting ---------- */
  const settingQuery = useQuery({
    queryKey: ["approverSetting", designationId],
    queryFn: () => fetchApproverSettings(designationId),
    enabled: Boolean(designationId),
  });

  const approverSettingData = settingQuery.data?.data;

  useEffect(() => {
    setInlineError("");
    if (!designationId) {
      setForm({ level1Approver: "", level2Approver: "", level3Approver: "" });
      setIsEditing(false);
      return;
    }

    if (settingQuery.data?.show && approverSettingData) {
      setForm({
        level1Approver: approverSettingData.level1Approver?._id
          ? String(approverSettingData.level1Approver._id)
          : "",
        level2Approver: approverSettingData.level2Approver?._id
          ? String(approverSettingData.level2Approver._id)
          : "",
        level3Approver: approverSettingData.level3Approver?._id
          ? String(approverSettingData.level3Approver._id)
          : "",
      });
    } else {
      setForm({ level1Approver: "", level2Approver: "", level3Approver: "" });
    }

    setIsEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designationId, settingQuery.data?.show]);

  const mutation = useMutation({
    mutationFn: upsertApproverSetting,
    onSuccess: async () => {
      setInlineError("");
      await queryClient.invalidateQueries({
        queryKey: ["approverSetting", designationId],
      });
      setIsEditing(false);
    },
    onError: (err) => {
      setInlineError(getErrMsg(err, "Failed to save configuration"));
    },
  });

  const handleSave = useCallback(() => {
    if (!designationId) return;

    setInlineError("");
    mutation.mutate({
      designation: designationId,
      ...form,
    });
  }, [designationId, form, mutation]);

  const CustomOption = (props) => {
    const { data, innerRef, innerProps } = props;
    return (
      <div
        ref={innerRef}
        {...innerProps}
        className="px-3 py-2 hover:bg-indigo-50 cursor-pointer transition-colors border-b border-neutral-50 last:border-0"
      >
        <div className="text-sm font-medium text-neutral-800">{data.label}</div>
        <div className="text-xs text-neutral-500">{data.subLabel}</div>
      </div>
    );
  };

  if (!selectedDesignation) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-neutral-50/50 border-2 border-dashed border-neutral-200 rounded-2xl p-8 text-center m-4">
        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
          <Building2 className="w-10 h-10 text-neutral-300" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-800 mb-1">
          No Designation Selected
        </h3>
        <p className="text-sm text-neutral-500 max-w-xs">
          Select a designation from the sidebar to configure its approval
          routing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* HEADER */}
      <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-neutral-800">
              Routing Settings
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-neutral-700 font-semibold">
              {selectedDesignation.name || "Designation"}
            </span>
            <StatusPill status={selectedDesignation.status} />
          </div>
        </div>

        <button
          onClick={() => {
            setInlineError("");
            setIsEditing((v) => !v);
          }}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm
            ${
              isEditing
                ? "bg-white border border-indigo-200 text-indigo-600 hover:bg-neutral-50"
                : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
            }`}
          type="button"
        >
          {isEditing ? (
            <>
              <X size={16} /> Cancel
            </>
          ) : (
            <>
              <Edit2 size={16} /> Edit Routing
            </>
          )}
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto py-5 px-6">
        {settingQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
            <p className="text-sm text-neutral-500">
              Loading configurations...
            </p>
          </div>
        ) : settingQuery.isError ? (
          <div className="max-w-2xl">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
              {getErrMsg(settingQuery.error, "Failed to load configuration")}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Approval Sequence
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Define the chain of approval. Requests flow sequentially from
                Level 1 to Level 3.
              </p>
            </div>

            {inlineError && (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
                {inlineError}
              </div>
            )}

            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-neutral-200 before:to-transparent">
              {[1, 2, 3].map((level) => {
                const key = `level${level}Approver`;
                const selectedValue = employeeOptions.find(
                  (o) => o.value === form[key],
                );

                return (
                  <div key={level} className="relative flex items-start gap-6">
                    {/* Dot */}
                    <div
                      className={`absolute left-0 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-colors
                      ${
                        selectedValue
                          ? "bg-indigo-600 text-white"
                          : "bg-neutral-200 text-neutral-500"
                      }`}
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
                          value={selectedValue || null}
                          onChange={(selected) =>
                            setForm((prev) => ({
                              ...prev,
                              [key]: selected?.value || "",
                            }))
                          }
                          placeholder={
                            approversQuery.isLoading
                              ? "Loading employees..."
                              : "Select an employee..."
                          }
                          isLoading={approversQuery.isLoading}
                          isDisabled={approversQuery.isLoading}
                          isClearable
                          styles={selectStyles}
                        />
                      ) : (
                        <div
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                          ${
                            selectedValue
                              ? "bg-white border-neutral-200 shadow-sm"
                              : "bg-neutral-50 border-neutral-100 italic"
                          }`}
                        >
                          <div
                            className={`p-2 rounded-lg ${
                              selectedValue
                                ? "bg-indigo-50 text-indigo-600"
                                : "bg-neutral-100 text-neutral-300"
                            }`}
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

      {/* FOOTER */}
      {isEditing && (
        <div className="p-2 border-t border-neutral-100 bg-neutral-50/50 flex justify-end px-6">
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md shadow-indigo-100 active:scale-[0.98]"
            type="button"
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
