import { useState, useEffect } from "react";

const OfficeLocationForm = ({ office, onSubmit, id }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (office) {
      setName(office.name || "");
    } else {
      setName("");
    }
  }, [office]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert("Office name is required.");
    onSubmit({ name });
  };

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-4">
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
    </form>
  );
};

export default OfficeLocationForm;
