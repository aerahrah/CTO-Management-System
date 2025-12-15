import React, { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const CtoApplicationsList = ({
  applications,
  selectedId,
  onSelect,
  isLoading,
}) => {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const { admin } = useAuth();

  useEffect(() => {
    if (applications?.length > 0 && !selectedId) {
      onSelect(applications[0]);
    }
  }, [applications, selectedId, onSelect]);

  const filteredApps = useMemo(() => {
    if (!applications) return [];
    return applications
      .filter((app) => {
        const fullName = `${app.employee?.firstName || ""} ${
          app.employee?.lastName || ""
        }`.toLowerCase();
        return fullName.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const nameA = `${a.employee?.firstName || ""} ${
          a.employee?.lastName || ""
        }`.toLowerCase();
        const nameB = `${b.employee?.firstName || ""} ${
          b.employee?.lastName || ""
        }`.toLowerCase();
        return sortOrder === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      });
  }, [applications, search, sortOrder]);

  return (
    <div className="">
      {/* Header - always visible */}
      <div className="px-2 pb-2 text-xl font-bold text-gray-800">
        CTO Applications List
      </div>

      {/* Controls - always visible */}
      <div className="flex items-center gap-2 pb-4 px-2 bg-white">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search applicant..."
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

      {/* Application List */}
      <ul className="flex flex-col gap-2 overflow-y-auto px-2 max-h-132">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-2 p-0.5 rounded-lg border bg-white shadow-sm bg-white border-neutral-200/80"
            >
              <div className="h-9 w-9 flex items-center justify-center rounded-full bg-neutral-200/80">
                <Skeleton circle height={36} width={36} />
              </div>
              <div className="flex flex-col flex-1 gap-[-.25rem]">
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
                <Skeleton width="30%" height={12} />
              </div>
              <div className="w-20">
                <Skeleton width="100%" height={20} />
              </div>
            </li>
          ))
        ) : filteredApps.length > 0 ? (
          filteredApps.map((app) => {
            const initials = `${app.employee?.firstName?.[0] || ""}${
              app.employee?.lastName?.[0] || ""
            }`;
            return (
              <li
                key={app._id}
                onClick={() => onSelect(app)}
                className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer 
                              transition-colors shadow-sm hover:bg-neutral-50
                              ${
                                selectedId === app._id
                                  ? "bg-blue-50 border-neutral-400"
                                  : "bg-white border-neutral-200/80"
                              }`}
              >
                <div className="h-9 w-9 flex items-center justify-center rounded-full bg-neutral-200/80 text-neutral-700 font-semibold text-sm">
                  {initials}
                </div>
                <div className="flex flex-col flex-1">
                  <span className="font-medium text-neutral-800 text-sm">
                    {app.employee?.firstName} {app.employee?.lastName}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {app.employee?.position || "No position"}
                  </span>
                  <span className="text-xs text-neutral-400 mt-0.5">
                    Requested: {app.requestedHours} hrs
                  </span>
                </div>
                <StatusBadge
                  status={
                    app.approvals?.find(
                      (step) => step.approver?._id === admin?.id
                    )?.status || app.overallStatus
                  }
                />
              </li>
            );
          })
        ) : (
          <li className="text-gray-500 italic text-center py-4 text-sm">
            No applications found
          </li>
        )}
      </ul>
    </div>
  );
};

export default CtoApplicationsList;
