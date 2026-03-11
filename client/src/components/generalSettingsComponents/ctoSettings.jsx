// src/components/cto/CtoSettings.jsx
import React, { useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useAuth } from "../../store/authStore";
import OfficeLocationList from "./officeLocationList";
import Breadcrumbs from "../breadCrumbs";

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

const CtoSettings = () => {
  const { designationId } = useParams();
  const hasSelection = Boolean(designationId);

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  return (
    <div
      className="w-full min-w-0 pt-2 transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="px-1">
        <Breadcrumbs rootLabel="home" rootTo="/app" />
      </div>

      <div className="flex flex-col xl:flex-row gap-3 h-[calc(100vh-3.5rem-2.5rem)] md:h-[calc(100vh-3.75rem-3.5rem)]">
        {/* LEFT PANEL */}
        <div
          className={[
            hasSelection ? "hidden xl:flex" : "flex",
            "w-full xl:w-92",
            "h-full flex-col xl:sticky xl:top-20",
            "min-w-0 rounded-xl overflow-hidden transition-colors duration-300 ease-out",
          ].join(" ")}
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}
        >
          <OfficeLocationList />
        </div>

        {/* RIGHT PANEL */}
        <div
          className={[
            hasSelection ? "flex" : "hidden xl:flex",
            "flex-col w-full flex-1 min-w-0 rounded-xl overflow-hidden transition-colors duration-300 ease-out",
          ].join(" ")}
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default CtoSettings;
