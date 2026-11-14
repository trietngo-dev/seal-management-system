import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LayoutDashboard,
  Settings2,
  Award,
  Trophy,
  Users,
  LogOut,
  Bell,
  Tv,
  Camera,
  PanelLeftClose,
  PanelLeftOpen,
  BriefcaseBusiness,
  LifeBuoy,
  Trash2,
  ChartNoAxesCombined,
} from "lucide-react";

interface AdminLayoutProps {
  user: any;
  roles: any[];
  onLogout: () => void;
}

export default function AdminLayout({
  user,
  roles,
  onLogout,
}: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminView =
    !user?.isSystemAdmin && roles?.some((r) => r.role === "admin_view");
  const isAssistant = roles?.some((r) => r.role === "student_assistant");
  const isCoordinator = !!user?.isSystemAdmin;

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("admin_sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    if (user) {
      const fetchNotifications = async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get(
            "http://localhost:5000/api/notifications",
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          setNotifications(res.data);
        } catch (err) {
          console.error("Failed to fetch notifications", err);
        }
      };
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 120000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const unreadCount = notifications.filter(
    (n) => n.status === "pending",
  ).length;

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/notifications/${id}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setNotifications(
        notifications.map((n) => (n._id === id ? { ...n, status: "sent" } : n)),
      );
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        "http://localhost:5000/api/notifications/read-all",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setNotifications(notifications.map((n) => ({ ...n, status: "sent" })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const deleteNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete("http://localhost:5000/api/notifications/clear-all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear all notifications", err);
    }
  };

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    {
      path: "/admin",
      label: "Quản lý sự kiện",
      icon: LayoutDashboard,
    },
    {
      path: "/admin/events",
      label: "Thiết lập sự kiện",
      icon: Settings2,
    },
    {
      path: "/admin/users",
      label: "Quản lý tài khoản",
      icon: Users,
    },
    {
      path: "/admin/personnel",
      label: "Quản lý nhân sự",
      icon: BriefcaseBusiness,
    },
    {
      path: "/admin/statistics",
      label: "Dashboard thống kê",
      icon: ChartNoAxesCombined,
    },
    {
      path: "/admin/support",
      label: "Yêu cầu hỗ trợ",
      icon: LifeBuoy,
    },
    {
      path: "/admin/grades",
      label: "Xem chi tiết điểm",
      icon: Award,
    },
    {
      path: "/admin/live",
      label: "Live Control Center",
      icon: Tv,
    },
    {
      path: "/admin/leaderboard",
      label: "Bảng xếp hạng",
      icon: Trophy,
    },
    {
      path: "/admin/album",
      label: "Album ảnh",
      icon: Camera,
    },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (isAssistant) {
      return ['/admin/users', '/admin/events', '/admin/statistics', '/admin/grades', '/admin/leaderboard'].includes(item.path);
    }
    if (item.path === '/admin/support' && !user?.isSystemAdmin && !roles?.some((r) => r.role === 'admin_view')) {
      return false;
    }
    // If not a system admin (and not assistant), hide the global user accounts management tab
    if (item.path === '/admin/users' && !user?.isSystemAdmin) {
      return false;
    }
    return true;
  }).map(item => {
    if (isAssistant) {
      if (item.path === '/admin/events') {
        return { ...item, label: 'Quản lý đội thi' };
      }
      if (item.path === '/admin/users') {
        return { ...item, label: 'Quản lý thí sinh' };
      }
    }
    return item;
  });

  const handleLogoutClick = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-800 flex font-sans selection:bg-orange-500/20 coordinator-light-theme">
      {/* SideNavBar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-slate-900/90 border-r border-white/5 flex flex-col z-20 shadow-2xl transition-all duration-300 ${
          isSidebarCollapsed ? "w-[72px]" : "w-[280px]"
        }`}
      >
        {/* User Quick Info */}
        <div
          className={`py-3 border-b border-white/5 flex items-center bg-slate-900/20 ${
            isSidebarCollapsed ? "px-3 justify-center" : "px-6 gap-3"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-cyan-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-[0_0_10px_rgba(6,182,212,0.4)] shrink-0">
            {user?.fullName?.charAt(0) || "A"}
          </div>
          {!isSidebarCollapsed && (
            <div className="overflow-hidden">
              <h4 className="text-xs font-bold text-white truncate">
                {user?.fullName || "Admin Name"}
              </h4>
              <p className="text-[9px] text-cyan-400 font-mono uppercase tracking-wider">
                {user?.isSystemAdmin
                  ? "Admin"
                  : isCoordinator
                  ? "Admin"
                  : isAssistant
                  ? "Công tác sinh viên"
                  : isAdminView
                  ? "Người xem"
                  : "Admin"}
              </p>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav
          className={`flex-1 py-6 space-y-2 overflow-y-auto ${
            isSidebarCollapsed ? "px-2" : "px-3"
          }`}
        >
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`flex items-center rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 relative overflow-hidden ${
                  isSidebarCollapsed
                    ? "justify-center p-3"
                    : "gap-3 px-4 py-3"
                } ${
                  active
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 border border-transparent hover:border-white/5"
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-0 h-full w-[3px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                )}
                <Icon
                  size={18}
                  className={`shrink-0 ${active ? "text-cyan-400" : "text-slate-500"}`}
                />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div
          className={`border-t border-white/5 bg-slate-900/10 ${
            isSidebarCollapsed ? "p-2 flex justify-center" : "p-4"
          }`}
        >
          <button
            onClick={handleLogoutClick}
            title={isSidebarCollapsed ? "Đăng xuất" : undefined}
            className={`flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 hover:text-rose-300 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(244,63,94,0.1)] hover:shadow-[0_0_15px_rgba(244,63,94,0.2)] ${
              isSidebarCollapsed ? "w-10 h-10 p-0" : "w-full gap-2 px-4 py-2.5"
            }`}
          >
            <LogOut size={14} className="shrink-0" />
            {!isSidebarCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div
        className={`flex-1 transition-all duration-300 flex flex-col min-h-screen relative ${
          isSidebarCollapsed ? "ml-[72px]" : "ml-[280px]"
        }`}
      >
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[32px_32px] pointer-events-none"></div>

        {/* TopAppBar */}
        <header className="h-16 w-full px-8 bg-slate-950/90 border-b border-white/5 flex justify-between items-center z-10 sticky top-0 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
              className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50 rounded-lg transition-colors flex items-center justify-center border border-white/5 cursor-pointer"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <span className="font-extrabold text-cyan-300 text-sm tracking-widest uppercase font-mono">
              Hệ thống SEAL Hackathon
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-slate-400 hover:text-cyan-300 transition-colors relative p-1.5 rounded-full hover:bg-cyan-500/10"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">

                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-[420px] max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] z-50">
                  <div className="flex justify-between items-center p-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                    <h4 className="text-sm font-semibold text-white font-mono">
                      Thông báo
                    </h4>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="text-rose-400 hover:text-rose-300 inline-flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Xóa tất cả
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 font-mono">
                        Chưa có thông báo nào.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => {
                            if (notif.status === "pending" || !notif.isRead)
                              markAsRead(notif._id);
                          }}
                          className={`group relative p-3 border-b border-slate-800/50 cursor-pointer transition-colors flex justify-between items-start ${
                            notif.status === "pending" || !notif.isRead
                              ? "bg-cyan-950/20 hover:bg-cyan-950/30"
                              : "hover:bg-slate-800/50"
                          }`}
                        >
                          <div className="flex-1 pr-3">
                            <p
                              className={`text-xs font-semibold whitespace-normal wrap-break-word ${
                                notif.status === "pending" || !notif.isRead
                                  ? "text-cyan-300"
                                  : "text-slate-300"
                              }`}
                            >
                              {notif.title}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 whitespace-normal wrap-break-word leading-relaxed">
                              {notif.body}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-2">
                              {new Date(notif.createdAt).toLocaleString("vi-VN")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => deleteNotification(notif._id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 rounded-sm transition-all shrink-0"
                            title="Xóa thông báo"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 p-8 relative z-0">
          <Outlet context={{ readOnly: isAdminView, roles, user }} />
        </main>
      </div>
    </div>
  );
}
