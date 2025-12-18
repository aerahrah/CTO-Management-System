import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  fetchEmployeeCredits,
  fetchEmployeeDetails,
  fetchEmployeeApplications,
} from "../../../api/cto";
import CreditCtoTable from "./ctoEmployeeCreditTable";
import ApplicationCtoTable from "./ctoEmployeeApplicationTable";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const EmployeeInfoSkeleton = () => {
  return (
    <div className="p-4 space-y-4">
      {/* Header section */}
      <div className="flex justify-between mb-4">
        <div className="space-y-2">
          <Skeleton width={180} height={24} />
          <Skeleton width={140} height={14} />
          <Skeleton width={160} height={14} />
          <Skeleton width={200} height={14} />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-2 bg-gray-50 rounded-lg border border-neutral-300 text-center"
            >
              <Skeleton width={120} height={12} />
              <Skeleton width={60} height={18} className="mt-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Skeleton width={120} height={40} />
        <Skeleton width={140} height={40} />
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        {[...Array(7)].map((i) => (
          <Skeleton key={i} height={40} />
        ))}
      </div>
    </div>
  );
};

const CtoEmployeeInformation = ({
  selectedId,
  isEmployeeLoadingFromEmployeeList,
}) => {
  const [activeTab, setActiveTab] = useState("credit");

  // Fetch employee info
  const {
    data: employeeData,
    isLoading: isEmployeeLoading,
    isError: isEmployeeError,
  } = useQuery({
    queryKey: ["employeeDetails", selectedId],
    queryFn: () => fetchEmployeeDetails(selectedId),
    enabled: !!selectedId,
  });

  // Fetch credits
  const {
    data: creditData,
    isLoading: isCreditLoading,
    isError: isCreditError,
  } = useQuery({
    queryKey: ["employeeCredits", selectedId],
    queryFn: () => fetchEmployeeCredits(selectedId),
    enabled: !!selectedId,
  });

  // Fetch applications
  const {
    data: applicationData,
    isLoading: isApplicationLoading,
    isError: isApplicationError,
  } = useQuery({
    queryKey: ["employeeApplications", selectedId],
    queryFn: () => fetchEmployeeApplications(selectedId),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (creditData) console.log("Employee Credits:", creditData);
    if (applicationData) console.log("Employee Applications:", applicationData);
  }, [creditData, applicationData]);

  if (!selectedId || isEmployeeLoadingFromEmployeeList) {
    return <EmployeeInfoSkeleton />;
  }

  if (isEmployeeLoading || isCreditLoading || isApplicationLoading)
    return <EmployeeInfoSkeleton />;

  if (isEmployeeError || isCreditError || isApplicationError)
    return (
      <div className="p-4 text-red-500 text-center">Error fetching data.</div>
    );

  const employee = employeeData?.employee;
  const credits = creditData?.credits || [];
  const applications = applicationData?.applications || [];

  const totalEarned = credits
    .filter((c) => c.status === "CREDITED")
    .reduce((sum, c) => {
      const dur = c.duration;
      if (!dur) return sum;
      const hours = typeof dur.hours === "number" ? dur.hours : 0;
      const minutes = typeof dur.minutes === "number" ? dur.minutes : 0;
      const total = hours + minutes / 60;
      return sum + total;
    }, 0);

  const totalUsed = 0;
  const balance = totalEarned - totalUsed;

  return (
    <div className="p-4">
      {/* Employee Info */}
      <div className="flex justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">
            {employee.firstName} {employee.lastName}
          </h2>
          <p className="text-sm text-gray-600">Position: {employee.position}</p>
          <p className="text-sm text-gray-600">
            Department: {employee.department}
          </p>
          <p className="text-sm text-gray-600">Email: {employee.email}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 items-start">
          <div className="p-2 flex flex-col gap-2 bg-gray-100 rounded-lg border border-neutral-300 text-center">
            <p className="text-xs font-semibold text-gray-500">
              Overall Earned CTO
            </p>
            <p className="text-sm font-bold p-1 bg-white rounded-full border-1 border-neutral-300 border-dashed text-green-700">
              {totalEarned.toFixed(2)} hrs
            </p>
          </div>
          <div className="p-2 flex flex-col gap-2 bg-gray-100 rounded-lg border border-neutral-300 text-center">
            <p className="text-xs font-semibold text-gray-500 ">
              Overall Used CTO
            </p>
            <p className="text-sm font-bold p-1 bg-white rounded-full border-1 border-neutral-300 border-dashed text-red-700">
              {totalUsed.toFixed(2)} hrs
            </p>
          </div>
          <div className="p-2 flex flex-col gap-2 bg-gray-100 rounded-lg border border-neutral-300 text-center">
            <p className="text-xs font-semibold text-gray-500">
              Total Balance:
            </p>
            <p className="text-sm font-bold p-1 bg-white rounded-full border-1 border-neutral-300 border-dashed text-green-700">
              {balance.toFixed(2)} hrs
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-5 py-2.5 font-medium transition rounded-t-lg cursor-pointer ${
            activeTab === "credit"
              ? "bg-neutral-800 text-white"
              : "text-neutral-500 bg-neutral-100"
          }`}
          onClick={() => setActiveTab("credit")}
        >
          Credit CTO
        </button>
        <button
          className={`px-5 py-2.5 font-medium transition rounded-t-lg cursor-pointer ${
            activeTab === "application"
              ? "bg-neutral-800 text-white"
              : "text-neutral-500 bg-neutral-100"
          }`}
          onClick={() => setActiveTab("application")}
        >
          Application CTO
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "credit" ? (
        <CreditCtoTable credits={credits} />
      ) : (
        <ApplicationCtoTable applications={applications} />
      )}
    </div>
  );
};

export default CtoEmployeeInformation;
