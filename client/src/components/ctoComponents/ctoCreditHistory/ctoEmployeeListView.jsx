// ctoEmployeeListView.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getEmployees } from "../../../api/employee";
import { useNavigate, useParams } from "react-router-dom";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import ErrorMessage from "../../errorComponent";
import { useAuth } from "../../../store/authStore";

/* ================================
   HOOK: DEBOUNCE
================================ */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* ================================
   HOOK: MEDIA QUERY (xl and up)
================================ */
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

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ✅ Reactive resolved theme for system mode (prevents skeleton flashes) */
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

/* ================================
   PAGINATION (theme-aware)
================================ */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  label = "items",
  borderColor,
}) => {
  const hasTotal = typeof total === "number";

  return (
    <div
      className="px-4 py-3 border-t transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface-2)",
        borderColor: borderColor,
      }}
    >
      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || totalPages <= 1}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
            color: "var(--app-text)",
          }}
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div
            className="text-xs font-mono font-semibold"
            style={{ color: "var(--app-text)" }}
          >
            {page} / {Math.max(totalPages, 1)}
          </div>
          <div
            className="text-[11px] truncate"
            style={{ color: "var(--app-muted)" }}
          >
            {hasTotal
              ? total === 0
                ? `0 ${label}`
                : `${startItem}-${endItem} of ${total}`
              : " "}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= totalPages || totalPages <= 1}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
            color: "var(--app-text)",
          }}
          type="button"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div
          className="text-xs font-medium"
          style={{ color: "var(--app-muted)" }}
        >
          {hasTotal ? (
            <>
              Showing{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {total === 0 ? 0 : `${startItem}-${endItem}`}
              </span>{" "}
              of{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {total}
              </span>{" "}
              {label}
            </>
          ) : (
            <>
              Page{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {page}
              </span>{" "}
              of{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {Math.max(totalPages, 1)}
              </span>
            </>
          )}
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-lg border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          <button
            onClick={onPrev}
            disabled={page === 1 || totalPages <= 1}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            aria-label="Previous page"
            type="button"
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              e.currentTarget.style.color = "var(--app-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-muted)";
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span
            className="text-xs font-mono font-semibold px-3"
            style={{ color: "var(--app-muted)" }}
          >
            {page} / {Math.max(totalPages, 1)}
          </span>

          <button
            onClick={onNext}
            disabled={page >= totalPages || totalPages <= 1}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            aria-label="Next page"
            type="button"
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              e.currentTarget.style.color = "var(--app-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-muted)";
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const LIMIT_OPTIONS = [20, 50, 100];

const CtoEmployeeListView = ({ setIsEmployeeLoading }) => {
  // ✅ Theme vars are applied globally via ThemeSync in App.jsx.
  // Here we only compute border + skeleton fallbacks.
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    const base =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.06)";
    const highlight =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(15,23,42,0.10)";
    return {
      baseColor: `var(--skeleton-base, ${base})`,
      highlightColor: `var(--skeleton-highlight, ${highlight})`,
    };
  }, [resolvedTheme]);

  return (
    <SkeletonTheme
      baseColor={skeletonColors.baseColor}
      highlightColor={skeletonColors.highlightColor}
    >
      <div
        className="flex flex-col h-full min-h-0 rounded-xl border shadow-sm overflow-hidden min-w-0 w-full transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
          color: "var(--app-text)",
        }}
      >
        <div
          className="px-4 py-3 border-b transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: borderColor,
          }}
        >
          <h1
            className="text-lg font-bold"
            style={{ color: "var(--app-text)" }}
          >
            Directory
          </h1>
          <p className="text-xs" style={{ color: "var(--app-muted)" }}>
            Manage and view staff members
          </p>
        </div>

        <EmployeeList
          setIsEmployeeLoading={setIsEmployeeLoading}
          borderColor={borderColor}
        />
      </div>
    </SkeletonTheme>
  );
};

const EmployeeList = ({ setIsEmployeeLoading, borderColor }) => {
  const { id: selectedId } = useParams();
  const navigate = useNavigate();
  const isXlUp = useIsXlUp();

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const debouncedSearch = useDebounce(searchTerm, 450);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["employees", debouncedSearch, page, limit],
    queryFn: () =>
      getEmployees({
        search: debouncedSearch || "",
        page,
        limit,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    setIsEmployeeLoading?.(isLoading);
  }, [isLoading, setIsEmployeeLoading]);

  // Auto-select first employee ONLY on xl screens (2-pane)
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (!isXlUp) return;
    if (!hasNavigatedRef.current && data?.data?.length > 0 && !selectedId) {
      navigate(`/app/cto-records/${data.data[0]._id}`, { replace: true });
      hasNavigatedRef.current = true;
    }
  }, [data, selectedId, navigate, isXlUp]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const employees = data?.data || [];
  const totalPages = Math.max(
    data?.totalPages || data?.pagination?.totalPages || 1,
    1,
  );

  const total =
    typeof data?.total === "number"
      ? data.total
      : typeof data?.totalEmployees === "number"
        ? data.totalEmployees
        : typeof data?.pagination?.total === "number"
          ? data.pagination.total
          : undefined;

  const startItem =
    typeof total === "number"
      ? total === 0
        ? 0
        : (page - 1) * limit + 1
      : null;

  const endItem =
    typeof total === "number"
      ? total === 0
        ? 0
        : Math.min(page * limit, total)
      : null;

  if (isError) {
    return (
      <div className="p-4">
        <ErrorMessage message="Failed to load employees. Please try again." />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* SEARCH + SHOW */}
      <div
        className="flex flex-col gap-2 px-3 py-2 border-b transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
          <div className="relative flex-1 group min-w-0">
            <Search
              className="absolute left-3 top-2.5 h-4 w-4 transition-colors"
              style={{ color: "var(--app-muted)" }}
            />
            <input
              type="text"
              placeholder="Search by name, email, role…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-2 w-full border rounded-lg text-sm outline-none transition-all
                         placeholder:text-[color:var(--app-muted)]"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
                color: "var(--app-text)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px var(--accent-soft, rgba(37,99,235,0.18))";
                e.currentTarget.style.borderColor =
                  "var(--accent, rgb(37,99,235))";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = borderColor;
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 p-0.5 rounded-full transition-colors"
                style={{ color: "var(--app-muted)" }}
                aria-label="Clear search"
                type="button"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--app-surface-2)";
                  e.currentTarget.style.color = "var(--app-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--app-muted)";
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            className="flex items-center justify-between sm:justify-end gap-2 sm:pl-2 sm:border-l"
            style={{ borderColor: borderColor }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--app-muted)" }}
            >
              Show
            </span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded-lg px-2 py-2 text-xs font-semibold outline-none cursor-pointer transition-colors duration-200 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
                color: "var(--app-text)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px var(--accent-soft, rgba(37,99,235,0.18))";
                e.currentTarget.style.borderColor =
                  "var(--accent, rgb(37,99,235))";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = borderColor;
              }}
            >
              {LIMIT_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isFetching && (
          <div
            className="text-[11px] font-medium px-1"
            style={{ color: "var(--app-muted)" }}
          >
            Updating…
          </div>
        )}
      </div>

      {/* LIST */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2 cto-scrollbar transition-colors duration-300 ease-out"
        style={{ backgroundColor: "var(--app-surface)" }}
      >
        <ul className="flex flex-col gap-1">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="p-3">
                <Skeleton height={60} borderRadius={12} />
              </li>
            ))
          ) : employees.length > 0 ? (
            employees.map((item) => {
              const isActive = selectedId === item._id;
              const initials = `${item.firstName?.[0] || ""}${
                item.lastName?.[0] || ""
              }`;

              return (
                <li
                  key={item._id}
                  onClick={() => navigate(`/app/cto-records/${item._id}`)}
                  className="group flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200"
                  style={{
                    backgroundColor: isActive
                      ? "var(--accent-soft)"
                      : "var(--app-surface)",
                    borderColor: isActive
                      ? "var(--accent-soft2, rgba(37,99,235,0.18))"
                      : borderColor,
                  }}
                  onMouseEnter={(e) => {
                    if (isActive) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (isActive) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface)";
                  }}
                >
                  <div
                    className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold shadow-sm transition-colors border"
                    style={{
                      backgroundColor: isActive
                        ? "var(--accent)"
                        : "var(--app-surface-2)",
                      color: isActive ? "#fff" : "var(--app-text)",
                      borderColor: isActive ? "var(--accent)" : borderColor,
                    }}
                  >
                    {initials || "?"}
                  </div>

                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className="text-sm font-semibold truncate"
                      style={{
                        color: isActive ? "var(--app-text)" : "var(--app-text)",
                      }}
                    >
                      {item.firstName} {item.lastName}
                    </span>
                    <span
                      className="text-xs truncate"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {item?.position ||
                        item?.project?.name ||
                        "No position or project"}
                    </span>
                  </div>
                </li>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Search
                className="h-6 w-6 mb-2"
                style={{ color: "var(--app-muted)", opacity: 0.35 }}
              />
              <p
                className="text-xs font-medium uppercase tracking-tighter"
                style={{ color: "var(--app-muted)" }}
              >
                No results found
              </p>
            </div>
          )}
        </ul>
      </div>

      {/* PAGINATION */}
      <CompactPagination
        page={page}
        totalPages={totalPages}
        total={total}
        startItem={startItem}
        endItem={endItem}
        label="employees"
        onPrev={() => setPage((p) => Math.max(p - 1, 1))}
        onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
        borderColor={borderColor}
      />
    </div>
  );
};

export default CtoEmployeeListView;
