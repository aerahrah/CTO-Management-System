import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * Enterprise Route Map
 */
const breadcrumbNameMap = {
  dashboard: "User Management",
  app: "User Management",

  employees: "Employee Directory",
  "add-employee": "Add Employee",
  update: "Update Employee",

  "office-designation": "Office/Designation",
  "my-profile": "Employee Profile",
  "reset-password": "Account Security",
  edit: "Edit Information",
};

const toLabel = (value) =>
  breadcrumbNameMap[value] ||
  value.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const isIdLike = (x) =>
  /^[0-9a-fA-F]{24}$/.test(x) || /^[0-9a-fA-F-]{36}$/.test(x);

const joinPaths = (...parts) =>
  parts.filter(Boolean).join("/").replace(/\/+/g, "/").replace(/\/$/, "");

const Breadcrumbs = ({
  rootLabel = "User Management",
  rootTo = "/app",
  hideSegments = ["login"],
}) => {
  const { pathname } = useLocation();

  const crumbs = useMemo(() => {
    // raw segments (no empty)
    const segments = pathname.split("/").filter(Boolean);

    // remove base technical segments, and hidden segments
    const baseFiltered = segments.filter(
      (s) => !["dashboard", "app"].includes(s) && !hideSegments.includes(s),
    );

    // Build crumbs but convert ID segments into semantic crumbs based on context
    const out = [];
    for (let i = 0; i < baseFiltered.length; i++) {
      const seg = baseFiltered[i];

      if (isIdLike(seg)) {
        const prev = baseFiltered[i - 1];

        // 👇 map known ID contexts
        if (prev === "employees") {
          out.push({ label: "Employee Details", isLink: false });
          continue;
        }

        // fallback if it's some other unknown ID route
        out.push({ label: "Details", isLink: false });
        continue;
      }

      out.push({ label: toLabel(seg), seg, isLink: true });
    }

    return { baseFiltered, out };
  }, [pathname, hideSegments]);

  if (!crumbs.out.length) return null;

  // We'll build the "to" links cumulatively, but we must skip ID segments
  // For the "Employee Details" crumb, we want the link to include the ID (real path)
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex items-center text-[12px] font-semibold uppercase tracking-[0.35em]">
        {/* Root */}
        <li>
          <Link
            to={rootTo}
            className="text-blue-600 hover:text-blue-700 transition-colors"
          >
            {rootLabel}
          </Link>
        </li>

        {/* Build crumbs with correct "to" */}
        {(() => {
          // We'll walk through the real path segments and create a running path.
          // When we hit an ID after /employees, we render "Employee Details" but keep the real URL.
          const real = segments.filter(
            (s) =>
              !["dashboard", "app"].includes(s) && !hideSegments.includes(s),
          );

          let built = rootTo; // starts at /app
          const rendered = [];

          for (let i = 0; i < real.length; i++) {
            const seg = real[i];
            built = joinPaths(built, seg);

            const prev = real[i - 1];
            const isLastReal = i === real.length - 1;

            // ID segment: replace label
            if (isIdLike(seg)) {
              const label =
                prev === "employees" ? "Employee Details" : "Details";

              rendered.push(
                <React.Fragment key={built}>
                  <li
                    aria-hidden="true"
                    className="mx-3 text-slate-300 tracking-normal"
                  >
                    /
                  </li>
                  <li>
                    {/* current page, so just span (or link if you want) */}
                    {isLastReal ? (
                      <span className="text-slate-500" aria-current="page">
                        {label}
                      </span>
                    ) : (
                      <Link
                        to={built}
                        className="text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                </React.Fragment>,
              );
              continue;
            }

            // normal segment
            rendered.push(
              <React.Fragment key={built}>
                <li
                  aria-hidden="true"
                  className="mx-3 text-slate-300 tracking-normal"
                >
                  /
                </li>
                <li>
                  {!isLastReal ? (
                    <Link
                      to={built}
                      className="text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      {toLabel(seg)}
                    </Link>
                  ) : (
                    <span className="text-slate-500" aria-current="page">
                      {toLabel(seg)}
                    </span>
                  )}
                </li>
              </React.Fragment>,
            );
          }

          return rendered;
        })()}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
