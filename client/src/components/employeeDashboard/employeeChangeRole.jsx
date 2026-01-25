import React, { useState, forwardRef, useImperativeHandle } from "react";
import { toast } from "react-toastify";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Users2,
  Briefcase,
  User,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { updateEmployeeRole } from "../../api/employee";

const roleDetails = [
  {
    id: "employee",
    label: "Employee",
    desc: "Basic access to personal profile and tasks.",
    icon: User,
    color: "text-slate-500",
    bg: "bg-slate-50",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    desc: "Can manage team approvals and view reports.",
    icon: Briefcase,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    id: "hr",
    label: "HR Manager",
    desc: "Full access to employee records and payroll.",
    icon: Users2,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    id: "admin",
    label: "System Admin",
    desc: "Total control over system settings and roles.",
    icon: ShieldCheck,
    color: "text-red-600",
    bg: "bg-red-50",
  },
];

const EmployeeRoleChanger = forwardRef(
  ({ employeeId, currentRole, onRoleUpdated }, ref) => {
    const [selectedRole, setSelectedRole] = useState(currentRole || "employee");
    const queryClient = useQueryClient();

    const mutation = useMutation({
      mutationFn: (newRole) =>
        updateEmployeeRole(employeeId, { role: newRole }),
      onSuccess: (updatedEmployee) => {
        toast.success(
          `Access level updated to ${updatedEmployee.employee.role.toUpperCase()}`,
        );
        queryClient.invalidateQueries({ queryKey: ["employees"] });
        onRoleUpdated?.(updatedEmployee);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to update permissions");
      },
    });

    // 👇 Expose methods to parent
    useImperativeHandle(ref, () => ({
      submit: () => {
        if (selectedRole === currentRole) {
          toast.info("Role is already set to " + selectedRole);
          return;
        }
        mutation.mutate(selectedRole);
      },
      isLoading: mutation.isPending,
      isDirty: selectedRole !== currentRole,
    }));

    return (
      <div className="space-y-3">
        {roleDetails.map((role) => {
          const Icon = role.icon;
          const isActive = selectedRole === role.id;
          const isCurrent = currentRole === role.id;

          return (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`w-[70vh] max-w-xs sm:max-w-md flex items-center p-4 rounded-2xl border-2 ${
                isActive
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-100 hover:bg-slate-50"
              }`}
            >
              <div
                className={`p-3 rounded-xl mr-4 ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : `${role.bg} ${role.color}`
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{role.label}</span>
                  {isCurrent && (
                    <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{role.desc}</p>
              </div>

              {isActive && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
            </button>
          );
        })}
      </div>
    );
  },
);

export default EmployeeRoleChanger;
