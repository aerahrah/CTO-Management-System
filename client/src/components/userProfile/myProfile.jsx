import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../breadCrumbs";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  FolderGit2,
  ShieldAlert,
  Edit3,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { getMyProfile } from "../../api/employee";
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
    className={`rounded-3xl border shadow-sm transition-colors duration-300 ease-out ${className}`}
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor,
    }}
  >
    {title && (
      <div className="px-6 pt-6 pb-2">
        <h3
          className="text-sm font-medium tracking-tight transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {title}
        </h3>
      </div>
    )}
    <div className="p-6">{children}</div>
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
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95";

  const styleMap = {
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
      style={styleMap[variant]}
      onMouseEnter={(e) => {
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

const InfoRow = ({ icon: Icon, label, value, isLink = false, borderColor }) => (
  <div className="group flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-4">
    <div
      className="flex items-center gap-3 transition-colors duration-300 ease-out min-w-0"
      style={{ color: "var(--app-muted)" }}
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor,
          color: "var(--app-muted)",
        }}
      >
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>

    <div className="text-right min-w-0">
      {isLink && value ? (
        <a
          href={isLink}
          className="text-sm font-medium underline underline-offset-4 break-all transition-colors duration-200 ease-out"
          style={{
            color: "var(--accent)",
            textDecorationColor: "var(--accent-soft2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(0.92)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "none";
          }}
        >
          {value}
        </a>
      ) : (
        <span
          className="text-sm font-medium break-words transition-colors duration-300 ease-out"
          style={{ color: value ? "var(--app-text)" : "var(--app-muted)" }}
        >
          {value || "Not set"}
        </span>
      )}
    </div>
  </div>
);

/* =========================
   Skeleton & Error States
========================= */

const SkeletonLine = ({ className = "" }) => (
  <div
    className={`rounded-md ${className}`}
    style={{ backgroundColor: "var(--skeleton-base)" }}
  />
);

const SkeletonChip = ({ className = "" }) => (
  <div
    className={`rounded-full ${className}`}
    style={{ backgroundColor: "var(--skeleton-base)" }}
  />
);

const SkeletonIcon = ({ className = "" }) => (
  <div
    className={`rounded-lg ${className}`}
    style={{ backgroundColor: "var(--skeleton-base)" }}
  />
);

const Shimmer = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
    <div
      className="absolute inset-0 -translate-x-full animate-[shimmer_1.3s_infinite]"
      style={{
        background:
          "linear-gradient(90deg, transparent, var(--skeleton-highlight), transparent)",
      }}
    />
    <style>
      {`@keyframes shimmer { 100% { transform: translateX(100%); } }`}
    </style>
  </div>
);

const ProfileSkeleton = ({ borderColor }) => (
  <div
    className="min-h-screen px-1 py-2 transition-colors duration-300 ease-out"
    style={{ backgroundColor: "var(--app-bg)" }}
  >
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <div
          className="h-4 w-40 rounded-md mx-auto md:mx-0"
          style={{ backgroundColor: "var(--skeleton-base)" }}
        />
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div
              className="h-8 w-56 rounded-lg"
              style={{ backgroundColor: "var(--skeleton-base)" }}
            />
            <div
              className="h-4 w-80 rounded-md"
              style={{ backgroundColor: "var(--skeleton-base)" }}
            />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonChip className="h-9 w-36" />
            <SkeletonChip className="h-9 w-36" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 lg:sticky lg:top-8">
          <div
            className="relative rounded-3xl border shadow-sm overflow-hidden h-full flex flex-col transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
            }}
          >
            <Shimmer />
            <div
              className="p-8 flex flex-col items-center text-center border-b transition-colors duration-300 ease-out"
              style={{ borderColor }}
            >
              <div
                className="w-24 h-24 rounded-full"
                style={{ backgroundColor: "var(--skeleton-base)" }}
              />
              <div
                className="mt-6 h-5 w-40 rounded-md"
                style={{ backgroundColor: "var(--skeleton-base)" }}
              />
              <div
                className="mt-2 h-4 w-28 rounded-md"
                style={{ backgroundColor: "var(--skeleton-base)" }}
              />
            </div>

            <div
              className="p-6 flex-1 flex flex-col justify-center space-y-5 transition-colors duration-300 ease-out"
              style={{ backgroundColor: "var(--app-surface-2)" }}
            >
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <SkeletonIcon className="w-8 h-8" />
                      <SkeletonLine className="h-3.5 w-20" />
                    </div>
                    <SkeletonLine className="h-3.5 w-32" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div
            className="relative rounded-3xl border shadow-sm overflow-hidden transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
            }}
          >
            <Shimmer />
            <div className="px-6 pt-6 pb-2">
              <div
                className="h-4 w-40 rounded-md"
                style={{ backgroundColor: "var(--skeleton-base)" }}
              />
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <SkeletonIcon className="w-8 h-8" />
                        <SkeletonLine className="h-3.5 w-24" />
                      </div>
                      <SkeletonLine className="h-3.5 w-40" />
                    </div>
                    {i < 2 && (
                      <div
                        className="h-px my-2"
                        style={{ backgroundColor: borderColor }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div
            className="relative rounded-3xl border shadow-sm overflow-hidden transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
            }}
          >
            <Shimmer />
            <div className="px-6 pt-6 pb-2">
              <div
                className="h-4 w-44 rounded-md"
                style={{ backgroundColor: "var(--skeleton-base)" }}
              />
            </div>
            <div className="p-6">
              <div
                className="rounded-2xl p-4 mb-4 border transition-colors duration-300 ease-out"
                style={{
                  borderColor: "rgba(245,158,11,0.35)",
                  backgroundColor: "rgba(245,158,11,0.10)",
                }}
              >
                <div className="flex gap-3 items-start">
                  <div
                    className="w-5 h-5 rounded"
                    style={{ backgroundColor: "var(--skeleton-base)" }}
                  />
                  <div className="flex-1 space-y-2">
                    <SkeletonLine className="h-3.5 w-full max-w-[420px]" />
                    <SkeletonLine className="h-3.5 w-full max-w-[360px]" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div className="space-y-2">
                  <SkeletonLine className="h-3 w-28" />
                  <div className="flex items-center gap-3 mt-2">
                    <div
                      className="w-10 h-10 rounded-full"
                      style={{ backgroundColor: "var(--skeleton-base)" }}
                    />
                    <div className="space-y-2">
                      <SkeletonLine className="h-3.5 w-32" />
                      <SkeletonLine className="h-3.5 w-24" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 flex flex-col justify-center">
                  <SkeletonLine className="h-3 w-32" />
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: "var(--skeleton-base)" }}
                    />
                    <SkeletonLine className="h-3.5 w-28" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="relative rounded-3xl border shadow-sm overflow-hidden hidden lg:block transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
            }}
          >
            <Shimmer />
            <div className="p-6">
              <div
                className="h-4 w-52 rounded-md"
                style={{ backgroundColor: "var(--skeleton-base)" }}
              />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div
                  className="h-16 rounded-2xl"
                  style={{ backgroundColor: "var(--skeleton-base)" }}
                />
                <div
                  className="h-16 rounded-2xl"
                  style={{ backgroundColor: "var(--skeleton-base)" }}
                />
              </div>
            </div>
          </div>
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
   Sub-Components
========================= */

const IdentityCard = ({ profile, borderColor }) => {
  const initials =
    `${profile.firstName?.charAt(0) || ""}${profile.lastName?.charAt(0) || ""}`.toUpperCase();

  const fullName =
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim();

  const fullAddress = [
    profile.address?.street,
    profile.address?.city,
    profile.address?.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="rounded-3xl border shadow-sm overflow-hidden h-full flex flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
      }}
    >
      <div
        className="p-8 flex flex-col items-center text-center border-b transition-colors duration-300 ease-out"
        style={{ borderColor }}
      >
        <div className="relative mb-6">
          <div
            className="w-24 h-24 rounded-full text-white flex items-center justify-center text-2xl font-medium shadow-xl"
            style={{
              backgroundColor: "var(--accent)",
              boxShadow: "0 16px 40px rgba(37,99,235,0.22)",
            }}
          >
            {initials || "—"}
          </div>
        </div>

        <h2
          className="text-xl font-semibold transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {fullName || "—"}
        </h2>
        <p
          className="text-sm mt-1 transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {profile.position || "No Position"}
        </p>
      </div>

      <div
        className="p-6 flex-1 flex flex-col justify-center space-y-5 transition-colors duration-300 ease-out"
        style={{ backgroundColor: "var(--app-surface-2)" }}
      >
        <div className="space-y-4">
          <InfoRow
            icon={Mail}
            label="Email"
            value={profile.email}
            isLink={profile.email ? `mailto:${profile.email}` : false}
            borderColor={borderColor}
          />
          <InfoRow
            icon={Phone}
            label="Mobile"
            value={profile.phone}
            borderColor={borderColor}
          />
          <InfoRow
            icon={MapPin}
            label="Location"
            value={fullAddress}
            borderColor={borderColor}
          />
        </div>
      </div>
    </div>
  );
};

/* =========================
   Main Component
========================= */

const MyProfile = () => {
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

  if (isLoading) {
    return (
      <div
        style={{
          "--skeleton-base": skeletonColors.baseColor,
          "--skeleton-highlight": skeletonColors.highlightColor,
        }}
      >
        <ProfileSkeleton borderColor={borderColor} />
      </div>
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

  const profile = data?.data ?? data ?? {};
  const projectName = profile.project?.name || "";

  return (
    <div
      className="min-h-screen px-1 py-2 transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Breadcrumbs rootLabel="Home" rootTo="/app" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1
                className="text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                My Profile
              </h1>
              <p
                className="text-sm mt-1 transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
                Manage your personal information and preferences.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <ActionButton
                variant="secondary"
                icon={KeyRound}
                borderColor={borderColor}
                onClick={() => navigate("/app/my-profile/reset-password")}
              >
                Reset Password
              </ActionButton>

              <ActionButton
                variant="primary"
                icon={Edit3}
                borderColor={borderColor}
                onClick={() => navigate("/app/my-profile/edit")}
              >
                Edit Profile
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-8">
            <IdentityCard profile={profile} borderColor={borderColor} />
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Section title="Employment Details" borderColor={borderColor}>
              <div className="space-y-1">
                <InfoRow
                  icon={Briefcase}
                  label="Position"
                  value={profile.position}
                  borderColor={borderColor}
                />
                <div
                  className="h-px my-2"
                  style={{ backgroundColor: borderColor }}
                />
                <InfoRow
                  icon={Building2}
                  label="Department"
                  value={profile.division}
                  borderColor={borderColor}
                />
                <div
                  className="h-px my-2"
                  style={{ backgroundColor: borderColor }}
                />
                <InfoRow
                  icon={FolderGit2}
                  label="Current Project"
                  value={projectName}
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
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                <p
                  className="text-xs leading-relaxed"
                  style={{
                    color: resolvedTheme === "dark" ? "#fcd34d" : "#92400e",
                  }}
                >
                  This contact will only be used in case of medical emergencies
                  or urgent situations where we cannot reach you directly.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <div className="space-y-1">
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2 transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Primary Contact
                  </p>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface-2)",
                        color: "var(--app-muted)",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <User className="w-5 h-5" />
                    </div>

                    <div>
                      <p
                        className="text-sm font-medium transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-text)" }}
                      >
                        {profile.emergencyContact?.name || "—"}
                      </p>
                      <p
                        className="text-xs transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {profile.emergencyContact?.relation ||
                          "Relation unknown"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 flex flex-col justify-center">
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2 transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Contact Number
                  </p>

                  <div
                    className="flex items-center gap-2 text-sm font-medium transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    <Phone
                      className="w-4 h-4"
                      style={{ color: "var(--app-muted)" }}
                    />
                    {profile.emergencyContact?.phone || "—"}
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
