import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getEmployees } from "../../api/employee";
import { useNavigate } from "react-router-dom";
import { RoleBadge } from "../statusUtils";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Breadcrumbs from "../breadCrumbs";
import EmployeeRoleChanger from "./employeeChangeRole";
import Modal from "../modal";
import FilterSelect from "../filterSelect";

import {
  Search,
  MoreVertical,
  User,
  Settings,
  Shield,
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FilterX,
  Mail,
  Building2,
  IdCard,
  Briefcase,
} from "lucide-react";

/* =========================
   CONSTANTS
========================= */
const FILTER_OPTIONS = {
  divisions: ["AFD", "TOD", "ORD"],
  designations: ["Engineer", "Manager", "Analyst", "Intern", "HR Specialist"],
  projects: [
    "Cybersecurity/PNPKI",
    "FPIAP",
    "ILCDB",
    "ILCDB - Tech4ED",
    "DigiGov",
    "GECS",
    "NIPPSB",
    "GovNet",
    "MISS",
    "IIDB",
  ],
};

const pageSizeOptions = [20, 50, 100];

/* =========================
   HOOK: DEBOUNCE
========================= */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* =========================
   ACTION MENU (hardened)
========================= */
const ActionMenu = ({ onAction, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handle = (cb) => {
    cb?.();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex justify-center" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setIsOpen((o) => !o);
        }}
        className={`p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Actions"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
          <button
            type="button"
            onClick={() => handle(() => onAction("view"))}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-left"
          >
            <User size={14} /> View Profile
          </button>
          <button
            type="button"
            onClick={() => handle(() => onAction("update"))}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-left"
          >
            <Settings size={14} /> Update Profile
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button
            type="button"
            onClick={() => handle(() => onAction("role"))}
            className="w-full px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2 text-left"
          >
            <Shield size={14} /> Change Role
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================
   Pagination
========================= */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  label = "items",
}) => {
  return (
    <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-white">
      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div className="text-xs font-mono font-semibold text-gray-700">
            {page} / {totalPages}
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs text-gray-500 font-medium">
          Showing{" "}
          <span className="font-bold text-gray-900">
            {total === 0 ? 0 : `${startItem}-${endItem}`}
          </span>{" "}
          of <span className="font-bold text-gray-900">{total}</span> {label}
        </div>

        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button
            type="button"
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium px-3 text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={page >= totalPages || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all text-gray-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Helpers
========================= */
const DivisionBadge = ({ division }) => {
  const styles = {
    AFD: "bg-blue-50 text-blue-700 border-blue-100",
    TOD: "bg-purple-50 text-purple-700 border-purple-100",
    ORD: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  const defaultStyle = "bg-gray-50 text-gray-700 border-gray-100";
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${
        styles[division] || defaultStyle
      }`}
    >
      {division || "N/A"}
    </span>
  );
};

const initials = (firstName, lastName) =>
  `${(firstName || " ")[0] || ""}${(lastName || " ")[0] || ""}`.toUpperCase();

/* =========================
   MAIN COMPONENT (SECURE)
========================= */
const EmployeeDirectory = () => {
  const navigate = useNavigate();

  // Role modal (secure)
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);

  // Hard lock to prevent rapid re-opening / multiple modals
  const openRoleLockRef = useRef(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 400);

  const [filters, setFilters] = useState({
    division: "All",
    designation: "All",
    project: "All",
  });

  // sanitize filter values to allowed lists (defense-in-depth)
  const safeFilters = useMemo(() => {
    const safeDivision = ["All", ...FILTER_OPTIONS.divisions].includes(
      filters.division,
    )
      ? filters.division
      : "All";

    const safeDesignation = ["All", ...FILTER_OPTIONS.designations].includes(
      filters.designation,
    )
      ? filters.designation
      : "All";

    const safeProject = ["All", ...FILTER_OPTIONS.projects].includes(
      filters.project,
    )
      ? filters.project
      : "All";

    return {
      division: safeDivision,
      designation: safeDesignation,
      project: safeProject,
    };
  }, [filters]);

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["employees", page, limit, safeFilters, debouncedSearch],
    queryFn: () =>
      getEmployees({
        page,
        limit,
        search: debouncedSearch || undefined,
        division:
          safeFilters.division === "All" ? undefined : safeFilters.division,
        designation:
          safeFilters.designation === "All"
            ? undefined
            : safeFilters.designation,
        project:
          safeFilters.project === "All" ? undefined : safeFilters.project,
      }),
    placeholderData: keepPreviousData,
  });

  // reset page on filter/search/limit change
  useEffect(() => {
    setPage(1);
  }, [safeFilters, debouncedSearch, limit]);

  const employees = data?.data || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.max(data?.totalPages || 1, 1);

  // keep page within range
  useEffect(() => {
    setPage((p) => {
      if (p > totalPages) return totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [totalPages]);

  const startItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(page * limit, totalItems);

  const handleAddEmployee = () => navigate("/app/employees/add-employee");

  const closeRoleModal = useCallback(() => {
    setIsRoleModalOpen(false);
    setSelectedEmployee(null);
    setRoleBusy(false);
    openRoleLockRef.current = false;
  }, []);

  const openRoleModal = useCallback((employee) => {
    // Hard-block multiple opens from rapid clicks
    if (openRoleLockRef.current) return;
    openRoleLockRef.current = true;

    setSelectedEmployee(employee);
    setRoleBusy(false);
    setIsRoleModalOpen(true);

    // release lock after first paint; modal stays single-instance
    requestAnimationFrame(() => {
      openRoleLockRef.current = false;
    });
  }, []);

  const handleAction = useCallback(
    (action, employee) => {
      if (!employee?._id) return;

      if (action === "view") navigate(`/app/employees/${employee._id}`);
      if (action === "update")
        navigate(`/app/employees/${employee._id}/update`);
      if (action === "role") openRoleModal(employee);
    },
    [navigate, openRoleModal],
  );

  const clearFilters = useCallback(() => {
    setFilters({ division: "All", designation: "All", project: "All" });
    setSearchInput("");
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(
    debouncedSearch ||
    safeFilters.division !== "All" ||
    safeFilters.designation !== "All" ||
    safeFilters.project !== "All",
  );

  return (
    <div className="w-full flex-1 flex h-full flex-col md:p-0 bg-gray-50/50">
      {/* HEADER */}
      <div className="pt-2 pb-3 sm:pb-6 px-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Breadcrumbs above the title */}
            <Breadcrumbs rootLabel="home" rootTo="/app" />

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight font-sans">
              Employee Directory
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Manage your organization’s staffing and roles.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddEmployee}
            className="group relative inline-flex items-center gap-2 justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 w-full md:w-auto"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            Add Employee
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* TOOLBAR */}
        <div className="p-4 border-b border-gray-100 bg-white space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filters */}
            <div className="w-full md:w-auto">
              <div className="flex flex-wrap md:flex-nowrap items-center gap-2 overflow-visible">
                <div className="min-w-[140px] w-[140px] md:w-auto">
                  <FilterSelect
                    label="Division"
                    value={safeFilters.division}
                    onChange={(v) => setFilters((p) => ({ ...p, division: v }))}
                    options={["All", ...FILTER_OPTIONS.divisions]}
                    className="w-full"
                  />
                </div>

                <div className="min-w-[160px] w-[160px] md:w-auto">
                  <FilterSelect
                    label="Designation"
                    value={safeFilters.designation}
                    onChange={(v) =>
                      setFilters((p) => ({ ...p, designation: v }))
                    }
                    options={["All", ...FILTER_OPTIONS.designations]}
                    className="w-full"
                  />
                </div>

                <div className="min-w-[180px] w-full sm:w-[220px] md:w-auto">
                  <FilterSelect
                    label="Project"
                    value={safeFilters.project}
                    onChange={(v) => setFilters((p) => ({ ...p, project: v }))}
                    options={["All", ...FILTER_OPTIONS.projects]}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Search + rows */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                    title="Clear"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Show
                </span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-medium outline-none cursor-pointer"
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Active filters row */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  Active:
                </span>
                {debouncedSearch && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                    "{debouncedSearch}"
                  </span>
                )}
                {safeFilters.division !== "All" && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                    {safeFilters.division}
                  </span>
                )}
                {safeFilters.designation !== "All" && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                    {safeFilters.designation}
                  </span>
                )}
                {safeFilters.project !== "All" && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                    {safeFilters.project}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase hover:text-blue-700"
              >
                <FilterX size={10} /> Reset
              </button>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto bg-white min-h-[300px]">
          {/* Desktop table */}
          <div className="hidden md:block overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-100">
                <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-bold">
                  <th className="px-6 py-4 font-bold">Employee</th>
                  <th className="px-6 py-4 font-bold">Designation</th>
                  <th className="px-6 py-4 font-bold">Division</th>
                  <th className="px-6 py-4 font-bold">Project</th>
                  <th className="px-6 py-4 font-bold">Role</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 text-right font-bold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  [...Array(Math.min(limit, 10))].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((__, j) => (
                        <td key={j} className="px-6 py-4">
                          <Skeleton />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : employees.length > 0 ? (
                  employees.map((emp, i) => (
                    <tr
                      key={emp._id}
                      className={`group hover:bg-gray-50/80 transition-colors ${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200">
                            {initials(emp.firstName, emp.lastName)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {emp.email || "No email"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {emp?.designation?.name || emp.designation || "—"}
                      </td>

                      <td className="px-6 py-4">
                        <DivisionBadge division={emp.division} />
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {emp.project ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {emp.project}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {emp.role ? <RoleBadge role={emp.role} /> : "—"}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                          {emp.status || "ACTIVE"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end">
                          <ActionMenu
                            disabled={isRoleModalOpen} // prevent chaos while modal open
                            onAction={(action) => handleAction(action, emp)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="bg-gray-50 p-6 rounded-full mb-4 ring-1 ring-gray-100">
                          <Search className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                          No employees found
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">
                          Try adjusting your search or filters.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 underline"
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col p-3 gap-2 bg-gray-50">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 space-y-2"
                >
                  <Skeleton count={2} />
                </div>
              ))
            ) : employees.length > 0 ? (
              employees.map((emp) => (
                <div
                  key={emp._id}
                  className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden"
                  onClick={() => navigate(`/app/employees/${emp._id}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="px-3 py-2 flex justify-between items-center border-b border-gray-50">
                    <span className="text-[11px] font-mono text-gray-400">
                      #{emp._id ? emp._id.slice(-6).toUpperCase() : "—"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                      {emp.status || "ACTIVE"}
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200 flex-none">
                        {initials(emp.firstName, emp.lastName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-gray-900 truncate leading-5">
                          {emp.firstName} {emp.lastName}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Mail size={12} className="text-gray-400" />
                          <span className="truncate">
                            {emp.email || "No email"}
                          </span>
                        </div>
                      </div>
                      <div className="flex-none -mt-1">
                        <ActionMenu
                          disabled={isRoleModalOpen}
                          onAction={(action) => handleAction(action, emp)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                        <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                          <IdCard size={12} /> Designation
                        </div>
                        <div className="text-xs font-semibold text-gray-800 mt-0.5 truncate">
                          {emp?.designation?.name || emp.designation || "—"}
                        </div>
                      </div>

                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                        <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                          <Building2 size={12} /> Division
                        </div>
                        <div className="mt-1">
                          <DivisionBadge division={emp.division} />
                        </div>
                      </div>

                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 col-span-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                              <Briefcase size={12} /> Project
                            </div>
                            <div className="text-xs font-semibold text-gray-800 mt-0.5 truncate">
                              {emp.project || "—"}
                            </div>
                          </div>
                          <div className="flex-none text-right">
                            <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1 justify-end">
                              <Shield size={12} /> Role
                            </div>
                            <div className="text-xs font-semibold text-gray-800 mt-0.5">
                              {emp.role ? <RoleBadge role={emp.role} /> : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/employees/${emp._id}`);
                      }}
                      className="py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
                    >
                      <User size={14} /> View
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRoleModal(emp);
                      }}
                      className="py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-2"
                    >
                      <Shield size={14} /> Role
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-14 px-4 text-center bg-white rounded-xl border border-gray-100">
                <div className="bg-gray-50 p-5 rounded-full mb-3 ring-1 ring-gray-100">
                  <Search className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  No employees found
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                  Try adjusting your search or filters.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-700 underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PAGINATION */}
        <CompactPagination
          page={page}
          totalPages={totalPages}
          total={totalItems}
          startItem={startItem}
          endItem={endItem}
          label="employees"
          onPrev={() => setPage((p) => Math.max(p - 1, 1))}
          onNext={() => {
            if (!isPlaceholderData && page < totalPages) setPage((p) => p + 1);
          }}
        />
      </div>

      {isRoleModalOpen && selectedEmployee && (
        <Modal
          isOpen={isRoleModalOpen}
          title={`Change Role - ${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
          showFooter={false}
          maxWidth="max-w-lg"
          canClose={!roleBusy} // blocks overlay/ESC close while busy
          onClose={() => {
            if (roleBusy) return; // extra guard
            closeRoleModal();
          }}
        >
          <EmployeeRoleChanger
            key={selectedEmployee._id} // ensures clean reset per employee
            employeeId={selectedEmployee._id}
            currentRole={selectedEmployee.role}
            onPendingChange={(v) => setRoleBusy(!!v)}
            onCancel={closeRoleModal} // ALWAYS closes even while busy
            onRoleUpdated={() => {
              closeRoleModal();
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default EmployeeDirectory;
