import { useQuery } from "@tanstack/react-query";
import { getEmployees } from "../../api/employee";
import { useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";

const EmployeeList = ({ selectedId, setSelectedId, maxHeightClass }) => {
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

  if (isLoading) return <div>Loading employees...</div>;
  if (isError) return <div>Failed to load employees.</div>;

  return (
    <div className="flex flex-col ">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 px-2">
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
      <ul
        className={`flex flex-col py-1 gap-2 overflow-y-auto px-2 ${maxHeightClass}`}
      >
        {filteredEmployees.map((item) => {
          const initials = `${item.firstName[0]}${item.lastName[0]}`;
          return (
            <li
              key={item._id}
              onClick={() => setSelectedId(item._id)}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                         transition-colors shadow-sm hover:bg-neutral-50
                         ${
                           selectedId === item._id
                             ? "bg-blue-50 border-neutral-400"
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

        {filteredEmployees.length === 0 && (
          <li className="text-gray-500 italic text-center py-4 text-sm">
            No employees found
          </li>
        )}
      </ul>
    </div>
  );
};

export default EmployeeList;
