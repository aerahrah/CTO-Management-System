import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "react-toastify";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Users2,
  Briefcase,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { updateEmployeeRole } from "../../api/employee";

const roleDetails = [
  {
    id: "employee",
    label: "Employee",
    desc: "Basic access to personal profile and CTO",
    icon: User,
    pill: "bg-slate-50 text-slate-700 border-slate-200",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    desc: "Can manage team approvals.",
    icon: Briefcase,
    pill: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "hr",
    label: "HR Manager",
    desc: "Full access to employee records and CTOs.",
    icon: Users2,
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "admin",
    label: "System Admin",
    desc: "Total control over system settings and roles.",
    icon: ShieldCheck,
    pill: "bg-rose-50 text-rose-700 border-rose-200",
  },
];

const EmployeeRoleChanger = forwardRef(
  (
    {
      employeeId,
      currentRole,
      onRoleUpdated, // called on success
      onCancel, // close modal from inside
      onPendingChange, // optional: parent can read busy state
      onDirtyChange, // optional: parent can read dirty state
    },
    ref,
  ) => {
    const queryClient = useQueryClient();

    const [selectedRole, setSelectedRole] = useState(currentRole || "employee");
    const [lockAfterSuccess, setLockAfterSuccess] = useState(false);

    // HARD locks: prevent rapid clicks + prevent re-submit after success
    const submitLockRef = useRef(false);
    const submittedSuccessRef = useRef(false);

    useEffect(() => {
      setSelectedRole(currentRole || "employee");
      setLockAfterSuccess(false);
      submitLockRef.current = false;
      submittedSuccessRef.current = false;
    }, [employeeId, currentRole]);

    const dirty = useMemo(
      () => (currentRole || "employee") !== selectedRole,
      [currentRole, selectedRole],
    );

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    const mutation = useMutation({
      mutationFn: (newRole) =>
        updateEmployeeRole(employeeId, { role: newRole }),
      retry: 0,
      onSuccess: (updatedEmployee) => {
        const newRole =
          updatedEmployee?.employee?.role || selectedRole || "employee";

        toast.success(
          `Access level updated to ${String(newRole).toUpperCase()}`,
        );

        queryClient.invalidateQueries({ queryKey: ["employees"] });
        queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });

        // latch after success until modal closes/unmounts
        submittedSuccessRef.current = true;
        setLockAfterSuccess(true);

        onRoleUpdated?.(updatedEmployee);
      },
      onError: (err) => {
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to update permissions",
        );
      },
      onSettled: () => {
        submitLockRef.current = false;
        onPendingChange?.(false);
      },
    });

    const busy =
      mutation.isPending || submitLockRef.current || lockAfterSuccess;

    useEffect(() => {
      onPendingChange?.(busy);
    }, [busy, onPendingChange]);

    const submit = async () => {
      // HARD blocks (even if user spams click / devtools)
      if (submittedSuccessRef.current) return;
      if (busy) return;

      if (submitLockRef.current) return;
      submitLockRef.current = true;
      onPendingChange?.(true);

      if (!dirty) {
        toast.info("Role is already set to " + selectedRole);
        submitLockRef.current = false;
        onPendingChange?.(false);
        return;
      }

      try {
        await mutation.mutateAsync(selectedRole);
      } catch {
        // handled by mutation
      }
    };

    const cancel = () => {
      // Cancel should ALWAYS be clickable per your request
      onCancel?.();
    };

    useImperativeHandle(ref, () => ({
      submit,
      cancel,
      isLoading: busy,
      isDirty: dirty,
      reset: () => setSelectedRole(currentRole || "employee"),
    }));

    return (
      <div className="flex flex-col ">
        {/* Scrollable content */}
        <div className="px-1 pb-3 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Select Access Level
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">
              <AlertCircle size={12} />
              Changes apply immediately
            </div>
          </div>

          <div className="space-y-2">
            {roleDetails.map((role) => {
              const Icon = role.icon;
              const isActive = selectedRole === role.id;
              const isCurrent = (currentRole || "employee") === role.id;

              return (
                <button
                  key={role.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full flex items-start gap-3 p-4 rounded-2xl border transition text-left ${
                    isActive
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-100 hover:bg-gray-50"
                  } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`p-3 rounded-xl border flex-none ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">
                        {role.label}
                      </span>

                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          Current
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${role.pill}`}
                      >
                        {role.id.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-1">{role.desc}</p>
                  </div>

                  {isActive && (
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-none mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <div className="text-[11px] text-gray-500">
              Selected:{" "}
              <span className="font-bold text-gray-900">
                {String(selectedRole).toUpperCase()}
              </span>
              {!dirty && (
                <span className="ml-2 text-gray-400 italic">(no changes)</span>
              )}
              {lockAfterSuccess && (
                <span className="ml-2 text-emerald-700 font-bold">
                  (updated)
                </span>
              )}
            </div>
          </div>

          {/* spacer so last content doesn’t hide behind sticky footer */}
          <div className="h-3" />
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white/95 backdrop-blur px-1 pt-3">
          <div className="flex gap-3">
            {/* Cancel ALWAYS clickable */}
            <button
              type="button"
              onClick={cancel}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 font-semibold"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={busy || !dirty}
              className={`w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 ${
                busy || !dirty ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {lockAfterSuccess
                ? "Updated"
                : busy
                  ? "Saving..."
                  : "Confirm Role Change"}
            </button>
          </div>

          {mutation.isPending && (
            <div className="mt-2 text-[11px] text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Updating role…
            </div>
          )}
        </div>
      </div>
    );
  },
);

EmployeeRoleChanger.displayName = "EmployeeRoleChanger";
export default EmployeeRoleChanger;
