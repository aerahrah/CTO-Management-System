import { useState } from "react";
import { CardFull, CardMd } from "../cardComponent";
import CtoEmployeeInformation from "./ctoCreditHistory/ctoEmployeeInformation";
import CtoEmployeeListView from "./ctoCreditHistory/ctoEmployeeListView";
const CtoRecords = () => {
  const [selectedId, setSelectedId] = useState();
  const [isEmployeeLoading, setIsEmployeeLoading] = useState();
  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-3 h-[calc(100vh-4rem-1.5rem)]">
      <CardMd className="sticky h-full top-20 flex flex-col">
        <CtoEmployeeListView
          setSelectedId={setSelectedId}
          selectedId={selectedId}
          setIsEmployeeLoading={setIsEmployeeLoading}
        />
      </CardMd>
      <CardFull>
        <CtoEmployeeInformation
          selectedId={selectedId}
          isEmployeeLoadingFromEmployeeList={isEmployeeLoading}
        />
      </CardFull>
    </div>
  );
};

export default CtoRecords;
