import { Listbox, Transition } from "@headlessui/react";
import { ChevronDown, Check } from "lucide-react";
import { Fragment } from "react";

const FilterSelect = ({
  label,
  width = 36,
  value,
  onChange,
  options,
  openUp = false,
}) => {
  const selected = value;

  return (
    <div className={`w-${width} relative`}>
      <Listbox value={value} onChange={onChange}>
        {label && (
          <Listbox.Label className="block text-gray-700 text-sm font-semibold mb-1">
            {label}
          </Listbox.Label>
        )}

        <div className="relative">
          <Listbox.Button className="relative w-full cursor-pointer bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left text-sm shadow-sm focus:outline-none ">
            <span className="block truncate">{value}</span>
            <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Listbox.Options
              className={`
                absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto
                ${openUp ? "bottom-full mb-1" : "top-full mt-1"}
              `}
            >
              {options.map((option) => (
                <Listbox.Option
                  key={option}
                  value={option}
                  className={({ active }) =>
                    `cursor-pointer select-none relative py-2 pl-3 pr-9 ${
                      active ? "bg-violet-100 text-violet-900" : "text-gray-900"
                    }`
                  }
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? "font-semibold" : ""
                        }`}
                      >
                        {option}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-violet-600">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};

export default FilterSelect;
