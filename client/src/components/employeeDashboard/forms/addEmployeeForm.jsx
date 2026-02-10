// src/components/employees/addEmployee/addEmployeeForm.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import { toast } from "react-toastify";
import Breadcrumbs from "../../breadCrumbs";
import {
  getEmployeeById,
  updateEmployeeById,
  addEmployee,
} from "../../../api/employee";
import { fetchProjectOptions } from "../../../api/project";
import SelectDesignation from "./selectDesignation";
import SelectProjectOptions from "./selectProject";

import {
  User,
  Briefcase,
  MapPin,
  Phone,
  AlertCircle,
  UserPlus,
  ShieldCheck,
  Building2,
  Save,
  Loader2,
  Hash,
  Mail,
  Shield,
} from "lucide-react";

/* =========================
   CONSTANTS (whitelists)
========================= */
const DIVISIONS = ["AFD", "TOD", "ORD"];
const STATUSES = ["Active", "Inactive", "Resigned", "Terminated"];
const ROLES = ["employee", "supervisor", "hr", "admin"];

/* =========================
   HELPERS (sanitize / normalize)
========================= */
const normalizeText = (v) =>
  String(v ?? "")
    .replace(/\0/g, "")
    .trim();

const normalizeEmail = (v) => normalizeText(v).toLowerCase();
const digitsOnly = (v) => normalizeText(v).replace(/\D/g, "");

const safeEnum = (value, allowed) => {
  const v = normalizeText(value);
  return allowed.includes(v) ? v : "";
};

const safeEnumCI = (value, allowed) => {
  const v = normalizeText(value);
  const found = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
  return found || "";
};

const pickId = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v._id || v.id || "";
  return "";
};

const pickProjectId = (p) => pickId(p);
const pickDesignationId = (d) => pickId(d);

/* =========================
   ✅ Skeleton UI (better loading)
========================= */
const Sk = ({ className = "" }) => (
  <div
    className={[
      "animate-pulse rounded-lg bg-slate-200/80",
      "ring-1 ring-slate-100",
      className,
    ].join(" ")}
  />
);

const SkText = ({ w = "w-40", h = "h-3", className = "" }) => (
  <Sk className={[w, h, className].join(" ")} />
);

const SkInput = ({ className = "" }) => (
  <Sk className={["h-11 w-full rounded-xl", className].join(" ")} />
);

const SkCard = ({ children, className = "" }) => (
  <div
    className={[
      "bg-white/80 backdrop-blur rounded-2xl border border-slate-200/70",
      "shadow-[0_1px_0_rgba(15,23,42,0.04)]",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const FormSkeleton = ({ isEditMode }) => {
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="opacity-70">
              <SkText w="w-48" h="h-3" />
            </div>

            <div className="flex items-start gap-3 mt-3">
              <Sk className="w-11 h-11 rounded-2xl" />
              <div className="min-w-0 w-full">
                <SkText w="w-64" h="h-6" />
                <SkText w="w-96" h="h-4" className="mt-2" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Sk className="h-11 w-28 rounded-xl" />
            <Sk className="h-11 w-44 rounded-xl" />
          </div>
        </div>

        {/* Form skeleton */}
        <SkCard className="p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left column */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sk className="w-9 h-9 rounded-xl" />
                  <SkText w="w-40" h="h-4" />
                  <div className="hidden md:block flex-1">
                    <Sk className="h-px w-full rounded-none bg-slate-200/70" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkInput />
                  <SkInput />
                </div>
                <SkInput />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkInput />
                  <SkInput />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sk className="w-9 h-9 rounded-xl" />
                  <SkText w="w-40" h="h-4" />
                  <div className="hidden md:block flex-1">
                    <Sk className="h-px w-full rounded-none bg-slate-200/70" />
                  </div>
                </div>

                {/* role / status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkInput />
                  <SkInput />
                </div>

                <SkInput />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkInput />
                  <SkInput />
                </div>

                <SkInput />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sk className="w-9 h-9 rounded-xl" />
                  <SkText w="w-40" h="h-4" />
                  <div className="hidden md:block flex-1">
                    <Sk className="h-px w-full rounded-none bg-slate-200/70" />
                  </div>
                </div>

                <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <SkInput className="bg-slate-200/70" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SkInput className="bg-slate-200/70" />
                    <SkInput className="bg-slate-200/70" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sk className="w-9 h-9 rounded-xl" />
                  <SkText w="w-44" h="h-4" />
                  <div className="hidden md:block flex-1">
                    <Sk className="h-px w-full rounded-none bg-slate-200/70" />
                  </div>
                </div>

                <div className="bg-rose-50/30 p-5 rounded-2xl border border-rose-200/50 space-y-4">
                  <SkInput className="bg-slate-200/70" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SkInput className="bg-slate-200/70" />
                    <SkInput className="bg-slate-200/70" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom hint skeleton row */}
          <div className="mt-8 flex items-center justify-between">
            <SkText w="w-56" h="h-3" />
            <SkText w="w-24" h="h-3" />
          </div>
        </SkCard>

        {/* Small loading pill (optional) */}
        {isEditMode ? (
          <div className="mt-4 flex items-center gap-2 text-slate-600">
            <Loader2 className="animate-spin" size={16} />
            <span className="text-xs font-medium">Loading employee…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* =========================
   SELECT INPUT (react-select) - MINIMALIST
   ✅ accepts string[] OR {value,label}[]
========================= */
const SelectInput = ({ label, options, value, onChange, error, required }) => {
  const selectOptions = useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === "string") return { value: opt, label: opt };
      return opt;
    });
  }, [options]);

  const customStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: "44px",
        borderRadius: "0.75rem",
        borderColor: state.isFocused
          ? "#a5b4fc"
          : error
            ? "#fda4af"
            : "rgba(226,232,240,0.9)",
        boxShadow: state.isFocused ? "0 0 0 4px rgba(99,102,241,0.12)" : "none",
        "&:hover": {
          borderColor: state.isFocused
            ? "#a5b4fc"
            : error
              ? "#fda4af"
              : "rgba(148,163,184,0.7)",
        },
        backgroundColor: "rgba(255,255,255,0.9)",
        overflow: "hidden",
      }),
      valueContainer: (base) => ({
        ...base,
        paddingLeft: 10,
        paddingRight: 10,
      }),
      placeholder: (base) => ({
        ...base,
        color: "rgba(100,116,139,0.8)",
      }),
      singleValue: (base) => ({
        ...base,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
        color: "#0f172a",
        fontWeight: 500,
      }),
      indicatorSeparator: () => ({ display: "none" }),
      dropdownIndicator: (base) => ({
        ...base,
        color: "rgba(100,116,139,0.8)",
      }),
      clearIndicator: (base) => ({ ...base, color: "rgba(100,116,139,0.8)" }),
      menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: "0.75rem",
        overflow: "hidden",
        border: "1px solid rgba(226,232,240,0.9)",
        boxShadow: "0 20px 40px rgba(15,23,42,0.08)",
      }),
      option: (base, state) => ({
        ...base,
        fontSize: 13,
        backgroundColor: state.isSelected
          ? "rgba(99,102,241,0.10)"
          : state.isFocused
            ? "rgba(2,6,23,0.04)"
            : "white",
        color: "#0f172a",
      }),
    }),
    [error],
  );

  return (
    <div className="pt-2">
      <label className="block text-xs text-slate-600 mb-1.5 flex items-center gap-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      <Select
        styles={customStyles}
        options={selectOptions}
        value={selectOptions.find((o) => o.value === value) || null}
        onChange={(selected) => onChange(selected?.value || "")}
        placeholder={`Select ${label}`}
        isClearable
      />

      {error && (
        <p className="text-rose-600 text-xs mt-2 flex items-center gap-1">
          <AlertCircle size={14} /> {error.message}
        </p>
      )}
    </div>
  );
};

/* =========================
   MAIN FORM (MINIMALIST)
========================= */
const AddEmployeeForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const submitLockRef = useRef(false);

  /* -------------------------
     Project IDs set (for validation)
     ✅ still fetched here for schema + submit guard
  ------------------------- */
  const projectsQuery = useQuery({
    queryKey: ["projectOptions", "Active"],
    queryFn: () => fetchProjectOptions({ status: "Active" }),
    staleTime: 5 * 60 * 1000,
  });

  const projectIdSet = useMemo(() => {
    const items = Array.isArray(projectsQuery.data?.items)
      ? projectsQuery.data.items
      : [];
    return new Set(items.filter((p) => p?._id).map((p) => String(p._id)));
  }, [projectsQuery.data]);

  /* -------------------------
     Schema (depends on projectIdSet)
  ------------------------- */
  const schema = useMemo(() => {
    const base = {
      employeeId: yup
        .string()
        .transform((v) => normalizeText(v))
        .min(4, "Employee ID is too short")
        .required("Employee ID is required"),

      username: yup
        .string()
        .transform((v) => normalizeText(v))
        .min(4, "Min 4 characters")
        .required("Username is required"),

      firstName: yup
        .string()
        .transform((v) => normalizeText(v))
        .required("First name is required"),

      lastName: yup
        .string()
        .transform((v) => normalizeText(v))
        .required("Last name is required"),

      email: yup
        .string()
        .transform((v) => normalizeEmail(v))
        .email("Invalid email")
        .required("Email is required"),

      phone: yup
        .string()
        .transform((v) => digitsOnly(v))
        .test(
          "phone-len",
          "Invalid phone format (10–15 digits)",
          (v) => !v || (v.length >= 10 && v.length <= 15),
        )
        .nullable(),

      position: yup
        .string()
        .transform((v) => normalizeText(v))
        .required("Position is required"),

      division: yup
        .string()
        .transform((v) => normalizeText(v))
        .oneOf(DIVISIONS, "Invalid division")
        .required("Division is required"),

      project: yup
        .string()
        .transform((v) => normalizeText(v))
        .required("Project is required")
        .test("project-valid", "Invalid project selected", (v) => {
          const val = normalizeText(v);
          if (!val) return false;
          if (projectIdSet.size > 0) return projectIdSet.has(val);
          return true;
        }),

      status: yup
        .string()
        .transform((v) => normalizeText(v))
        .oneOf(STATUSES, "Invalid status")
        .required("Status is required"),

      designation: yup
        .mixed()
        .test("designation-required", "Designation is required", (v) => {
          const picked = pickDesignationId(v);
          return Boolean(normalizeText(picked));
        }),

      address: yup.object({
        street: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
        city: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
        province: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
      }),

      emergencyContact: yup.object({
        name: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
        relation: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
        phone: yup
          .string()
          .transform((v) => digitsOnly(v))
          .test(
            "ec-phone-len",
            "Invalid phone format (10–15 digits)",
            (v) => !v || (v.length >= 10 && v.length <= 15),
          )
          .nullable()
          .default(""),
      }),
    };

    if (!isEditMode) {
      base.role = yup
        .string()
        .transform((v) => normalizeText(v))
        .oneOf(ROLES, "Invalid role")
        .required("Role is required");
    } else {
      base.role = yup
        .string()
        .transform((v) => normalizeText(v))
        .notRequired();
    }

    return yup.object(base);
  }, [isEditMode, projectIdSet]);

  /* -------------------------
     Employee fetch (edit mode)
  ------------------------- */
  const {
    data: employeeRes,
    isLoading: isEmployeeLoading,
    isError: isEmployeeError,
    refetch: refetchEmployee,
  } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployeeById(id),
    enabled: isEditMode,
    staleTime: 1000 * 60 * 5,
    retry: 0,
  });

  const employee = employeeRes?.data;

  const defaultValues = useMemo(
    () => ({
      employeeId: "",
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      division: "",
      project: "",
      status: "Active",
      role: "employee",
      designation: "",
      address: { street: "", city: "", province: "" },
      emergencyContact: { name: "", phone: "", relation: "" },
    }),
    [],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!isEditMode) return;
    if (!employee) return;

    reset({
      employeeId: normalizeText(employee.employeeId),
      username: normalizeText(employee.username),
      firstName: normalizeText(employee.firstName),
      lastName: normalizeText(employee.lastName),
      email: normalizeEmail(employee.email),
      phone: digitsOnly(employee.phone),
      position: normalizeText(employee.position),

      division: safeEnumCI(employee.division, DIVISIONS),
      project: pickProjectId(employee.project),
      status: safeEnumCI(employee.status, STATUSES) || "Active",

      role: normalizeText(employee.role || "employee"),
      designation: pickDesignationId(employee.designation),

      address: {
        street: normalizeText(employee.address?.street),
        city: normalizeText(employee.address?.city),
        province: normalizeText(employee.address?.province),
      },
      emergencyContact: {
        name: normalizeText(employee.emergencyContact?.name),
        relation: normalizeText(employee.emergencyContact?.relation),
        phone: digitsOnly(employee.emergencyContact?.phone),
      },
    });
  }, [employee, isEditMode, reset]);

  /* -------------------------
     Mutation
  ------------------------- */
  const mutation = useMutation({
    mutationFn: async (raw) => {
      const payload = {
        employeeId: isEditMode
          ? normalizeText(employee?.employeeId || raw.employeeId)
          : normalizeText(raw.employeeId),

        username: normalizeText(raw.username),
        firstName: normalizeText(raw.firstName),
        lastName: normalizeText(raw.lastName),
        email: normalizeEmail(raw.email),
        phone: digitsOnly(raw.phone),

        position: normalizeText(raw.position),

        division: safeEnum(normalizeText(raw.division), DIVISIONS),
        project: normalizeText(raw.project),
        status: safeEnum(normalizeText(raw.status), STATUSES),
        designation: pickDesignationId(raw.designation),

        address: {
          street: normalizeText(raw.address?.street),
          city: normalizeText(raw.address?.city),
          province: normalizeText(raw.address?.province),
        },
        emergencyContact: {
          name: normalizeText(raw.emergencyContact?.name),
          relation: normalizeText(raw.emergencyContact?.relation),
          phone: digitsOnly(raw.emergencyContact?.phone),
        },
      };

      if (!isEditMode) payload.role = safeEnum(normalizeText(raw.role), ROLES);

      if (!payload.division) throw new Error("Invalid division selected.");
      if (!payload.project) throw new Error("Project is required.");
      if (projectIdSet.size > 0 && !projectIdSet.has(payload.project)) {
        throw new Error("Invalid project selected.");
      }
      if (!payload.status) throw new Error("Invalid status selected.");
      if (!payload.designation) throw new Error("Designation is required.");
      if (!isEditMode && !payload.role)
        throw new Error("Invalid role selected.");

      return isEditMode
        ? updateEmployeeById(id, payload)
        : addEmployee(payload);
    },
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      if (isEditMode)
        queryClient.invalidateQueries({ queryKey: ["employee", id] });

      toast.success(
        isEditMode
          ? "Employee updated successfully!"
          : "Employee created successfully!",
      );
      navigate(-1);
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong";
      toast.error(`Error: ${msg}`);
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  const { mutate, isPending } = mutation;

  const onSubmit = (formData) => {
    if (submitLockRef.current || isPending) return;
    submitLockRef.current = true;
    mutate(formData);
  };

  /* ======= Edit mode: loading / error states ======= */
  // ✅ No hooks below this point

  // ✅ improved skeleton instead of plain loader
  if (isEditMode && isEmployeeLoading) {
    return <FormSkeleton isEditMode />;
  }

  if (isEditMode && isEmployeeError) {
    return (
      <div className="min-h-screen ">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-rose-200/60 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-2 text-rose-700 font-medium">
              <AlertCircle size={18} />
              Failed to load employee
            </div>
            <p className="text-sm text-slate-600 mt-2">
              Please try again. If this persists, check the employee ID or your
              API.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => refetchEmployee()}
                className="px-4 py-2.5 text-sm font-medium bg-white/70 border border-slate-200/70 rounded-xl hover:bg-white hover:border-slate-300/70 hover:shadow-sm transition"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="px-1 py-2">
        {/* === NAVIGATION & HEADER === */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <Breadcrumbs
              rootLabel="home"
              rootTo="/app"
              currentPathText={`Employees/${isEditMode ? "Update" : "Add"}`}
            />

            <div className="flex items-start gap-3 mt-3">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight truncate">
                  {isEditMode ? "Update Employee" : "Add New Employee"}
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Manage employee records and assignment details.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white/70 border border-slate-200/70 rounded-xl hover:bg-white hover:border-slate-300/70 hover:shadow-sm transition"
              disabled={isPending}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="employeeForm"
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-70 transition"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  {isEditMode ? "Updating..." : "Saving..."}
                </span>
              ) : (
                <>
                  <Save size={18} />
                  {isEditMode ? "Update Employee" : "Save Employee"}
                </>
              )}
            </button>
          </div>
        </div>

        <form
          id="employeeForm"
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white/80 backdrop-blur p-6 md:p-8 rounded-2xl border border-slate-200/70 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
        >
          {/* LEFT COLUMN */}
          <div className="space-y-8">
            <Section title="Personal Details" icon={User}>
              <InputField
                label="Employee ID"
                required
                icon={<Hash size={14} className="text-slate-400" />}
                {...register("employeeId")}
                error={errors.employeeId}
                disabled={isEditMode}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="First Name"
                  required
                  {...register("firstName")}
                  error={errors.firstName}
                />
                <InputField
                  label="Last Name"
                  required
                  {...register("lastName")}
                  error={errors.lastName}
                />
              </div>

              <InputField
                label="Username"
                required
                {...register("username")}
                error={errors.username}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Email Address"
                  type="email"
                  required
                  icon={<Mail size={14} className="text-slate-400" />}
                  {...register("email")}
                  error={errors.email}
                />
                <InputField
                  label="Phone Number"
                  type="tel"
                  icon={<Phone size={14} className="text-slate-400" />}
                  {...register("phone")}
                  error={errors.phone}
                  hint="Digits only (10–15). We’ll strip spaces/dashes automatically."
                />
              </div>
            </Section>

            <Section title="Work Information" icon={Briefcase}>
              {!isEditMode ? (
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <SelectInput
                      label="System Role"
                      options={ROLES}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.role}
                      required
                    />
                  )}
                />
              ) : (
                <div className="pt-2">
                  <label className="block text-xs text-slate-600 mb-1.5 flex items-center gap-1">
                    <Shield size={14} className="text-slate-400" /> System Role
                  </label>
                  <div className="h-11 px-3 flex items-center rounded-xl border border-slate-200/70 bg-slate-50/60 text-sm font-medium text-slate-800">
                    {employee?.role || "—"}
                  </div>
                </div>
              )}

              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <SelectInput
                    label="Status"
                    options={STATUSES}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.status}
                    required
                  />
                )}
              />

              <InputField
                label="Position Title"
                required
                {...register("position")}
                error={errors.position}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller
                  name="division"
                  control={control}
                  render={({ field }) => (
                    <SelectInput
                      label="Division"
                      options={DIVISIONS}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.division}
                      required
                    />
                  )}
                />

                {/* ✅ Project extracted into its own component */}
                <div className="pt-2">
                  <label className="block text-xs text-slate-600 mb-1.5 flex items-center gap-1">
                    Project <span className="text-rose-500">*</span>
                  </label>
                  <Controller
                    name="project"
                    control={control}
                    render={({ field }) => (
                      <SelectProjectOptions
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.project}
                      />
                    )}
                  />
                  {errors.project && (
                    <p className="text-rose-600 text-xs mt-2 flex items-center gap-1">
                      <AlertCircle size={14} /> {errors.project.message}
                    </p>
                  )}
                </div>
              </div>

              {/* ✅ Designation matches Project select UI */}
              <div className="pt-2">
                <label className="block text-xs text-slate-600 mb-1.5 flex items-center gap-1">
                  <Building2 size={14} className="text-slate-400" /> Designation{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <Controller
                  name="designation"
                  control={control}
                  render={({ field }) => (
                    <SelectDesignation
                      value={pickDesignationId(field.value)}
                      onChange={(v) => field.onChange(v)}
                      error={errors.designation}
                    />
                  )}
                />

                {errors.designation && (
                  <p className="text-rose-600 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle size={14} /> {errors.designation.message}
                  </p>
                )}
              </div>
            </Section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8">
            <Section title="Primary Address" icon={MapPin}>
              <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                <InputField
                  label="Street / Building"
                  {...register("address.street")}
                  error={errors.address?.street}
                  className="bg-white/80"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="City"
                    {...register("address.city")}
                    error={errors.address?.city}
                    className="bg-white/80"
                  />
                  <InputField
                    label="Province"
                    {...register("address.province")}
                    error={errors.address?.province}
                    className="bg-white/80"
                  />
                </div>
              </div>
            </Section>

            <Section title="Emergency Contact" icon={ShieldCheck}>
              <div className="bg-rose-50/30 p-5 rounded-2xl border border-rose-200/50 space-y-4">
                <InputField
                  label="Contact Person"
                  {...register("emergencyContact.name")}
                  error={errors.emergencyContact?.name}
                  className="bg-white/80"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Relationship"
                    {...register("emergencyContact.relation")}
                    error={errors.emergencyContact?.relation}
                    className="bg-white/80"
                  />
                  <InputField
                    label="Contact Phone"
                    type="tel"
                    {...register("emergencyContact.phone")}
                    error={errors.emergencyContact?.phone}
                    className="bg-white/80"
                  />
                </div>
              </div>
            </Section>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================
   ATOMIC COMPONENTS (MINIMALIST)
========================= */
const Section = ({ title, icon: Icon, children }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60">
          <Icon size={16} />
        </div>
        <h4 className="text-sm font-medium text-slate-700">{title}</h4>
      </div>
      <div className="h-px flex-1 bg-slate-200/60 hidden md:block" />
    </div>
    {children}
  </div>
);

const InputField = React.forwardRef(
  ({ label, error, required, className = "", hint, icon, ...props }, ref) => (
    <div className="w-full pt-2">
      <label className="block text-xs text-slate-600 mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      <div className="relative">
        {icon ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        ) : null}

        <input
          ref={ref}
          {...props}
          className={[
            "w-full h-11",
            icon ? "pl-9" : "pl-3",
            "pr-3",
            "text-sm",
            "rounded-xl",
            "border",
            "outline-none",
            "transition",
            "bg-white/90",
            error
              ? "border-rose-300 focus:ring-2 focus:ring-rose-200 focus:border-rose-300 text-rose-900"
              : "border-slate-200/80 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-slate-900",
            "disabled:opacity-60 disabled:bg-slate-50",
            className,
          ].join(" ")}
        />
      </div>

      {hint && !error && <p className="text-xs mt-2 text-slate-500">{hint}</p>}

      {error && (
        <p className="text-rose-600 text-xs mt-2 flex items-center gap-1">
          <AlertCircle size={14} /> {error.message}
        </p>
      )}
    </div>
  ),
);

InputField.displayName = "InputField";

export default AddEmployeeForm;
