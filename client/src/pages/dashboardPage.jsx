import { useEffect, useState, useRef } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../store/authStore";
import Sidebar from "../components/sidebar";
import { LogOut, ChevronDown } from "lucide-react";
import { RoleBadge } from "../components/statusUtils";

const Dashboard = () => {
  const navigate = useNavigate();
  const { token, admin, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) navigate("/");
  }, [token, navigate]);

  // Close dropdown on outside click
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
    <div className="flex min-h-screen bg-neutral-200 w-full">
      {/* Sidebar */}
      <div className="w-72">
        <Sidebar admin={admin} />
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {/* Top Navbar */}
        <nav className="fixed z-20 flex justify-end items-center bg-white backdrop-blur-lg shadow-md w-[calc(100%-18rem)] h-20 px-10  border-b border-gray-300">
          <div className="relative " ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-3 px-4 py-2 rounded-full transition-all duration-200 hover:bg-gray-100 group border-1 border-gray-200"
            >
              {/* Avatar */}
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-semibold ring-2 ring-blue-200 shadow-sm">
                {initials}
              </div>

              <div className="text-left">
                <p className="text-sm font-medium text-gray-800 leading-tight">
                  {admin?.username || "Admin"}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {" "}
                  {admin?.role || ""}
                </p>
              </div>

              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform duration-100 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown */}
            <div
              className={`absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-lg border border-gray-100 transform transition-all duration-100 ease-out origin-top-right ${
                dropdownOpen
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
              }`}
            >
              <div className="py-2">
                <div className="px-4 py-2 border-b text-sm text-gray-500">
                  <p className="text-xs mb-1">Signed in as</p>
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-800">
                      {admin?.username || "Admin"}
                    </p>{" "}
                    <RoleBadge role={admin?.role} />
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                >
                  <div className="w-8 h-8 bg-red-100 text-red-500 flex items-center justify-center rounded-full">
                    <LogOut className="w-4 h-4" />
                  </div>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Outlet */}
        <main className="pt-20  transition-all duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
