import { useState, useEffect, useRef } from "react";
import { useNavigate, useOutletContext, Navigate } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { FolderKanban, CalendarPlus, Info, X, Eye, User, Activity } from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { readOnly, roles, user } = useOutletContext<{ readOnly?: boolean; roles?: any[]; user?: any }>();
  const isAssistant = !user?.isSystemAdmin && (user?.isStudentAssistant || roles?.some((r: any) => r.role === 'student_assistant'));

  if (isAssistant) {
    return <Navigate to="/admin/events" replace />;
  }
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'operation' | 'login' | 'grading' | 'error' | 'system'>('all');

  const getLogTypeBadge = (type: string) => {
    switch (type) {
      case 'error':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase tracking-wider shadow-[0_0_8px_rgba(244,63,94,0.1)]">Lỗi</span>;
      case 'login':
        return <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase tracking-wider shadow-[0_0_8px_rgba(168,85,247,0.1)]">Đăng nhập</span>;
      case 'grading':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase tracking-wider shadow-[0_0_8px_rgba(245,158,11,0.1)]">Chấm điểm</span>;
      case 'system':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase tracking-wider shadow-[0_0_8px_rgba(16,185,129,0.1)]">Hệ thống</span>;
      case 'operation':
      default:
        return <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase tracking-wider shadow-[0_0_8px_rgba(6,182,212,0.1)]">Thao tác</span>;
    }
  };

  const getLogDotColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-rose-500';
      case 'login': return 'bg-purple-500';
      case 'grading': return 'bg-amber-500';
      case 'system': return 'bg-emerald-500';
      case 'operation':
      default:
        return 'bg-cyan-400';
    }
  };

  const filteredLogs = logs.filter(log => logFilter === 'all' || log.type === logFilter);

  useEffect(() => {
    fetchEvents();
    fetchAllLogs();
    const token = localStorage.getItem("token");
    if (token) {
      const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
      const sock = io(socketUrl, { auth: { token } });
      socketRef.current = sock;
      sock.on("new_event_log", (newLog: any) => {
        if (newLog.type === 'system') return;
        if (newLog.details && (
          newLog.details.includes('Lỗi hệ thống') || 
          newLog.details.includes('/favicon.ico') || 
          newLog.details.includes('Not Found') ||
          newLog.details.toLowerCase().includes('system error')
        )) {
          return;
        }
        setLogs((prev) => [newLog, ...prev]);
      });
      return () => {
        sock.disconnect();
        socketRef.current = null;
      };
    }
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:5000/api/events");
      let eventData = res.data;

      // If the user is an admin_view user, filter to only show events where they are assigned as admin_view
      if (readOnly && roles) {
        const assignedEventIds = roles
          .filter((r: any) => r.role === 'admin_view')
          .map((r: any) => String(r.eventId?._id || r.eventId));

        eventData = eventData.filter((e: any) => assignedEventIds.includes(String(e._id)));
      }

      setEvents(eventData);
    } catch (err) {
      console.error("Lỗi lấy danh sách sự kiện:", err);
      toast.error("Lỗi khi tải danh sách cuộc thi.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLogs = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/events/all/logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cleanLogs = (res.data || []).filter((log: any) => {
        if (log.type === 'system') return false;
        if (log.details && (
          log.details.includes('Lỗi hệ thống') || 
          log.details.includes('/favicon.ico') || 
          log.details.includes('Not Found') ||
          log.details.toLowerCase().includes('system error')
        )) {
          return false;
        }
        return true;
      });
      setLogs(cleanLogs);
    } catch (err) {
      console.error("Lỗi lấy nhật ký hoạt động:", err);
    }
  };

  const handleEventDoubleClick = (eventObj: any) => {
    navigate(`/admin/events?eventId=${eventObj._id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            <span className="text-cyan-400 text-cyan-glow font-mono-tech">QUẢN LÝ SỰ KIỆN</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Danh sách các cuộc thi hackathon đang diễn ra và đã kết thúc. Chọn cuộc thi để xem cấu hình chi tiết.
          </p>
        </div>
        {user?.isSystemAdmin && (
          <button
            onClick={() => navigate("/admin/events?create=true")}
            className="bg-cyan-500 hover:bg-cyan-400 text-white px-4 py-2.5 rounded-xl border border-cyan-500/20 text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/25 transition-all"
          >
            <CalendarPlus size={14} />
            TẠO CUỘC THI MỚI
          </button>
        )}
      </div>

      <div className="w-full space-y-4">
        <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2 font-mono">
          <FolderKanban size={18} className="text-cyan-400" />
          <span>DANH SÁCH SỰ KIỆN HIỆN CÓ</span>
        </h3>
        {loading ? (
          <p className="text-xs text-slate-500 animate-pulse font-mono">Đang tải danh sách cuộc thi...</p>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((e: any) => (
              <button
                key={e._id}
                onClick={() => handleEventDoubleClick(e)}
                onDoubleClick={() => handleEventDoubleClick(e)}
                className="w-full text-left p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-32 border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/40 text-slate-400 cursor-pointer"
              >
                <div>
                  <div className="flex justify-between items-start w-full">
                    <span className="font-bold text-sm tracking-tight text-slate-200">
                      {e.name}
                    </span>
                    <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded-sm font-mono border border-slate-800 text-slate-350">
                      {e.semester} {e.year}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center w-full mt-4 pt-2 border-t border-slate-800/40 text-[10px] font-mono">
                  <span>
                    Trạng thái:{" "}
                    <strong className="text-cyan-300 uppercase">
                      {e.status}
                    </strong>
                  </span>
                  <span className="text-cyan-400 font-bold bg-cyan-500/5 px-2.5 py-0.5 rounded-sm">
                    {e.teamCount || 0} Đội tham gia
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic font-mono">
            Chưa có cuộc thi nào được khởi tạo.
          </p>
        )}
      </div>

      {/* EVENT LOGS SECTION */}
      <div className="w-full space-y-4 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-md font-bold text-slate-800 flex items-center gap-2 font-mono">
            <Info size={18} className="text-primary" />
            <span>NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG</span>
          </h3>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Filter buttons */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner shrink-0">
              {[
                { value: 'all', label: 'Tất cả' },
                { value: 'operation', label: 'Thao tác' },
                { value: 'grading', label: 'Chấm điểm' },
                { value: 'error', label: 'Lỗi' }
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setLogFilter(btn.value as any)}
                  className={`px-3 py-1.5 text-[9px] font-bold rounded uppercase transition-all cursor-pointer ${
                    logFilter === btn.value
                      ? btn.value === 'error'
                        ? 'bg-rose-500 text-white! shadow-xs'
                        : btn.value === 'grading'
                        ? 'bg-amber-500 text-white! shadow-xs'
                        : 'bg-primary text-white! shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <button
              onClick={fetchAllLogs}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono transition-all cursor-pointer shrink-0"
            >
              Tải lại
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-h-96 overflow-y-auto">
          {filteredLogs.length > 0 ? (
            <div className="flow-root">
              <ul className="-mb-8">
                {filteredLogs.map((log: any, logIdx: number) => (
                  <li key={log._id}>
                    <div className="relative pb-8">
                      {logIdx !== filteredLogs.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div 
                        onClick={() => setSelectedLog(log)}
                        className="relative flex space-x-3 cursor-pointer group hover:bg-slate-50 p-3 -m-3 rounded-2xl transition-all"
                      >
                        <div>
                          <span className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center ring-4 ring-slate-100">
                            <span className={`h-2 w-2 rounded-full animate-pulse ${getLogDotColor(log.type)}`} />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-slate-800">
                              <span className="text-primary font-bold font-mono mr-2 bg-primary/10 px-2 py-0.5 rounded-sm border border-primary/20 text-[10px]">
                                {log.eventId?.name || "HỆ THỐNG"}
                              </span>
                              {log.details}{" "}
                              <span className="font-mono text-xs text-slate-500 font-medium mr-2">
                                ({log.action})
                              </span>
                              {getLogTypeBadge(log.type)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-2">
                              <span>Thực hiện bởi:</span>
                              <span className="text-primary font-semibold font-mono">
                                {log.actorId?.fullName || "Hệ thống"}
                              </span>
                              <span>({log.actorId?.email || "N/A"})</span>
                            </p>
                          </div>
                          <div className="text-right text-xs whitespace-nowrap text-slate-500 font-mono flex flex-col items-end justify-between">
                            <time dateTime={log.createdAt}>
                              {new Date(log.createdAt).toLocaleString("vi-VN")}
                            </time>
                            <span className="text-primary opacity-0 group-hover:opacity-100 transition-all text-xs font-mono flex items-center gap-1 mt-1">
                              <span>Chi tiết</span>
                              <Eye size={12} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500 font-mono text-sm">
              Chưa có nhật ký hoạt động nào được ghi nhận cho danh mục này.
            </p>
          )}
        </div>
      </div>

      {/* DETAIL EVENT LOG MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md transition-all duration-300">
          <div className="relative w-full max-w-lg border border-slate-800/80 bg-slate-950 p-6 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-6 font-sans text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Top decorative line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-linear-to-r from-transparent via-cyan-500/50 to-transparent"></div>
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="text-cyan-400 shrink-0 animate-pulse" size={20} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Chi tiết Nhật ký Hoạt động
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-4">
              {/* Event Name */}
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                <span className="text-xs text-slate-400 font-mono">Sự kiện:</span>
                <span className="text-xs text-cyan-400 font-bold font-mono bg-cyan-500/10 px-2 py-0.5 rounded-sm border border-cyan-500/20">
                  {selectedLog.eventId?.name || "HỆ THỐNG CHUNG"}
                </span>
              </div>

              {/* Action Badge */}
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                <span className="text-xs text-slate-400 font-mono">Loại hành động:</span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono tracking-wide ${
                  selectedLog.action.includes('event') ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' :
                  selectedLog.action.includes('role') ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400' :
                  selectedLog.action.includes('track') || selectedLog.action.includes('team') ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
                  selectedLog.action.includes('rubric') || selectedLog.action.includes('criterion') ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' :
                  selectedLog.action.includes('results') ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' :
                  'bg-slate-500/10 border border-slate-500/30 text-slate-400'
                }`}>
                  {selectedLog.action}
                </span>
              </div>

              {/* Action Description */}
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-mono">Mô tả hoạt động:</span>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/80 text-sm text-white font-medium leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>

              {/* Actor Info */}
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-mono">Thực hiện bởi:</span>
                <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                  <div className="h-10 w-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 font-bold font-mono">
                    <User size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      {selectedLog.actorId?.fullName || "Hệ thống"}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {selectedLog.actorId?.email || "system@internal"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Time */}
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                <span className="text-xs text-slate-400 font-mono">Thời gian thực hiện:</span>
                <span className="text-xs text-slate-300 font-mono">
                  {new Date(selectedLog.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800/50">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-slate-300 hover:text-white text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
