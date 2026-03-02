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
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import MemoList from "../ctoMemoModal";
import { buildApiUrl } from "../../../config/env";

import CtoApplicationPdfModal from "../ctoApplicationComponents/ctoApplicationPDFModal";

/* =========================
   LOADING SKELETON (FULL SCREEN INSIDE CARD)
========================= */
const CtoApplicationDetailsSkeleton = () => (
  <div
    className="flex-1 h-full bg-white rounded-xl shadow-md w-full flex flex-col gap-2 max-w-6xl mx-auto min-w-0 border border-gray-200"
    aria-busy="true"
    aria-label="Loading application details"
  >
    {/* HEADER */}
    <header className="flex md:rounded-t-xl flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-300 backdrop-blur supports-[backdrop-filter]:bg-white px-3 sm:px-4 py-2 z-10">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* avatar */}
          <Skeleton height={48} width={48} borderRadius={12} />
          <div className="min-w-0 flex-1">
            {/* name */}
            <Skeleton height={18} width={"55%"} />
            {/* meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Skeleton height={18} width={110} borderRadius={999} />
              <Skeleton height={18} width={120} borderRadius={999} />
              <Skeleton height={18} width={90} borderRadius={999} />
            </div>
          </div>
        </div>
      </div>

      {/* action buttons */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 pt-1 bg-transparent rounded-xl w-full md:w-auto">
        <Skeleton
          height={40}
          width={110}
          borderRadius={12}
          className="w-full sm:w-auto"
        />
        <Skeleton
          height={40}
          width={160}
          borderRadius={12}
          className="w-full sm:w-auto"
        />
      </div>
    </header>

    {/* CONTENT */}
    <div className="flex h-full flex-1 min-h-0 overflow-y-auto flex-col gap-4 px-3 sm:px-4 py-2">
      {/* QUICK STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
        {/* Requested Dates (big card) */}
        <div className="md:col-span-2 rounded-xl p-4 sm:p-6 relative overflow-hidden shadow-sm shadow-blue-100 min-w-0 bg-gradient-to-br from-blue-600 to-blue-700">
          <div className="absolute right-[-20px] top-[-20px] h-40 w-40 rounded-full bg-white/10" />
          <div className="relative z-10 flex gap-3 justify-between items-center min-w-0">
            <div className="min-w-0 flex-1">
              <Skeleton
                height={12}
                width={140}
                borderRadius={8}
                baseColor="#1d4ed8"
                highlightColor="#3b82f6"
              />
              <div className="mt-2">
                <Skeleton
                  height={26}
                  width={"85%"}
                  borderRadius={10}
                  baseColor="#1d4ed8"
                  highlightColor="#3b82f6"
                />
              </div>
              <div className="mt-2">
                <Skeleton
                  height={18}
                  width={"55%"}
                  borderRadius={10}
                  baseColor="#1d4ed8"
                  highlightColor="#3b82f6"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 flex-none">
              <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl">
                <Skeleton
                  height={10}
                  width={90}
                  borderRadius={8}
                  baseColor="#1d4ed8"
                  highlightColor="#3b82f6"
                />
                <div className="mt-2">
                  <Skeleton
                    height={22}
                    width={70}
                    borderRadius={10}
                    baseColor="#1d4ed8"
                    highlightColor="#3b82f6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Status (small card) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center text-center gap-4 min-w-0">
          <Skeleton height={56} width={56} borderRadius={18} />
          <div className="text-start min-w-0 flex-1">
            <Skeleton height={12} width={120} borderRadius={8} />
            <div className="mt-2">
              <Skeleton height={22} width={140} borderRadius={10} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        {/* MAIN */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {/* Purpose of Leave */}
          <section className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton height={40} width={40} borderRadius={12} />
              <Skeleton height={12} width={170} borderRadius={8} />
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
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

          {/* Timeline */}
          <section className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm min-w-0">
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
              <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-100" />

              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="relative flex gap-2 sm:gap-4 items-start min-w-0"
                >
                  <div className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 border-white shadow-md flex-none bg-gray-100">
                    <Skeleton height={16} width={16} borderRadius={6} />
                  </div>

                  <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xs min-w-0">
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
                        <Skeleton height={22} width={90} borderRadius={999} />
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

        {/* SIDEBAR */}
        <aside className="space-y-4 min-w-0">
          <div className="bg-white border border-gray-200 rounded-xl p-2 sm:p-3 shadow-sm min-w-0">
            <div className="flex items-center justify-between gap-3">
              <Skeleton height={12} width={120} borderRadius={8} />
            </div>

            {/* Application Form button */}
            <div className="mt-3">
              <Skeleton height={46} borderRadius={12} />
            </div>

            {/* Supporting Memos header */}
            <div className="mt-5 md:mt-7 flex items-center justify-between gap-3">
              <Skeleton height={12} width={150} borderRadius={8} />
              <Skeleton height={18} width={28} borderRadius={999} />
            </div>

            {/* memo items */}
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 border border-transparent"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Skeleton height={32} width={32} borderRadius={10} />
                    <div className="min-w-0 flex-1">
                      <Skeleton height={14} width={"60%"} borderRadius={8} />
                      <div className="mt-2">
                        <Skeleton height={11} width={"45%"} borderRadius={8} />
                      </div>
                    </div>
                  </div>
                  <Skeleton height={14} width={14} borderRadius={4} />
                </div>
              ))}
            </div>

            {/* View all memos button */}
            <div className="mt-3">
              <Skeleton height={42} borderRadius={12} />
            </div>
          </div>

          {/* Calendar skeleton card */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm min-w-0">
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
        </aside>
      </div>
    </div>
  </div>
);

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
   Status helpers (CANCELLED-aware)
========================= */
const STATUS_META = {
  APPROVED: { label: "APPROVED", tone: "emerald" },
  REJECTED: { label: "REJECTED", tone: "rose" },
  PENDING: { label: "PENDING", tone: "amber" },
  CANCELLED: { label: "CANCELLED", tone: "slate" },
};

const getToneClasses = (tone) => {
  switch (tone) {
    case "emerald":
      return {
        pill: "bg-emerald-50 text-emerald-700 border-emerald-100",
        chip: "bg-emerald-50 text-emerald-700",
        iconWrap: "bg-emerald-50 text-emerald-600",
      };
    case "rose":
      return {
        pill: "bg-rose-50 text-rose-700 border-rose-100",
        chip: "bg-rose-50 text-rose-700",
        iconWrap: "bg-rose-50 text-rose-600",
      };
    case "slate":
      return {
        pill: "bg-slate-50 text-slate-700 border-slate-200",
        chip: "bg-slate-50 text-slate-700",
        iconWrap: "bg-slate-50 text-slate-600",
      };
    case "amber":
    default:
      return {
        pill: "bg-amber-50 text-amber-700 border-amber-100",
        chip: "bg-amber-50 text-amber-700",
        iconWrap: "bg-amber-50 text-amber-600",
      };
  }
};

/* =========================
   Timeline helpers (DESIGN ONLY)
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
  return "bg-gray-200";
};

// --- Helper: Timeline Card (Updated design only) ---
const TimelineCard = ({ approval, index, isLast }) => {
  const status = String(approval?.status || "").toUpperCase();
  const isDenied = status === "REJECTED";
  const isPending = status === "PENDING";
  const isCancelled = status === "CANCELLED";

  return (
    <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-100" />
      )}

      <div
        className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-transform hover:scale-110 flex-none ${StepDotClass(
          status,
        )}`}
        title={status}
      >
        <StepDotIcon status={status} />
      </div>

      <div
        className={`flex-1 bg-white border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 transition-all ${
          isPending ? "border-gray-100 opacity-90" : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Approver {index + 1}
              </span>
            </div>

            <p className="text-sm font-semibold text-gray-900 break-words mt-1">
              {approval.approver?.firstName} {approval.approver?.lastName}
            </p>

            <p className="text-xs text-blue-700 font-medium break-words">
              {approval.approver?.position || "Approver"}
            </p>
          </div>

          <div className="flex-none">
            <StatusBadge status={status} size="sm" />
          </div>
        </div>

        {isCancelled && !approval?.remarks ? (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2 min-w-0">
            <Ban size={14} className="shrink-0 mt-0.5" />
            <p className="break-words">
              <strong>Auto-cancelled:</strong> A previous approver rejected this
              request.
            </p>
          </div>
        ) : null}

        {approval?.remarks && String(approval.remarks).trim() !== "" && (
          <div
            className={`mt-4 rounded-xl p-3 text-xs leading-relaxed border flex items-start gap-2 min-w-0 ${
              isDenied
                ? "bg-red-50 border-red-100 text-red-700"
                : isCancelled
                  ? "bg-slate-50 border-slate-200 text-slate-700"
                  : "bg-gray-50 border-gray-200 text-gray-700"
            }`}
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
   Calendar helpers + component
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
    // jump calendar to earliest requested month whenever dates change
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

    // Sunday=0 ... Saturday=6
    const leadingBlanks = first.getDay();
    const daysInMonth = last.getDate();

    const cells = [];

    // leading empty cells
    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({ type: "blank", key: `b-${i}` });
    }

    // day cells
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

    // trailing blanks to complete rows (optional but makes layout even)
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
      const d = new Date(k);
      // if parsing "YYYY-MM-DD" becomes UTC in some environments, we still handle via split:
      const [yy, mm] = k.split("-").map((x) => Number(x));
      if (!yy || !mm) return;
      const monthIdx = mm - 1;
      if (yy === y && monthIdx === m) count += 1;
    });
    return count;
  }, [requestedKeys, viewMonth]);

  const hasAnyDates = requestedKeys.size > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2 sm:p-3 shadow-sm min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
            Calendar
          </h4>
          <p className="text-[11px] text-gray-500 font-medium">
            Requested dates highlighted
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-none">
          <button
            type="button"
            onClick={() => setViewMonth((d) => addMonths(d, -1))}
            className="h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            title="Previous month"
          >
            <ChevronLeft size={16} className="text-gray-700" />
          </button>

          <button
            type="button"
            onClick={() => setViewMonth((d) => addMonths(d, 1))}
            className="h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            title="Next month"
          >
            <ChevronRight size={16} className="text-gray-700" />
          </button>

          <button
            type="button"
            disabled={!earliestRequested}
            onClick={() =>
              earliestRequested && setViewMonth(startOfMonth(earliestRequested))
            }
            className={`h-9 px-2.5 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 inline-flex items-center gap-1.5 ${
              earliestRequested
                ? "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                : "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
            }`}
            title="Jump to requested month"
          >
            <RotateCcw size={14} />
            <span className="text-[11px] font-bold">Reset</span>
          </button>
        </div>
      </div>

      <div className="mt-3 flex md:flex-col items-center md:items-start justify-between gap-2">
        <div className="inline-flex items-center gap-2 min-w-0">
          <span className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 flex-none">
            <CalendarDays size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">
              {monthLabel}
            </p>
            <p className="text-[11px] text-gray-500 font-medium">
              {hasAnyDates
                ? `${requestedCountThisMonth} requested day${
                    requestedCountThisMonth === 1 ? "" : "s"
                  } this month`
                : "No requested dates"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-none">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            Requested
          </span>
        </div>
      </div>

      <div className="mt-3">
        {/* Day names */}
        <div className="grid grid-cols-7 gap-1.5">
          {dayNames.map((dn) => (
            <div
              key={dn}
              className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center py-1"
            >
              {dn}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
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
            const requested =
              "bg-blue-600 text-white border-blue-600 shadow-sm";
            const normal =
              "bg-white text-gray-800 border-gray-200 hover:bg-gray-50";
            const todayRing = "ring-2 ring-blue-200 ring-offset-2";

            return (
              <div
                key={cell.key || `d-${idx}`}
                className={[
                  base,
                  cell.isRequested ? requested : normal,
                  cell.isToday ? todayRing : "",
                ].join(" ")}
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
          <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-center">
            <p className="text-xs text-gray-500 font-medium">
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isXlUp = useIsXlUp();

  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  // ✅ PDF modal state
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

  // ✅ IMPORTANT: keep hooks above any early return
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

  // Approve mutation
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

  // Reject mutation
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

  // --------- EARLY RETURNS ----------
  if (isLoading) return <CtoApplicationDetailsSkeleton />;
  if (isError) return <p>Error: {error?.message}</p>;

  if (!application)
    return (
      <div className="flex flex-col items-center justify-center py-40 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 m-4 sm:m-6">
        <FileText className="h-10 w-10 text-gray-300" />
        <h3 className="text-gray-900 font-semibold">No Application Found</h3>
      </div>
    );

  const initials = `${application.employee?.firstName?.[0] || ""}${
    application.employee?.lastName?.[0] || ""
  }`;

  // ✅ currentStep find should be robust: id can be string or objectId-like
  const currentStep = application.approvals?.find(
    (step) => String(step.approver?._id) === String(admin?.id),
  );

  // ✅ Only allow action if:
  // - my step is PENDING
  // - app overallStatus is PENDING
  // - not locally processed
  const canApproveOrReject =
    currentStep?.status === "PENDING" &&
    application.overallStatus === "PENDING" &&
    !isProcessed;

  const overallMeta =
    STATUS_META[application.overallStatus] || STATUS_META.PENDING;
  const overallTone = getToneClasses(overallMeta.tone);

  const memos = Array.isArray(application.memo) ? application.memo : [];
  const memoCount = memos.length;

  return (
    <div className="flex-1 h-full border border-gray-200 bg-white rounded-xl shadow-md w-full flex flex-col gap-2 max-w-6xl mx-auto min-w-0 border-b-26 border-neutral-50/50">
      {/* HEADER */}
      <header className="flex md:rounded-t-xl flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-300 backdrop-blur supports-[backdrop-filter]:bg-white px-3 sm:px-4 py-2 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg flex-none">
              {initials}
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">
                {application.employee?.firstName}{" "}
                {application.employee?.lastName}
              </h2>

              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 font-medium mt-0.5">
                <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  ID: {application.employee?.employeeId || "N/A"}
                </span>

                <span className="flex items-center gap-1">
                  <Clock size={12} />{" "}
                  {new Date(application.createdAt).toLocaleDateString()}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${overallTone.pill}`}
                  title="Overall Status"
                >
                  {application.overallStatus === "CANCELLED" ? (
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
                className="w-full sm:w-auto flex-1 md:flex-none px-4 bg-gray-200 py-2 rounded-lg text-gray-600 hover:bg-gray-300 font-semibold"
              >
                Reject
              </button>

              <button
                onClick={() => {
                  setModalType("approve");
                  setIsModalOpen(true);
                }}
                disabled={approveMutation.isPending}
                className="w-full sm:w-auto bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition shadow-sm font-medium flex items-center justify-center gap-2"
              >
                {approveMutation.isPending
                  ? "Processing..."
                  : "Approve Request"}
              </button>
            </>
          ) : (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border border-emerald-100 w-full sm:w-auto">
              <BadgeCheck size={18} /> Action Completed
            </div>
          )}
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex h-full flex-1 min-h-0 overflow-y-auto flex-col gap-4 px-3 sm:px-4 py-2">
        {/* QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
          <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white flex gap-3 justify-between items-center relative overflow-hidden shadow-sm shadow-blue-100 min-w-0">
            <CalendarDays className="absolute right-[-20px] top-[-20px] h-40 w-40 text-white/10 rotate-12" />
            <div className="min-w-0">
              <p className="text-blue-50 text-xs font-bold uppercase tracking-widest mb-1">
                Requested Dates
              </p>
              <h3 className="text-xl md:text-2xl font-bold break-words">
                {requestedDatesLabel}
              </h3>
            </div>

            <div className="flex items-center gap-4 flex-none">
              <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl">
                <p className="text-[10px] text-blue-100 uppercase font-bold">
                  Total Duration
                </p>
                <p className="text-xl font-bold">
                  {application.requestedHours} Hours
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center text-center gap-4 min-w-0">
            <div
              className={`p-4 rounded-2xl ${
                application.overallStatus === "APPROVED"
                  ? "bg-emerald-50 text-emerald-600"
                  : application.overallStatus === "REJECTED"
                    ? "bg-rose-50 text-rose-600"
                    : application.overallStatus === "CANCELLED"
                      ? "bg-slate-50 text-slate-600"
                      : "bg-amber-50 text-amber-600"
              }`}
            >
              {application.overallStatus === "CANCELLED" ? (
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
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Global Status
              </p>
              <p className="text-xl font-black text-gray-900 break-words">
                {application.overallStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <section className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm min-w-0">
              <div className="flex items-center gap-3 mb-6">
                <span className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-none">
                  <MessageCircle size={20} />
                </span>
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                  Purpose of Leave
                </h3>
              </div>

              <p className="text-gray-700 leading-relaxed italic bg-gray-50 p-4 rounded-2xl border border-gray-100 break-words">
                "
                {application.reason ||
                  "No specific reason provided by the applicant."}
                "
              </p>
            </section>

            {/* Timeline */}
            <section className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm min-w-0">
              <div className="flex items-center gap-3 mb-6">
                <span className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 flex-none">
                  <History size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                    Processing Timeline
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Step-by-step approval progress
                  </p>
                </div>
              </div>

              {sortedApprovals.length > 0 ? (
                <div className="relative space-y-6 sm:space-y-8 t-1 min-w-0">
                  <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-100" />

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
                      <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-emerald-800 font-bold text-sm">
                          Application Fully Approved
                        </p>
                        <p className="text-emerald-600 text-xs mt-0.5">
                          The CTO request has been finalized.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-white border border-dashed border-slate-300 rounded-xl text-center">
                  <Users size={32} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">
                    Waiting for workflow initiation
                  </p>
                  <p className="text-slate-400 text-sm">
                    No approvers have acted on this request yet.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* SIDEBAR (Documents + Calendar) */}
          <aside className="space-y-4 min-w-0">
            <RequestedDatesCalendar dates={application?.inclusiveDates || []} />
            <div className="bg-white border border-gray-200 rounded-xl p-2 sm:p-3 shadow-sm min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                  Documents
                </h4>
              </div>

              {/* Application Form */}
              <button
                type="button"
                onClick={() => setIsPdfOpen(true)}
                className="mt-3 w-full inline-flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
                title="View Application PDF"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="h-8 w-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600 flex-none border border-red-100">
                    <FileText size={16} />
                  </span>
                  <span className="truncate">Application Form</span>
                </span>

                <span className="text-[9px] font-bold text-gray-500 border border-gray-200 bg-gray-50 px-2 py-1 rounded-lg flex-none">
                  PDF
                </span>
              </button>

              {/* Supporting Memos */}
              <div className="mt-5 md:mt-7 flex items-center justify-between gap-3">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                  Supporting Memos
                </h4>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold flex-none">
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
                      className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition min-w-0"
                      title={`Open Memo ${m.memoId?.memoNo}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600 flex-none border border-red-100">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            Memo {m.memoId?.memoNo || "—"}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            Click to open
                          </p>
                        </div>
                      </div>

                      <ExternalLink
                        size={14}
                        className="text-gray-400 group-hover:text-blue-600 transition flex-none"
                      />
                    </a>
                  ))
                ) : (
                  <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center">
                    <p className="text-xs text-gray-500 font-medium">
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
                className={`mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-bold border transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  memoCount === 0
                    ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {memoCount === 0
                  ? "View all memos"
                  : `View all memos (${memoCount})`}
              </button>
            </div>

            {/* ✅ NEW: Calendar card */}
          </aside>
        </div>

        {/* MODALS */}
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
