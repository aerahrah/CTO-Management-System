import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Users,
  Clock,
  FileText,
  Calendar,
  X,
  AlertCircle,
  Briefcase,
  ShieldAlert,
} from "lucide-react";
import Select from "react-select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  fetchApprovers,
  addCreditRequest,
  fetchEmployeeRemainingCtoHours,
} from "../../../../api/cto";
import { toast } from "react-toastify";
import Breadcrumbs from "../../../breadCrumbs";
import { useAuth } from "../../../../store/authStore";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/* ------------------ Local Date Helpers ------------------ */
// Uses the user's LOCAL date (not UTC) so "today" is correct in PH time.
const toLocalISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const todayISO = () => toLocalISO(new Date());

// Inclusive number of days between two "YYYY-MM-DD" strings
const daySpanInclusive = (startISO, endISO) => {
  if (!startISO || !endISO) return 0;
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
};

const formatPrettyDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const isLikelyObjectId = (v) =>
  typeof v === "string" && /^[a-fA-F0-9]{24}$/.test(v);

// best effort UUID / idempotency key
const makeClientRequestId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {}
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

/* ------------------ Formatting Utility ------------------ */
const formatEmployeeName = (emp) => {
  if (!emp) return "";
  const firstName = emp.firstName || "";
  const middleInitial = emp.middleName
    ? ` ${emp.middleName.trim().charAt(0).toUpperCase()}.`
    : "";
  const lastName = emp.lastName ? ` ${emp.lastName}` : "";
  const extension = emp.nameExtension ? ` ${emp.nameExtension}` : "";
  return `${firstName}${middleInitial}${lastName}${extension}`.trim();
};

/* ------------------ Theme Resolvers ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

function useResolvedTheme(prefTheme) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined")
      return prefTheme === "dark" ? "dark" : "light";
    return resolveTheme(prefTheme);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefTheme !== "system") {
      setTheme(prefTheme === "dark" ? "dark" : "light");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(mq.matches ? "dark" : "light");
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [prefTheme]);

  return theme;
}

/* ------------------ Banner Component ------------------ */
const Banner = ({ tone = "error", message, borderColor }) => {
  if (!message) return null;
  const palette =
    tone === "info"
      ? {
          bg: "rgba(37,99,235,0.10)",
          br: "rgba(37,99,235,0.18)",
          fg: "var(--app-text)",
          icon: "var(--accent)",
        }
      : tone === "success"
        ? {
            bg: "rgba(34,197,94,0.12)",
            br: "rgba(34,197,94,0.20)",
            fg: "var(--app-text)",
            icon: "#16a34a",
          }
        : tone === "amber"
          ? {
              bg: "rgba(245,158,11,0.10)",
              br: "rgba(245,158,11,0.25)",
              fg: "var(--app-text)",
              icon: "#f59e0b",
            }
          : {
              bg: "rgba(239,68,68,0.10)",
              br: "rgba(239,68,68,0.18)",
              fg: "var(--app-text)",
              icon: "#ef4444",
            };

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs font-medium flex items-start gap-2 transition-colors duration-300 ease-out mb-6"
      role={tone === "error" ? "alert" : "status"}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.br || borderColor || "var(--app-border)",
        color: palette.fg,
      }}
    >
      <AlertCircle
        className="w-4 h-4 mt-0.5 shrink-0 opacity-90"
        style={{ color: palette.icon }}
      />
      <div className="leading-relaxed">{message}</div>
    </div>
  );
};

/* ------------------ CSC Limit Helper Hook ------------------ */
const useEmployeeLimit = (employeeId, targetDate) => {
  return useQuery({
    queryKey: ["ctoRemainingHours", employeeId, targetDate],
    queryFn: () => fetchEmployeeRemainingCtoHours(employeeId, { targetDate }),
    enabled: !!employeeId && !!targetDate,
    staleTime: 60 * 1000,
  });
};

/* ------------------ Main Form Component ------------------ */
const AddCtoCreditForm = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const [banner, setBanner] = useState({ tone: "error", message: "" });
  const clearBanner = () => setBanner({ tone: "error", message: "" });
  const showBanner = (tone, message) => setBanner({ tone, message });

  const submitInFlightRef = useRef(false);
  const successLatchRef = useRef(false);
  const [successLatchUI, setSuccessLatchUI] = useState(false);
  const [submitLockUI, setSubmitLockUI] = useState(false);

  const [primaryEmployeeId, setPrimaryEmployeeId] = useState(null);

  const initialState = useMemo(
    () => ({
      employees: [],
      duration: { hours: "", minutes: "" },
      inclusiveDates: { startDate: "", endDate: "" },
      purpose: "",
      memoNo: "",
      memoFile: null,
      dateApproved: "",
    }),
    [],
  );

  const [formData, setFormData] = useState(initialState);

  const today = todayISO();

  const selectedSpanDays = daySpanInclusive(
    formData.inclusiveDates.startDate,
    formData.inclusiveDates.endDate,
  );

  const { data: limitData, isLoading: limitLoading } = useEmployeeLimit(
    primaryEmployeeId,
    formData.inclusiveDates.startDate || today,
  );

  useEffect(() => {
    return () => {
      submitInFlightRef.current = false;
      successLatchRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (formData.employees.length > 0) {
      setPrimaryEmployeeId(formData.employees[0]);
    } else {
      setPrimaryEmployeeId(null);
    }
  }, [formData.employees]);

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ["ctoCreditEmployees"],
    queryFn: fetchApprovers,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: addCreditRequest,
    retry: 0,
  });

  const isBusy = mutation.isPending || submitLockUI || successLatchUI;

  const rawEmployees = useMemo(() => {
    return employeesData?.data?.data || employeesData?.data || [];
  }, [employeesData]);

  const employeeOptions = useMemo(() => {
    const options = rawEmployees.map((emp) => ({
      value: emp._id || emp.id,
      label: formatEmployeeName(emp),
    }));
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [rawEmployees]);

  const organicIds = useMemo(() => {
    return rawEmployees
      .filter(
        (e) =>
          e.employeeType === "Organic" ||
          (!e.employeeType &&
            !/JO|Job Order|Contractual/i.test(e.position || "")),
      )
      .map((e) => e._id || e.id);
  }, [rawEmployees]);

  const joIds = useMemo(() => {
    return rawEmployees
      .filter(
        (e) =>
          e.employeeType === "JO" ||
          (!e.employeeType &&
            /JO|Job Order|Contractual/i.test(e.position || "")),
      )
      .map((e) => e._id || e.id);
  }, [rawEmployees]);

  // STRICT INPUT HANDLING FOR HOURS, MINUTES AND DATES
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    clearBanner();

    if (isBusy) return;

    if (name === "hours") {
      if (value === "") {
        setFormData((prev) => ({
          ...prev,
          duration: { ...prev.duration, hours: "" },
        }));
        return;
      }

      let h = parseInt(value, 10);
      if (isNaN(h)) return;
      if (h > 40) h = 40; // Strict maximum cap
      if (h < 0) h = 0;

      setFormData((prev) => ({
        ...prev,
        duration: {
          ...prev.duration,
          hours: String(h),
          // Force minutes to 0 if hours are maxed at 40
          minutes: h === 40 ? "0" : prev.duration.minutes,
        },
      }));
      return;
    }

    if (name === "minutes") {
      if (value === "") {
        setFormData((prev) => ({
          ...prev,
          duration: { ...prev.duration, minutes: "" },
        }));
        return;
      }

      let m = parseInt(value, 10);
      if (isNaN(m)) return;
      if (m > 59) m = 59;
      if (m < 0) m = 0;

      setFormData((prev) => ({
        ...prev,
        duration: {
          ...prev.duration,
          // Prevent minute increments if already at 40 hours
          minutes: prev.duration.hours === "40" ? "0" : String(m),
        },
      }));
      return;
    }

    if (name === "startDate") {
      setFormData((prev) => {
        const newStart = value;
        const prevEnd = prev.inclusiveDates.endDate;

        // Clear the end date if it is now before the start date (or start was cleared)
        let newEnd = prevEnd;
        if (!newStart || (prevEnd && prevEnd < newStart)) newEnd = "";

        return {
          ...prev,
          inclusiveDates: { startDate: newStart, endDate: newEnd },
        };
      });
      return;
    }

    if (name === "endDate") {
      setFormData((prev) => ({
        ...prev,
        inclusiveDates: { ...prev.inclusiveDates, endDate: value },
      }));
      return;
    }

    if (name === "memoFile") {
      const file = files?.[0] || null;
      setFormData((prev) => ({ ...prev, memoFile: file }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectGroup = (ids) => {
    clearBanner();
    setFormData((prev) => {
      const newSet = new Set([...prev.employees, ...ids]);
      return { ...prev, employees: Array.from(newSet) };
    });
  };

  const handleClearSelection = () => {
    clearBanner();
    setFormData((prev) => ({ ...prev, employees: [] }));
  };

  const handleRemoveEmployee = (idToRemove) => {
    clearBanner();
    setFormData((prev) => ({
      ...prev,
      employees: prev.employees.filter((id) => id !== idToRemove),
    }));
  };

  const sanitizeAndValidate = () => {
    const employees = Array.from(new Set(formData.employees || [])).filter(
      isLikelyObjectId,
    );

    if (employees.length === 0) {
      return { ok: false, msg: "Please select at least one employee." };
    }

    const hours = parseInt(formData.duration.hours || "0", 10);
    const minutes = parseInt(formData.duration.minutes || "0", 10);

    if (hours === 0 && minutes === 0) {
      return {
        ok: false,
        msg: "Please enter a credit duration (hours or minutes).",
      };
    }

    if (hours > 40 || (hours === 40 && minutes > 0)) {
      return {
        ok: false,
        msg: "Credit duration cannot exceed the absolute CSC limit of 40 hours per memo.",
      };
    }

    const currentToday = todayISO();

    const dateApproved = String(formData.dateApproved || "").trim();
    if (!dateApproved) {
      return { ok: false, msg: "Please select the date approved." };
    }
    if (dateApproved > currentToday) {
      return { ok: false, msg: "Date approved cannot be in the future." };
    }

    const { startDate, endDate } = formData.inclusiveDates;
    if (!startDate || !endDate) {
      return {
        ok: false,
        msg: "Please select the Date Overtime Rendered (Start and End).",
      };
    }
    if (startDate > endDate) {
      return { ok: false, msg: "End date cannot be earlier than start date." };
    }
    if (startDate > currentToday || endDate > currentToday) {
      return { ok: false, msg: "Overtime dates cannot be in the future." };
    }

    const purpose = String(formData.purpose || "").trim();
    if (!purpose) {
      return { ok: false, msg: "Please specify the purpose or activity done." };
    }

    const memoNo = String(formData.memoNo || "")
      .trim()
      .slice(0, 100);
    if (!memoNo) {
      return { ok: false, msg: "Please enter the memo number." };
    }

    const memoFile = formData.memoFile;
    if (!memoFile) {
      return { ok: false, msg: "Please upload the memo PDF." };
    }

    const fileName = String(memoFile.name || "");
    const isPdfByExt = fileName.toLowerCase().endsWith(".pdf");
    const isPdfByType =
      String(memoFile.type || "").toLowerCase() === "application/pdf";

    if (!isPdfByExt && !isPdfByType) {
      return { ok: false, msg: "Memo file must be a PDF." };
    }

    if (memoFile.size && memoFile.size > MAX_PDF_SIZE_BYTES) {
      return {
        ok: false,
        msg: "PDF is too large. Please upload a smaller file.",
      };
    }

    const payload = new FormData();
    payload.append("memoFile", memoFile);
    payload.append("memoNo", memoNo);
    payload.append("dateApproved", dateApproved);
    payload.append("employees", JSON.stringify(employees));
    payload.append("duration", JSON.stringify({ hours, minutes }));
    payload.append("purpose", purpose);
    payload.append("inclusiveDates", JSON.stringify({ startDate, endDate }));
    payload.append("clientRequestId", makeClientRequestId());

    return { ok: true, payload };
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    clearBanner();

    if (successLatchRef.current) return;
    if (submitInFlightRef.current) return;
    if (isBusy) return;

    submitInFlightRef.current = true;
    setSubmitLockUI(true);

    const { ok, msg, payload } = sanitizeAndValidate();
    if (!ok) {
      showBanner("error", msg);
      submitInFlightRef.current = false;
      setSubmitLockUI(false);
      return;
    }

    try {
      await mutation.mutateAsync(payload);

      successLatchRef.current = true;
      setSuccessLatchUI(true);

      toast.success("CTO credit added successfully!");
      queryClient.invalidateQueries({ queryKey: ["ctoCredits"] });
      queryClient.invalidateQueries({ queryKey: ["allCredits"] });
      queryClient.invalidateQueries({ queryKey: ["ctoRemainingHours"] });

      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (err) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit credit request";

      showBanner("error", errorMsg);
      toast.error(errorMsg);

      submitInFlightRef.current = false;
      successLatchRef.current = false;
      setSuccessLatchUI(false);
      setSubmitLockUI(false);
    }
  };

  const endDateDisabled = isBusy || !formData.inclusiveDates.startDate;

  return (
    <div
      className="w-full max-w-4xl transition-colors duration-300 ease-out pb-12"
      style={{ color: "var(--app-text)" }}
    >
      <div className="pt-2 pb-6 px-4 md:px-0">
        <Breadcrumbs rootLabel="home" rootTo="/app" />
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight font-sans mt-2"
          style={{ color: "var(--app-text)" }}
        >
          Add CTO Credit
        </h1>
        <p
          className="block text-sm mt-1 max-w-2xl"
          style={{ color: "var(--app-muted)" }}
        >
          Issue new Compensatory Time Credits to selected employees by uploading
          a signed memo.
        </p>
      </div>

      <div className="px-4 md:px-0 mb-6">
        <div
          className="rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.05)",
            borderColor: "rgba(245, 158, 11, 0.2)",
          }}
        >
          <ShieldAlert
            className="w-5 h-5 shrink-0 mt-0.5"
            style={{ color: "#d97706" }}
          />
          <div className="text-sm">
            <span
              className="font-bold block mb-1"
              style={{ color: "var(--app-text)" }}
            >
              CSC Earning Limits Applied Automatically
            </span>
            <span style={{ color: "var(--app-muted)" }}>
              The system limits single-memo credits to <strong>40 hours</strong>
              . The backend also checks each employee against the 120-hour total
              balance limit and the 40-hour monthly earning limit. Any hours
              beyond their personal cap will not be credited, and the employee
              will be notified.
            </span>
          </div>
        </div>
      </div>

      <div
        className="w-full rounded-xl overflow-hidden border shadow-sm transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
        }}
      >
        <div
          className="px-6 py-5 border-b flex items-center justify-between gap-3 transition-colors duration-300 ease-out"
          style={{ borderColor: borderColor }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--accent-soft)",
                borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
                color: "var(--accent)",
              }}
            >
              <Clock className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">
                Crediting Details
              </h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 py-6 space-y-8">
            <Banner
              tone={banner.tone}
              message={banner.message}
              borderColor={borderColor}
            />

            <div
              className="space-y-4 border-b pb-8 transition-colors duration-300 ease-out"
              style={{ borderColor: borderColor }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center border"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      borderColor: borderColor,
                      color: "var(--app-muted)",
                    }}
                  >
                    <Users className="w-4 h-4" />
                  </div>
                  Select Employees
                </div>

                {formData.employees.length === 1 &&
                  !limitLoading &&
                  limitData && (
                    <div className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                      Max Room for selected:{" "}
                      <span
                        className={
                          limitData.absoluteCreditableNow <= 0
                            ? "text-red-500"
                            : "text-green-600"
                        }
                      >
                        {limitData.absoluteCreditableNow}h
                      </span>
                    </div>
                  )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[10px] uppercase font-bold mr-1"
                  style={{ color: "var(--app-muted)" }}
                >
                  Quick Select:
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectGroup(organicIds)}
                  disabled={isBusy || organicIds.length === 0}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50 transition-colors"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    color: "#059669",
                    borderColor: "rgba(16, 185, 129, 0.2)",
                  }}
                >
                  Organic ({organicIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectGroup(joIds)}
                  disabled={isBusy || joIds.length === 0}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50 transition-colors"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    color: "#d97706",
                    borderColor: "rgba(245, 158, 11, 0.2)",
                  }}
                >
                  Job Order ({joIds.length})
                </button>
              </div>

              <Select
                options={employeeOptions}
                isMulti
                controlShouldRenderValue={false}
                hideSelectedOptions={true}
                closeMenuOnSelect={false}
                isLoading={isLoading}
                isDisabled={isBusy}
                maxMenuHeight={250}
                value={employeeOptions.filter((o) =>
                  (formData.employees || []).includes(o.value),
                )}
                onChange={(selected) => {
                  clearBanner();
                  setFormData((p) => ({
                    ...p,
                    employees: selected ? selected.map((s) => s.value) : [],
                  }));
                }}
                placeholder="Search and add employees..."
                classNames={{
                  control: ({ isFocused }) =>
                    `min-h-[42px] rounded-lg border transition-colors duration-200 ${
                      isFocused
                        ? "border-blue-500 ring-1 ring-blue-200"
                        : "border-gray-300"
                    } ${isBusy ? "opacity-70" : ""}`,
                  menuList: () => "custom-scrollbar",
                  option: ({ isFocused, isSelected }) =>
                    `${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : isFocused
                          ? "bg-gray-100 text-gray-900"
                          : "bg-white text-gray-800"
                    } px-3 py-2 cursor-pointer transition-colors duration-150`,
                }}
                styles={{
                  control: (base) => ({
                    ...base,
                    backgroundColor: isBusy
                      ? "var(--app-surface-2)"
                      : "var(--app-surface)",
                    borderColor: borderColor,
                    color: "var(--app-text)",
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: "var(--app-surface)",
                    border: `1px solid ${borderColor}`,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                    zIndex: 50,
                  }),
                }}
              />

              <div
                className="rounded-lg overflow-hidden border shadow-sm flex flex-col transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 border-b shrink-0 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                  }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--app-text)" }}
                  >
                    Selected Employees ({formData.employees.length})
                  </span>
                  {formData.employees.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      disabled={isBusy}
                      className="text-[11px] text-red-600 hover:text-red-700 font-bold disabled:opacity-50 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="max-h-[250px] overflow-y-auto p-3 custom-scrollbar flex flex-wrap gap-2 content-start min-h-[80px]">
                  {formData.employees.length === 0 ? (
                    <div
                      className="text-xs flex items-center justify-center p-4 text-center w-full italic font-medium"
                      style={{ color: "var(--app-muted)" }}
                    >
                      No employees selected. Use the search bar or quick select
                      above.
                    </div>
                  ) : (
                    formData.employees.map((empId) => {
                      const emp = rawEmployees.find(
                        (e) => e._id === empId || e.id === empId,
                      );
                      if (!emp) return null;

                      const displayName = formatEmployeeName(emp);

                      return (
                        <div
                          key={empId}
                          className="flex items-center gap-1.5 border px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors duration-300 ease-out animate-in fade-in zoom-in duration-200"
                          style={{
                            backgroundColor: "var(--accent-soft)",
                            borderColor:
                              "var(--accent-soft2, rgba(37,99,235,0.18))",
                            color: "var(--accent)",
                          }}
                        >
                          <span className="whitespace-nowrap">
                            {displayName}
                          </span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRemoveEmployee(empId)}
                            className="transition-colors disabled:opacity-50 ml-1"
                            style={{ color: "var(--accent)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "#ef4444")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = "var(--accent)")
                            }
                            aria-label={`Remove ${displayName}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--app-text)" }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center border"
                      style={{
                        backgroundColor: "var(--app-surface-2)",
                        borderColor: borderColor,
                        color: "var(--app-muted)",
                      }}
                    >
                      <Calendar className="w-4 h-4" />
                    </div>
                    Date Overtime Rendered (Start)
                  </div>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.inclusiveDates.startDate}
                    onChange={handleChange}
                    max={today}
                    disabled={isBusy}
                    className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out text-[16px] sm:text-sm"
                    style={{
                      backgroundColor: isBusy
                        ? "var(--app-surface-2)"
                        : "var(--app-surface)",
                      borderColor: borderColor,
                      color: isBusy ? "var(--app-muted)" : "var(--app-text)",
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div
                    className="flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--app-text)" }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center border"
                      style={{
                        backgroundColor: "var(--app-surface-2)",
                        borderColor: borderColor,
                        color: "var(--app-muted)",
                      }}
                    >
                      <Calendar className="w-4 h-4" />
                    </div>
                    Date Overtime Rendered (End)
                  </div>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.inclusiveDates.endDate}
                    onChange={handleChange}
                    min={formData.inclusiveDates.startDate || undefined}
                    max={today}
                    disabled={endDateDisabled}
                    className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out text-[16px] sm:text-sm disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: endDateDisabled
                        ? "var(--app-surface-2)"
                        : "var(--app-surface)",
                      borderColor: borderColor,
                      color: endDateDisabled
                        ? "var(--app-muted)"
                        : "var(--app-text)",
                    }}
                  />
                </div>
              </div>

              {/* Date range hint */}
              <div
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--app-muted)" }}
              >
                {!formData.inclusiveDates.startDate ? (
                  <>Choose a start date first. Future dates are not allowed.</>
                ) : (
                  <>
                    You can choose an end date from{" "}
                    <strong>
                      {formatPrettyDate(formData.inclusiveDates.startDate)}
                    </strong>{" "}
                    to <strong>{formatPrettyDate(today)}</strong> (future dates
                    are not allowed).
                    {selectedSpanDays > 0 && (
                      <>
                        {" "}
                        Selected:{" "}
                        <strong>
                          {selectedSpanDays} day
                          {selectedSpanDays > 1 ? "s" : ""}
                        </strong>
                        .
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: "var(--app-text)" }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center border"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      borderColor: borderColor,
                      color: "var(--app-muted)",
                    }}
                  >
                    <Clock className="w-4 h-4" />
                  </div>
                  Credit Duration (Max 40h)
                </div>

                <div className="flex gap-3 relative group">
                  <input
                    type="number"
                    name="hours"
                    placeholder="Hours"
                    min="0"
                    max="40"
                    value={formData.duration.hours}
                    onChange={handleChange}
                    disabled={isBusy}
                    className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out"
                    style={{
                      backgroundColor: isBusy
                        ? "var(--app-surface-2)"
                        : "var(--app-surface)",
                      borderColor: borderColor,
                      color: isBusy ? "var(--app-muted)" : "var(--app-text)",
                    }}
                  />
                  <input
                    type="number"
                    name="minutes"
                    placeholder="Minutes"
                    min="0"
                    max="59"
                    value={formData.duration.minutes}
                    onChange={handleChange}
                    disabled={isBusy || formData.duration.hours === "40"}
                    className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out"
                    style={{
                      backgroundColor:
                        isBusy || formData.duration.hours === "40"
                          ? "var(--app-surface-2)"
                          : "var(--app-surface)",
                      borderColor: borderColor,
                      color:
                        isBusy || formData.duration.hours === "40"
                          ? "var(--app-muted)"
                          : "var(--app-text)",
                    }}
                  />
                  {/* Tooltip hint if maxed */}
                  {formData.duration.hours === "40" && (
                    <div className="absolute -top-8 right-0 text-[10px] bg-black text-white px-2 py-1 rounded hidden group-hover:block whitespace-nowrap">
                      Minutes disabled at 40h limit
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: "var(--app-text)" }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center border"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      borderColor: borderColor,
                      color: "var(--app-muted)",
                    }}
                  >
                    <Calendar className="w-4 h-4" />
                  </div>
                  Date Approved
                </div>

                <input
                  type="date"
                  name="dateApproved"
                  value={formData.dateApproved}
                  onChange={handleChange}
                  max={today}
                  disabled={isBusy}
                  className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out text-[16px] sm:text-sm"
                  style={{
                    backgroundColor: isBusy
                      ? "var(--app-surface-2)"
                      : "var(--app-surface)",
                    borderColor: borderColor,
                    color: isBusy ? "var(--app-muted)" : "var(--app-text)",
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "var(--app-text)" }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center border"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                    color: "var(--app-muted)",
                  }}
                >
                  <Briefcase className="w-4 h-4" />
                </div>
                Purpose / Activity
              </div>
              <input
                type="text"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="e.g. To conduct interview and deliberation"
                maxLength={200}
                disabled={isBusy}
                className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out"
                style={{
                  backgroundColor: isBusy
                    ? "var(--app-surface-2)"
                    : "var(--app-surface)",
                  borderColor: borderColor,
                  color: isBusy ? "var(--app-muted)" : "var(--app-text)",
                }}
              />
            </div>

            <div className="space-y-2">
              <div
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "var(--app-text)" }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center border"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                    color: "var(--app-muted)",
                  }}
                >
                  <FileText className="w-4 h-4" />
                </div>
                Memo Reference
              </div>

              <input
                type="text"
                name="memoNo"
                value={formData.memoNo}
                onChange={handleChange}
                placeholder="Enter memo or reference number"
                maxLength={100}
                disabled={isBusy}
                className="w-full h-11 sm:h-10 px-3 rounded-lg outline-none border transition-colors duration-200 ease-out"
                style={{
                  backgroundColor: isBusy
                    ? "var(--app-surface-2)"
                    : "var(--app-surface)",
                  borderColor: borderColor,
                  color: isBusy ? "var(--app-muted)" : "var(--app-text)",
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--app-text)" }}
              >
                Upload Memo (PDF)
              </label>

              <label
                className={`flex items-center gap-3 px-4 py-3 border border-dashed rounded-lg transition-colors duration-200 ease-out ${
                  isBusy ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                }`}
                style={{
                  backgroundColor: isBusy
                    ? "var(--app-surface-2)"
                    : "rgba(37,99,235,0.04)",
                  borderColor: isBusy ? borderColor : "rgba(37,99,235,0.3)",
                }}
                onMouseEnter={(e) => {
                  if (isBusy) return;
                  e.currentTarget.style.backgroundColor =
                    "rgba(37,99,235,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (isBusy) return;
                  e.currentTarget.style.backgroundColor =
                    "rgba(37,99,235,0.04)";
                }}
              >
                <Upload
                  className="w-5 h-5"
                  style={{ color: "var(--accent)" }}
                />
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--app-text)" }}
                >
                  {formData.memoFile
                    ? formData.memoFile.name
                    : "Choose a PDF file to upload"}
                </span>

                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  name="memoFile"
                  onChange={handleChange}
                  disabled={isBusy}
                  className="hidden"
                />
              </label>

              {formData.memoFile && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setFormData((p) => ({ ...p, memoFile: null }))}
                  className={`mt-2 text-xs font-bold transition-colors ${
                    isBusy ? "opacity-50 cursor-not-allowed" : "hover:underline"
                  }`}
                  style={{ color: "#ef4444" }}
                >
                  Remove file
                </button>
              )}

              <div
                className="mt-2 text-[10px]"
                style={{ color: "var(--app-muted)" }}
              >
                Max file size: {Math.round(MAX_PDF_SIZE_BYTES / (1024 * 1024))}
                MB
              </div>
            </div>
          </div>

          <div
            className="border-t px-6 py-4 flex flex-row items-stretch sm:items-center justify-end gap-3 sticky bottom-0 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
            }}
          >
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                if (isBusy) return;
                navigate(-1);
              }}
              className="px-6 py-2.5 sm:py-2 rounded-lg border font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor: borderColor,
                color: "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.filter = "brightness(0.98)";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isBusy}
              className="w-full sm:w-auto px-8 py-2.5 sm:py-2 rounded-lg font-bold disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200 ease-out shadow-sm"
              style={{
                backgroundColor: "var(--accent)",
                border: "1px solid var(--accent)",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.filter = "brightness(0.95)";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
            >
              {mutation.isPending
                ? "Saving..."
                : successLatchUI
                  ? "Saved"
                  : "Add Credit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCtoCreditForm;
