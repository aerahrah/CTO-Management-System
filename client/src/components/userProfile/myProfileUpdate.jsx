import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  MapPin,
  ShieldAlert,
  Save,
  ArrowLeft,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { getMyProfile, updateMyProfile } from "../../api/employee";
import { toast } from "react-toastify";

/** * Reusable Input Component
 * Matches AddEmployeeForm design precisely
 */
const FormField = React.forwardRef(
  ({ icon: Icon, label, error, required, className, ...props }, ref) => (
    <div className="w-full">
      <label className="block text-[11px] font-bold text-gray-600 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-blue-600" />}
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        ref={ref}
        {...props}
        className={`w-full px-3 py-2.5 text-sm border rounded-lg transition-all outline-none shadow-sm
        ${
          error
            ? "border-red-300 focus:ring-4 focus:ring-red-500/5 bg-red-50 text-red-900"
            : "border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 text-gray-800 bg-white"
        } ${className}`}
      />
      {error && (
        <p className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1 font-semibold">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  ),
);

const SectionTitle = ({ title, description }) => (
  <div className="mb-6">
    <h3 className="text-lg font-bold text-slate-800 flex items-center">
      {title}
    </h3>
    {description && (
      <p className="text-xs text-slate-500 mt-1">{description}</p>
    )}
  </div>
);

const UpdateProfile = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["myProfile"],
    queryFn: getMyProfile,
  });

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: { street: "", city: "", province: "" },
    emergencyContact: { name: "", phone: "", relation: "" },
  });

  useEffect(() => {
    if (profile) setFormData(profile);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["myProfile"], data);
      toast.success("Profile updated successfully");
      navigate("/dashboard/my-profile");
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || "Failed to update profile");
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading)
    return (
      <div className="p-20 text-center animate-pulse text-slate-400 font-medium">
        Loading Profile Form...
      </div>
    );

  const initials =
    `${formData.firstName?.charAt(0) || ""}${formData.lastName?.charAt(0) || ""}`.toUpperCase();

  return (
    <div className="bg-slate-50 min-h-screen p-6 font-sans">
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            {/* BACK BUTTON FROM EARLIER OUTPUT */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center text-sm font-bold text-blue-600 hover:text-blue-700 mb-2 group transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-1 transform group-hover:-translate-x-1 transition-transform" />
              Back to Profile
            </button>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Update Information
            </h1>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center px-8 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-70 active:scale-95"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Summary */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center text-white text-lg font-black shadow-inner">
                  {initials}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {formData.firstName} {formData.lastName}
                  </h2>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                    {profile?.position || "Staff"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-5 border-t border-slate-100">
                <div className="flex items-center text-slate-500">
                  <Mail className="w-3.5 h-3.5 mr-3 text-slate-400" />
                  <span className="text-xs font-semibold">
                    {formData.email}
                  </span>
                </div>
                <div className="flex items-center text-slate-500">
                  <Phone className="w-3.5 h-3.5 mr-3 text-slate-400" />
                  <span className="text-xs font-semibold">
                    {formData.phone || "No phone added"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100/50">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed font-semibold">
                  Restricted Fields: Only HR Administrators can modify
                  employment status and job titles.
                </p>
              </div>
            </div>
          </div>

          {/* Main Form Fields */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
              <SectionTitle
                title="General Information"
                description="Legal name and primary contact details."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  icon={User}
                  required
                />
                <FormField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  icon={User}
                  required
                />
                <FormField
                  label="Email Address"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  icon={Mail}
                  type="email"
                  required
                />
                <FormField
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  icon={Phone}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                <SectionTitle title="Mailing Address" />
                <div className="space-y-4">
                  <FormField
                    label="Street"
                    name="address.street"
                    value={formData.address.street}
                    onChange={handleChange}
                    icon={MapPin}
                  />
                  <FormField
                    label="City"
                    name="address.city"
                    value={formData.address.city}
                    onChange={handleChange}
                  />
                  <FormField
                    label="Province"
                    name="address.province"
                    value={formData.address.province}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <SectionTitle title="Emergency Contact" />
                <div className="space-y-4">
                  <FormField
                    label="Contact Name"
                    name="emergencyContact.name"
                    value={formData.emergencyContact.name}
                    onChange={handleChange}
                    icon={User}
                  />
                  <FormField
                    label="Relationship"
                    name="emergencyContact.relation"
                    value={formData.emergencyContact.relation}
                    onChange={handleChange}
                    icon={ShieldAlert}
                  />
                  <FormField
                    label="Contact Phone"
                    name="emergencyContact.phone"
                    value={formData.emergencyContact.phone}
                    onChange={handleChange}
                    icon={Phone}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default UpdateProfile;
