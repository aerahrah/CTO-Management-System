import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";
import { getRoles, createRole, updateRole, deleteRole } from "../../../api/role";
import LoadingSpinner from "../../spinner";

const AVAILABLE_PERMISSIONS = [
  { id: "*", label: "Super Admin (All Permissions)" },
  { id: "employees.view", label: "View Employees" },
  { id: "employees.create", label: "Create Employees" },
  { id: "employees.edit", label: "Edit Employees" },
  { id: "employees.delete", label: "Delete Employees" },
  { id: "roles.view", label: "View Roles" },
  { id: "settings.view", label: "View Settings & Audit Logs" },
  { id: "settings.edit", label: "Edit Settings" },
  { id: "cto.view_all", label: "View All CTO Records" },
  { id: "cto.approve_hr", label: "Approve CTO (HR)" },
  { id: "cto.approve_supervisor", label: "Approve CTO (Supervisor)" },
  { id: "cto.create", label: "Apply for CTO" },
  { id: "cto.view_self", label: "View Own CTO Records" },
  { id: "employees.view_self", label: "View Own Profile" }
];

const RolesSettings = () => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
  });

  const createMut = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries(["roles"]);
      toast.success("Role created successfully");
      setIsEditing(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create role");
    },
  });

  const updateMut = useMutation({
    mutationFn: updateRole,
    onSuccess: () => {
      queryClient.invalidateQueries(["roles"]);
      toast.success("Role updated successfully");
      setIsEditing(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update role");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries(["roles"]);
      toast.success("Role deleted successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete role");
    },
  });

  const handleEdit = (role) => {
    setCurrentRole({ ...role });
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setCurrentRole({ name: "", description: "", permissions: [] });
    setIsEditing(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this role?")) {
      deleteMut.mutate(id);
    }
  };

  const togglePermission = (permId) => {
    setCurrentRole(prev => {
      let perms = [...prev.permissions];
      
      if (permId === "*") {
        if (perms.includes("*")) perms = [];
        else perms = ["*"];
      } else {
        if (perms.includes("*")) perms = perms.filter(p => p !== "*");
        if (perms.includes(permId)) {
          perms = perms.filter(p => p !== permId);
        } else {
          perms.push(permId);
        }
      }

      return { ...prev, permissions: perms };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (currentRole._id) {
      updateMut.mutate({ id: currentRole._id, ...currentRole });
    } else {
      createMut.mutate(currentRole);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0f172a] rounded-lg shadow-sm">
      <div className="flex flex-col p-4 sm:p-6 sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 dark:border-gray-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldCheck size={20} className="text-[var(--accent)]" />
            Roles & Permissions
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage system roles and their access permissions
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
          >
            <Plus size={16} /> Add Role
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6 overflow-auto app-scrollbar flex-1">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="max-w-2xl bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
              {currentRole._id ? "Edit Role" : "Create New Role"}
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name</label>
                <input
                  required
                  type="text"
                  value={currentRole.name}
                  onChange={(e) => setCurrentRole({ ...currentRole, name: e.target.value })}
                  disabled={currentRole.isSystem}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--accent)] outline-none disabled:opacity-50"
                  placeholder="e.g. IT Administrator"
                />
                {currentRole.isSystem && (
                  <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                    <ShieldAlert size={12} /> System role names cannot be changed.
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={currentRole.description}
                  onChange={(e) => setCurrentRole({ ...currentRole, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--accent)] outline-none"
                  placeholder="Brief description of what this role does..."
                  rows={2}
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_PERMISSIONS.map(perm => (
                  <label key={perm.id} className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-[var(--accent)] transition-colors">
                    <input
                      type="checkbox"
                      checked={currentRole.permissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      className="rounded text-[var(--accent)] focus:ring-[var(--accent)] w-4 h-4"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Save Role
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {roles?.map(role => (
              <div key={role._id} className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/40 hover:shadow-md transition-shadow relative group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {role.name}
                    {role.isSystem && <ShieldAlert size={14} className="text-amber-500" title="System Role" />}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(role)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                      <Pencil size={14} />
                    </button>
                    {!role.isSystem && (
                      <button onClick={() => handleDelete(role._id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px]">
                  {role.description || "No description provided."}
                </p>
                <div className="flex items-center justify-between text-xs font-medium border-t border-gray-100 dark:border-gray-700 pt-3">
                  <span className="text-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 rounded-full">
                    {role.permissions.includes("*") ? "All Permissions" : `${role.permissions.length} Permissions`}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {role.isSystem ? "System Protected" : "Custom Role"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RolesSettings;
