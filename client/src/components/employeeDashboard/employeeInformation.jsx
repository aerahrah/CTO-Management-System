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
import { toast } from "react-toastify";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  ChevronLeft,
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
   SECURE EDIT FORM (CTO-style locks)
========================= */
const isEmail = (v) =>
  typeof v === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());

const normalize = (v) => String(v ?? "").trim();

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
      // reset when opening for a different employee / refreshed employee
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
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Edit Fields
          </div>
          <div className="text-[11px] text-gray-400 flex items-center gap-1">
            <AlertCircle size={12} />
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
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Address
            </div>
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
      </div>
    );
  },
);

const Field = ({ label, value, onChange, disabled }) => (
  <label className="block">
    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
      {label}
    </div>
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-70"
    />
  </label>
);

/* =========================
   MAIN: EmployeeInformation
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

  const {
    data: employee,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployeeById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const emp = employee?.data;

  const calculateTenure = (dateString) => {
    if (!dateString) return "";
    const start = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays} Days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} Months`;
    return `${(diffDays / 365).toFixed(1)} Years`;
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`, {
      autoClose: 1000,
      position: "bottom-center",
    });
  };

  if (!id) return <EmptyState />;
  if (isError)
    return (
      <ErrorState
        onRetry={() =>
          queryClient.refetchQueries({ queryKey: ["employee", id] })
        }
      />
    );
  if (isLoading || !emp) return <EmployeeSkeleton />;

  return (
    <div className="flex flex-col p-1 h-full md:rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 pt-4 pb-3 border-b border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start gap-5 mb-6">
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
              title="Go Back"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-600 text-blue-50 flex items-center justify-center text-xl font-bold">
              {emp?.firstName?.[0]}
              {emp?.lastName?.[0]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-slate-900 truncate">
                  {emp?.firstName} {emp?.lastName}
                </h1>
                <StatusBadge status={emp?.status} />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" />
                  {emp?.department}
                </span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="flex items-center gap-1.5">
                  <Briefcase size={14} className="text-slate-400" />
                  {emp?.position}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/app/employees/${emp?._id}/update`)}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition shadow-sm font-medium w-full md:w-auto flex items-center gap-2 active:scale-95"
            >
              Update Profile
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
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
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">
        <div className="max-w-4xl mx-auto space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6 fade-in">
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Leave Balances
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <BalanceCard
                    label="Vacation Leave"
                    value={emp?.balances?.vlHours}
                    color="blue"
                    icon={<Briefcase size={18} />}
                  />
                  <BalanceCard
                    label="Sick Leave"
                    value={emp?.balances?.slHours}
                    color="rose"
                    icon={<Clock size={18} />}
                  />
                  <BalanceCard
                    label="Compensatory"
                    value={emp?.balances?.ctoHours}
                    color="emerald"
                    icon={<Layers size={18} />}
                  />
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard title="Quick Contact">
                  <ContactRow
                    icon={<Mail size={16} />}
                    label="Email"
                    value={emp?.email}
                    onCopy={() => copyToClipboard(emp?.email, "Email")}
                    isLink
                    href={`mailto:${emp?.email}`}
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
                </InfoCard>

                <InfoCard title="Work Status">
                  <DataRow label="System Role">
                    <RoleBadge role={emp?.role} />
                  </DataRow>
                  <DataRow label="Date Hired">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-900 font-medium">
                        {emp?.dateHired
                          ? new Date(emp?.dateHired).toLocaleDateString()
                          : "-"}
                      </span>
                      <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full mt-1">
                        {calculateTenure(emp?.dateHired)} Tenure
                      </span>
                    </div>
                  </DataRow>
                </InfoCard>
              </div>
            </div>
          )}

          {activeTab === "personal" && (
            <div className="grid grid-cols-1 gap-6 fade-in">
              <InfoCard title="Identity & Address">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <DataBlock
                    label="Full Name"
                    value={`${emp?.firstName} ${emp?.lastName}`}
                  />
                  <DataBlock label="Username" value={`@${emp?.username}`} />
                  <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-4">
                    <DataBlock
                      label="Permanent Address"
                      value={
                        `${emp?.address?.street || ""}${
                          emp?.address?.street ? ", " : ""
                        }${emp?.address?.city || ""}${
                          emp?.address?.city ? ", " : ""
                        }${emp?.address?.province || ""}`.trim() || "-"
                      }
                      icon={<MapPin size={14} />}
                    />
                  </div>
                </div>
              </InfoCard>

              <InfoCard
                title="Emergency Contact"
                icon={<ShieldCheck size={16} />}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {emp?.emergencyContact?.name || "Not Set"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {emp?.emergencyContact?.relation || "-"}
                    </p>
                  </div>
                </div>
              </InfoCard>
            </div>
          )}

          {activeTab === "job" && (
            <div className="space-y-6 fade-in">
              <InfoCard title="Employment Details">
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
                        ? new Date(emp?.dateHired).toLocaleDateString(
                            undefined,
                            {
                              dateStyle: "long",
                            },
                          )
                        : "-"
                    }
                  />
                </div>
              </InfoCard>
            </div>
          )}
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => {
          setEditBusy(false);
          setEditDirty(false);
          setIsEditOpen(true);
        }}
        className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-transform z-10"
      >
        <Edit3 size={24} />
      </button>

      {/* Edit Modal (SECURE) */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          if (editBusy) return;
          setIsEditOpen(false);
        }}
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
        // NOTE: do NOT change width here; pass maxWidth from where you call it if needed
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
  );
};

/* --- Sub-Components --- */
const TabButton = ({ active, onClick, label, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 pb-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
      active
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`}
  >
    {icon}
    {label}
  </button>
);

const BalanceCard = ({ label, value, color, icon }) => {
  const formatHours = (val) => {
    const num = parseFloat(val || 0);
    return num % 1 === 0 ? num : num.toFixed(1);
  };

  const themes = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  return (
    <div
      className={`p-4 rounded-xl border ${themes[color]} flex flex-col items-center justify-center text-center transition-transform hover:-translate-y-1 duration-200`}
    >
      <div className="mb-2 opacity-80">{icon}</div>
      <span className="text-3xl font-black tracking-tight">
        {formatHours(value)}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">
        {label}
      </span>
    </div>
  );
};

const InfoCard = ({ title, children, icon }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
        {icon} {title}
      </h3>
      <MoreHorizontal size={16} className="text-slate-300" />
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const ContactRow = ({ icon, label, value, onCopy, isLink, href }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between group py-1">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="p-2 bg-slate-50 text-slate-400 rounded-lg shrink-0">
          {icon}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {label}
          </span>
          {isLink ? (
            <a
              href={href}
              className="text-sm font-semibold text-slate-800 truncate hover:text-blue-600 hover:underline"
            >
              {value || "-"}
            </a>
          ) : (
            <span className="text-sm font-semibold text-slate-800 truncate">
              {value || "-"}
            </span>
          )}
        </div>
      </div>
      {value && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Copy"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
};

const DataRow = ({ label, children }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
    <span className="text-sm text-slate-500 font-medium">{label}</span>
    <div>{children}</div>
  </div>
);

const DataBlock = ({ label, value, icon }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
      {icon} {label}
    </span>
    <span className="text-sm md:text-base font-medium text-slate-900 break-words">
      {value || <span className="text-slate-300 italic">Not specified</span>}
    </span>
  </div>
);

// --- States ---
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 text-center p-8">
    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
      <User size={32} className="text-slate-300" />
    </div>
    <h3 className="text-slate-900 font-bold">No Profile Selected</h3>
    <p className="text-sm text-slate-500 mt-1 max-w-xs">
      Select an employee from the list to view their details here.
    </p>
  </div>
);

const ErrorState = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
    <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-3">
      <ShieldCheck size={24} />
    </div>
    <p className="font-semibold text-slate-900">Failed to load profile</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-4 px-4 py-2 bg-white border border-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 text-slate-700"
    >
      Try Again
    </button>
  </div>
);

const EmployeeSkeleton = () => (
  <div className="bg-white h-full md:rounded-2xl border border-slate-200 p-6 animate-pulse">
    <div className="flex gap-4 mb-8">
      <div className="w-20 h-20 bg-slate-100 rounded-2xl" />
      <div className="space-y-3 flex-1 pt-2">
        <div className="h-6 w-48 bg-slate-100 rounded" />
        <div className="h-4 w-32 bg-slate-100 rounded" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-4 mb-8">
      <div className="h-24 bg-slate-50 rounded-xl" />
      <div className="h-24 bg-slate-50 rounded-xl" />
      <div className="h-24 bg-slate-50 rounded-xl" />
    </div>
    <div className="space-y-4">
      <div className="h-40 bg-slate-50 rounded-xl" />
      <div className="h-40 bg-slate-50 rounded-xl" />
    </div>
  </div>
);

export default EmployeeInformation;
