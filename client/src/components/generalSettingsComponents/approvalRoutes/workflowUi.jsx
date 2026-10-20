// workflowUi.jsx
// Shared UI pieces for the approval-workflow pages. Same look as approvalRoutesList.jsx.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronDown, Check } from "lucide-react";
import { fetchApprovers } from "../../../api/cto";
import { fetchApprovalRoles } from "../../../api/approvalRoute";

/* =========================
   Helpers
========================= */
export const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

export const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

export const formatFullName = (emp) => {
  if (!emp) return "Unknown";
  const prefix = emp.prefixTitle ? `${emp.prefixTitle.trim()} ` : "";
  const first = emp.firstName ? `${emp.firstName.trim()} ` : "";
  const middleInitial = emp.middleName
    ? `${emp.middleName.trim().charAt(0).toUpperCase()}. `
    : "";
  const last = emp.lastName ? `${emp.lastName.trim()}` : "";
  const extension = emp.nameExtension ? ` ${emp.nameExtension.trim()}` : "";
  const postfix = emp.postfixTitle ? `, ${emp.postfixTitle.trim()}` : "";
  return (
    `${prefix}${first}${middleInitial}${last}${extension}${postfix}`.trim() ||
    "Unknown"
  );
};

export const initialsOf = (emp) =>
  `${emp?.firstName?.trim()?.[0] || ""}${emp?.lastName?.trim()?.[0] || ""}`.toUpperCase() ||
  "?";

export const idOf = (v) => String(v?._id || v || "");

export const newKey = () => Math.random().toString(36).slice(2, 11);

/** Debounced copy of a value (for search boxes). */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* =========================
   Theme
========================= */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

export function useResolvedTheme(prefTheme) {
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

/** { theme, borderColor, inputBg } — pass this object to the components below. */
export function useThemeTokens(prefTheme) {
  const theme = useResolvedTheme(prefTheme);
  return useMemo(
    () => ({
      theme,
      borderColor:
        theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.10)",
      inputBg:
        theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
    }),
    [theme],
  );
}

export const CHIP_TONES = {
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
  blue: {
    bg: "rgba(59,130,246,0.12)",
    fg: "#3b82f6",
    br: "rgba(59,130,246,0.22)",
  },
  violet: {
    bg: "rgba(139,92,246,0.12)",
    fg: "#8b5cf6",
    br: "rgba(139,92,246,0.22)",
  },
  amber: {
    bg: "rgba(245,158,11,0.14)",
    fg: "#d97706",
    br: "rgba(245,158,11,0.26)",
  },
  red: {
    bg: "rgba(239,68,68,0.10)",
    fg: "#ef4444",
    br: "rgba(239,68,68,0.22)",
  },
  neutral: {
    bg: "var(--app-surface-2)",
    fg: "var(--app-muted)",
    br: "var(--app-border, rgba(15,23,42,0.10))",
  },
};

const NOTICE_TONES = (theme) => {
  const isDark = theme === "dark";
  return {
    amber: isDark
      ? {
          bg: "rgba(245,158,11,0.12)",
          br: "rgba(245,158,11,0.20)",
          title: "#fde68a",
          text: "#fcd34d",
          icon: "#fbbf24",
        }
      : {
          bg: "rgba(245,158,11,0.08)",
          br: "rgba(245,158,11,0.16)",
          title: "#92400e",
          text: "#b45309",
          icon: "#d97706",
        },
    blue: isDark
      ? {
          bg: "rgba(59,130,246,0.12)",
          br: "rgba(59,130,246,0.22)",
          title: "#bfdbfe",
          text: "#93c5fd",
          icon: "#60a5fa",
        }
      : {
          bg: "rgba(59,130,246,0.07)",
          br: "rgba(59,130,246,0.18)",
          title: "#1e3a8a",
          text: "#1d4ed8",
          icon: "#2563eb",
        },
    violet: isDark
      ? {
          bg: "rgba(139,92,246,0.12)",
          br: "rgba(139,92,246,0.22)",
          title: "#ddd6fe",
          text: "#c4b5fd",
          icon: "#a78bfa",
        }
      : {
          bg: "rgba(139,92,246,0.07)",
          br: "rgba(139,92,246,0.18)",
          title: "#4c1d95",
          text: "#6d28d9",
          icon: "#7c3aed",
        },
    neutral: isDark
      ? {
          bg: "rgba(255,255,255,0.04)",
          br: "rgba(255,255,255,0.08)",
          title: "var(--app-text)",
          text: "var(--app-muted)",
          icon: "var(--app-muted)",
        }
      : {
          bg: "rgba(15,23,42,0.03)",
          br: "rgba(15,23,42,0.08)",
          title: "#111827",
          text: "#4b5563",
          icon: "#6b7280",
        },
  };
};

/* =========================
   Primitives
========================= */
export const Card = ({ children, className = "", borderColor, style }) => (
  <div
    className={[
      "rounded-xl shadow-sm overflow-hidden transition-colors duration-300 ease-out",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const SectionHeader = ({
  icon: Icon,
  tone = "accent",
  title,
  subtitle,
  right,
}) => {
  const t = CHIP_TONES[tone] || CHIP_TONES.accent;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
          style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.br }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h3
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--app-muted)" }}
          >
            {title}
          </h3>
          {subtitle ? (
            <p
              className="text-xs font-medium mt-0.5"
              style={{ color: "var(--app-muted)" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {right}
    </div>
  );
};

/** Centered empty-state notice. */
export const SoftNotice = ({
  icon: Icon,
  tone = "neutral",
  title,
  children,
  theme,
  action,
}) => {
  const t = NOTICE_TONES(theme)[tone] || NOTICE_TONES(theme).neutral;
  return (
    <div
      className="rounded-xl px-4 py-8 flex flex-col items-center justify-center text-center gap-3"
      style={{ backgroundColor: t.bg, border: `1px solid ${t.br}` }}
    >
      <Icon className="w-8 h-8" style={{ color: t.icon }} />
      <div className="min-w-0">
        {title && (
          <div
            className="text-sm font-semibold mb-1"
            style={{ color: t.title }}
          >
            {title}
          </div>
        )}
        <div
          className="text-xs leading-relaxed max-w-md"
          style={{ color: t.text }}
        >
          {children}
        </div>
      </div>
      {action}
    </div>
  );
};

/** Left-aligned info strip. */
export const InfoStrip = ({
  icon: Icon,
  tone = "blue",
  title,
  children,
  theme,
  right,
}) => {
  const t = NOTICE_TONES(theme)[tone] || NOTICE_TONES(theme).neutral;
  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ backgroundColor: t.bg, border: `1px solid ${t.br}` }}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Icon className="w-5 h-5 flex-none mt-0.5" style={{ color: t.icon }} />
        <div className="min-w-0">
          {title && (
            <div className="text-sm font-semibold" style={{ color: t.title }}>
              {title}
            </div>
          )}
          {children && (
            <div
              className="text-xs leading-relaxed mt-0.5"
              style={{ color: t.text }}
            >
              {children}
            </div>
          )}
        </div>
      </div>
      {right ? (
        <div className="flex flex-wrap gap-2 sm:flex-none">{right}</div>
      ) : null}
    </div>
  );
};

export const PrimaryButton = ({
  children,
  disabled,
  onClick,
  className = "",
  borderColor,
  theme,
  type = "button",
  title,
}) => {
  const disabledBg =
    theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition hover:brightness-95",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "var(--accent)",
        color: disabled ? "var(--app-muted)" : "#ffffff",
        border: `1px solid ${disabled ? borderColor : "var(--accent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
};

export const OutlineButton = ({
  children,
  disabled,
  onClick,
  className = "",
  borderColor,
  theme,
  tone = "accent",
  title,
}) => {
  const disabledBg =
    theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";
  const color =
    tone === "danger"
      ? "#ef4444"
      : tone === "neutral"
        ? "var(--app-text)"
        : "var(--accent)";
  const border = tone === "neutral" ? borderColor : color;
  const hover =
    tone === "danger"
      ? "hover:bg-[rgba(239,68,68,0.08)]"
      : tone === "neutral"
        ? "hover:bg-[color:var(--app-surface-2)]"
        : "hover:bg-[color:var(--accent-soft)]";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors duration-200 ease-out",
        disabled ? "" : hover,
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : undefined,
        color: disabled ? "var(--app-muted)" : color,
        border: `1px solid ${disabled ? borderColor : border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
};

export const IconButton = ({
  children,
  onClick,
  disabled,
  title,
  tone = "neutral",
  borderColor,
}) => {
  const color =
    tone === "danger"
      ? "#ef4444"
      : tone === "accent"
        ? "var(--accent)"
        : "var(--app-muted)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-colors hover:bg-[color:var(--app-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color, borderColor, backgroundColor: "var(--app-surface)" }}
    >
      {children}
    </button>
  );
};

export const Toggle = ({
  checked,
  disabled,
  onChange,
  borderColor,
  theme,
  label,
}) => {
  const offBg =
    theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative inline-flex h-6 w-10 items-center rounded-full transition flex-none shrink-0"
      style={{
        backgroundColor: checked ? "var(--accent)" : offBg,
        border: `1px solid ${checked ? "var(--accent)" : borderColor}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        className={[
          "inline-block h-4 w-4 transform rounded-full shadow transition",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
        style={{ backgroundColor: "#ffffff" }}
      />
    </button>
  );
};

export const Checkbox = ({
  checked,
  indeterminate,
  onChange,
  disabled,
  label,
  borderColor,
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={indeterminate ? "mixed" : checked}
    aria-label={label}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onChange?.(!checked);
    }}
    className="h-4 w-4 rounded flex items-center justify-center flex-none border transition-colors disabled:opacity-40"
    style={{
      backgroundColor:
        checked || indeterminate ? "var(--accent)" : "var(--app-surface)",
      borderColor: checked || indeterminate ? "var(--accent)" : borderColor,
      color: "#fff",
    }}
  >
    {checked ? (
      <Check size={11} strokeWidth={3} />
    ) : indeterminate ? (
      <span className="block h-0.5 w-2 bg-white rounded" />
    ) : null}
  </button>
);

// size is in Tailwind units (9 = 2.25rem); inline so Tailwind doesn't need to see the class
export const Avatar = ({ initials, enabled = true, size = 9 }) => (
  <div
    className="rounded-full flex items-center justify-center font-bold flex-none"
    style={{
      width: `${size * 0.25}rem`,
      height: `${size * 0.25}rem`,
      fontSize: size <= 7 ? "10px" : "12px",
      backgroundColor: enabled ? "var(--accent-soft)" : "var(--app-surface-2)",
      color: enabled ? "var(--accent)" : "var(--app-muted)",
    }}
  >
    {initials}
  </div>
);

export const Chip = ({ tone = "accent", children, title, className = "" }) => {
  const t = CHIP_TONES[tone] || CHIP_TONES.accent;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}
      style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.br }}
    >
      {children}
    </span>
  );
};

/** personal / assigned / none */
export const SourceBadge = ({ source }) => {
  if (source === "personal") return <Chip tone="violet">Personal</Chip>;
  if (source === "assigned") return <Chip tone="blue">Default</Chip>;
  return <Chip tone="amber">No workflow</Chip>;
};

export const SkeletonLine = ({
  width = "100%",
  height = 16,
  theme,
  rounded = "rounded",
}) => (
  <div
    className={`${rounded} animate-pulse`}
    style={{
      width,
      height,
      backgroundColor:
        theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
    }}
  />
);

export const FieldLabel = ({ children, required, hint }) => (
  <div className="mb-1.5">
    <label
      className="text-xs font-bold uppercase tracking-wider"
      style={{ color: "var(--app-muted)" }}
    >
      {children} {required && <span className="text-red-500">*</span>}
    </label>
    {hint && (
      <p className="text-[11px] mt-0.5" style={{ color: "var(--app-muted)" }}>
        {hint}
      </p>
    )}
  </div>
);

export const TextInput = ({ tokens, className = "", ...props }) => (
  <input
    {...props}
    className={`w-full h-10 px-3 rounded-lg text-sm outline-none transition-colors focus:ring-2 focus:ring-[color:var(--accent-soft)] ${className}`}
    style={{
      backgroundColor: tokens.inputBg,
      border: `1px solid ${tokens.borderColor}`,
      color: "var(--app-text)",
    }}
  />
);

export const TextArea = ({ tokens, className = "", ...props }) => (
  <textarea
    {...props}
    className={`w-full px-3 py-2 rounded-lg text-sm outline-none resize-none transition-colors focus:ring-2 focus:ring-[color:var(--accent-soft)] ${className}`}
    style={{
      backgroundColor: tokens.inputBg,
      border: `1px solid ${tokens.borderColor}`,
      color: "var(--app-text)",
    }}
  />
);

export const SelectInput = ({ tokens, className = "", children, ...props }) => (
  <select
    {...props}
    className={`w-full h-10 px-3 rounded-lg text-sm outline-none transition-colors focus:ring-2 focus:ring-[color:var(--accent-soft)] disabled:opacity-60 ${className}`}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${tokens.borderColor}`,
      color: "var(--app-text)",
      colorScheme: tokens.theme === "dark" ? "dark" : "light",
    }}
  >
    {children}
  </select>
);

export const SearchBox = ({
  value,
  onChange,
  placeholder = "Search...",
  tokens,
  className = "",
  tall = false,
}) => (
  <div className={`relative ${className}`}>
    <Search
      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
      style={{ color: "var(--app-muted)" }}
    />
    <input
      type="text"
      value={value}
      maxLength={100}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full pl-8 pr-8 ${tall ? "h-10 text-sm" : "h-9 text-xs"} rounded-lg outline-none transition-colors duration-200 ease-out`}
      style={{
        backgroundColor: tokens.inputBg,
        border: `1px solid ${tokens.borderColor}`,
        color: "var(--app-text)",
      }}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange("")}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition hover:bg-[color:var(--app-surface-2)]"
        style={{ color: "var(--app-muted)" }}
        aria-label="Clear search"
      >
        <X size={12} />
      </button>
    )}
  </div>
);

/* =========================
   Employee picker (inline, so it never gets clipped inside a modal)
   options: [{ value, label, initials, position }]
========================= */
export const EmployeePicker = ({
  options,
  value,
  onChange,
  placeholder = "Select an employee...",
  disabledValues,
  disabledReason, // optional (value) => text shown for a disabled option
  tokens,
  disabled,
  loading,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const selected = options.find((o) => o.value === String(value || ""));

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    const list = term
      ? options.filter((o) =>
          `${o.label} ${o.position || ""}`.toLowerCase().includes(term),
        )
      : options;
    return list.slice(0, 60);
  }, [options, q]);

  return (
    <div ref={wrapRef} className="w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
        }}
        className="w-full min-h-10 px-3 py-1.5 rounded-lg text-sm flex items-center justify-between gap-2 text-left transition-colors disabled:opacity-60"
        style={{
          backgroundColor: tokens.inputBg,
          border: `1px solid ${open ? "var(--accent)" : tokens.borderColor}`,
          color: "var(--app-text)",
        }}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <Avatar initials={selected.initials} size={6} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate">
                {selected.label}
              </span>
              <span
                className="block text-[11px] truncate"
                style={{ color: "var(--app-muted)" }}
              >
                {selected.position}
              </span>
            </span>
          </span>
        ) : (
          <span style={{ color: "var(--app-muted)" }}>
            {loading ? "Loading..." : placeholder}
          </span>
        )}
        <ChevronDown
          size={16}
          style={{ color: "var(--app-muted)" }}
          className="flex-none"
        />
      </button>

      {open && (
        <div
          className="mt-1.5 rounded-lg border overflow-hidden"
          style={{
            borderColor: tokens.borderColor,
            backgroundColor: "var(--app-surface)",
          }}
        >
          <div
            className="p-2 border-b"
            style={{ borderColor: tokens.borderColor }}
          >
            <SearchBox
              value={q}
              onChange={setQ}
              placeholder="Search name or position..."
              tokens={tokens}
            />
          </div>
          <div className="max-h-56 overflow-y-auto cto-scrollbar py-1">
            {filtered.length === 0 ? (
              <div
                className="px-3 py-4 text-xs text-center"
                style={{ color: "var(--app-muted)" }}
              >
                No matches.
              </div>
            ) : (
              filtered.map((o) => {
                const isDisabled =
                  disabledValues?.has(o.value) &&
                  o.value !== String(value || "");
                const isSelected = o.value === String(value || "");
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-left transition-colors hover:bg-[color:var(--app-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: isSelected
                        ? "var(--accent-soft)"
                        : undefined,
                    }}
                  >
                    <Avatar
                      initials={o.initials}
                      size={7}
                      enabled={!isDisabled}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-sm font-semibold truncate"
                        style={{ color: "var(--app-text)" }}
                      >
                        {o.label}
                      </span>
                      <span
                        className="block text-[11px] truncate"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {isDisabled
                          ? disabledReason?.(o.value) ||
                            "Already in this workflow"
                          : o.position}
                      </span>
                    </span>
                    {isSelected && (
                      <Check size={14} style={{ color: "var(--accent)" }} />
                    )}
                  </button>
                );
              })
            )}
            {options.length > 60 && filtered.length === 60 && (
              <div
                className="px-3 py-2 text-[11px] text-center"
                style={{ color: "var(--app-muted)" }}
              >
                Showing the first 60. Type to narrow down.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================
   Data hooks shared by the workflow pages
========================= */

/** Employees that can be approvers / notified (same source as your personal workflow page). */
export function useApproverOptions() {
  const query = useQuery({ queryKey: ["approvers"], queryFn: fetchApprovers });
  const raw = query.data;
  const options = useMemo(() => {
    const list = Array.isArray(raw?.data?.data)
      ? raw.data.data
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw)
          ? raw
          : [];
    return list
      .filter((emp) => emp?._id && (emp?.firstName || emp?.lastName))
      .map((emp) => ({
        value: String(emp._id),
        label: formatFullName(emp),
        initials: initialsOf(emp),
        position: emp.position || emp.designation?.name || "Staff",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [raw]);
  return { options, isLoading: query.isLoading };
}

export function useApprovalRoleOptions() {
  const query = useQuery({
    queryKey: ["approvalRoles"],
    queryFn: fetchApprovalRoles,
  });
  const raw = query.data;
  const roles = useMemo(() => {
    const list = Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
        ? raw
        : [];
    return list.map((r) => ({
      id: r.id || r.value || r.name || r,
      label: r.label || r.name || r.value || r.id || String(r),
      desc: r.description || r.desc || "Assigned approval role.",
    }));
  }, [raw]);
  return { roles, isLoading: query.isLoading };
}

/** Everything that can change when workflows/assignments change. */
const WORKFLOW_QUERY_KEYS = [
  "workflowTemplates",
  "workflowScopeValues",
  "workflowAssignments",
  "employeeWorkflows",
  "myWorkflow",
  "approvalRoutes",
  "notifyGroups",
  "workflowSettings",
];

export const invalidateWorkflowQueries = (queryClient) =>
  Promise.all(
    WORKFLOW_QUERY_KEYS.map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
