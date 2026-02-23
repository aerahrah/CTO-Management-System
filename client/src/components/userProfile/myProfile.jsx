import React from "react";
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

/* =========================
   Minimal UI Primitives
========================= */

const Section = ({ title, children, className = "" }) => (
  <div
    className={`bg-white rounded-3xl border border-zinc-100 shadow-sm ${className}`}
  >
    {title && (
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
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

const InfoRow = ({ icon: Icon, label, value, isLink = false }) => (
  <div className="group flex items-center justify-between py-3 first:pt-0 last:pb-0">
    <div className="flex items-center gap-3 text-zinc-500">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-400 group-hover:text-zinc-600 group-hover:border-zinc-200 transition-colors">
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>

    <div className="text-right">
      {isLink && value ? (
        <a
          href={isLink}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline decoration-blue-200 underline-offset-4"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm font-medium text-zinc-900">
          {value || <span className="text-zinc-300">Not set</span>}
        </span>
      )}
    </div>
  </div>
);

/* =========================
   Skeleton & Error States
========================= */

const SkeletonLine = ({ className = "" }) => (
  <div className={`h-3.5 bg-zinc-200/80 rounded-md ${className}`} />
);

const SkeletonChip = ({ className = "" }) => (
  <div className={`h-8 bg-zinc-200/80 rounded-full ${className}`} />
);

const SkeletonIcon = ({ className = "" }) => (
  <div className={`w-8 h-8 rounded-lg bg-zinc-200/80 ${className}`} />
);

const Shimmer = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.3s_infinite] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
    <style>
      {`@keyframes shimmer { 100% { transform: translateX(100%); } }`}
    </style>
  </div>
);

const ProfileSkeleton = () => (
  <div className="min-h-screen bg-zinc-50/50 px-1 py-2">
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="h-4 w-40 bg-zinc-200/80 rounded-md mx-auto md:mx-0" />
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-56 bg-zinc-200/80 rounded-lg" />
            <div className="h-4 w-80 bg-zinc-200/80 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonChip className="w-36" />
            <SkeletonChip className="w-36" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 lg:sticky lg:top-8">
          <div className="relative bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden h-full flex flex-col">
            <Shimmer />
            <div className="p-8 flex flex-col items-center text-center border-b border-zinc-50">
              <div className="w-24 h-24 rounded-full bg-zinc-200/80" />
              <div className="mt-6 h-5 w-40 bg-zinc-200/80 rounded-md" />
              <div className="mt-2 h-4 w-28 bg-zinc-200/80 rounded-md" />
              <div className="mt-6 w-full grid grid-cols-2 gap-2">
                <div className="h-9 bg-zinc-200/70 rounded-xl" />
                <div className="h-9 bg-zinc-200/70 rounded-xl" />
              </div>
            </div>

            <div className="p-6 bg-zinc-50/30 flex-1 flex flex-col justify-center space-y-5">
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <SkeletonIcon />
                      <SkeletonLine className="w-20" />
                    </div>
                    <SkeletonLine className="w-32" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="relative bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
            <Shimmer />
            <div className="px-6 pt-6 pb-2">
              <div className="h-4 w-40 bg-zinc-200/80 rounded-md" />
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <SkeletonIcon />
                        <SkeletonLine className="w-24" />
                      </div>
                      <SkeletonLine className="w-40" />
                    </div>
                    {i < 2 && <div className="h-px bg-zinc-50 my-2" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="relative bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
            <Shimmer />
            <div className="px-6 pt-6 pb-2">
              <div className="h-4 w-44 bg-zinc-200/80 rounded-md" />
            </div>
            <div className="p-6">
              <div className="rounded-2xl p-4 mb-4 border border-amber-100/40 bg-amber-50/40">
                <div className="flex gap-3 items-start">
                  <div className="w-5 h-5 bg-zinc-200/80 rounded" />
                  <div className="flex-1 space-y-2">
                    <SkeletonLine className="w-full max-w-[420px]" />
                    <SkeletonLine className="w-full max-w-[360px]" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div className="space-y-2">
                  <SkeletonLine className="h-3 w-28" />
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-200/80" />
                    <div className="space-y-2">
                      <SkeletonLine className="w-32" />
                      <SkeletonLine className="w-24" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 flex flex-col justify-center">
                  <SkeletonLine className="h-3 w-32" />
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-4 h-4 bg-zinc-200/80 rounded" />
                    <SkeletonLine className="w-28" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden hidden lg:block">
            <Shimmer />
            <div className="p-6">
              <div className="h-4 w-52 bg-zinc-200/70 rounded-md" />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="h-16 bg-zinc-200/60 rounded-2xl" />
                <div className="h-16 bg-zinc-200/60 rounded-2xl" />
              </div>
            </div>
          </div>
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
   Sub-Components
========================= */

const IdentityCard = ({ profile }) => {
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
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-8 flex flex-col items-center text-center border-b border-zinc-50">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-medium shadow-xl shadow-blue-200">
            {initials}
          </div>
        </div>

        <h2 className="text-xl font-semibold text-zinc-900">
          {fullName || "—"}
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          {profile.position || "No Position"}
        </p>

        <div className="mt-6 w-full grid grid-cols-2 gap-2" />
      </div>

      <div className="p-6 bg-zinc-50/30 flex-1 flex flex-col justify-center space-y-5">
        <div className="space-y-4">
          <InfoRow
            icon={Mail}
            label="Email"
            value={profile.email}
            isLink={`mailto:${profile.email}`}
          />
          <InfoRow icon={Phone} label="Mobile" value={profile.phone} />
          <InfoRow icon={MapPin} label="Location" value={fullAddress} />
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["myProfile"],
    queryFn: getMyProfile,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <ProfileSkeleton />;
  if (error) return <ErrorState message={error?.message || "Unknown error"} />;

  const profile = data?.data ?? data ?? {};

  // ✅ FIX: project/designation are populated objects -> render .name
  const projectName = profile.project?.name || "";
  const designationName = profile.designation?.name || "";

  return (
    <div className="min-h-screen px-1 py-2">
      <div className="">
        <div className="mb-6">
          <Breadcrumbs rootLabel="Home" rootTo="/app" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                My Profile
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage your personal information and preferences.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ActionButton
                variant="secondary"
                icon={KeyRound}
                onClick={() => navigate("/app/my-profile/reset-password")}
              >
                Reset Password
              </ActionButton>
              <ActionButton
                variant="primary"
                icon={Edit3}
                onClick={() => navigate("/app/my-profile/edit")}
              >
                Edit Profile
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          <div className="lg:col-span-4 lg:sticky lg:top-8">
            <IdentityCard profile={profile} />
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Section title="Employment Details">
              <div className="space-y-1">
                <InfoRow
                  icon={Briefcase}
                  label="Position"
                  value={profile.position}
                />
                <div className="h-px bg-zinc-50 my-2" />
                <InfoRow
                  icon={Building2}
                  label="Department"
                  value={profile.division}
                />
                <div className="h-px bg-zinc-50 my-2" />

                {/* ✅ FIXED HERE */}
                <InfoRow
                  icon={FolderGit2}
                  label="Current Project"
                  value={projectName}
                />

                {/* Optional: show designation if you want */}
                {/* <div className="h-px bg-zinc-50 my-2" />
                <InfoRow icon={User} label="Designation" value={designationName} /> */}
              </div>
            </Section>

            <Section title="Emergency Contact">
              <div className="bg-amber-50/50 rounded-2xl p-4 mb-4 border border-amber-100/50 flex gap-3 items-start">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  This contact will only be used in case of medical emergencies
                  or urgent situations where we cannot reach you directly.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                    Primary Contact
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {profile.emergencyContact?.name || "—"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {profile.emergencyContact?.relation ||
                          "Relation unknown"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 flex flex-col justify-center">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                    Contact Number
                  </p>
                  <div className="flex items-center gap-2 text-zinc-900 font-medium text-sm">
                    <Phone className="w-4 h-4 text-zinc-400" />
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
