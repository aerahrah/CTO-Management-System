import React, { useState } from "react";
import { fetchMyCtoApplicationsApprovals } from "../../api/cto";
import CtoApplicationsList from "../ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsList";
import CtoApplicationDetails from "../ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsDetails";
import { useQuery } from "@tanstack/react-query";
import { CardFull, CardMd } from "../cardComponent";
const CtoApplicationApprovals = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ctoApplicationsApprovals"],
    queryFn: fetchMyCtoApplicationsApprovals,
  });

  const [selectedApp, setSelectedApp] = useState(null);

  if (isLoading)
    return <p className="p-4 text-gray-500">Loading applications...</p>;
  if (isError)
    return <p className="p-4 text-red-500">Error: {error.message}</p>;

  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-4 ">
      <CardMd>
        <CtoApplicationsList
          applications={data?.data || []}
          selectedId={selectedApp?._id}
          onSelect={setSelectedApp}
        />
      </CardMd>
      <CardFull>
        <CtoApplicationDetails
          application={selectedApp}
          onSelect={setSelectedApp}
        />
      </CardFull>
    </div>
  );
};

export default CtoApplicationApprovals;
