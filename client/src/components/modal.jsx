import { Fragment, useEffect, useMemo, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";

const actionTones = {
  save: {
    bg: "var(--accent, #2563eb)",
    text: "#eff6ff",
    hover: "var(--accent-hover, #1d4ed8)",
    border: "var(--accent-soft2, rgba(37,99,235,0.24))",
  },
  cancel: {
    bg: "#dc2626",
    text: "#ffffff",
    hover: "#b91c1c",
    border: "rgba(220,38,38,0.22)",
  },
  delete: {
    bg: "#dc2626",
    text: "#ffffff",
    hover: "#b91c1c",
    border: "rgba(220,38,38,0.22)",
  },
  success: {
    bg: "#16a34a",
    text: "#ffffff",
    hover: "#15803d",
    border: "rgba(22,163,74,0.22)",
  },
  default: {
    bg: "var(--app-surface-2, #e5e7eb)",
    text: "var(--app-text, #0f172a)",
    hover: "var(--app-bg, #f3f4f6)",
    border: "var(--app-border, rgba(15,23,42,0.10))",
  },
};

const Modal = ({
  isOpen,
  onClose,
  children,
  title,
  maxWidth = "max-w-4xl",

  // Footer
  showFooter = true,
  action = { show: false, disabled: false },
  closeLabel = "Close",

  // Busy / close behavior
  isBusy: isBusyProp,
  preventCloseWhenBusy = false,
  canClose = true,

  // Optional lifecycle hooks
  afterLeave,
  afterEnter,
}) => {
  const actionVariant = action?.variant || "default";
  const actionTone = actionTones[actionVariant] || actionTones.default;

  const busy = useMemo(
    () => !!(isBusyProp ?? false) || !!action?.disabled,
    [isBusyProp, action?.disabled],
  );

  const effectiveCanClose = canClose && !(preventCloseWhenBusy && busy);

  const actionClickLockRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !busy) actionClickLockRef.current = false;
  }, [isOpen, busy]);

  const safeClose = () => {
    if (!effectiveCanClose) return;
    onClose?.();
  };

  const handleActionClick = async () => {
    if (busy) return;
    if (actionClickLockRef.current) return;

    actionClickLockRef.current = true;
    try {
      await action?.onClick?.();
    } finally {
      actionClickLockRef.current = false;
    }
  };

  const pointerBlockWhileClosing = !isOpen;

  const panelBorderColor = "var(--app-border, rgba(15,23,42,0.10))";
  const footerBorderColor = "var(--app-border, rgba(15,23,42,0.08))";

  const attachHover = (enabled, baseColor, hoverColor) =>
    enabled
      ? {
          onMouseEnter: (e) => {
            e.currentTarget.style.backgroundColor = hoverColor;
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.backgroundColor = baseColor;
          },
        }
      : {};

  return (
    <Transition
      appear
      show={isOpen}
      as={Fragment}
      afterLeave={afterLeave}
      afterEnter={afterEnter}
      unmount={true}
    >
      <Dialog as="div" className="relative z-50" onClose={safeClose}>
        {/* Overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-100"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-75"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className={`fixed inset-0 backdrop-blur-sm ${
              pointerBlockWhileClosing ? "pointer-events-none" : ""
            }`}
            style={{
              backgroundColor: "rgba(2, 6, 23, 0.45)",
            }}
          />
        </Transition.Child>

        {/* Panel */}
        <div className="fixed inset-0 flex items-center justify-center p-2.5 md:p-3 lg:p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-75"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel
              aria-busy={busy}
              className={`relative w-full rounded-xl border p-3 md:p-3.5 lg:p-5 shadow-lg transition-colors duration-300 ease-out ${maxWidth} ${
                pointerBlockWhileClosing ? "pointer-events-none" : ""
              }`}
              style={{
                backgroundColor: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderColor: panelBorderColor,
                boxShadow: "0 20px 50px rgba(2, 6, 23, 0.18)",
              }}
            >
              {title && (
                <Dialog.Title
                  className="mb-4 text-xl md:text-2xl font-bold transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text, #0f172a)" }}
                >
                  {title}
                </Dialog.Title>
              )}

              <div
                className="transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text, #0f172a)" }}
              >
                {children}
              </div>

              {/* Footer */}
              {showFooter && (
                <div
                  className="mt-4 flex justify-center gap-4 border-t pt-3 lg:pt-4"
                  style={{ borderColor: footerBorderColor }}
                >
                  {closeLabel !== null && (
                    <button
                      type="button"
                      onClick={safeClose}
                      disabled={!effectiveCanClose}
                      className={`w-full max-w-64 rounded-lg border px-4 py-2 font-semibold transition-colors duration-200 ease-out ${
                        !effectiveCanClose
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                      style={{
                        backgroundColor: "var(--app-surface-2, #f3f4f6)",
                        borderColor: panelBorderColor,
                        color: "var(--app-text, #0f172a)",
                      }}
                      {...attachHover(
                        effectiveCanClose,
                        "var(--app-surface-2, #f3f4f6)",
                        "var(--app-bg, #e5e7eb)",
                      )}
                    >
                      {closeLabel}
                    </button>
                  )}

                  {action?.show && (
                    <button
                      type="button"
                      onClick={handleActionClick}
                      disabled={busy}
                      className={`w-full max-w-64 rounded-lg border px-4 py-2 font-semibold transition-colors duration-200 ease-out ${
                        busy
                          ? "opacity-70 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                      style={{
                        backgroundColor: actionTone.bg,
                        borderColor: actionTone.border,
                        color: actionTone.text,
                      }}
                      {...attachHover(!busy, actionTone.bg, actionTone.hover)}
                    >
                      {action.label}
                    </button>
                  )}
                </div>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default Modal;
