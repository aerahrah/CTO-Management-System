// src/components/employees/addEmployee/selectProjectOptions.jsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "react-select";
import { Loader2 } from "lucide-react";
import { fetchProjectOptions } from "../../../api/project";

export default function SelectProjectOptions({ value, onChange, error }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ["projectOptions", "Active"],
    queryFn: () => fetchProjectOptions({ status: "Active" }),
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo(() => {
    const items = Array.isArray(data?.items) ? data.items : [];
    const opts = items
      .filter((p) => p?._id && p?.name)
      .map((p) => ({ value: String(p._id), label: p.name }));

    const seen = new Set();
    return opts.filter((o) => {
      if (!o?.value) return false;
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [data]);

  const handleMenuOpen = () => setMenuOpen(true);
  const handleMenuClose = () => setMenuOpen(false);

  const dynamicOptions = useMemo(() => {
    if (menuOpen && isPending) {
      return [
        {
          value: "__loading__",
          label: (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading projects...
            </div>
          ),
          isDisabled: true,
        },
      ];
    }

    if (menuOpen && isError) {
      return [
        {
          value: "__error__",
          label: <div className="text-rose-600">Failed to load projects.</div>,
          isDisabled: true,
        },
      ];
    }

    return options;
  }, [menuOpen, isPending, isError, options]);

  const selected = useMemo(() => {
    if (!value) return null;
    return options.find((opt) => opt.value === String(value)) || null;
  }, [options, value]);

  // ✅ same design as your SelectInput / ProvincialOfficeSelect (project-style)
  const customStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: "44px",
        borderRadius: "0.75rem",
        borderColor: state.isFocused
          ? "#a5b4fc"
          : error
            ? "#fda4af"
            : "rgba(226,232,240,0.9)",
        boxShadow: state.isFocused ? "0 0 0 4px rgba(99,102,241,0.12)" : "none",
        "&:hover": {
          borderColor: state.isFocused
            ? "#a5b4fc"
            : error
              ? "#fda4af"
              : "rgba(148,163,184,0.7)",
        },
        backgroundColor: "rgba(255,255,255,0.9)",
        overflow: "hidden",
      }),
      valueContainer: (base) => ({
        ...base,
        paddingLeft: 10,
        paddingRight: 10,
      }),
      placeholder: (base) => ({
        ...base,
        color: "rgba(100,116,139,0.8)",
      }),
      singleValue: (base) => ({
        ...base,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
        color: "#0f172a",
        fontWeight: 500,
      }),
      indicatorSeparator: () => ({ display: "none" }),
      dropdownIndicator: (base) => ({
        ...base,
        color: "rgba(100,116,139,0.8)",
      }),
      clearIndicator: (base) => ({ ...base, color: "rgba(100,116,139,0.8)" }),
      menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: "0.75rem",
        overflow: "hidden",
        border: "1px solid rgba(226,232,240,0.9)",
        boxShadow: "0 20px 40px rgba(15,23,42,0.08)",
      }),
      option: (base, state) => ({
        ...base,
        fontSize: 13,
        backgroundColor: state.isSelected
          ? "rgba(99,102,241,0.10)"
          : state.isFocused
            ? "rgba(2,6,23,0.04)"
            : "white",
        color: "#0f172a",
      }),
    }),
    [error],
  );

  return (
    <div className="w-full">
      <Select
        styles={customStyles}
        options={dynamicOptions}
        value={selected}
        onChange={(selectedOpt) => onChange(selectedOpt?.value || "")}
        placeholder={
          isPending && !menuOpen ? "Loading projects..." : "Select Project"
        }
        isClearable
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
        isDisabled={isPending && !menuOpen}
        menuPlacement="auto"
      />
    </div>
  );
}
