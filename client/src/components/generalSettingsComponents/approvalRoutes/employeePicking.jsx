// employeePicking.jsx
// Pieces shared by the "choose employees" pages
// (WorkflowEmployeesPage, NotifyGroupMembersPage).
import React from "react";
import { Check, Loader2 } from "lucide-react";

import { fetchEmployeeWorkflows } from "../../../api/approvalRoute";
import { Avatar, Checkbox } from "./workflowUi";

export const initialsFromLabel = (label = "") =>
  label
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

/** Every employee in a designation/project (walks all pages). */
export async function fetchWholeGroup(scope, value) {
  const rows = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await fetchEmployeeWorkflows({
      [scope]: value,
      page,
      limit: 100,
    });
    rows.push(...(res?.items || []));
    totalPages = res?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);
  return rows;
}

/** Rows for specific employees (chunks of 100 ids per request). */
export async function fetchRowsByIds(ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 100) {
    const res = await fetchEmployeeWorkflows({
      ids: ids.slice(i, i + 100),
      page: 1,
      limit: 100,
    });
    rows.push(...(res?.items || []));
  }
  return rows;
}

/** "All employees" / "Ticked (n)" switch */
export const ViewTab = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
    style={{
      backgroundColor: active ? "var(--app-surface)" : "transparent",
      color: active ? "var(--accent)" : "var(--app-muted)",
      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
    }}
  >
    {children}
  </button>
);

/** Designation / project quick-select button. state: "all" | "some" | "none" */
export const GroupChip = ({
  label,
  count,
  state,
  loading,
  onClick,
  tokens,
}) => {
  const on = state === "all";
  const partial = state === "some";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-pressed={on}
      title={on ? `Untick everyone in ${label}` : `Tick everyone in ${label}`}
      className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-60 max-w-full"
      style={{
        backgroundColor: on
          ? "var(--accent)"
          : partial
            ? "var(--accent-soft)"
            : "var(--app-surface)",
        color: on ? "#fff" : partial ? "var(--accent)" : "var(--app-text)",
        borderColor: on || partial ? "var(--accent)" : tokens.borderColor,
      }}
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin flex-none" />
      ) : on ? (
        <Check size={12} strokeWidth={3} className="flex-none" />
      ) : partial ? (
        <span
          className="block h-0.5 w-2.5 rounded flex-none"
          style={{ backgroundColor: "var(--accent)" }}
        />
      ) : null}
      <span className="truncate">{label}</span>
      <span
        className="text-[10px] px-1.5 rounded-full flex-none"
        style={{
          backgroundColor: on
            ? "rgba(255,255,255,0.25)"
            : "var(--app-surface-2)",
          color: on ? "#fff" : "var(--app-muted)",
        }}
      >
        {count}
      </span>
    </button>
  );
};

/** One employee with a tick box. info: { _id, label, initials, position } */
export const EmployeeRow = ({ info, checked, onToggle, status, tokens }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onToggle}
    onKeyDown={(e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onToggle();
      }
    }}
    className="px-4 py-2.5 flex items-center gap-3 cursor-pointer border-b last:border-b-0 transition-colors hover:bg-[color:var(--app-surface-2)]"
    style={{
      borderColor: tokens.borderColor,
      backgroundColor: checked ? "var(--accent-soft)" : undefined,
    }}
  >
    <Checkbox
      checked={checked}
      onChange={onToggle}
      label={`Select ${info.label}`}
      borderColor={tokens.borderColor}
    />
    <Avatar initials={info.initials} size={9} />
    <div className="min-w-0 flex-1">
      <div
        className="text-sm font-semibold truncate"
        style={{ color: "var(--app-text)" }}
      >
        {info.label}
      </div>
      {info.position && (
        <div
          className="text-[11px] truncate"
          style={{ color: "var(--app-muted)" }}
        >
          {info.position}
        </div>
      )}
    </div>
    <div className="flex-none max-w-[45%] flex justify-end">{status}</div>
  </div>
);
