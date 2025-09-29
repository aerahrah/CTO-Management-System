import { useQueryClient, useMutation } from "@tanstack/react-query";
import { addEmployee } from "../../api/employee";
import { useState } from "react";
import EmployeeList from "../employeeList/employeeList";
import Modal from "../modal";
import AddEmployeeForm from "./forms/addEmployeeForm";

const EmployeeListView = ({ setSelectedId, maxHeightClass }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // mutation for adding employee
  const { mutateAsync: createEmployee, isPending: isSaving } = useMutation({
    mutationFn: addEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries(["employees"]); // refresh list
      setIsOpen(false);
    },
    onError: (err) => {
      console.error("Failed to add employee:", err);
      alert("Failed to save employee. Please try again.");
    },
  });

  return (
    <>
      <div className="px-2">
        <h1 className="text-xl mb-2 font-semibold">Employees List</h1>
        <div className="text-sm w-full flex gap-2">
          <button className="w-full rounded-sm mb-3 p-2.5 bg-neutral-800 text-neutral-100 hover:bg-neutral-800/90 text-sm font-medium shadow-sm transition hover:cursor-pointer active:scale-96">
            Download Employees List
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="w-48 rounded-sm mb-3 p-2.5 bg-neutral-800 text-neutral-100 hover:bg-neutral-800/90 text-sm font-medium shadow-sm transition hover:cursor-pointer active:scale-96"
          >
            Add Employee
          </button>
        </div>
      </div>
      <EmployeeList setSelectedId={setSelectedId} maxHeightClass="max-h-96" />

      {/* Modal with Form */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add Employee"
      >
        <AddEmployeeForm
          onCancel={() => setIsOpen(false)}
          onSubmit={async (data) => {
            await createEmployee(data);
          }}
        />
        {isSaving && <p className="text-sm text-gray-500 mt-2">Saving...</p>}
      </Modal>
    </>
  );
};

export default EmployeeListView;
