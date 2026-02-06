// CtoRecords.jsx
import { useState } from "react";
import { CardFull, CardMd } from "../cardComponent";
import CtoEmployeeInformation from "./ctoCreditHistory/ctoEmployeeInformation";
import { Outlet } from "react-router-dom";
import CtoEmployeeListView from "./ctoCreditHistory/ctoEmployeeListView";
import { useParams } from "react-router-dom";
import Breadcrumbs from "../breadCrumbs";

const CtoRecords = () => {
  const { id } = useParams();
  const hasSelection = Boolean(id);

  return (
    <div className="w-full  min-w-0 ">
      {/* LEFT CARD (List) */}
      <Breadcrumbs rootLabel="home" rootTo="/app" />

      <div className="flex flex-col xl:flex-row gap-3 h-[calc(100vh-3.5rem-3.5rem)]">
        <CardMd
          className={[
            hasSelection ? "hidden xl:flex" : "flex",
            "w-full xl:w-92",
            "h-full flex-col xl:sticky xl:top-20",
            "min-w-0",
          ].join(" ")}
        >
          <CtoEmployeeListView />
        </CardMd>

        {/* RIGHT CARD (Info) */}
        <CardFull
          className={[
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

export default CtoRecords;
