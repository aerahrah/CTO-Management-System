import { Listbox, Transition } from "@headlessui/react";
import { ChevronDown, Check } from "lucide-react";
import { Fragment } from "react";

const FilterSelect = ({
  label,
  value,
  onChange,
  options,
  openUp = false,
  className = "",
}) => {
  return (
    // Removed fixed width classes, using w-full or auto-layout
    <div className={`relative block text-left ${className}`}>
      <Listbox value={value} onChange={onChange}>
        {({ open }) => (
          <>
            {label && (
              <Listbox.Label className="block text-gray-700 text-[11px] uppercase tracking-wider font-bold mb-1.5 ml-1">
                {label}
              </Listbox.Label>
            )}

            <div className="relative">
              <Listbox.Button
                className={`
                  flex items-center justify-between w-full min-w-[60px] cursor-pointer bg-white border rounded-lg px-3 py-2 text-sm transition-all
                  ${
                    open
                      ? "border-blue-500 ring-4 ring-blue-500/10 shadow-sm"
                      : "border-gray-300 hover:border-gray-400"
                  }
                `}
              >
                <span className="block truncate font-medium text-gray-700 mr-2">
                  {value}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </Listbox.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                {/* Using min-w-full ensures it's at least as wide as the button.
                   Using min-w-max ensures long text doesn't wrap.
                   'absolute' ensures it doesn't push other components.
                */}
                <Listbox.Options
                  className={`
                    absolute z-[100] min-w-full w-max bg-white border border-gray-200 rounded-xl shadow-2xl p-1.5 focus:outline-none
                    ${openUp ? "bottom-full mb-2" : "top-full mt-2"}
                  `}
                >
                  {options.map((option) => (
                    <Listbox.Option
                      key={option}
                      value={option}
                      className={({ active, selected }) =>
                        `cursor-pointer select-none relative py-2 pl-3 pr-10 rounded-lg transition-colors mb-0.5 last:mb-0 ${
                          active ? "bg-blue-50 text-blue-700" : "text-gray-700"
                        } ${selected ? "bg-blue-50/50" : ""}`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected
                                ? "font-bold text-blue-800"
                                : "font-normal"
                            }`}
                          >
                            {option}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
                              <Check className="w-4 h-4" strokeWidth={3} />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
};

export default FilterSelect;
