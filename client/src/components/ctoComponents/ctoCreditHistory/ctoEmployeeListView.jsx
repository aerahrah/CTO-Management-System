import { useQuery } from "@tanstack/react-query";
import { getEmployees } from "../../../api/employee";
import { useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import ErrorMessage from "../../errorComponent";

/* ================================
   CTO EMPLOYEE LIST VIEW
================================ */
const CtoEmployeeListView = ({
  setSelectedId,
  selectedId,
  setIsEmployeeLoading,
}) => {
  return (
    <>
      <h1 className="text-xl font-semibold px-2 pb-2">Employees List</h1>
      <EmployeeList
        setSelectedId={setSelectedId}
        selectedId={selectedId}
        setIsEmployeeLoading={setIsEmployeeLoading}
        maxHeightClass="max-h-120"
      />
    </>
  );
};

/* ================================
   EMPLOYEE LIST
================================ */
const EmployeeList = ({ selectedId, setSelectedId, setIsEmployeeLoading }) => {
  const {
    data: employees,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    staleTime: Infinity,
  });

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    if (employees?.data?.length > 0 && !selectedId) {
      setSelectedId(employees.data[0]._id);
    }
  }, [employees, selectedId, setSelectedId]);

  useEffect(() => {
    if (setIsEmployeeLoading) {
      setIsEmployeeLoading(isLoading);
    }
  }, [isLoading, setIsEmployeeLoading]);

  const filteredEmployees = useMemo(() => {
    if (!employees?.data) return [];

    return employees.data
      .filter((emp) => {
        const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        return fullName.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return sortOrder === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      });
  }, [employees, search, sortOrder]);

  if (isError) return <ErrorMessage message="Failed to load employees" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-lg 
                       bg-gray-50 focus:bg-white focus:ring-1 focus:ring-neutral-400 
                       focus:border-neutral-400 outline-none text-sm"
          />
        </div>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm 
                     bg-gray-50 focus:bg-white focus:ring-1 focus:ring-neutral-400 
                     focus:border-neutral-400 outline-none text-sm"
        >
          <option value="asc">A–Z</option>
          <option value="desc">Z–A</option>
        </select>
      </div>

      {/* Employee List */}
      <ul className="flex flex-col py-1 gap-2 overflow-y-auto">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg border shadow-sm bg-white border-neutral-200/80"
              >
                <div className="h-9 w-9 rounded-full flex items-center justify-center">
                  <Skeleton circle height={36} width={36} />
                </div>

                <div className="flex flex-col flex-1 gap-0.25">
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="40%" height={12} />
                </div>
              </li>
            ))
          : filteredEmployees.map((item) => {
              const initials = `${item.firstName[0]}${item.lastName[0]}`;
              console.log(item);

              return (
                <li
                  key={item._id}
                  onClick={() => setSelectedId(item._id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                             transition-colors shadow-sm hover:bg-neutral-50
                             ${
                               selectedId === item._id
                                 ? "bg-neutral-100 border-neutral-400/70"
                                 : "bg-white border-neutral-200/80"
                             }`}
                >
                  <div
                    className="h-9 w-9 flex items-center justify-center rounded-full 
                               bg-neutral-200/80 text-neutral-700 font-semibold text-sm"
                  >
                    {initials}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-neutral-800 text-sm">
                      {item.firstName} {item.lastName}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.department}
                    </span>
                  </div>
                </li>
              );
            })}

        {filteredEmployees.length === 0 && !isLoading && (
          <li className="text-gray-500 italic text-center py-4 text-sm">
            No employees found
          </li>
        )}
      </ul>
    </div>
  );
};

export default CtoEmployeeListView;
