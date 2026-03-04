// src/components/ScrollbarsSync.jsx
import { useLayoutEffect, useMemo } from "react";
import { useAuth } from "../store/authStore";

/**
 * ScrollbarsSync
 * - Injects themed scrollbar CSS once
 * - Applies scrollbar vars to :root based on existing ThemeSync vars
 * - Adds a class to html/body so the MAIN page scrollbar is themed too
 *
 * Works with any scroll container using:
 *  - .app-scrollbar (recommended)
 *  - .custom-scrollbar (your settings page)
 *  - .cto-scrollbar (your CTO pages)
 */

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

function hexToRgba(hex, alpha = 1) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(100,116,139,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function withAlpha(color, alpha) {
  const c = String(color || "").trim();
  if (!c) return "";
  if (c.startsWith("rgba(")) {
    // replace alpha
    return c.replace(/rgba\(([^)]+)\)/, (m, inner) => {
      const parts = inner.split(",").map((p) => p.trim());
      if (parts.length < 3) return m;
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    });
  }
  if (c.startsWith("rgb(")) {
    return c.replace(/rgb\(([^)]+)\)/, (m, inner) => {
      const parts = inner.split(",").map((p) => p.trim());
      if (parts.length < 3) return m;
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    });
  }
  if (c.startsWith("#") || /^[0-9a-fA-F]{6}$/.test(c)) {
    return hexToRgba(c.startsWith("#") ? c : `#${c}`, alpha);
  }
  // fallback: if it's something else (css var result), keep as-is
  return c;
}

export default function ScrollbarsSync() {
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const accentPref = useAuth((s) => s.preferences?.accent || "blue"); // only used to re-run when accent changes

  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);
  const isDark = resolvedTheme === "dark";

  // 1) Inject CSS once (covers html/body + common scroll classes)
  useLayoutEffect(() => {
    const styleId = "app-themed-scrollbars-style";
    let el = document.getElementById(styleId);

    const css = `
      /* Themed scrollbars: use these classes on scroll containers:
         .app-scrollbar (recommended), .custom-scrollbar, .cto-scrollbar
         Also applied to html/body when we add html.app-scrollbar + body.app-scrollbar
      */

      /* Firefox */
      :where(html.app-scrollbar, body.app-scrollbar, .app-scrollbar, .custom-scrollbar, .cto-scrollbar) {
        scrollbar-width: thin;
        scrollbar-color: var(--scroll-thumb) var(--scroll-track);
      }

      /* Chromium/WebKit */
      :where(html.app-scrollbar, body.app-scrollbar, .app-scrollbar, .custom-scrollbar, .cto-scrollbar)::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      :where(html.app-scrollbar, body.app-scrollbar, .app-scrollbar, .custom-scrollbar, .cto-scrollbar)::-webkit-scrollbar-track {
        background: var(--scroll-track);
        border-radius: 999px;
      }
      :where(html.app-scrollbar, body.app-scrollbar, .app-scrollbar, .custom-scrollbar, .cto-scrollbar)::-webkit-scrollbar-thumb {
        background: var(--scroll-thumb);
        border-radius: 999px;
        border: 2px solid var(--scroll-track);
      }
      :where(html.app-scrollbar, body.app-scrollbar, .app-scrollbar, .custom-scrollbar, .cto-scrollbar)::-webkit-scrollbar-thumb:hover {
        background: var(--scroll-thumb-hover);
      }
    `;

    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      el.textContent = css;
      document.head.appendChild(el);
    } else {
      el.textContent = css;
    }

    // ensure main document scrollbar uses the theme too
    document.documentElement.classList.add("app-scrollbar");
    document.body.classList.add("app-scrollbar");
  }, []);

  // 2) Update scrollbar vars whenever theme/accent changes
  useLayoutEffect(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);

    // Pull from ThemeSync vars (if present), otherwise use safe fallbacks
    const surface2 = cs.getPropertyValue("--app-surface-2").trim();
    const muted = cs.getPropertyValue("--app-muted").trim();
    const accent = cs.getPropertyValue("--accent").trim();

    // Track: follow surface-2 (nice on both themes), but fallback if empty early
    const track =
      surface2 || (isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)");

    // Thumb: use muted w/ alpha (matches your CTO pages look)
    const thumbBase = muted || (isDark ? "#94a3b8" : "#64748b");
    const thumb = withAlpha(thumbBase, 0.45);

    // Hover: match your settings page behavior (accent)
    const hover = accent || "#2563EB";

    root.style.setProperty("--scroll-track", track);
    root.style.setProperty("--scroll-thumb", thumb);
    root.style.setProperty("--scroll-thumb-hover", hover);
  }, [isDark, accentPref]);

  return null;
}
