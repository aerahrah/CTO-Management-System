import { useEffect, useMemo, useState } from "react";
import Modal from "../../../modal";
import { AlertTriangle, Calendar, FileText, ExternalLink } from "lucide-react";
import { buildApiUrl } from "../../../../config/env";
import { useAuth } from "../../../../store/authStore";

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ✅ Reactive resolved theme for system mode */
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

const StatusPill = ({ status, borderColor }) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    border: "1px solid",
    whiteSpace: "nowrap",
  };

  const s = String(status || "Active");
  const meta = {
    Exhausted: {
      bg: "rgba(239,68,68,0.12)",
      fg: "#ef4444",
      br: "rgba(239,68,68,0.20)",
    },
    "Used in this request": {
      bg: "rgba(245,158,11,0.16)",
      fg: "#d97706",
      br: "rgba(245,158,11,0.26)",
    },
    "Partially used": {
      bg: "rgba(249,115,22,0.16)",
      fg: "#ea580c",
      br: "rgba(249,115,22,0.26)",
    },
    "Used in Application": {
      bg: "var(--accent-soft, rgba(37,99,235,0.12))",
      fg: "var(--accent, #2563eb)",
      br: "var(--accent-soft2, rgba(37,99,235,0.18))",
    },
    Active: {
      bg: "rgba(34,197,94,0.14)",
      fg: "#16a34a",
      br: "rgba(34,197,94,0.22)",
    },
  };

  const t = meta[s] || meta.Active;

  return (
    <span
      style={{
        ...base,
        backgroundColor: t.bg,
        color: t.fg,
        borderColor: t.br || borderColor,
      }}
    >
      {s}
    </span>
  );
};

const SelectCtoMemoModal = ({
  isOpen,
  onClose,
  memos = [],
  selectedMemos = [], // memos applied in current request
}) => {
  // ✅ theme + borders
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const overlayBgHover = useMemo(() => {
    // dark: darker overlay, light: subtle dark overlay (keeps readable)
    return resolvedTheme === "dark"
      ? "rgba(0,0,0,0.45)"
      : "rgba(15,23,42,0.18)";
  }, [resolvedTheme]);

  // ✅ ensure array + exclude rolled back memos (supports multiple shapes)
  const safeMemos = Array.isArray(memos) ? memos : [];
  const visibleMemos = safeMemos.filter((m) => {
    const creditStatus = String(m?.status || "").toUpperCase(); // CREDITED / ROLLEDBACK
    const employeeStatus = String(
      m?.employeeStatus || m?.empStatus || "",
    ).toUpperCase(); // optional per-employee status
    return creditStatus !== "ROLLEDBACK" && employeeStatus !== "ROLLEDBACK";
  });

  // Sort memos by dateApproved ascending (oldest first)
  const sortedMemos = [...visibleMemos].sort((a, b) => {
    const da = a?.dateApproved ? new Date(a.dateApproved).getTime() : 0;
    const db = b?.dateApproved ? new Date(b.dateApproved).getTime() : 0;
    return da - db;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="View CTO Memos"
      closeLabel="Close"
    >
      <div
        className="h-[calc(100vh-12rem)] overflow-y-auto p-1 cto-scrollbar transition-colors duration-300 ease-out"
        style={{ color: "var(--app-text)" }}
      >
        {/* Compact Description Banner */}
        <div
          className="mb-4 rounded-xl p-3 flex items-center gap-3 text-sm border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: borderColor,
            color: "var(--app-muted)",
          }}
        >
          <AlertTriangle size={16} style={{ color: "var(--app-muted)" }} />
          <span>
            Read-only view. Status updates automatically based on usage.
          </span>
        </div>

        {sortedMemos.length === 0 ? (
          <div
            className="text-center py-12 rounded-xl border border-dashed transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
              color: "var(--app-muted)",
            }}
          >
            <p className="text-sm font-medium">No CTO memos available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedMemos.map((memo) => {
              const memoId =
                memo?.id || memo?._id || memo?.memoId || memo?.memoNo;

              const appliedInRequest =
                selectedMemos.find((m) => String(m.id) === String(memoId))
                  ?.appliedHours || 0;

              const credited = Number(memo?.creditedHours || 0);
              const used = Number(memo?.usedHours || 0);
              const remaining = Number(memo?.remainingHours || 0);
              const reserved = Number(memo?.reservedHours || 0);

              // Determine status
              let status = "Active";
              if (reserved > 0 && appliedInRequest === 0) {
                status = "Used in Application";
              } else if (remaining <= 0) {
                status = "Exhausted";
              } else if (appliedInRequest > 0) {
                if (credited > 0 && appliedInRequest === credited)
                  status = "Used in this request";
                else status = "Partially used";
              }

              const pdfPath = memo?.uploadedMemo
                ? String(memo.uploadedMemo)
                : "";
              const pdfUrl = pdfPath ? buildApiUrl(pdfPath) : "";
              const isPdf = pdfPath.toLowerCase().endsWith(".pdf") && !!pdfUrl;

              return (
                <div
                  key={String(memoId)}
                  className="rounded-xl shadow-sm transition-colors duration-300 ease-out flex flex-col overflow-hidden border"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
                  }}
                >
                  {/* Card Header: Details */}
                  <div className="p-3 pb-2">
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold text-sm min-w-0">
                          <FileText
                            size={14}
                            style={{ color: "var(--app-muted)" }}
                          />
                          <span
                            className="truncate"
                            style={{ color: "var(--app-text)" }}
                          >
                            {memo.memoNo || "—"}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-1 text-xs mt-0.5 ml-0.5"
                          style={{ color: "var(--app-muted)" }}
                        >
                          <Calendar size={10} />
                          {memo.dateApproved
                            ? new Date(memo.dateApproved).toLocaleDateString()
                            : "-"}
                        </div>
                      </div>

                      <StatusPill status={status} borderColor={borderColor} />
                    </div>

                    {/* Data Grid: Credited vs Used vs Remaining */}
                    <div
                      className="flex items-stretch rounded-lg mt-2 overflow-hidden border transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface-2)",
                        borderColor: borderColor,
                      }}
                    >
                      <div
                        className="flex-1 py-1.5 px-2 text-center"
                        style={{ borderRight: `1px solid ${borderColor}` }}
                      >
                        <span
                          className="block text-[10px] uppercase font-bold"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Credited
                        </span>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--app-text)" }}
                        >
                          {credited}h
                        </span>
                      </div>

                      <div
                        className="flex-1 py-1.5 px-2 text-center"
                        style={{ borderRight: `1px solid ${borderColor}` }}
                      >
                        <span
                          className="block text-[10px] uppercase font-bold"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Used
                        </span>
                        <span
                          className="text-sm font-extrabold"
                          style={{
                            color: used > 0 ? "#d97706" : "var(--app-muted)",
                          }}
                        >
                          {used}h
                        </span>
                      </div>

                      <div className="flex-1 py-1.5 px-2 text-center">
                        <span
                          className="block text-[10px] uppercase font-bold"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Remaining
                        </span>
                        <span
                          className="text-sm font-extrabold"
                          style={{
                            color:
                              remaining > 0 ? "#16a34a" : "var(--app-muted)",
                          }}
                        >
                          {remaining}h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PDF Preview Area */}
                  <div
                    className="relative border-y group transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface-2)",
                      borderColor: borderColor,
                    }}
                  >
                    {isPdf ? (
                      <div className="h-36 w-full relative">
                        <iframe
                          src={`${pdfUrl}#toolbar=0&view=FitH`}
                          className="w-full h-full"
                          title={memo.memoNo || "Memo PDF"}
                          loading="lazy"
                        />

                        {/* Hover overlay to open PDF */}
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              overlayBgHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                        >
                          <span
                            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded shadow-sm border"
                            style={{
                              backgroundColor: "var(--app-surface)",
                              borderColor: borderColor,
                              color: "var(--app-text)",
                            }}
                          >
                            <ExternalLink size={12} /> Open PDF
                          </span>
                        </a>
                      </div>
                    ) : (
                      <div
                        className="h-36 flex flex-col items-center justify-center"
                        style={{ color: "var(--app-muted)" }}
                      >
                        <span className="text-xs font-medium">No Preview</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Context (Warnings/Usage) */}
                  {appliedInRequest > 0 || reserved > 0 ? (
                    <div
                      className="px-3 py-2 border-t transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor:
                          appliedInRequest > 0
                            ? "rgba(245,158,11,0.12)"
                            : "rgba(37,99,235,0.10)",
                        borderColor:
                          appliedInRequest > 0
                            ? "rgba(245,158,11,0.20)"
                            : "rgba(37,99,235,0.18)",
                      }}
                    >
                      {appliedInRequest > 0 && (
                        <div
                          className="flex justify-between text-xs"
                          style={{ color: "var(--app-text)" }}
                        >
                          <span style={{ opacity: 0.85 }}>
                            Applied in request:
                          </span>
                          <span className="font-extrabold">
                            {appliedInRequest} hrs
                          </span>
                        </div>
                      )}

                      {reserved > 0 && appliedInRequest === 0 && (
                        <div
                          className="flex justify-between text-xs mt-1"
                          style={{ color: "var(--app-text)" }}
                        >
                          <span style={{ opacity: 0.85 }}>
                            Reserved in a pending application:
                          </span>
                          <span className="font-bold">{reserved} hrs</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        height: 8,
                        backgroundColor: "var(--app-surface)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SelectCtoMemoModal;
