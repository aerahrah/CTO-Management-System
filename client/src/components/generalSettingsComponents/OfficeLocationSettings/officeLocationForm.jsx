// OfficeLocationForm.jsx
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
const OfficeLocationForm = ({ onSubmit, office }) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [province, setProvince] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (office) {
      setName(office.name || "");
      setProvince(office.province || "");
      setRegion(office.region || "");
    } else {
      setName("");
      setProvince("");
      setRegion("");
    }
  }, [office]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      return toast.error("Fill out the form completely.");
    }
    onSubmit({ name, province, region });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 py-4 w-100"
      id="office-form"
    >
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

export default OfficeLocationForm;
