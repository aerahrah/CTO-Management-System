import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchAllProvincialOffices,
  updateProvincialOffice,
  deleteProvincialOffice,
} from "../../../api/officeLocation";
import OfficeLocationForm from "./officeLocationForm";
import OfficeLocationList from "./officeLocationList";
import OfficeLocationDetails from "./officeLocationDetails";
import { CardFull, CardMd } from "../../cardComponent";
import Modal from "../../modal";

const OfficeLocationSettingsPage = () => {
  const queryClient = useQueryClient();
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Fetch offices
  const { data: offices = [] } = useQuery({
    queryKey: ["provincialOffices"],
    queryFn: fetchAllProvincialOffices,
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateProvincialOffice(id, data),
    onSuccess: () => queryClient.invalidateQueries(["provincialOffices"]),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProvincialOffice,
    onSuccess: () => {
      queryClient.invalidateQueries(["provincialOffices"]);
      setSelectedOffice(null);
      setDeleteModalOpen(false);
    },
  });

  const handleSave = (data) => {
    if (!selectedOffice) return;
    updateMutation.mutate({ id: selectedOffice._id, data });
    setEditModalOpen(false);
  };

  const handleDelete = () => {
    if (!selectedOffice) return;
    deleteMutation.mutate(selectedOffice._id);
  };

  return (
    <div className=" w-[100%] flex gap-3 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem-1rem)]">
      <CardMd className="sticky h-full top-20 flex flex-col">
        <OfficeLocationList
          selectedOffice={selectedOffice}
          setSelectedOffice={setSelectedOffice}
          maxHeightClass="h-[28rem]"
        />
      </CardMd>

      {/* Office Details */}
      <CardFull>
        <OfficeLocationDetails
          selectedOffice={selectedOffice}
          onEdit={() => setEditModalOpen(true)}
          onDelete={() => setDeleteModalOpen(true)}
        />
      </CardFull>

      {/* Edit Modal */}
      {editModalOpen && selectedOffice && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit Office Name`}
          closeLabel="Cancel"
          action={{
            show: true,
            label: "Save Changes",
            variant: "save",
            onClick: () =>
              document
                .getElementById("office-form")
                ?.dispatchEvent(
                  new Event("submit", { cancelable: true, bubbles: true })
                ),
          }}
        >
          <div className="w-100 py-2">
            <OfficeLocationForm
              id="office-form"
              office={selectedOffice}
              onSubmit={handleSave}
            />
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && selectedOffice && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title={`Delete ${selectedOffice.name}`}
          closeLabel="Cancel"
          action={{
            show: true,
            label: "Delete",
            variant: "delete",
            onClick: handleDelete,
          }}
        >
          <div className="w-100">
            <p className="text-gray-700 text-l py-2">
              Are you sure you want to delete{" "}
              <span className="font-medium">{selectedOffice.name}</span>? This
              action cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OfficeLocationSettingsPage;
