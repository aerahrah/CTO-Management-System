import { useState } from "react";
import EmployeeListView from "../components/employeeDashboard/EmployeeListView.jsx";
import EmployeeInformation from "../components/employeeDashboard/employeeInformation";
import { CardFull, CardMd } from "../components/cardComponent";
const EmployeePage = () => {
  const [selectedId, setSelectedId] = useState();
  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-3 h-[calc(100vh-4rem-1.5rem)]">
      <CardMd className="sticky h-full top-0 flex flex-col">
        <EmployeeListView
          setSelectedId={setSelectedId}
          selectedId={selectedId}
        />
      </CardMd>
      <CardFull>
        <EmployeeInformation selectedId={selectedId} />
      </CardFull>
    </div>
  );
};

export default EmployeePage;
