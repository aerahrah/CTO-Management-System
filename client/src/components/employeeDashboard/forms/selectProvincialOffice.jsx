import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "react-select";
import { Loader2 } from "lucide-react";
import { fetchProvincialOffices } from "../../../api/employee";

export default function ProvincialOfficeSelect({ value, onChange }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    data: offices = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["provincialOffices"],
    queryFn: fetchProvincialOffices,
  });

  const options = offices.map((office) => ({
    value: office._id,
    label: office.name,
  }));

  const handleMenuOpen = () => setMenuOpen(true);
  const handleMenuClose = () => setMenuOpen(false);

  // dynamic options when user opens the dropdown
  let dynamicOptions = options;
  if (menuOpen && isPending) {
    dynamicOptions = [
      {
        value: "",
        label: (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading provincial offices...
          </div>
        ),
      },
    ];
  } else if (menuOpen && isError) {
    dynamicOptions = [
      {
        value: "",
        label: (
          <div className="text-red-500">Failed to load provincial offices.</div>
        ),
      },
    ];
  }

  const customStyles = {
    control: (base) => ({
      ...base,
      minHeight: "38px",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      borderColor: "#d1d5db",
      borderRadius: "0.5rem",
      boxShadow: "none",
      "&:hover": { borderColor: "#9ca3af" },
    }),
    singleValue: (base) => ({
      ...base,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "100%",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  return (
    <div className="mb-4 w-full max-w-md">
      <label className="block text-sm font-medium mb-1 text-gray-700">
        Provincial Office
      </label>
      <Select
        styles={customStyles}
        options={dynamicOptions}
        value={options.find((opt) => opt.value === value) || null}
        onChange={(selected) => onChange(selected?.value || "")}
        placeholder="Select Provincial Office"
        isClearable
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
        isDisabled={isPending && !menuOpen}
        menuPlacement="auto"
      />
    </div>
  );
}
