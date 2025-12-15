import { useState } from "react";
import EmployeeListView from "../components/employeeDashboard/EmployeeListView.jsx";
import EmployeeInformation from "../components/employeeDashboard/employeeInformation";
import { CardFull, CardMd } from "../components/cardComponent";
const EmployeePage = () => {
  const [selectedId, setSelectedId] = useState();
  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-4 ">
      <CardMd>
        <EmployeeListView
          setSelectedId={setSelectedId}
          maxHeightClass="max-h-96"
        />
      </CardMd>
      <CardFull>
        <EmployeeInformation selectedId={selectedId} />
      </CardFull>
    </div>
  );
};

export default EmployeePage;
