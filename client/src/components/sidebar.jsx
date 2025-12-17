import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployees } from "../api/employee";
import { useNavigate } from "react-router-dom";

import {
  Users,
  Settings,
  Building2,
  ClipboardList,
  Clock3,
  CalendarCheck,
  ClipboardPlus,
  FileClock,
  ListTree,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const Sidebar = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeItem, setActiveItem] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });

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

  const { mutateAsync } = useMutation({
    mutationFn: getEmployees,
    onSuccess: (data) => {
      queryClient.setQueryData(["employees"], data);
    },
  });

  const handleMainClick = async (item) => {
    setActiveItem(item.name);
    if (item.name === "Employee Management") await mutateAsync();
    if (item.path) navigate(item.path);
  };

  const handleSubClick = (sub) => {
    setActiveItem(sub.name);
    navigate(sub.path);
  };

  const handleMouseEnter = (item, e) => {
    if (collapsed && item.subItems) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopupCoords({ top: rect.top, left: rect.right + 8 });
      setHoveredItem(item.name);
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  return (
    <aside
      className={`sticky top-0 h-screen bg-white border-r border-neutral-300
        transition-all duration-300  ease-in-out overflow-visible pointer-events-auto
        ${collapsed ? "w-20" : "w-72"}
      `}
    >
      <div className="flex items-center h-20 justify-between px-4 py-3 border-b border-neutral-300">
        {!collapsed && (
          <img src="/logo_dict.png" alt="Logo" className="w-32 select-none" />
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-md hover:bg-neutral-200 transition"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      {/* MENU */}
      <nav className="mt-4 px-2 space-y-4">
        {menuItems.map((item) => (
          <div key={item.name} className="relative mb-2">
            {/* MAIN ITEM */}
            <div
              onClick={() => handleMainClick(item)}
              onMouseEnter={(e) => handleMouseEnter(item, e)}
              onMouseLeave={handleMouseLeave}
              title={collapsed ? item.name : ""}
              className={`w-full flex items-center ${
                collapsed ? "justify-center" : "justify-start gap-3"
              } px-3 py-3 rounded-lg cursor-pointer transition-all ${
                activeItem === item.name
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-700 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {item.icon}
              {!collapsed && (
                <span className="font-semibold whitespace-nowrap">
                  {item.name}
                </span>
              )}
            </div>

            {/* SUB ITEMS - visible when expanded */}
            {!collapsed && item.subItems && (
              <div className="ml-6 mt-2 space-y-1 border-l border-neutral-200 pl-4 pointer-events-auto">
                {item.subItems.map((sub) => (
                  <div
                    key={sub.name}
                    onClick={() => handleSubClick(sub)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-all ${
                      activeItem === sub.name
                        ? "bg-neutral-700 text-white"
                        : "text-neutral-600 hover:bg-neutral-700 hover:text-white"
                    }`}
                  >
                    {sub.icon}
                    <span className="whitespace-nowrap">{sub.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* COLLAPSED HOVER POPUP */}
            {collapsed &&
              item.subItems &&
              hoveredItem === item.name &&
              createPortal(
                <div
                  className="relative"
                  style={{
                    position: "fixed",
                    top: popupCoords.top,
                    left: popupCoords.left,
                  }}
                  onMouseEnter={() => setHoveredItem(item.name)}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Arrow */}
                  <div className="absolute -left-2 top-3 w-3 h-3 bg-white border-l border-t border-neutral-300 rotate-45 shadow-sm z-50" />

                  {/* Popup Card - match expanded sub-item style */}
                  <div className="bg-white border border-neutral-300 shadow-xl rounded-lg w-52 py-2 z-50 animate-fade-in">
                    {item.subItems.map((sub) => (
                      <div
                        key={sub.name}
                        onClick={() => handleSubClick(sub)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-all ${
                          activeItem === sub.name
                            ? "bg-neutral-700 text-white"
                            : "text-neutral-600 hover:bg-neutral-700 hover:text-white"
                        }`}
                      >
                        {sub.icon}
                        <span className="whitespace-nowrap font-semibold">
                          {sub.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>,
                document.body
              )}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
