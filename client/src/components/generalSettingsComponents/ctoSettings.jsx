// src/components/cto/CtoSettings.jsx
import React, { useState } from "react";
import OfficeLocationList from "./officeLocationList";
import ApproverSettings from "./ctoApproverSetting";
import { CardFull, CardMd } from "../cardComponent";

const CtoSettings = () => {
  const [selectedDesignation, setSelectedDesignation] = useState(null);

  return (
    <div className="w-[100%] flex gap-3 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem-1rem)]">
      <CardMd className="sticky h-full top-20 flex flex-col">
        <OfficeLocationList
          selectedDesignation={selectedDesignation}
          setSelectedDesignation={setSelectedDesignation}
        />
      </CardMd>

      <CardFull>
        <ApproverSettings selectedDesignation={selectedDesignation} />
      </CardFull>
    </div>
  );
};

export default CtoSettings;
