// WorkflowNotifiedPage.jsx
// Who gets notified (no approval) on a shared workflow, for everyone using it.
//   /app/shared-workflows/:id/notified
// Opened from the "Notified" button on a workflow card.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Bell,
  X,
  AlertTriangle,
  Save,
  Info,
  Route as RouteIcon,
  Layers,
} from "lucide-react";

import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";
import Modal from "../../modal";
import {
  fetchWorkflowTemplates,
  updateWorkflowTemplate,
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
  Avatar,
  SkeletonLine,
  EmployeePicker,
  useApproverOptions,
  invalidateWorkflowQueries,
  getErrMsg,
  idOf,
  plural,
  formatFullName,
} from "./workflowUi";

const LIST_PATH = "/app/shared-workflows";
const TO_LIST = { pathname: LIST_PATH };
const TO_NOTIFY_GROUPS = { pathname: LIST_PATH, state: { tab: "notify" } };

const sameIds = (a, b) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

const initialsFromName = (label = "") =>
  label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

export default function WorkflowNotifiedPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { preferences } = useAuth();
  const tokens = useThemeTokens(preferences?.theme || "system");
  const { options: employeeOptions, isLoading: employeesLoading } =
    useApproverOptions();

  // No single-template endpoint; read it from the list (usually cached already)
  const templatesQuery = useQuery({
    queryKey: ["workflowTemplates"],
    queryFn: fetchWorkflowTemplates,
  });
  const template = (templatesQuery.data || []).find((t) => t._id === id);

  const [notified, setNotified] = useState([]);
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState("");
  const [leaveTo, setLeaveTo] = useState(null);
  const loadedFor = useRef(null);

  // Fill once per workflow (later refetches don't overwrite your edits)
  useEffect(() => {
    if (!template || loadedFor.current === template._id) return;
    loadedFor.current = template._id;
    const ids = (template.notifiedEmployees || []).map(idOf).filter(Boolean);
    setNotified(ids);
    setInitial(ids);
  }, [template]);

  const steps = useMemo(
    () => [...(template?.steps || [])].sort((a, b) => a.level - b.level),
    [template],
  );
  const approverIds = useMemo(
    () => new Set(steps.map((s) => idOf(s.approver)).filter(Boolean)),
    [steps],
  );
  // Approvers and people already added can't be picked ("Already in this workflow")
  const unavailable = useMemo(
    () => new Set([...approverIds, ...notified]),
    [approverIds, notified],
  );
  const optionById = useMemo(
    () => new Map(employeeOptions.map((o) => [o.value, o])),
    [employeeOptions],
  );

  const personFor = (pid) => {
    const o = optionById.get(pid);
    if (o) return o;
    const emp = (template?.notifiedEmployees || []).find(
      (e) => idOf(e) === pid,
    );
    if (!emp || typeof emp !== "object") return null;
    const label = formatFullName(emp);
    return {
      value: pid,
      label,
      initials: initialsFromName(label),
      position: emp.position || "",
    };
  };

  const added = initial ? notified.filter((n) => !initial.includes(n)) : [];
  const removed = initial ? initial.filter((n) => !notified.includes(n)) : [];
  const hasChanges = initial !== null && !sameIds(notified, initial);

  const mutation = useMutation({
    mutationFn: () =>
      updateWorkflowTemplate(id, { notifiedEmployees: notified }),
    onSuccess: async () => {
      await invalidateWorkflowQueries(queryClient);
      toast.success("Notified employees saved.");
      navigate(LIST_PATH);
    },
    onError: (err) =>
      setError(getErrMsg(err, "Failed to save notified employees")),
  });

  const go = (to) =>
    hasChanges ? setLeaveTo(to) : navigate(to.pathname, { state: to.state });
  const isBusy = mutation.isPending;
  const loading = templatesQuery.isLoading;
  const notFound = !loading && !template;
  const assignedCount = Object.values(template?.assignmentCounts || {}).reduce(
    (a, b) => a + b,
    0,
  );

  const saveLabel = isBusy
    ? "Saving..."
    : !hasChanges
      ? "No changes"
      : `Save${added.length ? ` · add ${added.length}` : ""}${removed.length ? ` · remove ${removed.length}` : ""}`;

  return (
    <div
      className="flex-1 w-full h-full flex flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="flex-1 overflow-y-auto w-full cto-scrollbar pb-28 lg:pb-10 touch-pan-y">
        <div className="px-3 py-4 md:px-6 max-w-[1200px] mx-auto w-full">
          <Breadcrumbs
            rootLabel="HOME"
            rootTo="/app"
            items={[
              { label: "SHARED WORKFLOWS", to: LIST_PATH },
              {
                label: "NOTIFIED EMPLOYEES",
                to: `${LIST_PATH}/${id}/notified`,
              },
            ]}
          />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2 mb-5">
            <div className="flex items-start gap-3 min-w-0">
              <IconButton
                title="Back to shared workflows"
                onClick={() => go(TO_LIST)}
                borderColor={tokens.borderColor}
              >
                <ArrowLeft size={16} />
              </IconButton>
              <div className="min-w-0">
                <h1
                  className="text-2xl md:text-3xl font-bold tracking-tight break-words"
                  style={{ color: "var(--app-text)" }}
                >
                  {template
                    ? `Notified on "${template.name}"`
                    : "Notified Employees"}
                </h1>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--app-muted)" }}
                >
                  They're kept informed of every request on this workflow. They
                  don't approve.
                </p>
              </div>
            </div>
            <div className="hidden md:flex gap-2">
              <OutlineButton
                onClick={() => go(TO_LIST)}
                disabled={isBusy}
                tone="neutral"
                borderColor={tokens.borderColor}
                theme={tokens.theme}
              >
                Cancel
              </OutlineButton>
              <PrimaryButton
                onClick={() => mutation.mutate()}
                disabled={isBusy || !hasChanges}
                borderColor={tokens.borderColor}
                theme={tokens.theme}
              >
                <Save size={16} /> {saveLabel}
              </PrimaryButton>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
              <SkeletonLine
                height={320}
                theme={tokens.theme}
                rounded="rounded-xl"
              />
              <SkeletonLine
                height={240}
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
              {(error || assignedCount > 0) && (
                <div className="space-y-3 mb-4">
                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 text-sm rounded-xl px-4 py-3 border"
                      style={{
                        color: "#ef4444",
                        borderColor: "rgba(239,68,68,0.25)",
                        backgroundColor: "rgba(239,68,68,0.06)",
                      }}
                    >
                      <AlertTriangle size={16} className="flex-none mt-0.5" />
                      {error}
                    </div>
                  )}
                  {assignedCount > 0 && (
                    <InfoStrip
                      icon={AlertTriangle}
                      tone="amber"
                      theme={tokens.theme}
                      title="This workflow is in use"
                    >
                      Used by:{" "}
                      {[
                        template.isCompanyDefault && "company default",
                        template.assignmentCounts?.designation &&
                          plural(
                            template.assignmentCounts.designation,
                            "designation",
                          ),
                        template.assignmentCounts?.project &&
                          plural(template.assignmentCounts.project, "project"),
                        template.assignmentCounts?.employee &&
                          plural(
                            template.assignmentCounts.employee,
                            "employee",
                          ),
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      . Changes apply to all of them as soon as you save.
                      Employees with their own personal workflow keep their own
                      list.
                    </InfoStrip>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
                {/* ===== Left: notified people ===== */}
                <Card borderColor={tokens.borderColor}>
                  <div
                    className="px-4 sm:px-5 py-4 border-b"
                    style={{ borderColor: tokens.borderColor }}
                  >
                    <SectionHeader
                      icon={Bell}
                      tone="amber"
                      title="Notified employees"
                      subtitle={`${notified.length === 1 ? "1 person" : `${notified.length} people`} · kept informed, they don't approve`}
                    />
                  </div>
                  <div className="p-4 sm:p-5 space-y-3">
                    {notified.length > 0 ? (
                      <ul className="space-y-2" aria-label="Notified employees">
                        {notified.map((pid) => {
                          const p = personFor(pid);
                          const isNew = initial && !initial.includes(pid);
                          return (
                            <li
                              key={pid}
                              className="flex items-center gap-3 rounded-xl border px-3 py-2"
                              style={{
                                borderColor: tokens.borderColor,
                                backgroundColor: "var(--app-surface-2)",
                              }}
                            >
                              <Avatar initials={p?.initials || "?"} size={8} />
                              <div className="min-w-0 flex-1">
                                <div
                                  className="text-sm font-semibold truncate"
                                  style={{ color: "var(--app-text)" }}
                                >
                                  {p?.label || "Unknown employee"}
                                </div>
                                {p?.position && (
                                  <div
                                    className="text-[11px] truncate"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    {p.position}
                                  </div>
                                )}
                              </div>
                              {isNew && (
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                  style={{ color: "var(--accent)" }}
                                >
                                  New
                                </span>
                              )}
                              <IconButton
                                title={`Remove ${p?.label || "person"} from notified`}
                                tone="danger"
                                onClick={() =>
                                  setNotified((prev) =>
                                    prev.filter((n) => n !== pid),
                                  )
                                }
                                borderColor={tokens.borderColor}
                              >
                                <X size={14} />
                              </IconButton>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p
                        className="text-sm py-2"
                        style={{ color: "var(--app-muted)" }}
                      >
                        No one is notified on this workflow yet.
                      </p>
                    )}

                    <EmployeePicker
                      options={employeeOptions}
                      loading={employeesLoading}
                      value=""
                      disabledValues={unavailable}
                      onChange={(pid) =>
                        setNotified((prev) =>
                          prev.includes(pid) ? prev : [...prev, pid],
                        )
                      }
                      placeholder="Add someone to notify..."
                      tokens={tokens}
                    />

                    {removed.length > 0 && (
                      <p className="text-[11px]" style={{ color: "#ef4444" }}>
                        Will stop notifying:{" "}
                        {removed
                          .map((pid) => personFor(pid)?.label || "Unknown")
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </Card>

                {/* ===== Right: context ===== */}
                <div className="space-y-4 lg:sticky lg:top-4 min-w-0">
                  <Card borderColor={tokens.borderColor}>
                    <div
                      className="px-4 py-3.5 border-b"
                      style={{ borderColor: tokens.borderColor }}
                    >
                      <SectionHeader
                        icon={RouteIcon}
                        tone="blue"
                        title="Approvers"
                        subtitle="They already get the request"
                      />
                    </div>
                    <ol className="p-4 space-y-2.5">
                      {steps.map((s) => {
                        const label = formatFullName(s.approver);
                        return (
                          <li
                            key={s.level}
                            className="flex items-center gap-2.5 min-w-0"
                            style={{
                              opacity: s.isEnabled === false ? 0.55 : 1,
                            }}
                          >
                            <Avatar
                              initials={initialsFromName(label)}
                              size={7}
                            />
                            <div className="min-w-0">
                              <div
                                className="text-sm font-semibold truncate"
                                style={{ color: "var(--app-text)" }}
                              >
                                {s.level}. {label}
                              </div>
                              <div
                                className="text-[11px] truncate"
                                style={{ color: "var(--app-muted)" }}
                              >
                                {s.role || "No role"}
                                {s.isEnabled === false ? " · off" : ""}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    <p
                      className="px-4 pb-4 text-[11px]"
                      style={{ color: "var(--app-muted)" }}
                    >
                      To notify an approver instead, remove their step in Edit
                      (use the bell on the step).
                    </p>
                  </Card>

                  <Card borderColor={tokens.borderColor}>
                    <div className="p-4 flex items-start gap-3">
                      <Layers
                        size={18}
                        className="flex-none mt-0.5"
                        style={{ color: "#d97706" }}
                      />
                      <div
                        className="min-w-0 text-xs leading-relaxed"
                        style={{ color: "var(--app-muted)" }}
                      >
                        <div
                          className="text-sm font-semibold mb-0.5"
                          style={{ color: "var(--app-text)" }}
                        >
                          Only for some employees?
                        </div>
                        Use a notify group instead. Groups are added on top of
                        this list for the employees you pick.
                        <div className="mt-2">
                          <OutlineButton
                            onClick={() => go(TO_NOTIFY_GROUPS)}
                            borderColor={tokens.borderColor}
                            theme={tokens.theme}
                            className="!py-1.5 !text-xs"
                          >
                            <Bell size={14} /> Open Notify Groups
                          </OutlineButton>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile action bar */}
      {!loading && !notFound && (
        <div
          className="md:hidden fixed bottom-0 inset-x-0 z-[5] px-3 py-3 border-t flex gap-2"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: tokens.borderColor,
          }}
        >
          <OutlineButton
            onClick={() => go(TO_LIST)}
            disabled={isBusy}
            tone="neutral"
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="flex-1"
          >
            Cancel
          </OutlineButton>
          <PrimaryButton
            onClick={() => mutation.mutate()}
            disabled={isBusy || !hasChanges}
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
        isOpen={Boolean(leaveTo)}
        onClose={() => setLeaveTo(null)}
        title="Discard changes?"
        maxWidth="max-w-md"
        action={{
          show: true,
          label: "Discard",
          variant: "delete",
          onClick: () => {
            const to = leaveTo;
            setLeaveTo(null);
            navigate(to.pathname, { state: to.state });
          },
        }}
      >
        <div className="p-2 text-sm" style={{ color: "var(--app-text)" }}>
          You haven't saved the notified employees. Leave without saving?
        </div>
      </Modal>
    </div>
  );
}
