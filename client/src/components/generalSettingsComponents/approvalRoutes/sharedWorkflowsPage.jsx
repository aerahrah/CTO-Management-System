// SharedWorkflowsPage.jsx
// HR / admin page (permission: settings.cto_workflow_assign).
// Create shared CTO/Wellness workflows and choose who uses them:
// company default, per designation, per project, or specific employees.
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Plus,
  Layers,
  Building2,
  Briefcase,
  FolderKanban,
  Users,
  UserCheck,
  Edit2,
  Trash2,
  Star,
  Bell,
  Info,
  RotateCcw,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  Route as RouteIcon,
  ArrowRight,
  Lock,
  Unlock,
  Copy,
  Power,
  AlertTriangle,
} from "lucide-react";

import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";
import Modal from "../../modal";
import {
  fetchWorkflowTemplates,
  deleteWorkflowTemplate,
  fetchWorkflowScopeValues,
  fetchWorkflowAssignments,
  setWorkflowAssignment,
  setCompanyDefaultWorkflow,
  removeWorkflowAssignment,
  removeWorkflowAssignments,
  fetchEmployeeWorkflows,
  resetEmployeeWorkflow,
  fetchNotifyGroups,
  deleteNotifyGroup,
  fetchWorkflowSettings,
  updateWorkflowSettings,
} from "../../../api/approvalRoute";

import AssignWorkflowModal from "./assignWorkflowModal";
import {
  useThemeTokens,
  Card,
  SectionHeader,
  SoftNotice,
  InfoStrip,
  PrimaryButton,
  OutlineButton,
  IconButton,
  Toggle,
  Chip,
  SourceBadge,
  Avatar,
  Checkbox,
  SelectInput,
  SearchBox,
  SkeletonLine,
  CHIP_TONES,
  formatFullName,
  initialsOf,
  invalidateWorkflowQueries,
  getErrMsg,
  plural,
  idOf,
  useDebounced,
} from "./workflowUi";

const EMPLOYEE_PAGE_SIZE = 25;
const LIST_PATH = "/app/shared-workflows";

/* =========================
   Small pieces
========================= */
const TabButton = ({ active, onClick, icon: Icon, children, count }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors"
    style={{
      color: active ? "var(--accent)" : "var(--app-muted)",
      borderColor: active ? "var(--accent)" : "transparent",
    }}
  >
    <Icon size={15} />
    {children}
    {count !== undefined && (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full"
        style={{
          backgroundColor: active
            ? "var(--accent-soft)"
            : "var(--app-surface-2)",
          color: active ? "var(--accent)" : "var(--app-muted)",
        }}
      >
        {count}
      </span>
    )}
  </button>
);

const StatCard = ({ label, value, sub, icon: Icon, tone, tokens, loading }) => {
  const t = CHIP_TONES[tone] || CHIP_TONES.accent;
  return (
    <Card
      borderColor={tokens.borderColor}
      className="p-3 md:p-4 flex flex-col justify-between"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-widest truncate"
            style={{ color: "var(--app-muted)" }}
          >
            {label}
          </p>
          <h2
            className="text-lg md:text-2xl font-black mt-1 truncate"
            style={{ color: "var(--app-text)" }}
            title={String(value)}
          >
            {loading ? (
              <SkeletonLine width={48} height={26} theme={tokens.theme} />
            ) : (
              value
            )}
          </h2>
        </div>
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center border shrink-0"
          style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.br }}
        >
          <Icon size={18} />
        </div>
      </div>
      <p
        className="text-[10px] md:text-[11px] font-medium leading-tight mt-2 md:mt-3 truncate"
        style={{ color: "var(--app-muted)" }}
      >
        {sub}
      </p>
    </Card>
  );
};

/** Approver chain: 1 Juan → 2 Maria → 3 Pedro */
const StepChain = ({ steps = [], tokens }) => {
  const ordered = [...steps].sort((a, b) => a.level - b.level);
  if (!ordered.length)
    return (
      <span className="text-xs" style={{ color: "var(--app-muted)" }}>
        No steps
      </span>
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ordered.map((s, i) => {
        const enabled = s.isEnabled !== false;
        return (
          <React.Fragment key={`${s.level}-${idOf(s.approver)}`}>
            <span
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg border text-xs max-w-full"
              style={{
                borderColor: tokens.borderColor,
                backgroundColor: "var(--app-surface-2)",
                opacity: enabled ? 1 : 0.5,
                textDecoration: enabled ? "none" : "line-through",
              }}
              title={`${s.role || "No role"}${enabled ? "" : " (turned off)"}`}
            >
              <span
                className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-none"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                {s.level}
              </span>
              <span
                className="font-semibold truncate"
                style={{ color: "var(--app-text)" }}
              >
                {formatFullName(s.approver)}
              </span>
              {s.role && (
                <span
                  className="hidden sm:inline text-[10px] truncate"
                  style={{ color: "var(--app-muted)" }}
                >
                  · {s.role}
                </span>
              )}
            </span>
            {i < ordered.length - 1 && (
              <ArrowRight size={12} style={{ color: "var(--app-muted)" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* =========================
   Workflows tab
========================= */
const WorkflowCard = ({
  template,
  tokens,
  busy,
  onEdit,
  onAssign,
  onNotified,
  onDuplicate,
  onMakeDefault,
  onDelete,
}) => {
  const counts = template.assignmentCounts || {};
  const notifiedCount = template.notifiedEmployees?.length || 0;
  return (
    <Card
      borderColor={tokens.borderColor}
      className="flex flex-col"
      style={{
        borderLeft: `4px solid ${template.isCompanyDefault ? "#16a34a" : "var(--accent)"}`,
      }}
    >
      <div className="p-4 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="text-base font-bold break-words"
              style={{ color: "var(--app-text)" }}
            >
              {template.name}
            </h3>
            {template.description && (
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--app-muted)" }}
              >
                {template.description}
              </p>
            )}
          </div>
          {template.isCompanyDefault && (
            <Chip tone="green">
              <Star size={10} /> Company default
            </Chip>
          )}
        </div>

        <StepChain steps={template.steps} tokens={tokens} />

        <div className="flex flex-wrap gap-1.5">
          {counts.designation ? (
            <Chip tone="violet">
              {plural(counts.designation, "designation")}
            </Chip>
          ) : null}
          {counts.project ? (
            <Chip tone="blue">{plural(counts.project, "project")}</Chip>
          ) : null}
          {counts.employee ? (
            <Chip tone="accent">{plural(counts.employee, "employee")}</Chip>
          ) : null}
          {!counts.designation &&
            !counts.project &&
            !counts.employee &&
            !template.isCompanyDefault && (
              <Chip tone="neutral">Not assigned yet</Chip>
            )}
        </div>
      </div>

      <div
        className="border-t px-3 py-2.5 flex flex-wrap items-center gap-2"
        style={{ borderColor: tokens.borderColor }}
      >
        <PrimaryButton
          onClick={onAssign}
          disabled={busy}
          borderColor={tokens.borderColor}
          theme={tokens.theme}
          className="flex-1 !py-1.5 !text-xs"
        >
          <Users size={14} /> Employees
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.22)" }}
          >
            {counts.employee || 0}
          </span>
        </PrimaryButton>
        <OutlineButton
          onClick={onNotified}
          disabled={busy}
          borderColor={tokens.borderColor}
          theme={tokens.theme}
          className="flex-1 !py-1.5 !text-xs"
          title={
            notifiedCount
              ? `Notifies: ${(template.notifiedEmployees || []).map(formatFullName).join(", ")}`
              : "No one is notified yet"
          }
        >
          <Bell size={14} /> Notified
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--accent-soft)" }}
          >
            {notifiedCount}
          </span>
        </OutlineButton>
        <OutlineButton
          onClick={onEdit}
          disabled={busy}
          borderColor={tokens.borderColor}
          theme={tokens.theme}
          className="flex-1 !py-1.5 !text-xs"
        >
          <Edit2 size={14} /> Edit
        </OutlineButton>
        <IconButton
          title="Duplicate workflow"
          onClick={onDuplicate}
          disabled={busy}
          borderColor={tokens.borderColor}
        >
          <Copy size={14} />
        </IconButton>
        {!template.isCompanyDefault && (
          <IconButton
            title="Make company default"
            tone="accent"
            onClick={onMakeDefault}
            disabled={busy}
            borderColor={tokens.borderColor}
          >
            <Star size={14} />
          </IconButton>
        )}
        <IconButton
          title="Delete workflow"
          tone="danger"
          onClick={onDelete}
          disabled={busy}
          borderColor={tokens.borderColor}
        >
          <Trash2 size={14} />
        </IconButton>
      </div>
    </Card>
  );
};

/* =========================
   By Designation / By Project tab
========================= */
const ScopeRulesTab = ({ scope, query, templates, tokens }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const scopeLabel = scope === "project" ? "Project" : "Designation";

  const mutation = useMutation({
    mutationFn: ({ value, routeId, assignmentId }) =>
      routeId
        ? setWorkflowAssignment({ scope, value, routeId })
        : removeWorkflowAssignment(assignmentId),
    onSuccess: (data, vars) => {
      invalidateWorkflowQueries(queryClient);
      toast.success(
        vars.routeId
          ? `${scopeLabel} workflow saved.`
          : `${scopeLabel} rule removed.`,
      );
    },
    onError: (err) => toast.error(getErrMsg(err, "Failed to save")),
  });

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = query.data || [];
    return q
      ? list.filter((r) => String(r.label).toLowerCase().includes(q))
      : list;
  }, [query.data, search]);

  const ruleCount = (query.data || []).filter((r) => r.assignment).length;

  return (
    <Card borderColor={tokens.borderColor}>
      <div
        className="px-4 sm:px-5 py-4 border-b"
        style={{ borderColor: tokens.borderColor }}
      >
        <SectionHeader
          icon={scope === "project" ? FolderKanban : Briefcase}
          tone={scope === "project" ? "blue" : "violet"}
          title={`Workflow per ${scopeLabel.toLowerCase()}`}
          subtitle={`${ruleCount} of ${plural((query.data || []).length, scopeLabel.toLowerCase())} have a workflow`}
          right={
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder={`Search ${scopeLabel.toLowerCase()}...`}
              tokens={tokens}
              className="w-full sm:w-64"
            />
          }
        />
      </div>

      <div className="p-3 sm:p-4">
        <InfoStrip icon={Info} tone="neutral" theme={tokens.theme}>
          {scope === "project"
            ? "Applies to everyone on the project, including people added later. A project rule wins over a designation rule."
            : "Applies to everyone with the designation, including new hires. Project rules and workflows assigned directly to an employee win over this."}{" "}
          Employees with their own personal workflow keep it until they click
          "Use Default".
        </InfoStrip>
      </div>

      {query.isLoading ? (
        <div className="px-4 pb-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <SkeletonLine
              key={i}
              height={44}
              theme={tokens.theme}
              rounded="rounded-lg"
            />
          ))}
        </div>
      ) : query.isError ? (
        <div className="px-4 pb-6">
          <SoftNotice
            icon={Info}
            tone="amber"
            title={`Couldn't load ${scopeLabel.toLowerCase()}s`}
            theme={tokens.theme}
          >
            {getErrMsg(query.error)}
          </SoftNotice>
        </div>
      ) : rows.length === 0 ? (
        <div
          className="p-8 text-center text-sm"
          style={{ color: "var(--app-muted)" }}
        >
          {search
            ? `No ${scopeLabel.toLowerCase()}s match "${search}".`
            : `No ${scopeLabel.toLowerCase()}s found.`}
        </div>
      ) : (
        <div>
          <div
            className="hidden md:grid grid-cols-[1fr_120px_minmax(240px,320px)] gap-4 px-5 py-2.5 text-[10px] uppercase tracking-[0.12em] font-bold border-y"
            style={{
              color: "var(--app-muted)",
              borderColor: tokens.borderColor,
              backgroundColor: "var(--app-surface-2)",
            }}
          >
            <span>{scopeLabel}</span>
            <span>Employees</span>
            <span>Workflow</span>
          </div>
          {rows.map((row) => {
            const saving =
              mutation.isPending && mutation.variables?.value === row.value;
            const current = row.assignment?.route?._id || "";
            return (
              <div
                key={row.value}
                className="grid grid-cols-1 md:grid-cols-[1fr_120px_minmax(240px,320px)] gap-2 md:gap-4 items-center px-4 md:px-5 py-3 border-b last:border-b-0"
                style={{ borderColor: tokens.borderColor }}
              >
                <div className="min-w-0">
                  <div
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--app-text)" }}
                  >
                    {row.label}
                  </div>
                </div>
                <div className="text-xs" style={{ color: "var(--app-muted)" }}>
                  {plural(row.employeeCount, "employee")}
                </div>
                <SelectInput
                  tokens={tokens}
                  value={current}
                  disabled={saving}
                  aria-label={`Workflow for ${row.label}`}
                  onChange={(e) =>
                    mutation.mutate({
                      value: row.value,
                      routeId: e.target.value,
                      assignmentId: row.assignment?._id,
                    })
                  }
                >
                  <option value="">— No rule (falls back) —</option>
                  {templates.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

/* =========================
   Employees tab
========================= */
const matchedText = (m, labelMaps) => {
  if (!m) return "No rule matches";
  if (m.scope === "employee") return "Assigned directly";
  if (m.scope === "global") return "Company default";
  const label = labelMaps[m.scope]?.get(m.value) || m.label || m.value;
  return `${m.scope === "project" ? "Project" : "Designation"}: ${label}`;
};

const viaText = (row, labelMaps) =>
  matchedText(row.defaultMatchedBy, labelMaps);

const designationOf = (emp, labelMaps) => {
  const d = emp?.designation;
  if (!d) return "—";
  if (typeof d === "object" && d.name) return d.name;
  return labelMaps.designation?.get(idOf(d)) || "—";
};

const EmployeesTab = ({
  tokens,
  designationOptions,
  projectOptions,
  labelMaps,
  onAssign,
  askConfirm,
}) => {
  const queryClient = useQueryClient();
  const [designation, setDesignation] = useState("");
  const [project, setProject] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Map());
  const debouncedSearch = useDebounced(search);

  const params = {
    designation: designation || undefined,
    project: project || undefined,
    search: debouncedSearch || undefined,
    page,
    limit: EMPLOYEE_PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: ["employeeWorkflows", "tab", params],
    queryFn: () => fetchEmployeeWorkflows(params),
    placeholderData: (prev) => prev,
  });

  const items = query.data?.items || [];
  const total = query.data?.total || 0;
  const totalPages = query.data?.totalPages || 1;
  const pageIds = items.map((i) => String(i.employee._id));
  const allOnPage =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));

  const setFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const toggle = (emp) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const id = String(emp._id);
      next.has(id) ? next.delete(id) : next.set(id, emp);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else items.forEach((i) => next.set(String(i.employee._id), i.employee));
      return next;
    });

  const refresh = () => invalidateWorkflowQueries(queryClient);

  const confirmReset = (row) =>
    askConfirm({
      title: "Reset to default",
      label: "Reset",
      variant: "delete",
      body: (
        <>
          <b>{formatFullName(row.employee)}</b>'s personal workflow will be
          deleted. They'll use <b>{row.defaultWorkflow?.name}</b> (
          {viaText(row, labelMaps).toLowerCase()}).
        </>
      ),
      run: async () => {
        await resetEmployeeWorkflow(row.employee._id);
        toast.success("Switched to the default workflow.");
        refresh();
      },
    });

  const confirmUnassign = (row) =>
    askConfirm({
      title: "Remove direct assignment",
      label: "Remove",
      variant: "delete",
      body: (() => {
        const current = row.defaultWorkflow;
        const fallback = row.fallbackWorkflow;
        const fallbackVia = matchedText(
          row.fallbackMatchedBy,
          labelMaps,
        ).toLowerCase();
        return (
          <>
            <b>{formatFullName(row.employee)}</b> will no longer be assigned{" "}
            <b>{current?.name}</b> directly.{" "}
            {!fallback ? (
              <>
                They'll have <b>no workflow</b> until one is assigned, so they
                can't file CTO/Wellness requests.
              </>
            ) : idOf(fallback._id) === idOf(current?._id) ? (
              <>
                They'll <b>still get {fallback.name}</b> through the{" "}
                {fallbackVia}, so nothing changes for them. To give them a
                different workflow, assign that one instead.
              </>
            ) : (
              <>
                They'll use <b>{fallback.name}</b> ({fallbackVia}).
              </>
            )}
            {row.source === "personal" &&
              " They keep their own personal workflow either way."}
          </>
        );
      })(),
      run: async () => {
        await removeWorkflowAssignment(row.defaultMatchedBy.assignmentId);
        toast.success("Direct assignment removed.");
        refresh();
      },
    });

  const confirmBulkUnassign = () =>
    askConfirm({
      title: "Remove direct assignments",
      label: "Remove",
      variant: "delete",
      body: (
        <>
          Remove the directly assigned workflow from{" "}
          <b>{plural(selected.size, "employee")}</b>? They'll fall back to their
          project, designation or company default. Employees without a direct
          assignment are not affected.
        </>
      ),
      run: async () => {
        const res = await removeWorkflowAssignments({
          employeeIds: [...selected.keys()],
        });
        toast.success(`${plural(res?.deleted ?? 0, "assignment")} removed.`);
        setSelected(new Map());
        refresh();
      },
    });

  return (
    <Card borderColor={tokens.borderColor}>
      <div
        className="px-4 sm:px-5 py-4 border-b space-y-3"
        style={{ borderColor: tokens.borderColor }}
      >
        <SectionHeader
          icon={Users}
          tone="blue"
          title="Employees"
          subtitle={
            query.isLoading
              ? "Loading..."
              : `${plural(total, "employee")} · the workflow each one uses right now`
          }
        />
        <div
          className={`grid grid-cols-1 ${projectOptions.length ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-2`}
        >
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name..."
            tokens={tokens}
            tall
          />
          <SelectInput
            tokens={tokens}
            value={designation}
            onChange={setFilter(setDesignation)}
            aria-label="Filter by designation"
          >
            <option value="">All designations</option>
            {designationOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </SelectInput>
          {projectOptions.length > 0 && (
            <SelectInput
              tokens={tokens}
              value={project}
              onChange={setFilter(setProject)}
              aria-label="Filter by project"
            >
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </SelectInput>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div
          className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-2 border-b"
          style={{
            borderColor: tokens.borderColor,
            backgroundColor: "var(--accent-soft)",
          }}
        >
          <span
            className="text-sm font-bold mr-auto"
            style={{ color: "var(--accent)" }}
          >
            {plural(selected.size, "employee")} selected
          </span>
          <PrimaryButton
            onClick={() =>
              onAssign([...selected.values()], () => setSelected(new Map()))
            }
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="!py-1.5 !text-xs"
          >
            <UserCheck size={14} /> Assign workflow
          </PrimaryButton>
          <OutlineButton
            onClick={confirmBulkUnassign}
            tone="danger"
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="!py-1.5 !text-xs"
          >
            <UserMinus size={14} /> Remove direct
          </OutlineButton>
          <OutlineButton
            onClick={() => setSelected(new Map())}
            tone="neutral"
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="!py-1.5 !text-xs"
          >
            Clear
          </OutlineButton>
        </div>
      )}

      {/* Header row */}
      <div
        className="hidden lg:grid grid-cols-[28px_minmax(200px,1.2fr)_minmax(140px,0.8fr)_minmax(220px,1.4fr)_220px] gap-4 px-5 py-2.5 text-[10px] uppercase tracking-[0.12em] font-bold border-b items-center"
        style={{
          color: "var(--app-muted)",
          borderColor: tokens.borderColor,
          backgroundColor: "var(--app-surface-2)",
        }}
      >
        <Checkbox
          checked={allOnPage}
          indeterminate={!allOnPage && someOnPage}
          onChange={togglePage}
          disabled={!items.length}
          label="Select all on this page"
          borderColor={tokens.borderColor}
        />
        <span>Employee</span>
        <span>Designation</span>
        <span>Current workflow</span>
        <span className="text-right">Actions</span>
      </div>

      {query.isLoading ? (
        <div className="p-4 space-y-2">
          {[...Array(6)].map((_, i) => (
            <SkeletonLine
              key={i}
              height={48}
              theme={tokens.theme}
              rounded="rounded-lg"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="p-8 text-center text-sm"
          style={{ color: "var(--app-muted)" }}
        >
          No employees match these filters.
        </div>
      ) : (
        items.map((row) => {
          const emp = row.employee;
          const id = String(emp._id);
          const directlyAssigned = row.defaultMatchedBy?.scope === "employee";
          return (
            <div
              key={id}
              className="grid grid-cols-[28px_1fr] lg:grid-cols-[28px_minmax(200px,1.2fr)_minmax(140px,0.8fr)_minmax(220px,1.4fr)_220px] gap-x-3 lg:gap-x-4 gap-y-2 px-4 lg:px-5 py-3 border-b last:border-b-0 items-center"
              style={{
                borderColor: tokens.borderColor,
                backgroundColor: selected.has(id)
                  ? "var(--accent-soft)"
                  : undefined,
              }}
            >
              <Checkbox
                checked={selected.has(id)}
                onChange={() => toggle(emp)}
                label={`Select ${formatFullName(emp)}`}
                borderColor={tokens.borderColor}
              />

              <div className="flex items-center gap-3 min-w-0">
                <Avatar initials={initialsOf(emp)} />
                <div className="min-w-0">
                  <div
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--app-text)" }}
                  >
                    {formatFullName(emp)}
                  </div>
                  <div
                    className="text-[11px] truncate"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {emp.position || "—"}
                    <span className="lg:hidden">
                      {" "}
                      · {designationOf(emp, labelMaps)}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="hidden lg:block text-xs truncate"
                style={{ color: "var(--app-text)" }}
              >
                {designationOf(emp, labelMaps)}
              </div>

              <div className="col-start-2 lg:col-start-auto min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <SourceBadge source={row.source} />
                  <span
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--app-text)" }}
                  >
                    {row.workflow?.name || "—"}
                  </span>
                </div>
                <div
                  className="text-[11px] mt-0.5 truncate"
                  style={{ color: "var(--app-muted)" }}
                >
                  {row.source === "personal"
                    ? row.defaultWorkflow
                      ? `Default would be: ${row.defaultWorkflow.name}`
                      : "No default set for them"
                    : viaText(row, labelMaps)}
                </div>
                {row.notifyGroups?.length > 0 && (
                  <div
                    className="text-[11px] mt-0.5 flex items-center gap-1 min-w-0"
                    style={{ color: "#d97706" }}
                  >
                    <Bell size={11} className="flex-none" />
                    <span className="truncate">
                      Notify: {row.notifyGroups.map((g) => g.name).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              <div className="col-start-2 lg:col-start-auto flex flex-wrap lg:justify-end gap-1.5">
                <OutlineButton
                  onClick={() => onAssign([emp])}
                  borderColor={tokens.borderColor}
                  theme={tokens.theme}
                  className="!px-2.5 !py-1 !text-xs"
                >
                  <UserCheck size={13} /> Assign
                </OutlineButton>
                {row.source === "personal" && (
                  <OutlineButton
                    onClick={() => confirmReset(row)}
                    disabled={!row.canResetToDefault}
                    title={
                      row.canResetToDefault
                        ? "Delete their personal workflow"
                        : row.sharedWorkflowsEnabled === false
                          ? "Shared workflows are off, so there's no default to fall back to"
                          : "No default workflow to fall back to"
                    }
                    tone="neutral"
                    borderColor={tokens.borderColor}
                    theme={tokens.theme}
                    className="!px-2.5 !py-1 !text-xs"
                  >
                    <RotateCcw size={13} /> Reset
                  </OutlineButton>
                )}
                {directlyAssigned && (
                  <IconButton
                    title="Remove direct assignment"
                    tone="danger"
                    onClick={() => confirmUnassign(row)}
                    borderColor={tokens.borderColor}
                  >
                    <UserMinus size={14} />
                  </IconButton>
                )}
              </div>
            </div>
          );
        })
      )}

      {totalPages > 1 && (
        <div
          className="px-4 sm:px-5 py-3 flex items-center justify-between border-t"
          style={{ borderColor: tokens.borderColor }}
        >
          <span className="text-xs" style={{ color: "var(--app-muted)" }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1.5">
            <IconButton
              title="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              borderColor={tokens.borderColor}
            >
              <ChevronLeft size={14} />
            </IconButton>
            <IconButton
              title="Next page"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              borderColor={tokens.borderColor}
            >
              <ChevronRight size={14} />
            </IconButton>
          </div>
        </div>
      )}
    </Card>
  );
};

/* =========================
   Page
========================= */
/* =========================
   Notify Groups tab
========================= */
const NotifyGroupsTab = ({ tokens, askConfirm }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifyGroups"],
    queryFn: fetchNotifyGroups,
  });
  const groups = query.data || [];
  const goNew = () => navigate(`${LIST_PATH}/notify/new`);

  const confirmDelete = (g) =>
    askConfirm({
      title: "Delete notify group",
      label: "Delete",
      variant: "delete",
      body: (
        <>
          Delete <b>{g.name}</b>?{" "}
          {g.memberCount
            ? `Its ${plural(g.memberCount, "employee")} will stop notifying ${(g.notifiedEmployees || []).map(formatFullName).join(", ")}.`
            : "It isn't used by any employee."}
        </>
      ),
      run: async () => {
        await deleteNotifyGroup(g._id);
        toast.success("Notify group deleted.");
        invalidateWorkflowQueries(queryClient);
      },
    });

  return (
    <div className="space-y-4">
      <InfoStrip
        icon={Bell}
        tone="amber"
        theme={tokens.theme}
        title="Who gets notified, per employee"
        right={
          <PrimaryButton
            onClick={goNew}
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="!py-1.5 !text-xs"
          >
            <Plus size={14} /> New Notify Group
          </PrimaryButton>
        }
      >
        A notify group is a list of people to notify (they don't approve).
        Choose which employees each group is for. An employee can be in several
        groups. They're added on top of the people notified by the employee's
        workflow.
      </InfoStrip>

      {query.isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <SkeletonLine
              key={i}
              height={150}
              theme={tokens.theme}
              rounded="rounded-xl"
            />
          ))}
        </div>
      ) : query.isError ? (
        <SoftNotice
          icon={Info}
          tone="amber"
          title="Couldn't load notify groups"
          theme={tokens.theme}
        >
          {getErrMsg(query.error)}
        </SoftNotice>
      ) : groups.length === 0 ? (
        <SoftNotice
          icon={Bell}
          title="No notify groups yet"
          theme={tokens.theme}
          action={
            <PrimaryButton
              onClick={goNew}
              borderColor={tokens.borderColor}
              theme={tokens.theme}
            >
              <Plus size={16} /> Create the first one
            </PrimaryButton>
          }
        >
          For example "HR Team" (notify the HR officers) for everyone, and
          "Bridge Supervisors" just for the Bridge Project.
        </SoftNotice>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {groups.map((g) => (
            <Card
              key={g._id}
              borderColor={tokens.borderColor}
              className="flex flex-col"
              style={{ borderLeft: "4px solid #d97706" }}
            >
              <div className="p-4 flex-1 space-y-3">
                <div className="min-w-0">
                  <h3
                    className="text-base font-bold break-words"
                    style={{ color: "var(--app-text)" }}
                  >
                    {g.name}
                  </h3>
                  {g.description && (
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {g.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider mr-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Notifies
                  </span>
                  {(g.notifiedEmployees || []).map((e) => (
                    <span
                      key={idOf(e)}
                      className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border text-xs"
                      style={{
                        borderColor: tokens.borderColor,
                        color: "var(--app-text)",
                      }}
                    >
                      <Avatar initials={initialsOf(e)} size={5} />
                      {formatFullName(e)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.memberCount ? (
                    <Chip tone="accent">
                      {plural(g.memberCount, "employee")}
                    </Chip>
                  ) : (
                    <Chip tone="neutral">No employees yet</Chip>
                  )}
                  {g.locked !== false ? (
                    <Chip
                      tone="amber"
                      title="Employees can't remove these people from their requests"
                    >
                      <Lock size={10} /> Locked
                    </Chip>
                  ) : (
                    <Chip
                      tone="neutral"
                      title="Each employee can remove these people from their own requests"
                    >
                      <Unlock size={10} /> Employees can remove
                    </Chip>
                  )}
                </div>
              </div>
              <div
                className="border-t px-3 py-2.5 flex flex-wrap items-center gap-2"
                style={{ borderColor: tokens.borderColor }}
              >
                <PrimaryButton
                  onClick={() =>
                    navigate(`${LIST_PATH}/notify/${g._id}/employees`)
                  }
                  borderColor={tokens.borderColor}
                  theme={tokens.theme}
                  className="flex-1 !py-1.5 !text-xs"
                >
                  <Users size={14} /> Employees
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "rgba(255,255,255,0.22)" }}
                  >
                    {g.memberCount || 0}
                  </span>
                </PrimaryButton>
                <OutlineButton
                  onClick={() => navigate(`${LIST_PATH}/notify/${g._id}/edit`)}
                  borderColor={tokens.borderColor}
                  theme={tokens.theme}
                  className="flex-1 !py-1.5 !text-xs"
                >
                  <Edit2 size={14} /> Edit
                </OutlineButton>
                <IconButton
                  title="Delete notify group"
                  tone="danger"
                  onClick={() => confirmDelete(g)}
                  borderColor={tokens.borderColor}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SharedWorkflowsPage() {
  const queryClient = useQueryClient();
  const { preferences } = useAuth();
  const tokens = useThemeTokens(preferences?.theme || "system");

  const navigate = useNavigate();
  const location = useLocation();
  // pages under /notify come back here with { tab: "notify" }
  const [tab, setTab] = useState(() => location.state?.tab || "workflows");
  const goToNew = () => navigate(`${LIST_PATH}/new`);
  const goToEdit = (t) => navigate(`${LIST_PATH}/${t._id}/edit`);
  const [assign, setAssign] = useState({
    open: false,
    presetEmployees: null,
    onDone: null,
  });
  const [confirm, setConfirm] = useState(null); // { title, body, label, variant, run }
  const [confirmBusy, setConfirmBusy] = useState(false);

  /* ---- data ---- */
  const templatesQuery = useQuery({
    queryKey: ["workflowTemplates"],
    queryFn: fetchWorkflowTemplates,
  });
  const designationQuery = useQuery({
    queryKey: ["workflowScopeValues", "designation"],
    queryFn: () => fetchWorkflowScopeValues("designation"),
    retry: false,
  });
  const projectQuery = useQuery({
    queryKey: ["workflowScopeValues", "project"],
    queryFn: () => fetchWorkflowScopeValues("project"),
    retry: false, // errors if the server has project scope turned off; the tab just hides
  });
  const globalQuery = useQuery({
    queryKey: ["workflowAssignments", "global"],
    queryFn: () => fetchWorkflowAssignments({ scope: "global" }),
  });

  const settingsQuery = useQuery({
    queryKey: ["workflowSettings"],
    queryFn: fetchWorkflowSettings,
  });
  const settings = settingsQuery.data;
  const sharedOn = settings?.sharedWorkflowsEnabled !== false;

  const templates = templatesQuery.data || [];
  const companyDefault = globalQuery.data?.[0] || null;
  const projectsAvailable = !projectQuery.isError;

  // { value, label, count } — count drives the quick-select buttons in the Employees modal
  const designationOptions = useMemo(
    () =>
      (designationQuery.data || []).map((d) => ({
        value: d.value,
        label: d.label,
        count: d.employeeCount,
      })),
    [designationQuery.data],
  );
  const projectOptions = useMemo(
    () =>
      projectsAvailable
        ? (projectQuery.data || []).map((p) => ({
            value: p.value,
            label: p.label,
            count: p.employeeCount,
          }))
        : [],
    [projectQuery.data, projectsAvailable],
  );
  const labelMaps = useMemo(
    () => ({
      designation: new Map(designationOptions.map((d) => [d.value, d.label])),
      project: new Map(projectOptions.map((p) => [p.value, p.label])),
    }),
    [designationOptions, projectOptions],
  );

  /* ---- company default ---- */
  const defaultMutation = useMutation({
    mutationFn: (routeId) =>
      routeId
        ? setCompanyDefaultWorkflow(routeId)
        : removeWorkflowAssignment(companyDefault._id),
    onSuccess: (_, routeId) => {
      invalidateWorkflowQueries(queryClient);
      toast.success(
        routeId ? "Company default updated." : "Company default removed.",
      );
    },
    onError: (err) =>
      toast.error(getErrMsg(err, "Failed to update company default")),
  });

  const changeCompanyDefault = (routeId) => {
    if (routeId) return defaultMutation.mutate(routeId);
    if (!companyDefault) return;
    askConfirm({
      title: "Remove company default",
      label: "Remove",
      variant: "delete",
      body: "Employees with no personal workflow and no employee, project or designation rule will have no workflow, so they won't be able to file CTO/Wellness requests until one is set.",
      run: () => defaultMutation.mutateAsync(""),
    });
  };

  /* ---- use shared workflows (on/off) ---- */
  const settingsMutation = useMutation({
    mutationFn: (enabled) =>
      updateWorkflowSettings({ sharedWorkflowsEnabled: enabled }),
    onSuccess: async (res) => {
      await invalidateWorkflowQueries(queryClient);
      toast.success(res?.message || "Settings saved.");
    },
    onError: (err) => toast.error(getErrMsg(err, "Failed to update settings")),
  });

  const changeSharedWorkflows = (enabled) => {
    if (enabled) return settingsMutation.mutate(true); // turning on is always safe
    const without = settings?.withoutPersonalWorkflow ?? 0;
    askConfirm({
      title: "Turn off shared workflows?",
      label: "Turn Off",
      variant: "delete",
      body: (
        <>
          Every employee will use only their own personal workflow.{" "}
          {without > 0 ? (
            <>
              <b>{plural(without, "employee")}</b>{" "}
              {without === 1 ? "doesn't" : "don't"} have one yet, so they can't
              file CTO/Wellness requests until they set one up.
            </>
          ) : (
            "Everyone already has their own."
          )}{" "}
          Your workflows and assignments are kept and apply again when you turn
          this back on.
        </>
      ),
      run: () => settingsMutation.mutateAsync(false),
    });
  };

  /* ---- confirm modal ---- */
  const askConfirm = (cfg) => setConfirm(cfg);
  const runConfirm = async () => {
    if (!confirm?.run) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
      setConfirm(null);
    } catch (err) {
      toast.error(getErrMsg(err, "Something went wrong"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmDelete = (t) => {
    const counts = t.assignmentCounts || {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    askConfirm({
      title: "Delete workflow",
      label: "Delete",
      variant: "delete",
      body: total ? (
        <>
          <b>{t.name}</b> is in use (
          {[
            t.isCompanyDefault && "company default",
            counts.designation && plural(counts.designation, "designation"),
            counts.project && plural(counts.project, "project"),
            counts.employee && plural(counts.employee, "employee"),
          ]
            .filter(Boolean)
            .join(", ")}
          ). Deleting it removes those assignments, and the people affected fall
          back to their next matching workflow.
        </>
      ) : (
        <>
          Delete <b>{t.name}</b>? It isn't assigned to anyone.
        </>
      ),
      run: async () => {
        await deleteWorkflowTemplate(t._id, { force: total > 0 });
        toast.success("Workflow deleted.");
        invalidateWorkflowQueries(queryClient);
      },
    });
  };

  // Employees tab: people already ticked → small popup to pick their workflow
  const openAssign = (opts) =>
    setAssign({ open: true, presetEmployees: null, onDone: null, ...opts });

  /* ---- stats ---- */
  const designationRules = (designationQuery.data || []).filter(
    (d) => d.assignment,
  ).length;
  const directAssignments = templates.reduce(
    (sum, t) => sum + (t.assignmentCounts?.employee || 0),
    0,
  );
  const statsLoading = templatesQuery.isLoading || globalQuery.isLoading;

  const stats = [
    {
      label: "Shared workflows",
      value: templates.length,
      sub: "Available to assign",
      icon: Layers,
      tone: "accent",
    },
    {
      label: "Company default",
      value: companyDefault?.route?.name || "Not set",
      sub: companyDefault
        ? "Used when nothing else matches"
        : "Set one so nobody is left without",
      icon: Star,
      tone: companyDefault ? "green" : "amber",
    },
    {
      label: "Designation rules",
      value: designationQuery.isLoading
        ? "…"
        : `${designationRules}/${(designationQuery.data || []).length}`,
      sub: "Designations with a workflow",
      icon: Briefcase,
      tone: "violet",
    },
    {
      label: "Direct assignments",
      value: directAssignments,
      sub: "Employees assigned one by one",
      icon: UserCheck,
      tone: "blue",
    },
  ];

  return (
    <div
      className="flex-1 w-full h-full flex flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="flex-1 overflow-y-auto w-full cto-scrollbar pb-24 touch-pan-y">
        <div className="px-3 py-4 md:px-6 max-w-[1600px] mx-auto w-full">
          <Breadcrumbs
            rootLabel="HOME"
            rootTo="/app"
            items={[{ label: "SHARED WORKFLOWS", to: "/app/shared-workflows" }]}
          />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2 mb-5">
            <div className="min-w-0">
              <h1
                className="text-2xl md:text-3xl font-bold tracking-tight"
                style={{ color: "var(--app-text)" }}
              >
                Shared Workflows
              </h1>
              <p
                className="text-sm mt-1 max-w-2xl"
                style={{ color: "var(--app-muted)" }}
              >
                Create CTO/Wellness approval workflows and choose who uses them.
                Employees who built their own workflow keep it until they click
                "Use Default".
              </p>
            </div>
            <PrimaryButton
              onClick={goToNew}
              borderColor={tokens.borderColor}
              theme={tokens.theme}
              className="w-full md:w-auto"
            >
              <Plus className="w-4 h-4" /> New Workflow
            </PrimaryButton>
          </div>

          {/* Use shared workflows: on/off */}
          <Card borderColor={tokens.borderColor} className="mb-4">
            <div className="px-4 sm:px-5 py-4">
              <SectionHeader
                icon={Power}
                tone={sharedOn ? "green" : "amber"}
                title="Use shared workflows"
                subtitle={
                  sharedOn
                    ? "On: employees use the workflow assigned to them until they make their own."
                    : "Off: every employee uses only their own personal workflow."
                }
                right={
                  <div className="flex items-center gap-2.5">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: sharedOn ? "#16a34a" : "#d97706" }}
                    >
                      {settingsQuery.isLoading ? "…" : sharedOn ? "On" : "Off"}
                    </span>
                    <Toggle
                      checked={sharedOn}
                      disabled={
                        settingsQuery.isLoading || settingsMutation.isPending
                      }
                      onChange={changeSharedWorkflows}
                      borderColor={tokens.borderColor}
                      theme={tokens.theme}
                      label="Use shared workflows"
                    />
                  </div>
                }
              />
            </div>
          </Card>

          {!sharedOn && (
            <div className="mb-4">
              <InfoStrip
                icon={AlertTriangle}
                tone="amber"
                theme={tokens.theme}
                title="Shared workflows are off"
              >
                {settings?.withoutPersonalWorkflow
                  ? `${plural(settings.withoutPersonalWorkflow, "employee")} ${settings.withoutPersonalWorkflow === 1 ? "doesn't" : "don't"} have their own workflow yet, so they can't file CTO/Wellness requests until they set one up. `
                  : "Everyone uses their own workflow. "}
                You can still edit workflows and assignments here. They apply
                again when you turn this back on.
              </InfoStrip>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            {stats.map((s) => (
              <StatCard
                key={s.label}
                {...s}
                tokens={tokens}
                loading={statsLoading}
              />
            ))}
          </div>

          {/* Company default */}
          <Card
            borderColor={tokens.borderColor}
            className="mb-4"
            style={{ opacity: sharedOn ? 1 : 0.6 }}
          >
            <div className="px-4 sm:px-5 py-4">
              <SectionHeader
                icon={Building2}
                tone={companyDefault ? "green" : "amber"}
                title="Company default"
                subtitle="Used by anyone with no personal workflow and no employee, project or designation rule."
                right={
                  <SelectInput
                    tokens={tokens}
                    value={companyDefault?.route?._id || ""}
                    disabled={defaultMutation.isPending || !templates.length}
                    onChange={(e) => changeCompanyDefault(e.target.value)}
                    className="sm:!w-72"
                    aria-label="Company default workflow"
                  >
                    <option value="">
                      {templates.length
                        ? "— Not set —"
                        : "Create a workflow first"}
                    </option>
                    {templates.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </SelectInput>
                }
              />
            </div>
          </Card>

          {/* Precedence explainer */}
          <div className="mb-4">
            <InfoStrip
              icon={RouteIcon}
              tone="violet"
              theme={tokens.theme}
              title="Which workflow an employee gets"
            >
              {sharedOn
                ? "Their own personal workflow → assigned directly to them → their project → their designation → company default. The first one that exists wins."
                : "Only their own personal workflow, because shared workflows are off."}
            </InfoStrip>
          </div>

          {/* Tabs */}
          <div
            className="flex overflow-x-auto border-b mb-4 cto-scrollbar"
            role="tablist"
            style={{ borderColor: tokens.borderColor }}
          >
            <TabButton
              active={tab === "workflows"}
              onClick={() => setTab("workflows")}
              icon={Layers}
              count={templates.length}
            >
              Workflows
            </TabButton>
            <TabButton
              active={tab === "designation"}
              onClick={() => setTab("designation")}
              icon={Briefcase}
            >
              By Designation
            </TabButton>
            {projectsAvailable && (
              <TabButton
                active={tab === "project"}
                onClick={() => setTab("project")}
                icon={FolderKanban}
              >
                By Project
              </TabButton>
            )}
            <TabButton
              active={tab === "notify"}
              onClick={() => setTab("notify")}
              icon={Bell}
            >
              Notify Groups
            </TabButton>
            <TabButton
              active={tab === "employees"}
              onClick={() => setTab("employees")}
              icon={Users}
            >
              Employees
            </TabButton>
          </div>

          {/* Tab content */}
          {tab === "workflows" &&
            (templatesQuery.isLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <SkeletonLine
                    key={i}
                    height={180}
                    theme={tokens.theme}
                    rounded="rounded-xl"
                  />
                ))}
              </div>
            ) : templatesQuery.isError ? (
              <SoftNotice
                icon={Info}
                tone="amber"
                title="Couldn't load workflows"
                theme={tokens.theme}
              >
                {getErrMsg(templatesQuery.error)}
              </SoftNotice>
            ) : templates.length === 0 ? (
              <SoftNotice
                icon={Layers}
                title="No shared workflows yet"
                theme={tokens.theme}
                action={
                  <PrimaryButton
                    onClick={goToNew}
                    borderColor={tokens.borderColor}
                    theme={tokens.theme}
                  >
                    <Plus size={16} /> Create the first one
                  </PrimaryButton>
                }
              >
                Create a workflow (for example "Site Engineers" or "Head
                Office"), then assign it to designations, projects or specific
                employees, or make it the company default.
              </SoftNotice>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {templates.map((t) => (
                  <WorkflowCard
                    key={t._id}
                    template={t}
                    tokens={tokens}
                    busy={defaultMutation.isPending}
                    onEdit={() => goToEdit(t)}
                    onAssign={() => navigate(`${LIST_PATH}/${t._id}/employees`)}
                    onNotified={() =>
                      navigate(`${LIST_PATH}/${t._id}/notified`)
                    }
                    onDuplicate={() =>
                      navigate(`${LIST_PATH}/new?from=${t._id}`)
                    }
                    onMakeDefault={() => defaultMutation.mutate(t._id)}
                    onDelete={() => confirmDelete(t)}
                  />
                ))}
              </div>
            ))}

          {tab === "designation" && (
            <ScopeRulesTab
              scope="designation"
              query={designationQuery}
              templates={templates}
              tokens={tokens}
            />
          )}

          {tab === "project" && projectsAvailable && (
            <ScopeRulesTab
              scope="project"
              query={projectQuery}
              templates={templates}
              tokens={tokens}
            />
          )}

          {tab === "notify" && (
            <NotifyGroupsTab tokens={tokens} askConfirm={askConfirm} />
          )}

          {tab === "employees" && (
            <EmployeesTab
              tokens={tokens}
              designationOptions={designationOptions}
              projectOptions={projectOptions}
              labelMaps={labelMaps}
              askConfirm={askConfirm}
              onAssign={(employees, onDone) =>
                openAssign({ presetEmployees: employees, onDone })
              }
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <AssignWorkflowModal
        isOpen={assign.open}
        presetEmployees={assign.presetEmployees}
        templates={templates}
        tokens={tokens}
        onAssigned={() => assign.onDone?.()}
        onClose={() =>
          setAssign({ open: false, presetEmployees: null, onDone: null })
        }
      />

      <Modal
        isOpen={!!confirm}
        onClose={() => !confirmBusy && setConfirm(null)}
        title={confirm?.title || ""}
        maxWidth="max-w-md"
        action={{
          show: true,
          label: confirmBusy ? "Working..." : confirm?.label || "Confirm",
          variant: confirm?.variant || "save",
          onClick: runConfirm,
          disabled: confirmBusy,
        }}
      >
        <div
          className="p-2 text-sm leading-relaxed"
          style={{ color: "var(--app-text)" }}
        >
          {confirm?.body}
        </div>
      </Modal>
    </div>
  );
}
