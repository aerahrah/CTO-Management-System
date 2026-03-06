import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  FileText,
  BadgeCheck,
  CalendarDays,
  Check,
  ExternalLink,
  MessageCircle,
  XCircle,
  AlertCircle,
  Info,
  Ban,
  CheckCircle2,
  Users,
  History,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { StatusIcon, StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Modal from "../../modal";
import {
  approveApplicationRequest,
  rejectApplicationRequest,
  getCtoApplicationById,
} from "../../../api/cto";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import MemoList from "../ctoMemoModal";
import { buildApiUrl } from "../../../config/env";

import CtoApplicationPdfModal from "../ctoApplicationComponents/ctoApplicationPDFModal";

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ✅ Reactive resolved theme for system mode */
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
   Theme-aware icon chip styles (fixes "light-looking" icon pills in dark mode)
========================= */
function getIconChipStyle(kind, borderColor) {
  const map = {
    accent: {
      bg: "var(--accent-soft)",
      fg: "var(--accent)",
      br: "var(--accent-soft2, rgba(37,99,235,0.18))",
    },
    green: {
      bg: "rgba(34,197,94,0.14)",
      fg: "#16a34a",
      br: "rgba(34,197,94,0.22)",
    },
    red: {
      bg: "rgba(239,68,68,0.14)",
      fg: "#ef4444",
      br: "rgba(239,68,68,0.22)",
    },
    amber: {
      bg: "rgba(245,158,11,0.16)",
      fg: "#d97706",
      br: "rgba(245,158,11,0.26)",
    },
    slate: {
      bg: "rgba(148,163,184,0.18)",
      fg: "var(--app-text)",
      br: "rgba(148,163,184,0.24)",
    },
    neutral: {
      bg: "var(--app-surface-2)",
      fg: "var(--app-muted)",
      br: borderColor || "var(--app-border)",
    },
  };

  return map[kind] || map.neutral;
}

function getOverallIconChipKind(overallStatus) {
  const s = String(overallStatus || "").toUpperCase();
  if (s === "APPROVED") return "green";
  if (s === "REJECTED") return "red";
  if (s === "CANCELLED") return "slate";
  return "amber"; // pending/unknown
}

/* =========================
   LOADING SKELETON (FULL SCREEN INSIDE CARD)
========================= */
const CtoApplicationDetailsSkeleton = ({ borderColor, resolvedTheme }) => {
  const skeletonBase =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  const skeletonHighlight =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)";

  const baseColor = `var(--skeleton-base, ${skeletonBase})`;
  const highlightColor = `var(--skeleton-highlight, ${skeletonHighlight})`;

  const bgFallback =
    resolvedTheme === "dark" ? "rgba(2,6,23,0.96)" : "rgba(245,245,245,0.80)";

  return (
    <div
      className="flex-1 h-full rounded-xl shadow-md w-full flex flex-col gap-2 max-w-6xl mx-auto min-w-0 border"
      aria-busy="true"
      aria-label="Loading application details"
      style={{
        backgroundColor: `var(--app-bg, ${bgFallback})`,
        color: "var(--app-text, #0f172a)",
        borderColor: borderColor || "var(--app-border, rgba(15,23,42,0.10))",
      }}
    >
      <SkeletonTheme baseColor={baseColor} highlightColor={highlightColor}>
        <header
          className="flex md:rounded-t-xl flex-col md:flex-row md:items-center justify-between gap-3 border-b backdrop-blur px-3 sm:px-4 py-2 z-10"
          style={{
            backgroundColor: "var(--app-surface, rgba(255,255,255,0.9))",
            borderColor:
              borderColor || "var(--app-border, rgba(15,23,42,0.10))",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <Skeleton height={48} width={48} borderRadius={12} />
              <div className="min-w-0 flex-1">
                <Skeleton height={18} width={"55%"} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Skeleton height={18} width={110} borderRadius={999} />
                  <Skeleton height={18} width={120} borderRadius={999} />
                  <Skeleton height={18} width={90} borderRadius={999} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center gap-2 sm:gap-3 pt-1 bg-transparent rounded-xl w-full md:w-auto">
            <Skeleton height={40} width={110} borderRadius={12} />
            <Skeleton height={40} width={160} borderRadius={12} />
          </div>
        </header>

        <div
          className="flex h-full flex-1 min-h-0 overflow-y-auto app-scrollbar flex-col gap-4 px-3 sm:px-4 py-2"
          style={{ backgroundColor: "transparent" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
            <div
              className="md:col-span-2 rounded-xl p-4 sm:p-6 relative overflow-hidden shadow-sm min-w-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent, #2563eb) 0%, rgba(255,255,255,0.16) 140%)",
              }}
            >
              <div
                className="absolute right-[-20px] top-[-20px] h-40 w-40 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
              />
              <div className="relative z-10 flex gap-3 justify-between items-center min-w-0">
                <div className="min-w-0 flex-1">
                  <Skeleton height={12} width={140} borderRadius={8} />
                  <div className="mt-2">
                    <Skeleton height={26} width={"85%"} borderRadius={10} />
                  </div>
                  <div className="mt-2">
                    <Skeleton height={18} width={"55%"} borderRadius={10} />
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-none">
                  <div
                    className="backdrop-blur-md px-4 py-2 rounded-xl"
                    style={{ backgroundColor: "rgba(255,255,255,0.20)" }}
                  >
                    <Skeleton height={10} width={90} borderRadius={8} />
                    <div className="mt-2">
                      <Skeleton height={22} width={70} borderRadius={10} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="border rounded-xl p-4 flex justify-between items-center text-center gap-4 min-w-0"
              style={{
                backgroundColor: "var(--app-surface, rgba(255,255,255,0.9))",
                borderColor:
                  borderColor || "var(--app-border, rgba(15,23,42,0.10))",
              }}
            >
              <Skeleton height={56} width={56} borderRadius={18} />
              <div className="text-start min-w-0 flex-1">
                <Skeleton height={12} width={120} borderRadius={8} />
                <div className="mt-2">
                  <Skeleton height={22} width={140} borderRadius={10} />
                </div>
              </div>
            </div>
          </div>

          {/* rest of skeleton unchanged */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
            <div className="lg:col-span-2 space-y-4 min-w-0">
              <section
                className="border rounded-xl p-3 shadow-sm min-w-0"
                style={{
                  backgroundColor: "var(--app-surface, rgba(255,255,255,0.9))",
                  borderColor:
                    borderColor || "var(--app-border, rgba(15,23,42,0.10))",
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <Skeleton height={40} width={40} borderRadius={12} />
                  <Skeleton height={12} width={170} borderRadius={8} />
                </div>

                <div
                  className="p-4 rounded-2xl border"
                  style={{
                    backgroundColor:
                      "var(--app-surface-2, rgba(15,23,42,0.03))",
                    borderColor:
                      borderColor || "var(--app-border, rgba(15,23,42,0.10))",
                  }}
                >
                  <Skeleton height={12} width={"92%"} />
                  <div className="mt-2">
                    <Skeleton height={12} width={"88%"} />
                  </div>
                  <div className="mt-2">
                    <Skeleton height={12} width={"80%"} />
                  </div>
                  <div className="mt-2">
                    <Skeleton height={12} width={"60%"} />
                  </div>
                </div>
              </section>

              <section
                className="border rounded-xl p-3 shadow-sm min-w-0"
                style={{
                  backgroundColor: "var(--app-surface, rgba(255,255,255,0.9))",
                  borderColor:
                    borderColor || "var(--app-border, rgba(15,23,42,0.10))",
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <Skeleton height={40} width={40} borderRadius={12} />
                  <div className="min-w-0 flex-1">
                    <Skeleton height={12} width={170} borderRadius={8} />
                    <div className="mt-2">
                      <Skeleton height={12} width={210} borderRadius={8} />
                    </div>
                  </div>
                </div>

                <div className="relative space-y-6 sm:space-y-8 t-1 min-w-0">
                  <div
                    className="absolute left-5 top-2 bottom-2 w-0.5"
                    style={{
                      backgroundColor: "var(--app-border, rgba(15,23,42,0.10))",
                    }}
                  />

                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="relative flex gap-2 sm:gap-4 items-start min-w-0"
                    >
                      <div
                        className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-md flex-none"
                        style={{
                          borderColor:
                            "var(--app-surface, rgba(255,255,255,0.9))",
                          backgroundColor:
                            "var(--app-surface-2, rgba(15,23,42,0.03))",
                        }}
                      >
                        <Skeleton height={16} width={16} borderRadius={6} />
                      </div>

                      <div
                        className="flex-1 border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0"
                        style={{
                          backgroundColor:
                            "var(--app-surface, rgba(255,255,255,0.9))",
                          borderColor:
                            borderColor ||
                            "var(--app-border, rgba(15,23,42,0.10))",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <Skeleton height={10} width={90} borderRadius={8} />
                            <div className="mt-2">
                              <Skeleton
                                height={14}
                                width={"55%"}
                                borderRadius={8}
                              />
                            </div>
                            <div className="mt-2">
                              <Skeleton
                                height={12}
                                width={"45%"}
                                borderRadius={8}
                              />
                            </div>
                          </div>
                          <div className="flex-none">
                            <Skeleton
                              height={22}
                              width={90}
                              borderRadius={999}
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <Skeleton height={12} width={"92%"} />
                          <div className="mt-2">
                            <Skeleton height={12} width={"78%"} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-4 min-w-0">
              <div
                className="border rounded-xl p-3 shadow-sm min-w-0"
                style={{
                  backgroundColor: "var(--app-surface, rgba(255,255,255,0.9))",
                  borderColor:
                    borderColor || "var(--app-border, rgba(15,23,42,0.10))",
                }}
              >
                <div className="flex items-center justify-between">
                  <Skeleton height={12} width={120} borderRadius={8} />
                  <Skeleton height={28} width={90} borderRadius={10} />
                </div>
                <div className="mt-3 grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} height={10} borderRadius={6} />
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} height={30} borderRadius={10} />
                  ))}
                </div>
              </div>

              <div
                className="border rounded-xl p-2 sm:p-3 shadow-sm min-w-0"
                style={{
                  backgroundColor: "var(--app-surface, rgba(255,255,255,0.9))",
                  borderColor:
                    borderColor || "var(--app-border, rgba(15,23,42,0.10))",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <Skeleton height={12} width={120} borderRadius={8} />
                </div>

                <div className="mt-3">
                  <Skeleton height={46} borderRadius={12} />
                </div>

                <div className="mt-5 md:mt-7 flex items-center justify-between gap-3">
                  <Skeleton height={12} width={150} borderRadius={8} />
                  <Skeleton height={18} width={28} borderRadius={999} />
                </div>

                <div className="mt-2 space-y-1.5">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 border border-transparent"
                      style={{ backgroundColor: "transparent" }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Skeleton height={32} width={32} borderRadius={10} />
                        <div className="min-w-0 flex-1">
                          <Skeleton
                            height={14}
                            width={"60%"}
                            borderRadius={8}
                          />
                          <div className="mt-2">
                            <Skeleton
                              height={11}
                              width={"45%"}
                              borderRadius={8}
                            />
                          </div>
                        </div>
                      </div>
                      <Skeleton height={14} width={14} borderRadius={4} />
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <Skeleton height={42} borderRadius={12} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </SkeletonTheme>
    </div>
  );
};

/* =========================
   MEDIA HOOK
========================= */
function useIsXlUp() {
  const [isXlUp, setIsXlUp] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1280px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = (e) => setIsXlUp(e.matches);

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return isXlUp;
}

/* =========================
   Status helpers (CANCELLED-aware) - theme-aware (icon pills + label pills)
========================= */
const STATUS_META = {
  APPROVED: { label: "APPROVED", tone: "green" },
  REJECTED: { label: "REJECTED", tone: "red" },
  PENDING: { label: "PENDING", tone: "amber" },
  CANCELLED: { label: "CANCELLED", tone: "slate" },
};

const getTonePillStyle = (tone, borderColor) => {
  const t = getIconChipStyle(tone, borderColor);
  return {
    backgroundColor: t.bg,
    color: t.fg,
    borderColor: t.br,
  };
};

/* =========================
   Timeline helpers (icons are fine; dot backgrounds are colored)
========================= */
const StepDotIcon = ({ status }) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED")
    return <CheckCircle2 size={16} className="text-white" />;
  if (s === "REJECTED") return <XCircle size={16} className="text-white" />;
  if (s === "CANCELLED") return <Ban size={16} className="text-white" />;
  return <Users size={16} className="text-white" />;
};

const StepDotClass = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "bg-emerald-500";
  if (s === "REJECTED") return "bg-red-500";
  if (s === "CANCELLED") return "bg-slate-400";
  // ✅ neutral dot uses border/surface so it doesn't look “light blob” on dark
  return "bg-[color:var(--app-border)]";
};

// --- Helper: Timeline Card ---
const TimelineCard = ({ approval, index, isLast }) => {
  const status = String(approval?.status || "").toUpperCase();
  const isDenied = status === "REJECTED";
  const isPending = status === "PENDING";
  const isCancelled = status === "CANCELLED";

  const noteStyle = isDenied
    ? { bg: "rgba(239,68,68,0.10)", br: "rgba(239,68,68,0.20)", fg: "#ef4444" }
    : isCancelled
      ? {
          bg: "rgba(148,163,184,0.14)",
          br: "rgba(148,163,184,0.22)",
          fg: "var(--app-text)",
        }
      : {
          bg: "var(--app-surface-2)",
          br: "var(--app-border)",
          fg: "var(--app-text)",
        };

  return (
    <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
      {!isLast && (
        <div
          className="absolute left-5 top-10 bottom-0 w-0.5"
          style={{ backgroundColor: "var(--app-border)" }}
        />
      )}

      <div
        className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-md transition-transform hover:scale-110 flex-none ${StepDotClass(
          status,
        )}`}
        style={{ borderColor: "var(--app-surface)" }}
        title={status}
      >
        <StepDotIcon status={status} />
      </div>

      <div
        className={`flex-1 border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 transition-all ${
          isPending ? "opacity-90" : ""
        }`}
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border)",
        }}
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Approver {index + 1}
              </span>
            </div>

            <p
              className="text-sm font-semibold break-words mt-1"
              style={{ color: "var(--app-text)" }}
            >
              {approval.approver?.firstName} {approval.approver?.lastName}
            </p>

            {/* ✅ icon/text accent is theme-aware */}
            <p
              className="text-xs font-medium break-words"
              style={{ color: "var(--accent)" }}
            >
              {approval.approver?.position || "Approver"}
            </p>
          </div>

          <div className="flex-none">
            <StatusBadge status={status} size="sm" />
          </div>
        </div>

        {isCancelled && !approval?.remarks ? (
          <div
            className="mt-4 rounded-xl text-xs flex items-start gap-2 min-w-0 border p-3"
            style={{
              backgroundColor: "rgba(148,163,184,0.14)",
              borderColor: "rgba(148,163,184,0.22)",
              color: "var(--app-text)",
            }}
          >
            <Ban size={14} className="shrink-0 mt-0.5" />
            <p className="break-words">
              <strong>Auto-cancelled:</strong> A previous approver rejected this
              request.
            </p>
          </div>
        ) : null}

        {approval?.remarks && String(approval.remarks).trim() !== "" && (
          <div
            className="mt-4 rounded-xl p-3 text-xs leading-relaxed border flex items-start gap-2 min-w-0"
            style={{
              backgroundColor: noteStyle.bg,
              borderColor: noteStyle.br,
              color: noteStyle.fg,
            }}
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p className="break-words">
              <strong>Note:</strong> {approval.remarks}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================
   Calendar helpers + component (unchanged)
========================= */
const pad2 = (n) => String(n).padStart(2, "0");

const toDateKeyLocal = (dateLike) => {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
};

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const RequestedDatesCalendar = ({ dates = [] }) => {
  const requestedKeys = useMemo(() => {
    const set = new Set();
    (Array.isArray(dates) ? dates : []).forEach((x) => {
      const key = toDateKeyLocal(x);
      if (key) set.add(key);
    });
    return set;
  }, [dates]);

  const earliestRequested = useMemo(() => {
    const arr = (Array.isArray(dates) ? dates : [])
      .map((x) => new Date(x))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return arr[0] || null;
  }, [dates]);

  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(earliestRequested || new Date()),
  );

  useEffect(() => {
    if (earliestRequested) setViewMonth(startOfMonth(earliestRequested));
  }, [earliestRequested]);

  const monthLabel = useMemo(() => {
    return viewMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [viewMonth]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const last = endOfMonth(viewMonth);

    const leadingBlanks = first.getDay();
    const daysInMonth = last.getDate();

    const cells = [];

    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({ type: "blank", key: `b-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      const key = toDateKeyLocal(d);
      const isRequested = key ? requestedKeys.has(key) : false;
      const today = new Date();
      const isToday = isSameDay(d, today);

      cells.push({
        type: "day",
        key,
        day,
        date: d,
        isRequested,
        isToday,
      });
    }

    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const trailing = 7 - remainder;
      for (let i = 0; i < trailing; i++) {
        cells.push({ type: "blank", key: `t-${i}` });
      }
    }

    return cells;
  }, [viewMonth, requestedKeys]);

  const requestedCountThisMonth = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    let count = 0;
    requestedKeys.forEach((k) => {
      const [yy, mm] = k.split("-").map((x) => Number(x));
      if (!yy || !mm) return;
      const monthIdx = mm - 1;
      if (yy === y && monthIdx === m) count += 1;
    });
    return count;
  }, [requestedKeys, viewMonth]);

  const hasAnyDates = requestedKeys.size > 0;

  return (
    <div
      className="border rounded-xl p-2 sm:p-3 shadow-sm min-w-0"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
        color: "var(--app-text)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--app-muted)" }}
          >
            Calendar
          </h4>
          <p
            className="text-[11px] font-medium"
            style={{ color: "var(--app-muted)" }}
          >
            Requested dates highlighted
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-none">
          <button
            type="button"
            onClick={() => setViewMonth((d) => addMonths(d, -1))}
            className="h-9 w-9 rounded-xl border bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)] flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2"
            style={{ borderColor: "var(--app-border)" }}
            title="Previous month"
          >
            <ChevronLeft size={16} style={{ color: "var(--app-text)" }} />
          </button>

          <button
            type="button"
            onClick={() => setViewMonth((d) => addMonths(d, 1))}
            className="h-9 w-9 rounded-xl border bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)] flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2"
            style={{ borderColor: "var(--app-border)" }}
            title="Next month"
          >
            <ChevronRight size={16} style={{ color: "var(--app-text)" }} />
          </button>

          <button
            type="button"
            disabled={!earliestRequested}
            onClick={() =>
              earliestRequested && setViewMonth(startOfMonth(earliestRequested))
            }
            className={`h-9 px-2.5 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 inline-flex items-center gap-1.5 ${
              earliestRequested
                ? "bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]"
                : "bg-[color:var(--app-surface-2)] cursor-not-allowed opacity-60"
            }`}
            style={{
              borderColor: "var(--app-border)",
              color: earliestRequested ? "var(--app-text)" : "var(--app-muted)",
            }}
            title="Jump to requested month"
          >
            <RotateCcw size={14} />
            <span className="text-[11px] font-bold">Reset</span>
          </button>
        </div>
      </div>

      <div className="mt-3 flex md:flex-col items-center md:items-start justify-between gap-2">
        <div className="inline-flex items-center gap-2 min-w-0">
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center border flex-none"
            style={{
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent)",
              borderColor: "var(--accent-soft2)",
            }}
          >
            <CalendarDays size={16} />
          </span>
          <div className="min-w-0">
            <p
              className="text-sm font-bold truncate"
              style={{ color: "var(--app-text)" }}
            >
              {monthLabel}
            </p>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--app-muted)" }}
            >
              {hasAnyDates
                ? `${requestedCountThisMonth} requested day${
                    requestedCountThisMonth === 1 ? "" : "s"
                  } this month`
                : "No requested dates"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-none">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg border"
            style={{
              color: "var(--app-muted)",
              backgroundColor: "var(--app-surface-2)",
              borderColor: "var(--app-border)",
            }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
            />
            Requested
          </span>
        </div>
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-7 gap-1.5">
          {dayNames.map((dn) => (
            <div
              key={dn}
              className="text-[10px] font-bold uppercase tracking-wider text-center py-1"
              style={{ color: "var(--app-muted)" }}
            >
              {dn}
            </div>
          ))}
        </div>

        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {grid.map((cell, idx) => {
            if (cell.type === "blank") {
              return (
                <div
                  key={cell.key || `blank-${idx}`}
                  className="h-9 rounded-xl bg-transparent"
                />
              );
            }

            const base =
              "h-9 rounded-xl border text-sm font-semibold flex items-center justify-center transition select-none";
            const requested = "shadow-sm";
            const todayRing = "ring-2 ring-blue-200 ring-offset-2";

            return (
              <div
                key={cell.key || `d-${idx}`}
                className={[
                  base,
                  cell.isRequested ? requested : "",
                  cell.isToday ? todayRing : "",
                ].join(" ")}
                style={{
                  backgroundColor: cell.isRequested
                    ? "var(--accent)"
                    : "var(--app-surface)",
                  color: cell.isRequested ? "#fff" : "var(--app-text)",
                  borderColor: cell.isRequested
                    ? "var(--accent)"
                    : "var(--app-border)",
                }}
                title={
                  cell.isRequested
                    ? "Requested date"
                    : cell.isToday
                      ? "Today"
                      : ""
                }
              >
                <span className="relative">
                  {cell.day}
                  {cell.isRequested ? (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white/90" />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>

        {!hasAnyDates ? (
          <div
            className="mt-3 rounded-xl border border-dashed px-3 py-3 text-center"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-surface-2)",
            }}
          >
            <p
              className="text-xs font-medium"
              style={{ color: "var(--app-muted)" }}
            >
              No dates to highlight
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const CtoApplicationDetails = () => {
  const { admin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate(); // (kept if you use it elsewhere)
  const queryClient = useQueryClient();

  const isXlUp = useIsXlUp();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });
  const [isPdfOpen, setIsPdfOpen] = useState(false);

  const {
    data: application,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["ctoApplication", admin?.id, id],
    queryFn: () => getCtoApplicationById(id),
    enabled: !!admin?.id && !!id,
  });

  const requestedDatesLabel = useMemo(() => {
    const dates = application?.inclusiveDates || [];
    if (!dates.length) return "No dates set";
    return dates
      .map((d) =>
        new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      )
      .join(", ");
  }, [application?.inclusiveDates]);

  const sortedApprovals = useMemo(() => {
    if (!Array.isArray(application?.approvals)) return [];
    return [...application.approvals].sort(
      (a, b) => (a.level || 0) - (b.level || 0),
    );
  }, [application?.approvals]);

  const approveMutation = useMutation({
    mutationFn: (applicationId) => approveApplicationRequest(applicationId),
    onSuccess: () => {
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Application approved successfully.");
      queryClient.invalidateQueries(["ctoApplication", id]);
      queryClient.invalidateQueries(["ctoApplicationsApprovals"]);
      queryClient.invalidateQueries(["ctoPendingCount"]);
    },
    onError: (err) => toast.error(err.message || "Failed to approve."),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ applicationId, remarks }) =>
      rejectApplicationRequest(applicationId, remarks),
    onSuccess: () => {
      setRemarks("");
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Application rejected.");
      queryClient.invalidateQueries(["ctoApplication", id]);
      queryClient.invalidateQueries(["ctoApplicationsApprovals"]);
      queryClient.invalidateQueries(["ctoPendingCount"]);
    },
    onError: (err) => toast.error(err.message || "Failed to reject."),
  });

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  const handleAction = () => {
    if (!application) return;
    if (isMutating) return;

    if (modalType === "approve") {
      approveMutation.mutate(application._id);
    } else {
      if (!remarks.trim()) return toast.error("Please provide a reason.");
      rejectMutation.mutate({
        applicationId: application._id,
        remarks,
      });
    }
  };

  useEffect(() => {
    setIsProcessed(false);
    setRemarks("");
    setIsPdfOpen(false);
  }, [application]);

  if (isLoading)
    return (
      <>
        <CtoApplicationDetailsSkeleton
          borderColor={borderColor}
          resolvedTheme={resolvedTheme}
        />
      </>
    );

  if (isError)
    return (
      <>
        <p style={{ color: "var(--app-muted)" }}>Error: {error?.message}</p>
      </>
    );

  if (!application)
    return (
      <div
        className="flex flex-col items-center justify-center py-40 rounded-xl border-2 border-dashed m-4 sm:m-6"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor: "var(--app-border)",
          color: "var(--app-text)",
        }}
      >
        <FileText className="h-10 w-10" style={{ color: "var(--app-muted)" }} />
        <h3 className="font-semibold" style={{ color: "var(--app-text)" }}>
          No Application Found
        </h3>
      </div>
    );

  const initials = `${application.employee?.firstName?.[0] || ""}${
    application.employee?.lastName?.[0] || ""
  }`;

  const currentStep = application.approvals?.find(
    (step) => String(step.approver?._id) === String(admin?.id),
  );

  const canApproveOrReject =
    currentStep?.status === "PENDING" &&
    application.overallStatus === "PENDING" &&
    !isProcessed;

  const overallMeta =
    STATUS_META[String(application.overallStatus || "").toUpperCase()] ||
    STATUS_META.PENDING;

  const overallPillStyle = getTonePillStyle(overallMeta.tone, borderColor);
  const overallIconKind = getOverallIconChipKind(application.overallStatus);
  const overallIconChip = getIconChipStyle(overallIconKind, borderColor);

  const memos = Array.isArray(application.memo) ? application.memo : [];
  const memoCount = memos.length;

  return (
    <div
      className="flex-1 h-full rounded-xl shadow-md w-full flex flex-col gap-2 max-w-6xl mx-auto min-w-0 border"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
        borderColor: borderColor,
      }}
    >
      {/* HEADER */}
      <header
        className="flex md:rounded-t-xl flex-col md:flex-row md:items-center justify-between gap-3 border-b backdrop-blur px-3 sm:px-4 py-2 z-10"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div
              className="h-12 w-12 rounded-xl text-white flex items-center justify-center font-bold text-lg flex-none"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {initials}
            </div>

            <div className="min-w-0">
              <h2
                className="text-lg font-bold leading-tight truncate"
                style={{ color: "var(--app-text)" }}
              >
                {application.employee?.firstName}{" "}
                {application.employee?.lastName}
              </h2>

              <div
                className="flex flex-wrap items-center gap-2 text-xs font-medium mt-0.5"
                style={{ color: "var(--app-muted)" }}
              >
                {/* ✅ ID pill now theme-aware */}
                <span
                  className="px-1.5 py-0.5 rounded border"
                  style={{
                    backgroundColor: "var(--accent-soft)",
                    color: "var(--accent)",
                    borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
                  }}
                >
                  ID: {application.employee?.employeeId || "N/A"}
                </span>

                <span className="flex items-center gap-1">
                  <Clock size={12} />{" "}
                  {new Date(application.createdAt).toLocaleDateString()}
                </span>

                {/* ✅ Overall status pill now theme-aware */}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold"
                  style={overallPillStyle}
                  title="Overall Status"
                >
                  {String(application.overallStatus || "").toUpperCase() ===
                  "CANCELLED" ? (
                    <Ban size={12} />
                  ) : null}
                  {application.overallStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-row items-center gap-2 sm:gap-3 pt-1 bg-transparent rounded-xl w-full md:w-auto">
          {canApproveOrReject ? (
            <>
              <button
                onClick={() => {
                  setModalType("reject");
                  setIsModalOpen(true);
                }}
                className="w-full sm:w-auto flex-1 md:flex-none px-4 py-2 rounded-lg font-semibold"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  color: "var(--app-text)",
                  border: `1px solid ${borderColor}`,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.filter = "brightness(0.98)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
              >
                Reject
              </button>

              <button
                onClick={() => {
                  setModalType("approve");
                  setIsModalOpen(true);
                }}
                disabled={approveMutation.isPending}
                className="w-full sm:w-auto rounded-lg px-4 py-2 transition shadow-sm font-medium flex items-center justify-center gap-2"
                style={{
                  backgroundColor: "var(--accent)",
                  border: "1px solid var(--accent)",
                  color: "#fff",
                  opacity: approveMutation.isPending ? 0.8 : 1,
                }}
                onMouseEnter={(e) => {
                  if (approveMutation.isPending) return;
                  e.currentTarget.style.filter = "brightness(0.95)";
                }}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
              >
                {approveMutation.isPending
                  ? "Processing..."
                  : "Approve Request"}
              </button>
            </>
          ) : (
            <div
              className="px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border w-full sm:w-auto"
              style={{
                backgroundColor: "rgba(34,197,94,0.14)",
                color: "#16a34a",
                borderColor: "rgba(34,197,94,0.22)",
              }}
            >
              <BadgeCheck size={18} /> Action Completed
            </div>
          )}
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex h-full flex-1 min-h-0 overflow-y-auto app-scrollbar flex-col gap-4 px-3 sm:px-4 py-2">
        {/* QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
          <div
            className="md:col-span-2 rounded-xl p-4 sm:p-6 text-white flex gap-3 justify-between items-center relative overflow-hidden min-w-0"
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 80%, rgba(255,255,255,0.16) 140%)",
            }}
          >
            <CalendarDays className="absolute right-[-20px] top-[-20px] h-40 w-40 text-white/10 rotate-12" />
            <div className="min-w-0">
              <p className="text-white/90 text-xs font-bold uppercase tracking-widest mb-1">
                Requested Dates
              </p>
              <h3 className="text-xl md:text-2xl font-bold break-words">
                {requestedDatesLabel}
              </h3>
            </div>

            <div className="flex items-center gap-4 flex-none">
              <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl">
                <p className="text-[10px] text-white/90 uppercase font-bold">
                  Total Duration
                </p>
                <p className="text-xl font-bold">
                  {application.requestedHours} Hours
                </p>
              </div>
            </div>
          </div>

          {/* ✅ Global Status icon chip now theme-aware */}
          <div
            className="border rounded-xl p-4 flex justify-between items-center text-center gap-4 min-w-0"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
            }}
          >
            <div
              className="p-4 rounded-2xl border"
              style={{
                backgroundColor: overallIconChip.bg,
                borderColor: overallIconChip.br,
                color: overallIconChip.fg,
              }}
            >
              {String(application.overallStatus || "").toUpperCase() ===
              "CANCELLED" ? (
                <Ban size={28} className="h-6 w-6" />
              ) : (
                <StatusIcon
                  status={application.overallStatus}
                  size={32}
                  className="h-6 w-6"
                />
              )}
            </div>

            <div className="text-start min-w-0">
              <p
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--app-muted)" }}
              >
                Global Status
              </p>
              <p
                className="text-xl font-black break-words"
                style={{ color: "var(--app-text)" }}
              >
                {application.overallStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <section
              className="border rounded-xl p-3 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                {/* ✅ Purpose icon chip theme-aware */}
                {(() => {
                  const chip = getIconChipStyle("accent", borderColor);
                  return (
                    <span
                      className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
                      style={{
                        backgroundColor: chip.bg,
                        color: chip.fg,
                        borderColor: chip.br,
                      }}
                    >
                      <MessageCircle size={20} />
                    </span>
                  );
                })()}

                <h3
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--app-muted)" }}
                >
                  Purpose of Leave
                </h3>
              </div>

              <p
                className="leading-relaxed italic p-4 rounded-2xl border break-words"
                style={{
                  color: "var(--app-text)",
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                "
                {application.reason ||
                  "No specific reason provided by the applicant."}
                "
              </p>
            </section>

            <section
              className="border rounded-xl p-3 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                {/* ✅ Timeline icon chip theme-aware */}
                {(() => {
                  const chip = getIconChipStyle("green", borderColor);
                  return (
                    <span
                      className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
                      style={{
                        backgroundColor: chip.bg,
                        color: chip.fg,
                        borderColor: chip.br,
                      }}
                    >
                      <History size={18} />
                    </span>
                  );
                })()}

                <div className="min-w-0">
                  <h3
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Processing Timeline
                  </h3>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Step-by-step approval progress
                  </p>
                </div>
              </div>

              {sortedApprovals.length > 0 ? (
                <div className="relative space-y-6 sm:space-y-8 t-1 min-w-0">
                  <div
                    className="absolute left-5 top-2 bottom-2 w-0.5"
                    style={{ backgroundColor: "var(--app-border)" }}
                  />

                  {sortedApprovals.map((approval, idx) => (
                    <TimelineCard
                      key={approval?._id || idx}
                      approval={approval}
                      index={idx}
                      isLast={idx === sortedApprovals.length - 1}
                    />
                  ))}

                  {String(application.overallStatus || "").toUpperCase() ===
                    "APPROVED" && (
                    <div className="relative flex gap-2 sm:gap-4 items-start">
                      <div className="relative z-10 h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center border-4 border-white shadow-md flex-none">
                        <CheckCircle2 size={18} className="text-white" />
                      </div>
                      <div
                        className="flex-1 rounded-2xl p-4 shadow-sm border"
                        style={{
                          backgroundColor: "rgba(34,197,94,0.14)",
                          borderColor: "rgba(34,197,94,0.22)",
                        }}
                      >
                        <p
                          className="font-bold text-sm"
                          style={{ color: "#16a34a" }}
                        >
                          Application Fully Approved
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--app-muted)" }}
                        >
                          The CTO request has been finalized.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl text-center"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: "var(--app-border)",
                  }}
                >
                  <Users
                    size={32}
                    style={{ color: "var(--app-muted)" }}
                    className="mb-3"
                  />
                  <p
                    style={{ color: "var(--app-text)" }}
                    className="font-medium"
                  >
                    Waiting for workflow initiation
                  </p>
                  <p style={{ color: "var(--app-muted)" }} className="text-sm">
                    No approvers have acted on this request yet.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-4 min-w-0">
            <RequestedDatesCalendar dates={application?.inclusiveDates || []} />

            <div
              className="border rounded-xl p-2 sm:p-3 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h4
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--app-muted)" }}
                >
                  Documents
                </h4>
              </div>

              <button
                type="button"
                onClick={() => setIsPdfOpen(true)}
                className="mt-3 w-full inline-flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold hover:bg-[color:var(--app-surface-2)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 transition"
                style={{
                  borderColor: borderColor,
                  backgroundColor: "var(--app-surface)",
                  color: "var(--app-text)",
                }}
                title="View Application PDF"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  {/* ✅ PDF icon chip theme-aware red-ish */}
                  <span
                    className="h-8 w-8 rounded-lg flex items-center justify-center flex-none border"
                    style={{
                      backgroundColor: "rgba(239,68,68,0.12)",
                      color: "#ef4444",
                      borderColor: "rgba(239,68,68,0.20)",
                    }}
                  >
                    <FileText size={16} />
                  </span>
                  <span className="truncate">Application Form</span>
                </span>

                <span
                  className="text-[9px] font-bold px-2 py-1 rounded-lg flex-none border"
                  style={{
                    color: "var(--app-muted)",
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-surface-2)",
                  }}
                >
                  PDF
                </span>
              </button>

              <div className="mt-5 md:mt-7 flex items-center justify-between gap-3">
                <h4
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--app-muted)" }}
                >
                  Supporting Memos
                </h4>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold flex-none border"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    color: "var(--app-muted)",
                    borderColor: "var(--app-border)",
                  }}
                >
                  {memoCount}
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                {memoCount > 0 ? (
                  memos.slice(0, 3).map((m, i) => (
                    <a
                      key={i}
                      href={buildApiUrl(m.uploadedMemo)}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-[color:var(--app-surface-2)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 transition min-w-0"
                      title={`Open Memo ${m.memoId?.memoNo}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center flex-none border"
                          style={{
                            backgroundColor: "rgba(239,68,68,0.12)",
                            color: "#ef4444",
                            borderColor: "rgba(239,68,68,0.20)",
                          }}
                        >
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--app-text)" }}
                          >
                            Memo {m.memoId?.memoNo || "—"}
                          </p>
                          <p
                            className="text-[11px] truncate"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Click to open
                          </p>
                        </div>
                      </div>

                      <ExternalLink
                        size={14}
                        className="transition flex-none"
                        style={{ color: "var(--app-muted)" }}
                      />
                    </a>
                  ))
                ) : (
                  <div
                    className="mt-2 rounded-xl border border-dashed px-3 py-4 text-center"
                    style={{
                      borderColor: "var(--app-border)",
                      backgroundColor: "var(--app-surface-2)",
                    }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--app-muted)" }}
                    >
                      No memos attached
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() =>
                  setMemoModal({
                    isOpen: true,
                    memos: memos,
                  })
                }
                disabled={memoCount === 0}
                className={`mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-bold border transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 ${
                  memoCount === 0 ? "cursor-not-allowed opacity-60" : ""
                }`}
                style={{
                  backgroundColor:
                    memoCount === 0
                      ? "var(--app-surface-2)"
                      : "var(--app-surface)",
                  color:
                    memoCount === 0 ? "var(--app-muted)" : "var(--app-text)",
                  borderColor: borderColor,
                }}
              >
                {memoCount === 0
                  ? "View all memos"
                  : `View all memos (${memoCount})`}
              </button>
            </div>
          </aside>
        </div>

        {/* MODALS (left as-is; if you want, I can theme these too) */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            modalType === "approve" ? "Confirm Approval" : "Decline Request"
          }
          maxWidth="max-w-lg"
          action={{
            show: true,
            label:
              modalType === "approve"
                ? approveMutation.isPending
                  ? "Approving..."
                  : "Approve"
                : rejectMutation.isPending
                  ? "Rejecting..."
                  : "Reject",
            variant: modalType === "approve" ? "save" : "delete",
            onClick: handleAction,
            disabled: isMutating || (modalType === "reject" && !remarks.trim()),
          }}
        >
          <div className="p-2">
            {/* You can theme modal chips too if needed */}
            <div className="mb-6 flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-slate-400">
                <Info size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Reviewing Request For
                </p>
                <p className="text-sm font-bold text-slate-900 break-words">
                  {application.employee?.firstName}{" "}
                  {application.employee?.lastName}
                </p>
              </div>
            </div>

            {modalType === "approve" ? (
              <div className="text-center py-4 max-w-sm mx-auto">
                <div className="mx-auto h-20 w-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-100/50 shadow-inner">
                  <Check size={40} strokeWidth={3} />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Are you sure you want to approve this CTO Request?
                </h2>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertCircle size={18} />
                  <h3 className="font-bold text-sm">Reason for Rejection</h3>
                </div>

                <div className="relative">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Please explain why this request is being declined (e.g., overlapping schedules, insufficient credits)..."
                    className={`
                      w-full p-4 bg-white border-2 rounded-2xl outline-none min-h-[140px]
                      text-sm text-slate-700 transition-all
                      ${
                        remarks.trim()
                          ? "border-slate-200 focus:border-blue-500"
                          : "border-rose-100 focus:border-rose-300 placeholder:text-rose-300"
                      }
                    `}
                  />
                  <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        remarks.trim() ? "text-slate-400" : "text-rose-400"
                      }`}
                    >
                      {remarks.length > 0
                        ? `${remarks.length} chars`
                        : "Required"}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                  Tip: Providing a clear reason helps employees correct future
                  applications.
                </p>
              </div>
            )}
          </div>
        </Modal>

        <Modal
          isOpen={memoModal.isOpen}
          onClose={() => setMemoModal({ isOpen: false, memos: [] })}
          title="Attached Memos"
        >
          <MemoList
            memos={memoModal.memos}
            description={
              "Read-only view of CTO memos attached to this request."
            }
          />
        </Modal>
      </div>

      {/* PDF MODAL */}
      <CtoApplicationPdfModal
        app={application}
        isOpen={isPdfOpen}
        onClose={() => setIsPdfOpen(false)}
      />
    </div>
  );
};

export default CtoApplicationDetails;
