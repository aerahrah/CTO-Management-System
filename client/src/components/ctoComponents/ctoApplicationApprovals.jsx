import React from "react";
import { CardFull, CardMd } from "../cardComponent";
import CtoApplicationsList from "../ctoComponents/ctoApplicationApprovalsComponents/ctoApplicationsList";
import Breadcrumbs from "../breadCrumbs";
import { Outlet, useParams } from "react-router-dom";

const CtoApplicationApprovals = () => {
  const { id } = useParams();
  const hasSelection = Boolean(id);

  return (
    <div className="w-full  min-w-0 ">
      {/* LEFT CARD (List) */}
      <Breadcrumbs rootLabel="home" rootTo="/app" />

      <div className="flex flex-col xl:flex-row gap-3 h-[calc(100vh-3.5rem-3.5rem)]">
        <CardMd
          className={[
            // Mobile/Tablet: show list only when no selection
            hasSelection ? "hidden xl:flex" : "flex",
            // Desktop/Wide: fixed width card
            "w-full xl:w-92",
            // Keep your sticky behavior only for xl+
            "h-full flex-col xl:sticky xl:top-20",
            // Prevent overflow issues with fixed sidebar + fixed card widths
            "min-w-0",
          ].join(" ")}
        >
          <CtoApplicationsList />
        </CardMd>

        {/* RIGHT CARD (Details) */}
        <CardFull
          className={[
            // Mobile/Tablet: show details only when selection exists
            hasSelection ? "flex" : "hidden xl:flex",
            "flex-col w-full flex-1 min-w-0",
          ].join(" ")}
        >
          <Outlet />
        </CardFull>
      </div>
    </div>
  );
};

export default CtoApplicationApprovals;
