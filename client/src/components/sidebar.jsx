import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployees } from "../api/employee";
import { useNavigate } from "react-router-dom";

const Sidebar = ({ admin, setShowList }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const menuItems = [
    { name: "Employee Management", path: "employees" },
    {
      name: "General Settings",
      subItems: [
        { name: "CTO Settings", path: "cto-settings" },
        { name: "Office Location Settings", path: "office-locations" },
      ],
    },
    { name: "Admin Management", path: "admin" },
    { name: "CTO Service", path: "cto" },
  ];

  const [activeItem, setActiveItem] = useState();
  const [openDropdown, setOpenDropdown] = useState(null);

  const { mutateAsync } = useMutation({
    mutationFn: getEmployees,
    onSuccess: (data) => {
      queryClient.setQueryData(["employees"], data);
    },
  });

  const handleClick = async (item) => {
    if (item.subItems) {
      // Toggle dropdown visibility
      setOpenDropdown(openDropdown === item.name ? null : item.name);
      return;
    }

    setActiveItem(item.name);

    if (item.name === "Employee Management") {
      try {
        await mutateAsync();
      } catch (error) {
        console.error("Failed to fetch employees:", error);
      }
    }

    navigate(item.path);
  };

  const handleSubClick = (subItem) => {
    setActiveItem(subItem.name);
    navigate(subItem.path);
  };

  return (
    <div className="fixed h-screen bg-white w-72 border-r-2 border-neutral-200 z-50">
      <ul className="mt-20 flex flex-col gap-2">
        {menuItems.map((item) => (
          <li key={item.name}>
            {/* Main menu item */}
            <div
              onClick={() => handleClick(item)}
              className={`font-semibold cursor-pointer transition-colors duration-150 border-b border-neutral-300
                ${
                  activeItem === item.name
                    ? "bg-neutral-800 text-neutral-200"
                    : "bg-white hover:text-neutral-200 hover:bg-neutral-800 text-neutral-700"
                }`}
            >
              <p className="mx-2 p-5 flex justify-between items-center">
                {item.name}
                {item.subItems && (
                  <span
                    className={`transform transition-transform duration-300 ${
                      openDropdown === item.name ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                )}
              </p>
            </div>

            {/* Dropdown menu with transition */}
            <div
              className={`bg-neutral-100 overflow-hidden transition-all duration-300 ease-in-out ${
                openDropdown === item.name ? "max-h-40" : "max-h-0"
              }`}
            >
              {item.subItems &&
                item.subItems.map((subItem) => (
                  <div
                    key={subItem.name}
                    onClick={() => handleSubClick(subItem)}
                    className={`pl-10 py-3 text-sm cursor-pointer transition-colors duration-150
                      ${
                        activeItem === subItem.name
                          ? "bg-neutral-800 text-neutral-200"
                          : "hover:bg-neutral-800 hover:text-neutral-200 text-neutral-700"
                      }`}
                  >
                    {subItem.name}
                  </div>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;
