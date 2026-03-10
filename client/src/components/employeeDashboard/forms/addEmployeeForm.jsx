// src/components/employees/addEmployee/addEmployeeForm.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import { toast } from "react-toastify";
import Breadcrumbs from "../../breadCrumbs";
import { useAuth } from "../../../store/authStore";
import {
  getEmployeeById,
  updateEmployeeById,
  addEmployee,
} from "../../../api/employee";
import { fetchProjectOptions } from "../../../api/project";
import SelectDesignation from "./selectDesignation";
import SelectProjectOptions from "./selectProject";

import {
  User,
  Briefcase,
  MapPin,
  Phone,
  AlertCircle,
  ShieldCheck,
  Building2,
  Save,
  Loader2,
  Hash,
  Mail,
  Shield,
} from "lucide-react";

/* =========================
   THEME
========================= */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* =========================
   CONSTANTS (whitelists)
========================= */
const DIVISIONS = ["AFD", "TOD", "ORD"];
const STATUSES = ["Active", "Inactive", "Resigned", "Terminated"];
const ROLES = ["employee", "supervisor", "hr", "admin"];

/* =========================
   HELPERS (sanitize / normalize)
========================= */
const normalizeText = (v) =>
  String(v ?? "")
    .replace(/\0/g, "")
    .trim();

const normalizeEmail = (v) => normalizeText(v).toLowerCase();
const digitsOnly = (v) => normalizeText(v).replace(/\D/g, "");

const safeEnum = (value, allowed) => {
  const v = normalizeText(value);
  return allowed.includes(v) ? v : "";
};

const safeEnumCI = (value, allowed) => {
  const v = normalizeText(value);
  const found = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
  return found || "";
};

const pickId = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v._id || v.id || "";
  return "";
};

const pickProjectId = (p) => pickId(p);
const pickDesignationId = (d) => pickId(d);

/* =========================
   Skeleton UI
========================= */
const Sk = ({ className = "", style = {} }) => (
  <div
    className={[
      "animate-pulse rounded-lg ring-1 transition-colors duration-300 ease-out",
      className,
    ].join(" ")}
    style={style}
  />
);

const SkText = ({ w = "w-40", h = "h-3", className = "", style = {} }) => (
  <Sk className={[w, h, className].join(" ")} style={style} />
);

const SkInput = ({ className = "", style = {} }) => (
  <Sk
    className={["h-11 w-full rounded-xl", className].join(" ")}
    style={style}
  />
);

const SkCard = ({ children, className = "", borderColor }) => (
  <div
    className={[
      "rounded-2xl transition-colors duration-300 ease-out",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
      boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
      backdropFilter: "blur(10px)",
    }}
  >
    {children}
  </div>
);

const FormSkeleton = ({
  isEditMode,
  borderColor,
  skeletonColors,
  resolvedTheme,
}) => {
  const softPanel =
    resolvedTheme === "dark"
      ? "rgba(255,255,255,0.03)"
      : "rgba(248,250,252,0.70)";

  const emergencyPanel =
    resolvedTheme === "dark" ? "rgba(244,63,94,0.06)" : "rgba(244,63,94,0.04)";

  return (
    <div
      className="min-h-screen transition-colors duration-300 ease-out"
      style={{ backgroundColor: "var(--app-bg)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="opacity-70">
              <SkText
                w="w-48"
                h="h-3"
                style={{
                  backgroundColor: skeletonColors.baseColor,
                  borderColor: borderColor,
                }}
              />
            </div>

            <div className="flex items-start gap-3 mt-3">
              <Sk
                className="w-11 h-11 rounded-2xl"
                style={{
                  backgroundColor: skeletonColors.baseColor,
                  borderColor: borderColor,
                }}
              />
              <div className="min-w-0 w-full">
                <SkText
                  w="w-64"
                  h="h-6"
                  style={{
                    backgroundColor: skeletonColors.baseColor,
                    borderColor: borderColor,
                  }}
                />
                <SkText
                  w="w-96"
                  h="h-4"
                  className="mt-2"
                  style={{
                    backgroundColor: skeletonColors.baseColor,
                    borderColor: borderColor,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Sk
              className="h-11 w-28 rounded-xl"
              style={{
                backgroundColor: skeletonColors.baseColor,
                borderColor: borderColor,
              }}
            />
            <Sk
              className="h-11 w-44 rounded-xl"
              style={{
                backgroundColor: skeletonColors.baseColor,
                borderColor: borderColor,
              }}
            />
          </div>
        </div>

        <SkCard className="p-6 md:p-8" borderColor={borderColor}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sk
                    className="w-9 h-9 rounded-xl"
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <SkText
                    w="w-40"
                    h="h-4"
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <div className="hidden md:block flex-1">
                    <Sk
                      className="h-px w-full rounded-none"
                      style={{
                        backgroundColor: skeletonColors.baseColor,
                        borderColor: borderColor,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                </div>
                <SkInput
                  style={{
                    backgroundColor: skeletonColors.baseColor,
                    borderColor: borderColor,
                  }}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sk
                    className="w-9 h-9 rounded-xl"
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <SkText
                    w="w-40"
                    h="h-4"
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <div className="hidden md:block flex-1">
                    <Sk
                      className="h-px w-full rounded-none"
                      style={{
                        backgroundColor: skeletonColors.baseColor,
                        borderColor: borderColor,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                </div>

                <SkInput
                  style={{
                    backgroundColor: skeletonColors.baseColor,
                    borderColor: borderColor,
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                </div>

                <SkInput
                  style={{
                    backgroundColor: skeletonColors.baseColor,
                    borderColor: borderColor,
                  }}
                />
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sk
                    className="w-9 h-9 rounded-xl"
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <SkText
                    w="w-40"
                    h="h-4"
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <div className="hidden md:block flex-1">
                    <Sk
                      className="h-px w-full rounded-none"
                      style={{
                        backgroundColor: skeletonColors.baseColor,
                        borderColor: borderColor,
                      }}
                    />
                  </div>
                </div>

                <div
                  className="p-5 rounded-2xl border space-y-4"
                  style={{
                    backgroundColor: softPanel,
                    borderColor: borderColor,
                  }}
                >
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SkInput
                      style={{
                        backgroundColor: skeletonColors.baseColor,
                        borderColor: borderColor,
                      }}
                    />
                    <SkInput
                      style={{
                        backgroundColor: skeletonColors.baseColor,
                        borderColor: borderColor,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sk
                    className="w-9 h-9 rounded-xl"
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <SkText
                    w="w-44"
                    h="h-4"
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <div className="hidden md:block flex-1">
                    <Sk
                      className="h-px w-full rounded-none"
                      style={{
                        backgroundColor: skeletonColors.baseColor,
                        borderColor: borderColor,
                      }}
                    />
                  </div>
                </div>

                <div
                  className="p-5 rounded-2xl border space-y-4"
                  style={{
                    backgroundColor: emergencyPanel,
                    borderColor:
                      resolvedTheme === "dark"
                        ? "rgba(244,63,94,0.18)"
                        : "rgba(244,63,94,0.12)",
                  }}
                >
                  <SkInput
                    style={{
                      backgroundColor: skeletonColors.baseColor,
                      borderColor: borderColor,
                    }}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SkInput
                      style={{
                        backgroundColor: skeletonColors.baseColor,
                        borderColor: borderColor,
                      }}
                    />
                    <SkInput
                      style={{
                        backgroundColor: skeletonColors.baseColor,
                        borderColor: borderColor,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <SkText
              w="w-56"
              h="h-3"
              style={{
                backgroundColor: skeletonColors.baseColor,
                borderColor: borderColor,
              }}
            />
            <SkText
              w="w-24"
              h="h-3"
              style={{
                backgroundColor: skeletonColors.baseColor,
                borderColor: borderColor,
              }}
            />
          </div>
        </SkCard>

        {isEditMode ? (
          <div
            className="mt-4 flex items-center gap-2 text-xs font-medium transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            <Loader2 className="animate-spin" size={16} />
            <span>Loading employee…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* =========================
   SELECT INPUT (react-select)
========================= */
const SelectInput = ({
  label,
  options,
  value,
  onChange,
  error,
  required,
  borderColor,
  resolvedTheme,
}) => {
  const selectOptions = useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === "string") return { value: opt, label: opt };
      return opt;
    });
  }, [options]);

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
      indicatorSeparator: () => ({ display: "none" }),
      dropdownIndicator: (base) => ({
        ...base,
        color: "var(--app-muted)",
      }),
      clearIndicator: (base) => ({
        ...base,
        color: "var(--app-muted)",
      }),
    }),
    [error, borderColor, resolvedTheme],
  );

  return (
    <div className="pt-2">
      <label
        className="block text-xs mb-1.5 flex items-center gap-1 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        {label} {required && <span style={{ color: "#f43f5e" }}>*</span>}
      </label>

      <Select
        styles={customStyles}
        options={selectOptions}
        value={selectOptions.find((o) => o.value === value) || null}
        onChange={(selected) => onChange(selected?.value || "")}
        placeholder={`Select ${label}`}
        isClearable
      />

      {error && (
        <p
          className="text-xs mt-2 flex items-center gap-1"
          style={{ color: "#f43f5e" }}
        >
          <AlertCircle size={14} /> {error.message}
        </p>
      )}
    </div>
  );
};

/* =========================
   MAIN FORM
========================= */
const AddEmployeeForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    if (resolvedTheme === "dark") {
      return {
        baseColor: "rgba(255,255,255,0.06)",
        highlightColor: "rgba(255,255,255,0.10)",
      };
    }
    return {
      baseColor: "rgba(15,23,42,0.06)",
      highlightColor: "rgba(15,23,42,0.10)",
    };
  }, [resolvedTheme]);

  const addressPanelStyle = useMemo(
    () => ({
      backgroundColor:
        resolvedTheme === "dark"
          ? "rgba(255,255,255,0.03)"
          : "rgba(248,250,252,0.70)",
      borderColor,
    }),
    [resolvedTheme, borderColor],
  );

  const emergencyPanelStyle = useMemo(
    () => ({
      backgroundColor:
        resolvedTheme === "dark"
          ? "rgba(244,63,94,0.06)"
          : "rgba(244,63,94,0.04)",
      borderColor:
        resolvedTheme === "dark"
          ? "rgba(244,63,94,0.18)"
          : "rgba(244,63,94,0.12)",
    }),
    [resolvedTheme],
  );

  const submitLockRef = useRef(false);

  /* -------------------------
     Project IDs set
  ------------------------- */
  const projectsQuery = useQuery({
    queryKey: ["projectOptions", "Active"],
    queryFn: () => fetchProjectOptions({ status: "Active" }),
    staleTime: 5 * 60 * 1000,
  });

  const projectIdSet = useMemo(() => {
    const items = Array.isArray(projectsQuery.data?.items)
      ? projectsQuery.data.items
      : [];
    return new Set(items.filter((p) => p?._id).map((p) => String(p._id)));
  }, [projectsQuery.data]);

  /* -------------------------
     Schema
  ------------------------- */
  const schema = useMemo(() => {
    const base = {
      employeeId: yup
        .string()
        .transform((v) => normalizeText(v))
        .min(4, "Employee ID is too short")
        .required("Employee ID is required"),

      username: yup
        .string()
        .transform((v) => normalizeText(v))
        .min(4, "Min 4 characters")
        .required("Username is required"),

      firstName: yup
        .string()
        .transform((v) => normalizeText(v))
        .required("First name is required"),

      lastName: yup
        .string()
        .transform((v) => normalizeText(v))
        .required("Last name is required"),

      email: yup
        .string()
        .transform((v) => normalizeEmail(v))
        .email("Invalid email")
        .required("Email is required"),

      phone: yup
        .string()
        .transform((v) => digitsOnly(v))
        .test(
          "phone-len",
          "Invalid phone format (10–15 digits)",
          (v) => !v || (v.length >= 10 && v.length <= 15),
        )
        .nullable(),

      position: yup
        .string()
        .transform((v) => normalizeText(v))
        .required("Position is required"),

      division: yup
        .string()
        .transform((v) => normalizeText(v))
        .oneOf(DIVISIONS, "Invalid division")
        .required("Division is required"),

      project: yup
        .string()
        .transform((v) => normalizeText(v))
        .required("Project is required")
        .test("project-valid", "Invalid project selected", (v) => {
          const val = normalizeText(v);
          if (!val) return false;
          if (projectIdSet.size > 0) return projectIdSet.has(val);
          return true;
        }),

      status: yup
        .string()
        .transform((v) => normalizeText(v))
        .oneOf(STATUSES, "Invalid status")
        .required("Status is required"),

      designation: yup
        .mixed()
        .test("designation-required", "Designation is required", (v) => {
          const picked = pickDesignationId(v);
          return Boolean(normalizeText(picked));
        }),

      address: yup.object({
        street: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
        city: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
        province: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
      }),

      emergencyContact: yup.object({
        name: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
        relation: yup
          .string()
          .transform((v) => normalizeText(v))
          .default(""),
        phone: yup
          .string()
          .transform((v) => digitsOnly(v))
          .test(
            "ec-phone-len",
            "Invalid phone format (10–15 digits)",
            (v) => !v || (v.length >= 10 && v.length <= 15),
          )
          .nullable()
          .default(""),
      }),
    };

    if (!isEditMode) {
      base.role = yup
        .string()
        .transform((v) => normalizeText(v))
        .oneOf(ROLES, "Invalid role")
        .required("Role is required");
    } else {
      base.role = yup
        .string()
        .transform((v) => normalizeText(v))
        .notRequired();
    }

    return yup.object(base);
  }, [isEditMode, projectIdSet]);

  /* -------------------------
     Employee fetch (edit mode)
  ------------------------- */
  const {
    data: employeeRes,
    isLoading: isEmployeeLoading,
    isError: isEmployeeError,
    refetch: refetchEmployee,
  } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployeeById(id),
    enabled: isEditMode,
    staleTime: 1000 * 60 * 5,
    retry: 0,
  });

  const employee = employeeRes?.data;

  const defaultValues = useMemo(
    () => ({
      employeeId: "",
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      division: "",
      project: "",
      status: "Active",
      role: "employee",
      designation: "",
      address: { street: "", city: "", province: "" },
      emergencyContact: { name: "", phone: "", relation: "" },
    }),
    [],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!isEditMode) return;
    if (!employee) return;

    reset({
      employeeId: normalizeText(employee.employeeId),
      username: normalizeText(employee.username),
      firstName: normalizeText(employee.firstName),
      lastName: normalizeText(employee.lastName),
      email: normalizeEmail(employee.email),
      phone: digitsOnly(employee.phone),
      position: normalizeText(employee.position),

      division: safeEnumCI(employee.division, DIVISIONS),
      project: pickProjectId(employee.project),
      status: safeEnumCI(employee.status, STATUSES) || "Active",

      role: normalizeText(employee.role || "employee"),
      designation: pickDesignationId(employee.designation),

      address: {
        street: normalizeText(employee.address?.street),
        city: normalizeText(employee.address?.city),
        province: normalizeText(employee.address?.province),
      },
      emergencyContact: {
        name: normalizeText(employee.emergencyContact?.name),
        relation: normalizeText(employee.emergencyContact?.relation),
        phone: digitsOnly(employee.emergencyContact?.phone),
      },
    });
  }, [employee, isEditMode, reset]);

  /* -------------------------
     Mutation
  ------------------------- */
  const mutation = useMutation({
    mutationFn: async (raw) => {
      const payload = {
        employeeId: isEditMode
          ? normalizeText(employee?.employeeId || raw.employeeId)
          : normalizeText(raw.employeeId),

        username: normalizeText(raw.username),
        firstName: normalizeText(raw.firstName),
        lastName: normalizeText(raw.lastName),
        email: normalizeEmail(raw.email),
        phone: digitsOnly(raw.phone),

        position: normalizeText(raw.position),

        division: safeEnum(normalizeText(raw.division), DIVISIONS),
        project: normalizeText(raw.project),
        status: safeEnum(normalizeText(raw.status), STATUSES),
        designation: pickDesignationId(raw.designation),

        address: {
          street: normalizeText(raw.address?.street),
          city: normalizeText(raw.address?.city),
          province: normalizeText(raw.address?.province),
        },
        emergencyContact: {
          name: normalizeText(raw.emergencyContact?.name),
          relation: normalizeText(raw.emergencyContact?.relation),
          phone: digitsOnly(raw.emergencyContact?.phone),
        },
      };

      if (!isEditMode) payload.role = safeEnum(normalizeText(raw.role), ROLES);

      if (!payload.division) throw new Error("Invalid division selected.");
      if (!payload.project) throw new Error("Project is required.");
      if (projectIdSet.size > 0 && !projectIdSet.has(payload.project)) {
        throw new Error("Invalid project selected.");
      }
      if (!payload.status) throw new Error("Invalid status selected.");
      if (!payload.designation) throw new Error("Designation is required.");
      if (!isEditMode && !payload.role) {
        throw new Error("Invalid role selected.");
      }

      return isEditMode
        ? updateEmployeeById(id, payload)
        : addEmployee(payload);
    },
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["employee", id] });
      }

      toast.success(
        isEditMode
          ? "Employee updated successfully!"
          : "Employee created successfully!",
      );
      navigate(-1);
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong";
      toast.error(`Error: ${msg}`);
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  const { mutate, isPending } = mutation;

  const onSubmit = (formData) => {
    if (submitLockRef.current || isPending) return;
    submitLockRef.current = true;
    mutate(formData);
  };

  if (isEditMode && isEmployeeLoading) {
    return (
      <FormSkeleton
        isEditMode={isEditMode}
        borderColor={borderColor}
        skeletonColors={skeletonColors}
        resolvedTheme={resolvedTheme}
      />
    );
  }

  if (isEditMode && isEmployeeError) {
    return (
      <div
        className="min-h-screen transition-colors duration-300 ease-out"
        style={{ backgroundColor: "var(--app-bg)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div
            className="p-6 rounded-2xl transition-all duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              border: `1px solid rgba(244,63,94,0.18)`,
              boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              className="flex items-center gap-2 font-medium"
              style={{
                color: resolvedTheme === "dark" ? "#fda4af" : "#be123c",
              }}
            >
              <AlertCircle size={18} />
              Failed to load employee
            </div>

            <p
              className="text-sm mt-2 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Please try again. If this persists, check the employee ID or your
              API.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => refetchEmployee()}
                className="px-4 py-2.5 text-sm font-medium rounded-xl transition"
                style={{
                  backgroundColor: "var(--app-surface)",
                  border: `1px solid ${borderColor}`,
                  color: "var(--app-text)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--app-surface-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--app-surface)";
                }}
              >
                Retry
              </button>

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2.5 text-sm font-medium text-white rounded-xl shadow-sm transition"
                style={{ backgroundColor: "var(--accent)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = "brightness(0.95)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "none";
                }}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="px-1 py-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <Breadcrumbs
              rootLabel="home"
              rootTo="/app"
              currentPathText={`Employees/${isEditMode ? "Update" : "Add"}`}
            />

            <div className="flex items-start gap-3 mt-3">
              <div className="min-w-0">
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight truncate transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  {isEditMode ? "Update Employee" : "Add New Employee"}
                </h1>
                <p
                  className="text-sm mt-1 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Manage employee records and assignment details.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 text-sm font-medium rounded-xl transition"
              disabled={isPending}
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
                color: "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                if (isPending) return;
                e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface)";
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="employeeForm"
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-sm disabled:opacity-70 transition"
              style={{ backgroundColor: "var(--accent)" }}
              onMouseEnter={(e) => {
                if (isPending) return;
                e.currentTarget.style.filter = "brightness(0.95)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "none";
              }}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  {isEditMode ? "Updating..." : "Saving..."}
                </span>
              ) : (
                <>
                  <Save size={18} />
                  {isEditMode ? "Update Employee" : "Save Employee"}
                </>
              )}
            </button>
          </div>
        </div>

        <form
          id="employeeForm"
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-8 rounded-2xl transition-all duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="space-y-8">
            <Section
              title="Personal Details"
              icon={User}
              borderColor={borderColor}
            >
              <InputField
                label="Employee ID"
                required
                icon={<Hash size={14} style={{ color: "var(--app-muted)" }} />}
                {...register("employeeId")}
                error={errors.employeeId}
                disabled={isEditMode}
                borderColor={borderColor}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="First Name"
                  required
                  {...register("firstName")}
                  error={errors.firstName}
                  borderColor={borderColor}
                />
                <InputField
                  label="Last Name"
                  required
                  {...register("lastName")}
                  error={errors.lastName}
                  borderColor={borderColor}
                />
              </div>

              <InputField
                label="Username"
                required
                {...register("username")}
                error={errors.username}
                borderColor={borderColor}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Email Address"
                  type="email"
                  required
                  icon={
                    <Mail size={14} style={{ color: "var(--app-muted)" }} />
                  }
                  {...register("email")}
                  error={errors.email}
                  borderColor={borderColor}
                />
                <InputField
                  label="Phone Number"
                  type="tel"
                  icon={
                    <Phone size={14} style={{ color: "var(--app-muted)" }} />
                  }
                  {...register("phone")}
                  error={errors.phone}
                  hint="Digits only (10–15). We’ll strip spaces/dashes automatically."
                  borderColor={borderColor}
                />
              </div>
            </Section>

            <Section
              title="Work Information"
              icon={Briefcase}
              borderColor={borderColor}
            >
              {!isEditMode ? (
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <SelectInput
                      label="System Role"
                      options={ROLES}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.role}
                      required
                      borderColor={borderColor}
                      resolvedTheme={resolvedTheme}
                    />
                  )}
                />
              ) : (
                <div className="pt-2">
                  <label
                    className="block text-xs mb-1.5 flex items-center gap-1 transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <Shield size={14} style={{ color: "var(--app-muted)" }} />{" "}
                    System Role
                  </label>
                  <div
                    className="h-11 px-3 flex items-center rounded-xl text-sm font-medium transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      border: `1px solid ${borderColor}`,
                      color: "var(--app-text)",
                    }}
                  >
                    {employee?.role || "—"}
                  </div>
                </div>
              )}

              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <SelectInput
                    label="Status"
                    options={STATUSES}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.status}
                    required
                    borderColor={borderColor}
                    resolvedTheme={resolvedTheme}
                  />
                )}
              />

              <InputField
                label="Position Title"
                required
                {...register("position")}
                error={errors.position}
                borderColor={borderColor}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller
                  name="division"
                  control={control}
                  render={({ field }) => (
                    <SelectInput
                      label="Division"
                      options={DIVISIONS}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.division}
                      required
                      borderColor={borderColor}
                      resolvedTheme={resolvedTheme}
                    />
                  )}
                />

                <div className="pt-2">
                  <label
                    className="block text-xs mb-1.5 flex items-center gap-1 transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Project <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <Controller
                    name="project"
                    control={control}
                    render={({ field }) => (
                      <SelectProjectOptions
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.project}
                      />
                    )}
                  />
                  {errors.project && (
                    <p
                      className="text-xs mt-2 flex items-center gap-1"
                      style={{ color: "#f43f5e" }}
                    >
                      <AlertCircle size={14} /> {errors.project.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <label
                  className="block text-xs mb-1.5 flex items-center gap-1 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  <Building2 size={14} style={{ color: "var(--app-muted)" }} />{" "}
                  Designation <span style={{ color: "#f43f5e" }}>*</span>
                </label>

                <Controller
                  name="designation"
                  control={control}
                  render={({ field }) => (
                    <SelectDesignation
                      value={pickDesignationId(field.value)}
                      onChange={(v) => field.onChange(v)}
                      error={errors.designation}
                    />
                  )}
                />

                {errors.designation && (
                  <p
                    className="text-xs mt-2 flex items-center gap-1"
                    style={{ color: "#f43f5e" }}
                  >
                    <AlertCircle size={14} /> {errors.designation.message}
                  </p>
                )}
              </div>
            </Section>
          </div>

          <div className="space-y-8">
            <Section
              title="Primary Address"
              icon={MapPin}
              borderColor={borderColor}
            >
              <div
                className="p-5 rounded-2xl border space-y-4 transition-colors duration-300 ease-out"
                style={addressPanelStyle}
              >
                <InputField
                  label="Street / Building"
                  {...register("address.street")}
                  error={errors.address?.street}
                  className=""
                  borderColor={borderColor}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="City"
                    {...register("address.city")}
                    error={errors.address?.city}
                    className=""
                    borderColor={borderColor}
                  />
                  <InputField
                    label="Province"
                    {...register("address.province")}
                    error={errors.address?.province}
                    className=""
                    borderColor={borderColor}
                  />
                </div>
              </div>
            </Section>

            <Section
              title="Emergency Contact"
              icon={ShieldCheck}
              borderColor={borderColor}
            >
              <div
                className="p-5 rounded-2xl border space-y-4 transition-colors duration-300 ease-out"
                style={emergencyPanelStyle}
              >
                <InputField
                  label="Contact Person"
                  {...register("emergencyContact.name")}
                  error={errors.emergencyContact?.name}
                  className=""
                  borderColor={borderColor}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Relationship"
                    {...register("emergencyContact.relation")}
                    error={errors.emergencyContact?.relation}
                    className=""
                    borderColor={borderColor}
                  />
                  <InputField
                    label="Contact Phone"
                    type="tel"
                    {...register("emergencyContact.phone")}
                    error={errors.emergencyContact?.phone}
                    className=""
                    borderColor={borderColor}
                  />
                </div>
              </div>
            </Section>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================
   ATOMIC COMPONENTS
========================= */
const Section = ({ title, icon: Icon, children, borderColor }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div
          className="p-2 rounded-xl border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface-2)",
            color: "var(--app-muted)",
            borderColor,
          }}
        >
          <Icon size={16} />
        </div>
        <h4
          className="text-sm font-medium transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {title}
        </h4>
      </div>
      <div
        className="h-px flex-1 hidden md:block transition-colors duration-300 ease-out"
        style={{ backgroundColor: borderColor }}
      />
    </div>
    {children}
  </div>
);

const InputField = React.forwardRef(
  (
    {
      label,
      error,
      required,
      className = "",
      hint,
      icon,
      borderColor,
      ...props
    },
    ref,
  ) => (
    <div className="w-full pt-2">
      <label
        className="block text-xs mb-1.5 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        {label} {required && <span style={{ color: "#f43f5e" }}>*</span>}
      </label>

      <div className="relative">
        {icon ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        ) : null}

        <input
          ref={ref}
          {...props}
          className={[
            "w-full h-11",
            icon ? "pl-9" : "pl-3",
            "pr-3",
            "text-sm rounded-xl border outline-none transition",
            "disabled:opacity-60",
            className,
          ].join(" ")}
          style={{
            backgroundColor: props.disabled
              ? "var(--app-surface-2)"
              : "var(--app-surface)",
            color: "var(--app-text)",
            borderColor: error ? "rgba(244,63,94,0.45)" : borderColor,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error
              ? "rgba(244,63,94,0.60)"
              : "var(--accent)";
            e.currentTarget.style.boxShadow = error
              ? "0 0 0 3px rgba(244,63,94,0.14)"
              : "0 0 0 3px var(--accent-soft)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error
              ? "rgba(244,63,94,0.45)"
              : borderColor;
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      {hint && !error && (
        <p
          className="text-xs mt-2 transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {hint}
        </p>
      )}

      {error && (
        <p
          className="text-xs mt-2 flex items-center gap-1"
          style={{ color: "#f43f5e" }}
        >
          <AlertCircle size={14} /> {error.message}
        </p>
      )}
    </div>
  ),
);

InputField.displayName = "InputField";

export default AddEmployeeForm;
