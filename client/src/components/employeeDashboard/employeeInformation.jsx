import { useQuery } from "@tanstack/react-query";
import { getEmployeeById } from "../../api/employee";
import { useState } from "react";
import Modal from "../modal";
import AddEmployeeForm from "./forms/addEmployeeForm";

const EmployeeInformation = ({ selectedId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    data: employee,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["employee", selectedId],
    queryFn: () => getEmployeeById(selectedId),
    enabled: !!selectedId,
    staleTime: Infinity,
  });
  console.log(isLoading);
  console.log(employee);
  if (isLoading) {
    return <div className="p-4">Loading employee...</div>;
  }
  return (
    <>
      <menu>
        <ul className="flex gap-2">
          <li>Edit Profile</li>
          <li>Edit Profile</li>
          <li>Edit Profile</li>
          <li>Edit Profile</li>
        </ul>
      </menu>
      <h1 className="text-2xl font-semibold">
        {employee?.data?.firstName} {employee?.data?.lastName}
      </h1>
      <div className="mt-6 border-1 border-neudival-300 p-6">
        <div>
          <div className="flex gap-4">
            <div>
              <div className="flex gap-4">
                <p className="flex justify-between min-w-28">
                  First Name <span>:</span>
                </p>
                <p>{employee?.data?.firstName}</p>
              </div>
              <div className="flex gap-4">
                <p className="flex justify-between min-w-28">
                  Middle Name <span>:</span>
                </p>
                <p>{employee?.data?.lastName}</p>
              </div>
              <div className="flex gap-4">
                <p className="flex justify-between min-w-28">
                  Last Name <span>:</span>
                </p>
                <p>{employee?.data?.lastName}</p>
              </div>
            </div>
            <div>
              <div className="flex gap-4">
                <p className="flex justify-between min-w-28">
                  Employee Id <span>:</span>
                </p>
                <p>{employee?.data?.employeeId}</p>
              </div>
            </div>
          </div>
          <div>
            <div className="flex gap-4">
              <p className="flex justify-between min-w-28">
                Email <span>:</span>
              </p>
              <p>{employee?.data?.email}</p>
            </div>
            <div className="flex gap-4">
              <p className="flex justify-between min-w-28">
                Mobile Number <span>:</span>
              </p>
              <p>{employee?.data?.phone}</p>
            </div>
            <div className="flex gap-4">
              <p className="flex justify-between min-w-28">
                Status <span>:</span>
              </p>
              <p>{employee?.data?.status}</p>
            </div>
          </div>
        </div>
        <h1></h1>
        <button>Download Employees List</button>
        <input
          className="w-full border-1 rounded-sm p-2.5 border-neudival-300 focus:outline-none focus:border-neudival-500"
          name="Search Employee"
          placeholder="Username"
        />
      </div>

      <div>
        <h1>Basic Information</h1>
        <ul></ul>
      </div>
    </>
  );
};

export default EmployeeInformation;
