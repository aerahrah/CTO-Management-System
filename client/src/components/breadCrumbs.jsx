import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * Enterprise Route Map
 */
const breadcrumbNameMap = {
  employees: "Employee Directory",
  "add-employee": "Add Employee",
  update: "Update Employee",

  "office-designation": "Office/Designation",
  "office-locations": "Office/Designation",
  "my-profile": "Employee Profile",
  "reset-password": "Account Security",
  edit: "Edit Information",
  overview: "Home",
};

const toLabel = (value) =>
  breadcrumbNameMap[value] ||
  value.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const isIdLike = (x) =>
  /^[0-9a-fA-F]{24}$/.test(x) || /^[0-9a-fA-F-]{36}$/.test(x);

const joinPaths = (...parts) =>
  parts.filter(Boolean).join("/").replace(/\/+/g, "/").replace(/\/$/, "");

/**
 * Mobile/tablet-friendly breadcrumbs:
 * - No back button
 * - Uses "/" separators
 * - Smaller font + tighter spacing on small screens
 * - Does NOT render "Home" crumb when user is already at /app (home)
 * - Still renders root link when user is not at home
 */
const Breadcrumbs = ({
  rootLabel = "Home",
  rootTo = "/app",
  hideSegments = ["login", "dashboard", "app"],
}) => {
  const { pathname } = useLocation();

  const { crumbs, isHome } = useMemo(() => {
    const raw = pathname.split("/").filter(Boolean);

    // remove technical segments + hidden segments
    const real = raw.filter((s) => !hideSegments.includes(s));

    // if current page is /app or /app/ (home)
    const home = real.length === 0;

    // Build crumbs with cumulative path, mapping IDs
    let built = rootTo;
    const out = [];

    for (let i = 0; i < real.length; i++) {
      const seg = real[i];
      built = joinPaths(built, seg);

      const prev = real[i - 1];
      const isLast = i === real.length - 1;

      if (isIdLike(seg)) {
        const label = prev === "employees" ? "Employee Details" : "Details";
        out.push({ label, to: built, isLast });
        continue;
      }

      out.push({ label: toLabel(seg), to: built, isLast });
    }

    return { crumbs: out, isHome: home };
  }, [pathname, hideSegments, rootTo]);

  // ✅ On home, show nothing (no "Home" breadcrumb)
  if (isHome) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol
        className="
          flex items-center flex-wrap
          text-[10px] sm:text-[11px] md:text-[12px]
          font-semibold uppercase
          tracking-[0.18em] sm:tracking-[0.22em] md:tracking-[0.28em]
          gap-x-2 gap-y-1
        "
      >
        {/* Root (only when NOT home) */}
        <li className="min-w-0">
          <Link
            to={rootTo}
            className="text-blue-600 hover:text-blue-700 transition-colors truncate max-w-[18ch] sm:max-w-[24ch]"
            title={rootLabel}
          >
            {rootLabel}
          </Link>
        </li>

        {crumbs.map((c, idx) => (
          <React.Fragment key={c.to + idx}>
            <li
              aria-hidden="true"
              className="text-slate-300 tracking-normal select-none"
            >
              /
            </li>

            <li className="min-w-0">
              {c.isLast ? (
                <span
                  className="text-slate-500 truncate max-w-[18ch] sm:max-w-[24ch] md:max-w-none"
                  aria-current="page"
                  title={c.label}
                >
                  {c.label}
                </span>
              ) : (
                <Link
                  to={c.to}
                  className="text-slate-500 hover:text-blue-600 transition-colors truncate max-w-[18ch] sm:max-w-[24ch] md:max-w-none"
                  title={c.label}
                >
                  {c.label}
                </Link>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
