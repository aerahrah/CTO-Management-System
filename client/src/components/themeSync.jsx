import { useLayoutEffect, useMemo, useRef } from "react";
import { useAuth } from "../store/authStore";

const ACCENT_HEX = {
  blue: "#2563EB",
  pink: "#DB2777",
  green: "#16A34A",
  violet: "#7C3AED",
  amber: "#D97706",
  teal: "#0D9488",
  indigo: "#4F46E5",
  rose: "#E11D48",
  cyan: "#0891B2",
  lime: "#65A30D",
  orange: "#EA580C",
};

const THEMES = {
  light: {
    "--app-bg": "rgba(245,245,245,0.80)",
    "--app-surface": "#ffffff",
    "--app-surface-2": "rgba(255,255,255,0.80)",
    "--app-text": "#0f172a",
    "--app-muted": "#64748b",
    "--app-border": "#e5e7eb",
  },
  dark: {
    "--app-bg": "#0b1220",
    "--app-surface": "#0f172a",
    "--app-surface-2": "rgba(2,6,23,0.60)",
    "--app-text": "#e5e7eb",
    "--app-muted": "#94a3b8",
    "--app-border": "rgba(255,255,255,0.10)",
  },
};

function hexToRgba(hex, alpha = 1) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(37,99,235,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function ThemeSync() {
  const theme = useAuth((s) => s.preferences?.theme || "light"); // "light" | "dark" | "system"
  const accent = useAuth((s) => s.preferences?.accent || "blue");

  // ✅ ensure we only "enable transitions" once (prevents flash on reload)
  const didInitRef = useRef(false);

  const resolvedTheme = useMemo(() => {
    if (theme === "system") {
      const systemDark =
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
      return systemDark ? "dark" : "light";
    }
    return theme === "dark" ? "dark" : "light";
  }, [theme]);

  useLayoutEffect(() => {
    const root = document.documentElement;

    // ✅ Disable transitions before applying vars (no ugly flash)
    if (!didInitRef.current) {
      root.classList.remove("theme-ready");
    }

    // 1) Apply theme palette vars
    const palette = THEMES[resolvedTheme] || THEMES.light;
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v));

    // 2) Apply accent vars
    const accentHex = ACCENT_HEX[accent] || ACCENT_HEX.blue;
    root.style.setProperty("--accent", accentHex);
    root.style.setProperty("--accent-soft", hexToRgba(accentHex, 0.1));
    root.style.setProperty("--accent-soft2", hexToRgba(accentHex, 0.16));
    root.style.setProperty("--accent-ring", hexToRgba(accentHex, 0.28));

    // ✅ Enable transitions after first paint
    if (!didInitRef.current) {
      didInitRef.current = true;

      // next frame → allow transitions for future changes
      requestAnimationFrame(() => {
        root.classList.add("theme-ready");
      });
    }
  }, [resolvedTheme, accent]);

  return null;
}
