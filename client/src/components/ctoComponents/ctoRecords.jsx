// CtoRecords.jsx
import { useState } from "react";
import { CardFull, CardMd } from "../cardComponent";
import CtoEmployeeInformation from "./ctoCreditHistory/ctoEmployeeInformation";
import CtoEmployeeListView from "./ctoCreditHistory/ctoEmployeeListView";
import { useParams } from "react-router-dom";

const CtoRecords = () => {
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);
  const { id } = useParams();
  const hasSelection = Boolean(id);

  return (
    <div className="w-full flex flex-col xl:flex-row gap-3 min-w-0 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem-1.5rem)]">
      {/* LEFT CARD (List) */}
      <CardMd
        className={[
          hasSelection ? "hidden xl:flex" : "flex",
          "w-full xl:w-92",
          "h-full flex-col xl:sticky xl:top-20",
          "min-w-0",
        ].join(" ")}
      >
        <CtoEmployeeListView setIsEmployeeLoading={setIsEmployeeLoading} />
      </CardMd>

      {/* RIGHT CARD (Info) */}
      <CardFull
        className={[
          hasSelection ? "flex" : "hidden xl:flex",
          "flex-col w-full flex-1 min-w-0",
        ].join(" ")}
      >
        <CtoEmployeeInformation
          isEmployeeLoadingFromEmployeeList={isEmployeeLoading}
        />
      </CardFull>
    </div>
  );
};

export default CtoRecords;
