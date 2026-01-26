import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getEmployeeById, updateEmployeeById } from "../../../api/employee";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Select from "react-select";
import {
  User,
  Briefcase,
  MapPin,
  Phone,
  Loader2,
  AlertCircle,
  UserPlus,
  ShieldCheck,
  Building2,
  ChevronLeft,
  Save,
} from "lucide-react";
import ProvincialOfficeSelect from "./selectProvincialOffice";
import { addEmployee } from "../../../api/employee";

const projectOptions = [
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

const divisionOptions = ["AFD", "TOD", "ORD"];

const SelectInput = ({ label, options, value, onChange, error, required }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleMenuOpen = () => setMenuOpen(true);
  const handleMenuClose = () => setMenuOpen(false);

  const selectOptions = options.map((opt) => ({ value: opt, label: opt }));

  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "38px",
      borderRadius: "0.5rem",
      borderColor: state.isFocused ? "#2563eb" : error ? "#f87171" : "#d1d5db",
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
    menu: (base) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  return (
    <div className="pt-2">
      <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <Select
        styles={customStyles}
        options={selectOptions}
        value={selectOptions.find((opt) => opt.value === value) || null}
        onChange={(selected) => onChange(selected?.value || "")}
        placeholder={`Select ${label}`}
        isClearable
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
      />

      {error && (
        <p className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1 font-semibold">
          <AlertCircle size={10} /> {error.message}
        </p>
      )}
    </div>
  );
};

const schema = yup.object().shape({
  employeeId: yup
    .string()
    .required("Employee ID is required")
    .min(4, "Employee ID is too short"),
  username: yup
    .string()
    .required("Username is required")
    .min(4, "Min 4 characters"),
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  phone: yup
    .string()
    .matches(/^[0-9]{10,15}$/, "Invalid phone format")
    .nullable(),
  position: yup.string().required("Position is required"),
  division: yup.string().nullable(),
  project: yup.string().nullable(),
  status: yup.string(),
  role: yup.string().required("Role is required"),
  designation: yup.string().required("Designation is required"),
  address: yup.object().shape({
    street: yup.string(),
    city: yup.string(),
    province: yup.string(),
  }),
  emergencyContact: yup.object().shape({
    name: yup.string(),
    // phone: yup.string().matches(/^[0-9]{10,15}$/, "Invalid phone format"),
    relation: yup.string(),
  }),
});

const AddEmployeeForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { id } = useParams();
  const isEditMode = Boolean(id);

  const { data: employeeRes, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployeeById(id),
    enabled: isEditMode,
    staleTime: 1000 * 60 * 5,
  });

  const employee = employeeRes?.data;
  // --- API MUTATION ---
  const mutation = useMutation({
    mutationFn: (data) =>
      isEditMode ? updateEmployeeById(id, data) : addEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["employees"]);
      if (isEditMode) {
        queryClient.invalidateQueries(["employee", id]);
        toast.success("Employee updated successfully!");
      } else {
        toast.success("Employee created successfully!");
      }
      navigate(-1);
    },
    onError: (error) => {
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Something went wrong";
      toast.error(`Error: ${msg}`);
    },
  });
  const { mutate, isPending } = mutation;
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      employeeId: "",
      status: "Active",
      role: "employee",
      address: { street: "", city: "", province: "" },
      emergencyContact: { name: "", phone: "", relation: "" },
    },
  });

  useEffect(() => {
    if (employee) {
      reset({
        ...employee,
        address: employee.address || {
          street: "",
          city: "",
          province: "",
        },
        emergencyContact: employee.emergencyContact || {
          name: "",
          phone: "",
          relation: "",
        },
      });
    }
  }, [employee, reset]);

  const onSubmit = (data) => {
    mutate(data);
  };

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
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                {...register("email")}
                error={errors.email}
              />
              <InputField
                label="Phone Number"
                required
                {...register("phone")}
                error={errors.phone}
              />
            </div>
          </Section>

          <Section title="Work Information" icon={Briefcase}>
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <SelectInput
                    label="System Role"
                    options={["employee", "supervisor", "hr", "admin"]}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.role}
                    required
                  />
                )}
              />

              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <SelectInput
                    label="Status"
                    options={["Active", "Inactive", "Resigned", "Terminated"]}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.status}
                    required
                  />
                )}
              />
            </div>
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
                    options={divisionOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.division}
                    required
                  />
                )}
              />

              {/* Project */}
              <Controller
                name="project"
                control={control}
                render={({ field }) => (
                  <SelectInput
                    label="Project"
                    options={projectOptions}
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
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.designation}
                  />
                )}
              />
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

/* === ATOMIC COMPONENTS === */

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
  ({ label, error, required, className, ...props }, ref) => (
    <div className="w-full">
      <label className="block text-[11px] font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        ref={ref}
        {...props}
        className={`w-full px-3 py-2.5 text-sm border rounded-lg transition-all outline-none 
        ${
          error
            ? "border-red-300 focus:ring-4 focus:ring-red-500/5 bg-red-50 text-red-900"
            : "border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 text-gray-800 bg-white"
        } ${className}`}
      />
      {error && (
        <p className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1 font-semibold">
          <AlertCircle size={10} /> {error.message}
        </p>
      )}
    </div>
  ),
);

const SelectField = React.forwardRef(
  ({ label, options, error, required, ...props }, ref) => (
    <div className="w-full">
      <label className="block text-[11px] font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          ref={ref}
          {...props}
          className={`w-full px-3 py-2.5 text-sm border rounded-lg appearance-none bg-white transition-all outline-none cursor-pointer
          ${
            error
              ? "border-red-300 focus:ring-4 focus:ring-red-500/5"
              : "border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
          }`}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
          <ChevronLeft size={16} className="-rotate-90" />
        </div>
      </div>
      {error && (
        <p className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1 font-semibold">
          <AlertCircle size={10} /> {error.message}
        </p>
      )}
    </div>
  ),
);

export default AddEmployeeForm;
