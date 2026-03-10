// src/components/employees/addEmployee/selectProjectOptions.jsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "react-select";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../../store/authStore";
import { fetchProjectOptions } from "../../../api/project";

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

export default function SelectProjectOptions({ value, onChange, error }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

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
            <div
              className="flex items-center gap-2"
              style={{ color: "var(--app-muted)" }}
            >
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
          label: (
            <div
              style={{
                color: resolvedTheme === "dark" ? "#fda4af" : "#be123c",
              }}
            >
              Failed to load projects.
            </div>
          ),
          isDisabled: true,
        },
      ];
    }

    return options;
  }, [menuOpen, isPending, isError, options, resolvedTheme]);

  const selected = useMemo(() => {
    if (!value) return null;
    return options.find((opt) => opt.value === String(value)) || null;
  }, [options, value]);

  const customStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: "44px",
        borderRadius: "0.75rem",
        borderColor: state.isFocused
          ? "var(--accent)"
          : error
            ? "rgba(244,63,94,0.45)"
            : borderColor,
        boxShadow: state.isFocused ? "0 0 0 4px var(--accent-soft)" : "none",
        "&:hover": {
          borderColor: state.isFocused
            ? "var(--accent)"
            : error
              ? "rgba(244,63,94,0.45)"
              : borderColor,
        },
        backgroundColor: "var(--app-surface)",
        overflow: "hidden",
      }),
      valueContainer: (base) => ({
        ...base,
        paddingLeft: 10,
        paddingRight: 10,
      }),
      input: (base) => ({
        ...base,
        color: "var(--app-text)",
      }),
      placeholder: (base) => ({
        ...base,
        color: "var(--app-muted)",
      }),
      singleValue: (base) => ({
        ...base,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
        color: "var(--app-text)",
        fontWeight: 500,
      }),
      indicatorSeparator: () => ({ display: "none" }),
      dropdownIndicator: (base) => ({
        ...base,
        color: "var(--app-muted)",
      }),
      clearIndicator: (base) => ({
        ...base,
        color: "var(--app-muted)",
      }),
      menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: "0.75rem",
        overflow: "hidden",
        border: `1px solid ${borderColor}`,
        boxShadow: "0 20px 40px rgba(15,23,42,0.08)",
        backgroundColor: "var(--app-surface)",
      }),
      menuList: (base) => ({
        ...base,
        backgroundColor: "var(--app-surface)",
      }),
      option: (base, state) => ({
        ...base,
        fontSize: 13,
        backgroundColor: state.isSelected
          ? "var(--accent-soft)"
          : state.isFocused
            ? resolvedTheme === "dark"
              ? "rgba(255,255,255,0.05)"
              : "rgba(2,6,23,0.04)"
            : "var(--app-surface)",
        color: "var(--app-text)",
        cursor: "pointer",
      }),
      noOptionsMessage: (base) => ({
        ...base,
        color: "var(--app-muted)",
        backgroundColor: "var(--app-surface)",
      }),
      loadingMessage: (base) => ({
        ...base,
        color: "var(--app-muted)",
        backgroundColor: "var(--app-surface)",
      }),
    }),
    [error, borderColor, resolvedTheme],
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
