import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../store/authStore";
import { toast } from "react-toastify";
import {
  fetchAllApprovalRoutes,
  upsertMyApprovalRoute,
} from "../../../api/approvalRoute";
import { fetchApprovers } from "../../../api/cto";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Plus,
  Route as RouteIcon,
  CheckCircle2,
  Zap,
  Mail,
  Search,
  Filter,
  Trash2,
  GripVertical,
  X,
  FileSignature,
  MoreHorizontal
} from "lucide-react";
import Select from "react-select";

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

const APPROVER_ROLES = [
  { id: "po_initial", label: "Provincial Officer Initial", desc: "First check by the Provincial Head." },
  { id: "po_optional", label: "Provincial Officer (Optional)", desc: "Second PO check (only if needed)." },
  { id: "tod_chief", label: "TOD Chief Signature", desc: "Main signature for Technical operations." },
  { id: "afd_initial", label: "AFD Chief Initial", desc: "Review by the Administrative Chief." },
  { id: "afd_chief", label: "AFD Chief Signature", desc: "Main signature for Finance/Admin operations." },
  { id: "ard_initial", label: "ARD Initial", desc: "Final Review by the Assistant Regional Director." },
  { id: "rd_signature", label: "Regional Director Signature", desc: "Final approval by the Regional Director." },
  { id: "other", label: "Other / Custom", desc: "Custom assignment for ad-hoc signatures." }
];

const ApprovalRoutesPage = () => {
  const queryClient = useQueryClient();
  const { admin } = useAuth();
  const currentUserId = admin?.id || admin?._id;

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = resolvedTheme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.10)";
  const cardBg = resolvedTheme === "dark" ? "var(--app-surface)" : "#fff";

  // State for the single workflow
  const [steps, setSteps] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal Form State
  const [editingStepId, setEditingStepId] = useState(null);
  const [modalData, setModalData] = useState({
    approver: "",
    role: "po_initial",
    notes: ""
  });

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ["approvalRoutes"],
    queryFn: fetchAllApprovalRoutes,
  });

  const myRoute = useMemo(() => {
    return routes.find(r => String(r.createdBy?._id || r.createdBy) === String(currentUserId));
  }, [routes, currentUserId]);

  useEffect(() => {
    if (myRoute) {
      setSteps(myRoute.steps.map(s => ({
        id: Math.random().toString(36).substr(2, 9),
        level: s.level,
        approver: s.approver?._id || s.approver,
        role: s.role || "",
        notes: s.notes || "",
        isEnabled: s.isEnabled !== false
      })));
    } else {
      setSteps([]);
    }
  }, [myRoute]);

  const { data: approversRaw = [], isLoading: approversLoading } = useQuery({
    queryKey: ["approvers"],
    queryFn: fetchApprovers,
  });

  const approverOptions = useMemo(() => {
    const list = Array.isArray(approversRaw?.data) ? approversRaw.data : Array.isArray(approversRaw) ? approversRaw : [];
    return list
      .filter((emp) => emp?._id && (emp?.firstName || emp?.lastName))
      .map((emp) => ({
        value: String(emp._id),
        label: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        email: emp.email || "",
        position: emp.position || emp.designation?.name || "Staff",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [approversRaw]);

  const selectStyles = useMemo(() => ({
    control: (base, state) => ({
      ...base,
      border: `1px solid ${borderColor}`,
      borderRadius: "0.5rem",
      backgroundColor: "var(--app-surface)",
      boxShadow: state.isFocused ? "0 0 0 2px var(--accent-soft)" : "none",
      minHeight: "44px"
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "var(--accent-soft)" : "transparent",
      color: "var(--app-text)",
    }),
    singleValue: (base) => ({ ...base, color: "var(--app-text)", fontWeight: "500" }),
    menu: (base) => ({ ...base, backgroundColor: "var(--app-surface)", border: `1px solid ${borderColor}`, zIndex: 9999 }),
  }), [borderColor]);

  const mutation = useMutation({
    mutationFn: (payload) => {
      console.log("[saveRoute] calling upsert with:", payload);
      return upsertMyApprovalRoute(payload);
    },
    onSuccess: (data) => {
      console.log("[saveRoute] success:", data);
      queryClient.invalidateQueries({ queryKey: ["approvalRoutes"] });
      toast.success("Workflow saved!");
    },
    onError: (err) => {
      console.error("[saveRoute] error:", err);
      toast.error(err?.message || "Failed to save workflow");
    },
  });

  const saveRoute = (newSteps) => {
    const payload = {
      name: `${admin?.firstName || 'Personal'}'s Workflow`,
      isPublic: false,
      steps: newSteps.map((s, i) => ({ 
        level: i + 1, 
        approver: s.approver,
        role: s.role || "",
        notes: s.notes || "",
        isEnabled: s.isEnabled !== false
      }))
    };
    console.log("[saveRoute] mutating with steps count:", newSteps.length);
    mutation.mutate(payload);
  };

  const openCreateStep = () => {
    setEditingStepId(null);
    setModalData({ approver: "", role: "po_initial", notes: "" });
    setIsModalOpen(true);
  };

  const openEditStep = (step) => {
    setEditingStepId(step.id);
    setModalData({ 
      approver: step.approver, 
      role: step.role || "other", 
      notes: step.notes || "" 
    });
    setIsModalOpen(true);
  };

  const saveModalStep = () => {
    if (!modalData.approver) return toast.error("Please select a designated approver.");
    if (!modalData.role) return toast.error("Please select a role assignment.");

    let newSteps;
    if (editingStepId) {
      newSteps = steps.map(s => s.id === editingStepId ? { ...s, ...modalData } : s);
    } else {
      newSteps = [...steps, { 
        id: Date.now().toString(), 
        level: steps.length + 1, 
        isEnabled: true,
        ...modalData 
      }];
    }
    setSteps(newSteps);
    saveRoute(newSteps);
    setIsModalOpen(false);
  };

  const removeStep = (id) => {
    const newSteps = steps.filter(s => s.id !== id).map((s, i) => ({ ...s, level: i + 1 }));
    setSteps(newSteps);
    saveRoute(newSteps);
  };

  const toggleStepEnabled = (id) => {
    const newSteps = steps.map(s => s.id === id ? { ...s, isEnabled: !s.isEnabled } : s);
    setSteps(newSteps);
    saveRoute(newSteps);
  };

  if (routesLoading || approversLoading) return <div className="p-8"><Skeleton count={5} height={40} className="mb-4" /></div>;

  return (
    <div className="w-full max-w-[1400px] mx-auto py-8 px-6 space-y-8 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium mb-1" style={{ color: "var(--app-muted)" }}>
            <span>CTO Approval Workflow</span>
            <span className="opacity-40">/</span>
            <span style={{ color: "var(--app-text)" }}>List</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--app-text)" }}>
            Travel Workflows
          </h1>
        </div>
        <div className="flex gap-3">
          {mutation.isPending && (
             <div className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-500">
               Saving...
             </div>
          )}
          <button
            onClick={openCreateStep}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <Plus size={18} /> Create Step
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Approvers", value: steps.length, sub: "Number of approvers assigned", icon: <CheckCircle2 className="text-blue-500" size={18} />, color: "blue" },
          { label: "Role Maps", value: steps.filter(s => s.role).length, sub: "Steps mapped to PDF signatures", icon: <FileSignature className="text-indigo-500" size={18} />, color: "indigo" },
          { label: "Active Workflows", value: myRoute ? 1 : 0, sub: "Currently active approval workflows", icon: <Zap className="text-emerald-500" size={18} />, color: "emerald" },
          { label: "Notify Email Enabled", value: "Yes", sub: "Automated notifications on", icon: <Mail className="text-orange-500" size={18} />, color: "orange" },
        ].map((card, i) => (
          <div key={i} className="p-6 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-muted)" }}>{card.label}</p>
              <h2 className="text-3xl font-black" style={{ color: "var(--app-text)" }}>{card.value}</h2>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-[11px] font-medium leading-tight" style={{ color: card.color === "emerald" ? "#10b981" : card.color === "blue" ? "#3b82f6" : "var(--app-muted)" }}>
                {card.sub}
              </p>
              <div className={`p-2 rounded-lg bg-${card.color}-500/10`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Content */}
      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
        {/* Table Toolbar */}
        <div className="p-4 border-b flex items-center justify-between gap-4" style={{ borderColor }}>
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg hover:bg-slate-50 transition cursor-pointer" style={{ color: "var(--app-muted)" }}>
               <GripVertical size={18} />
             </div>
          </div>
          
          <div className="flex-1 max-w-md relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none border transition-all focus:ring-2 focus:ring-blue-500/20"
              style={{ backgroundColor: "var(--app-surface-2)", borderColor, color: "var(--app-text)" }}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl border cursor-pointer hover:bg-slate-50 transition" style={{ borderColor, color: "var(--app-muted)" }}>
              <Filter size={18} />
            </div>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          {steps.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4">
                 <RouteIcon size={32} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>No Steps Configured</h3>
              <p className="text-sm mt-1 max-w-sm" style={{ color: "var(--app-muted)" }}>
                You haven't added any steps to your workflow yet. Click "Create Step" to assign an approver and map their signature role.
              </p>
              <button 
                onClick={openCreateStep}
                className="mt-6 px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: "var(--accent)" }}
              >
                + Create First Step
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-widest border-b" style={{ color: "var(--app-muted)", borderColor }}>
                  <th className="px-6 py-4 w-24">Step No.</th>
                  <th className="px-6 py-4 min-w-[250px]">Approver Name</th>
                  <th className="px-6 py-4">Assigned Responsibilities</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-center">Enabled</th>
                  <th className="px-6 py-4 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor }}>
                {steps.map((step, idx) => {
                  const selectedApprover = approverOptions.find(o => o.value === step.approver);
                  const roleObj = APPROVER_ROLES.find(r => r.id === step.role);
                  
                  return (
                    <tr key={step.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-6">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/5 text-blue-600 flex items-center justify-center font-black text-sm border border-blue-500/10">
                          {step.level}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="space-y-1">
                          <p className="text-sm font-bold" style={{ color: "var(--app-text)" }}>
                            {selectedApprover?.label || "Unknown Approver"}
                          </p>
                          <p className="text-xs opacity-60">User: {selectedApprover?.email || "N/A"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                         <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                           {roleObj?.label || "None"}
                         </span>
                      </td>
                      <td className="px-6 py-6">
                         <p className="text-xs max-w-[200px] truncate" style={{ color: "var(--app-muted)" }}>
                           {step.notes || "—"}
                         </p>
                      </td>
                      <td className="px-6 py-6">
                         <div className="flex justify-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={step.isEnabled !== false} 
                                onChange={() => toggleStepEnabled(step.id)} 
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                         </div>
                      </td>
                      <td className="px-6 py-6">
                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => openEditStep(step)}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                            <button 
                              onClick={() => removeStep(step.id)}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"
                            >
                              <Trash2 size={18} />
                            </button>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal for Creating/Editing a Step */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in p-4">
          <div 
            className="w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
          >
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor }}>
              <h2 className="text-xl font-extrabold" style={{ color: "var(--app-text)" }}>
                {editingStepId ? "Edit Step Configuration" : "Create Travel Workflow Step"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Core Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: "var(--app-text)" }}>
                    <RouteIcon size={16} /> Step Configuration
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold" style={{ color: "var(--app-muted)" }}>Sequence Number <span className="text-red-500">*</span></label>
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-slate-50" style={{ borderColor }}>
                        <span className="text-sm font-medium opacity-50">Step</span>
                        <span className="text-sm font-bold">{editingStepId ? steps.find(s => s.id === editingStepId)?.level : steps.length + 1}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold" style={{ color: "var(--app-muted)" }}>Designated Approver <span className="text-red-500">*</span></label>
                      <Select
                        options={approverOptions}
                        value={approverOptions.find(o => o.value === modalData.approver) || null}
                        onChange={(v) => setModalData(p => ({ ...p, approver: v?.value }))}
                        styles={selectStyles}
                        placeholder="Select an option"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold" style={{ color: "var(--app-muted)" }}>Internal Notes</label>
                    <textarea 
                      value={modalData.notes}
                      onChange={(e) => setModalData(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Describe the purpose of this approval step..."
                      className="w-full px-4 py-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/20 text-sm resize-none h-24"
                      style={{ backgroundColor: "var(--app-surface-2)", borderColor, color: "var(--app-text)" }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t" style={{ borderColor }}>
                  <div className="mb-4">
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
                      <FileSignature size={16} /> Role Assignments
                    </h3>
                    <p className="text-xs opacity-70 mt-1">Define the signature authority granted at this specific step. This determines where the signature goes on the PDF.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {APPROVER_ROLES.map((role) => (
                      <div 
                        key={role.id}
                        onClick={() => setModalData(p => ({ ...p, role: role.id }))}
                        className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          modalData.role === role.id 
                            ? "bg-blue-50 border-blue-200 shadow-sm" 
                            : "hover:bg-slate-50"
                        }`}
                        style={{ borderColor: modalData.role !== role.id ? borderColor : undefined }}
                      >
                        <div className="pt-0.5">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={modalData.role === role.id} readOnly />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${modalData.role === role.id ? "text-blue-900" : "text-slate-700"}`}>
                            {role.label}
                          </p>
                          <p className={`text-[10px] mt-0.5 leading-tight ${modalData.role === role.id ? "text-blue-700/70" : "text-slate-500"}`}>
                            {role.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-3 bg-slate-50/50" style={{ borderColor }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold border transition-colors hover:bg-slate-100"
                style={{ borderColor, color: "var(--app-text)" }}
              >
                Cancel
              </button>
              <button 
                onClick={saveModalStep}
                className="px-6 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {editingStepId ? "Update Step" : "Create Step"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalRoutesPage;
