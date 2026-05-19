import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../store/authStore";
import { toast } from "react-toastify";
import {
  fetchAllApprovalRoutes,
  upsertMyApprovalRoute,
} from "../../../api/approvalRoute";
import { fetchApprovers } from "../../../api/cto";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
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
  Edit2,
  AlertCircle,
  FileSignature,
  Settings,
  MoreVertical,
  LayoutGrid,
  RotateCcw,
  ArrowUp,
} from "lucide-react";
import Select from "react-select";

import Modal from "../../modal";
import Breadcrumbs from "../../breadCrumbs";

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

function useResolvedTheme(prefTheme) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined")
      return prefTheme === "dark" ? "dark" : "light";
    return resolveTheme(prefTheme);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prefTheme !== "system") {
      setTheme(prefTheme === "dark" ? "dark" : "light");
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(mq.matches ? "dark" : "light");

    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [prefTheme]);

  return theme;
}

/* =========================
   StatCard
========================= */
const StatCard = ({
  title,
  value,
  icon: Icon,
  hint,
  tone = "neutral",
  borderColor,
}) => {
  const toneMeta = {
    blue: { chipBg: "var(--accent-soft)", chipText: "var(--accent)" },
    green: { chipBg: "rgba(34,197,94,0.14)", chipText: "#16a34a" },
    red: { chipBg: "rgba(239,68,68,0.14)", chipText: "#ef4444" },
    amber: { chipBg: "rgba(245,158,11,0.16)", chipText: "#d97706" },
    indigo: { chipBg: "rgba(139, 92, 246, 0.15)", chipText: "#8b5cf6" },
    neutral: { chipBg: "var(--app-surface-2)", chipText: "var(--app-muted)" },
  };

  const t = toneMeta[tone] || toneMeta.neutral;

  return (
    <div
      className="w-full flex-shrink-0 rounded-xl shadow-sm p-3.5 flex items-start gap-3 h-full transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
      }}
      role="status"
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border transition-colors duration-300 ease-out"
        style={{
          backgroundColor: t.chipBg,
          borderColor,
          color: t.chipText,
        }}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] uppercase font-bold tracking-wide truncate transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {title}
        </div>
        <div
          className="mt-0.5 text-lg font-black truncate transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {value}
        </div>
        {hint && (
          <div
            className="text-[11px] truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {hint}
          </div>
        )}
      </div>
    </div>
  );
};

const APPROVER_ROLES = [
  {
    id: "po_initial",
    label: "Provincial Officer Initial",
    desc: "First check by the Provincial Head.",
  },
  {
    id: "po_optional",
    label: "Provincial Officer (Optional)",
    desc: "Second PO check (only if needed).",
  },
  {
    id: "tod_chief",
    label: "TOD Chief Signature",
    desc: "Main signature for Technical operations.",
  },
  {
    id: "afd_initial",
    label: "AFD Chief Initial",
    desc: "Review by the Administrative Chief.",
  },
  {
    id: "afd_chief",
    label: "AFD Chief Signature",
    desc: "Main signature for Finance/Admin operations.",
  },
  {
    id: "ard_initial",
    label: "ARD Initial",
    desc: "Final Review by the Assistant Regional Director.",
  },
  {
    id: "rd_signature",
    label: "Regional Director Signature",
    desc: "Final approval by the Regional Director.",
  },
  {
    id: "other",
    label: "Other / Custom",
    desc: "Custom assignment for ad-hoc signatures.",
  },
];

const ApprovalRoutesPage = () => {
  const queryClient = useQueryClient();
  const { admin } = useAuth();
  const currentUserId = admin?.id || admin?._id;

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    const base =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.06)";
    const highlight =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(15,23,42,0.10)";
    return {
      baseColor: base,
      highlightColor: highlight,
    };
  }, [resolvedTheme]);

  // State for the single workflow
  const [steps, setSteps] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 240);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Modal Form State
  const [editingStepId, setEditingStepId] = useState(null);
  const [modalData, setModalData] = useState({
    approver: "",
    role: "po_initial",
    notes: "",
  });

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ["approvalRoutes"],
    queryFn: fetchAllApprovalRoutes,
  });

  const myRoute = useMemo(() => {
    return routes.find(
      (r) => String(r.createdBy?._id || r.createdBy) === String(currentUserId),
    );
  }, [routes, currentUserId]);

  useEffect(() => {
    if (myRoute) {
      setSteps(
        myRoute.steps.map((s) => ({
          id: Math.random().toString(36).substr(2, 9),
          level: s.level,
          approver: s.approver?._id || s.approver,
          role: s.role || "",
          notes: s.notes || "",
          isEnabled: s.isEnabled !== false,
        })),
      );
    } else {
      setSteps([]);
    }
  }, [myRoute]);

  const { data: approversRaw = [], isLoading: approversLoading } = useQuery({
    queryKey: ["approvers"],
    queryFn: fetchApprovers,
  });

  const approverOptions = useMemo(() => {
    const list = Array.isArray(approversRaw?.data)
      ? approversRaw.data
      : Array.isArray(approversRaw)
        ? approversRaw
        : [];
    return list
      .filter((emp) => emp?._id && (emp?.firstName || emp?.lastName))
      .map((emp) => {
        const empId = String(emp._id);
        const isAlreadySelected = steps.some(
          (s) => s.approver === empId && s.id !== editingStepId,
        );

        return {
          value: empId,
          label: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
          email: emp.email || "",
          position: emp.position || emp.designation?.name || "Staff",
          isDisabled: isAlreadySelected,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [approversRaw, steps, editingStepId]);

  const selectStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        border: `1px solid ${borderColor}`,
        borderRadius: "0.5rem",
        backgroundColor: "var(--app-surface)",
        boxShadow: state.isFocused ? "0 0 0 2px var(--accent-soft)" : "none",
        minHeight: "44px",
      }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? "var(--accent-soft)" : "transparent",
        color: state.isDisabled ? "var(--app-muted)" : "var(--app-text)",
        cursor: state.isDisabled ? "not-allowed" : "pointer",
        opacity: state.isDisabled ? 0.5 : 1,
      }),
      singleValue: (base) => ({
        ...base,
        color: "var(--app-text)",
        fontWeight: "600",
      }),
      menu: (base) => ({
        ...base,
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
        zIndex: 9999,
      }),
    }),
    [borderColor],
  );

  const mutation = useMutation({
    mutationFn: (payload) => upsertMyApprovalRoute(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvalRoutes"] });
      toast.success("Workflow saved successfully!");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to save workflow");
    },
  });

  const reindexSteps = (rawSteps) => {
    return rawSteps.map((s, i) => ({ ...s, level: i + 1 }));
  };

  const saveRoute = useCallback(
    (newSteps) => {
      const sanitizedSteps = reindexSteps(newSteps);
      const payload = {
        name: `${admin?.firstName || "Personal"}'s Workflow`,
        isPublic: false,
        steps: sanitizedSteps.map((s) => ({
          level: s.level,
          approver: s.approver,
          role: s.role || "",
          notes: s.notes || "",
          isEnabled: s.isEnabled !== false,
        })),
      };
      mutation.mutate(payload);
    },
    [admin, mutation],
  );

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
      notes: step.notes || "",
    });
    setIsModalOpen(true);
  };

  const saveModalStep = () => {
    if (!modalData.approver)
      return toast.error("Please select a designated approver.");
    if (!modalData.role) return toast.error("Please select a role assignment.");

    const isDuplicate = steps.some(
      (s) => s.approver === modalData.approver && s.id !== editingStepId,
    );

    if (isDuplicate) {
      return toast.error("This approver is already assigned to another step.");
    }

    let newSteps;
    if (editingStepId) {
      newSteps = steps.map((s) =>
        s.id === editingStepId ? { ...s, ...modalData } : s,
      );
    } else {
      newSteps = [
        ...steps,
        {
          id: Date.now().toString(),
          level: steps.length + 1,
          isEnabled: true,
          ...modalData,
        },
      ];
    }

    const finalSteps = reindexSteps(newSteps);
    setSteps(finalSteps);
    saveRoute(finalSteps);
    setIsModalOpen(false);
  };

  const removeStep = (id) => {
    const newSteps = steps.filter((s) => s.id !== id);
    const finalSteps = reindexSteps(newSteps);
    setSteps(finalSteps);
    saveRoute(finalSteps);
  };

  const toggleStepEnabled = (id) => {
    const newSteps = steps.map((s) =>
      s.id === id ? { ...s, isEnabled: !s.isEnabled } : s,
    );
    setSteps(newSteps);
    saveRoute(newSteps);
  };

  const isBusy = mutation.isPending;

  return (
    <div
      className="w-full h-full min-h-0 flex flex-col md:p-0 transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:contents cto-scrollbar"
        >
          {/* HEADER */}
          <div className="pt-2 pb-3 md:pb-6 px-4 max-w-[1400px] mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <Breadcrumbs rootLabel="home" rootTo="/app" />
                <h1
                  className="text-2xl md:text-3xl font-bold tracking-tight font-sans mt-2"
                  style={{ color: "var(--app-text)" }}
                >
                  Approval Workflows
                </h1>
                <p
                  className="block text-sm mt-1 max-w-2xl"
                  style={{ color: "var(--app-muted)" }}
                >
                  Configure your personal routing layers for Travel and CTO
                  requests.
                </p>
              </div>

              <div className="w-full md:w-auto flex flex-row items-stretch md:items-center gap-3 rounded-xl">
                <button
                  onClick={openCreateStep}
                  disabled={isBusy}
                  className="group relative inline-flex items-center gap-2 justify-center rounded-lg min-w-42 md:py-2.5 px-6 py-3 text-sm font-semibold shadow-md transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 w-full disabled:opacity-60"
                  type="button"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    border: "1px solid var(--accent)",
                  }}
                  onMouseEnter={(e) => {
                    if (isBusy) return;
                    e.currentTarget.style.filter = "brightness(0.95)";
                  }}
                  onMouseLeave={(e) => {
                    if (isBusy) return;
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  {isBusy ? (
                    "Saving..."
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                      Create Step
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {[
                {
                  label: "Approvers",
                  value: steps.length,
                  sub: "Number of approvers assigned",
                  icon: <CheckCircle2 size={18} />,
                  accent: "var(--accent)",
                  bgTone: "var(--accent-soft)",
                },
                {
                  label: "Role Maps",
                  value: steps.filter((s) => s.role).length,
                  sub: "Steps mapped to roles",
                  icon: <FileSignature size={18} />,
                  accent: "#8b5cf6",
                  bgTone: "rgba(139, 92, 246, 0.15)",
                },
                {
                  label: "Active Workflows",
                  value: myRoute ? 1 : 0,
                  sub: "Currently active workflows",
                  icon: <Zap size={18} />,
                  accent: "#10b981",
                  bgTone: "rgba(16, 185, 129, 0.15)",
                },
                {
                  label: "Automated",
                  value: "Yes",
                  sub: "System routing enabled",
                  icon: <Settings size={18} />,
                  accent: "#f59e0b",
                  bgTone: "rgba(245, 158, 11, 0.15)",
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl border shadow-sm flex flex-col justify-between transition-colors duration-300 ease-out"
                  style={{ backgroundColor: "var(--app-surface)", borderColor }}
                >
                  <div className="space-y-1">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {card.label}
                    </p>
                    <h2
                      className="text-2xl font-black"
                      style={{ color: "var(--app-text)" }}
                    >
                      {card.value}
                    </h2>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <p
                      className="text-[11px] font-medium leading-tight"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {card.sub}
                    </p>
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: card.bgTone,
                        color: card.accent,
                      }}
                    >
                      {card.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Table Content */}
            <div
              className="mt-6 rounded-xl border shadow-sm overflow-hidden transition-colors duration-300 ease-out"
              style={{ backgroundColor: "var(--app-surface)", borderColor }}
            >
              <div
                className="p-4 border-b flex items-center justify-between gap-4 transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor,
                }}
              >
                <div
                  className="flex items-center gap-2 text-sm font-bold"
                  style={{ color: "var(--app-text)" }}
                >
                  <RouteIcon size={16} style={{ color: "var(--app-muted)" }} />
                  Routing Hierarchy
                </div>
                <div className="flex-1 max-w-sm relative hidden sm:block">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--app-muted)" }}
                  />
                  <input
                    type="text"
                    placeholder="Search workflow..."
                    maxLength={100}
                    className="w-full pl-9 pr-4 py-1.5 rounded-lg text-xs outline-none border transition-colors focus:ring-2 focus:ring-[color:var(--accent-soft)]"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor,
                      color: "var(--app-text)",
                    }}
                  />
                </div>
                <div
                  className="p-1.5 rounded-lg border cursor-pointer transition-colors"
                  style={{
                    borderColor,
                    backgroundColor: "var(--app-surface)",
                    color: "var(--app-muted)",
                  }}
                >
                  <Filter size={16} />
                </div>
              </div>

              <div className="overflow-x-auto cto-scrollbar">
                {routesLoading || approversLoading ? (
                  <div className="p-6">
                    <Skeleton height={40} count={3} className="mb-3" />
                  </div>
                ) : steps.length === 0 ? (
                  <div className="p-16 text-center flex flex-col items-center">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border"
                      style={{
                        backgroundColor: "var(--accent-soft)",
                        color: "var(--accent)",
                        borderColor:
                          "var(--accent-soft2, rgba(37,99,235,0.18))",
                      }}
                    >
                      <RouteIcon size={28} />
                    </div>
                    <h3
                      className="text-lg font-bold"
                      style={{ color: "var(--app-text)" }}
                    >
                      No Steps Configured
                    </h3>
                    <p
                      className="text-sm mt-2 max-w-sm leading-relaxed"
                      style={{ color: "var(--app-muted)" }}
                    >
                      You haven't added any steps to your workflow yet. Click
                      "Create Step" to assign an approver.
                    </p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead
                      className="border-b"
                      style={{
                        backgroundColor: "var(--app-surface-2)",
                        borderColor,
                      }}
                    >
                      <tr
                        className="text-[10px] uppercase tracking-widest font-bold"
                        style={{ color: "var(--app-muted)" }}
                      >
                        <th className="px-6 py-3.5 w-24 text-center">Level</th>
                        <th className="px-6 py-3.5">Approver</th>
                        <th className="px-6 py-3.5">Role Mapping</th>
                        <th className="px-6 py-3.5">Notes</th>
                        <th className="px-6 py-3.5 text-center">Status</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor }}>
                      {steps.map((step, idx) => {
                        const selectedApprover = approverOptions.find(
                          (o) => o.value === step.approver,
                        );
                        const roleObj = APPROVER_ROLES.find(
                          (r) => r.id === step.role,
                        );

                        return (
                          <tr
                            key={step.id}
                            className="group transition-colors duration-200"
                            style={{ backgroundColor: "var(--app-surface)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--app-surface-2)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--app-surface)";
                            }}
                          >
                            <td className="px-6 py-4 text-center">
                              <div
                                className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center font-black text-sm border"
                                style={{
                                  backgroundColor: "var(--accent-soft)",
                                  color: "var(--accent)",
                                  borderColor:
                                    "var(--accent-soft2, rgba(37,99,235,0.18))",
                                }}
                              >
                                {step.level}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-0.5">
                                <p
                                  className="text-sm font-bold"
                                  style={{ color: "var(--app-text)" }}
                                >
                                  {selectedApprover?.label ||
                                    "Unknown Approver"}
                                </p>
                                <p
                                  className="text-[11px] font-mono"
                                  style={{ color: "var(--app-muted)" }}
                                >
                                  {selectedApprover?.position || "N/A"}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className="px-2.5 py-1 rounded-md text-[10px] font-bold border inline-block"
                                style={{
                                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                                  color: "#10b981",
                                  borderColor: "rgba(16, 185, 129, 0.22)",
                                }}
                              >
                                {roleObj?.label || "Unmapped"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p
                                className="text-xs max-w-[200px] truncate"
                                style={{ color: "var(--app-muted)" }}
                                title={step.notes}
                              >
                                {step.notes || "—"}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => toggleStepEnabled(step.id)}
                                disabled={isBusy}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)] focus:ring-offset-2 disabled:opacity-50 ${
                                  step.isEnabled !== false
                                    ? "bg-[color:var(--accent)]"
                                    : "bg-[color:var(--app-border)]"
                                }`}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                    step.isEnabled !== false
                                      ? "translate-x-5"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={() => openEditStep(step)}
                                  disabled={isBusy}
                                  className="p-2 rounded-lg transition-colors disabled:opacity-50"
                                  style={{ color: "var(--accent)" }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "var(--accent-soft)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "transparent")
                                  }
                                  title="Edit Step"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => removeStep(step.id)}
                                  disabled={isBusy}
                                  className="p-2 rounded-lg transition-colors disabled:opacity-50"
                                  style={{ color: "#ef4444" }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "rgba(239,68,68,0.12)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "transparent")
                                  }
                                  title="Delete Step"
                                >
                                  <Trash2 size={16} />
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
          </div>
        </div>

        {/* Back-to-top */}
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="md:hidden fixed bottom-5 z-[1] h-10 w-10 rounded-full shadow-lg active:scale-95 transition-colors duration-200 ease-out flex items-center justify-center"
            style={{
              backgroundColor: "var(--accent, #2563EB)",
              color: "#fff",
            }}
            aria-label="Scroll to top"
            title="Back to top"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}

        {/* Modal for Creating/Editing a Step */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingStepId ? "Edit Configuration" : "Add Routing Step"}
          maxWidth="max-w-3xl"
          action={{
            show: true,
            label: editingStepId ? "Update Step" : "Add Step",
            variant: "save",
            onClick: saveModalStep,
            disabled: isBusy,
          }}
        >
          <div className="p-2 space-y-6">
            <div
              className="rounded-xl border p-4 shadow-sm"
              style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Sequence Level
                  </label>
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor,
                    }}
                  >
                    <span className="text-sm font-medium opacity-50 text-[color:var(--app-text)]">
                      Level
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: "var(--accent)" }}
                    >
                      {editingStepId
                        ? steps.find((s) => s.id === editingStepId)?.level
                        : steps.length + 1}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Approver <span className="text-red-500">*</span>
                  </label>
                  <Select
                    options={approverOptions}
                    value={
                      approverOptions.find(
                        (o) => o.value === modalData.approver,
                      ) || null
                    }
                    onChange={(v) =>
                      setModalData((p) => ({ ...p, approver: v?.value }))
                    }
                    styles={selectStyles}
                    placeholder="Select an approver..."
                    isOptionDisabled={(option) => option.isDisabled}
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <label
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "var(--app-muted)" }}
                >
                  Internal Notes
                </label>
                <textarea
                  value={modalData.notes}
                  onChange={(e) =>
                    setModalData((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Describe the purpose of this approval step..."
                  className="w-full px-4 py-3 rounded-lg border outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)] text-sm resize-none h-20 transition-colors"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor,
                    color: "var(--app-text)",
                  }}
                />
              </div>
            </div>

            <div className="pt-2">
              <div className="mb-4">
                <h3
                  className="text-sm font-bold flex items-center gap-2"
                  style={{ color: "var(--app-text)" }}
                >
                  <FileSignature size={16} style={{ color: "var(--accent)" }} />{" "}
                  Role Assignments
                </h3>
                <p
                  className="text-xs mt-1 leading-relaxed"
                  style={{ color: "var(--app-muted)" }}
                >
                  Select the authority assigned to this step. This controls form
                  validation and PDF signature mapping.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1 cto-scrollbar">
                {APPROVER_ROLES.map((role) => {
                  const isSelected = modalData.role === role.id;
                  return (
                    <div
                      key={role.id}
                      onClick={() =>
                        setModalData((p) => ({ ...p, role: role.id }))
                      }
                      className="flex gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                      style={{
                        backgroundColor: isSelected
                          ? "var(--accent-soft)"
                          : "var(--app-surface-2)",
                        borderColor: isSelected ? "var(--accent)" : borderColor,
                      }}
                    >
                      <div className="pt-0.5">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-[color:var(--accent)]"
                              : "border-[color:var(--app-muted)]"
                          }`}
                        >
                          {isSelected && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: "var(--accent)" }}
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <p
                          className="text-xs font-bold"
                          style={{
                            color: isSelected
                              ? "var(--accent)"
                              : "var(--app-text)",
                          }}
                        >
                          {role.label}
                        </p>
                        <p
                          className="text-[10px] mt-0.5 leading-relaxed"
                          style={{ color: "var(--app-muted)" }}
                        >
                          {role.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      </SkeletonTheme>
    </div>
  );
};

export default ApprovalRoutesPage;
