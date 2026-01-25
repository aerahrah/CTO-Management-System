import { useState } from "react";
import { CardFull, CardMd } from "../cardComponent";
import CtoEmployeeInformation from "./ctoCreditHistory/ctoEmployeeInformation";
import CtoEmployeeListView from "./ctoCreditHistory/ctoEmployeeListView";
const CtoRecords = () => {
  const [isEmployeeLoading, setIsEmployeeLoading] = useState();
  return (
    <div className=" w-[100%] flex gap-3 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem-1rem)]">
      <CardMd className="sticky h-full top-20 flex flex-col">
        <CtoEmployeeListView setIsEmployeeLoading={setIsEmployeeLoading} />
      </CardMd>
      <CardFull>
        <CtoEmployeeInformation
          isEmployeeLoadingFromEmployeeList={isEmployeeLoading}
        />
      </CardFull>
    </div>
  );
};

export default CtoRecords;
