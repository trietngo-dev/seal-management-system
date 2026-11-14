import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  Bell,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react';

interface JudgeLayoutProps {
  user: any;
  roles: any[];
  onLogout: () => void;
}

export default function JudgeLayout({ user, roles = [], onLogout }: JudgeLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("judge_sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("judge_sidebar_collapsed", String(next));
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
            }
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/notifications/${id}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNotifications(
        notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n))
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
        }
      );
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
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

  const respondToAssistRequest = async (notification: any, decision: 'approved' | 'rejected') => {
    const requestId = notification.metadata?.requestId;
    if (!requestId) return;
    try {
      setRespondingRequestId(requestId);
      const token = localStorage.getItem('token');
      await axios.patch(
        `http://localhost:5000/api/grades/assist/${requestId}/respond`,
        { decision },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNotifications((current) => current.map((item) =>
        item._id === notification._id
          ? { ...item, isRead: true, metadata: { ...item.metadata, requestStatus: decision } }
          : item,
      ));
    } catch (err) {
      console.error('Failed to respond to grading assist request', err);
    } finally {
      setRespondingRequestId('');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const isMentor = roles?.some((r: any) => r.role === 'mentor');

  const navItems = [
    {
      path: '/judge/dashboard',
      label: 'Bảng điều khiển',
      icon: LayoutDashboard
    },
    {
      path: '/judge/projects',
      label: 'Dự án cần chấm',
      icon: BookOpen
    }
  ];

  if (isMentor) {
    navItems.push({
      path: '/mentor/dashboard',
      label: 'Mentor Dashboard',
      icon: Users
    });
  }


  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex font-sans selection:bg-primary/30">
      {/* SideNavBar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white border-r border-slate-200 flex flex-col z-20 shadow-xs transition-all duration-300 ${
          isSidebarCollapsed ? "w-[72px]" : "w-[280px]"
        }`}
      >
        {/* User Quick Info */}
        <div
          className={`py-4 border-b border-slate-200 flex items-center bg-slate-50 ${
            isSidebarCollapsed ? "px-3 justify-center" : "px-6 gap-3"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#F27024] to-[#f9823a] text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
            {user?.fullName?.charAt(0) || "J"}
          </div>
          {!isSidebarCollapsed && (
            <div className="overflow-hidden">
              <h4 className="text-sm font-bold text-slate-800 truncate">
                {user?.fullName || "Judge Name"}
              </h4>
              <p className="text-xs text-primary font-semibold mt-0.5 tracking-normal">
                Vai trò: {isMentor ? "Giám khảo & Mentor" : "Giám khảo"}
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden ${
                  isSidebarCollapsed
                    ? "justify-center p-3"
                    : "gap-3 px-4 py-3"
                } ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200"
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-0 h-full w-[3.5px] bg-primary shadow-[0_0_8px_rgba(242,112,36,0.4)]"></div>
                )}
                <Icon
                  size={18}
                  className={`shrink-0 ${active ? "text-primary" : "text-slate-500"}`}
                />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div
          className={`border-t border-slate-200 bg-slate-50 ${
            isSidebarCollapsed ? "p-2 flex justify-center" : "p-4"
          }`}
        >
          <button
            onClick={handleLogoutClick}
            title={isSidebarCollapsed ? "Đăng xuất" : undefined}
            className={`flex items-center justify-center bg-rose-50 hover:bg-rose-100/70 border border-rose-200 rounded-xl text-rose-600 text-sm font-bold transition-all shadow-xs ${
              isSidebarCollapsed ? "w-10 h-10 p-0" : "w-full gap-2 px-4 py-2.5"
            }`}
          >
            <LogOut size={16} className="shrink-0" />
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
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-size-[32px_32px] pointer-events-none"></div>

        {/* TopAppBar */}
        <header className="h-16 w-full px-8 bg-white border-b border-slate-200 flex justify-between items-center z-10 sticky top-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
              className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center border border-slate-200 cursor-pointer"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <span className="font-extrabold text-slate-800 text-sm tracking-wider uppercase">
              Hệ thống SEAL Hackathon
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-slate-500 hover:text-primary transition-colors relative p-2 rounded-full hover:bg-primary/10"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">

                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50">
                  <div className="flex justify-between items-center p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Thông báo
                    </h4>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-primary hover:text-[#d95f1f]"
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="text-rose-500 hover:text-rose-600 transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Xóa tất cả
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Chưa có thông báo nào.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => {
                            if (!notif.isRead)
                              markAsRead(notif._id);
                          }}
                          className={`group relative p-3 border-b border-slate-50 cursor-pointer transition-colors flex justify-between items-start ${
                            !notif.isRead
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex-1 pr-3">
                            <p
                              className={`text-xs font-semibold ${
                                !notif.isRead
                                  ? "text-primary"
                                  : "text-slate-700"
                              }`}
                            >
                              {notif.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {notif.body}
                            </p>
                            {notif.type === 'grading_assist_request' && !notif.metadata?.requestStatus && (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={respondingRequestId === notif.metadata?.requestId}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    respondToAssistRequest(notif, 'approved');
                                  }}
                                  className="rounded-lg bg-primary px-2 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-[#d95f1f] focus:outline-hidden focus:ring-2 focus:ring-[#F27024]/30 disabled:opacity-50"
                                >
                                  Chấp thuận
                                </button>
                                <button
                                  type="button"
                                  disabled={respondingRequestId === notif.metadata?.requestId}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    respondToAssistRequest(notif, 'rejected');
                                  }}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                                >
                                  Từ chối
                                </button>
                              </div>
                            )}
                            {notif.metadata?.requestStatus && (
                              <p className="mt-2 text-[10px] font-semibold text-slate-500">
                                Đã {notif.metadata.requestStatus === 'approved' ? 'chấp thuận' : 'từ chối'}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-2">
                              {new Date(notif.createdAt).toLocaleString('vi-VN')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => deleteNotification(notif._id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-sm transition-all shrink-0"
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
