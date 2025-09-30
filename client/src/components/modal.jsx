import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";

const variantClasses = {
  save: "bg-neutral-800 text-white hover:bg-neutral-800/90",
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
  action = {
    show: false,
  },
  closeLabel,
}) => {
  const actionVariant = action.variant || "default";
  const actionClass = variantClasses[actionVariant] || variantClasses.default;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal panel */}
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
            <Dialog.Panel className="bg-white rounded-lg shadow-lg p-6 max-w-[80%] relative">
              {title && (
                <Dialog.Title className="text-2xl font-semibold mb-4">
                  {title}
                </Dialog.Title>
              )}

              {children}

              <div className="flex mt-4 transition justify-center gap-4">
                <button
                  onClick={() => onClose(false)}
                  className="px-4 py-2 w-full bg-neutral-200 rounded hover:bg-neutral-300 max-w-64 cursor-pointer"
                >
                  {closeLabel || "Close"}
                </button>
                {action.show && (
                  <button
                    onClick={action.onClick}
                    className={`px-4 py-2 w-full rounded max-w-64 cursor-pointer ${actionClass}`}
                  >
                    {action.label}
                  </button>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default Modal;
