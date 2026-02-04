import { Fragment, useEffect, useMemo, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";

const variantClasses = {
  save: "bg-blue-600 text-blue-50 hover:bg-blue-700",
  cancel: "bg-red-600 text-white hover:bg-red-700",
  delete: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-green-600 text-white hover:bg-green-700",
  default: "bg-neutral-200 text-black hover:bg-neutral-300",
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

  /**
   * Busy / close behavior
   * - isBusy: external busy flag (preferred)
   * - preventCloseWhenBusy: blocks overlay/esc/close button
   * - canClose: manual override (backward compatible)
   */
  isBusy: isBusyProp,
  preventCloseWhenBusy = false,
  canClose = true,

  /**
   * Optional lifecycle hooks (helpful if you want to run something after animation)
   */
  afterLeave,
  afterEnter,
}) => {
  const actionVariant = action?.variant || "default";
  const actionClass = variantClasses[actionVariant] || variantClasses.default;

  // Busy = external busy OR action.disabled (backward compatibility)
  const busy = useMemo(
    () => !!(isBusyProp ?? false) || !!action?.disabled,
    [isBusyProp, action?.disabled],
  );

  // If preventing close while busy, enforce it here
  const effectiveCanClose = canClose && !(preventCloseWhenBusy && busy);

  // Immediate click lock (prevents rapid click before disabled renders)
  const actionClickLockRef = useRef(false);

  useEffect(() => {
    // release lock when modal closes or becomes not busy
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

  /**
   * Important:
   * When isOpen becomes false, HeadlessUI still keeps the panel mounted briefly
   * for the leave animation. During that phase, we disable pointer events so the user
   * can’t click buttons while it’s closing.
   */
  const pointerBlockWhileClosing = !isOpen; // true during leave phase

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
            className={`fixed inset-0 bg-black/20 backdrop-blur-sm ${
              pointerBlockWhileClosing ? "pointer-events-none" : ""
            }`}
          />
        </Transition.Child>

        {/* Panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
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
              className={`bg-white rounded-lg shadow-lg p-5 relative w-full ${maxWidth} ${
                pointerBlockWhileClosing ? "pointer-events-none" : ""
              }`}
            >
              {title && (
                <Dialog.Title className="text-2xl font-semibold mb-4">
                  {title}
                </Dialog.Title>
              )}

              {children}

              {/* Footer (optional) */}
              {showFooter && (
                <div className="flex justify-center gap-4">
                  {/* Close button (hide if closeLabel === null) */}
                  {closeLabel !== null && (
                    <button
                      type="button"
                      onClick={safeClose}
                      disabled={!effectiveCanClose}
                      className={`px-4 py-2 w-full bg-neutral-200 rounded hover:bg-neutral-300 max-w-64 ${
                        !effectiveCanClose
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                    >
                      {closeLabel}
                    </button>
                  )}

                  {action?.show && (
                    <button
                      type="button"
                      onClick={handleActionClick}
                      disabled={busy}
                      className={`px-4 py-2 w-full rounded max-w-64 ${actionClass} ${
                        busy
                          ? "opacity-70 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
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
