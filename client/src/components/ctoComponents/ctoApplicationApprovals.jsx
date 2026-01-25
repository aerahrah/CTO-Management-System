import React from "react";
import { CardFull, CardMd } from "../cardComponent";
import CtoApplicationsList from "../ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsList";
import { Outlet } from "react-router-dom";

const CtoApplicationApprovals = () => {
  return (
    <div className="w-full flex gap-3 h-[calc(100vh-3.5rem-1rem)]">
      <CardMd className="sticky h-full top-20 flex flex-col">
        <CtoApplicationsList />
      </CardMd>

      <CardFull className="flex flex-col">
        <Outlet />
      </CardFull>
    </div>
  );
};

export default CtoApplicationApprovals;
