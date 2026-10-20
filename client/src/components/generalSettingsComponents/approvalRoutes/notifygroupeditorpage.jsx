// NotifyGroupEditorPage.jsx
// Create / edit a notify group: the people who get notified (no approval)
// when the group's employees file a CTO/Wellness request.
//   /app/shared-workflows/notify/new
//   /app/shared-workflows/notify/:id/edit
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Bell,
  X,
  AlertTriangle,
  FileText,
  Save,
  Info,
  Users,
  Lock,
  Unlock,
} from "lucide-react";

import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";
import Modal from "../../modal";
import {
  fetchNotifyGroup,
  createNotifyGroup,
  updateNotifyGroup,
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
  FieldLabel,
  TextInput,
  SkeletonLine,
  EmployeePicker,
  useApproverOptions,
  invalidateWorkflowQueries,
  getErrMsg,
  idOf,
  plural,
} from "./workflowUi";

const LIST_PATH = "/app/shared-workflows";
const BACK = { pathname: LIST_PATH, state: { tab: "notify" } };

const snapshot = ({ name, description, notified, locked }) =>
  JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    notified: [...notified].sort(),
    locked,
  });

export default function NotifyGroupEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { preferences } = useAuth();
  const tokens = useThemeTokens(preferences?.theme || "system");
  const { options: employeeOptions, isLoading: employeesLoading } =
    useApproverOptions();

  const groupQuery = useQuery({
    queryKey: ["notifyGroups", "one", id],
    queryFn: () => fetchNotifyGroup(id),
    enabled: isEdit,
    retry: false,
  });
  const group = groupQuery.data;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notified, setNotified] = useState([]);
  // On = employees can't remove these people; off = each employee can remove them from their own requests
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState("");
  const [initial, setInitial] = useState(
    isEdit
      ? null
      : snapshot({ name: "", description: "", notified: [], locked: true }),
  );
  const [leaveOpen, setLeaveOpen] = useState(false);
  const loadedFor = useRef(null);

  // Fill the form once (later refetches don't overwrite your edits)
  useEffect(() => {
    if (!isEdit || !group || loadedFor.current === group._id) return;
    loadedFor.current = group._id;
    const form = {
      name: group.name || "",
      description: group.description || "",
      notified: (group.notifiedEmployees || []).map(idOf),
      locked: group.locked !== false,
    };
    setName(form.name);
    setDescription(form.description);
    setNotified(form.notified);
    setLocked(form.locked);
    setInitial(snapshot(form));
  }, [isEdit, group]);

  const optionById = useMemo(
    () => new Map(employeeOptions.map((o) => [o.value, o])),
    [employeeOptions],
  );
  // Fall back to the populated names from the group if someone isn't in the approvers list
  const personFor = (pid) => {
    const o = optionById.get(pid);
    if (o) return o;
    const emp = (group?.notifiedEmployees || []).find((e) => idOf(e) === pid);
    return emp
      ? {
          value: pid,
          label: [emp.firstName, emp.lastName].filter(Boolean).join(" "),
          initials:
            `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase() ||
            "?",
          position: emp.position || "",
        }
      : null;
  };

  const isDirty =
    initial !== null &&
    snapshot({ name, description, notified, locked }) !== initial;

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? updateNotifyGroup(id, payload) : createNotifyGroup(payload),
    onSuccess: async (saved) => {
      await invalidateWorkflowQueries(queryClient);
      if (isEdit) {
        toast.success("Notify group updated.");
        navigate(BACK.pathname, { state: BACK.state });
      } else {
        toast.success("Notify group created.");
        navigate(
          saved?._id ? `${LIST_PATH}/notify/${saved._id}/employees` : LIST_PATH,
          {
            state: saved?._id ? { justCreated: true } : BACK.state,
          },
        );
      }
    },
    onError: (err) => setError(getErrMsg(err, "Failed to save notify group")),
  });

  const handleSave = () => {
    if (!name.trim()) return setError("Give the group a name.");
    if (!notified.length) return setError("Add at least one person to notify.");
    setError("");
    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      notifiedEmployees: notified,
      locked,
    });
  };

  const goBack = () =>
    isDirty
      ? setLeaveOpen(true)
      : navigate(BACK.pathname, { state: BACK.state });

  const isBusy = mutation.isPending;
  const loading = isEdit && groupQuery.isLoading;
  const notFound = isEdit && !groupQuery.isLoading && !group;

  return (
    <div
      className="flex-1 w-full h-full flex flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="flex-1 overflow-y-auto w-full cto-scrollbar pb-28 lg:pb-10 touch-pan-y">
        <div className="px-3 py-4 md:px-6 max-w-[1100px] mx-auto w-full">
          <Breadcrumbs
            rootLabel="HOME"
            rootTo="/app"
            items={[
              { label: "SHARED WORKFLOWS", to: LIST_PATH },
              {
                label: isEdit ? "EDIT NOTIFY GROUP" : "NEW NOTIFY GROUP",
                to: isEdit
                  ? `${LIST_PATH}/notify/${id}/edit`
                  : `${LIST_PATH}/notify/new`,
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
                  {isEdit
                    ? `Edit "${group?.name || "Notify Group"}"`
                    : "New Notify Group"}
                </h1>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--app-muted)" }}
                >
                  {isEdit
                    ? "Changes apply right away to every employee in this group."
                    : "Pick who gets notified. After saving, you'll choose which employees this group is for."}
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
                disabled={isBusy || loading || notFound}
                borderColor={tokens.borderColor}
                theme={tokens.theme}
              >
                <Save size={16} />{" "}
                {isBusy
                  ? "Saving..."
                  : isEdit
                    ? "Save Changes"
                    : "Create Group"}
              </PrimaryButton>
            </div>
          </div>

          {loading ? (
            <SkeletonLine
              height={360}
              theme={tokens.theme}
              rounded="rounded-xl"
            />
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
            <div className="space-y-4">
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
              {isEdit && group?.memberCount > 0 && (
                <InfoStrip
                  icon={Users}
                  tone="amber"
                  theme={tokens.theme}
                  title="This group is in use"
                >
                  {plural(group.memberCount, "employee")} in this group. Changes
                  apply to all of them as soon as you save.
                </InfoStrip>
              )}

              <Card borderColor={tokens.borderColor}>
                <div
                  className="px-4 sm:px-5 py-4 border-b"
                  style={{ borderColor: tokens.borderColor }}
                >
                  <SectionHeader
                    icon={FileText}
                    title="Details"
                    subtitle="Name it after who gets notified"
                  />
                </div>
                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>Group name</FieldLabel>
                    <TextInput
                      tokens={tokens}
                      value={name}
                      maxLength={100}
                      placeholder="e.g. HR Team"
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
                      placeholder="Who is this for?"
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
                    icon={Bell}
                    tone="amber"
                    title="People to notify"
                    subtitle={`${notified.length === 1 ? "1 person" : `${notified.length} people`} · they get notified, they don't approve`}
                  />
                </div>
                <div className="p-4 sm:p-5 space-y-3">
                  {notified.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {notified.map((pid) => {
                        const p = personFor(pid);
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border text-sm max-w-full"
                            style={{
                              borderColor: tokens.borderColor,
                              color: "var(--app-text)",
                            }}
                          >
                            <Avatar initials={p?.initials || "?"} size={6} />
                            <span className="truncate">
                              {p?.label || "Unknown"}
                            </span>
                            {p?.position && (
                              <span
                                className="hidden sm:inline text-[11px] truncate"
                                style={{ color: "var(--app-muted)" }}
                              >
                                {p.position}
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label={`Remove ${p?.label || "person"}`}
                              onClick={() =>
                                setNotified((prev) =>
                                  prev.filter((n) => n !== pid),
                                )
                              }
                              className="ml-0.5 rounded-full p-0.5 hover:bg-[color:var(--app-surface-2)]"
                              style={{ color: "var(--app-muted)" }}
                            >
                              <X size={13} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p
                      className="text-xs"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Nobody yet. Add at least one person.
                    </p>
                  )}
                  <EmployeePicker
                    options={employeeOptions}
                    loading={employeesLoading}
                    value=""
                    disabledValues={new Set(notified)}
                    onChange={(pid) =>
                      setNotified((prev) =>
                        prev.includes(pid) ? prev : [...prev, pid],
                      )
                    }
                    placeholder="Add someone to notify..."
                    tokens={tokens}
                  />
                </div>
                <div
                  className="px-4 sm:px-5 py-4 border-t flex items-start gap-3"
                  style={{ borderColor: tokens.borderColor }}
                >
                  {locked ? (
                    <Lock
                      size={18}
                      className="flex-none mt-0.5"
                      style={{ color: "#d97706" }}
                    />
                  ) : (
                    <Unlock
                      size={18}
                      className="flex-none mt-0.5"
                      style={{ color: "var(--app-muted)" }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: "var(--app-text)" }}
                    >
                      Employees can't remove these people
                    </div>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {locked
                        ? "On: they're always notified. Employees see them locked in their Notified Employees."
                        : "Off: each employee in this group can remove them from their own requests."}
                    </p>
                  </div>
                  <Toggle
                    checked={locked}
                    onChange={setLocked}
                    borderColor={tokens.borderColor}
                    theme={tokens.theme}
                    label="Employees can't remove these people"
                  />
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {!loading && !notFound && (
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
            {isBusy ? "Saving..." : isEdit ? "Save Changes" : "Create Group"}
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
          You have unsaved changes to this notify group. Leave without saving?
        </div>
      </Modal>
    </div>
  );
}
