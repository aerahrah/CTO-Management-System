import { useQueryClient, useMutation } from "@tanstack/react-query";
import { addEmployee } from "../../api/employee";
import { useState } from "react";
import { CustomButton } from "../customButton"; // ✅ using your custom button
import EmployeeList from "../employeeList/employeeList";
import Modal from "../modal";
import AddEmployeeForm from "./forms/addEmployeeForm";
import { toast } from "react-toastify";

const EmployeeListView = ({ selectedId, setSelectedId, maxHeightClass }) => {
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
      toast.error("Failed to save employee. Please try again.");
    },
  });

  return (
    <>
      <div className="px-2">
        <h1 className="text-xl mb-2 font-semibold">Employees List</h1>
        <div className="text-sm w-full flex gap-2">
          <CustomButton
            label="Download Employees List"
            variant="primary"
            className="w-full mb-3"
            onClick={() => toast.warning("Download feature coming soon!")}
          />

          <CustomButton
            label="Add Employee"
            variant="primary"
            className="w-48 mb-3"
            onClick={() => setIsOpen(true)}
          />
        </div>
      </div>

      <EmployeeList
        setSelectedId={setSelectedId}
        selectedId={selectedId}
        maxHeightClass="max-h-96"
      />

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add Employee"
        action={{
          label: isSaving ? "Saving..." : "Save",
          onClick: () => {
            const form = document.getElementById("employeeForm");
            if (form) form.requestSubmit();
          },
          show: true,
          variant: "save",
        }}
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
