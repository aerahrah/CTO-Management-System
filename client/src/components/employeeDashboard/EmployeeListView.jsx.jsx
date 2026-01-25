import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getEmployees } from "../../api/employee";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import EmployeeRoleChanger from "./employeeChangeRole";
import Modal from "../modal";
import {
  Users,
  Briefcase,
  Layers,
  Search,
  MoreVertical,
  User,
  Settings,
  Shield,
  ChevronDown,
  LayoutGrid,
  Plus,
  ChevronLeft,
  ChevronRight,
  FilterX,
} from "lucide-react";

/* =========================
   CONSTANTS (Static options for UX stability)
========================= */
// In a real app, you might fetch these from a /metadata endpoint
const FILTER_OPTIONS = {
  divisions: ["AFD", "TOD", "STAFF"],
  designations: ["Engineer", "Manager", "Analyst", "Intern", "HR Specialist"],
  projects: ["Alpha", "Beta", "Gamma", "Internal"],
};

/* =========================
   HOOK: DEBOUNCE
   Prevents API spam while typing
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
   COMPONENT: STAT CARD
========================= */
const StatCard = ({ label, value, icon: Icon, color, subText }) => (
  <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
          {label}
        </p>
        <h3 className="text-2xl font-bold text-neutral-900">{value}</h3>
        {subText && <p className="text-xs text-neutral-400 mt-1">{subText}</p>}
      </div>
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} />
      </div>
    </div>
  </div>
);

/* =========================
   COMPONENT: ACTION MENU
========================= */
const ActionMenu = ({ onAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-700 transition-colors"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-200 rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => onAction("view")}
            className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
          >
            <User size={14} /> View Profile
          </button>
          <button
            onClick={() => onAction("update")}
            className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
          >
            <Settings size={14} /> Update Profile
          </button>
          <div className="h-px bg-neutral-100 my-1" />
          <button
            onClick={() => onAction("role")}
            className="w-full text-left px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"
          >
            <Shield size={14} /> Change Role
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================
   MAIN COMPONENT
========================= */
const EmployeeDirectory = () => {
  const navigate = useNavigate();
  const roleChangerRef = useRef(null);
  // --- State Management ---
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 200);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    division: "",
    designation: "",
    project: "",
  });

  // --- React Query (Fetching Data) ---
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["employees", page, limit, filters, debouncedSearch],
    queryFn: () =>
      getEmployees({
        page,
        limit,
        search: debouncedSearch,
        division: filters.division === "All" ? "" : filters.division,
        designation: filters.designation === "All" ? "" : filters.designation,
        project: filters.project === "All" ? "" : filters.project,
      }),
    placeholderData: keepPreviousData, // Keeps table populated while fetching next page
  });

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters, debouncedSearch, limit]);

  const employees = data?.data || [];
  const totalItems = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // --- Handlers ---
  const handleAddEmployee = () => {
    navigate("/dashboard/employees/add-employee");
  };

  const handleAction = (action, employee) => {
    if (action === "view") navigate(`/dashboard/employees/${employee._id}`);
    else if (action === "update")
      navigate(`/dashboard/employees/${employee._id}/update`);
    else if (action === "role") {
      setSelectedEmployee(employee);
      setIsRoleModalOpen(true);
    }
  };

  const clearFilters = () => {
    setFilters({ division: "", designation: "", project: "" });
    setSearchTerm("");
  };

  const hasActiveFilters =
    searchTerm || filters.division || filters.designation || filters.project;

  return (
    <div className="p-4 md:p-6 bg-neutral-50 min-h-screen w-full font-sans text-neutral-800 space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Workforce Directory
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Manage your organization's staffing.
          </p>
        </div>

        {/* Improved Add Button UX */}
        <button
          onClick={handleAddEmployee}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow focus:ring-2 focus:ring-blue-500/20"
        >
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      {/* DASHBOARD STATS 
          Note: Since we are paginating, we can only accurately show the Total from the backend response.
          Specific division counts would need a separate API endpoint (e.g., /stats).
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={isLoading ? "-" : totalItems}
          subText="Registered in system"
          icon={LayoutGrid}
          color="bg-blue-100 text-blue-600"
        />
        {/* These are static placeholders for now unless backend sends stats */}
        <StatCard
          label="Field Ops"
          value={isLoading ? "-" : "—"}
          subText="Active TOD Personnel"
          icon={Briefcase}
          color="bg-purple-100 text-purple-600"
        />
        <StatCard
          label="Support Staff"
          value={isLoading ? "-" : "—"}
          subText="Administrative"
          icon={Users}
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          label="Projects"
          value="4"
          subText="Active deployments"
          icon={Layers}
          color="bg-orange-100 text-orange-600"
        />
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col">
        {/* FILTERS TOOLBAR */}
        <div className="p-4 border-b border-neutral-100 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          {/* Search */}
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              className="pl-10 pr-4 py-2 w-full border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <FilterSelect
              label="Division"
              value={filters.division}
              options={["All", ...FILTER_OPTIONS.divisions]}
              onChange={(val) =>
                setFilters({ ...filters, division: val === "All" ? "" : val })
              }
            />
            <FilterSelect
              label="Designation"
              value={filters.designation}
              options={["All", ...FILTER_OPTIONS.designations]}
              onChange={(val) =>
                setFilters({
                  ...filters,
                  designation: val === "All" ? "" : val,
                })
              }
            />
            <FilterSelect
              label="Project"
              value={filters.project}
              options={["All", ...FILTER_OPTIONS.projects]}
              onChange={(val) =>
                setFilters({ ...filters, project: val === "All" ? "" : val })
              }
            />

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                title="Clear Filters"
              >
                <FilterX size={18} />
              </button>
            )}
          </div>
        </div>

        {/* TABLE VIEW */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Designation</th>
                <th className="px-6 py-4">Division</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <TableSkeleton />
              ) : employees.length > 0 ? (
                employees.map((emp) => (
                  <tr
                    key={emp._id}
                    className="group hover:bg-neutral-50 transition-colors"
                  >
                    {/* Name & Avatar */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-200">
                          {emp.firstName?.[0]}
                          {emp.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {emp.email || "No email"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Designation */}
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {emp.designation || "—"}
                    </td>

                    {/* Division */}
                    <td className="px-6 py-4">
                      <DivisionBadge division={emp.division} />
                    </td>

                    {/* Project */}
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {emp.project ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                          {emp.project}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                        Active
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end">
                        <ActionMenu
                          onAction={(action) => handleAction(action, emp)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="h-64">
                  <td
                    colSpan="6"
                    className="text-center text-neutral-500 text-sm"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-neutral-100 rounded-full">
                        <Search size={24} className="text-neutral-400" />
                      </div>
                      <p>No employees found matching your filters.</p>
                      <button
                        onClick={clearFilters}
                        className="text-blue-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="p-4 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white rounded-b-xl">
          {/* Rows Per Page */}
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-neutral-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">
              Page <span className="font-medium text-neutral-900">{page}</span>{" "}
              of{" "}
              <span className="font-medium text-neutral-900">{totalPages}</span>
            </span>

            <div className="flex gap-1">
              <button
                onClick={() => setPage((old) => Math.max(old - 1, 1))}
                disabled={page === 1 || isLoading}
                className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => {
                  if (!isPlaceholderData && page < totalPages) {
                    setPage((old) => old + 1);
                  }
                }}
                disabled={isPlaceholderData || page === totalPages || isLoading}
                className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      {isRoleModalOpen && selectedEmployee && (
        <Modal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          title={`Change Role - ${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
          closeLabel="Cancel"
          action={{
            label: "Confirm Role Change",
            variant: "save",
            show: true,
            onClick: () => roleChangerRef.current?.submit(),
          }}
        >
          <EmployeeRoleChanger
            ref={roleChangerRef}
            employeeId={selectedEmployee._id}
            currentRole={selectedEmployee.role}
            onRoleUpdated={() => {
              setIsRoleModalOpen(false);
              setSelectedEmployee(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

/* =========================
   HELPER COMPONENTS
========================= */

const FilterSelect = ({ label, value, options, onChange }) => (
  <div className="relative group w-full sm:w-auto min-w-[140px]">
    <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] font-semibold text-neutral-500 group-focus-within:text-blue-600 transition-colors z-10">
      {label}
    </label>
    <div className="relative">
      <select
        value={value || "All"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-3 pr-8 py-2 text-sm border border-neutral-200 rounded-lg appearance-none bg-transparent hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-neutral-400 pointer-events-none" />
    </div>
  </div>
);

const DivisionBadge = ({ division }) => {
  const styles = {
    AFD: "bg-blue-50 text-blue-700 border-blue-100",
    TOD: "bg-purple-50 text-purple-700 border-purple-100",
    STAFF: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  const defaultStyle = "bg-gray-50 text-gray-700 border-gray-100";
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-bold border ${
        styles[division] || defaultStyle
      }`}
    >
      {division || "N/A"}
    </span>
  );
};

const TableSkeleton = () =>
  [...Array(5)].map((_, i) => (
    <tr key={i}>
      <td className="px-6 py-4">
        <Skeleton circle width={32} height={32} />
      </td>
      <td className="px-6 py-4">
        <Skeleton width={100} />
      </td>
      <td className="px-6 py-4">
        <Skeleton width={60} />
      </td>
      <td className="px-6 py-4">
        <Skeleton width={80} />
      </td>
      <td className="px-6 py-4">
        <Skeleton width={60} />
      </td>
      <td className="px-6 py-4">
        <Skeleton width={20} />
      </td>
    </tr>
  ));

export default EmployeeDirectory;
