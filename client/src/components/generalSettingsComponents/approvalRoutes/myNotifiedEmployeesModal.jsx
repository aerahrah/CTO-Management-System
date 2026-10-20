// MyNotifiedEmployeesModal.jsx
// The employee's ONE list of notified people for their CTO/Wellness requests:
//   - Set by HR      → from notify groups. Locked when HR turned the group's
//                      lock on; otherwise removable (their own requests only,
//                      restorable any time).
//   - Default        → the default workflow's own list (locked; Customize to change).
//   - Added by you   → on their personal workflow (free to add/remove).
// Nobody can be added twice: people already notified can't be picked again.
import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Bell, X, Lock, RotateCcw, Info } from "lucide-react";

import { useAuth } from "../../../store/authStore";
import Modal from "../../modal";
import {
  updateMyNotified,
  removeMyAssignedNotified,
  restoreMyAssignedNotified,
} from "../../../api/approvalRoute";
import {
  useThemeTokens,
  Avatar,
  Chip,
  EmployeePicker,
  getErrMsg,
  formatFullName,
} from "./workflowUi";

const pid = (p) => String(p?._id || p || "");
const initialsOfEmp = (e) =>
  `${e?.firstName?.[0] || ""}${e?.lastName?.[0] || ""}`.toUpperCase() || "?";

/**
 * Everyone notified for this employee, de-duplicated.
 * Approvers are left out (they get the request anyway).
 * → { hr: [{ id, employee, groups }], workflow: [{ id, employee }], removed: [{ id, employee, groups }], count }
 */
export function myNotifiedPeople(my) {
  const workflow = my?.workflow;
  const approvers = new Set(
    (workflow?.steps || [])
      .filter((s) => s.isEnabled !== false)
      .map((s) => pid(s.approver)),
  );
  const hr = (my?.assignedNotifiedDetail || [])
    .map((p) => ({
      id: pid(p.employee),
      employee: p.employee,
      groups: p.groups || [],
      locked: p.locked !== false, // set by the group's lock toggle
    }))
    .filter((p) => p.id && !approvers.has(p.id));
  const hrIds = new Set(hr.map((p) => p.id));
  const own = (workflow?.notifiedEmployees || [])
    .map((e) => ({ id: pid(e), employee: e }))
    .filter((p) => p.id && !approvers.has(p.id) && !hrIds.has(p.id));
  const removed = (my?.removedNotified || []).map((p) => ({
    id: pid(p.employee),
    employee: p.employee,
    groups: p.groups || [],
  }));
  return { hr, workflow: own, removed, count: hr.length + own.length };
}

const Row = ({ employee, children, right, faded, tokens }) => (
  <li
    className="flex items-center gap-3 rounded-xl border px-3 py-2"
    style={{
      borderColor: tokens.borderColor,
      backgroundColor: "var(--app-surface-2)",
      opacity: faded ? 0.6 : 1,
    }}
  >
    <Avatar initials={initialsOfEmp(employee)} size={8} enabled={!faded} />
    <div className="min-w-0 flex-1">
      <div
        className="text-sm font-semibold truncate"
        style={{
          color: "var(--app-text)",
          textDecoration: faded ? "line-through" : "none",
        }}
      >
        {formatFullName(employee)}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
        {children}
      </div>
    </div>
    <div className="flex-none flex items-center gap-1.5">{right}</div>
  </li>
);

const SmallButton = ({
  onClick,
  title,
  children,
  tone = "neutral",
  tokens,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors hover:bg-[color:var(--app-surface)]"
    style={{
      borderColor: tokens.borderColor,
      color: tone === "danger" ? "#ef4444" : "var(--accent)",
      backgroundColor: "var(--app-surface)",
    }}
  >
    {children}
  </button>
);

export default function MyNotifiedEmployeesModal({
  isOpen,
  onClose,
  my, // fetchMyWorkflow() data
  employeeOptions = [], // [{ value, label, initials, position }]
  currentUserId,
}) {
  const queryClient = useQueryClient();
  const { preferences } = useAuth();
  const tokens = useThemeTokens(preferences?.theme || "system");

  const isPersonal = my?.source === "personal";
  const people = useMemo(() => myNotifiedPeople(my), [my]);

  // Pending changes, applied on Save
  const [mine, setMine] = useState([]); // ids on my personal workflow
  const [toRemove, setToRemove] = useState(() => new Set()); // HR-set ids
  const [toRestore, setToRestore] = useState(() => new Set()); // removed HR-set ids
  const [saving, setSaving] = useState(false);

  // Start fresh each time it opens
  useEffect(() => {
    if (!isOpen) return;
    setMine(people.workflow.map((p) => p.id));
    setToRemove(new Set());
    setToRestore(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const optionById = useMemo(
    () => new Map(employeeOptions.map((o) => [o.value, o])),
    [employeeOptions],
  );
  const employeeFor = (id) => {
    const known = people.workflow.find((p) => p.id === id)?.employee;
    if (known && typeof known === "object") return known;
    const o = optionById.get(id);
    if (!o) return { _id: id, firstName: "Unknown" };
    const [firstName, ...rest] = o.label.split(" ");
    return {
      _id: id,
      firstName,
      lastName: rest.join(" "),
      position: o.position,
    };
  };

  const approverIds = useMemo(
    () =>
      new Set(
        (my?.workflow?.steps || [])
          .filter((s) => s.isEnabled !== false)
          .map((s) => pid(s.approver)),
      ),
    [my],
  );
  const hrIds = useMemo(() => new Set(people.hr.map((p) => p.id)), [people]);
  const removedIds = useMemo(
    () => new Set(people.removed.map((p) => p.id)),
    [people],
  );
  const mineSet = useMemo(() => new Set(mine), [mine]);

  // Why someone can't be picked (shown in the picker)
  const reasonFor = (id) => {
    if (id === String(currentUserId)) return "That's you";
    if (approverIds.has(id)) return "Approves your request";
    if (hrIds.has(id)) return "Already notified (set by HR)";
    if (removedIds.has(id)) return "You removed them. Use Restore below";
    if (mineSet.has(id)) return "Already notified";
    return "";
  };
  const unavailable = useMemo(
    () =>
      new Set([
        String(currentUserId || ""),
        ...approverIds,
        ...hrIds,
        ...removedIds,
        ...mine,
      ]),
    [currentUserId, approverIds, hrIds, removedIds, mine],
  );

  const initialMine = people.workflow.map((p) => p.id);
  const mineChanged =
    isPersonal &&
    (mine.length !== initialMine.length ||
      mine.some((id) => !initialMine.includes(id)));
  const hasChanges = mineChanged || toRemove.size > 0 || toRestore.size > 0;

  const toggle = (setter, id) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      if (toRestore.size) await restoreMyAssignedNotified([...toRestore]);
      if (toRemove.size) await removeMyAssignedNotified([...toRemove]);
      if (mineChanged) await updateMyNotified(mine);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["myWorkflow"] }),
        queryClient.invalidateQueries({ queryKey: ["approvalRoutes"] }),
      ]);
      toast.success("Notified employees saved.");
      onClose();
    } catch (err) {
      toast.error(getErrMsg(err, "Failed to save notified employees"));
    } finally {
      setSaving(false);
    }
  };

  const ownRows = isPersonal
    ? mine.map((id) => ({
        id,
        employee: employeeFor(id),
        isNew: !initialMine.includes(id),
      }))
    : people.workflow.map((p) => ({ ...p, isNew: false }));
  const restoringRows = people.removed.filter((p) => toRestore.has(p.id));
  const removedRows = people.removed.filter((p) => !toRestore.has(p.id));
  const total =
    people.hr.length - toRemove.size + restoringRows.length + ownRows.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title="Notified Employees"
      maxWidth="max-w-2xl"
      action={{
        show: true,
        label: saving ? "Saving..." : "Save",
        variant: "save",
        onClick: save,
        disabled: saving || !hasChanges,
      }}
    >
      <div className="space-y-4 p-1">
        <p
          className="text-sm flex items-start gap-2"
          style={{ color: "var(--app-muted)" }}
        >
          <Bell
            size={16}
            className="flex-none mt-0.5"
            style={{ color: "#d97706" }}
          />
          <span>
            {total === 1 ? "1 person is" : `${total} people are`} notified when
            you file a CTO/Wellness request. They don't approve it.
          </span>
        </p>

        <ul className="space-y-2" aria-label="Notified employees">
          {/* Set by HR */}
          {[...people.hr, ...restoringRows].map((p) => {
            const removing = toRemove.has(p.id);
            const restoring = toRestore.has(p.id);
            const via = p.groups.map((g) => g.name).join(", ");
            return (
              <Row
                key={`hr-${p.id}`}
                employee={p.employee}
                faded={removing}
                tokens={tokens}
                right={
                  removing || restoring ? (
                    <SmallButton
                      tokens={tokens}
                      title={`Undo for ${formatFullName(p.employee)}`}
                      onClick={() =>
                        toggle(removing ? setToRemove : setToRestore, p.id)
                      }
                    >
                      <RotateCcw size={13} /> Undo
                    </SmallButton>
                  ) : !p.locked ? (
                    <SmallButton
                      tokens={tokens}
                      tone="danger"
                      title={`Remove ${formatFullName(p.employee)}`}
                      onClick={() => toggle(setToRemove, p.id)}
                    >
                      <X size={13} /> Remove
                    </SmallButton>
                  ) : (
                    <span
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg"
                      title="Required by HR. You can't remove this person."
                      aria-label={`${formatFullName(p.employee)} is locked`}
                      style={{ color: "var(--app-muted)" }}
                    >
                      <Lock size={14} />
                    </span>
                  )
                }
              >
                <Chip tone="amber">Set by HR</Chip>
                {via && (
                  <span
                    className="text-[11px] truncate"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {via}
                  </span>
                )}
                {removing && <Chip tone="red">Will be removed</Chip>}
                {restoring && <Chip tone="green">Will be restored</Chip>}
              </Row>
            );
          })}

          {/* Default workflow's own list (locked) or mine (editable) */}
          {ownRows.map((p) => (
            <Row
              key={`own-${p.id}`}
              employee={p.employee}
              tokens={tokens}
              right={
                isPersonal ? (
                  <SmallButton
                    tokens={tokens}
                    tone="danger"
                    title={`Remove ${formatFullName(p.employee)}`}
                    onClick={() =>
                      setMine((prev) => prev.filter((m) => m !== p.id))
                    }
                  >
                    <X size={13} /> Remove
                  </SmallButton>
                ) : (
                  <span
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg"
                    title="Part of your default workflow. Click Customize to change it."
                    aria-label={`${formatFullName(p.employee)} is locked`}
                    style={{ color: "var(--app-muted)" }}
                  >
                    <Lock size={14} />
                  </span>
                )
              }
            >
              {isPersonal ? (
                <Chip tone="violet">Added by you</Chip>
              ) : (
                <Chip tone="blue">Default workflow</Chip>
              )}
              {p.isNew && <Chip tone="green">New</Chip>}
            </Row>
          ))}

          {total === 0 && (
            <li
              className="text-sm text-center py-4"
              style={{ color: "var(--app-muted)" }}
            >
              No one is notified yet.
            </li>
          )}
        </ul>

        {/* Add my own */}
        {isPersonal ? (
          <EmployeePicker
            options={employeeOptions}
            value=""
            disabledValues={unavailable}
            disabledReason={reasonFor}
            onChange={(id) =>
              setMine((prev) => (prev.includes(id) ? prev : [...prev, id]))
            }
            placeholder="Add someone to notify..."
            tokens={tokens}
          />
        ) : (
          <p
            className="text-xs flex items-start gap-2 rounded-lg px-3 py-2 border"
            style={{
              color: "var(--app-muted)",
              borderColor: tokens.borderColor,
            }}
          >
            <Info size={14} className="flex-none mt-0.5" />
            {my?.source === "assigned"
              ? "To add your own people, click Customize first to make your own copy of the default workflow."
              : "Set up your workflow steps first, then you can add your own people."}
          </p>
        )}

        {/* HR-set people I removed */}
        {removedRows.length > 0 && (
          <div className="space-y-2">
            <div
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--app-muted)" }}
            >
              Removed from your requests
            </div>
            <ul className="space-y-2" aria-label="Removed notified employees">
              {removedRows.map((p) => (
                <Row
                  key={`rm-${p.id}`}
                  employee={p.employee}
                  faded
                  tokens={tokens}
                  right={
                    <SmallButton
                      tokens={tokens}
                      title={`Restore ${formatFullName(p.employee)}`}
                      onClick={() => toggle(setToRestore, p.id)}
                    >
                      <RotateCcw size={13} /> Restore
                    </SmallButton>
                  }
                >
                  <Chip tone="neutral">Set by HR · removed</Chip>
                  <span
                    className="text-[11px] truncate"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {p.groups.map((g) => g.name).join(", ")}
                  </span>
                </Row>
              ))}
            </ul>
          </div>
        )}

        {people.hr.some((p) => p.locked) && (
          <p
            className="text-[11px] flex items-center gap-1.5"
            style={{ color: "var(--app-muted)" }}
          >
            <Lock size={11} /> Locked people are required by HR and can't be
            removed.
          </p>
        )}
      </div>
    </Modal>
  );
}
