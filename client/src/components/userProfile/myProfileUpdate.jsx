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
import { useAuth } from "../../store/authStore";

/* ------------------ Resolve theme (same basis as CTO Credit History) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* =========================
   Minimal UI Primitives
========================= */

const Section = ({ title, children, className = "", borderColor }) => (
  <div
    className={[
      "rounded-3xl border shadow-sm transition-colors duration-300 ease-out",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor,
    }}
  >
    {title && (
      <div className="px-6 pt-6">
        <h3
          className="text-sm font-medium tracking-tight transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
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
  borderColor,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-50";

  const styles = {
    primary: {
      backgroundColor: "var(--accent)",
      color: "#fff",
      border: "1px solid transparent",
    },
    secondary: {
      backgroundColor: "var(--app-surface)",
      color: "var(--app-text)",
      border: `1px solid ${borderColor}`,
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--app-muted)",
      border: "1px solid transparent",
    },
  };

  return (
    <button
      className={baseStyles}
      style={styles[variant]}
      onMouseEnter={(e) => {
        if (props.disabled) return;

        if (variant === "primary") {
          e.currentTarget.style.filter = "brightness(0.95)";
          e.currentTarget.style.boxShadow = "0 10px 24px rgba(0,0,0,0.12)";
        } else if (variant === "secondary") {
          e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
        } else {
          e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
          e.currentTarget.style.color = "var(--app-text)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "none";
        e.currentTarget.style.boxShadow = "none";

        if (variant === "primary") {
          e.currentTarget.style.backgroundColor = "var(--accent)";
        } else if (variant === "secondary") {
          e.currentTarget.style.backgroundColor = "var(--app-surface)";
        } else {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--app-muted)";
        }
      }}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" strokeWidth={2} />}
      {children}
    </button>
  );
};

const InlineHint = ({
  icon: Icon = Info,
  children,
  tone = "blue",
  resolvedTheme,
}) => {
  const tones = {
    blue: {
      backgroundColor:
        resolvedTheme === "dark"
          ? "rgba(59,130,246,0.12)"
          : "rgba(59,130,246,0.08)",
      borderColor:
        resolvedTheme === "dark"
          ? "rgba(59,130,246,0.24)"
          : "rgba(59,130,246,0.16)",
      color: resolvedTheme === "dark" ? "#bfdbfe" : "#1d4ed8",
    },
    amber: {
      backgroundColor:
        resolvedTheme === "dark"
          ? "rgba(245,158,11,0.12)"
          : "rgba(245,158,11,0.10)",
      borderColor:
        resolvedTheme === "dark"
          ? "rgba(245,158,11,0.24)"
          : "rgba(245,158,11,0.20)",
      color: resolvedTheme === "dark" ? "#fcd34d" : "#92400e",
    },
    rose: {
      backgroundColor:
        resolvedTheme === "dark"
          ? "rgba(244,63,94,0.12)"
          : "rgba(244,63,94,0.10)",
      borderColor:
        resolvedTheme === "dark"
          ? "rgba(244,63,94,0.24)"
          : "rgba(244,63,94,0.20)",
      color: resolvedTheme === "dark" ? "#fda4af" : "#be123c",
    },
    gray: {
      backgroundColor: "var(--app-surface-2)",
      borderColor:
        resolvedTheme === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(15,23,42,0.08)",
      color: "var(--app-text)",
    },
  };

  const style = tones[tone];

  return (
    <div
      className="rounded-2xl p-5 border transition-colors duration-300 ease-out"
      style={style}
    >
      <div className="flex gap-3">
        <Icon className="w-5 h-5 shrink-0 opacity-90 mt-0.5" />
        <p className="text-xs leading-relaxed font-semibold">{children}</p>
      </div>
    </div>
  );
};

const FormField = React.forwardRef(
  (
    {
      icon: Icon,
      label,
      error,
      required,
      className = "",
      hint,
      borderColor,
      ...props
    },
    ref,
  ) => (
    <div className="w-full pt-2">
      <label
        className="block text-xs mb-1.5 flex items-center gap-2 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        {Icon && (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor,
              color: "var(--app-muted)",
            }}
          >
            <Icon className="w-4 h-4" strokeWidth={1.8} />
          </span>
        )}
        <span className="font-medium">
          {label} {required && <span style={{ color: "#f43f5e" }}>*</span>}
        </span>
      </label>

      <input
        ref={ref}
        {...props}
        className={[
          "w-full h-11 px-3 text-sm rounded-xl border outline-none transition-colors duration-200 ease-out",
          "disabled:opacity-60",
          className,
        ].join(" ")}
        style={{
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
          borderColor: error ? "rgba(244,63,94,0.45)" : borderColor,
          boxShadow: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error
            ? "rgba(244,63,94,0.60)"
            : "var(--accent)";
          e.currentTarget.style.boxShadow = error
            ? "0 0 0 3px rgba(244,63,94,0.14)"
            : "0 0 0 3px var(--accent-soft)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error
            ? "rgba(244,63,94,0.45)"
            : borderColor;
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {hint && !error && (
        <p
          className="text-xs mt-2 transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {hint}
        </p>
      )}

      {error && (
        <p
          className="text-xs mt-2 flex items-center gap-2"
          style={{ color: "#f43f5e" }}
        >
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  ),
);

FormField.displayName = "FormField";

/* =========================
   Skeleton & Error
========================= */

const PageSkeleton = ({ borderColor, skeletonColors }) => (
  <div
    className="min-h-screen px-1 py-2 transition-colors duration-300 ease-out animate-pulse"
    style={{ backgroundColor: "var(--app-bg)" }}
  >
    <div className="max-w-6xl mx-auto space-y-8">
      <div
        className="h-5 w-64 rounded-lg"
        style={{ backgroundColor: skeletonColors.baseColor }}
      />
      <div className="flex justify-between items-center gap-4">
        <div className="space-y-2">
          <div
            className="h-8 w-56 rounded-lg"
            style={{ backgroundColor: skeletonColors.baseColor }}
          />
          <div
            className="h-4 w-80 rounded-lg"
            style={{ backgroundColor: skeletonColors.baseColor }}
          />
        </div>
        <div className="flex gap-2">
          <div
            className="h-10 w-28 rounded-full"
            style={{ backgroundColor: skeletonColors.baseColor }}
          />
          <div
            className="h-10 w-36 rounded-full"
            style={{ backgroundColor: skeletonColors.baseColor }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div
          className="lg:col-span-4 h-72 rounded-3xl border"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
          }}
        />
        <div className="lg:col-span-8 space-y-6">
          <div
            className="h-56 rounded-3xl border"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
            }}
          />
          <div
            className="h-56 rounded-3xl border"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
            }}
          />
        </div>
      </div>
    </div>
  </div>
);

const ErrorState = ({ message, borderColor }) => (
  <div
    className="min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ease-out"
    style={{ backgroundColor: "var(--app-bg)" }}
  >
    <div
      className="p-6 rounded-2xl shadow-sm max-w-md w-full text-center border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "rgba(244,63,94,0.20)",
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{
          backgroundColor: "rgba(244,63,94,0.12)",
          color: "#f43f5e",
          border: `1px solid ${borderColor}`,
        }}
      >
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3
        className="text-lg font-medium transition-colors duration-300 ease-out"
        style={{ color: "var(--app-text)" }}
      >
        Unable to load profile
      </h3>
      <p
        className="text-sm mt-2 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        {message}
      </p>
    </div>
  </div>
);

/* =========================
   Sidebar Card
========================= */

const MiniRow = ({ icon: Icon, label, value, muted, borderColor }) => (
  <div
    className="flex items-center gap-3 p-3 rounded-2xl border transition-colors duration-300 ease-out"
    style={{
      borderColor,
      backgroundColor: "var(--app-surface)",
    }}
  >
    <div
      className="p-2 rounded-xl border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface-2)",
        borderColor,
        color: "var(--app-muted)",
      }}
    >
      <Icon className="w-4 h-4" strokeWidth={1.7} />
    </div>
    <div className="min-w-0 flex-1">
      <div
        className="text-xs transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-sm font-medium truncate transition-colors duration-300 ease-out"
        style={{ color: muted ? "var(--app-muted)" : "var(--app-text)" }}
      >
        {value}
      </div>
    </div>
  </div>
);

const ProfileSidebar = ({ formData, position, borderColor }) => {
  const initials = useMemo(() => {
    const a = formData.firstName?.charAt(0) || "";
    const b = formData.lastName?.charAt(0) || "";
    return `${a}${b}`.toUpperCase() || "?";
  }, [formData.firstName, formData.lastName]);

  const name = `${formData.firstName || ""} ${formData.lastName || ""}`.trim();

  return (
    <div
      className="rounded-3xl border shadow-sm overflow-hidden transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
      }}
    >
      <div
        className="p-8 flex flex-col items-center text-center border-b transition-colors duration-300 ease-out"
        style={{ borderColor }}
      >
        <div
          className="w-24 h-24 rounded-full text-white flex items-center justify-center text-2xl font-medium shadow-xl"
          style={{
            backgroundColor: "var(--accent)",
            boxShadow: "0 16px 40px rgba(37,99,235,0.22)",
          }}
        >
          {initials}
        </div>

        <h2
          className="text-xl font-semibold mt-5 transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {name || "—"}
        </h2>
        <p
          className="text-sm mt-1 transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {position || "Staff"}
        </p>

        <div className="mt-6 w-full" />
      </div>

      <div
        className="p-6 space-y-4 transition-colors duration-300 ease-out"
        style={{ backgroundColor: "var(--app-surface-2)" }}
      >
        <MiniRow
          icon={Mail}
          label="Email"
          value={formData.email}
          borderColor={borderColor}
        />
        <MiniRow
          icon={Phone}
          label="Mobile"
          value={formData.phone || "No phone added"}
          muted={!formData.phone}
          borderColor={borderColor}
        />
      </div>
    </div>
  );
};

/* =========================
   Main Component
========================= */

const UpdateProfile = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    if (resolvedTheme === "dark") {
      return {
        baseColor: "rgba(255,255,255,0.06)",
        highlightColor: "rgba(255,255,255,0.10)",
      };
    }
    return {
      baseColor: "rgba(15,23,42,0.06)",
      highlightColor: "rgba(15,23,42,0.10)",
    };
  }, [resolvedTheme]);

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["myProfile"] });
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

  if (isLoading) {
    return (
      <PageSkeleton borderColor={borderColor} skeletonColors={skeletonColors} />
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error?.message || "Unknown error"}
        borderColor={borderColor}
      />
    );
  }

  return (
    <div
      className="min-h-screen px-1 py-2 transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <Breadcrumbs rootLabel="Home" rootTo="/app" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-6xl mx-auto">
            <div>
              <h1
                className="text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                Update Information
              </h1>
              <p
                className="text-sm mt-1 transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
                Keep your contact details and emergency info up to date.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <ActionButton
                type="button"
                variant="secondary"
                borderColor={borderColor}
                onClick={() => navigate(-1)}
              >
                Cancel
              </ActionButton>

              <ActionButton
                type="submit"
                variant="primary"
                icon={mutation.isPending ? Loader2 : Save}
                borderColor={borderColor}
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
          <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
            <ProfileSidebar
              formData={formData}
              position={profile?.position}
              borderColor={borderColor}
            />

            <InlineHint tone="blue" resolvedTheme={resolvedTheme}>
              Restricted Fields: Only HR Administrators can modify employment
              status and job titles.
            </InlineHint>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Section title="General Information" borderColor={borderColor}>
              <p
                className="text-xs -mt-1 mb-4 transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
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
                  borderColor={borderColor}
                />
                <FormField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  icon={User}
                  required
                  borderColor={borderColor}
                />
                <FormField
                  label="Email Address"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  icon={Mail}
                  type="email"
                  required
                  borderColor={borderColor}
                />
                <FormField
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  icon={Phone}
                  borderColor={borderColor}
                />
              </div>
            </Section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section title="Personal Address" borderColor={borderColor}>
                <div className="space-y-3">
                  <FormField
                    label="Street"
                    name="address.street"
                    value={formData.address.street}
                    onChange={handleChange}
                    icon={MapPin}
                    borderColor={borderColor}
                  />
                  <FormField
                    label="City"
                    name="address.city"
                    value={formData.address.city}
                    onChange={handleChange}
                    borderColor={borderColor}
                  />
                  <FormField
                    label="Province"
                    name="address.province"
                    value={formData.address.province}
                    onChange={handleChange}
                    borderColor={borderColor}
                  />
                </div>
              </Section>

              <Section title="Emergency Contact" borderColor={borderColor}>
                <div
                  className="rounded-2xl p-4 mb-4 border flex gap-3 items-start transition-colors duration-300 ease-out"
                  style={{
                    borderColor: "rgba(245,158,11,0.35)",
                    backgroundColor: "rgba(245,158,11,0.10)",
                  }}
                >
                  <ShieldAlert
                    className="w-5 h-5 shrink-0 mt-0.5"
                    style={{
                      color: resolvedTheme === "dark" ? "#fcd34d" : "#b45309",
                    }}
                  />
                  <p
                    className="text-xs leading-relaxed"
                    style={{
                      color: resolvedTheme === "dark" ? "#fcd34d" : "#92400e",
                    }}
                  >
                    This contact will only be used in case of emergencies when
                    we can’t reach you directly.
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField
                    label="Contact Name"
                    name="emergencyContact.name"
                    value={formData.emergencyContact.name}
                    onChange={handleChange}
                    icon={User}
                    borderColor={borderColor}
                  />
                  <FormField
                    label="Relationship"
                    name="emergencyContact.relation"
                    value={formData.emergencyContact.relation}
                    onChange={handleChange}
                    icon={ShieldAlert}
                    borderColor={borderColor}
                  />
                  <FormField
                    label="Contact Phone"
                    name="emergencyContact.phone"
                    value={formData.emergencyContact.phone}
                    onChange={handleChange}
                    icon={Phone}
                    borderColor={borderColor}
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
