import { useQuery } from "@tanstack/react-query";
import { getEmployeeById } from "../../api/employee";
import { useState } from "react";
import { StatusBadge } from "../statusUtils";
import Modal from "../modal";
import AddEmployeeForm from "./forms/addEmployeeForm";

const EmployeeInformation = ({ selectedId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    data: employee,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["employee", selectedId],
    queryFn: () => getEmployeeById(selectedId),
    enabled: !!selectedId,
    staleTime: Infinity,
  });
  console.log(isLoading);
  console.log(employee);
  if (isLoading) {
    return <div className="p-4">Loading employee...</div>;
  }
  const emp = employee?.data;

  return (
    <div className="p-2 bg-white space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-neutral-800 text-white flex items-center  justify-center font-bold text-lg shadow ">
            {emp?.firstName?.[0]}
            {emp?.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {emp?.firstName} {emp?.lastName}
            </h1>
            <p className="text-sm text-gray-500">
              {emp?.position} • {emp?.department}
            </p>
          </div>
        </div>
        <button className=" bg-neutral-800 px-6 py-2.5 text-white rounded-sm hover:bg-neutral-800/90 text-sm font-medium shadow-sm transition hover:cursor-pointer active:scale-96">
          Edit Profile
        </button>
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 py-1 gap-6 h-104 overflow-y-auto">
        {/* Basic Info */}
        <Section title="Basic Information">
          <InfoRow label="Employee ID" value={emp?.employeeId} />
          <InfoRow label="Username" value={emp?.username} />
          <InfoRow label="Role" value={emp?.role} />
          <InfoRow
            label="Date Hired"
            value={new Date(emp?.dateHired).toLocaleDateString()}
          />
          <InfoRow
            label="Status"
            value={<StatusBadge status={emp?.status} />}
          />
        </Section>

        {/* Contact Info + Emergency */}
        <Section title="Contact Information">
          <InfoRow label="Email" value={emp?.email} />
          <InfoRow label="Mobile Number" value={emp?.phone} />

          <InfoRow label="Emergency Name" value={emp?.emergencyContact?.name} />
          <InfoRow
            label="Emergency Phone"
            value={emp?.emergencyContact?.phone}
          />
          <InfoRow
            label="Emergency Relation"
            value={emp?.emergencyContact?.relation}
          />
        </Section>

        {/* Leave Balances */}
        <Section title="Leave Balances">
          <InfoRow
            label="Vacation Leave (hrs)"
            value={emp?.balances?.vlHours}
          />
          <InfoRow label="Sick Leave (hrs)" value={emp?.balances?.slHours} />
          <InfoRow label="CTO (hrs)" value={emp?.balances?.ctoHours} />
        </Section>

        {/* Address */}
        <Section title="Address">
          <InfoRow label="Street" value={emp?.address?.street} />
          <InfoRow label="City" value={emp?.address?.city} />
          <InfoRow label="Province" value={emp?.address?.province} />
        </Section>
      </div>
    </div>
  );
};

/* Components */
const Section = ({ title, children }) => (
  <div className="bg-neutral-50/80 rounded-xl p-5 shadow-sm border border-gray-100">
    <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide mb-2">
      {title}
    </h2>
    <hr className="my-2 border-neutral-200" />
    <div className="space-y-2.5">{children}</div>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between text-sm">
    <span className="text-neutral-500">{label}</span>
    <span className="font-medium text-neutral-800 truncate max-w-[55%] text-right">
      {value || "-"}
    </span>
  </div>
);

export default EmployeeInformation;
