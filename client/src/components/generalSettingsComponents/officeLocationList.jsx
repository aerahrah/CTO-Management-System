import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { fetchDesignationOptions } from "../../api/designation";
import { useAuth } from "../../store/authStore";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Search,
  X,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronIcon,
  Building2,
  Briefcase,
} from "lucide-react";

/* ================================
   THEME
================================ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ================================
   HOOK: USE DEBOUNCE
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

const normalizeOptionsResponse = (raw) => {
  const items = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
        ? raw
        : [];
  return items;
};

const OfficeLocationList = () => {
  const navigate = useNavigate();
  const { designationId } = useParams();
  const activeId = designationId ? String(designationId) : "";

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    if (resolvedTheme === "dark") {
      return {
        baseColor: "rgba(255,255,255,0.06)",
        highlightColor: "rgba(255,255,255,0.10)",
      };
    }
    return {
      baseColor: "rgba(15,23,42,0.06)",
      highlightColor: "rgba(15,23,42,0.10)",
    };
  }, [resolvedTheme]);

  const panelBg = useMemo(
    () =>
      resolvedTheme === "dark" ? "var(--app-surface)" : "var(--app-surface)",
    [resolvedTheme],
  );

  const mutedBg = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(248,250,252,0.80)",
    [resolvedTheme],
  );

  const hoverBg = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(15,23,42,0.03)",
    [resolvedTheme],
  );

  const activeBg = useMemo(
    () =>
      resolvedTheme === "dark" ? "var(--accent-soft)" : "rgba(37,99,235,0.08)",
    [resolvedTheme],
  );

  const activeBorder = useMemo(
    () =>
      resolvedTheme === "dark" ? "var(--accent-soft2)" : "rgba(37,99,235,0.18)",
    [resolvedTheme],
  );

  const isXlUp = useIsXlUp();
  const hasNavigatedRef = useRef(false);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const {
    data: designationRaw,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["designationOptions", "all"],
    queryFn: () => fetchDesignationOptions({}),
    staleTime: 10 * 60 * 1000,
  });

  const allDesignations = useMemo(() => {
    const items = normalizeOptionsResponse(designationRaw);
    return items
      .filter((d) => d?._id && d?.name)
      .map((d) => ({
        ...d,
        _id: String(d._id),
        name: String(d.name),
      }));
  }, [designationRaw]);

  const processedData = useMemo(() => {
    let result = allDesignations;

    const q = (debouncedSearch || "").toLowerCase();
    if (q) result = result.filter((d) => d.name.toLowerCase().includes(q));

    result = [...result].sort((a, b) => {
      const A = a.name.toLowerCase();
      const B = b.name.toLowerCase();
      return sortOrder === "asc" ? A.localeCompare(B) : B.localeCompare(A);
    });

    const totalCount = result.length;
    const totalPages = Math.max(Math.ceil(totalCount / limit) || 1, 1);

    const safePage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (safePage - 1) * limit;
    const paginatedData = result.slice(startIndex, startIndex + limit);

    return { data: paginatedData, totalPages, totalCount, safePage };
  }, [allDesignations, debouncedSearch, sortOrder, page, limit]);

  useEffect(() => {
    if (page !== processedData.safePage) setPage(processedData.safePage);
  }, [page, processedData.safePage]);

  useEffect(() => {
    if (!isXlUp) return;
    if (hasNavigatedRef.current) return;

    if (!activeId && processedData.data.length > 0) {
      navigate(`/app/cto-settings/${processedData.data[0]._id}`, {
        replace: true,
      });
      hasNavigatedRef.current = true;
    }
  }, [activeId, processedData.data, navigate, isXlUp]);

  useEffect(() => setPage(1), [debouncedSearch]);

  const handleSortToggle = useCallback(() => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  const handleSelect = useCallback(
    (designation) => {
      navigate(`/app/cto-settings/${designation._id}`);
    },
    [navigate],
  );

  return (
    <div
      className="flex flex-col h-full rounded-xl border shadow-sm overflow-hidden transition-colors duration-300 ease-out"
      style={{
        backgroundColor: panelBg,
        borderColor,
      }}
    >
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        {/* HEADER */}
        <div
          className="px-4 py-3 border-b transition-colors duration-300 ease-out"
          style={{
            borderColor,
            backgroundColor: "var(--app-surface-2)",
          }}
        >
          <h1
            className="text-lg font-bold transition-colors duration-300 ease-out"
            style={{ color: "var(--app-text)" }}
          >
            Designations
          </h1>
          <p
            className="text-xs transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            Select a designation to configure its approver routing.
          </p>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          {/* TOP CONTROLS */}
          <div
            className="flex flex-col gap-2 px-4 py-3 border-b transition-colors duration-300 ease-out"
            style={{ borderColor }}
          >
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 group">
                <Search
                  className="absolute left-3 top-2.5 h-4 w-4 transition-colors"
                  style={{ color: "var(--app-muted)" }}
                />
                <input
                  type="text"
                  placeholder="Search designations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 py-2 w-full border rounded-lg text-sm outline-none transition-all duration-200 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    color: "var(--app-text)",
                    borderColor,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px var(--accent-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = borderColor;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded-full transition-colors duration-200 ease-out"
                    style={{ color: "var(--app-muted)" }}
                    aria-label="Clear search"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = hoverBg;
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

              {/* Sort */}
              <button
                type="button"
                onClick={handleSortToggle}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all duration-200 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  color: "var(--app-text)",
                  borderColor,
                }}
                title={`Sort: ${sortOrder === "asc" ? "A-Z" : "Z-A"}`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = hoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--app-surface)";
                }}
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {sortOrder === "asc" ? "A-Z" : "Z-A"}
                </span>
              </button>
            </div>
          </div>

          {/* LIST */}
          <div className="flex-1 overflow-y-auto px-2 py-2 cto-scrollbar">
            <ul className="flex flex-col gap-1">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg"
                    style={{ backgroundColor: "var(--app-surface)" }}
                  >
                    <Skeleton circle height={40} width={40} />
                    <div className="flex flex-col flex-1 gap-1">
                      <Skeleton width="65%" height={14} />
                      <Skeleton width="40%" height={12} />
                    </div>
                  </li>
                ))
              ) : isError ? (
                <li
                  className="p-6 text-center text-sm rounded-lg mx-2 transition-colors duration-300 ease-out"
                  style={{
                    color: resolvedTheme === "dark" ? "#fda4af" : "#dc2626",
                    backgroundColor:
                      resolvedTheme === "dark"
                        ? "rgba(244,63,94,0.10)"
                        : "rgba(254,242,242,0.90)",
                    border: `1px solid ${
                      resolvedTheme === "dark"
                        ? "rgba(244,63,94,0.22)"
                        : "rgba(244,63,94,0.14)"
                    }`,
                  }}
                >
                  Failed to load designations.
                </li>
              ) : processedData.data.length > 0 ? (
                processedData.data.map((designation) => {
                  const isActive = activeId === designation._id;

                  return (
                    <li
                      key={designation._id}
                      onClick={() => handleSelect(designation)}
                      className="group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200"
                      style={{
                        backgroundColor: isActive
                          ? activeBg
                          : "var(--app-surface)",
                        borderColor: isActive ? activeBorder : "transparent",
                        boxShadow: isActive
                          ? "0 1px 3px rgba(15,23,42,0.06)"
                          : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (isActive) return;
                        e.currentTarget.style.backgroundColor = hoverBg;
                        e.currentTarget.style.borderColor = borderColor;
                      }}
                      onMouseLeave={(e) => {
                        if (isActive) {
                          e.currentTarget.style.backgroundColor = activeBg;
                          e.currentTarget.style.borderColor = activeBorder;
                          return;
                        }
                        e.currentTarget.style.backgroundColor =
                          "var(--app-surface)";
                        e.currentTarget.style.borderColor = "transparent";
                      }}
                    >
                      {/* Avatar */}
                      <div
                        className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full shadow-sm transition-colors"
                        style={{
                          backgroundColor: isActive ? "var(--accent)" : mutedBg,
                          color: isActive ? "#fff" : "var(--app-muted)",
                          border: `1px solid ${
                            isActive ? "var(--accent)" : borderColor
                          }`,
                        }}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>

                      {/* Text */}
                      <div className="flex flex-col flex-1 min-w-0">
                        <span
                          className="text-sm font-semibold truncate transition-colors duration-300 ease-out"
                          style={{
                            color: isActive
                              ? "var(--accent)"
                              : "var(--app-text)",
                          }}
                        >
                          {designation.name}
                        </span>
                        <div
                          className="flex items-center gap-1 text-xs truncate transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          <Briefcase className="h-3 w-3" />
                          <span>{designation.status || "Active"}</span>
                        </div>
                      </div>

                      {/* Chevron */}
                      <ChevronIcon
                        className="h-4 w-4 transition-all duration-200"
                        style={{
                          color: isActive
                            ? "var(--accent)"
                            : "var(--app-muted)",
                          transform: isActive
                            ? "translateX(0)"
                            : "translateX(-4px)",
                          opacity: isActive ? 1 : 0,
                        }}
                      />
                    </li>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div
                    className="p-3 rounded-full mb-3 transition-colors duration-300 ease-out"
                    style={{ backgroundColor: mutedBg }}
                  >
                    <Search
                      className="h-6 w-6"
                      style={{ color: "var(--app-muted)" }}
                    />
                  </div>
                  <p
                    className="text-sm font-medium transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    No designations found
                  </p>
                  <p
                    className="text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Try adjusting your search
                  </p>
                </div>
              )}
            </ul>
          </div>

          {/* FOOTER / PAGINATION */}
          <div
            className="flex items-center justify-between px-4 py-3 border-t text-xs transition-colors duration-300 ease-out"
            style={{
              borderColor,
              backgroundColor: "var(--app-surface-2)",
            }}
          >
            {/* Limit */}
            <div
              className="flex items-center gap-2 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <span>Show</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border rounded px-1 py-1 outline-none cursor-pointer transition-all duration-200 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor,
                  color: "var(--app-text)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 2px var(--accent-soft)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = borderColor;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {[10, 20, 50].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Pager */}
            {processedData.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  className="p-1 rounded-md border border-transparent disabled:opacity-30 transition-all duration-200 ease-out"
                  aria-label="Previous Page"
                  type="button"
                  onMouseEnter={(e) => {
                    if (page === 1) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface)";
                    e.currentTarget.style.borderColor = borderColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  <ChevronLeft
                    className="h-4 w-4"
                    style={{ color: "var(--app-muted)" }}
                  />
                </button>

                <span
                  className="px-2 font-medium transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  {page}{" "}
                  <span style={{ color: "var(--app-muted)", fontWeight: 400 }}>
                    /
                  </span>{" "}
                  {processedData.totalPages}
                </span>

                <button
                  disabled={page === processedData.totalPages}
                  onClick={() =>
                    setPage((prev) =>
                      Math.min(prev + 1, processedData.totalPages),
                    )
                  }
                  className="p-1 rounded-md border border-transparent disabled:opacity-30 transition-all duration-200 ease-out"
                  aria-label="Next Page"
                  type="button"
                  onMouseEnter={(e) => {
                    if (page === processedData.totalPages) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface)";
                    e.currentTarget.style.borderColor = borderColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  <ChevronRight
                    className="h-4 w-4"
                    style={{ color: "var(--app-muted)" }}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </SkeletonTheme>
    </div>
  );
};

export default OfficeLocationList;
