import React from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// ✅ Validation Schema
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

const AddEmployeeForm = ({ onCancel, onSubmit, isSaving = false }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
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
      address: { street: "", city: "", province: "" },
      emergencyContact: { name: "", phone: "", relation: "" },
    },
  });

  return (
    <form
      id="employeeForm"
      onSubmit={handleSubmit(onSubmit)}
      className="grid p-6 grid-cols-1 lg:grid-cols-2 gap-8 h-120 overflow-y-auto"
    >
      {/* Personal Details */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Personal Details</h3>
        <div className="space-y-4">
          <InputField
            label="Username"
            placeholder="Enter username"
            required
            {...register("username")}
            error={errors.username}
          />
          <InputField
            label="First Name"
            placeholder="Enter first name"
            required
            {...register("firstName")}
            error={errors.firstName}
          />
          <InputField
            label="Last Name"
            placeholder="Enter last name"
            required
            {...register("lastName")}
            error={errors.lastName}
          />
          <InputField
            label="Email"
            type="email"
            placeholder="Enter email"
            required
            {...register("email")}
            error={errors.email}
          />
          <InputField
            label="Phone"
            placeholder="Enter phone number"
            required
            {...register("phone")}
            error={errors.phone}
          />
        </div>
      </div>

      {/* Job Details */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Job Details</h3>
        <div className="space-y-4">
          <SelectField
            label="Role"
            {...register("role")}
            required
            options={["employee", "supervisor", "hr", "admin"]}
            placeholder="Select role"
          />
          <InputField
            label="Position"
            placeholder="Enter position"
            {...register("position")}
            required
            error={errors.position}
          />
          <InputField
            label="Department"
            placeholder="Enter department"
            {...register("department")}
            required
            error={errors.department}
          />
          <SelectField
            label="Status"
            {...register("status")}
            options={["Active", "Inactive", "Resigned", "Terminated"]}
            placeholder="Select status"
            required
            error={errors.status}
          />
        </div>
      </div>

      {/* Address */}
      <div className="lg:col-span-2">
        <h3 className="text-lg font-semibold mb-4">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <InputField
              label="Street"
              placeholder="Enter street"
              {...register("address.street")}
              required
              error={errors?.address?.street}
            />
          </div>
          <InputField
            label="City"
            placeholder="Enter city"
            {...register("address.city")}
            required
            error={errors?.address?.city}
          />
          <InputField
            label="Province"
            placeholder="Enter province"
            {...register("address.province")}
            required
            error={errors?.address?.province}
          />
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="lg:col-span-2">
        <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="Name"
            placeholder="Enter contact name"
            {...register("emergencyContact.name")}
            required
            error={errors?.emergencyContact?.name}
          />
          <InputField
            label="Phone"
            placeholder="Enter contact phone"
            {...register("emergencyContact.phone")}
            required
            error={errors?.emergencyContact?.phone}
          />
          <InputField
            label="Relation"
            placeholder="Enter relation"
            {...register("emergencyContact.relation")}
            required
            error={errors?.emergencyContact?.relation}
          />
        </div>
      </div>

      {/* Actions */}
    </form>
  );
};

const InputField = ({ label, error, required, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      className="w-full border p-2 rounded"
      placeholder={props.placeholder || `Enter ${label}`}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
  </div>
);

const SelectField = ({ label, options, error, required, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      {...props}
      className="w-full border p-2 rounded"
      placeholder={props.placeholder || `Select ${label}`}
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
