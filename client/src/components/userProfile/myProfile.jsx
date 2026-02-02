import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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

// --- Sub-components for cleaner code ---

/** Reusable Row for Data Display */
const InfoRow = ({ icon: Icon, label, value, fallback = "N/A" }) => (
  <div className="flex items-start py-3 border-b border-gray-100 last:border-0">
    <div className="flex items-center w-1/3 min-w-[140px] text-gray-500 font-medium text-sm">
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {label}
    </div>
    <div className="flex-1 text-gray-900 font-medium text-sm break-words">
      {value || <span className="text-gray-400 italic">{fallback}</span>}
    </div>
  </div>
);

/** Section Header */
const SectionTitle = ({ title }) => (
  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
    {title}
  </h3>
);

/** Skeleton Loader for nice loading UX */
const ProfileSkeleton = () => (
  <div className="max-w-5xl mx-auto p-6 animate-pulse">
    <div className="h-8 bg-gray-200 w-1/3 mb-6 rounded"></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="h-64 bg-gray-200 rounded-xl"></div>
      <div className="col-span-2 h-64 bg-gray-200 rounded-xl"></div>
    </div>
  </div>
);

// --- Main Component ---

const MyProfile = () => {
  const navigate = useNavigate();

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["myProfile"],
    queryFn: getMyProfile,
    // Add staleTime to prevent flickering on quick navigations
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <ProfileSkeleton />;

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
        <AlertCircle className="w-5 h-5 mr-3" />
        <div>
          <p className="font-bold">Failed to load profile</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  // Generate Initials for Avatar
  const initials =
    `${profile.firstName?.charAt(0) || ""}${profile.lastName?.charAt(0) || ""}`.toUpperCase();

  // Address Helper
  const fullAddress = [
    profile.address?.street,
    profile.address?.city,
    profile.address?.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="bg-white/70 h-[calc(100vh-4.5rem)] rounded-xl p-6">
      <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              My Profile
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage your personal information and account settings.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/app/my-profile/reset-password")}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Reset Password
            </button>
            <button
              onClick={() => navigate("/app/my-profile/edit")}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Update Profile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Identity Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="h-24 bg-blue-600" />
              <div className="px-6 pb-8">
                <div className="relative -mt-12 mb-4 flex justify-center">
                  <div className="w-28 h-28 rounded-3xl bg-white p-1.5 shadow-xl">
                    <div className="w-full h-full rounded-[1.2rem] bg-gradient-to-br bg-blue-600 flex items-center justify-center text-blue-50 text-3xl font-black ring-4 ring-white">
                      {initials}
                    </div>
                  </div>
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {profile.firstName} {profile.lastName}
                  </h2>
                  <div className="inline-flex items-center px-3 py-1 mt-2 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
                    {profile.position}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="p-3 flex items-center rounded-xl hover:bg-slate-50 transition-colors">
                    <Mail className="w-4 h-4 mr-4 text-blue-600" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Email
                      </span>
                      <span className="text-sm font-semibold text-slate-700 truncate">
                        {profile.email}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 flex items-center rounded-xl hover:bg-slate-50 transition-colors">
                    <Phone className="w-4 h-4 mr-4 text-blue-600" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Mobile
                      </span>
                      <span className="text-sm font-semibold text-slate-700">
                        {profile.phone}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 flex items-center rounded-xl hover:bg-slate-50 transition-colors">
                    <MapPin className="w-4 h-4 mr-4 text-blue-600" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Location
                      </span>
                      <span className="text-sm font-semibold text-slate-700 leading-tight">
                        {fullAddress}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Employment Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <SectionTitle title="Employment Details" />
              <div className="grid grid-cols-1 gap-y-1">
                <InfoRow
                  icon={Briefcase}
                  label="Position"
                  value={profile.position}
                />
                <InfoRow
                  icon={Building2}
                  label="Division"
                  value={profile.division}
                />
                <InfoRow
                  icon={FolderGit2}
                  label="Current Project"
                  value={profile.project}
                />
              </div>
            </div>

            {/* Emergency Contact Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <SectionTitle title="Emergency Contact" />
              <div className="grid grid-cols-1 gap-y-1">
                <InfoRow
                  icon={User}
                  label="Contact Name"
                  value={profile.emergencyContact?.name}
                />
                <InfoRow
                  icon={ShieldAlert}
                  label="Relationship"
                  value={profile.emergencyContact?.relation}
                />
                <InfoRow
                  icon={Phone}
                  label="Contact Phone"
                  value={profile.emergencyContact?.phone}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
