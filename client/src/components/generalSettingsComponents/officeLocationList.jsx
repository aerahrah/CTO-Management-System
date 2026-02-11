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
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

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
   - Only auto-navigate on xl screens (2-pane layout)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedData.safePage]);

  // ✅ Auto-select first ONLY on xl screens AND only once
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
    <div className="flex flex-col h-full bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
        <h1 className="text-lg font-bold text-neutral-800">Designations</h1>
        <p className="text-xs text-neutral-500">
          Select a designation to configure its approver routing.
        </p>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {/* TOP CONTROLS */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Search designations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 py-2 w-full border border-neutral-200 rounded-lg 
                           bg-white text-sm text-neutral-700
                           placeholder:text-neutral-400
                           focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 
                           outline-none transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort */}
            <button
              type="button"
              onClick={handleSortToggle}
              className="flex items-center gap-2 px-3 py-2 border border-neutral-200 rounded-lg 
                         bg-white text-sm text-neutral-600 font-medium hover:bg-neutral-50 hover:border-neutral-300 transition-all"
              title={`Sort: ${sortOrder === "asc" ? "A-Z" : "Z-A"}`}
            >
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">
                {sortOrder === "asc" ? "A-Z" : "Z-A"}
              </span>
            </button>
          </div>
        </div>

        {/* LIST */}
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-neutral-200 hover:scrollbar-thumb-neutral-300">
          <ul className="flex flex-col gap-1">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white"
                >
                  <Skeleton circle height={40} width={40} />
                  <div className="flex flex-col flex-1 gap-1">
                    <Skeleton width="65%" height={14} />
                    <Skeleton width="40%" height={12} />
                  </div>
                </li>
              ))
            ) : isError ? (
              <li className="p-6 text-center text-sm text-red-500 bg-red-50 rounded-lg mx-2">
                Failed to load designations.
              </li>
            ) : processedData.data.length > 0 ? (
              processedData.data.map((designation) => {
                const isActive = activeId === designation._id;

                return (
                  <li
                    key={designation._id}
                    onClick={() => handleSelect(designation)}
                    className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
                      ${
                        isActive
                          ? "bg-indigo-50/60 border-indigo-200 shadow-sm ring-1 ring-indigo-100"
                          : "bg-white border-transparent hover:bg-neutral-50 hover:border-neutral-200"
                      }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full shadow-sm transition-colors
                        ${
                          isActive
                            ? "bg-indigo-600 text-white"
                            : "bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200"
                        }`}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>

                    {/* Text */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isActive ? "text-indigo-900" : "text-neutral-800"
                        }`}
                      >
                        {designation.name}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-neutral-500 truncate group-hover:text-neutral-600">
                        <Briefcase className="h-3 w-3" />
                        <span>{designation.status || "Active"}</span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronIcon
                      className={`h-4 w-4 transition-transform ${
                        isActive
                          ? "text-indigo-500 translate-x-0"
                          : "text-neutral-300 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                      }`}
                    />
                  </li>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                <div className="bg-neutral-50 p-3 rounded-full mb-3">
                  <Search className="h-6 w-6 text-neutral-300" />
                </div>
                <p className="text-sm font-medium">No designations found</p>
                <p className="text-xs">Try adjusting your search</p>
              </div>
            )}
          </ul>
        </div>

        {/* FOOTER / PAGINATION */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 text-xs">
          {/* Limit */}
          <div className="flex items-center gap-2 text-neutral-500">
            <span>Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-neutral-200 rounded px-1 py-1 text-neutral-700 focus:ring-1 focus:ring-indigo-400 outline-none cursor-pointer"
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
                className="p-1 rounded-md border border-transparent hover:bg-white hover:border-neutral-200 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
                aria-label="Previous Page"
                type="button"
              >
                <ChevronLeft className="h-4 w-4 text-neutral-600" />
              </button>

              <span className="px-2 font-medium text-neutral-600">
                {page} <span className="text-neutral-400 font-normal">/</span>{" "}
                {processedData.totalPages}
              </span>

              <button
                disabled={page === processedData.totalPages}
                onClick={() =>
                  setPage((prev) =>
                    Math.min(prev + 1, processedData.totalPages),
                  )
                }
                className="p-1 rounded-md border border-transparent hover:bg-white hover:border-neutral-200 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
                aria-label="Next Page"
                type="button"
              >
                <ChevronRight className="h-4 w-4 text-neutral-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfficeLocationList;
