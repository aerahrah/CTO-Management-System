// src/components/cto/CtoSettings.jsx
import React from "react";
import { Outlet, useParams } from "react-router-dom";
import OfficeLocationList from "./officeLocationList";
import { CardFull, CardMd } from "../cardComponent";
import Breadcrumbs from "../breadCrumbs";

const CtoSettings = () => {
  const { designationId } = useParams();
  const hasSelection = Boolean(designationId);

  return (
    <div className="w-full min-w-0 pt-2">
      <div className="px-1">
        <Breadcrumbs rootLabel="home" rootTo="/app" />
      </div>
      <div className="flex flex-col xl:flex-row gap-3 h-[calc(100vh-3.5rem-2.5rem)] md:h-[calc(100vh-3.75rem-3.5rem)]">
        {/* LEFT CARD (List) */}

        <CardMd
          className={[
            hasSelection ? "hidden xl:flex" : "flex",
            "w-full xl:w-92",
            "h-full flex-col xl:sticky xl:top-20",
            "min-w-0",
          ].join(" ")}
        >
          <OfficeLocationList />
        </CardMd>

        {/* RIGHT CARD (Content) */}
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

export default CtoSettings;
