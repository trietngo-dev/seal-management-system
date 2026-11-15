import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  LogOut,
  Award,
  ShieldAlert,
  GitBranch,
  BarChart2,
  Bell,
  Compass,
  Settings2,
  MessageSquare,
  Camera,
  Calendar,
  UserPlus,
  UserCog,
  LogIn,
  Trash2,
  LifeBuoy,
} from "lucide-react";

interface NavbarProps {
  user: any;
  roles: any[];
  onLogout: () => void;
  onOpenProfile?: () => void;
}

export default function Navbar({ user, roles, onLogout, onOpenProfile }: NavbarProps) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname.startsWith("/forgot") ||
    location.pathname.startsWith("/reset") ||
    location.pathname === "/register";
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkRegistrationStatus = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
        const res = await axios.get(`${apiBase}/api/events?status=registration`);
        setIsRegistrationOpen(res.data && res.data.length > 0);
      } catch (err) {
        console.error("Failed to fetch registration status:", err);
        setIsRegistrationOpen(false);
      }
    };
    checkRegistrationStatus();
  }, [user, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const checkTeamStatus = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setHasTeam(false);
        return;
      }
      try {
        const res = await axios.get("http://localhost:5000/api/teams/my-team", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data && res.data.team) {
          const team = res.data.team;
          const isEventEnded = team && (
            team.eventId?.status === 'completed' ||
            team.eventId?.status === 'cancelled' ||
            (team.eventId?.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
          );
          if (team && !isEventEnded) {
            setHasTeam(true);
          } else {
            setHasTeam(false);
          }
        } else {
          setHasTeam(false);
        }
      } catch (err) {
        setHasTeam(false);
      }
    };

    if (user) {
      checkTeamStatus();
    } else {
      setHasTeam(false);
    }
  }, [user, location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.08, start);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      const now = audioCtx.currentTime;
      playTone(783.99, now, 0.12);
      playTone(1046.50, now + 0.08, 0.20);
    } catch (error) {
      console.warn("AudioContext failed to play sound:", error);
    }
  };

  const showDesktopNotification = (notif: any) => {
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      document.hidden
    ) {
      try {
        new Notification(notif.title, {
          body: notif.body,
          icon: "/favicon.png",
        });
      } catch (err) {
        console.warn("Failed to create desktop notification:", err);
      }
    }
  };

  useEffect(() => {
    if (user) {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

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
      // Polling every 2m as fallback (Socket.io is active for real-time)
      const interval = setInterval(fetchNotifications, 120000);

      // Real-time: connect socket to receive instant push notifications
      const token = localStorage.getItem("token");
      if (token) {
        const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
        const sock = io(socketUrl, { auth: { token } });
        socketRef.current = sock;
        sock.on("new_notification", (notif: any) => {
          setNotifications((prev) => [notif, ...prev]);

          // Suppress alert/toast/sound if the user is already actively viewing this chat room
          const activeRoomId = (window as any).activeChatRoomId;
          const notifRoomId = notif.metadata?.roomId;
          if (
            activeRoomId &&
            notifRoomId &&
            activeRoomId.toString() === notifRoomId.toString()
          ) {
            return;
          }

          playNotificationSound();
          toast(notif.title, {
            description: notif.body,
            duration: 5000,
          });
          showDesktopNotification(notif);
        });
      }

      return () => {
        clearInterval(interval);
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
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
        },
      );
      setNotifications(prev =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
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
      setNotifications(prev => prev.map((n) => ({ ...n, isRead: true })));
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

  const isSystemAdmin = user?.isSystemAdmin;
  const isCoordinator = !!isSystemAdmin || roles?.some((r) => r.role === "admin_view");
  const isAssistant = !isCoordinator && (user?.isStudentAssistant || roles?.some((r) => r.role === "student_assistant"));
  const isJudge = roles?.some((r) => r.role === "judge") || isSystemAdmin;
  const isMentor = roles?.some((r) => r.role === "mentor");
  const isParticipant =
    roles?.some((r) => r.role === "participant") ||
    (!isSystemAdmin && !isCoordinator && !isJudge && !isMentor && !isAssistant);


  const isActive = (path: string) => location.pathname === path;

  const isLandingPage = location.pathname === "/";
  const usesLightShell =
    isLandingPage ||
    isAuthPage ||
    location.pathname === "/album" ||
    location.pathname === "/guest-portal" ||
    location.pathname === "/team-area" ||
    location.pathname === "/support" ||
    location.pathname === "/confirm-survey" ||
    location.pathname === "/my-achievements";

  const linkClass = (path: string, forceActive?: boolean) => {
    const active = forceActive !== undefined ? forceActive : isActive(path);
    if (usesLightShell) {
      if (isLandingPage) {
        return `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 font-mono
          ${active
            ? "bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_-3px_rgba(242,112,36,0.3)]"
            : "text-slate-350 hover:text-primary hover:bg-white/5 border border-transparent"
          }`;
      }
      return `flex items-center gap-2 px-3.5 py-2 rounded-full text-sm transition-colors duration-200
        ${active
          ? "bg-primary-soft text-primary font-semibold"
          : "text-ink-muted font-medium hover:text-primary hover:bg-primary-soft/60"
        }`;
    }
    return `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 font-mono
      ${active
        ? "bg-cyan-600/30 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]"
        : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
      }`;
  };

  const handleScrollToSchedule = (e: React.MouseEvent) => {
    if (location.pathname === "/") {
      e.preventDefault();
      const element = document.getElementById("schedule");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", "#schedule");
      }
    }
  };

  const isScheduleActive = location.pathname === "/" && location.hash === "#schedule";
  const isRegisterActive = location.pathname === "/team-area" || (location.pathname === "/login" && new URLSearchParams(location.search).get("redirect") === "/team-area");

  const navClass = isLandingPage
    ? isScrolled
      ? "fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-[#0B0805]/75 border-b border-slate-800/40 transition-all duration-300 shadow-lg"
      : "absolute top-0 left-0 w-full z-50 bg-transparent border-b-transparent shadow-none transition-all duration-300"
    : usesLightShell
      ? "glass-nav-light sticky top-0 z-50 w-full"
      : "glass-nav sticky top-0 z-50 w-full";

  return (
    <nav className={navClass}>
      <div className={`w-full flex items-center justify-between px-4 sm:px-6 lg:px-8 ${isLandingPage ? (isScrolled ? "py-3" : "py-4") : "py-4"}`}>
        {/* Brand Logo */}
        <div className="flex-1 flex justify-start">
          <Link
            to="/"
            className={`flex items-center group ${usesLightShell && !isLandingPage ? "" : "rounded-xl bg-white/90 px-3 py-1.5 shadow-xs"}`}
          >
            <img
              src="/seal_hackathon_logo.png"
              alt="SEAL Hackathon - Software Engineering Agile League"
              className="h-8 w-auto object-contain"
              draggable={false}
            />
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="hidden md:flex items-center gap-2 justify-center">
          {(isLandingPage || (!user && location.pathname === "/album")) && (
            <>
              <Link to="/#schedule" onClick={handleScrollToSchedule} className={linkClass("/#schedule", isScheduleActive)}>
                <Calendar size={16} />
                <span>Xem lịch trình</span>
              </Link>

              {isRegistrationOpen && (
                <Link to={user ? "/team-area" : "/login?redirect=/team-area"} className={linkClass(user ? "/team-area" : "/login", isRegisterActive)}>
                  <UserPlus size={16} />
                  <span>Đăng ký thi</span>
                </Link>
              )}
            </>
          )}

          {user && (
            <>
              {/* Participant Links */}
              {isParticipant && (
                <>
                  <Link to="/guest-portal" className={linkClass("/guest-portal")}>
                    <Compass size={16} />
                    <span>Trang chủ</span>
                  </Link>
                  {(hasTeam || isRegistrationOpen) && (
                    <Link to="/team-area" className={linkClass("/team-area")}>
                      <GitBranch size={16} />
                      <span>{hasTeam ? "Khu vực đội thi" : "Đăng ký đội thi"}</span>
                    </Link>
                  )}
                  <Link to="/my-achievements" className={linkClass("/my-achievements")}>
                    <Award size={16} />
                    <span>Thành tích của tôi</span>
                  </Link>
                  <Link to="/support" className={linkClass("/support")}>
                    <LifeBuoy size={16} />
                    <span>Hỗ trợ</span>
                  </Link>
                </>
              )}

              {/* Coordinator/Admin Links */}
              {isCoordinator && (
                <>
                  <Link to="/admin" className={linkClass("/admin")}>
                    <ShieldAlert size={16} />
                    <span>Quản trị viên</span>
                  </Link>
                  <Link to="/admin/events" className={linkClass("/admin/events")}>
                    <Settings2 size={16} />
                    <span>Thiết lập sự kiện</span>
                  </Link>
                  <Link to="/admin/grades" className={linkClass("/admin/grades")}>
                    <Award size={16} />
                    <span>Xem chi tiết điểm</span>
                  </Link>
                </>
              )}

              {/* Student Assistant Links */}
              {isAssistant && !isCoordinator && (
                <Link to="/admin" className={linkClass("/admin")}>
                  <ShieldAlert size={16} />
                  <span>Công tác sinh viên</span>
                </Link>
              )}

              {/* Expert Portal Links */}
              {(isJudge || isMentor) && !isCoordinator && (
                <Link to="/expert/dashboard" className={linkClass("/expert/dashboard")}>
                  <Award size={16} />
                  <span>Chọn vai trò</span>
                </Link>
              )}

              {/* General Links */}
              {isCoordinator && (
                <Link to="/leaderboard" className={linkClass("/leaderboard")}>
                  <BarChart2 size={16} />
                  <span>Bảng xếp hạng</span>
                </Link>
              )}
            </>
          )}

          {!isAuthPage && (
            <Link to="/album" className={linkClass("/album")}>
              <Camera size={16} />
              <span>Album ảnh</span>
            </Link>
          )}
        </div>
        {/* User Info & Actions */}
        <div className="flex-1 flex justify-end">
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Notification Bell */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`relative p-2 rounded-lg border border-transparent transition-all duration-200 ${usesLightShell ? "text-slate-500 hover:text-primary hover:bg-primary/10" : "text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"}`}
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-2.5 w-2.5">

                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border ${usesLightShell ? "border-white" : "border-slate-900"}`}></span>
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-[420px] max-h-96 overflow-y-auto border border-slate-200 rounded-xl shadow-2xl z-50 bg-white text-slate-800 notif-scroll">
                      <div className="flex justify-between items-center p-3 border-b sticky top-0 z-10 bg-white border-slate-200 text-slate-800">
                        <h4 className="text-sm font-semibold text-slate-800">
                          Thông báo
                        </h4>
                        <div className="flex items-center gap-3 text-xs">
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className={`font-semibold ${usesLightShell
                                  ? "text-primary hover:text-primary-hover"
                                  : "text-cyan-400 hover:text-cyan-300"
                                }`}
                            >
                              Đánh dấu đã đọc
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              onClick={clearAllNotifications}
                              className="text-rose-500 hover:text-rose-600 transition-colors inline-flex items-center gap-1 font-semibold"
                            >
                              <Trash2 size={12} /> Xóa tất cả
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                            <Bell size={24} className="text-slate-400" />
                            Chưa có thông báo nào.
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif._id}
                              onClick={() => {
                                if (!notif.isRead) markAsRead(notif._id);
                              }}
                              className={`group relative p-3 border-b cursor-pointer transition-colors flex gap-3 items-start ${!notif.isRead
                                  ? usesLightShell
                                    ? "bg-primary/5 hover:bg-primary/10 border-slate-200/50"
                                    : "bg-cyan-950/20 hover:bg-cyan-950/30 border-slate-800/50"
                                  : usesLightShell
                                    ? "hover:bg-slate-100/50 border-slate-200/50"
                                    : "hover:bg-slate-800/50 border-slate-800/50"
                                }`}
                            >
                              <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${notif.type === 'chat_message'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : usesLightShell
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-cyan-500/20 text-cyan-400'
                                }`}>
                                {notif.type === 'chat_message'
                                  ? <MessageSquare size={14} />
                                  : <Bell size={14} />}
                              </div>
                              <div className="flex-1 min-w-0 font-sans pr-6">
                                <p className={`text-xs font-semibold ${!notif.isRead
                                    ? usesLightShell
                                      ? "text-slate-900 font-bold"
                                      : "text-cyan-300"
                                    : "text-slate-600"
                                  }`}>
                                  {notif.title}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5 whitespace-normal wrap-break-word leading-relaxed">
                                  {notif.body}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1.5">
                                  {new Date(notif.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!notif.isRead && (
                                  <div className={`w-2 h-2 rounded-full ${usesLightShell
                                      ? "bg-primary shadow-[0_0_6px_rgba(242,112,36,0.8)]"
                                      : "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
                                    }`} />
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => deleteNotification(notif._id, e)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-sm transition-all"
                                  title="Xóa thông báo"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-right hidden sm:block font-sans">
                  <p className={`text-sm font-semibold ${usesLightShell ? "text-slate-800" : "text-slate-200"}`}>
                    {user.fullName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {(() => {
                      if (isSystemAdmin) return "Quản trị viên Hệ thống";
                      const rolesList = [];
                      if (roles?.some((r: any) => r.role === "coordinator" || r.role === "admin_view")) rolesList.push("Admin");
                      if (user?.isStudentAssistant || roles?.some((r: any) => r.role === "student_assistant")) rolesList.push("Công tác sinh viên");
                      if (roles?.some((r: any) => r.role === "judge")) rolesList.push("Giám khảo");
                      if (roles?.some((r: any) => r.role === "mentor")) rolesList.push("Mentor");
                      if (roles?.some((r: any) => r.role === "participant") && rolesList.length === 0) rolesList.push("Thí sinh");
                      return rolesList.length > 0 ? rolesList.join(" & ") : "Thí sinh";
                    })()}
                  </p>
                </div>

                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${usesLightShell
                        ? "bg-primary text-white shadow-sm hover:bg-primary-hover"
                        : "font-mono bg-cyan-950/50 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)] hover:bg-cyan-950/80 hover:border-cyan-500/50"
                      }`}
                    title="Menu tài khoản"
                  >
                    <span>{user.fullName.charAt(0)}</span>
                  </button>

                  {showUserMenu && (
                    <div
                      className={`absolute right-0 mt-2 w-48 rounded-xl border shadow-2xl p-1.5 z-9999 font-sans ${usesLightShell
                          ? "bg-[#faf9f6] border-slate-200 text-slate-800"
                          : "bg-[#0c1322] border-cyan-500/30 text-slate-200 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                        }`}
                    >
                      {(isCoordinator || isAssistant) && (
                        <Link
                          to="/admin"
                          onClick={() => setShowUserMenu(false)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-left transition-colors cursor-pointer ${usesLightShell
                              ? "hover:bg-slate-100 text-slate-700"
                              : "hover:bg-cyan-950/30 text-slate-300 hover:text-cyan-400"
                            }`}
                        >
                          <ShieldAlert size={14} className={usesLightShell ? "text-primary" : "text-cyan-400"} />
                          <span>{isCoordinator ? "Trang Quản trị" : "Trang Công tác sinh viên"}</span>
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenProfile?.();
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-left transition-colors cursor-pointer ${usesLightShell
                            ? "hover:bg-slate-100 text-slate-700"
                            : "hover:bg-cyan-950/30 text-slate-300 hover:text-cyan-400"
                          }`}
                      >
                        <UserCog size={14} className={usesLightShell ? "text-primary" : "text-cyan-400"} />
                        <span>Hồ sơ</span>
                      </button>
                      <div className={`my-1 border-t ${usesLightShell ? "border-slate-200" : "border-slate-800"}`}></div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-left transition-colors cursor-pointer text-rose-500 hover:text-rose-600 ${usesLightShell
                            ? "hover:bg-rose-50/50"
                            : "hover:bg-rose-500/10"
                          }`}
                      >
                        <LogOut size={14} />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              !isLoginPage && (
                <Link
                  to="/login"
                  className={`${isLandingPage ? "border border-primary/40 text-primary hover:bg-primary/10 rounded-xl hover:border-primary/75 transition-all duration-300 gap-1.5" : (usesLightShell ? "btn-fpt" : "btn-primary")} text-xs font-bold uppercase tracking-wider px-5 py-2.5 flex items-center justify-center`}
                >
                  <LogIn size={14} />
                  <span>Đăng nhập</span>
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
