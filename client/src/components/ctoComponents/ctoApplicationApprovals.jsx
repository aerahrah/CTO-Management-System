import React, { useState } from "react";
import { fetchMyCtoApplicationsApprovals } from "../../api/cto";
import CtoApplicationsList from "../ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsList";
import CtoApplicationDetails from "../ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsDetails";
import { useQuery } from "@tanstack/react-query";
import { CardFull, CardMd } from "../cardComponent";
import Spinner from "../spinner";
import ErrorMessage from "../errorComponent";

const CtoApplicationApprovals = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ctoApplicationsApprovals"],
    queryFn: fetchMyCtoApplicationsApprovals,
  });

  const [selectedApp, setSelectedApp] = useState(null);

  if (isError) return <ErrorMessage message={error.message} />;

  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-3 h-[calc(100vh-4rem-1.5rem)]">
      <CardMd className="sticky h-full top-20 flex flex-col">
        <CtoApplicationsList
          applications={data?.data || []}
          selectedId={selectedApp?._id}
          onSelect={setSelectedApp}
          isLoading={isLoading}
        />
      </CardMd>
      <CardFull className="flex flex-col">
        <CtoApplicationDetails
          application={selectedApp}
          onSelect={setSelectedApp}
        />
      </CardFull>
    </div>
  );
};

export default CtoApplicationApprovals;
