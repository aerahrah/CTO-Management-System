import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../breadCrumbs";
import {
  User,
  Mail,
  Phone,
  MapPin,
  ShieldAlert,
  Save,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { getMyProfile, updateMyProfile } from "../../api/employee";
import { toast } from "react-toastify";

/* =========================
   Minimal UI Primitives (match MyProfile)
========================= */

const Section = ({ title, children, className = "" }) => (
  <div
    className={[
      "bg-white rounded-3xl border border-zinc-100 shadow-sm",
      className,
    ].join(" ")}
  >
    {title && (
      <div className="px-6 pt-6">
        <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
          {title}
        </h3>
      </div>
    )}
    <div className="px-6 py-3">{children}</div>
  </div>
);

const ActionButton = ({
  variant = "primary",
  icon: Icon,
  children,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95";

  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md",
    secondary:
      "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
    ghost:
      "bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]}`} {...props}>
      {Icon && <Icon className="w-4 h-4" strokeWidth={2} />}
      {children}
    </button>
  );
};

const Divider = ({ className = "" }) => (
  <div className={["h-px bg-zinc-100", className].join(" ")} />
);

const InlineHint = ({ icon: Icon = Info, children, tone = "blue" }) => {
  const tones = {
    blue: "bg-blue-50/50 border-blue-100/50 text-blue-700",
    amber: "bg-amber-50/50 border-amber-100/50 text-amber-800",
    rose: "bg-rose-50/50 border-rose-100/50 text-rose-700",
    gray: "bg-zinc-50 border-zinc-100 text-zinc-700",
  };
  return (
    <div className={`rounded-2xl p-5 border ${tones[tone]}`}>
      <div className="flex gap-3">
        <Icon className="w-5 h-5 shrink-0 opacity-90 mt-0.5" />
        <p className="text-xs leading-relaxed font-semibold">{children}</p>
      </div>
    </div>
  );
};

/** Input (minimal, sleek) */
const FormField = React.forwardRef(
  (
    { icon: Icon, label, error, required, className = "", hint, ...props },
    ref,
  ) => (
    <div className="w-full pt-2">
      <label className="block text-xs text-zinc-600 mb-1.5 flex items-center gap-2">
        {Icon && (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-500">
            <Icon className="w-4 h-4" strokeWidth={1.8} />
          </span>
        )}
        <span className="font-medium">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      </label>

      <input
        ref={ref}
        {...props}
        className={[
          "w-full h-11 px-3",
          "text-sm text-zinc-900",
          "rounded-xl border outline-none transition",
          "bg-white",
          error
            ? "border-rose-300 focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
            : "border-zinc-200 focus:ring-2 focus:ring-blue-200/70 focus:border-blue-300",
          "disabled:opacity-60 disabled:bg-zinc-50",
          className,
        ].join(" ")}
      />

      {hint && !error && <p className="text-xs text-zinc-500 mt-2">{hint}</p>}

      {error && (
        <p className="text-rose-600 text-xs mt-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  ),
);

/* =========================
   Skeleton & Error
========================= */

const PageSkeleton = () => (
  <div className="min-h-screen bg-zinc-50/50 p-6 md:p-10 animate-pulse">
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="h-5 w-64 bg-zinc-200 rounded-lg" />
      <div className="flex justify-between items-center gap-4">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-zinc-200 rounded-lg" />
          <div className="h-4 w-80 bg-zinc-200 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-zinc-200 rounded-full" />
          <div className="h-10 w-36 bg-zinc-200 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 h-72 bg-white rounded-3xl border border-zinc-100" />
        <div className="lg:col-span-8 space-y-6">
          <div className="h-56 bg-white rounded-3xl border border-zinc-100" />
          <div className="h-56 bg-white rounded-3xl border border-zinc-100" />
        </div>
      </div>
    </div>
  </div>
);

const ErrorState = ({ message }) => (
  <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
    <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm max-w-md w-full text-center">
      <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-medium text-zinc-900">
        Unable to load profile
      </h3>
      <p className="text-sm text-zinc-500 mt-2">{message}</p>
    </div>
  </div>
);

/* =========================
   Sidebar Card (matches MyProfile concept)
========================= */

const ProfileSidebar = ({ formData, position }) => {
  const initials = useMemo(() => {
    const a = formData.firstName?.charAt(0) || "";
    const b = formData.lastName?.charAt(0) || "";
    return `${a}${b}`.toUpperCase() || "?";
  }, [formData.firstName, formData.lastName]);

  const name = `${formData.firstName || ""} ${formData.lastName || ""}`.trim();

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-8 flex flex-col items-center text-center border-b border-zinc-50">
        <div className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-medium shadow-xl shadow-blue-200">
          {initials}
        </div>

        <h2 className="text-xl font-semibold text-zinc-900 mt-5">
          {name || "—"}
        </h2>
        <p className="text-sm text-zinc-500 mt-1">{position || "Staff"}</p>

        <div className="mt-6 w-full" />
      </div>

      <div className="p-6 bg-zinc-50/30 space-y-4">
        <MiniRow icon={Mail} label="Email" value={formData.email} />
        <MiniRow
          icon={Phone}
          label="Mobile"
          value={formData.phone || "No phone added"}
          muted={!formData.phone}
        />
      </div>
    </div>
  );
};

const MiniRow = ({ icon: Icon, label, value, muted }) => (
  <div className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-100 bg-white/60">
    <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-500">
      <Icon className="w-4 h-4" strokeWidth={1.7} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={[
          "text-sm font-medium truncate",
          muted ? "text-zinc-400" : "text-zinc-900",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  </div>
);

/* =========================
   Main Component
========================= */

const UpdateProfile = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["myProfile"],
    queryFn: getMyProfile,
    staleTime: 1000 * 60 * 5,
  });

  const profile = data?.data ?? data ?? null;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: { street: "", city: "", province: "" },
    emergencyContact: { name: "", phone: "", relation: "" },
  });

  useEffect(() => {
    if (!profile) return;
    setFormData({
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      email: profile.email || "",
      phone: profile.phone || "",
      address: {
        street: profile.address?.street || "",
        city: profile.address?.city || "",
        province: profile.address?.province || "",
      },
      emergencyContact: {
        name: profile.emergencyContact?.name || "",
        phone: profile.emergencyContact?.phone || "",
        relation: profile.emergencyContact?.relation || "",
      },
    });
  }, [profile]);

  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (res) => {
      queryClient.setQueryData(["myProfile"], res);
      toast.success("Profile updated successfully");
      navigate("/app/my-profile");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || "Failed to update profile");
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

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState message={error?.message || "Unknown error"} />;

  return (
    <div className="min-h-screen bg-zinc-50/50 px-1 py-2">
      <form onSubmit={handleSubmit} className="">
        {/* Breadcrumbs + Header */}
        <div className="mb-6 ">
          <Breadcrumbs rootLabel="Home" rootTo="/app" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Update Information
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Keep your contact details and emergency info up to date.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <ActionButton
                type="button"
                variant="secondary"
                onClick={() => navigate(-1)}
              >
                Cancel
              </ActionButton>

              <ActionButton
                type="submit"
                variant="primary"
                icon={Save}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          {/* Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
            <ProfileSidebar formData={formData} position={profile?.position} />

            <InlineHint tone="blue">
              Restricted Fields: Only HR Administrators can modify employment
              status and job titles.
            </InlineHint>
          </div>

          {/* Main */}
          <div className="lg:col-span-8 space-y-6">
            <Section title="General Information">
              <p className="text-xs text-zinc-500 -mt-1 mb-4">
                Legal name and primary contact details.
              </p>

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
            </Section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section title="Personal Address">
                <div className="space-y-3">
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
              </Section>

              <Section title="Emergency Contact">
                {/* <div className="bg-amber-50/50 rounded-2xl p-4 mb-4 border border-amber-100/50 flex gap-3 items-start">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    This contact will only be used in case of emergencies when
                    we can’t reach you directly.
                  </p>
                </div> */}

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
              </Section>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default UpdateProfile;
