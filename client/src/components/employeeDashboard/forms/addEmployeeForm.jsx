import React from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import ProvincialOfficeSelect from "./selectProvincialOffice";

const schema = yup.object().shape({
  username: yup
    .string()
    .required("Username is required")
    .min(4, "Username must be at least 4 characters"),
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  email: yup
    .string()
    .email("Invalid email format")
    .required("Email is required"),
  phone: yup
    .string()
    .matches(/^[0-9]{10,15}$/, "Phone must be 10–15 digits")
    .nullable(),
  position: yup.string().required("Position is required"),
  department: yup.string().nullable(),
  status: yup.string().oneOf(["Active", "Inactive", "Resigned", "Terminated"]),
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
      .matches(/^[0-9]{10,15}$/, "Phone must be 10–15 digits")
      .required("Contact phone is required"),
    relation: yup.string().required("Relation is required"),
  }),
});

const AddEmployeeForm = ({
  onCancel,
  onSubmit,
  isSaving = false,
  employee,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      username: "",
      employeeId: "",
      role: "employee",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      department: "",
      status: "Active",
      provincialOffice: "",
      address: { street: "", city: "", province: "" },
      emergencyContact: { name: "", phone: "", relation: "" },
    },
  });

  // 🔹 Prefill form when editing an existing employee
  React.useEffect(() => {
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

  return (
    <form
      id="employeeForm"
      onSubmit={handleSubmit(onSubmit)}
      className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 
                 max-h-[70vh] overflow-y-auto bg-white rounded-lg shadow-sm"
    >
      {/* === PERSONAL DETAILS === */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">
          Personal Details
        </h3>
        <div className="space-y-4">
          <InputField
            label="Username"
            required
            {...register("username")}
            error={errors.username}
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
            label="Email"
            type="email"
            required
            {...register("email")}
            error={errors.email}
          />
          <InputField
            label="Phone"
            required
            {...register("phone")}
            error={errors.phone}
          />
        </div>
      </section>

      {/* === JOB DETAILS === */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">
          Job Details
        </h3>
        <div className="space-y-4">
          <SelectField
            label="Role"
            {...register("role")}
            options={["employee", "supervisor", "hr", "admin"]}
            required
            error={errors.role}
          />
          <InputField
            label="Position"
            required
            {...register("position")}
            error={errors.position}
          />
          <InputField
            label="Department"
            {...register("department")}
            error={errors.department}
          />
          <SelectField
            label="Status"
            {...register("status")}
            options={["Active", "Inactive", "Resigned", "Terminated"]}
            required
            error={errors.status}
          />
        </div>
      </section>

      {/* === ADDRESS === */}
      <section className="lg:col-span-2">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <InputField
              label="Street"
              {...register("address.street")}
              required
              error={errors?.address?.street}
            />
          </div>
          <InputField
            label="City"
            {...register("address.city")}
            required
            error={errors?.address?.city}
          />
          <InputField
            label="Province"
            {...register("address.province")}
            required
            error={errors?.address?.province}
          />
        </div>
      </section>

      {/* === PROVINCIAL OFFICE === */}
      <section className="lg:col-span-2">
        <Controller
          name="provincialOffice"
          control={control}
          render={({ field }) => (
            <ProvincialOfficeSelect
              value={field.value}
              onChange={field.onChange}
              error={errors?.provincialOffice}
            />
          )}
        />
      </section>

      {/* === EMERGENCY CONTACT === */}
      <section className="lg:col-span-2">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">
          Emergency Contact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="Name"
            {...register("emergencyContact.name")}
            required
            error={errors?.emergencyContact?.name}
          />
          <InputField
            label="Phone"
            {...register("emergencyContact.phone")}
            required
            error={errors?.emergencyContact?.phone}
          />
          <InputField
            label="Relation"
            {...register("emergencyContact.relation")}
            required
            error={errors?.emergencyContact?.relation}
          />
        </div>
      </section>
    </form>
  );
};

/* === INPUT FIELD === */
const InputField = ({ label, error, required, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-1 text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      className="w-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2 rounded"
    />
    {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
  </div>
);

const SelectField = ({ label, options, error, required, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-1 text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      {...props}
      className="w-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2 rounded"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
    {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
  </div>
);

export default AddEmployeeForm;
