import { useEffect, useState, useRef } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../store/authStore";
import Sidebar from "../components/sidebar";
import { LogOut, ChevronDown, Menu } from "lucide-react";
import { RoleBadge } from "../components/statusUtils";

const Dashboard = () => {
  const navigate = useNavigate();
  const { token, admin, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!token) navigate("/");
  }, [token, navigate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const initials =
    admin?.username
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "A";

  return (
    /* h-screen and overflow-hidden here prevents the whole body from scrolling */
    <div className="flex h-screen bg-neutral-100 w-full overflow-hidden">
      <Sidebar
        admin={admin}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area: flex-col with h-full and overflow-hidden */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar: flex-shrink-0 ensures it stays at 16 (h-16) */}
        <nav className="flex-shrink-0 z-30 flex justify-between lg:justify-end items-center bg-white/80 backdrop-blur-md border-b border-gray-200 h-14 px-4 lg:px-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 mr-4 rounded-lg hover:bg-gray-100 lg:hidden text-gray-600"
          >
            <Menu size={24} />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 lg:gap-3 pl-2 pr-4 lg:px-6 py-1.5 rounded-full transition-all hover:bg-gray-50 border border-transparent hover:border-gray-200 group"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold ring-4 ring-blue-50 shadow-sm">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-700 leading-tight">
                  {admin?.username || "User"}
                </p>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                  {admin?.role}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Signed in as
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-gray-800 truncate">
                      {admin?.username}
                    </span>
                    <RoleBadge role={admin?.role} />
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-[calc(100%-16px)] mx-2 mt-1 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <div className="w-7 h-7 bg-red-100 text-red-500 flex items-center justify-center rounded-lg">
                    <LogOut size={16} />
                  </div>
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Main Content Area: flex-1 and overflow-y-auto enables scrolling ONLY here */}
        <main className="flex-1 overflow-y-auto md:py-2 md:px-3 custom-scrollbar">
          <div className="max-w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
