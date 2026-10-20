// WorkflowEmployeesPage.jsx
// Choose which employees use a shared workflow.
//   /app/shared-workflows/:id/employees
//
// Current members start ticked. Designation / project buttons tick a whole
// group at once (click again to untick). Untick someone to remove them.
// Save adds the newly ticked and removes the unticked.
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  FolderKanban,
  Info,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Save,
  Users,
  UserCog,
  ListChecks,
  CheckCircle2,
} from "lucide-react";

import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";
import Modal from "../../modal";
import {
  fetchWorkflowTemplates,
  fetchWorkflowScopeValues,
  fetchWorkflowAssignments,
  fetchEmployeeWorkflows,
  assignWorkflowToEmployees,
  removeWorkflowAssignments,
  fetchWorkflowSettings,
} from "../../../api/approvalRoute";
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
  Checkbox,
  Chip,
  SearchBox,
  SkeletonLine,
  formatFullName,
  initialsOf,
  invalidateWorkflowQueries,
  getErrMsg,
  plural,
  idOf,
  useDebounced,
} from "./workflowUi";
import {
  initialsFromLabel,
  fetchWholeGroup,
  fetchRowsByIds,
  ViewTab,
  GroupChip,
  EmployeeRow,
} from "./employeePicking";

const LIST_PATH = "/app/shared-workflows";
const PAGE_SIZE = 25;

/* =========================
   Helpers
========================= */
/**
 * What we keep about each employee.
 * via(matchedBy) turns a rule into text like "Designation: Engineer".
 */
const infoFromRow = (row, routeId, via) => {
  const directElsewhere =
    row.defaultMatchedBy?.scope === "employee" &&
    idOf(row.defaultWorkflow?._id) !== String(routeId);
  // A project/designation rule or the company default gives them THIS workflow anyway
  const ruleGivesThis = idOf(row.fallbackWorkflow?._id) === String(routeId);
  return {
    _id: String(row.employee._id),
    label: formatFullName(row.employee),
    initials: initialsOf(row.employee),
    position: row.employee.position || "",
    movingFrom: directElsewhere
      ? row.defaultWorkflow?.name || "another workflow"
      : null,
    hasPersonal: row.source === "personal",
    viaRule: ruleGivesThis ? via(row.fallbackMatchedBy) : null,
  };
};

/* =========================
   Page
========================= */
export default function WorkflowEmployeesPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { preferences } = useAuth();
  const tokens = useThemeTokens(preferences?.theme || "system");
  const justCreated = Boolean(location.state?.justCreated);

  const [selected, setSelected] = useState(() => new Map()); // id -> info
  const [seeded, setSeeded] = useState(false);
  const [view, setView] = useState("all"); // "all" | "selected"
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState(() => new Map()); // "designation:<value>" -> info[]
  const [loadingGroup, setLoadingGroup] = useState(null);
  const [resetPersonal, setResetPersonal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  useEffect(() => setPage(1), [debouncedSearch]);

  /* ---- data ---- */
  const templatesQuery = useQuery({
    queryKey: ["workflowTemplates"],
    queryFn: fetchWorkflowTemplates,
  });
  const settingsQuery = useQuery({
    queryKey: ["workflowSettings"],
    queryFn: fetchWorkflowSettings,
  });
  const sharedOff = settingsQuery.data?.sharedWorkflowsEnabled === false;
  const template = (templatesQuery.data || []).find((t) => t._id === routeId);

  const designationQuery = useQuery({
    queryKey: ["workflowScopeValues", "designation"],
    queryFn: () => fetchWorkflowScopeValues("designation"),
    retry: false,
  });
  const projectQuery = useQuery({
    queryKey: ["workflowScopeValues", "project"],
    queryFn: () => fetchWorkflowScopeValues("project"),
    retry: false, // errors if the server has project scope turned off; the buttons just hide
  });
  const designationChips = (designationQuery.data || []).filter(
    (d) => d.employeeCount > 0,
  );
  const projectChips = projectQuery.isError
    ? []
    : (projectQuery.data || []).filter((p) => p.employeeCount > 0);

  // Rule → readable text ("Designation: Engineer", "company default")
  const labelMaps = useMemo(
    () => ({
      designation: new Map(
        (designationQuery.data || []).map((d) => [d.value, d.label]),
      ),
      project: new Map(
        (projectQuery.isError ? [] : projectQuery.data || []).map((p) => [
          p.value,
          p.label,
        ]),
      ),
    }),
    [designationQuery.data, projectQuery.data, projectQuery.isError],
  );
  const via = (m) => {
    if (!m) return null;
    if (m.scope === "global") return "company default";
    if (m.scope === "designation")
      return `Designation: ${labelMaps.designation.get(m.value) || m.label || m.value}`;
    if (m.scope === "project")
      return `Project: ${labelMaps.project.get(m.value) || m.label || m.value}`;
    return "direct assignment";
  };

  // Rules that give this workflow to people automatically
  const ruleSources = [
    ...(template?.isCompanyDefault ? ["Company default"] : []),
    ...(designationQuery.data || [])
      .filter((d) => idOf(d.assignment?.route?._id) === String(routeId))
      .map((d) => `Designation: ${d.label}`),
    ...(projectQuery.isError ? [] : projectQuery.data || [])
      .filter((p) => idOf(p.assignment?.route?._id) === String(routeId))
      .map((p) => `Project: ${p.label}`),
  ];

  // Who is directly assigned to this workflow right now
  const membersQuery = useQuery({
    queryKey: ["workflowAssignments", "members", routeId],
    queryFn: () => fetchWorkflowAssignments({ scope: "employee", routeId }),
    enabled: Boolean(routeId),
    staleTime: 0,
  });
  const members = membersQuery.data || [];
  const memberAssignmentId = useMemo(
    () => new Map(members.map((a) => [a.value, a._id])),
    [members],
  );
  const initialIds = useMemo(
    () => new Set(members.map((a) => a.value)),
    [members],
  );

  // Current members with their details (incl. what a rule would give them if removed)
  const [memberInfo, setMemberInfo] = useState(() => new Map());

  // Tick the current members once their (fresh) list arrives
  useEffect(() => {
    if (seeded || !membersQuery.isSuccess || membersQuery.isFetching) return;
    if (designationQuery.isLoading || projectQuery.isLoading) return; // need labels for "via ..."
    let cancelled = false;
    (async () => {
      const basic = new Map(
        members.map((a) => [
          a.value,
          {
            _id: a.value,
            label: a.label,
            initials: initialsFromLabel(a.label),
            position: "",
            movingFrom: null,
            hasPersonal: false,
            viaRule: null,
          },
        ]),
      );
      try {
        const rows = await fetchRowsByIds([...basic.keys()]);
        rows.forEach((r) =>
          basic.set(String(r.employee._id), infoFromRow(r, routeId, via)),
        );
      } catch {
        // fall back to names only; the page still works
      }
      if (cancelled) return;
      setMemberInfo(basic);
      setSelected(new Map(basic));
      setSeeded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    seeded,
    membersQuery.isSuccess,
    membersQuery.isFetching,
    members,
    designationQuery.isLoading,
    projectQuery.isLoading,
  ]);

  // Paged list of everyone
  const listQuery = useQuery({
    queryKey: [
      "employeeWorkflows",
      "members-page",
      { search: debouncedSearch, page },
    ],
    queryFn: () =>
      fetchEmployeeWorkflows({
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: view === "all",
    placeholderData: (prev) => prev, // keep the old page visible while the next one loads
  });
  const rows = listQuery.data?.items || [];
  const totalPages = listQuery.data?.totalPages || 1;
  const totalEmployees = listQuery.data?.total;

  /* ---- ticking ---- */
  const toggleInfo = (info) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(info._id)) next.delete(info._id);
      else next.set(info._id, info);
      return next;
    });

  const pageInfos = rows.map((r) => infoFromRow(r, routeId, via));
  const allOnPage =
    pageInfos.length > 0 && pageInfos.every((i) => selected.has(i._id));
  const someOnPage = pageInfos.some((i) => selected.has(i._id));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (allOnPage) pageInfos.forEach((i) => next.delete(i._id));
      else pageInfos.forEach((i) => !next.has(i._id) && next.set(i._id, i));
      return next;
    });

  const groupState = (key) => {
    const infos = groups.get(key);
    if (!infos?.length) return "none";
    const n = infos.filter((i) => selected.has(i._id)).length;
    return n === infos.length ? "all" : n > 0 ? "some" : "none";
  };

  const toggleGroup = async (scope, option) => {
    const key = `${scope}:${option.value}`;
    let infos = groups.get(key);
    if (!infos) {
      setLoadingGroup(key);
      try {
        infos = (await fetchWholeGroup(scope, option.value)).map((r) =>
          infoFromRow(r, routeId, via),
        );
        setGroups((prev) => new Map(prev).set(key, infos));
      } catch (err) {
        toast.error(getErrMsg(err, `Couldn't load ${option.label}`));
        return;
      } finally {
        setLoadingGroup(null);
      }
    }
    const allIn = infos.length > 0 && infos.every((i) => selected.has(i._id));
    setSelected((prev) => {
      const next = new Map(prev);
      if (allIn) infos.forEach((i) => next.delete(i._id));
      else infos.forEach((i) => !next.has(i._id) && next.set(i._id, i));
      return next;
    });
  };

  /* ---- what Save will do ---- */
  const toAdd = [...selected.keys()].filter((empId) => !initialIds.has(empId));
  const toRemove = [...initialIds].filter((empId) => !selected.has(empId));
  const moving = toAdd
    .map((empId) => selected.get(empId))
    .filter((i) => i?.movingFrom);
  const withPersonal = toAdd
    .map((empId) => selected.get(empId))
    .filter((i) => i?.hasPersonal);
  // Removing these won't change anything: a rule still gives them this workflow
  const stillGetsIt = toRemove
    .map((empId) => memberInfo.get(empId))
    .filter((i) => i?.viaRule);
  const hasChanges = seeded && (toAdd.length > 0 || toRemove.length > 0);

  const save = async () => {
    setSaving(true);
    try {
      let added = null;
      let removed = 0;
      if (toAdd.length) {
        added = await assignWorkflowToEmployees({
          routeId,
          employeeIds: toAdd,
          resetPersonal,
        });
      }
      if (toRemove.length) {
        const res = await removeWorkflowAssignments({
          assignmentIds: toRemove
            .map((empId) => memberAssignmentId.get(empId))
            .filter(Boolean),
        });
        removed = res?.deleted ?? toRemove.length;
      }
      await invalidateWorkflowQueries(queryClient);

      const parts = [];
      if (added) parts.push(`Added ${plural(added.assigned, "employee")}.`);
      if (removed) parts.push(`Removed ${plural(removed, "employee")}.`);
      if (added?.personalWorkflowsReset)
        parts.push(
          `Replaced ${plural(added.personalWorkflowsReset, "personal workflow")}.`,
        );
      if (added?.keepingPersonalWorkflow)
        parts.push(
          `${plural(added.keepingPersonalWorkflow, "employee")} kept their own workflow.`,
        );
      toast.success(parts.join(" ") || "Saved.");
      navigate(LIST_PATH);
    } catch (err) {
      toast.error(getErrMsg(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => (hasChanges ? setLeaveOpen(true) : navigate(LIST_PATH));

  /* ---- views ---- */
  const selectedList = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = [...selected.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    return q
      ? list.filter((i) => `${i.label} ${i.position}`.toLowerCase().includes(q))
      : list;
  }, [selected, search]);

  const statusFor = (info, row) => {
    const isMember = initialIds.has(info._id);
    if (isMember && selected.has(info._id))
      return <Chip tone="green">In this workflow</Chip>;
    if (isMember) {
      const rule = memberInfo.get(info._id)?.viaRule || info.viaRule;
      return rule ? (
        <Chip
          tone="amber"
          title="Removing the direct assignment won't change their workflow"
        >
          Still gets it via {rule}
        </Chip>
      ) : (
        <Chip tone="red">Will be removed</Chip>
      );
    }
    if (row?.source === "personal" || info.hasPersonal)
      return <Chip tone="violet">Own workflow</Chip>;
    if (info.viaRule)
      return (
        <Chip
          tone="blue"
          title={`Already gets this workflow through ${info.viaRule}`}
        >
          Via {info.viaRule}
        </Chip>
      );
    if (info.movingFrom)
      return (
        <Chip tone="amber" title={`Directly assigned to ${info.movingFrom}`}>
          On {info.movingFrom}
        </Chip>
      );
    if (row?.workflow?.name)
      return (
        <span
          className="text-[11px] truncate text-right"
          style={{ color: "var(--app-muted)" }}
        >
          Now: {row.workflow.name}
        </span>
      );
    return <Chip tone="neutral">No workflow</Chip>;
  };

  const loadingMembers = membersQuery.isLoading || !seeded;
  const notFound = !templatesQuery.isLoading && !template;
  const saveLabel = saving
    ? "Saving..."
    : !hasChanges
      ? "No changes"
      : `Save${toAdd.length ? ` · add ${toAdd.length}` : ""}${toRemove.length ? ` · remove ${toRemove.length}` : ""}`;

  const chain = (template?.steps || [])
    .filter((s) => s.isEnabled !== false)
    .sort((a, b) => a.level - b.level)
    .map((s) => formatFullName(s.approver));

  return (
    <div
      className="flex-1 w-full h-full flex flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="flex-1 overflow-y-auto w-full cto-scrollbar pb-28 lg:pb-10 touch-pan-y">
        <div className="px-3 py-4 md:px-6 max-w-[1400px] mx-auto w-full">
          <Breadcrumbs
            rootLabel="HOME"
            rootTo="/app"
            items={[
              { label: "SHARED WORKFLOWS", to: LIST_PATH },
              { label: "EMPLOYEES", to: `${LIST_PATH}/${routeId}/employees` },
            ]}
          />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2 mb-5">
            <div className="flex items-start gap-3 min-w-0">
              <IconButton
                title="Back to shared workflows"
                onClick={goBack}
                borderColor={tokens.borderColor}
              >
                <ArrowLeft size={16} />
              </IconButton>
              <div className="min-w-0">
                <h1
                  className="text-2xl md:text-3xl font-bold tracking-tight break-words"
                  style={{ color: "var(--app-text)" }}
                >
                  {template ? `Employees on "${template.name}"` : "Employees"}
                </h1>
                {chain.length > 0 && (
                  <p
                    className="text-sm mt-1 flex flex-wrap items-center gap-1.5"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Approvers:
                    {chain.map((n, i) => (
                      <React.Fragment key={`${n}-${i}`}>
                        <span
                          className="font-semibold"
                          style={{ color: "var(--app-text)" }}
                        >
                          {n}
                        </span>
                        {i < chain.length - 1 && <ArrowRight size={12} />}
                      </React.Fragment>
                    ))}
                  </p>
                )}
              </div>
            </div>
            <div className="hidden md:flex gap-2">
              <OutlineButton
                onClick={goBack}
                disabled={saving}
                tone="neutral"
                borderColor={tokens.borderColor}
                theme={tokens.theme}
              >
                Cancel
              </OutlineButton>
              <PrimaryButton
                onClick={save}
                disabled={saving || !hasChanges}
                borderColor={tokens.borderColor}
                theme={tokens.theme}
              >
                <Save size={16} /> {saveLabel}
              </PrimaryButton>
            </div>
          </div>

          {templatesQuery.isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
              <SkeletonLine
                height={320}
                theme={tokens.theme}
                rounded="rounded-xl"
              />
              <SkeletonLine
                height={520}
                theme={tokens.theme}
                rounded="rounded-xl"
              />
            </div>
          ) : notFound ? (
            <SoftNotice
              icon={Info}
              tone="amber"
              title="Workflow not found"
              theme={tokens.theme}
              action={
                <OutlineButton
                  onClick={() => navigate(LIST_PATH)}
                  borderColor={tokens.borderColor}
                  theme={tokens.theme}
                >
                  <ArrowLeft size={16} /> Back to shared workflows
                </OutlineButton>
              }
            >
              It may have been deleted.
            </SoftNotice>
          ) : (
            <>
              {sharedOff && (
                <div className="mb-4">
                  <InfoStrip
                    icon={AlertTriangle}
                    tone="amber"
                    theme={tokens.theme}
                    title="Shared workflows are off"
                  >
                    You can still choose employees here. They'll use this
                    workflow once shared workflows are turned back on; until
                    then everyone uses their own personal workflow.
                  </InfoStrip>
                </div>
              )}
              {justCreated && (
                <div className="mb-4">
                  <InfoStrip
                    icon={CheckCircle2}
                    tone="blue"
                    theme={tokens.theme}
                    title={`"${template.name}" was created`}
                    right={
                      <OutlineButton
                        onClick={() => navigate(LIST_PATH)}
                        tone="neutral"
                        borderColor={tokens.borderColor}
                        theme={tokens.theme}
                        className="!py-1.5 !text-xs"
                      >
                        Skip for now
                      </OutlineButton>
                    }
                  >
                    Now choose who uses it. Tick a designation or project to add
                    everyone in it, or pick people one by one.
                  </InfoStrip>
                </div>
              )}

              {ruleSources.length > 0 && (
                <div className="mb-4">
                  <InfoStrip
                    icon={Info}
                    tone="violet"
                    theme={tokens.theme}
                    title={`This workflow also applies through: ${ruleSources.join(" · ")}`}
                  >
                    {template?.isCompanyDefault
                      ? "As the company default, everyone without another workflow gets it, even if they aren't ticked here. "
                      : "Everyone matching these rules gets it, even if they aren't ticked here. "}
                    Unticking someone won't stop that. To give them a different
                    workflow, add them on that workflow's Employees page, or
                    change the rule on the Shared Workflows page.
                  </InfoStrip>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
                {/* ===== Left: quick select + options + summary ===== */}
                <div className="space-y-4 lg:sticky lg:top-4 min-w-0">
                  <Card borderColor={tokens.borderColor}>
                    <div
                      className="px-4 py-3.5 border-b"
                      style={{ borderColor: tokens.borderColor }}
                    >
                      <SectionHeader
                        icon={ListChecks}
                        title="Quick select"
                        subtitle="Tick a whole group at once"
                      />
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Briefcase size={13} style={{ color: "#8b5cf6" }} />
                          <span
                            className="text-xs font-bold uppercase tracking-wider"
                            style={{ color: "var(--app-muted)" }}
                          >
                            By designation
                          </span>
                        </div>
                        {designationQuery.isLoading ? (
                          <SkeletonLine
                            height={32}
                            theme={tokens.theme}
                            rounded="rounded-lg"
                          />
                        ) : designationChips.length === 0 ? (
                          <p
                            className="text-xs"
                            style={{ color: "var(--app-muted)" }}
                          >
                            No designations found.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {designationChips.map((o) => (
                              <GroupChip
                                key={o.value}
                                label={o.label}
                                count={o.employeeCount}
                                state={groupState(`designation:${o.value}`)}
                                loading={
                                  loadingGroup === `designation:${o.value}`
                                }
                                onClick={() => toggleGroup("designation", o)}
                                tokens={tokens}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {projectChips.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <FolderKanban
                              size={13}
                              style={{ color: "#3b82f6" }}
                            />
                            <span
                              className="text-xs font-bold uppercase tracking-wider"
                              style={{ color: "var(--app-muted)" }}
                            >
                              By project
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {projectChips.map((o) => (
                              <GroupChip
                                key={o.value}
                                label={o.label}
                                count={o.employeeCount}
                                state={groupState(`project:${o.value}`)}
                                loading={loadingGroup === `project:${o.value}`}
                                onClick={() => toggleGroup("project", o)}
                                tokens={tokens}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <p
                        className="text-[11px] leading-relaxed"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Click once to tick everyone in it, and again to untick
                        them. You can still untick individual people in the
                        list.
                      </p>
                    </div>
                  </Card>

                  <Card borderColor={tokens.borderColor}>
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <UserCog size={16} style={{ color: "#8b5cf6" }} />
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "var(--app-text)" }}
                          >
                            Replace personal workflows
                          </span>
                          {withPersonal.length > 0 && (
                            <Chip tone="violet">
                              {plural(withPersonal.length, "person")} affected
                            </Chip>
                          )}
                        </div>
                        <p
                          className="text-[11px] mt-1 leading-relaxed"
                          style={{ color: "var(--app-muted)" }}
                        >
                          {resetPersonal
                            ? "People you add who built their own workflow will lose it and use this one."
                            : 'People you add who built their own workflow keep using it. This one becomes their default for when they click "Use Default".'}
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
                  </Card>

                  <Card borderColor={tokens.borderColor}>
                    <div
                      className="p-4 text-xs space-y-2"
                      style={{ color: "var(--app-text)" }}
                    >
                      <div
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--app-muted)" }}
                      >
                        When you save
                      </div>
                      {!hasChanges ? (
                        <div style={{ color: "var(--app-muted)" }}>
                          No changes yet.{" "}
                          {initialIds.size
                            ? `${plural(initialIds.size, "employee")} on this workflow now.`
                            : ""}
                        </div>
                      ) : (
                        <>
                          {toAdd.length > 0 && (
                            <div>
                              ✓ Add {plural(toAdd.length, "employee")} to this
                              workflow.
                            </div>
                          )}
                          {toRemove.length > 0 && (
                            <div>
                              ✕ Remove {plural(toRemove.length, "employee")}{" "}
                              from this workflow.
                              {toRemove.length > stillGetsIt.length &&
                                " They'll go back to their project, designation or company default."}
                            </div>
                          )}
                          {moving.length > 0 && (
                            <div
                              className="flex items-start gap-1.5"
                              style={{ color: "#d97706" }}
                            >
                              <AlertTriangle
                                size={13}
                                className="flex-none mt-0.5"
                              />
                              <span>
                                {plural(moving.length, "employee")} will move
                                here from another workflow (
                                {[
                                  ...new Set(moving.map((m) => m.movingFrom)),
                                ].join(", ")}
                                ).
                              </span>
                            </div>
                          )}
                          {stillGetsIt.length > 0 && (
                            <div
                              className="flex items-start gap-1.5"
                              style={{ color: "#d97706" }}
                            >
                              <AlertTriangle
                                size={13}
                                className="flex-none mt-0.5"
                              />
                              <span>
                                {stillGetsIt.length === 1 ? (
                                  <>
                                    <b>{stillGetsIt[0].label}</b> will{" "}
                                    <b>still get this workflow</b> via{" "}
                                    {stillGetsIt[0].viaRule}.
                                  </>
                                ) : (
                                  <>
                                    {plural(stillGetsIt.length, "employee")}{" "}
                                    will <b>still get this workflow</b> through
                                    a rule (
                                    {[
                                      ...new Set(
                                        stillGetsIt.map((i) => i.viaRule),
                                      ),
                                    ].join(", ")}
                                    ).
                                  </>
                                )}{" "}
                                To give them a different one, add them on that
                                workflow's Employees page.
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      <div
                        className="flex items-start gap-1.5 pt-1"
                        style={{ color: "var(--app-muted)" }}
                      >
                        <Info size={13} className="flex-none mt-0.5" />
                        <span>
                          This assigns the people ticked now. New hires aren't
                          added automatically; use the By Designation or By
                          Project tab for that.
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* ===== Right: employee list ===== */}
                <Card borderColor={tokens.borderColor} className="min-w-0">
                  <div
                    className="px-4 py-3.5 border-b"
                    style={{ borderColor: tokens.borderColor }}
                  >
                    <SectionHeader
                      icon={Users}
                      tone="blue"
                      title="Employees"
                      subtitle={`${selected.size} ticked${totalEmployees !== undefined ? ` of ${totalEmployees}` : ""}`}
                    />
                  </div>
                  <div
                    className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 border-b"
                    style={{
                      borderColor: tokens.borderColor,
                      backgroundColor: "var(--app-surface-2)",
                    }}
                  >
                    <div
                      className="inline-flex p-0.5 rounded-lg self-start"
                      style={{ border: `1px solid ${tokens.borderColor}` }}
                    >
                      <ViewTab
                        active={view === "all"}
                        onClick={() => setView("all")}
                      >
                        All employees
                      </ViewTab>
                      <ViewTab
                        active={view === "selected"}
                        onClick={() => setView("selected")}
                      >
                        Ticked ({selected.size})
                      </ViewTab>
                    </div>
                    <SearchBox
                      value={search}
                      onChange={setSearch}
                      placeholder="Search name..."
                      tokens={tokens}
                      className="flex-1"
                    />
                  </div>

                  {view === "all" && (
                    <div
                      className="px-4 py-2 flex items-center justify-between border-b"
                      style={{ borderColor: tokens.borderColor }}
                    >
                      <label
                        className="flex items-center gap-2 text-[11px] font-bold"
                        style={{ color: "var(--app-muted)" }}
                      >
                        <Checkbox
                          checked={allOnPage}
                          indeterminate={!allOnPage && someOnPage}
                          onChange={togglePage}
                          disabled={!rows.length}
                          label="Tick everyone on this page"
                          borderColor={tokens.borderColor}
                        />
                        This page
                      </label>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[11px]"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Page {page} of {totalPages}
                          </span>
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
                      )}
                    </div>
                  )}

                  <div>
                    {loadingMembers ||
                    (view === "all" && listQuery.isLoading) ? (
                      <div className="p-4 space-y-2">
                        {[...Array(6)].map((_, i) => (
                          <SkeletonLine
                            key={i}
                            height={44}
                            theme={tokens.theme}
                            rounded="rounded-lg"
                          />
                        ))}
                      </div>
                    ) : view === "all" ? (
                      rows.length === 0 ? (
                        <div
                          className="p-8 text-center text-sm"
                          style={{ color: "var(--app-muted)" }}
                        >
                          No employees match.
                        </div>
                      ) : (
                        rows.map((row) => {
                          const info = infoFromRow(row, routeId, via);
                          return (
                            <EmployeeRow
                              key={info._id}
                              info={info}
                              checked={selected.has(info._id)}
                              onToggle={() =>
                                toggleInfo(selected.get(info._id) || info)
                              }
                              status={statusFor(info, row)}
                              tokens={tokens}
                            />
                          );
                        })
                      )
                    ) : selectedList.length === 0 ? (
                      <div
                        className="p-8 text-center text-sm"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {selected.size
                          ? "No ticked employees match."
                          : "Nobody is ticked yet."}
                      </div>
                    ) : (
                      selectedList.map((info) => (
                        <EmployeeRow
                          key={info._id}
                          info={info}
                          checked
                          onToggle={() => toggleInfo(info)}
                          status={statusFor(info)}
                          tokens={tokens}
                        />
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile action bar */}
      {!templatesQuery.isLoading && !notFound && (
        <div
          className="md:hidden fixed bottom-0 inset-x-0 z-[5] px-3 py-3 border-t flex gap-2"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: tokens.borderColor,
          }}
        >
          <OutlineButton
            onClick={goBack}
            disabled={saving}
            tone="neutral"
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="flex-1"
          >
            Cancel
          </OutlineButton>
          <PrimaryButton
            onClick={save}
            disabled={saving || !hasChanges}
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="flex-[2]"
          >
            <Save size={16} /> {saveLabel}
          </PrimaryButton>
        </div>
      )}

      {/* Unsaved changes */}
      <Modal
        isOpen={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Discard changes?"
        maxWidth="max-w-md"
        action={{
          show: true,
          label: "Discard",
          variant: "delete",
          onClick: () => {
            setLeaveOpen(false);
            navigate(LIST_PATH);
          },
        }}
      >
        <div className="p-2 text-sm" style={{ color: "var(--app-text)" }}>
          You ticked or unticked employees but haven't saved. Leave without
          saving?
        </div>
      </Modal>
    </div>
  );
}
