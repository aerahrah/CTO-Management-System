import React, { useState } from "react";
import ProvincialOfficesList from "././provincialOfficeList";
import ApproverSettings from "./ctoApproverSetting";
import { CardFull, CardMd } from "../cardComponent";
const CtoSettings = () => {
  const [selectedOffice, setSelectedOffice] = useState(null);

  return (
    <div className="w-[100%] bg-neutral-200 flex gap-4 p-6">
      <div className=" w-[100%] bg-neutral-200 flex gap-4 ">
        <CardMd>
          <ProvincialOfficesList
            selectedOffice={selectedOffice}
            setSelectedOffice={setSelectedOffice}
          />
        </CardMd>
        <CardFull>
          <ApproverSettings selectedOffice={selectedOffice} />
        </CardFull>
      </div>
    </div>
  );
};

export default CtoSettings;
