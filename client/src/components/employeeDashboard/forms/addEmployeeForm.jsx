import React, { useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import { toast } from "react-toastify";

import {
  getEmployeeById,
  updateEmployeeById,
  addEmployee,
} from "../../../api/employee";

import ProvincialOfficeSelect from "./selectProvincialOffice";

import {
  User,
  Briefcase,
  MapPin,
  Phone,
  AlertCircle,
  UserPlus,
  ShieldCheck,
  Building2,
  ChevronLeft,
  Save,
  Loader2,
  Hash,
  Mail,
  Shield,
} from "lucide-react";

/* =========================
   CONSTANTS (whitelists)
========================= */
const PROJECTS = [
  "Cybersecurity/PNPKI",
  "FPIAP",
  "ILCDB",
  "ILCDB - Tech4ED",
  "DigiGov",
  "GECS",
  "NIPPSB",
  "GovNet",
  "MISS",
  "IIDB",
];

const DIVISIONS = ["AFD", "TOD", "ORD"];

// EXACTLY as your backend expects (per your note)
const STATUSES = ["Active", "Inactive", "Resigned", "Terminated"];

// Used ONLY when adding (role should not be updated)
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
  // case-insensitive mapping (useful for edit mode if API returns different casing)
  const v = normalizeText(value);
  const found = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
  return found || "";
};

// designation can arrive as string or object (e.g. {name, _id})
const pickDesignation = (d) => {
  if (!d) return "";
  if (typeof d === "string") return d;
  if (typeof d === "object") return d._id || d.id || d.name || "";
  return "";
};

/* =========================
   SELECT INPUT (react-select)
========================= */
const SelectInput = ({ label, options, value, onChange, error, required }) => {
  const selectOptions = useMemo(
    () => options.map((opt) => ({ value: opt, label: opt })),
    [options],
  );

  const customStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: "38px",
        borderRadius: "0.5rem",
        borderColor: state.isFocused
          ? "#2563eb"
          : error
            ? "#f87171"
            : "#d1d5db",
        boxShadow: "none",
        "&:hover": { borderColor: state.isFocused ? "#2563eb" : "#9ca3af" },
        overflow: "hidden",
        textOverflow: "ellipsis",
      }),
      singleValue: (base) => ({
        ...base,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
      }),
      menu: (base) => ({ ...base, zIndex: 9999 }),
    }),
    [error],
  );

  return (
    <div className="pt-2">
      <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
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
        <p className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1 font-semibold">
          <AlertCircle size={10} /> {error.message}
        </p>
      )}
    </div>
  );
};

/* =========================
   MAIN FORM
========================= */
const AddEmployeeForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  // Prevent double-submit (defense-in-depth)
  const submitLockRef = useRef(false);

  // Build schema dynamically:
  // - status choices are exactly your enum
  // - department removed
  // - role required ONLY in add mode (and NOT sent in edit payload)
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
        .oneOf(PROJECTS, "Invalid project")
        .required("Project is required"),

      status: yup
        .string()
        .transform((v) => normalizeText(v))
        .oneOf(STATUSES, "Invalid status")
        .required("Status is required"),

      designation: yup
        .mixed()
        .test("designation-required", "Designation is required", (v) => {
          const picked = pickDesignation(v);
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
      // present in form values for display only; not required, not updated
      base.role = yup
        .string()
        .transform((v) => normalizeText(v))
        .notRequired();
    }

    return yup.object(base);
  }, [isEditMode]);

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
      role: "employee", // used only in add mode
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

  // Populate values in edit mode (and normalize to whitelists)
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
      project: safeEnumCI(employee.project, PROJECTS),
      status: safeEnumCI(employee.status, STATUSES) || "Active",

      // role shown (optional), but not editable and not sent on update
      role: normalizeText(employee.role || "employee"),

      designation: pickDesignation(employee.designation),

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

  const mutation = useMutation({
    mutationFn: async (raw) => {
      // Strict payload (only allowed keys)
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
        project: safeEnum(normalizeText(raw.project), PROJECTS),
        status: safeEnum(normalizeText(raw.status), STATUSES),

        designation: pickDesignation(raw.designation),

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

      // role is ONLY added on create (and NEVER on update)
      if (!isEditMode) {
        payload.role = safeEnum(normalizeText(raw.role), ROLES);
      }

      // Extra hard checks
      if (!payload.division) throw new Error("Invalid division selected.");
      if (!payload.project) throw new Error("Invalid project selected.");
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
      // Compatible invalidate style
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
  if (isEditMode && isEmployeeLoading) {
    return (
      <div className="p-6 bg-neutral-50 mx-auto">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm flex items-center gap-3 text-gray-700">
          <Loader2 className="animate-spin" size={18} />
          Loading employee…
        </div>
      </div>
    );
  }

  if (isEditMode && isEmployeeError) {
    return (
      <div className="p-6 bg-neutral-50 mx-auto">
        <div className="bg-white border border-red-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 text-red-600 font-bold">
            <AlertCircle size={18} />
            Failed to load employee
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Please try again. If this persists, check the employee ID or your
            API.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => refetchEmployee()}
              className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-neutral-50 mx-auto">
      {/* === NAVIGATION & HEADER === */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
            title="Go Back"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <UserPlus size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {isEditMode ? "Update Employee" : "Add New Employee"}
              </h1>
              <p className="text-sm text-gray-500 font-medium">
                HR Management System / Workforce
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
            disabled={isPending}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="employeeForm"
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-100 disabled:opacity-70 transition-all"
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
        className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm"
      >
        {/* LEFT COLUMN */}
        <div className="space-y-8">
          <Section title="Personal Details" icon={User}>
            <InputField
              label="Employee ID"
              required
              icon={<Hash size={14} className="text-gray-400" />}
              {...register("employeeId")}
              error={errors.employeeId}
              disabled={isEditMode}
            />

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Email Address"
                type="email"
                required
                icon={<Mail size={14} className="text-gray-400" />}
                {...register("email")}
                error={errors.email}
              />
              <InputField
                label="Phone Number"
                type="tel"
                icon={<Phone size={14} className="text-gray-400" />}
                {...register("phone")}
                error={errors.phone}
                hint="Digits only (10–15). We’ll strip spaces/dashes automatically."
              />
            </div>
          </Section>

          <Section title="Work Information" icon={Briefcase}>
            {/* Role: ONLY for ADD. For UPDATE, show as read-only text (not editable, not sent). */}
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
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Shield size={12} /> System Role
                </label>
                <div className="h-10 px-3 flex items-center rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                  {/* role exists in form values via reset() */}
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

            <div className="grid grid-cols-2 gap-4">
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

              <Controller
                name="project"
                control={control}
                render={({ field }) => (
                  <SelectInput
                    label="Project"
                    options={PROJECTS}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.project}
                    required
                  />
                )}
              />
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <Building2 size={12} /> Designation{" "}
                <span className="text-red-500">*</span>
              </label>

              <Controller
                name="designation"
                control={control}
                render={({ field }) => (
                  <ProvincialOfficeSelect
                    value={pickDesignation(field.value)}
                    onChange={(v) => field.onChange(pickDesignation(v))}
                    error={errors.designation}
                  />
                )}
              />

              {errors.designation && (
                <p className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1 font-semibold">
                  <AlertCircle size={10} /> {errors.designation.message}
                </p>
              )}
            </div>
          </Section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          <Section title="Primary Address" icon={MapPin}>
            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
              <InputField
                label="Street / Building"
                {...register("address.street")}
                error={errors.address?.street}
                className="bg-white"
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="City"
                  {...register("address.city")}
                  error={errors.address?.city}
                  className="bg-white"
                />
                <InputField
                  label="Province"
                  {...register("address.province")}
                  error={errors.address?.province}
                  className="bg-white"
                />
              </div>
            </div>
          </Section>

          <Section title="Emergency Contact" icon={ShieldCheck}>
            <div className="bg-red-50/30 p-5 rounded-xl border border-red-100 space-y-4">
              <InputField
                label="Contact Person"
                {...register("emergencyContact.name")}
                error={errors.emergencyContact?.name}
                className="bg-white"
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Relationship"
                  {...register("emergencyContact.relation")}
                  error={errors.emergencyContact?.relation}
                  className="bg-white"
                />
                <InputField
                  label="Contact Phone"
                  type="tel"
                  {...register("emergencyContact.phone")}
                  error={errors.emergencyContact?.phone}
                  className="bg-white"
                />
              </div>
            </div>
          </Section>
        </div>
      </form>
    </div>
  );
};

/* =========================
   ATOMIC COMPONENTS
========================= */

const Section = ({ title, icon: Icon, children }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-2 text-gray-800 pb-2 border-b border-gray-100">
      <Icon size={18} className="text-blue-600" />
      <h4 className="font-bold text-xs uppercase tracking-widest text-gray-500">
        {title}
      </h4>
    </div>
    {children}
  </div>
);

const InputField = React.forwardRef(
  ({ label, error, required, className = "", hint, icon, ...props }, ref) => (
    <div className="w-full">
      <label className="block text-[11px] font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        {icon ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        ) : null}

        <input
          ref={ref}
          {...props}
          className={`w-full ${icon ? "pl-9" : "pl-3"} pr-3 py-2.5 text-sm border rounded-lg transition-all outline-none 
          ${
            error
              ? "border-red-300 focus:ring-4 focus:ring-red-500/5 bg-red-50 text-red-900"
              : "border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 text-gray-800 bg-white"
          } ${className}`}
        />
      </div>

      {hint && !error && (
        <p className="text-[10px] mt-1.5 text-gray-400 font-medium">{hint}</p>
      )}

      {error && (
        <p className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1 font-semibold">
          <AlertCircle size={10} /> {error.message}
        </p>
      )}
    </div>
  ),
);

export default AddEmployeeForm;
