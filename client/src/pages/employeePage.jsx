import { useState } from "react";

import EmployeeInformation from "../components/employeeDashboard/employeeInformation";
import { CardFull, CardMd } from "../components/cardComponent";

import EmployeeDirectory from "../components/employeeDashboard/EmployeeListView.jsx";
const EmployeePage = () => {
  const [selectedId, setSelectedId] = useState();
  return (
    <div className=" w-[100%] flex gap-3 min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-3.5rem-1rem)]">
      <EmployeeDirectory
        setSelectedId={setSelectedId}
        selectedId={selectedId}
      />
    </div>
  );
};

export default EmployeePage;
