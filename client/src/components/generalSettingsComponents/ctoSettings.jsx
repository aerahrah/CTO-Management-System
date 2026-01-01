import React, { useState } from "react";
import OfficeLocationList from "./officeLocationList";
import ApproverSettings from "./ctoApproverSetting";
import { CardFull, CardMd } from "../cardComponent";
const CtoSettings = () => {
  const [selectedOffice, setSelectedOffice] = useState(null);

  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-3 h-[calc(100vh-4rem-1.5rem)]">
      <CardMd className="sticky h-full top-20 flex flex-col">
        <OfficeLocationList
          selectedOffice={selectedOffice}
          setSelectedOffice={setSelectedOffice}
        />
      </CardMd>
      <CardFull>
        <ApproverSettings selectedOffice={selectedOffice} />
      </CardFull>
    </div>
  );
};

export default CtoSettings;
