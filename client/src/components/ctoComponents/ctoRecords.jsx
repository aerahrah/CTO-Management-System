import { useState } from "react";
import { CardFull, CardMd } from "../cardComponent";
import CtoEmployeeInformation from "./ctoCreditHistory/ctoEmployeeInformation";
import CtoEmployeeListView from "./ctoCreditHistory/ctoEmployeeListView";
const CtoRecords = () => {
  const [selectedId, setSelectedId] = useState();
  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-4 ">
      <CardMd>
        <CtoEmployeeListView setSelectedId={setSelectedId} />
      </CardMd>
      <CardFull>
        <CtoEmployeeInformation selectedId={selectedId} />
      </CardFull>
    </div>
  );
};

export default CtoRecords;
