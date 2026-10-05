import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Select, { components } from "react-select";
import { Bell, Info, UserCheck, X, Users } from "lucide-react";
import { upsertMyApprovalRoute } from "../../../api/approvalRoute";
import Modal from "../../modal"; // ⚠️ Adjust this path to where your Modal component lives

const CustomInput = (props) => <components.Input {...props} maxLength={100} />;

const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

export default function NotifiedEmployeesModal({
  isOpen,
  onClose,
  myRoute,
  steps,
  employeeOptions,
  admin,
  borderColor,
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState([]);

  // Load saved recipients every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(
      (myRoute?.notifiedEmployees || []).map((e) => String(e?._id || e)),
    );
  }, [isOpen, myRoute]);

  const approverIds = useMemo(
    () => new Set(steps.map((s) => String(s.approver))),
    [steps],
  );

  // Approvers already receive the request, so they're excluded here
  const options = useMemo(
    () => employeeOptions.filter((o) => !approverIds.has(o.value)),
    [employeeOptions, approverIds],
  );

  const selectedOptions = useMemo(() => {
    const set = new Set(selectedIds);
    return options.filter((o) => set.has(o.value));
  }, [options, selectedIds]);

  // Only show people who aren't selected yet in the dropdown
  const availableOptions = useMemo(() => {
    const set = new Set(selectedIds);
    return options.filter((o) => !set.has(o.value));
  }, [options, selectedIds]);

  const mutation = useMutation({
    mutationFn: (payload) => upsertMyApprovalRoute(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvalRoutes"] });
      toast.success("Notified employees saved!");
      onClose();
    },
    onError: (err) =>
      toast.error(getErrMsg(err, "Failed to update notified employees")),
  });

  const isBusy = mutation.isPending;
  const hasSteps = steps.length > 0;

  const addEmployee = (opt) => {
    if (!opt) return;
    setSelectedIds((prev) =>
      prev.includes(opt.value) ? prev : [...prev, opt.value],
    );
  };

  const removeEmployee = (id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleSave = () => {
    if (isBusy) return;
    if (!hasSteps) {
      toast.error("Add at least one approver step first.");
      return;
    }

    mutation.mutate({
      name: myRoute?.name || `${admin?.firstName || "Personal"}'s Workflow`,
      isPublic: false,
      steps: steps.map((s, i) => ({
        level: i + 1,
        approver: s.approver,
        role: s.role || "",
        isEnabled: s.isEnabled !== false,
      })),
      notifiedEmployees: selectedOptions.map((o) => o.value),
    });
  };

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      border: `1px solid ${borderColor}`,
      borderRadius: "0.5rem",
      backgroundColor: "var(--app-surface-2)",
      boxShadow: state.isFocused ? "0 0 0 2px var(--accent-soft)" : "none",
      minHeight: "44px",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "var(--accent-soft)" : "transparent",
      color: "var(--app-text)",
      cursor: "pointer",
    }),
    input: (base) => ({ ...base, color: "var(--app-text)" }),
    placeholder: (base) => ({ ...base, color: "var(--app-muted)" }),
    menu: (base) => ({
      ...base,
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
      zIndex: 60,
    }),
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          <Bell size={22} style={{ color: "var(--accent)" }} />
          Notified Employees
        </span>
      }
      isBusy={isBusy}
      preventCloseWhenBusy
      closeLabel="Cancel"
      action={{
        show: true,
        label: isBusy ? "Saving..." : "Save Recipients",
        variant: "save",
        disabled: isBusy || !hasSteps,
        onClick: handleSave,
      }}
    >
      <div className="space-y-5">
        {/* Guidance */}
        <div
          className="rounded-xl border p-4 flex gap-3"
          style={{
            backgroundColor: "var(--accent-soft)",
            borderColor: "var(--accent)",
          }}
        >
          <Info
            size={18}
            className="shrink-0 mt-0.5"
            style={{ color: "var(--accent)" }}
          />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold" style={{ color: "var(--app-text)" }}>
              Who should I add here?
            </p>
            <p className="mt-1" style={{ color: "var(--app-muted)" }}>
              Add people who need to <b>know</b> about your requests but
              don&apos;t approve them, for example your{" "}
              <b>Project Focal Person</b> or <b>Provincial Officer</b>.
            </p>
            <ul
              className="mt-2 space-y-1 text-xs list-disc pl-4"
              style={{ color: "var(--app-muted)" }}
            >
              <li>They get notified when you file a request.</li>
              <li>They don&apos;t approve, reject, or sign anything.</li>
              <li>
                Approvers in your workflow are already notified, so they
                don&apos;t appear in this list.
              </li>
            </ul>
          </div>
        </div>

        {!hasSteps ? (
          <div
            className="p-4 rounded-xl border text-center text-sm"
            style={{
              borderColor,
              color: "var(--app-muted)",
              backgroundColor: "var(--app-surface-2)",
            }}
          >
            Add at least one approver step to your workflow before adding
            notified employees.
          </div>
        ) : (
          <>
            {/* Picker */}
            <div className="space-y-2">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Add an employee to notify
              </label>
              <Select
                components={{ Input: CustomInput }}
                options={availableOptions}
                value={null}
                onChange={addEmployee}
                styles={selectStyles}
                maxMenuHeight={260}
                menuPlacement="auto"
                placeholder="Search by name (e.g. your focal person or provincial officer)..."
                noOptionsMessage={() => "No more employees available"}
                formatOptionLabel={(opt) => (
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {opt.position}
                    </span>
                  </div>
                )}
                isDisabled={isBusy}
              />
            </div>

            {/* Selected list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: "var(--app-muted)" }}
                >
                  <Users size={14} /> Will be notified
                </span>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  {selectedOptions.length}
                </span>
              </div>

              {selectedOptions.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed p-5 text-center text-xs"
                  style={{ borderColor, color: "var(--app-muted)" }}
                >
                  No one added yet. Use the search box above to add people.
                </div>
              ) : (
                <ul
                  className="rounded-xl border divide-y max-h-64 overflow-y-auto cto-scrollbar"
                  style={{ borderColor }}
                >
                  {selectedOptions.map((emp) => (
                    <li
                      key={emp.value}
                      className="flex items-center gap-3 px-3 py-2.5"
                      style={{ borderColor }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: "var(--accent-soft)",
                          color: "var(--accent)",
                        }}
                      >
                        {getInitials(emp.label) || <UserCheck size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: "var(--app-text)" }}
                        >
                          {emp.label}
                        </p>
                        <p
                          className="text-[11px] truncate"
                          style={{ color: "var(--app-muted)" }}
                        >
                          {emp.position}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEmployee(emp.value)}
                        disabled={isBusy}
                        className="p-1.5 rounded-md transition-colors disabled:opacity-50"
                        style={{ color: "#ef4444" }}
                        title="Remove"
                        onMouseEnter={(e) => {
                          if (isBusy) return;
                          e.currentTarget.style.backgroundColor =
                            "rgba(239,68,68,0.10)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
