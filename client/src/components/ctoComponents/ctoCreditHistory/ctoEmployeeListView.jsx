import EmployeeList from "../../employeeList/employeeList";

const CtoEmployeeListView = ({
  setSelectedId,
  selectedId,
  setIsEmployeeLoading,
}) => {
  return (
    <>
      <h1 className="text-xl font-semibold px-2 pb-2">Employees List</h1>
      <EmployeeList
        setSelectedId={setSelectedId}
        selectedId={selectedId}
        setIsEmployeeLoading={setIsEmployeeLoading}
        maxHeightClass="max-h-120"
      />
    </>
  );
};

export default CtoEmployeeListView;
