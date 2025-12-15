import { useState } from "react";
import { CardFull, CardMd } from "../cardComponent";
import CtoEmployeeInformation from "./ctoCreditHistory/ctoEmployeeInformation";
import CtoEmployeeListView from "./ctoCreditHistory/ctoEmployeeListView";
const CtoRecords = () => {
  const [selectedId, setSelectedId] = useState();
  const [isEmployeeLoading, setIsEmployeeLoading] = useState();
  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-4 ">
      <CardMd>
        <CtoEmployeeListView
          setSelectedId={setSelectedId}
          selectedId={selectedId}
          setIsEmployeeLoading={setIsEmployeeLoading}
        />
      </CardMd>
      <CardFull>
        <CtoEmployeeInformation
          selectedId={selectedId}
          isEmployeeLoading={isEmployeeLoading}
        />
      </CardFull>
    </div>
  );
};

export default CtoRecords;
