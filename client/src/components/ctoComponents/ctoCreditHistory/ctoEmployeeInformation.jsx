import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchEmployeeCredits, fetchEmployeeDetails } from "../../../api/cto";
import CreditCtoTable from "./ctoEmployeeCreditTable";

const CtoEmployeeInformation = ({ selectedId }) => {
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

  if (!selectedId)
    return (
      <div className="p-4 text-gray-500 text-center">No employee selected.</div>
    );
  if (isEmployeeLoading || isCreditLoading)
    return <div className="p-4 text-gray-500 text-center">Loading...</div>;
  if (isEmployeeError || isCreditError)
    return (
      <div className="p-4 text-red-500 text-center">Error fetching data.</div>
    );

  const employee = employeeData?.employee;
  const credits = creditData?.creditRequests || [];

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
    <div>
      {/* Employee Info */}
      <div className="flex justify-between">
        <div className="mb-4">
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
          <div className="p-2 bg-gray-50 rounded-lg border-1 border-neutral-300  text-center">
            <p className="text-xs text-gray-500">Overall Earned CTO</p>
            <p className="text-sm font-semibold">
              {totalEarned.toFixed(2)} hrs
            </p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg border-1 border-neutral-300  text-center">
            <p className="text-xs text-gray-500">Overall Used CTO</p>
            <p className="text-sm font-semibold">{totalUsed.toFixed(2)} hrs</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg border-1 border-neutral-300 text-center ">
            <p className="text-xs text-gray-500">Total Balance:</p>
            <p className="text-sm font-semibold ">{balance.toFixed(2)} hrs</p>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          className={`px-5 py-2.5 font-medium transition rounded-t-lg cursor-pointer ${
            activeTab === "credit"
              ? " bg-neutral-800  text-white"
              : "text-neutral-500 bg-neutral-100"
          }`}
          onClick={() => setActiveTab("credit")}
        >
          Credit CTO
        </button>
        <button
          className={`px-5 py-2.5 font-medium transition  rounded-t-lg cursor-pointer  ${
            activeTab === "application"
              ? " bg-neutral-800 text-white"
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
        <div className="p-4 text-gray-500 text-center">
          Application CTO component will be here.
        </div>
      )}
    </div>
  );
};

export default CtoEmployeeInformation;
