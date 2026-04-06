import { useEffect, useState, useRef } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../store/authStore";
import Sidebar from "../components/sidebar";
import ThemeSync from "../components/themeSync";
import {
  LogOut,
  ChevronDown,
  Menu,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RoleBadge } from "../components/statusUtils";
import {
  fetchMyNotifications,
  fetchMyUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../api/notificationSystem";
// import Breadcrumbs from "../components/breadCrumbs";

const NOTIFICATION_PAGE_SIZE_OPTIONS = [25, 50, 75, 100];
const DEFAULT_NOTIFICATION_PAGE_SIZE = 25;

const Dashboard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const token = useAuth((s) => s.token);
  const admin = useAuth((s) => s.admin);
  const logout = useAuth((s) => s.logout);
  const hasHydrated = useAuth((s) => s.hasHydrated);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [notificationPagination, setNotificationPagination] = useState({
    total: 0,
    page: 1,
    limit: DEFAULT_NOTIFICATION_PAGE_SIZE,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
    allowedPageSizes: NOTIFICATION_PAGE_SIZE_OPTIONS,
    defaultPageSize: DEFAULT_NOTIFICATION_PAGE_SIZE,
  });

  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) navigate("/");
  }, [hasHydrated, token, navigate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target)
      ) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/");
  };

  const initials =
    admin?.username
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "A";

  const loadNotifications = async ({
    page = notificationPagination.page || 1,
    limit = notificationPagination.limit || DEFAULT_NOTIFICATION_PAGE_SIZE,
  } = {}) => {
    try {
      setNotificationsLoading(true);

      const res = await fetchMyNotifications({
        page,
        limit,
      });

      setNotifications(res?.data || []);
      setUnreadCount(res?.unreadCount || 0);

      setNotificationPagination({
        total: res?.pagination?.total || 0,
        page: res?.pagination?.page || page,
        limit: res?.pagination?.limit || limit,
        totalPages: res?.pagination?.totalPages || 1,
        hasPrevPage: res?.pagination?.hasPrevPage || false,
        hasNextPage: res?.pagination?.hasNextPage || false,
        allowedPageSizes:
          res?.pagination?.allowedPageSizes || NOTIFICATION_PAGE_SIZE_OPTIONS,
        defaultPageSize:
          res?.pagination?.defaultPageSize || DEFAULT_NOTIFICATION_PAGE_SIZE,
      });
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await fetchMyUnreadNotificationCount();
      setUnreadCount(res?.unreadCount || 0);
    } catch (error) {
      console.error("Failed to load unread count:", error);
    }
  };

  useEffect(() => {
    if (!hasHydrated || !token) return;

    loadUnreadCount();

    const interval = setInterval(() => {
      loadUnreadCount();
    }, 10000);

    return () => clearInterval(interval);
  }, [hasHydrated, token]);

  const handleToggleNotifications = async () => {
    const next = !notificationOpen;
    setNotificationOpen(next);
    setDropdownOpen(false);

    if (next) {
      await loadNotifications({
        page: 1,
        limit: notificationPagination.limit || DEFAULT_NOTIFICATION_PAGE_SIZE,
      });
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification?.isRead) {
        await markNotificationAsRead(notification._id);

        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notification._id
              ? {
                  ...item,
                  isRead: true,
                  readAt: item.readAt || new Date().toISOString(),
                }
              : item,
          ),
        );

        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }

      setNotificationOpen(false);

      if (notification?.link) {
        navigate(notification.link);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleNotificationPageChange = async (nextPage) => {
    if (notificationsLoading) return;
    if (
      nextPage < 1 ||
      nextPage > (notificationPagination.totalPages || 1) ||
      nextPage === notificationPagination.page
    ) {
      return;
    }

    await loadNotifications({
      page: nextPage,
      limit: notificationPagination.limit,
    });
  };

  const handleNotificationLimitChange = async (e) => {
    const nextLimit = Number(e.target.value);

    await loadNotifications({
      page: 1,
      limit: nextLimit,
    });
  };

  const formatNotificationTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  };

  if (!hasHydrated) {
    return (
      <div
        className="h-screen w-full flex items-center justify-center"
        style={{ backgroundColor: "var(--app-bg, #f5f5f5)", color: "#64748b" }}
      >
        <div className="text-sm font-semibold">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-full overflow-hidden transition-colors"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <ThemeSync />

      <Sidebar
        admin={admin}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <nav
          className="flex-shrink-0 z-30 flex justify-between items-center h-14 px-4 lg:px-10 backdrop-blur-md transition-colors"
          style={{
            backgroundColor: "var(--app-surface, rgba(255,255,255,0.80))",
            borderBottom: "1px solid var(--app-border, #e5e7eb)",
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 mr-4 rounded-lg lg:hidden transition"
              style={{
                color: "var(--app-muted, #475569)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--accent-soft, rgba(37,99,235,0.10))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              type="button"
            >
              <Menu size={24} />
            </button>

            {/* <div className="hidden lg:flex">
              <Breadcrumbs />
            </div> */}
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={handleToggleNotifications}
                type="button"
                className="relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all"
                style={{
                  backgroundColor: "transparent",
                  borderColor: "transparent",
                  color: "var(--app-muted, #475569)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--accent-soft, rgba(37,99,235,0.10))";
                  e.currentTarget.style.borderColor =
                    "var(--app-border, #e5e7eb)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }}
                aria-label="Notifications"
              >
                <Bell size={18} />

                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                    style={{
                      backgroundColor: "#ef4444",
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div
                  className="absolute right-0 mt-2 w-[380px] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    backgroundColor: "var(--app-surface, #ffffff)",
                    border: "1px solid var(--app-border, #e5e7eb)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      borderBottom: "1px solid var(--app-border, #e5e7eb)",
                    }}
                  >
                    <div>
                      <p
                        className="text-sm font-bold"
                        style={{ color: "var(--app-text, #0f172a)" }}
                      >
                        Notifications
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: "var(--app-muted, #64748b)" }}
                      >
                        {unreadCount} unread
                      </p>
                    </div>

                    <button
                      onClick={handleMarkAllAsRead}
                      type="button"
                      className="text-xs font-semibold transition"
                      style={{ color: "var(--accent, #2563EB)" }}
                    >
                      Mark all as read
                    </button>
                  </div>

                  <div
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      borderBottom: "1px solid var(--app-border, #e5e7eb)",
                    }}
                  >
                    <div>
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--app-text, #0f172a)" }}
                      >
                        Most recent first
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--app-muted, #64748b)" }}
                      >
                        Page {notificationPagination.page} of{" "}
                        {notificationPagination.totalPages}
                      </p>
                    </div>

                    <select
                      value={notificationPagination.limit}
                      onChange={handleNotificationLimitChange}
                      className="text-xs rounded-lg px-2 py-1 border outline-none"
                      style={{
                        backgroundColor: "var(--app-surface, #ffffff)",
                        color: "var(--app-text, #0f172a)",
                        borderColor: "var(--app-border, #e5e7eb)",
                      }}
                    >
                      {(
                        notificationPagination.allowedPageSizes ||
                        NOTIFICATION_PAGE_SIZE_OPTIONS
                      ).map((size) => (
                        <option key={size} value={size}>
                          Show {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="px-4 py-6 text-center">
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--app-muted, #64748b)" }}
                        >
                          Loading notifications...
                        </p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--app-muted, #64748b)" }}
                        >
                          No notifications yet.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification._id}
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className="w-full text-left px-4 py-3 transition border-b"
                          style={{
                            backgroundColor: notification.isRead
                              ? "transparent"
                              : "var(--accent-soft, rgba(37,99,235,0.08))",
                            borderBottom:
                              "1px solid var(--app-border, #e5e7eb)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "var(--accent-soft2, rgba(37,99,235,0.14))";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              notification.isRead
                                ? "transparent"
                                : "var(--accent-soft, rgba(37,99,235,0.08))";
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p
                                className="text-sm font-semibold truncate"
                                style={{
                                  color: "var(--app-text, #0f172a)",
                                }}
                              >
                                {notification.title}
                              </p>
                              <p
                                className="text-xs mt-1 leading-relaxed"
                                style={{
                                  color: "var(--app-muted, #64748b)",
                                }}
                              >
                                {notification.message}
                              </p>
                              <p
                                className="text-[10px] mt-2"
                                style={{
                                  color: "var(--app-muted, #94a3b8)",
                                }}
                              >
                                {formatNotificationTime(notification.createdAt)}
                              </p>
                            </div>

                            {!notification.isRead && (
                              <span
                                className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: "var(--accent, #2563EB)",
                                }}
                              />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      borderTop: "1px solid var(--app-border, #e5e7eb)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleNotificationPageChange(
                          notificationPagination.page - 1,
                        )
                      }
                      disabled={
                        notificationsLoading ||
                        !notificationPagination.hasPrevPage
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--app-text, #0f172a)",
                        borderColor: "var(--app-border, #e5e7eb)",
                      }}
                    >
                      <ChevronLeft size={14} />
                      Prev
                    </button>

                    <div className="text-center">
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--app-text, #0f172a)" }}
                      >
                        {notificationPagination.total} total notifications
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--app-muted, #64748b)" }}
                      >
                        Showing {notifications.length} item
                        {notifications.length !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleNotificationPageChange(
                          notificationPagination.page + 1,
                        )
                      }
                      disabled={
                        notificationsLoading ||
                        !notificationPagination.hasNextPage
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--app-text, #0f172a)",
                        borderColor: "var(--app-border, #e5e7eb)",
                      }}
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  setDropdownOpen((prev) => !prev);
                  setNotificationOpen(false);
                }}
                className="flex items-center gap-2 lg:gap-3 pl-2 pr-4 lg:px-6 py-1.5 rounded-full transition-all border"
                style={{
                  borderColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--accent-soft, rgba(37,99,235,0.10))";
                  e.currentTarget.style.borderColor =
                    "var(--app-border, #e5e7eb)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }}
                type="button"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-4 shadow-sm"
                  style={{
                    backgroundColor: "var(--accent, #2563EB)",
                    boxShadow:
                      "0 10px 30px -22px var(--accent-ring, rgba(37,99,235,0.28))",
                    outline: "none",
                  }}
                >
                  {initials}
                </div>

                <div className="hidden sm:block text-left">
                  <p
                    className="text-sm font-semibold leading-tight"
                    style={{ color: "var(--app-text, #0f172a)" }}
                  >
                    {admin?.username || "User"}
                  </p>
                  <p
                    className="text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--app-muted, #64748b)" }}
                  >
                    {admin?.role}
                  </p>
                </div>

                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                  style={{ color: "var(--app-muted, #94a3b8)" }}
                />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    backgroundColor: "var(--app-surface, #ffffff)",
                    border: "1px solid var(--app-border, #e5e7eb)",
                  }}
                >
                  <div
                    className="px-4 py-3"
                    style={{
                      borderBottom: "1px solid var(--app-border, #e5e7eb)",
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase mb-1"
                      style={{ color: "var(--app-muted, #64748b)" }}
                    >
                      Signed in as
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-sm font-bold truncate"
                        style={{ color: "var(--app-text, #0f172a)" }}
                      >
                        {admin?.username}
                      </span>
                      <RoleBadge role={admin?.role} />
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    <p
                      className="text-xs"
                      style={{ color: "var(--app-muted, #64748b)" }}
                    >
                      Use the bell icon to view your notifications.
                    </p>
                  </div>

                  <button
                    onClick={handleLogout}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition"
                    style={{
                      color: "var(--danger, #dc2626)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "rgba(220,38,38,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <LogOut size={16} />
                    <span className="text-sm font-semibold">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <main
          className="flex-1 overflow-y-auto px-1.5 md:py-3 md:px-3 custom-scrollbar transition-colors"
          style={{
            backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
          }}
        >
          <div className="max-w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
