import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom"; // Assuming you use react-router
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
} from "lucide-react";
import ProvincialOfficeSelect from "./selectProvincialOffice";
import { addEmployee } from "../../../api/employee";

const schema = yup.object().shape({
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
  status: yup.string().required("Status is required"),
  role: yup.string().required("Role is required"),
  provincialOffice: yup.string().required("Provincial Office is required"),
  address: yup.object().shape({
    street: yup.string().required("Street is required"),
    city: yup.string().required("City is required"),
    province: yup.string().required("Province is required"),
  }),
  emergencyContact: yup.object().shape({
    name: yup.string().required("Contact name is required"),
    phone: yup
      .string()
      .matches(/^[0-9]{10,15}$/, "Invalid phone format")
      .required("Phone is required"),
    relation: yup.string().required("Relation is required"),
  }),
});

const AddEmployeeForm = ({ employee }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- API MUTATION ---
  const { mutate, isPending } = useMutation({
    mutationFn: addEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries(["employees"]);
      // Optional: show a toast notification here
      navigate(-1); // Go back after successful save
    },
    onError: (error) => {
      console.error("Submission Error:", error);
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
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
        address: employee.address || { street: "", city: "", province: "" },
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
    <div className="p-8 bg-neutral-50 mx-auto">
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
                {employee ? "Update Employee" : "Add New Employee"}
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
                Saving...
              </span>
            ) : (
              <>
                <Save size={18} />
                Save Employee
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
              <SelectField
                label="System Role"
                {...register("role")}
                options={["employee", "supervisor", "hr", "admin"]}
                required
                error={errors.role}
              />
              <SelectField
                label="Status"
                {...register("status")}
                options={["Active", "Inactive", "Resigned", "Terminated"]}
                required
                error={errors.status}
              />
            </div>
            <InputField
              label="Position Title"
              required
              {...register("position")}
              error={errors.position}
            />
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Division"
                {...register("division")}
                error={errors.division}
              />
              <InputField
                label="Project"
                {...register("project")}
                error={errors.project}
              />
            </div>
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <Building2 size={12} /> Provincial Office{" "}
                <span className="text-red-500">*</span>
              </label>
              <Controller
                name="provincialOffice"
                control={control}
                render={({ field }) => (
                  <ProvincialOfficeSelect
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.provincialOffice}
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
                required
                {...register("address.street")}
                error={errors.address?.street}
                className="bg-white"
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="City"
                  required
                  {...register("address.city")}
                  error={errors.address?.city}
                  className="bg-white"
                />
                <InputField
                  label="Province"
                  required
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
                required
                {...register("emergencyContact.name")}
                error={errors.emergencyContact?.name}
                className="bg-white"
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Relationship"
                  required
                  {...register("emergencyContact.relation")}
                  error={errors.emergencyContact?.relation}
                  className="bg-white"
                />
                <InputField
                  label="Contact Phone"
                  required
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
  )
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
  )
);

export default AddEmployeeForm;
