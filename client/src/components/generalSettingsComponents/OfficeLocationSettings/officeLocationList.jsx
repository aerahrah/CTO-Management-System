import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Modal from "../../modal";
import { CustomButton } from "../../customButton";
import {
  fetchAllProvincialOffices,
  createProvincialOffice,
} from "../../../api/officeLocation";

// Office form
const OfficeLocationForm = ({ onSubmit, office }) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [province, setProvince] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (office) {
      setName(office.name || "");
      setCode(office.code || "");
      setProvince(office.province || "");
      setRegion(office.region || "");
    } else {
      setName("");
      setCode("");
      setProvince("");
      setRegion("");
    }
  }, [office]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim())
      return alert("Name and code are required.");
    onSubmit({ name, code, province, region });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id="office-form">
      <div>
        <label className="block text-sm font-medium mb-1">Office Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-2 rounded"
          placeholder="Enter office name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Province</label>
        <input
          type="text"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          className="w-full border p-2 rounded"
          placeholder="Enter province"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Region</label>
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full border p-2 rounded"
          placeholder="Enter region"
        />
      </div>
    </form>
  );
};

// Main component
const OfficeLocationList = ({
  selectedOffice,
  setSelectedOffice,
  maxHeightClass,
}) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch offices
  const {
    data: offices = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["provincialOffices"],
    queryFn: fetchAllProvincialOffices,
  });

  // Create office mutation
  const createMutation = useMutation({
    mutationFn: createProvincialOffice,
    onSuccess: () => {
      queryClient.invalidateQueries(["provincialOffices"]);
      setModalOpen(false);
    },
    onError: (err) => alert(err.response?.data?.message || err.message),
  });

  const openAddModal = () => setModalOpen(true);

  return (
    <div className="flex flex-col pb-4">
      {/* Header */}
      <div className="border-b pb-3 mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold px-2 text-gray-700">
          Provincial Offices
        </h2>
        <CustomButton
          label="Add Office"
          variant="primary"
          className="w-32"
          onClick={openAddModal}
        />
      </div>

      {/* List */}
      <ul
        className={`flex flex-col p-2 gap-3 ${maxHeightClass} overflow-y-auto`}
      >
        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 p-3 py-3.5 rounded-lg border border-neutral-200/80 bg-white shadow-sm"
            >
              <Skeleton width={250} height={18} />
            </li>
          ))
        ) : isError ? (
          <li className="p-4 bg-white rounded-lg shadow-sm text-center text-red-500">
            Failed to load provincial offices.
          </li>
        ) : offices.length > 0 ? (
          offices.map((office) => (
            <li
              key={office._id}
              onClick={() => setSelectedOffice(office)}
              className={`flex items-center gap-3 p-3 py-4 rounded-lg border cursor-pointer shadow-sm transition-colors hover:bg-neutral-50 ${
                selectedOffice?._id === office._id
                  ? "bg-blue-50 border-neutral-400 font-medium"
                  : "bg-white border-neutral-200/80"
              }`}
            >
              <span className="text-sm text-neutral-800">{office.name}</span>
            </li>
          ))
        ) : (
          <li className="text-gray-500 italic text-center py-4 text-sm">
            No provincial offices found
          </li>
        )}
      </ul>

      {/* Add Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Add New Office"
          closeLabel="Cancel"
          action={{
            show: true,
            label: "Add",
            variant: "save",
            onClick: () =>
              document
                .getElementById("office-form")
                ?.dispatchEvent(
                  new Event("submit", { cancelable: true, bubbles: true })
                ),
          }}
        >
          <OfficeLocationForm
            onSubmit={(data) => createMutation.mutate(data)}
          />
        </Modal>
      )}
    </div>
  );
};

export default OfficeLocationList;
