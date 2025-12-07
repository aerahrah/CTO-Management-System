import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployees } from "../api/employee";
import { useNavigate } from "react-router-dom";

// Lucide Icons
import {
  Users,
  Settings,
  Building2,
  ChevronDown,
  ClipboardList,
  Clock3,
  CalendarCheck,
  ClipboardPlus,
  FileClock,
  ListTree,
} from "lucide-react";

const Sidebar = ({ admin, setShowList }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const menuItems = [
    {
      name: "Employee Management",
      icon: <Users size={18} />,
      path: "employees",
    },
    {
      name: "General Settings",
      icon: <Settings size={18} />,
      subItems: [
        {
          name: "CTO Settings",
          path: "cto-settings",
          icon: <ListTree size={16} />,
        },
        {
          name: "Office Location Settings",
          path: "office-locations",
          icon: <Building2 size={16} />,
        },
      ],
    },
    {
      name: "Admin Management",
      icon: <ClipboardList size={18} />,
      path: "admin",
    },
    {
      name: "CTO Service",
      icon: <Clock3 size={18} />,
      subItems: [
        {
          name: "Dashboard",
          path: "/dashboard/cto/dashboard",
          icon: <CalendarCheck size={16} />,
        },
        {
          name: "Credit CTO",
          path: "/dashboard/cto/credit",
          icon: <ClipboardPlus size={16} />,
        },
        {
          name: "Apply CTO Leave",
          path: "/dashboard/cto/apply",
          icon: <FileClock size={16} />,
        },
        {
          name: "Pending Approvals",
          path: "/dashboard/cto/approvals",
          icon: <Clock3 size={16} />,
        },
        {
          name: "All CTO Records",
          path: "/dashboard/cto/records",
          icon: <ListTree size={16} />,
        },
      ],
    },
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
    <div className="fixed h-screen bg-white w-72 border-r border-neutral-300 z-50 shadow-sm">
      <ul className="mt-16 flex flex-col gap-1 px-3">
        {menuItems.map((item) => (
          <li key={item.name}>
            {/* MAIN ITEM */}
            <div
              onClick={() => handleClick(item)}
              className={`
                cursor-pointer flex items-center justify-between
                px-4 py-3 rounded-lg font-semibold
                transition-all duration-200
                ${
                  activeItem === item.name
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-700 hover:bg-neutral-800 hover:text-white"
                }
              `}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.name}</span>
              </div>

              {item.subItems && (
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-300 ${
                    openDropdown === item.name ? "rotate-180" : ""
                  }`}
                />
              )}
            </div>

            {/* SUB ITEMS */}
            <div
              className={`
                ml-3 overflow-hidden transition-all duration-300 
                border-l border-neutral-300 pl-3
                ${
                  openDropdown === item.name
                    ? "max-h-96 opacity-100 py-1"
                    : "max-h-0 opacity-0"
                }
              `}
            >
              {item.subItems &&
                item.subItems.map((subItem) => (
                  <div
                    key={subItem.name}
                    onClick={() => handleSubClick(subItem)}
                    className={`
                      flex items-center gap-3 px-4 py-2 mt-1 rounded-md cursor-pointer 
                      transition-all duration-150
                      ${
                        activeItem === subItem.name
                          ? "bg-neutral-700 text-white"
                          : "text-neutral-600 hover:bg-neutral-700 hover:text-white"
                      }
                    `}
                  >
                    {subItem.icon}
                    <span className="text-sm">{subItem.name}</span>
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
