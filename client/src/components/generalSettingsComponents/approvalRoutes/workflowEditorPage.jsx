// WorkflowEditorPage.jsx
// Create / edit a shared CTO/Wellness workflow on its own page.
//   /app/shared-workflows/new
//   /app/shared-workflows/new?from=<id>   (duplicate: same steps + notified, no employees)
//   /app/shared-workflows/:id/edit
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Bell,
  Route as RouteIcon,
  AlertTriangle,
  FileText,
  Eye,
  Save,
  Info,
  Copy,
} from "lucide-react";

import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";
import Modal from "../../modal";
import {
  fetchWorkflowTemplates,
  createWorkflowTemplate,
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
  Toggle,
  Avatar,
  Chip,
  FieldLabel,
  TextInput,
  SelectInput,
  SkeletonLine,
  EmployeePicker,
  useApproverOptions,
  useApprovalRoleOptions,
  invalidateWorkflowQueries,
  getErrMsg,
  idOf,
  newKey,
  plural,
  formatFullName,
} from "./workflowUi";

const LIST_PATH = "/app/shared-workflows";

const emptyStep = (role = "") => ({
  key: newKey(),
  approver: "",
  role,
  isEnabled: true,
});

/** Comparable snapshot of the form (ignores the random step keys). */
const snapshot = ({ name, description, steps, notified }) =>
  JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    steps: steps.map(({ approver, role, isEnabled }) => ({
      approver,
      role,
      isEnabled,
    })),
    notified: [...notified].sort(),
  });

/** "Engineering (copy)", or "(copy 2)" etc. if that name is taken */
const copyNameFor = (base, all) => {
  const taken = new Set(
    all.map((t) =>
      String(t.name || "")
        .trim()
        .toLowerCase(),
    ),
  );
  let candidate = `${base} (copy)`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++)
    candidate = `${base} (copy ${i})`;
  return candidate;
};

const initialsFromName = (label = "") =>
  label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

export default function WorkflowEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const fromId = isEdit ? null : searchParams.get("from");
  const isDuplicate = Boolean(fromId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { preferences } = useAuth();
  const tokens = useThemeTokens(preferences?.theme || "system");

  const { options: employeeOptions, isLoading: employeesLoading } =
    useApproverOptions();
  const { roles } = useApprovalRoleOptions();

  // There's no single-template endpoint, so read it from the list (usually cached already)
  const templatesQuery = useQuery({
    queryKey: ["workflowTemplates"],
    queryFn: fetchWorkflowTemplates,
    enabled: isEdit || isDuplicate,
  });
  const allTemplates = templatesQuery.data || [];
  const template = isEdit ? allTemplates.find((t) => t._id === id) : null;
  // Duplicate: the workflow being copied
  const source = isDuplicate
    ? allTemplates.find((t) => t._id === fromId)
    : null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState(() => [emptyStep()]);
  // Notified people (they don't approve). Managed on the Notified page; here only
  // "Notify instead" on a step adds to it, and picking one as an approver removes them.
  const [notified, setNotified] = useState([]);
  const [initialNotified, setInitialNotified] = useState([]); // what's saved (decides if we send the list)
  const [notifiedBaseline, setNotifiedBaseline] = useState([]); // what the form started with ("New" tag)
  const [error, setError] = useState("");
  const [initial, setInitial] = useState(null); // snapshot to detect unsaved changes
  const [leaveTo, setLeaveTo] = useState(null); // where to go after "Discard"
  const loadedFor = useRef(null);

  // Fill the form once per workflow (later refetches don't overwrite your edits)
  useEffect(() => {
    if (isEdit) {
      if (!template || loadedFor.current === template._id) return;
      loadedFor.current = template._id;
      const form = {
        name: template.name || "",
        description: template.description || "",
        steps: [...(template.steps || [])]
          .sort((a, b) => a.level - b.level)
          .map((s) => ({
            key: newKey(),
            approver: idOf(s.approver),
            role: s.role || "",
            isEnabled: s.isEnabled !== false,
          })),
        notified: (template.notifiedEmployees || []).map(idOf).filter(Boolean),
      };
      setName(form.name);
      setDescription(form.description);
      setSteps(form.steps);
      setNotified(form.notified);
      setInitialNotified(form.notified);
      setNotifiedBaseline(form.notified);
      setInitial(snapshot(form));
    } else if (isDuplicate) {
      // Same approvers and notified people; assignments (employees, designations, projects) are NOT copied
      if (!source || loadedFor.current === `dup:${source._id}`) return;
      loadedFor.current = `dup:${source._id}`;
      const form = {
        name: copyNameFor(source.name || "Workflow", allTemplates),
        description: source.description || "",
        steps: [...(source.steps || [])]
          .sort((a, b) => a.level - b.level)
          .map((s) => ({
            key: newKey(),
            approver: idOf(s.approver),
            role: s.role || "",
            isEnabled: s.isEnabled !== false,
          })),
        notified: (source.notifiedEmployees || []).map(idOf).filter(Boolean),
      };
      setName(form.name);
      setDescription(form.description);
      setSteps(form.steps);
      setNotified(form.notified);
      setInitialNotified([]); // it's a new workflow, so the copied list is sent on create
      setNotifiedBaseline(form.notified); // copied people aren't "New"
      setInitial(snapshot(form));
    } else if (loadedFor.current !== "new") {
      loadedFor.current = "new";
      setInitial(
        snapshot({
          name: "",
          description: "",
          steps: [emptyStep()],
          notified: [],
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, template, isDuplicate, source]);

  const firstUnusedRole = (list, exceptIndex = -1) => {
    const used = new Set(
      list.filter((_, i) => i !== exceptIndex).map((s) => s.role),
    );
    return roles.find((r) => !used.has(r.id))?.id || roles[0]?.id || "";
  };

  // Give blank steps a role once roles have loaded
  useEffect(() => {
    if (!roles.length) return;
    setSteps((prev) =>
      prev.map((s, i) =>
        s.role ? s : { ...s, role: firstUnusedRole(prev, i) },
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.length]);

  const approverIds = useMemo(
    () => new Set(steps.map((s) => s.approver).filter(Boolean)),
    [steps],
  );
  const optionById = useMemo(
    () => new Map(employeeOptions.map((o) => [o.value, o])),
    [employeeOptions],
  );
  const roleLabel = (rid) =>
    roles.find((r) => r.id === rid)?.label || rid || "No role";

  // Name for a notified person (falls back to the saved workflow if they're not in the approvers list)
  const personFor = (pid) => {
    const o = optionById.get(pid);
    if (o) return o;
    const emp = ((template || source)?.notifiedEmployees || []).find(
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

  // A brand-new form counts as untouched even after roles fill in
  const current = snapshot({ name, description, steps, notified });
  const pristineNew =
    !isEdit &&
    !name.trim() &&
    !description.trim() &&
    steps.length === 1 &&
    !steps[0].approver &&
    notified.length === 0;
  const isDirty = initial !== null && current !== initial && !pristineNew;

  /* ---- step edits ---- */
  const updateStep = (key, patch) =>
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    );
  const addStep = () =>
    setSteps((prev) => [...prev, emptyStep(firstUnusedRole(prev))]);
  const removeStep = (key) =>
    setSteps((prev) => prev.filter((s) => s.key !== key));
  const moveStep = (index, dir) =>
    setSteps((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  /* ---- notified ---- */
  // e.g. drop the Recommending Initial step but keep that person informed
  const stepToNotified = (step) => {
    if (!step.approver) return;
    setSteps((prev) => prev.filter((s) => s.key !== step.key));
    setNotified((prev) =>
      prev.includes(step.approver) ? prev : [...prev, step.approver],
    );
    const who = optionById.get(step.approver)?.label || "They";
    toast.info(`${who} will be notified instead of approving. Save to apply.`);
  };
  // Picking a notified person as an approver takes them off the notified list
  const pickApprover = (stepKey, empId) => {
    updateStep(stepKey, { approver: empId });
    if (notified.includes(empId)) {
      setNotified((prev) => prev.filter((n) => n !== empId));
      const who = optionById.get(empId)?.label || "They";
      toast.info(
        `${who} will approve instead of being notified. Save to apply.`,
      );
    }
  };
  const notifiedChanged =
    notified.length !== initialNotified.length ||
    notified.some((n) => !initialNotified.includes(n));

  /* ---- validation + save ---- */
  const validate = () => {
    if (!name.trim()) return "Give the workflow a name.";
    if (!steps.length) return "Add at least one approver step.";
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].approver) return `Level ${i + 1}: choose an approver.`;
      if (!steps[i].role) return `Level ${i + 1}: choose a role.`;
    }
    if (approverIds.size !== steps.length)
      return "Each approver can only appear once.";
    if (new Set(steps.map((s) => s.role)).size !== steps.length)
      return "Each role can only be used once per workflow.";
    if (!steps.some((s) => s.isEnabled))
      return "At least one step must be turned on.";
    const both = notified.find((pid) => approverIds.has(pid));
    if (both)
      return `${personFor(both)?.label || "Someone"} is both an approver and notified. Keep only one.`;
    return "";
  };

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? updateWorkflowTemplate(id, payload)
        : createWorkflowTemplate(payload),
    onSuccess: async (saved) => {
      await invalidateWorkflowQueries(queryClient);
      if (isEdit) {
        toast.success("Workflow updated.");
        navigate(LIST_PATH);
      } else {
        toast.success("Workflow created.");
        // Next step: choose who uses it
        navigate(
          saved?._id ? `${LIST_PATH}/${saved._id}/employees` : LIST_PATH,
          {
            state: { justCreated: true },
          },
        );
      }
    },
    onError: (err) => setError(getErrMsg(err, "Failed to save workflow")),
  });

  const handleSave = () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      window.scrollTo?.({ top: 0, behavior: "smooth" });
      return;
    }
    setError("");
    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      steps: steps.map((s, i) => ({
        level: i + 1,
        approver: s.approver,
        role: s.role,
        notes: "",
        isEnabled: s.isEnabled,
      })),
      // Only sent when changed here, so this never overwrites the Notified page
      ...(notifiedChanged ? { notifiedEmployees: notified } : {}),
    });
  };

  const go = (to) => (isDirty ? setLeaveTo(to) : navigate(to));
  const goBack = () => go(LIST_PATH);

  const isBusy = mutation.isPending;
  const assignedCount = Object.values(template?.assignmentCounts || {}).reduce(
    (a, b) => a + b,
    0,
  );
  const enabledSteps = steps.filter((s) => s.isEnabled);

  /* ---- edit: loading / not found ---- */
  const loadingTemplate = (isEdit || isDuplicate) && templatesQuery.isLoading;
  const notFound =
    !templatesQuery.isLoading &&
    ((isEdit && !template) || (isDuplicate && !source));

  return (
    <div
      className="flex-1 w-full h-full flex flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="flex-1 overflow-y-auto w-full cto-scrollbar pb-28 lg:pb-10 touch-pan-y">
        <div className="px-3 py-4 md:px-6 max-w-[1300px] mx-auto w-full">
          <Breadcrumbs
            rootLabel="HOME"
            rootTo="/app"
            items={[
              { label: "SHARED WORKFLOWS", to: LIST_PATH },
              isEdit
                ? { label: "EDIT WORKFLOW", to: `${LIST_PATH}/${id}/edit` }
                : isDuplicate
                  ? {
                      label: "DUPLICATE WORKFLOW",
                      to: `${LIST_PATH}/new?from=${fromId}`,
                    }
                  : { label: "NEW WORKFLOW", to: `${LIST_PATH}/new` },
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
                  {isEdit
                    ? `Edit ${template?.name ? `"${template.name}"` : "Workflow"}`
                    : isDuplicate
                      ? `Duplicate ${source?.name ? `"${source.name}"` : "Workflow"}`
                      : "New Shared Workflow"}
                </h1>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--app-muted)" }}
                >
                  {isEdit
                    ? "Changes apply right away to everyone using this workflow."
                    : isDuplicate
                      ? "Rename it and adjust anything you need. After saving, you'll choose which employees use it."
                      : "Set the approvers in order. After saving, you'll choose which employees use it."}
                </p>
              </div>
            </div>
            <div className="hidden md:flex gap-2">
              <OutlineButton
                onClick={goBack}
                disabled={isBusy}
                tone="neutral"
                borderColor={tokens.borderColor}
                theme={tokens.theme}
              >
                Cancel
              </OutlineButton>
              <PrimaryButton
                onClick={handleSave}
                disabled={isBusy || loadingTemplate || notFound}
                borderColor={tokens.borderColor}
                theme={tokens.theme}
              >
                <Save size={16} />{" "}
                {isBusy
                  ? "Saving..."
                  : isEdit
                    ? "Save Changes"
                    : "Create Workflow"}
              </PrimaryButton>
            </div>
          </div>

          {loadingTemplate ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
              <SkeletonLine
                height={420}
                theme={tokens.theme}
                rounded="rounded-xl"
              />
              <SkeletonLine
                height={260}
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
              {(error || (isEdit && assignedCount > 0) || isDuplicate) && (
                <div className="space-y-3 mb-4">
                  {isDuplicate && source && (
                    <InfoStrip
                      icon={Copy}
                      tone="blue"
                      theme={tokens.theme}
                      title={`Copied from "${source.name}"`}
                    >
                      Same approvers and notified people. No employees,
                      designations or projects are copied, so the original
                      workflow keeps its people.
                    </InfoStrip>
                  )}
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
                  {isEdit && assignedCount > 0 && (
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
                    </InfoStrip>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
                {/* ===== Left: details + steps ===== */}
                <div className="space-y-4 min-w-0">
                  <Card borderColor={tokens.borderColor}>
                    <div
                      className="px-4 sm:px-5 py-4 border-b"
                      style={{ borderColor: tokens.borderColor }}
                    >
                      <SectionHeader
                        icon={FileText}
                        title="Details"
                        subtitle="Name it after who it's for"
                      />
                    </div>
                    <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel required>Workflow name</FieldLabel>
                        <TextInput
                          tokens={tokens}
                          value={name}
                          maxLength={100}
                          placeholder="e.g. Site Engineers"
                          onChange={(e) => setName(e.target.value)}
                          autoFocus={!isEdit}
                        />
                      </div>
                      <div>
                        <FieldLabel>Description</FieldLabel>
                        <TextInput
                          tokens={tokens}
                          value={description}
                          maxLength={200}
                          placeholder="Who is this workflow for?"
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                    </div>
                  </Card>

                  <Card borderColor={tokens.borderColor}>
                    <div
                      className="px-4 sm:px-5 py-4 border-b"
                      style={{ borderColor: tokens.borderColor }}
                    >
                      <SectionHeader
                        icon={RouteIcon}
                        title="Approval steps"
                        subtitle={`${plural(steps.length, "step")} · requests go through them in order`}
                      />
                    </div>
                    <div className="p-3 sm:p-4 space-y-2.5">
                      {steps.map((step, index) => (
                        <div
                          key={step.key}
                          className="rounded-xl border p-3"
                          style={{
                            borderColor: tokens.borderColor,
                            backgroundColor: "var(--app-surface-2)",
                            opacity: step.isEnabled ? 1 : 0.7,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold border"
                                style={{
                                  backgroundColor: step.isEnabled
                                    ? "var(--accent-soft)"
                                    : "var(--app-surface)",
                                  color: step.isEnabled
                                    ? "var(--accent)"
                                    : "var(--app-muted)",
                                  borderColor: tokens.borderColor,
                                }}
                              >
                                {index + 1}
                              </span>
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: "var(--app-muted)" }}
                              >
                                Level {index + 1}
                              </span>
                              {!step.isEnabled && (
                                <Chip tone="neutral">Off</Chip>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Toggle
                                checked={step.isEnabled}
                                onChange={(v) =>
                                  updateStep(step.key, { isEnabled: v })
                                }
                                borderColor={tokens.borderColor}
                                theme={tokens.theme}
                                label={`Turn level ${index + 1} ${step.isEnabled ? "off" : "on"}`}
                              />
                              <IconButton
                                title="Move up"
                                disabled={index === 0}
                                onClick={() => moveStep(index, -1)}
                                borderColor={tokens.borderColor}
                              >
                                <ArrowUp size={14} />
                              </IconButton>
                              <IconButton
                                title="Move down"
                                disabled={index === steps.length - 1}
                                onClick={() => moveStep(index, 1)}
                                borderColor={tokens.borderColor}
                              >
                                <ArrowDown size={14} />
                              </IconButton>
                              <IconButton
                                title={
                                  !step.approver
                                    ? "Choose an approver first"
                                    : steps.length <= 1
                                      ? "A workflow needs at least one approver"
                                      : "Notify instead (remove this step, keep them informed)"
                                }
                                disabled={!step.approver || steps.length <= 1}
                                onClick={() => stepToNotified(step)}
                                borderColor={tokens.borderColor}
                              >
                                <Bell size={14} />
                              </IconButton>
                              <IconButton
                                title="Remove step"
                                tone="danger"
                                disabled={steps.length <= 1}
                                onClick={() => removeStep(step.key)}
                                borderColor={tokens.borderColor}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px] gap-3">
                            <div>
                              <FieldLabel>Approver</FieldLabel>
                              <EmployeePicker
                                options={employeeOptions}
                                loading={employeesLoading}
                                value={step.approver}
                                disabledValues={approverIds}
                                onChange={(empId) =>
                                  pickApprover(step.key, empId)
                                }
                                placeholder="Select an approver..."
                                tokens={tokens}
                              />
                            </div>
                            <div>
                              <FieldLabel>Role</FieldLabel>
                              <SelectInput
                                tokens={tokens}
                                value={step.role}
                                onChange={(e) =>
                                  updateStep(step.key, { role: e.target.value })
                                }
                                aria-label={`Role for level ${index + 1}`}
                              >
                                <option value="" disabled>
                                  Select a role...
                                </option>
                                {roles.map((r) => {
                                  const usedElsewhere = steps.some(
                                    (s) =>
                                      s.key !== step.key && s.role === r.id,
                                  );
                                  return (
                                    <option
                                      key={r.id}
                                      value={r.id}
                                      disabled={usedElsewhere}
                                    >
                                      {r.label}
                                      {usedElsewhere ? " (used)" : ""}
                                    </option>
                                  );
                                })}
                              </SelectInput>
                            </div>
                          </div>
                        </div>
                      ))}

                      <OutlineButton
                        onClick={addStep}
                        disabled={
                          roles.length > 0 && steps.length >= roles.length
                        }
                        borderColor={tokens.borderColor}
                        theme={tokens.theme}
                        className="w-full"
                        title={
                          roles.length > 0 && steps.length >= roles.length
                            ? "Every role is already used"
                            : undefined
                        }
                      >
                        <Plus size={16} /> Add Step
                      </OutlineButton>
                    </div>
                  </Card>
                </div>

                {/* ===== Right: preview + notified ===== */}
                <div className="space-y-4 lg:sticky lg:top-4 min-w-0">
                  <Card borderColor={tokens.borderColor}>
                    <div
                      className="px-4 py-3.5 border-b"
                      style={{ borderColor: tokens.borderColor }}
                    >
                      <SectionHeader
                        icon={Eye}
                        tone="blue"
                        title="Preview"
                        subtitle="Who approves, in order"
                      />
                    </div>
                    <div className="p-4">
                      {enabledSteps.length === 0 ||
                      !enabledSteps.some((s) => s.approver) ? (
                        <p
                          className="text-xs text-center py-4"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Choose approvers to see the order here.
                        </p>
                      ) : (
                        <ol className="relative space-y-3">
                          {enabledSteps.map((s, i) => {
                            const o = optionById.get(s.approver);
                            return (
                              <li
                                key={s.key}
                                className="flex items-start gap-3"
                              >
                                <div className="flex flex-col items-center">
                                  <Avatar
                                    initials={o?.initials || "?"}
                                    size={8}
                                    enabled={Boolean(o)}
                                  />
                                  {i < enabledSteps.length - 1 && (
                                    <span
                                      className="w-px h-4 mt-1"
                                      style={{
                                        backgroundColor: tokens.borderColor,
                                      }}
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 pt-0.5">
                                  <div
                                    className="text-sm font-semibold truncate"
                                    style={{
                                      color: o
                                        ? "var(--app-text)"
                                        : "var(--app-muted)",
                                    }}
                                  >
                                    {i + 1}. {o?.label || "No approver yet"}
                                  </div>
                                  <div
                                    className="text-[11px] truncate"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    {roleLabel(s.role)}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      {steps.length > enabledSteps.length && (
                        <p
                          className="text-[11px] mt-3"
                          style={{ color: "var(--app-muted)" }}
                        >
                          {plural(steps.length - enabledSteps.length, "step")}{" "}
                          turned off and skipped.
                        </p>
                      )}
                    </div>
                  </Card>

                  <Card borderColor={tokens.borderColor}>
                    <div
                      className="px-4 py-3.5 border-b"
                      style={{ borderColor: tokens.borderColor }}
                    >
                      <SectionHeader
                        icon={Bell}
                        tone="amber"
                        title="Notified employees"
                        subtitle={`${notified.length === 1 ? "1 person" : `${notified.length} people`} · they don't approve`}
                      />
                    </div>
                    <div className="p-4 space-y-3">
                      {notified.length > 0 ? (
                        <ul
                          className="space-y-1.5"
                          aria-label="Notified employees"
                        >
                          {notified.map((pid) => {
                            const p = personFor(pid);
                            const isNew = !notifiedBaseline.includes(pid);
                            return (
                              <li
                                key={pid}
                                className="flex items-center gap-2 min-w-0"
                              >
                                <Avatar
                                  initials={p?.initials || "?"}
                                  size={6}
                                />
                                <span
                                  className="text-xs truncate flex-1"
                                  style={{ color: "var(--app-text)" }}
                                >
                                  {p?.label || "Unknown employee"}
                                </span>
                                {isNew && (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: "var(--accent)" }}
                                  >
                                    New
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p
                          className="text-xs"
                          style={{ color: "var(--app-muted)" }}
                        >
                          No one yet. Use the bell on a step to notify that
                          person instead of having them approve.
                        </p>
                      )}
                      <p
                        className="text-[11px] flex items-start gap-1.5"
                        style={{ color: "var(--app-muted)" }}
                      >
                        <Info size={12} className="flex-none mt-0.5" />
                        <span>
                          {isEdit
                            ? "Add or remove notified people on the Notified page."
                            : "After creating, add or remove people with the Notified button on the workflow card."}
                        </span>
                      </p>
                      {isEdit && (
                        <OutlineButton
                          onClick={() => go(`${LIST_PATH}/${id}/notified`)}
                          borderColor={tokens.borderColor}
                          theme={tokens.theme}
                          className="w-full !py-1.5 !text-xs"
                        >
                          <Bell size={14} /> Manage Notified
                        </OutlineButton>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile action bar */}
      {!loadingTemplate && !notFound && (
        <div
          className="md:hidden fixed bottom-0 inset-x-0 z-[5] px-3 py-3 border-t flex gap-2"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: tokens.borderColor,
          }}
        >
          <OutlineButton
            onClick={goBack}
            disabled={isBusy}
            tone="neutral"
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="flex-1"
          >
            Cancel
          </OutlineButton>
          <PrimaryButton
            onClick={handleSave}
            disabled={isBusy}
            borderColor={tokens.borderColor}
            theme={tokens.theme}
            className="flex-[2]"
          >
            <Save size={16} />{" "}
            {isBusy ? "Saving..." : isEdit ? "Save Changes" : "Create Workflow"}
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
            navigate(to);
          },
        }}
      >
        <div className="p-2 text-sm" style={{ color: "var(--app-text)" }}>
          You have unsaved changes to this workflow. Leave without saving?
        </div>
      </Modal>
    </div>
  );
}
