import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployeeById, updateEmployeeById } from "../../api/employee";
import { useState } from "react";
import { StatusBadge, RoleBadge } from "../statusUtils";
import Modal from "../modal";
import AddEmployeeForm from "./forms/addEmployeeForm";
import { CustomButton } from "../customButton";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
const EmployeeInformation = ({ selectedId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

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

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }) => updateEmployeeById(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["employee", selectedId]);
      setIsOpen(false);
    },
    onError: (error) => {
      console.error("UPDATE ERROR:", error.response?.data || error);
      toast.error(error.response?.data?.message || "Update failed");
    },
  });

  // Show skeleton first before data is loaded

  if (isError)
    return <div className="p-4 text-red-600">Failed to load employee.</div>;

  const emp = employee?.data;
  if (!emp) return <EmployeeSkeleton />;

  return (
    <div className="p-2 bg-white space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-neutral-800 text-white flex items-center justify-center font-bold text-lg shadow">
            {emp?.firstName?.[0]}
            {emp?.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {`${emp?.firstName} ${emp?.lastName}`}
            </h1>
            <p className="text-sm text-gray-500">
              {`${emp?.position} • ${emp?.department}`}
            </p>
          </div>
        </div>

        <CustomButton
          label="Edit Profile"
          variant="primary"
          className="px-6 py-2.5"
          onClick={() => setIsOpen(true)}
        />
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 py-1 gap-6 h-104 overflow-y-auto">
        <Section title="Basic Information">
          <InfoRow label="Employee ID" value={emp?.employeeId} />
          <InfoRow label="Username" value={emp?.username} />
          <InfoRow label="Role" value={<RoleBadge role={emp?.role} />} />
          <InfoRow
            label="Date Hired"
            value={
              emp?.dateHired
                ? new Date(emp?.dateHired).toLocaleDateString()
                : "-"
            }
          />
          <InfoRow
            label="Status"
            value={<StatusBadge status={emp?.status} />}
          />
        </Section>

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

        <Section title="Leave Balances">
          <InfoRow
            label="Vacation Leave (hrs)"
            value={emp?.balances?.vlHours}
          />
          <InfoRow label="Sick Leave (hrs)" value={emp?.balances?.slHours} />
          <InfoRow label="CTO (hrs)" value={emp?.balances?.ctoHours} />
        </Section>

        <Section title="Address">
          <InfoRow label="Street" value={emp?.address?.street} />
          <InfoRow label="City" value={emp?.address?.city} />
          <InfoRow label="Province" value={emp?.address?.province} />
        </Section>
      </div>

      {/* Prefilled Edit Form Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit Employee Profile"
        action={{
          label: "Save Changes",
          onClick: () => {
            const form = document.getElementById("employeeForm");
            if (form) form.requestSubmit();
          },
          show: true,
          variant: "save",
        }}
      >
        {emp && (
          <AddEmployeeForm
            mode="edit"
            employee={emp}
            onCancel={() => setIsOpen(false)}
            onSubmit={(formData) => {
              const { employeeId, ...cleanData } = formData;
              updateEmployeeMutation.mutate({
                id: selectedId,
                data: cleanData,
              });
            }}
          />
        )}
      </Modal>
    </div>
  );
};

/* Skeleton Component */
const EmployeeSkeleton = () => (
  <div className="p-2 bg-white space-y-6 animate-pulse">
    {/* Header Skeleton */}
    <div className="flex items-center justify-between border-b pb-5">
      <div className="flex items-center gap-4">
        <Skeleton circle height={56} width={56} />
        <div>
          <Skeleton width={140} height={24} className="mb-1" />
          <Skeleton width={120} height={16} />
        </div>
      </div>
      <Skeleton width={100} height={32} />
    </div>

    {/* Sections Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 py-1 gap-6 h-104 overflow-y-auto">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-neutral-50/80 rounded-xl p-5 shadow-sm border border-gray-100 space-y-2"
        >
          <Skeleton width={150} height={20} className="mb-2" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="flex justify-between text-sm">
              <Skeleton width={130} height={20} />
              <Skeleton width={80} height={20} />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

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
