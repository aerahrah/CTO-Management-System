import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployees } from "../api/employee";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/authStore";

import {
  Users,
  Settings,
  Building2,
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
  const { admin } = useAuth();
  const role = admin?.role;

  const [activeItem, setActiveItem] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });

  /* ===================== MENU CONFIG ===================== */
  const menuItems = [
    {
      name: "Employee Management",
      icon: <Users size={18} />,
      path: "employees",
      roles: ["admin", "hr"],
    },
    {
      name: "CTO Service",
      icon: <Clock3 size={18} />,
      roles: ["admin", "hr", "supervisor", "employee"],
      subItems: [
        {
          name: "Dashboard",
          path: "/dashboard/cto/dashboard",
          icon: <CalendarCheck size={16} />,
          roles: ["admin", "hr", "supervisor", "employee"],
        },
        {
          name: "Credit CTO",
          path: "/dashboard/cto/credit",
          icon: <ClipboardPlus size={16} />,
          roles: ["admin", "hr"],
        },
        {
          name: "Apply CTO Leave",
          path: "/dashboard/cto/apply",
          icon: <FileClock size={16} />,
          roles: ["employee", "admin"],
        },
        {
          name: "Pending Approvals",
          path: "/dashboard/cto/approvals",
          icon: <Clock3 size={16} />,
          roles: ["admin", "supervisor"],
        },
        {
          name: "All CTO Records",
          path: "/dashboard/cto/records",
          icon: <ListTree size={16} />,
          roles: ["admin", "hr"],
        },
      ],
    },
    {
      name: "General Settings",
      icon: <Settings size={18} />,
      roles: ["admin"],
      subItems: [
        {
          name: "CTO Settings",
          path: "cto-settings",
          icon: <ListTree size={16} />,
          roles: ["admin"],
        },
        {
          name: "Office Location Settings",
          path: "office-locations",
          icon: <Building2 size={16} />,
          roles: ["admin"],
        },
      ],
    },
  ];

  /* ===================== FILTER BY ROLE ===================== */
  const filteredMenuItems = menuItems
    .filter((item) => !item.roles || item.roles.includes(role))
    .map((item) => ({
      ...item,
      subItems: item.subItems?.filter(
        (sub) => !sub.roles || sub.roles.includes(role)
      ),
    }));

  /* ===================== DATA FETCH ===================== */
  const { mutateAsync } = useMutation({
    mutationFn: getEmployees,
    onSuccess: (data) => queryClient.setQueryData(["employees"], data),
  });

  /* ===================== HANDLERS ===================== */
  const handleMainClick = async (item) => {
    if (item.roles && !item.roles.includes(role)) return;
    setActiveItem(item.name);
    if (item.name === "Employee Management") await mutateAsync();
    if (item.path) navigate(item.path);
  };

  const handleSubClick = (sub) => {
    if (sub.roles && !sub.roles.includes(role)) return;
    setActiveItem(sub.name);
    navigate(sub.path);
  };

  const handleMouseEnter = (item, e) => {
    if (collapsed && item.subItems?.length) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopupCoords({ top: rect.top, left: rect.right + 8 });
      setHoveredItem(item.name);
    }
  };

  const handleMouseLeave = () => setHoveredItem(null);

  /* ===================== RENDER ===================== */
  return (
    <aside
      className={`bg-white h-screen sticky top-0 border-r border-gray-200 flex flex-col transition-all duration-300 
        ${collapsed ? "w-16" : "w-64"}`}
    >
      {/* HEADER */}
      <div className="flex items-center h-16 justify-between px-4 border-b border-neutral-300">
        {!collapsed && (
          <img src="/logo_dict.png" alt="Logo" className="w-24 select-none" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-md hover:bg-neutral-200 transition"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      {/* MENU */}
      <nav className="mt-4 px-2 space-y-3">
        {filteredMenuItems.map((item) => (
          <div key={item.name} className="relative">
            {/* MAIN ITEM */}
            <div
              onClick={() => handleMainClick(item)}
              onMouseEnter={(e) => handleMouseEnter(item, e)}
              onMouseLeave={handleMouseLeave}
              title={collapsed ? item.name : ""}
              className={`flex items-center px-3 py-3 rounded-lg cursor-pointer transition-all
                ${collapsed ? "justify-center" : "gap-3"}
                ${
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

            {/* SUB ITEMS (EXPANDED) */}
            {!collapsed && item.subItems?.length > 0 && (
              <div className="ml-4 mt-2 space-y-1.5 border-l border-neutral-200 pl-4">
                {item.subItems.map((sub) => (
                  <div
                    key={sub.name}
                    onClick={() => handleSubClick(sub)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-all
                      ${
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

            {/* COLLAPSED POPUP */}
            {collapsed &&
              item.subItems?.length > 0 &&
              hoveredItem === item.name &&
              createPortal(
                <div
                  style={{
                    position: "fixed",
                    top: popupCoords.top,
                    left: popupCoords.left,
                  }}
                  onMouseEnter={() => setHoveredItem(item.name)}
                  onMouseLeave={handleMouseLeave}
                  className="z-50"
                >
                  <div className="absolute -left-2 top-3 w-3 h-3 bg-white border-l border-t border-neutral-300 rotate-45" />
                  <div className="bg-white border border-neutral-300 shadow-xl rounded-lg w-52 py-2">
                    {item.subItems.map((sub) => (
                      <div
                        key={sub.name}
                        onClick={() => handleSubClick(sub)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-all
                          ${
                            activeItem === sub.name
                              ? "bg-neutral-700 text-white"
                              : "text-neutral-600 hover:bg-neutral-700 hover:text-white"
                          }`}
                      >
                        {sub.icon}
                        <span className="font-semibold whitespace-nowrap">
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
