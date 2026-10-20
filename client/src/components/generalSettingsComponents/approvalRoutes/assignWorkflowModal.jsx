// AssignWorkflowModal.jsx
// Small popup for the Employees tab: employees are already ticked there, so
// this only asks which workflow to give them.
// (Choosing employees FOR a workflow is its own page: WorkflowEmployeesPage.jsx)
import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import Modal from "../../modal";
import { assignWorkflowToEmployees } from "../../../api/approvalRoute";
import {
  FieldLabel,
  SelectInput,
  Toggle,
  Avatar,
  formatFullName,
  initialsOf,
  invalidateWorkflowQueries,
  getErrMsg,
  plural,
} from "./workflowUi";

export default function AssignWorkflowModal({
  isOpen,
  onClose,
  tokens,
  templates = [],
  presetEmployees, // [{ _id, firstName, lastName, ... }]
  onAssigned,
}) {
  const queryClient = useQueryClient();
  // The parent clears presetEmployees when it closes, so never read it directly
  const employees = Array.isArray(presetEmployees) ? presetEmployees : [];

  const [routeId, setRouteId] = useState("");
  const [resetPersonal, setResetPersonal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRouteId("");
    setResetPersonal(false);
  }, [isOpen]);

  const chosen = templates.find((t) => t._id === routeId);

  const save = async () => {
    setSaving(true);
    try {
      const data = await assignWorkflowToEmployees({
        routeId,
        employeeIds: employees.map((e) => String(e._id)),
        resetPersonal,
      });
      await invalidateWorkflowQueries(queryClient);
      const parts = [`Assigned to ${plural(data?.assigned ?? 0, "employee")}.`];
      if (data?.personalWorkflowsReset)
        parts.push(
          `Replaced ${plural(data.personalWorkflowsReset, "personal workflow")}.`,
        );
      if (data?.keepingPersonalWorkflow)
        parts.push(
          `${plural(data.keepingPersonalWorkflow, "employee")} kept their own workflow.`,
        );
      toast.success(parts.join(" "));
      onAssigned?.(data);
      onClose();
    } catch (err) {
      toast.error(getErrMsg(err, "Failed to assign workflow"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen && employees.length > 0}
      onClose={() => !saving && onClose()}
      title="Assign Workflow"
      maxWidth="max-w-xl"
      action={{
        show: true,
        label: saving
          ? "Assigning..."
          : `Assign to ${plural(employees.length, "employee")}`,
        variant: "save",
        onClick: save,
        disabled: saving || !routeId,
      }}
    >
      <div className="p-2 space-y-4">
        <div>
          <FieldLabel>Employees</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {employees.slice(0, 12).map((e) => (
              <span
                key={e._id}
                className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs"
                style={{
                  borderColor: tokens.borderColor,
                  color: "var(--app-text)",
                }}
              >
                <Avatar initials={initialsOf(e)} size={5} />
                {formatFullName(e)}
              </span>
            ))}
            {employees.length > 12 && (
              <span
                className="text-xs self-center"
                style={{ color: "var(--app-muted)" }}
              >
                +{employees.length - 12} more
              </span>
            )}
          </div>
        </div>

        <div>
          <FieldLabel required>Workflow</FieldLabel>
          <SelectInput
            tokens={tokens}
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            aria-label="Workflow"
          >
            <option value="">Select a workflow...</option>
            {templates.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </SelectInput>
          {chosen && (
            <p
              className="text-[11px] mt-1.5"
              style={{ color: "var(--app-muted)" }}
            >
              {(chosen.steps || [])
                .filter((s) => s.isEnabled !== false)
                .sort((a, b) => a.level - b.level)
                .map((s) => formatFullName(s.approver))
                .join("  →  ") || "No steps"}
            </p>
          )}
        </div>

        <div
          className="rounded-xl border p-3 flex items-start justify-between gap-3"
          style={{ borderColor: tokens.borderColor }}
        >
          <div className="min-w-0">
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              Replace personal workflows
            </div>
            <p
              className="text-[11px] mt-0.5 leading-relaxed"
              style={{ color: "var(--app-muted)" }}
            >
              {resetPersonal
                ? "Employees who built their own workflow will lose it and use this one."
                : 'Employees who built their own workflow keep using it. This becomes their default for "Use Default".'}
            </p>
          </div>
          <Toggle
            checked={resetPersonal}
            onChange={setResetPersonal}
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            label="Replace personal workflows"
          />
        </div>
      </div>
    </Modal>
  );
}
