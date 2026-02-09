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
  Copy,
  ChevronRight,
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
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg  text-sm font-medium transition-all duration-200 active:scale-95";

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
      <div className="flex items-center justify-center w-8 h-8 rounded-lg  bg-zinc-50 border border-zinc-100 text-zinc-400 group-hover:text-zinc-600 group-hover:border-zinc-200 transition-colors">
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

const Badge = ({ children, color = "green" }) => {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    gray: "bg-zinc-50 text-zinc-600 border-zinc-100",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[color]}`}
    >
      {children}
    </span>
  );
};

/* =========================
   Skeleton & Error States
========================= */

const ProfileSkeleton = () => (
  <div className="min-h-screen bg-zinc-50/50 p-6 md:p-10 animate-pulse">
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-zinc-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-zinc-200 rounded-full" />
          <div className="h-10 w-32 bg-zinc-200 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 h-96 bg-white rounded-3xl border border-zinc-100" />
        <div className="lg:col-span-8 space-y-6">
          <div className="h-40 bg-white rounded-3xl border border-zinc-100" />
          <div className="h-40 bg-white rounded-3xl border border-zinc-100" />
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

        <div className="mt-6 w-full grid grid-cols-2 gap-2">
          {/* Quick stats or minimal tags could go here if needed */}
        </div>
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

  return (
    <div className="min-h-screen px-1 py-2">
      <div className="">
        {/* Navigation Header */}
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

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          {/* Left: Identity Column */}
          <div className="lg:col-span-4 lg:sticky lg:top-8">
            <IdentityCard profile={profile} />
          </div>

          {/* Right: Details Column */}
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
                <InfoRow
                  icon={FolderGit2}
                  label="Current Project"
                  value={profile.project}
                />
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
