import React, { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../breadCrumbs";
import {
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { resetMyPassword } from "../../api/employee";
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useAuth } from "../../store/authStore";

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ------------------ Accent helpers ------------------ */
function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function readCssVar(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function normalizeCssColor(input, fallback = "#2563eb") {
  if (typeof window === "undefined") return fallback;

  const el = document.createElement("div");
  el.style.color = input || fallback;
  el.style.position = "absolute";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);

  const resolved = getComputedStyle(el).color;
  document.body.removeChild(el);

  return resolved || fallback;
}

function parseRgbString(color) {
  const match = String(color).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
}

function rgbToString({ r, g, b }) {
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

function rgbaString({ r, g, b }, a) {
  return `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${a})`;
}

function mixRgb(base, target, amount) {
  return {
    r: Math.round(base.r + (target.r - base.r) * amount),
    g: Math.round(base.g + (target.g - base.g) * amount),
    b: Math.round(base.b + (target.b - base.b) * amount),
  };
}

/** Yup Schema */
const schema = yup.object().shape({
  oldPassword: yup.string().required("Current password is required"),
  newPassword: yup
    .string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
    .matches(/[a-z]/, "Password must contain at least one lowercase letter")
    .matches(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: yup
    .string()
    .required("Please confirm your new password")
    .oneOf([yup.ref("newPassword")], "Passwords must match"),
});

/* =========================
   Minimal UI Primitives
========================= */

const Card = ({ title, subtitle, children, className = "", borderColor }) => (
  <div
    className={[
      "rounded-3xl border shadow-sm transition-colors duration-300 ease-out",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor,
    }}
  >
    {(title || subtitle) && (
      <div className="px-6 pt-6 pb-2">
        {title && (
          <h3
            className="text-sm font-medium tracking-tight transition-colors duration-300 ease-out"
            style={{ color: "var(--app-text)" }}
          >
            {title}
          </h3>
        )}
        {subtitle && (
          <p
            className="text-xs mt-1 transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const Field = ({
  label,
  icon: Icon,
  type,
  placeholder,
  error,
  registerProps,
  showPassword,
  onToggle,
  borderColor,
}) => (
  <div className="space-y-1.5">
    <label
      className="text-xs font-medium transition-colors duration-300 ease-out"
      style={{ color: "var(--app-muted)" }}
    >
      {label}
    </label>

    <div className="relative">
      <div
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg border flex items-center justify-center transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor,
          color: "var(--app-muted)",
        }}
      >
        <Icon className="w-4 h-4" strokeWidth={1.8} />
      </div>

      <input
        type={type}
        placeholder={placeholder}
        {...registerProps}
        className="w-full h-11 pl-12 pr-11 rounded-xl text-sm outline-none transition-colors duration-200 ease-out border"
        style={{
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
          borderColor: error ? "rgba(244,63,94,0.45)" : borderColor,
          boxShadow: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error
            ? "rgba(244,63,94,0.60)"
            : "var(--accent)";
          e.currentTarget.style.boxShadow = error
            ? "0 0 0 3px rgba(244,63,94,0.14)"
            : "0 0 0 3px var(--accent-soft)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error
            ? "rgba(244,63,94,0.45)"
            : borderColor;
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg border transition-colors duration-200 ease-out"
        style={{
          color: "var(--app-muted)",
          backgroundColor: "transparent",
          borderColor: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--app-text)";
          e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
          e.currentTarget.style.borderColor = borderColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--app-muted)";
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }}
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>
    </div>

    {error && (
      <p
        className="text-xs flex items-center gap-2"
        style={{ color: "#f43f5e" }}
      >
        <AlertCircle className="w-4 h-4" />
        {error}
      </p>
    )}
  </div>
);

const Tip = ({ children, tone = "blue", resolvedTheme, borderColor }) => {
  const tones = {
    blue: {
      backgroundColor:
        resolvedTheme === "dark"
          ? "rgba(59,130,246,0.12)"
          : "rgba(59,130,246,0.08)",
      borderColor:
        resolvedTheme === "dark"
          ? "rgba(59,130,246,0.22)"
          : "rgba(59,130,246,0.16)",
      color: resolvedTheme === "dark" ? "#bfdbfe" : "#1d4ed8",
    },
    amber: {
      backgroundColor:
        resolvedTheme === "dark"
          ? "rgba(245,158,11,0.12)"
          : "rgba(245,158,11,0.10)",
      borderColor:
        resolvedTheme === "dark"
          ? "rgba(245,158,11,0.24)"
          : "rgba(245,158,11,0.20)",
      color: resolvedTheme === "dark" ? "#fcd34d" : "#92400e",
    },
  };

  const toneStyle = tones[tone];

  return (
    <div
      className="rounded-2xl p-5 border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: toneStyle.backgroundColor,
        borderColor: toneStyle.borderColor || borderColor,
        color: toneStyle.color,
      }}
    >
      <div className="flex gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 opacity-90 mt-0.5" />
        <p className="text-xs leading-relaxed font-semibold">{children}</p>
      </div>
    </div>
  );
};

const GuideItem = ({ children, textColor = "rgba(255,255,255,0.92)" }) => (
  <li className="flex items-start gap-2 text-sm" style={{ color: textColor }}>
    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
    <span className="leading-snug">{children}</span>
  </li>
);

/* =========================
   Main
========================= */

const ResetPassword = () => {
  const navigate = useNavigate();
  const [showPasswords, setShowPasswords] = useState(false);

  const preferences = useAuth((s) => s.preferences || {});
  const prefTheme = preferences.theme || "system";
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const guidePalette = useMemo(() => {
    const fallbackRgb = { r: 37, g: 99, b: 235 };
    const accentValue = readCssVar("--accent", "#2563eb");
    const normalized = normalizeCssColor(accentValue, "#2563eb");
    const accentRgb = parseRgbString(normalized) || fallbackRgb;

    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };

    const topBg =
      resolvedTheme === "dark"
        ? mixRgb(accentRgb, white, 0.04)
        : mixRgb(accentRgb, white, 0.02);

    const bottomStart =
      resolvedTheme === "dark"
        ? mixRgb(accentRgb, black, 0.22)
        : mixRgb(accentRgb, black, 0.14);

    const bottomEnd =
      resolvedTheme === "dark"
        ? mixRgb(accentRgb, black, 0.34)
        : mixRgb(accentRgb, black, 0.24);

    return {
      border: rgbaString(accentRgb, resolvedTheme === "dark" ? 0.26 : 0.18),
      topBackground: rgbToString(topBg),
      bottomBackground: `linear-gradient(180deg, ${rgbToString(bottomStart)}, ${rgbToString(bottomEnd)})`,
      iconColor: "rgba(255,255,255,0.82)",
      subText: "rgba(255,255,255,0.84)",
      listText: "rgba(255,255,255,0.92)",
    };
  }, [preferences, resolvedTheme]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: resetMyPassword,
    onSuccess: (data) => {
      toast.success(data?.message || "Password updated successfully!", {
        position: "top-right",
        autoClose: 2500,
      });
      navigate("/app/my-profile");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || "Failed to reset password", {
        position: "top-right",
        autoClose: 3000,
      });
    },
  });

  const onSubmit = (data) => {
    mutation.mutate({
      oldPassword: data.oldPassword,
      newPassword: data.newPassword,
    });
  };

  const busy = isSubmitting || mutation.isPending;

  return (
    <div
      className="px-1 py-2 min-h-[calc(100vh-5rem)] transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div>
        <div className="space-y-4">
          <Breadcrumbs rootLabel="Home" rootTo="/app" />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 max-w-6xl mx-auto">
            <div>
              <h1
                className="text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                Reset Password
              </h1>
              <p
                className="text-sm mt-1 transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
                Update your password to keep your account secure.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-4">
            <div
              className="rounded-3xl overflow-hidden shadow-sm border transition-colors duration-300 ease-out"
              style={{ borderColor: guidePalette.border }}
            >
              <div
                className="p-6 text-white"
                style={{ backgroundColor: guidePalette.topBackground }}
              >
                <ShieldCheck
                  className="w-8 h-8"
                  style={{ color: guidePalette.iconColor }}
                />
                <h3 className="mt-4 text-lg font-semibold">Password Guide</h3>
                <p
                  className="text-sm mt-1"
                  style={{ color: guidePalette.subText }}
                >
                  Simple rules to keep your account safe.
                </p>
              </div>

              <div
                className="p-6"
                style={{ background: guidePalette.bottomBackground }}
              >
                <ul className="space-y-3">
                  <GuideItem textColor={guidePalette.listText}>
                    Must be at least 8 characters long.
                  </GuideItem>
                  <GuideItem textColor={guidePalette.listText}>
                    Include at least one uppercase letter.
                  </GuideItem>
                  <GuideItem textColor={guidePalette.listText}>
                    Include at least one lowercase letter.
                  </GuideItem>
                  <GuideItem textColor={guidePalette.listText}>
                    Include at least one number.
                  </GuideItem>
                </ul>
              </div>
            </div>

            <Tip
              tone="amber"
              resolvedTheme={resolvedTheme}
              borderColor={borderColor}
            >
              You may be required to log in again on all devices after changing
              your password.
            </Tip>
          </div>

          <div className="lg:col-span-8">
            <Card
              title="Change Password"
              subtitle="Enter your current password, then choose a new one."
              borderColor={borderColor}
            >
              <form
                id="resetPwForm"
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
                noValidate
              >
                <Field
                  label="Current Password"
                  icon={Lock}
                  type={showPasswords ? "text" : "password"}
                  placeholder="Enter current password"
                  error={errors.oldPassword?.message}
                  registerProps={register("oldPassword")}
                  showPassword={showPasswords}
                  onToggle={() => setShowPasswords((s) => !s)}
                  borderColor={borderColor}
                />

                <div
                  className="h-px my-1 transition-colors duration-300 ease-out"
                  style={{ backgroundColor: borderColor }}
                />

                <Field
                  label="New Password"
                  icon={Lock}
                  type={showPasswords ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  error={errors.newPassword?.message}
                  registerProps={register("newPassword")}
                  showPassword={showPasswords}
                  onToggle={() => setShowPasswords((s) => !s)}
                  borderColor={borderColor}
                />

                <Field
                  label="Confirm New Password"
                  icon={Lock}
                  type={showPasswords ? "text" : "password"}
                  placeholder="Repeat new password"
                  error={errors.confirmPassword?.message}
                  registerProps={register("confirmPassword")}
                  showPassword={showPasswords}
                  onToggle={() => setShowPasswords((s) => !s)}
                  borderColor={borderColor}
                />

                <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setShowPasswords((s) => !s)}
                    className="inline-flex items-center gap-2 text-xs font-semibold transition-colors duration-200 ease-out w-fit"
                    style={{ color: "var(--app-muted)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--app-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--app-muted)";
                    }}
                  >
                    {showPasswords ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        Hide passwords
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        Show passwords
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "#fff",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.10)",
                    }}
                    onMouseEnter={(e) => {
                      if (busy) return;
                      e.currentTarget.style.filter = "brightness(0.95)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "none";
                    }}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Reset Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
