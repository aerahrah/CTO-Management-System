import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addWellnessApplicationRequest } from "../../../../api/wellnessApplication";
import { fetchAllApprovalRoutes } from "../../../../api/approvalRoute";
import { getMyWellnessBalance } from "../../../../api/employee"; // Adjust path to where your frontend API functions are exported
import { useAuth } from "../../../../store/authStore";
import { toast } from "react-toastify";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Calendar,
  AlertCircle,
  FileText,
  Layers,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const MAX_REASON_LEN = 500;

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

const Banner = ({ tone = "error", message, borderColor }) => {
  if (!message) return null;

  const palette =
    tone === "info"
      ? {
          bg: "rgba(37,99,235,0.10)",
          br: "rgba(37,99,235,0.18)",
          fg: "var(--app-text)",
          icon: "var(--accent)",
        }
      : tone === "success"
        ? {
            bg: "rgba(34,197,94,0.12)",
            br: "rgba(34,197,94,0.20)",
            fg: "var(--app-text)",
            icon: "#16a34a",
          }
        : {
            bg: "rgba(239,68,68,0.10)",
            br: "rgba(239,68,68,0.18)",
            fg: "var(--app-text)",
            icon: "#ef4444",
          };

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs font-medium flex items-start gap-2 transition-colors duration-300 ease-out"
      role={tone === "error" ? "alert" : "status"}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.br || borderColor || "var(--app-border)",
        color: palette.fg,
      }}
    >
      <AlertCircle
        className="w-4 h-4 mt-0.5 shrink-0 opacity-90"
        style={{ color: palette.icon }}
      />
      <div className="leading-relaxed">{message}</div>
    </div>
  );
};

const AddWellnessApplicationForm = ({ onClose, onSuccess }) => {
  const queryClient = useQueryClient();

  // Grab BOTH user (for fallback balances) and admin (for matching the route)
  const { user, admin } = useAuth();

  // Theme resolution
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
      baseColor: `var(--skeleton-base, ${base})`,
      highlightColor: `var(--skeleton-highlight, ${highlight})`,
    };
  }, [resolvedTheme]);

  // Form State
  const initialState = useMemo(
    () => ({
      startDate: "",
      endDate: "",
      reason: "",
      routeId: "",
    }),
    [],
  );
  const [formData, setFormData] = useState(initialState);
  const [showRouting, setShowRouting] = useState(false);

  // Error/Banner State
  const [banner, setBanner] = useState({ tone: "error", message: "" });
  const clearBanner = () => setBanner({ tone: "error", message: "" });
  const showBanner = (tone, message) => setBanner({ tone, message });

  // Submission Latches
  const successLatchRef = useRef(false);
  const [successLatchUI, setSuccessLatchUI] = useState(false);
  const submitInFlightRef = useRef(false);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setShowRouting(false);
    clearBanner();
    successLatchRef.current = false;
    setSuccessLatchUI(false);
    submitInFlightRef.current = false;
  }, [initialState]);

  useEffect(() => {
    return () => {
      successLatchRef.current = false;
      submitInFlightRef.current = false;
    };
  }, []);

  // Fetch Live Wellness Balance
  const { data: balanceData, isLoading: isBalanceLoading } = useQuery({
    queryKey: ["myWellnessBalance"],
    queryFn: getMyWellnessBalance,
  });

  // Calculate live max days (fallback to user state if query is still loading/failing)
  const maxWellnessDays =
    balanceData?.data?.wellnessDays ?? user?.balances?.wellnessDays ?? 0;

  // Fetch Approval Routes
  const { data: routesResponse, isLoading: isRoutesLoading } = useQuery({
    queryKey: ["approvalRoutes"],
    queryFn: fetchAllApprovalRoutes,
  });

  // Auto-select the user's personal route
  useEffect(() => {
    if (routesResponse && Array.isArray(routesResponse) && !formData.routeId) {
      const myRoute = routesResponse.find(
        (r) =>
          String(r.createdBy?._id || r.createdBy) ===
          String(admin?.id || admin?._id),
      );
      if (myRoute) {
        setFormData((prev) => ({ ...prev, routeId: myRoute._id }));
      }
    }
  }, [routesResponse, admin, formData.routeId]);

  const mutation = useMutation({
    mutationFn: addWellnessApplicationRequest,
    retry: 0,
  });

  const isBusy = mutation.isPending || successLatchUI;

  // Computed total days
  const totalDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end < start) return 0;
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [formData.startDate, formData.endDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    clearBanner();

    if (name === "reason") {
      setFormData((prev) => ({
        ...prev,
        reason: value.slice(0, MAX_REASON_LEN),
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const sanitizeAndValidatePayload = () => {
    if (!formData.startDate || !formData.endDate) {
      return { ok: false, message: "Please select both start and end dates." };
    }

    if (totalDays <= 0) {
      return { ok: false, message: "Invalid date range selected." };
    }

    if (totalDays > maxWellnessDays) {
      return {
        ok: false,
        message: `Requested days (${totalDays}) exceed your available balance (${maxWellnessDays}).`,
      };
    }

    if (!formData.routeId) {
      return {
        ok: false,
        message: "Please select an approval route.",
      };
    }

    const reason = String(formData.reason || "")
      .trim()
      .slice(0, MAX_REASON_LEN);
    if (!reason) {
      return { ok: false, message: "Please provide a reason for the leave." };
    }

    return {
      ok: true,
      payload: {
        employeeId: user?._id || user?.id,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalDays,
        reason,
        routeId: formData.routeId,
      },
    };
  };

  const startSubmit = async () => {
    clearBanner();

    if (successLatchRef.current || submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    if (mutation.isPending || successLatchUI) return;

    const result = sanitizeAndValidatePayload();
    if (!result.ok) {
      showBanner("error", result.message || "Please review the form.");
      submitInFlightRef.current = false;
      return;
    }

    try {
      await mutation.mutateAsync(result.payload);

      successLatchRef.current = true;
      setSuccessLatchUI(true);

      toast.success("Wellness Leave submitted successfully!");

      // Invalidate relevant queries so balances and histories update everywhere
      queryClient.invalidateQueries({ queryKey: ["myWellnessApplications"] });
      queryClient.invalidateQueries({ queryKey: ["employeeDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["myWellnessBalance"] }); // Add this

      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || "Failed to submit";
      showBanner("error", msg);
      submitInFlightRef.current = false;
      successLatchRef.current = false;
      setSuccessLatchUI(false);
    }
  };

  return (
    <div
      className="w-full max-w-xl mx-auto rounded-xl overflow-hidden border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
        color: "var(--app-text)",
      }}
    >
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        {/* Header */}
        <div
          className="px-4 py-4 border-b flex items-start sm:items-center justify-between gap-3 transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "rgba(34,197,94,0.1)", // Green tint
                borderColor: "rgba(34,197,94,0.18)",
                color: "#16a34a",
              }}
            >
              <Layers className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">Wellness Leave</h2>
              <p
                className="text-xs truncate"
                style={{ color: "var(--app-muted)" }}
              >
                Day-based leave request
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 min-w-[70px]">
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
              style={{ color: "var(--app-muted)" }}
            >
              Available
            </p>
            {isBalanceLoading ? (
              <Skeleton width={50} height={20} />
            ) : (
              <p
                className="text-sm font-extrabold"
                style={{ color: "#16a34a" }}
              >
                {maxWellnessDays} Day(s)
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startSubmit();
          }}
          className="flex flex-col h-[calc(100dvh-16rem)] sm:h-[calc(100vh-16rem)]"
        >
          {/* Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
            {/* Banner */}
            <Banner
              tone={banner.tone}
              message={banner.message}
              borderColor={borderColor}
            />

            {/* Dates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: "var(--app-text)" }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center border"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      borderColor: borderColor,
                      color: "var(--app-muted)",
                    }}
                  >
                    <Calendar className="w-4 h-4" />
                  </div>
                  Start Date
                </div>

                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  disabled={isBusy || isBalanceLoading}
                  className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor:
                      isBusy || isBalanceLoading
                        ? "var(--app-surface-2)"
                        : "var(--app-surface)",
                    borderColor: borderColor,
                    color:
                      isBusy || isBalanceLoading
                        ? "var(--app-muted)"
                        : "var(--app-text)",
                  }}
                />
              </div>

              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: "var(--app-text)" }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center border"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      borderColor: borderColor,
                      color: "var(--app-muted)",
                    }}
                  >
                    <Calendar className="w-4 h-4" />
                  </div>
                  End Date (Inclusive)
                </div>

                <input
                  type="date"
                  name="endDate"
                  min={formData.startDate}
                  value={formData.endDate}
                  onChange={handleChange}
                  disabled={isBusy || isBalanceLoading}
                  className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor:
                      isBusy || isBalanceLoading
                        ? "var(--app-surface-2)"
                        : "var(--app-surface)",
                    borderColor: borderColor,
                    color:
                      isBusy || isBalanceLoading
                        ? "var(--app-muted)"
                        : "var(--app-text)",
                  }}
                />
              </div>
            </div>

            {/* Total Days Computed */}
            <div
              className="flex items-center justify-between p-4 rounded-xl border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "rgba(34,197,94,0.05)",
                borderColor: "rgba(34,197,94,0.15)",
              }}
            >
              <span
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: "var(--app-text)" }}
              >
                Total Days Computed
              </span>
              <span
                className="text-xl font-extrabold"
                style={{ color: "#16a34a" }}
              >
                {totalDays} Day(s)
              </span>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <div
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "var(--app-text)" }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center border"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                    color: "var(--app-muted)",
                  }}
                >
                  <FileText className="w-4 h-4" />
                </div>
                Reason / Purpose
              </div>

              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows="4"
                maxLength={MAX_REASON_LEN}
                placeholder="Provide a valid reason for your wellness leave..."
                disabled={isBusy || isBalanceLoading}
                className="w-full p-3 rounded-lg outline-none resize-none text-sm border transition-colors duration-200 ease-out"
                style={{
                  backgroundColor:
                    isBusy || isBalanceLoading
                      ? "var(--app-surface-2)"
                      : "var(--app-surface)",
                  borderColor: borderColor,
                  color:
                    isBusy || isBalanceLoading
                      ? "var(--app-muted)"
                      : "var(--app-text)",
                }}
              />

              <div
                className="text-[10px] text-right"
                style={{ color: "var(--app-muted)" }}
              >
                {String(formData.reason || "").length}/{MAX_REASON_LEN}
              </div>
            </div>

            {/* Approval Routing */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={isBusy || isBalanceLoading}
                onClick={() => setShowRouting((s) => !s)}
                className="w-full flex items-center justify-between p-3 rounded-lg border transition-colors duration-200 ease-out disabled:opacity-60"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                  color: "var(--app-text)",
                }}
              >
                <div className="flex items-center gap-2 text-sm font-bold">
                  <UserCheck size={16} style={{ color: "var(--app-muted)" }} />
                  Approval Routing
                </div>
                {showRouting ? (
                  <ChevronUp size={16} style={{ color: "var(--app-muted)" }} />
                ) : (
                  <ChevronDown
                    size={16}
                    style={{ color: "var(--app-muted)" }}
                  />
                )}
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  showRouting
                    ? "max-h-[420px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-3 pt-1 px-1">
                  {isRoutesLoading ? (
                    <Skeleton height={40} borderRadius={8} />
                  ) : !formData.routeId ? (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-2">
                      <AlertCircle size={14} />
                      You haven't set up an approval route yet.
                      <a
                        href="/app/approval-routes"
                        className="underline font-bold"
                      >
                        Set it up here
                      </a>
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-lg border bg-[color:var(--app-surface-2)] border-[color:var(--app-border)]">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1">
                        Active Workflow
                      </p>
                      <p className="text-sm font-bold text-[color:var(--app-text)]">
                        {routesResponse?.find((r) => r._id === formData.routeId)
                          ?.name || "Personal Workflow"}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 mt-2 max-h-[250px] overflow-y-auto pr-1">
                    {formData.routeId &&
                      routesResponse
                        ?.find((r) => r._id === formData.routeId)
                        ?.steps?.filter((s) => s.isEnabled !== false)
                        ?.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 rounded-lg shadow-sm border transition-colors duration-300 ease-out"
                            style={{
                              backgroundColor: "var(--app-surface)",
                              borderColor: borderColor,
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 border"
                              style={{
                                backgroundColor: "rgba(34,197,94,0.1)",
                                color: "#16a34a",
                                borderColor: "rgba(34,197,94,0.18)",
                              }}
                            >
                              {idx + 1}
                            </div>

                            <div className="min-w-0">
                              <p
                                className="text-xs font-semibold truncate"
                                style={{ color: "var(--app-text)" }}
                              >
                                {step.approver
                                  ? `${step.approver.firstName} ${step.approver.lastName}`
                                  : "Not Assigned"}
                              </p>
                              <p
                                className="text-[10px] uppercase tracking-tight truncate"
                                style={{ color: "var(--app-muted)" }}
                              >
                                {step.approver?.position ||
                                  "Position not specified"}
                              </p>
                            </div>
                          </div>
                        ))}
                    {!formData.routeId && !isRoutesLoading && (
                      <div
                        className="p-3 text-center text-xs italic"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Please select an approval route to proceed.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div
            className="border-t px-4 py-3 flex flex-row items-stretch sm:items-center gap-2 sm:gap-3 sticky bottom-0 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
            }}
          >
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                if (mutation.isPending) return;
                if (!successLatchRef.current) resetForm();
                onClose?.();
              }}
              className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 rounded-lg border font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor: borderColor,
                color: "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.filter = "brightness(0.98)";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
            >
              Close
            </button>

            <button
              type="submit"
              disabled={
                isBusy ||
                isBalanceLoading ||
                totalDays <= 0 ||
                totalDays > maxWellnessDays
              }
              className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 rounded-lg font-bold disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200 ease-out shadow-sm"
              style={{
                backgroundColor: "#16a34a",
                border: "1px solid #16a34a",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.filter = "brightness(0.95)";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
            >
              {mutation.isPending
                ? "Submitting..."
                : successLatchUI
                  ? "Submitted"
                  : "Submit Request"}
            </button>
          </div>
        </form>
      </SkeletonTheme>
    </div>
  );
};

export default AddWellnessApplicationForm;
