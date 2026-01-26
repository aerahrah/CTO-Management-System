import { useQuery } from "@tanstack/react-query";
import { getEmployees } from "../../../api/employee";
import { useEffect, useState, useMemo } from "react";
import {
  Search,
  X,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronIcon,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import ErrorMessage from "../../errorComponent";
import { useNavigate, useParams } from "react-router-dom";
/* ================================
   HOOK: USE DEBOUNCE
   (Prevents API spam while typing)
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
   CTO EMPLOYEE LIST VIEW
================================ */
const CtoEmployeeListView = ({ setIsEmployeeLoading }) => {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
        <h1 className="text-lg font-bold text-neutral-800">Directory</h1>
        <p className="text-xs text-neutral-500">
          Manage and view staff members
        </p>
      </div>

      <EmployeeList setIsEmployeeLoading={setIsEmployeeLoading} />
    </div>
  );
};

/* ================================
   EMPLOYEE LIST COMPONENT
================================ */
const EmployeeList = ({ setIsEmployeeLoading }) => {
  const { id: selectedId } = useParams(); // Get employee ID from URL
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employees", debouncedSearch, sortOrder, page, limit],
    queryFn: () =>
      getEmployees({
        search: debouncedSearch,
        sortOrder,
        page,
        limit,
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (setIsEmployeeLoading) setIsEmployeeLoading(isLoading);
  }, [isLoading, setIsEmployeeLoading]);

  // Auto-select first employee if no ID in URL
  useEffect(() => {
    if (data?.data?.length > 0 && !selectedId) {
      navigate(`/app/cto/records/${data.data[0]._id}`, { replace: true });
    }
  }, [data, selectedId, navigate]);

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  if (isError)
    return (
      <div className="p-4">
        <ErrorMessage message="Failed to load employees. Please try again." />
      </div>
    );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* --- TOP CONTROLS --- */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by name or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-2 w-full border border-neutral-200 rounded-lg 
                         bg-white text-sm text-neutral-700
                         placeholder:text-neutral-400
                         focus:ring-2 focus:ring-blue-100 focus:border-blue-500 
                         outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort Button */}
          <button
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

      {/* --- SCROLLABLE LIST AREA --- */}
      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-neutral-200 hover:scrollbar-thumb-neutral-300">
        <ul className="flex flex-col gap-1">
          {isLoading ? (
            // Modern Skeleton Loading
            Array.from({ length: limit }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white"
              >
                <Skeleton circle height={40} width={40} />
                <div className="flex flex-col flex-1 gap-1">
                  <Skeleton width="50%" height={14} />
                  <Skeleton width="30%" height={12} />
                </div>
              </li>
            ))
          ) : data?.data?.length > 0 ? (
            data.data.map((item) => {
              const isActive = selectedId === item._id;
              const initials = `${item.firstName?.[0] || ""}${
                item.lastName?.[0] || ""
              }`;

              return (
                <li
                  key={item._id}
                  onClick={() => navigate(`/app/cto/records/${item._id}`)}
                  className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
    ${
      selectedId === item._id
        ? "bg-blue-50/60 border-blue-200 shadow-sm ring-1 ring-blue-100"
        : "bg-white border-transparent hover:bg-neutral-50 hover:border-neutral-200"
    }`}
                >
                  {/* Avatar */}
                  <div
                    className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold shadow-sm transition-colors
                      ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200"
                      }`}
                  >
                    {initials}
                  </div>

                  {/* Text Content */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className={`text-sm font-semibold truncate ${
                        isActive ? "text-blue-900" : "text-neutral-800"
                      }`}
                    >
                      {item.firstName} {item.lastName}
                    </span>
                    <span className="text-xs text-neutral-500 truncate group-hover:text-neutral-600">
                      {item.department || "No Department"}
                    </span>
                  </div>

                  {/* Active Indicator Icon */}
                  <ChevronIcon
                    className={`h-4 w-4 transition-transform ${
                      isActive
                        ? "text-blue-500 translate-x-0"
                        : "text-neutral-300 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                    }`}
                  />
                </li>
              );
            })
          ) : (
            // Empty State
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
              <div className="bg-neutral-50 p-3 rounded-full mb-3">
                <Search className="h-6 w-6 text-neutral-300" />
              </div>
              <p className="text-sm font-medium">No employees found</p>
              <p className="text-xs">Try adjusting your search terms</p>
            </div>
          )}
        </ul>
      </div>

      {/* --- FOOTER / PAGINATION --- */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 text-xs">
        {/* Limit Selector (Bottom Left) */}
        <div className="flex items-center gap-2 text-neutral-500">
          <span>Show</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-white border border-neutral-200 rounded px-1 py-1 text-neutral-700 focus:ring-1 focus:ring-blue-400 outline-none cursor-pointer"
          >
            {[10, 20, 50, 100].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Pagination Controls (Bottom Right) */}
        {data?.totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
              className="p-1 rounded-md border border-transparent hover:bg-white hover:border-neutral-200 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
              aria-label="Previous Page"
            >
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </button>

            <span className="px-2 font-medium text-neutral-600">
              {page} <span className="text-neutral-400 font-normal">/</span>{" "}
              {data.totalPages}
            </span>

            <button
              disabled={page === data.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="p-1 rounded-md border border-transparent hover:bg-white hover:border-neutral-200 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
              aria-label="Next Page"
            >
              <ChevronRight className="h-4 w-4 text-neutral-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CtoEmployeeListView;
