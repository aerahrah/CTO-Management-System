// src/components/employees/employeeResetPassword.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  KeyRound,
  X,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageSquare,
} from "lucide-react";
import { adminResetEmployeePassword } from "../../api/employee";

/* =========================
   Utils
========================= */
const getErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.message ||
  "Failed to reset password. Please try again.";

const toneStyle = (tone, resolvedTheme) => {
  const isDark = resolvedTheme === "dark";

  const tones = {
    rose: {
      backgroundColor: isDark ? "rgba(244,63,94,0.14)" : "rgba(244,63,94,0.08)",
      color: isDark ? "#fda4af" : "#be123c",
      borderColor: isDark ? "rgba(244,63,94,0.28)" : "rgba(244,63,94,0.18)",
    },
    amber: {
      backgroundColor: isDark
        ? "rgba(245,158,11,0.14)"
        : "rgba(245,158,11,0.08)",
      color: isDark ? "#fcd34d" : "#b45309",
      borderColor: isDark ? "rgba(245,158,11,0.28)" : "rgba(245,158,11,0.18)",
    },
    emerald: {
      backgroundColor: isDark
        ? "rgba(16,185,129,0.14)"
        : "rgba(16,185,129,0.08)",
      color: isDark ? "#6ee7b7" : "#047857",
      borderColor: isDark ? "rgba(16,185,129,0.28)" : "rgba(16,185,129,0.18)",
    },
    slate: {
      backgroundColor: isDark
        ? "rgba(148,163,184,0.14)"
        : "rgba(148,163,184,0.10)",
      color: isDark ? "#cbd5e1" : "#475569",
      borderColor: isDark ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.18)",
    },
  };

  return tones[tone] || tones.slate;
};

/* =========================
   Main: EmployeeResetPassword
   Props:
   - open: boolean
   - onClose: () => void
   - employee: { name, email, phone }
   - borderColor, resolvedTheme: from the parent page theme
========================= */
const EmployeeResetPassword = ({
  open,
  onClose,
  employee,
  borderColor = "rgba(15,23,42,0.10)",
  resolvedTheme = "light",
}) => {
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => adminResetEmployeePassword(employee?.email, notify),
    onSuccess: (res) => {
      setResult({ ...(res?.data || {}), notifyRequested: notify });
      toast.success(res?.message || "Password reset successfully.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Works with TanStack Query v5 (isPending) and v4 (isLoading)
  const isPending = mutation.isPending ?? mutation.isLoading;

  const handleClose = () => {
    if (isPending) return;
    // Clear everything so the temp password never stays in memory
    setResult(null);
    setNotify(true);
    setCopied(false);
    mutation.reset();
    onClose?.();
  };

  // Escape to close + lock page scroll while open
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPending]);

  const handleCopy = async () => {
    if (!result?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      toast.success("Temporary password copied", {
        autoClose: 900,
        position: "bottom-center",
      });
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Copy failed. Please copy it manually.");
    }
  };

  if (!open) return null;

  const name = employee?.name || employee?.email || "this employee";
  const hasPhone = Boolean(employee?.phone);

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{ backgroundColor: "rgba(15,23,42,0.45)" }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--app-surface)",
          border: `1px solid ${borderColor}`,
          boxShadow: "0 20px 50px rgba(15,23,42,0.25)",
          color: "var(--app-text)",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-start justify-between gap-3 border-b"
          style={{ borderColor }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="p-2 rounded-xl border shrink-0"
              style={toneStyle("rose", resolvedTheme)}
            >
              <KeyRound size={18} />
            </div>
            <div className="min-w-0">
              <h2
                id="reset-password-title"
                className="text-base font-semibold"
                style={{ color: "var(--app-text)" }}
              >
                Reset Password
              </h2>
              <p
                className="text-xs mt-0.5 truncate"
                style={{ color: "var(--app-muted)" }}
              >
                {name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="p-1.5 rounded-lg transition disabled:opacity-40"
            style={{ color: "var(--app-muted)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {!result ? (
            <ConfirmStep
              name={name}
              email={employee?.email}
              hasPhone={hasPhone}
              notify={notify}
              setNotify={setNotify}
              isPending={isPending}
              borderColor={borderColor}
              resolvedTheme={resolvedTheme}
            />
          ) : (
            <ResultStep
              result={result}
              email={employee?.email}
              hasPhone={hasPhone}
              copied={copied}
              onCopy={handleCopy}
              borderColor={borderColor}
              resolvedTheme={resolvedTheme}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t"
          style={{ borderColor, backgroundColor: "var(--app-surface-2)" }}
        >
          {!result ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border transition disabled:opacity-50"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor,
                  color: "var(--app-text)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={isPending || !employee?.email}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition disabled:opacity-60"
                style={{ backgroundColor: "#e11d48", color: "#fff" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = "brightness(0.95)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "none";
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    Reset Password
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition"
              style={{ backgroundColor: "var(--accent)", color: "#fff" }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

/* =========================
   Step 1: Confirm
========================= */
const ConfirmStep = ({
  name,
  email,
  hasPhone,
  notify,
  setNotify,
  isPending,
  borderColor,
  resolvedTheme,
}) => (
  <>
    <p className="text-sm leading-relaxed" style={{ color: "var(--app-text)" }}>
      This replaces <span className="font-semibold">{name}</span>'s current
      password with a new temporary password. They will be signed out and asked
      to set a new password the next time they log in.
    </p>

    <div
      className="rounded-xl border px-4 py-3"
      style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
    >
      <div className="text-xs" style={{ color: "var(--app-muted)" }}>
        Account email
      </div>
      <div
        className="text-sm font-medium break-all"
        style={{ color: "var(--app-text)" }}
      >
        {email || "-"}
      </div>
    </div>

    <label
      className="flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer select-none"
      style={{ borderColor }}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ accentColor: "var(--accent)" }}
        checked={notify}
        disabled={isPending}
        onChange={(e) => setNotify(e.target.checked)}
      />
      <span className="min-w-0">
        <span
          className="block text-sm font-medium"
          style={{ color: "var(--app-text)" }}
        >
          Send the temporary password to the employee
        </span>
        <span
          className="block text-xs mt-0.5"
          style={{ color: "var(--app-muted)" }}
        >
          {hasPhone ? "By email and SMS" : "By email"} — you won't see the
          password yourself.
        </span>
      </span>
    </label>

    {!notify && (
      <div
        className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-relaxed"
        style={toneStyle("amber", resolvedTheme)}
      >
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>
          The temporary password will be shown to you once. Give it to the
          employee in person or through a secure channel.
        </span>
      </div>
    )}
  </>
);

/* =========================
   Step 2: Result
========================= */
const ResultStep = ({
  result,
  email,
  hasPhone,
  copied,
  onCopy,
  borderColor,
  resolvedTheme,
}) => {
  const delivered = result?.delivered || {};
  const showPassword = Boolean(result?.tempPassword);
  const deliveryFailed = result?.notifyRequested && showPassword;

  if (showPassword) {
    return (
      <>
        {deliveryFailed && (
          <div
            className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-relaxed"
            style={toneStyle("rose", resolvedTheme)}
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              The password was reset, but we couldn't send it by email
              {hasPhone ? " or SMS" : ""}. Give it to the employee yourself.
            </span>
          </div>
        )}

        <div>
          <div className="text-xs mb-1.5" style={{ color: "var(--app-muted)" }}>
            Temporary password
          </div>
          <div
            className="flex items-center justify-between gap-2 rounded-xl border pl-4 pr-1.5 py-1.5"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <code
              className="text-base font-mono tracking-wide break-all"
              style={{ color: "var(--app-text)" }}
            >
              {result.tempPassword}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor,
                color: "var(--app-text)",
              }}
              aria-label="Copy temporary password"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--app-muted)" }}
        >
          This is the only time it will be shown. The employee will be asked to
          change it after logging in.
        </p>
      </>
    );
  }

  return (
    <>
      <div
        className="flex items-start gap-3 rounded-xl border px-4 py-3"
        style={toneStyle("emerald", resolvedTheme)}
      >
        <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
        <div className="text-sm leading-relaxed">
          Password reset. A temporary password was sent to the employee.
        </div>
      </div>

      <div className="space-y-2">
        <DeliveryRow
          icon={<Mail size={16} />}
          label="Email"
          detail={email}
          ok={delivered.email}
          borderColor={borderColor}
          resolvedTheme={resolvedTheme}
        />
        {hasPhone && (
          <DeliveryRow
            icon={<MessageSquare size={16} />}
            label="SMS"
            detail="Registered phone number"
            ok={delivered.sms}
            borderColor={borderColor}
            resolvedTheme={resolvedTheme}
          />
        )}
      </div>
    </>
  );
};

const DeliveryRow = ({
  icon,
  label,
  detail,
  ok,
  borderColor,
  resolvedTheme,
}) => (
  <div
    className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
    style={{ borderColor }}
  >
    <div className="flex items-center gap-3 min-w-0">
      <span style={{ color: "var(--app-muted)" }}>{icon}</span>
      <div className="min-w-0">
        <div
          className="text-sm font-medium"
          style={{ color: "var(--app-text)" }}
        >
          {label}
        </div>
        {detail && (
          <div
            className="text-xs truncate"
            style={{ color: "var(--app-muted)" }}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
    <span
      className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
      style={toneStyle(ok ? "emerald" : "slate", resolvedTheme)}
    >
      {ok ? "Sent" : "Not sent"}
    </span>
  </div>
);

export default EmployeeResetPassword;
