// NotifyGroupMembersPage.jsx
// Choose which employees a notify group is for.
//   /app/shared-workflows/notify/:id/employees
//
// Current members start ticked. Designation / project buttons tick a whole
// group at once (click again to untick). An employee can be in several
// notify groups; everyone in all of them gets notified.
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Bell,
  Briefcase,
  FolderKanban,
  Info,
  ChevronLeft,
  ChevronRight,
  Save,
  Users,
  ListChecks,
  CheckCircle2,
} from "lucide-react";

import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";
import Modal from "../../modal";
import {
  fetchNotifyGroup,
  fetchNotifyGroupMembers,
  updateNotifyGroupMembers,
  fetchWorkflowScopeValues,
  fetchEmployeeWorkflows,
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
  Checkbox,
  Avatar,
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
  ViewTab,
  GroupChip,
  EmployeeRow,
} from "./employeePicking";

const LIST_PATH = "/app/shared-workflows";
const BACK = { pathname: LIST_PATH, state: { tab: "notify" } };
const PAGE_SIZE = 25;

const infoFromRow = (row) => ({
  _id: String(row.employee._id),
  label: formatFullName(row.employee),
  initials: initialsOf(row.employee),
  position: row.employee.position || "",
  groups: (row.notifyGroups || []).map((g) => ({
    _id: idOf(g._id),
    name: g.name,
  })),
});

export default function NotifyGroupMembersPage() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { preferences } = useAuth();
  const tokens = useThemeTokens(preferences?.theme || "system");
  const justCreated = Boolean(location.state?.justCreated);

  const [selected, setSelected] = useState(() => new Map()); // id -> info
  const [seeded, setSeeded] = useState(false);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState(() => new Map()); // "designation:<value>" -> info[]
  const [loadingGroup, setLoadingGroup] = useState(null);
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  useEffect(() => setPage(1), [debouncedSearch]);

  /* ---- data ---- */
  const groupQuery = useQuery({
    queryKey: ["notifyGroups", "one", groupId],
    queryFn: () => fetchNotifyGroup(groupId),
    retry: false,
  });
  const group = groupQuery.data;

  const membersQuery = useQuery({
    queryKey: ["notifyGroups", "members", groupId],
    queryFn: () => fetchNotifyGroupMembers(groupId),
    staleTime: 0,
    retry: false,
  });
  const members = membersQuery.data || [];
  const initialIds = useMemo(
    () => new Set(members.map((m) => String(m._id))),
    [members],
  );

  const designationQuery = useQuery({
    queryKey: ["workflowScopeValues", "designation"],
    queryFn: () => fetchWorkflowScopeValues("designation"),
    retry: false,
  });
  const projectQuery = useQuery({
    queryKey: ["workflowScopeValues", "project"],
    queryFn: () => fetchWorkflowScopeValues("project"),
    retry: false,
  });
  const designationChips = (designationQuery.data || []).filter(
    (d) => d.employeeCount > 0,
  );
  const projectChips = projectQuery.isError
    ? []
    : (projectQuery.data || []).filter((p) => p.employeeCount > 0);

  // Tick the current members once their (fresh) list arrives
  useEffect(() => {
    if (seeded || !membersQuery.isSuccess || membersQuery.isFetching) return;
    setSelected(
      new Map(
        members.map((m) => [
          String(m._id),
          {
            _id: String(m._id),
            label: m.label,
            initials: initialsFromLabel(m.label),
            position: "",
            groups: [],
          },
        ]),
      ),
    );
    setSeeded(true);
  }, [seeded, membersQuery.isSuccess, membersQuery.isFetching, members]);

  const listQuery = useQuery({
    queryKey: [
      "employeeWorkflows",
      "notify-members",
      { search: debouncedSearch, page },
    ],
    queryFn: () =>
      fetchEmployeeWorkflows({
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: view === "all",
    placeholderData: (prev) => prev,
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

  const pageInfos = rows.map(infoFromRow);
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
        infos = (await fetchWholeGroup(scope, option.value)).map(infoFromRow);
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
  const toAdd = [...selected.keys()].filter((eid) => !initialIds.has(eid));
  const toRemove = [...initialIds].filter((eid) => !selected.has(eid));
  const hasChanges = seeded && (toAdd.length > 0 || toRemove.length > 0);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateNotifyGroupMembers(groupId, {
        add: toAdd,
        remove: toRemove,
      });
      await invalidateWorkflowQueries(queryClient);
      const parts = [];
      if (res?.added) parts.push(`Added ${plural(res.added, "employee")}.`);
      if (res?.removed)
        parts.push(`Removed ${plural(res.removed, "employee")}.`);
      toast.success(parts.join(" ") || "Saved.");
      navigate(BACK.pathname, { state: BACK.state });
    } catch (err) {
      toast.error(getErrMsg(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () =>
    hasChanges
      ? setLeaveOpen(true)
      : navigate(BACK.pathname, { state: BACK.state });

  const selectedList = useMemo(() => {
    const q = search.toLowerCase().trim();
    const all = [...selected.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    return q
      ? all.filter((i) => `${i.label} ${i.position}`.toLowerCase().includes(q))
      : all;
  }, [selected, search]);

  const statusFor = (info) => {
    const isMember = initialIds.has(info._id);
    if (isMember && selected.has(info._id))
      return <Chip tone="green">In this group</Chip>;
    if (isMember) return <Chip tone="red">Will be removed</Chip>;
    const others = (info.groups || []).filter((g) => g._id !== String(groupId));
    if (others.length)
      return (
        <span
          className="text-[11px] truncate text-right"
          style={{ color: "var(--app-muted)" }}
          title={others.map((g) => g.name).join(", ")}
        >
          Also in: {others.map((g) => g.name).join(", ")}
        </span>
      );
    return null;
  };

  const loadingMembers = membersQuery.isLoading || !seeded;
  const notFound = !groupQuery.isLoading && !group;
  const saveLabel = saving
    ? "Saving..."
    : !hasChanges
      ? "No changes"
      : `Save${toAdd.length ? ` · add ${toAdd.length}` : ""}${toRemove.length ? ` · remove ${toRemove.length}` : ""}`;
  const notifiedNames = (group?.notifiedEmployees || []).map(formatFullName);

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
              {
                label: "NOTIFY GROUP EMPLOYEES",
                to: `${LIST_PATH}/notify/${groupId}/employees`,
              },
            ]}
          />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2 mb-5">
            <div className="flex items-start gap-3 min-w-0">
              <IconButton
                title="Back to notify groups"
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
                  {group ? `Employees in "${group.name}"` : "Employees"}
                </h1>
                {notifiedNames.length > 0 && (
                  <p
                    className="text-sm mt-1 flex flex-wrap items-center gap-1.5"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <Bell size={13} /> Notifies:
                    <span
                      className="font-semibold"
                      style={{ color: "var(--app-text)" }}
                    >
                      {notifiedNames.join(", ")}
                    </span>
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

          {groupQuery.isLoading ? (
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
              title="Notify group not found"
              theme={tokens.theme}
              action={
                <OutlineButton
                  onClick={() => navigate(BACK.pathname, { state: BACK.state })}
                  borderColor={tokens.borderColor}
                  theme={tokens.theme}
                >
                  <ArrowLeft size={16} /> Back to notify groups
                </OutlineButton>
              }
            >
              It may have been deleted.
            </SoftNotice>
          ) : (
            <>
              {justCreated && (
                <div className="mb-4">
                  <InfoStrip
                    icon={CheckCircle2}
                    tone="blue"
                    theme={tokens.theme}
                    title={`"${group.name}" was created`}
                    right={
                      <OutlineButton
                        onClick={() =>
                          navigate(BACK.pathname, { state: BACK.state })
                        }
                        tone="neutral"
                        borderColor={tokens.borderColor}
                        theme={tokens.theme}
                        className="!py-1.5 !text-xs"
                      >
                        Skip for now
                      </OutlineButton>
                    }
                  >
                    Now choose which employees it's for. When they file a
                    request, {notifiedNames.join(", ")} will be notified.
                  </InfoStrip>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
                {/* ===== Left ===== */}
                <div className="space-y-4 lg:sticky lg:top-4 min-w-0">
                  <Card borderColor={tokens.borderColor}>
                    <div
                      className="px-4 py-3.5 border-b"
                      style={{ borderColor: tokens.borderColor }}
                    >
                      <SectionHeader
                        icon={Bell}
                        tone="amber"
                        title="Who gets notified"
                        subtitle="Edit the group to change this"
                      />
                    </div>
                    <div className="p-4 flex flex-wrap gap-2">
                      {(group.notifiedEmployees || []).map((e) => (
                        <span
                          key={idOf(e)}
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
                    </div>
                  </Card>

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
                            ? `${plural(initialIds.size, "employee")} in this group now.`
                            : ""}
                        </div>
                      ) : (
                        <>
                          {toAdd.length > 0 && (
                            <div>
                              ✓ Add {plural(toAdd.length, "employee")} to this
                              group.
                            </div>
                          )}
                          {toRemove.length > 0 && (
                            <div>
                              ✕ Remove {plural(toRemove.length, "employee")}{" "}
                              from this group.
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
                          An employee can be in more than one notify group.
                          Everyone in all their groups gets notified.
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
                          const info = infoFromRow(row);
                          return (
                            <EmployeeRow
                              key={info._id}
                              info={info}
                              checked={selected.has(info._id)}
                              onToggle={() =>
                                toggleInfo(selected.get(info._id) || info)
                              }
                              status={statusFor(info)}
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

      {!groupQuery.isLoading && !notFound && (
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
            navigate(BACK.pathname, { state: BACK.state });
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
