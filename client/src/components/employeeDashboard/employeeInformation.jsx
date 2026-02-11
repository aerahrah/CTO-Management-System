import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployeeById, updateEmployeeById } from "../../api/employee";
import { StatusBadge, RoleBadge } from "../statusUtils";
import { useParams, useNavigate } from "react-router-dom";
import Modal from "../modal";
import Breadcrumbs from "../breadCrumbs";
import { toast } from "react-toastify";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  ShieldCheck,
  Clock,
  Edit3,
  Building2,
  Hash,
  Copy,
  Check,
  MoreHorizontal,
  Layers,
  AlertCircle,
} from "lucide-react";

/* =========================
   Utils
========================= */
const isEmail = (v) =>
  typeof v === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());

const normalize = (v) => String(v ?? "").trim();

const formatDate = (dateString, opts = {}) => {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...opts,
  }).format(d);
};

const calculateTenure = (dateString) => {
  if (!dateString) return "";
  const start = new Date(dateString);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return "";

  const diffMs = Math.max(0, now - start);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  if (diffDays < 365) {
    const months = Math.max(1, Math.floor(diffDays / 30));
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const years = diffDays / 365;
  return `${years.toFixed(1)} year${years.toFixed(1) === "1.0" ? "" : "s"}`;
};

const safeCopy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/* =========================
   UI Primitives (MINIMALIST)
========================= */
const Card = ({ title, subtitle, action, children, className = "" }) => (
  <div
    className={[
      "bg-white/80 backdrop-blur",
      "rounded-2xl",
      "border border-slate-200/70",
      "shadow-[0_1px_0_rgba(15,23,42,0.04)]",
      "transition",
      "hover:border-slate-300/70 hover:shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
      className,
    ].join(" ")}
  >
    {(title || action) && (
      <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {title && (
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 text-slate-400">{action}</div>}
      </div>
    )}
    <div className="px-6 py-5">{children}</div>
  </div>
);

const SectionHeader = ({ icon: Icon, title, right }) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-2">
      <div className="p-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60">
        <Icon size={16} />
      </div>
      <h2 className="text-sm font-medium text-slate-700">{title}</h2>
    </div>
    {right}
  </div>
);

const Pill = ({ children, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-indigo-50 text-indigo-700 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <span
      className={[
        "inline-flex items-center",
        "px-2.5 py-1",
        "rounded-full",
        "text-xs font-medium",
        "border",
        tones[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
};

/* =========================
   Secure Edit Form (MINIMALIST)
========================= */
const EmployeeEditForm = forwardRef(
  (
    { employeeId, initialEmployee, onPendingChange, onDirtyChange, onSaved },
    ref,
  ) => {
    const queryClient = useQueryClient();

    // hard locks
    const submitLockRef = useRef(false);
    const submittedSuccessRef = useRef(false);
    const [lockAfterSuccess, setLockAfterSuccess] = useState(false);

    const initial = useMemo(() => {
      const e = initialEmployee || {};
      return {
        firstName: normalize(e.firstName),
        lastName: normalize(e.lastName),
        email: normalize(e.email),
        phone: normalize(e.phone),
        department: normalize(e.department),
        position: normalize(e.position),
        employeeId: normalize(e.employeeId),
        addressStreet: normalize(e.address?.street),
        addressCity: normalize(e.address?.city),
        addressProvince: normalize(e.address?.province),
      };
    }, [initialEmployee]);

    const [form, setForm] = useState(initial);

    useEffect(() => {
      setForm(initial);
      submitLockRef.current = false;
      submittedSuccessRef.current = false;
      setLockAfterSuccess(false);
    }, [initial]);

    const dirty = useMemo(() => {
      const keys = Object.keys(initial);
      return keys.some((k) => normalize(form[k]) !== normalize(initial[k]));
    }, [form, initial]);

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    const mutation = useMutation({
      mutationFn: (payload) => updateEmployeeById(employeeId, payload),
      retry: 0,
      onSuccess: () => {
        toast.success("Profile updated successfully");
        queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
        queryClient.invalidateQueries({ queryKey: ["employees"] });

        submittedSuccessRef.current = true;
        setLockAfterSuccess(true);
        onSaved?.();
      },
      onError: (error) => {
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "Failed to update profile",
        );
      },
      onSettled: () => {
        submitLockRef.current = false;
        onPendingChange?.(false);
      },
    });

    const busy =
      mutation.isPending || submitLockRef.current || lockAfterSuccess;

    useEffect(() => {
      onPendingChange?.(busy);
    }, [busy, onPendingChange]);

    const setField = (name) => (e) => {
      const value = e?.target?.value ?? "";
      setForm((p) => ({ ...p, [name]: value }));
    };

    const sanitizeAndValidate = () => {
      const payload = {
        firstName: normalize(form.firstName),
        lastName: normalize(form.lastName),
        email: normalize(form.email).toLowerCase(),
        phone: normalize(form.phone),
        department: normalize(form.department),
        position: normalize(form.position),
        employeeId: normalize(form.employeeId),
        address: {
          street: normalize(form.addressStreet),
          city: normalize(form.addressCity),
          province: normalize(form.addressProvince),
        },
      };

      if (!payload.firstName || !payload.lastName) {
        toast.error("First name and last name are required.");
        return { ok: false };
      }

      if (payload.email && !isEmail(payload.email)) {
        toast.error("Please enter a valid email address.");
        return { ok: false };
      }

      return { ok: true, payload };
    };

    const submit = async () => {
      if (submittedSuccessRef.current) return;
      if (busy) return;

      if (submitLockRef.current) return;
      submitLockRef.current = true;
      onPendingChange?.(true);

      if (!dirty) {
        toast.info("No changes to save.");
        submitLockRef.current = false;
        onPendingChange?.(false);
        return;
      }

      const { ok, payload } = sanitizeAndValidate();
      if (!ok) {
        submitLockRef.current = false;
        onPendingChange?.(false);
        return;
      }

      try {
        await mutation.mutateAsync(payload);
      } catch {
        // handled by mutation
      }
    };

    useImperativeHandle(ref, () => ({
      submit,
      isLoading: busy,
      isDirty: dirty,
      reset: () => setForm(initial),
    }));

    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-slate-500">Edit fields</div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <AlertCircle size={14} className="text-slate-400" />
            {dirty ? "Unsaved changes" : "No changes"}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="First Name"
            value={form.firstName}
            onChange={setField("firstName")}
            disabled={busy}
          />
          <Field
            label="Last Name"
            value={form.lastName}
            onChange={setField("lastName")}
            disabled={busy}
          />

          <Field
            label="Email"
            value={form.email}
            onChange={setField("email")}
            disabled={busy}
          />
          <Field
            label="Phone"
            value={form.phone}
            onChange={setField("phone")}
            disabled={busy}
          />

          <Field
            label="Department"
            value={form.department}
            onChange={setField("department")}
            disabled={busy}
          />
          <Field
            label="Position"
            value={form.position}
            onChange={setField("position")}
            disabled={busy}
          />

          <Field
            label="Employee ID"
            value={form.employeeId}
            onChange={setField("employeeId")}
            disabled={busy}
          />

          <div className="md:col-span-2">
            <div className="text-xs text-slate-500 mb-2">Address</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field
                label="Street"
                value={form.addressStreet}
                onChange={setField("addressStreet")}
                disabled={busy}
              />
              <Field
                label="City"
                value={form.addressCity}
                onChange={setField("addressCity")}
                disabled={busy}
              />
              <Field
                label="Province"
                value={form.addressProvince}
                onChange={setField("addressProvince")}
                disabled={busy}
              />
            </div>
          </div>
        </div>

        {lockAfterSuccess && (
          <div className="mt-5 p-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 text-emerald-900 text-sm">
            Saved. Editing is locked for safety. Close this window to continue.
          </div>
        )}
      </div>
    );
  },
);

const Field = ({ label, value, onChange, disabled }) => (
  <label className="block">
    <div className="text-xs text-slate-500 mb-1">{label}</div>
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={[
        "w-full h-11 px-3",
        "bg-white",
        "border border-slate-200/80",
        "rounded-xl",
        "text-sm text-slate-900",
        "outline-none",
        "focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100",
        "transition",
        "disabled:opacity-60 disabled:bg-slate-50",
      ].join(" ")}
    />
  </label>
);

/* =========================
   Main: EmployeeInformation (MINIMALIST)
========================= */
const EmployeeInformation = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState("overview");
  const [isEditOpen, setIsEditOpen] = useState(false);

  // edit modal (secure)
  const editFormRef = useRef(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editDirty, setEditDirty] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployeeById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const emp = data?.data;

  const onRetry = () =>
    queryClient.refetchQueries({ queryKey: ["employee", id] });

  const openEdit = () => {
    setEditBusy(false);
    setEditDirty(false);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (editBusy) return;
    setIsEditOpen(false);
  };

  const copyToClipboard = async (text, label) => {
    if (!text) return;
    const ok = await safeCopy(text);
    if (ok) {
      toast.success(`${label} copied`, {
        autoClose: 900,
        position: "bottom-center",
      });
    } else {
      toast.error("Copy failed. Please try again.");
    }
  };

  if (!id) return <EmptyState />;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (isLoading || !emp) return <EmployeeSkeleton />;

  const initials = `${emp?.firstName?.[0] ?? ""}${emp?.lastName?.[0] ?? ""}`
    .trim()
    .toUpperCase();

  return (
    <div className="min-h-screen font-sans text-slate-900">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <Breadcrumbs rootLabel="home" rootTo="/app" />
        <div className="bg-white/80 backdrop-blur rounded-xl border border-slate-200/70 overflow-hidden shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="px-6 pt-5 pb-4 border-b border-slate-200/60">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="mt-3 flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-base font-semibold shadow-sm">
                    {initials || "?"}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight truncate">
                        {emp?.firstName} {emp?.lastName}
                      </h1>
                      <StatusBadge status={emp?.status} />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-slate-400" />
                        {emp?.department || "-"}
                      </span>
                      <span className="hidden sm:inline text-slate-300">•</span>
                      <span className="flex items-center gap-1.5">
                        <Briefcase size={14} className="text-slate-400" />
                        {emp?.position || "-"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Pill tone="slate">Employee</Pill>
                      {emp?.dateHired && (
                        <Pill tone="emerald">
                          {calculateTenure(emp?.dateHired)} tenure
                        </Pill>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <button
                  type="button"
                  onClick={() => navigate(`/app/employees/${emp?._id}/update`)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium
                             hover:bg-blue-700 active:scale-[0.99] transition shadow-sm"
                >
                  <ShieldCheck size={16} />
                  Update Profile
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-white/60 border border-slate-200/60">
              <TabButton
                active={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
                label="Overview"
                icon={<Layers size={16} />}
              />
              <TabButton
                active={activeTab === "personal"}
                onClick={() => setActiveTab("personal")}
                label="Personal Info"
                icon={<User size={16} />}
              />
              <TabButton
                active={activeTab === "job"}
                onClick={() => setActiveTab("job")}
                label="Job Details"
                icon={<Briefcase size={16} />}
              />
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 bg-transparent">
            <div className="max-w-5xl mx-auto space-y-6">
              {activeTab === "overview" && (
                <>
                  <section>
                    <SectionHeader icon={Clock} title="Leave Balances" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <MetricTile
                        label="Vacation Leave"
                        value={emp?.balances?.vlHours}
                        tone="blue"
                        icon={<Briefcase size={18} />}
                      />
                      <MetricTile
                        label="Sick Leave"
                        value={emp?.balances?.slHours}
                        tone="rose"
                        icon={<Clock size={18} />}
                      />
                      <MetricTile
                        label="Compensatory"
                        value={emp?.balances?.ctoHours}
                        tone="emerald"
                        icon={<Layers size={18} />}
                      />
                    </div>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card
                      title="Quick Contact"
                      subtitle="Copy or tap to contact"
                      action={<MoreHorizontal size={16} />}
                    >
                      <div className="space-y-2">
                        <ContactRow
                          icon={<Mail size={16} />}
                          label="Email"
                          value={emp?.email}
                          onCopy={() => copyToClipboard(emp?.email, "Email")}
                          isLink
                          href={emp?.email ? `mailto:${emp.email}` : undefined}
                        />
                        <ContactRow
                          icon={<Phone size={16} />}
                          label="Phone"
                          value={emp?.phone}
                          onCopy={() => copyToClipboard(emp?.phone, "Phone")}
                        />
                        <ContactRow
                          icon={<Hash size={16} />}
                          label="Employee ID"
                          value={emp?.employeeId}
                          onCopy={() => copyToClipboard(emp?.employeeId, "ID")}
                        />
                      </div>
                    </Card>

                    <Card
                      title="Work Status"
                      subtitle="Role, hire date, and status"
                      action={<MoreHorizontal size={16} />}
                    >
                      <div className="space-y-2">
                        <DataRow label="System Role">
                          <RoleBadge role={emp?.role} />
                        </DataRow>

                        <DataRow label="Date Hired">
                          <div className="text-right">
                            <div className="text-slate-900 font-medium">
                              {emp?.dateHired
                                ? formatDate(emp.dateHired, {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "-"}
                            </div>
                            {emp?.dateHired && (
                              <div className="mt-2">
                                <Pill tone="blue">
                                  {calculateTenure(emp.dateHired)} tenure
                                </Pill>
                              </div>
                            )}
                          </div>
                        </DataRow>

                        <DataRow label="Employment Status">
                          <StatusBadge status={emp?.status} />
                        </DataRow>
                      </div>
                    </Card>
                  </div>
                </>
              )}

              {activeTab === "personal" && (
                <div className="grid grid-cols-1 gap-6">
                  <Card
                    title="Identity & Address"
                    subtitle="Profile and permanent address details"
                    action={<MoreHorizontal size={16} />}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                      <DataBlock
                        label="Full Name"
                        value={`${emp?.firstName ?? ""} ${emp?.lastName ?? ""}`.trim()}
                      />
                      <DataBlock
                        label="Username"
                        value={emp?.username ? `@${emp.username}` : "-"}
                      />

                      <div className="md:col-span-2 border-t border-slate-200/60 pt-5">
                        <DataBlock
                          label="Permanent Address"
                          icon={<MapPin size={14} className="text-slate-400" />}
                          value={
                            `${emp?.address?.street || ""}${
                              emp?.address?.street ? ", " : ""
                            }${emp?.address?.city || ""}${
                              emp?.address?.city ? ", " : ""
                            }${emp?.address?.province || ""}`.trim() || "-"
                          }
                        />
                      </div>
                    </div>
                  </Card>

                  <Card
                    title="Emergency Contact"
                    subtitle="For urgent situations"
                    action={<MoreHorizontal size={16} />}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl border border-slate-200/60">
                        <ShieldCheck size={22} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {emp?.emergencyContact?.name || "Not Set"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {emp?.emergencyContact?.relation || "-"}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "job" && (
                <div className="space-y-6">
                  <Card
                    title="Employment Details"
                    subtitle="Department, position, and join date"
                    action={<MoreHorizontal size={16} />}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                      <DataBlock label="Department" value={emp?.department} />
                      <DataBlock label="Position" value={emp?.position} />
                      <DataBlock
                        label="Employment Status"
                        value={<StatusBadge status={emp?.status} />}
                      />
                      <DataBlock
                        label="Date Joined"
                        value={
                          emp?.dateHired
                            ? formatDate(emp.dateHired, {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "-"
                        }
                      />
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Modal (SECURE) */}
        <Modal
          isOpen={isEditOpen}
          onClose={closeEdit}
          title="Edit Profile"
          closeLabel="Cancel"
          isBusy={editBusy}
          preventCloseWhenBusy={true}
          action={{
            show: true,
            variant: "save",
            label: editBusy ? "Saving..." : "Save Changes",
            disabled: editBusy || !editDirty,
            onClick: () => editFormRef.current?.submit?.(),
          }}
        >
          <EmployeeEditForm
            ref={editFormRef}
            employeeId={id}
            initialEmployee={emp}
            onPendingChange={(v) => setEditBusy(!!v)}
            onDirtyChange={(v) => setEditDirty(!!v)}
            onSaved={() => setIsEditOpen(false)}
          />
        </Modal>
      </div>
    </div>
  );
};

/* =========================
   Subcomponents (MINIMALIST)
========================= */
const TabButton = ({ active, onClick, label, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "shrink-0 inline-flex items-center gap-2",
      "px-3.5 py-2 rounded-xl text-sm",
      "border transition",
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
        : "bg-white/70 text-slate-700 border-slate-200/70 hover:bg-white hover:border-slate-300/70",
    ].join(" ")}
  >
    <span className={active ? "text-white/90" : "text-slate-400"}>{icon}</span>
    <span className="font-medium">{label}</span>
  </button>
);

const MetricTile = ({ label, value, tone, icon }) => {
  const num = parseFloat(value || 0);
  const display = Number.isFinite(num)
    ? num % 1 === 0
      ? num
      : num.toFixed(1)
    : 0;

  const tones = {
    blue: "bg-white border-slate-200/70",
    rose: "bg-white border-slate-200/70",
    emerald: "bg-white border-slate-200/70",
  };

  return (
    <div
      className={[
        "p-5 rounded-2xl border",
        tones[tone],
        "flex items-center justify-between",
        "transition",
        "hover:shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:border-slate-300/70",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900 tracking-tight">
          {display}
        </div>
        <div className="text-xs text-slate-400 mt-1">Hours</div>
      </div>

      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-600">
        {icon}
      </div>
    </div>
  );
};

const ContactRow = ({ icon, label, value, onCopy, isLink, href }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await onCopy?.();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex items-center justify-between gap-3 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-xl bg-slate-50 text-slate-500 border border-slate-200/60 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-500">{label}</div>
          {isLink && href ? (
            <a
              href={href}
              className="block text-sm font-medium text-slate-900 truncate hover:text-indigo-700 hover:underline"
            >
              {value || "-"}
            </a>
          ) : (
            <div className="text-sm font-medium text-slate-900 truncate">
              {value || "-"}
            </div>
          )}
        </div>
      </div>

      {value ? (
        <button
          type="button"
          onClick={handleCopy}
          className="p-2 rounded-xl border border-transparent text-slate-400 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200/60 transition
                     opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          title="Copy"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      ) : (
        <span className="text-xs text-slate-300">—</span>
      )}
    </div>
  );
};

const DataRow = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-200/60 last:border-0">
    <span className="text-sm text-slate-600">{label}</span>
    <div className="shrink-0">{children}</div>
  </div>
);

const DataBlock = ({ label, value, icon }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-slate-500 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className="text-sm md:text-base font-medium text-slate-900 break-words">
      {value || <span className="text-slate-400">Not specified</span>}
    </span>
  </div>
);

/* =========================
   States (MINIMALIST)
========================= */
const EmptyState = () => (
  <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
    <div className="w-full max-w-xl bg-white/80 backdrop-blur rounded-2xl border border-slate-200/70 text-center p-10 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200/60 mx-auto mb-4 text-slate-500">
        <User size={26} />
      </div>
      <h3 className="text-slate-900 font-semibold text-lg">
        No Profile Selected
      </h3>
      <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
        Select an employee from the list to view their details here.
      </p>
    </div>
  </div>
);

const ErrorState = ({ onRetry }) => (
  <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
    <div className="w-full max-w-xl bg-white/80 backdrop-blur rounded-2xl border border-slate-200/70 p-10 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div className="w-12 h-12 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200/60 flex items-center justify-center mx-auto mb-4">
        <AlertCircle size={20} />
      </div>
      <p className="font-semibold text-slate-900 text-lg">
        Failed to load profile
      </p>
      <p className="text-sm text-slate-600 mt-2">
        Please check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 px-4 py-2.5 rounded-xl bg-white/70 border border-slate-200/70 text-sm font-medium text-slate-800
                   hover:bg-white hover:border-slate-300/70 hover:shadow-sm transition"
      >
        Try Again
      </button>
    </div>
  </div>
);

const EmployeeSkeleton = () => (
  <div className="min-h-screen bg-slate-50 p-6 md:p-10 animate-pulse">
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/70 overflow-hidden shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="px-6 pt-5 pb-4 border-b border-slate-200/60">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-slate-200/60 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-64 bg-slate-200/60 rounded-lg" />
              <div className="h-4 w-40 bg-slate-200/60 rounded-lg" />
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <div className="h-10 w-28 bg-slate-200/60 rounded-xl" />
            <div className="h-10 w-32 bg-slate-200/60 rounded-xl" />
            <div className="h-10 w-28 bg-slate-200/60 rounded-xl" />
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-28 bg-white border border-slate-200/70 rounded-2xl" />
            <div className="h-28 bg-white border border-slate-200/70 rounded-2xl" />
            <div className="h-28 bg-white border border-slate-200/70 rounded-2xl" />
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-white border border-slate-200/70 rounded-2xl" />
            <div className="h-64 bg-white border border-slate-200/70 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default EmployeeInformation;
