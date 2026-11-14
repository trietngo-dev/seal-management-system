import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Terminal,
  ArrowRight,
  Shield,
  Compass,
  Scale,
  Users,
  DollarSign,
  Download,
  Calendar,
  Clock,
  GitBranch,
  Award,
  FileText,
  Target,
} from "lucide-react";

interface GuestPortalProps {
  user: any;
}

export default function GuestPortal({ user }: GuestPortalProps) {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);

  const activeEvent =
    [...events].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0] || null;

  const formatDateString = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Chưa có thông báo";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Chưa có thông báo";

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  };

  const formatEventDateRange = (
    startDateStr: string | null | undefined,
    endDateStr: string | null | undefined,
  ) => {
    if (!startDateStr) return "";
    const startStr = formatDateString(startDateStr);
    if (startStr === "Chưa có thông báo") return "Chưa có thông báo";

    if (!endDateStr) {
      return `Bắt đầu từ ${startStr}`;
    }

    const endStr = formatDateString(endDateStr);
    if (endStr === "Chưa có thông báo") {
      return `Bắt đầu từ ${startStr}`;
    }

    return `Từ ${startStr} đến ${endStr}`;
  };

  const formatSingleDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    const dateStrFormatted = formatDateString(dateStr);
    if (dateStrFormatted === "Chưa có thông báo") return "Chưa có thông báo";
    return `Bắt đầu từ ${dateStrFormatted}`;
  };

  const getPhaseStatus = (phase: number) => {
    if (!activeEvent) {
      return {
        label: "CHƯA DIỄN RA",
        classes:
          "text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-sm bg-slate-100/50",
      };
    }

    // If the event itself is completed or cancelled, all phases are ended
    if (
      activeEvent.status === "completed" ||
      activeEvent.status === "cancelled"
    ) {
      return {
        label: "ĐÃ KẾT THÚC",
        classes:
          "text-slate-500 border border-slate-250 px-1.5 py-0.5 rounded-sm bg-slate-150/50",
      };
    }

    const now = new Date();
    const regOpen = activeEvent.registrationOpen
      ? new Date(activeEvent.registrationOpen)
      : null;
    const contestStart = activeEvent.contestStart
      ? new Date(activeEvent.contestStart)
      : null;
    const contestEnd = activeEvent.contestEnd
      ? new Date(activeEvent.contestEnd)
      : null;

    // Determine current active phase (1, 2, or 3)
    const currentPhase = (() => {
      if (regOpen && now < regOpen) return 1;
      if (contestEnd && now >= contestEnd) return 3;
      if (contestStart && now >= contestStart) return 2;
      return 1;
    })();

    if (phase === currentPhase) {
      return {
        label: "ĐANG DIỄN RA",
        classes:
          "text-primary border border-primary/30 px-1.5 py-0.5 rounded-sm bg-primary/10",
      };
    } else if (phase < currentPhase) {
      return {
        label: "ĐÃ KẾT THÚC",
        classes:
          "text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-sm bg-slate-100",
      };
    } else {
      return {
        label: "CHƯA DIỄN RA",
        classes:
          "text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded-sm bg-slate-50",
      };
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/events");
        const allEvents = res.data;

        // Prioritize registration or ongoing events
        let filtered = allEvents.filter(
          (e: any) => e.status === "registration" || e.status === "ongoing",
        );

        // Fallback to completed or prepare if none of the above exist
        if (filtered.length === 0) {
          filtered = allEvents.filter(
            (e: any) => e.status === "completed" || e.status === "prepare",
          );
        }

        // Sort by newest
        const sorted = filtered.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        // Show only a single event
        setEvents(sorted.length > 0 ? [sorted[0]] : []);
      } catch (err) {
        console.error("Lỗi lấy danh sách cuộc thi:", err);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    const checkTeamStatus = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/teams/my-team", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data && res.data.team) {
          const team = res.data.team;
          const isEventEnded =
            team &&
            (team.eventId?.status === "completed" ||
              team.eventId?.status === "cancelled" ||
              (team.eventId?.contestEnd &&
                new Date(team.eventId.contestEnd) <= new Date()));
          if (team && !isEventEnded) {
            setHasTeam(true);
            setTeamName(team.name);
          } else {
            setHasTeam(false);
          }
        } else {
          setHasTeam(false);
        }
      } catch (err) {
        setHasTeam(false);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      checkTeamStatus();
    } else {
      setLoading(false);
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <Terminal
            size={32}
            className="mx-auto text-primary animate-pulse"
          />
          <p className="text-primary text-sm tracking-widest animate-pulse">
            [ACCESSING_PORTAL_TERMINAL...]
          </p>
        </div>
      </div>
    );
  }

  const displayName = user?.fullName || "GUEST_USER";

  const getPhaseStyles = (phaseNum: number) => {
    const statusObj = getPhaseStatus(phaseNum);
    const label = statusObj.label;

    let headingClass: string;
    let dateClass: string;
    let descClass: string;
    let renderDot: () => React.JSX.Element;

    if (label === "ĐANG DIỄN RA") {
      headingClass =
        "text-xs text-primary text-orange-glow font-bold uppercase tracking-wider";
      dateClass = "text-[9px] text-primary/80 font-mono";
      descClass = "text-[11px] text-slate-700";
      renderDot = () => (
        <span className="absolute left-[-20px] top-1 flex h-2.5 w-2.5">

          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary shadow-[0_0_8px_rgba(242,112,36,0.6)]"></span>
        </span>
      );
    } else if (label === "ĐÃ KẾT THÚC") {
      headingClass =
        "text-xs text-slate-750 font-bold uppercase tracking-wider";
      dateClass = "text-[9px] text-slate-500 font-mono";
      descClass = "text-[11px] text-slate-500";
      renderDot = () => (
        <div className="absolute left-[-19px] top-1 w-2.5 h-2.5 rounded-full bg-white border border-primary"></div>
      );
    } else {
      // CHƯA DIỄN RA
      headingClass =
        "text-xs text-slate-400 font-bold uppercase tracking-wider";
      dateClass = "text-[9px] text-slate-400 font-mono";
      descClass = "text-[11px] text-slate-400";
      renderDot = () => (
        <div className="absolute left-[-19px] top-1 w-2.5 h-2.5 rounded-full bg-white border border-slate-300"></div>
      );
    }

    return {
      label,
      classes: statusObj.classes,
      headingClass,
      dateClass,
      descClass,
      renderDot,
    };
  };

  const phase1 = getPhaseStyles(1);
  const phase2 = getPhaseStyles(2);
  const phase3 = getPhaseStyles(3);

  return (
    <div className="relative overflow-hidden font-sans bg-[#faf9f6] text-slate-900 min-h-screen">
      {/* Background Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 font-mono">
        {/* Hero Section */}
        <section className="relative grid grid-cols-1 items-center gap-8 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-8 transition-all hover:border-primary/40 hover:shadow-[0_0_20px_rgba(242,112,36,0.06)] md:grid-cols-2">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="z-10 w-full space-y-6 text-left">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">

                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-xs text-primary tracking-widest uppercase font-bold">
                [TRẠNG_THÁI: HOẠT_ĐỘNG]
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl text-slate-900 font-extrabold tracking-tight leading-tight">
              Chào mừng,
              <span className="block mt-1 text-primary text-orange-glow font-sans">
                {displayName}.
              </span>
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl font-sans">
              {hasTeam
                ? `Hệ thống của bạn đang hoạt động. Bạn hiện đã tham gia đội thi "${teamName}". Hãy truy cập khu vực quản lý của đội thi để xem nhiệm vụ dự án, đồng bộ commits và kiểm tra đánh giá từ AI.`
                : "Hệ thống của bạn đang hoạt động. Cuộc thi SEAL Hackathon đang chờ bạn nhập thông tin. Bạn đã sẵn sàng khởi tạo các tham số nhiệm vụ và gia nhập một đội chưa?"}
            </p>

            <div className="pt-2">
              {hasTeam ? (
                <button
                  onClick={() => navigate("/team-area")}
                  className="btn-fpt font-bold px-8 py-3 uppercase tracking-wider flex items-center gap-2"
                >
                  <Terminal size={18} />
                  <span>Vào Khu vực Đội thi</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate("/team-area")}
                  className="btn-fpt font-bold px-8 py-3 uppercase tracking-wider flex items-center gap-2"
                >
                  <Users size={18} />
                  <span>Hoàn tất đăng ký đội</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner md:max-w-[320px]">
            <img
              src="/seal_shield_badge.png"
              alt="SEAL Shield"
              draggable={false}
              className="block w-full h-full object-contain p-4"
            />
            <div className="absolute inset-0 border border-primary/20 pointer-events-none rounded-xl"></div>
          </div>
        </section>

        {/* Active Competitions Widget */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <Terminal size={18} className="text-primary shrink-0" />
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                Cuộc thi hiện có
              </h2>
            </div>
          </div>

          {loadingEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-white/75 h-48 rounded-2xl border border-slate-200 animate-pulse flex flex-col justify-between p-6"
                >
                  <div className="h-4 bg-slate-200 rounded-sm w-1/3"></div>
                  <div className="h-8 bg-slate-200 rounded-sm w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded-sm w-full"></div>
                </div>
              ))}
            </div>
          ) : events.length > 0 ? (
            events.length === 1 ? (
              <div className="w-full">
                {events.map((e: any) => {
                  const maxTeamsVal = e.maxTeams || 10;
                  const teamCountVal = e.teamCount || 0;
                  const percent = Math.min(
                    100,
                    (teamCountVal / maxTeamsVal) * 100,
                  );

                  let statusLabel: string;
                  let statusColor: string;
                  switch (e.status) {
                    case "registration":
                      statusLabel =
                        teamCountVal >= maxTeamsVal
                          ? "[ĐĂNG KÝ ĐÃ ĐẦY]"
                          : "[MỞ ĐĂNG KÝ]";
                      statusColor =
                        teamCountVal >= maxTeamsVal
                          ? "text-rose-600 font-extrabold"
                          : "text-primary";
                      break;
                    case "prepare":
                      statusLabel = "[ĐANG CHUẨN BỊ]";
                      statusColor = "text-amber-600";
                      break;
                    case "ongoing":
                      statusLabel = "[ĐANG DIỄN RA]";
                      statusColor = "text-amber-600";
                      break;
                    case "completed":
                      statusLabel = "[ĐÃ KẾT THÚC]";
                      statusColor = "text-emerald-600";
                      break;
                    case "cancelled":
                      statusLabel = "[ĐÃ HỦY]";
                      statusColor = "text-rose-500";
                      break;
                    default:
                      statusLabel = `[${e.status.toUpperCase()}]`;
                      statusColor = "text-slate-500";
                  }

                  return (
                    <div
                      key={e._id}
                      className="border border-slate-200 bg-white/95 p-6 md:p-8 rounded-2xl hover:border-primary/40 hover:shadow-[0_0_30px_rgba(242,112,36,0.08)] transition-all flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden group w-full text-left"
                    >
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-linear-to-r from-transparent via-[#F27024]/40 to-transparent group-hover:via-[#F27024]/60 transition-all duration-500"></div>

                      {/* Left block: Title, Semester, Year, Description */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3 text-[10px]">
                          <span
                            className={`font-bold uppercase tracking-wider ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                          <span className="text-slate-400 font-bold">•</span>
                          <span className="text-slate-500 font-semibold font-mono">
                            Học kỳ: {e.semester} {e.year}
                          </span>
                        </div>

                        <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 font-mono group-hover:text-primary transition-colors uppercase tracking-tight">
                          {e.name}
                        </h3>

                        <p className="text-xs md:text-sm text-slate-650 font-sans leading-relaxed max-w-4xl">
                          {e.description ||
                            "Chưa có mô tả chi tiết cho cuộc thi này."}
                        </p>
                      </div>

                      {/* Right block: Progress & Actions */}
                      <div className="w-full md:w-80 shrink-0 space-y-4 border-t md:border-t-0 md:border-l border-slate-200 pt-6 md:pt-0 md:pl-8">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-slate-500 font-semibold">
                            Số đội đã đăng ký:
                          </span>
                          <span className="text-slate-700 font-bold">
                            {teamCountVal} / {maxTeamsVal}
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-primary transition-all duration-500 shadow-[0_0_8px_rgba(242,112,36,0.4)]"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>

                        <div className="pt-2">
                          {e.status === "registration" &&
                            (teamCountVal >= maxTeamsVal && !hasTeam ? (
                              <div className="w-full py-3 border border-rose-300 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold text-center uppercase tracking-wider font-mono">
                                Đăng ký đã đầy (Đủ số đội)
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  if (hasTeam) {
                                    navigate("/team-area");
                                  } else {
                                    navigate(`/team-area?eventId=${e._id}`);
                                  }
                                }}
                                className="w-full py-3 border border-primary/30 rounded-xl bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 transition-all uppercase tracking-wider text-center cursor-pointer font-mono"
                              >
                                {hasTeam
                                  ? "Vào khu vực đội"
                                  : "Đăng ký tham gia"}
                              </button>
                            ))}

                          {e.status === "prepare" &&
                            (hasTeam ? (
                              <button
                                onClick={() => navigate("/team-area")}
                                className="w-full py-3 border border-primary/30 rounded-xl bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 transition-all uppercase tracking-wider text-center cursor-pointer font-mono"
                              >
                                Vào khu vực đội
                              </button>
                            ) : (
                              <div className="w-full py-3 border border-slate-200 rounded-xl bg-slate-100 text-slate-400 text-sm font-bold text-center uppercase tracking-wider font-mono">
                                Đã đóng đăng ký (Đang chuẩn bị)
                              </div>
                            ))}

                          {e.status === "ongoing" &&
                            (hasTeam ? (
                              <button
                                onClick={() => navigate("/team-area")}
                                className="w-full py-3 border border-primary/30 rounded-xl bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 transition-all uppercase tracking-wider text-center cursor-pointer font-mono"
                              >
                                Vào khu vực đội
                              </button>
                            ) : (
                              <div className="w-full py-3 border border-slate-200 rounded-xl bg-slate-100 text-slate-400 text-sm font-bold text-center uppercase tracking-wider font-mono">
                                Đã đóng đăng ký (Đang diễn ra)
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {events.map((e: any) => {
                  const maxTeamsVal = e.maxTeams || 10;
                  const teamCountVal = e.teamCount || 0;
                  const percent = Math.min(
                    100,
                    (teamCountVal / maxTeamsVal) * 100,
                  );

                  let statusLabel: string;
                  let statusColor: string;
                  switch (e.status) {
                    case "registration":
                      statusLabel =
                        teamCountVal >= maxTeamsVal
                          ? "[ĐĂNG KÝ ĐÃ ĐẦY]"
                          : "[MỞ ĐĂNG KÝ]";
                      statusColor =
                        teamCountVal >= maxTeamsVal
                          ? "text-rose-500 font-extrabold"
                          : "text-primary";
                      break;
                    case "prepare":
                      statusLabel = "[ĐANG CHUẨN BỊ]";
                      statusColor = "text-amber-500";
                      break;
                    case "ongoing":
                      statusLabel = "[ĐANG DIỄN RA]";
                      statusColor = "text-amber-600";
                      break;
                    case "completed":
                      statusLabel = "[ĐÃ KẾT THÚC]";
                      statusColor = "text-emerald-600";
                      break;
                    case "cancelled":
                      statusLabel = "[ĐÃ HỦY]";
                      statusColor = "text-rose-500";
                      break;
                    default:
                      statusLabel = `[${e.status.toUpperCase()}]`;
                      statusColor = "text-slate-500";
                  }

                  return (
                    <div
                      key={e._id}
                      className="border border-slate-200 bg-white/95 p-6 rounded-2xl hover:border-primary/40 hover:shadow-[0_0_25px_rgba(242,112,36,0.06)] transition-all flex flex-col justify-between gap-6 relative overflow-hidden group text-left"
                    >
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-linear-to-r from-transparent via-[#F27024]/0 to-transparent group-hover:via-[#F27024]/60 transition-all duration-500"></div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px]">
                          <span
                            className={`font-bold uppercase tracking-wider ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                          <span className="text-slate-500 font-semibold font-mono">
                            {e.semester} {e.year}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 font-mono group-hover:text-primary transition-colors uppercase tracking-tight">
                          {e.name}
                        </h3>

                        <p className="text-xs text-slate-600 font-sans leading-relaxed line-clamp-3">
                          {e.description ||
                            "Chưa có mô tả chi tiết cho cuộc thi này."}
                        </p>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-500">
                            Số đội đã đăng ký:
                          </span>
                          <span className="text-slate-700 font-bold">
                            {teamCountVal} / {maxTeamsVal}
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>

                        {e.status === "registration" &&
                          (teamCountVal >= maxTeamsVal && !hasTeam ? (
                            <div className="w-full mt-2 py-2 border border-rose-300 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold text-center uppercase tracking-wider font-mono">
                              Đăng ký đã đầy
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (hasTeam) {
                                  navigate("/team-area");
                                } else {
                                  navigate(`/team-area?eventId=${e._id}`);
                                }
                              }}
                              className="w-full mt-2 py-2 border border-primary/30 rounded-xl bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-all uppercase tracking-wider text-center cursor-pointer font-mono"
                            >
                              {hasTeam ? "Vào khu vực đội" : "Đăng ký tham gia"}
                            </button>
                          ))}

                        {e.status === "prepare" &&
                          (hasTeam ? (
                            <button
                              onClick={() => navigate("/team-area")}
                              className="w-full mt-2 py-2 border border-primary/30 rounded-xl bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-all uppercase tracking-wider text-center cursor-pointer font-mono"
                            >
                              Vào khu vực đội
                            </button>
                          ) : (
                            <div className="w-full mt-2 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold text-center uppercase tracking-wider font-mono">
                              Đã đóng đăng ký (Đang chuẩn bị)
                            </div>
                          ))}

                        {e.status === "ongoing" &&
                          (hasTeam ? (
                            <button
                              onClick={() => navigate("/team-area")}
                              className="w-full mt-2 py-2 border border-primary/30 rounded-xl bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-all uppercase tracking-wider text-center cursor-pointer font-mono"
                            >
                              Vào khu vực đội
                            </button>
                          ) : (
                            <div className="w-full mt-2 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold text-center uppercase tracking-wider font-mono">
                              Đã đóng đăng ký (Đang diễn ra)
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="border border-slate-200 text-center text-slate-500 italic text-xs font-mono py-8 bg-white/50 rounded-2xl">
              [HIỆN_TẠI_CHƯA_CÓ_CUỘC_THI_NÀO_ĐƯỢC_CÔNG_BỐ]
            </div>
          )}
        </section>

        {/* Intelligence & Roadmap Grid */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
          {/* Event Intelligence Panel */}
          <div className="col-span-1 md:col-span-5 bg-white/95 p-6 rounded-2xl flex flex-col justify-between border border-slate-200 hover:border-primary/30 transition-all">
            <div>
              <div className="border-b border-slate-100 pb-3 mb-6 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Shield size={18} className="text-primary" />
                  <span>Thông tin cuộc thi</span>
                </h2>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs text-primary font-bold uppercase tracking-wider mb-2">
                    Mục tiêu chính
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeEvent?.mainGoal ||
                      "Các đội thi sẽ xây dựng sản phẩm ứng dụng AI để tiếp nhận và phân tích dữ liệu IoT theo thời gian thực, phát hiện bất thường, dự đoán rủi ro và đề xuất phương án xử lý phù hợp."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-slate-150 p-3 bg-slate-50/50 rounded-xl">
                    <div className="text-[9px] text-slate-500 mb-1">
                      THỜI GIAN
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {activeEvent?.durationText || "Theo quy định"}
                    </div>
                  </div>
                  <div className="border border-slate-150 p-3 bg-slate-50/50 rounded-xl">
                    <div className="text-[9px] text-slate-500 mb-1">
                      SỐ THÀNH VIÊN
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {activeEvent?.memberLimitText || "3 - 5 Thành Viên"}
                    </div>
                  </div>
                  <div className="border border-slate-150 p-3 bg-slate-50/50 rounded-xl col-span-2 flex justify-between items-center">
                    <div>
                      <div className="text-[9px] text-slate-500 mb-1">
                        QUỸ GIẢI THƯỞNG
                      </div>
                      <div className="text-sm font-bold text-primary">
                        {activeEvent?.prizePoolText ||
                          "Tiền thưởng và chứng nhận"}
                      </div>
                    </div>
                    <DollarSign size={20} className="text-primary/40" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mission Roadmap Panel */}
          <div className="col-span-1 md:col-span-7 bg-white/95 p-6 rounded-2xl flex flex-col justify-between border border-slate-200 hover:border-primary/30 transition-all">
            <div>
              <div className="border-b border-slate-100 pb-3 mb-6 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Compass size={18} className="text-primary" />
                  <span>
                    Lộ trình cuộc thi{" "}
                    {activeEvent ? `- ${activeEvent.name}` : ""}
                  </span>
                </h2>
              </div>

              <div className="relative pl-4 space-y-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {/* Phase 1 */}
                <div className="relative pl-6">
                  {phase1.renderDot()}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                    <h3 className={phase1.headingClass}>
                      Giai đoạn 1: Mở đăng ký
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={phase1.dateClass}>
                        {formatEventDateRange(
                          activeEvent?.registrationOpen,
                          activeEvent?.registrationClose ||
                            activeEvent?.contestStart,
                        )}
                      </span>
                      <span className={`text-[9px] ${phase1.classes}`}>
                        {phase1.label}
                      </span>
                    </div>
                  </div>
                  <p className={phase1.descClass}>
                    {activeEvent?.phase1Description ||
                      "Các đội thi thực hiện đăng ký tài khoản, liên kết thành viên nhóm và liên kết repository Github chính thức để chuẩn bị nhận nhiệm vụ."}
                  </p>
                </div>

                {/* Phase 2 */}
                <div className="relative pl-6">
                  {phase2.renderDot()}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                    <h3 className={phase2.headingClass}>
                      Giai đoạn 2: Bắt đầu thi đấu
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={phase2.dateClass}>
                        {formatEventDateRange(
                          activeEvent?.contestStart,
                          activeEvent?.contestEnd,
                        )}
                      </span>
                      <span className={`text-[9px] ${phase2.classes}`}>
                        {phase2.label}
                      </span>
                    </div>
                  </div>
                  <p className={phase2.descClass}>
                    {activeEvent?.phase2Description ||
                      "Giai đoạn lập trình cường độ cao. Các đội thực hiện giải quyết yêu cầu dự án, liên tục push commit để AI tự động phân tích và đánh giá chất lượng mã nguồn."}
                  </p>
                </div>

                {/* Phase 3 */}
                <div className="relative pl-6">
                  {phase3.renderDot()}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                    <h3 className={phase3.headingClass}>
                      Giai đoạn 3: Kết thúc và tổng kết
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={phase3.dateClass}>
                        {formatSingleDate(activeEvent?.contestEnd)}
                      </span>
                      <span className={`text-[9px] ${phase3.classes}`}>
                        {phase3.label}
                      </span>
                    </div>
                  </div>
                  <p className={phase3.descClass}>
                    {activeEvent?.phase3Description ||
                      "Dừng cổng nộp bài, đóng repository. Các đội thi chuẩn bị báo cáo dự án trước hội đồng giám khảo và nhận kết quả xếp hạng chung cuộc từ hệ thống."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Protocols Grid */}
        {(() => {
          const defaultRules = [
            {
              title: "Điều 1. Mục tiêu và sứ mệnh cuộc thi",
              description:
                "Thông qua cuộc thi, các đội xây dựng sản phẩm có khả năng giám sát hệ thống, phát hiện bất thường, dự báo rủi ro, chẩn đoán sự cố và hỗ trợ người dùng đưa ra quyết định trong các lĩnh vực vận hành thông minh.",
            },
            {
              title: "Điều 2. Đối tượng tham gia",
              description:
                "Sinh viên, học viên, hoặc nhóm nghiên cứu trong lĩnh vực CNTT, Khoa học dữ liệu, AI, tự động hóa hoặc các ngành liên quan. Mỗi đội thi gồm từ 3 đến 5 thành viên, có thể đến từ cùng hoặc khác trường/đơn vị. Mỗi cá nhân chỉ được đăng ký tham gia duy nhất một đội.",
            },
            {
              title: "Điều 3. Chủ đề và phạm vi thi đấu",
              description:
                "Các đội phát triển một sản phẩm ứng dụng AI để tiếp nhận, xử lý và phân tích dữ liệu IoT theo thời gian thực trong một lĩnh vực cụ thể. Cuộc thi gồm 03 Track chuyên môn khác nhau, bảo mật chủ đề và bốc thăm trước ngày thi đấu. Sản phẩm phải thể hiện rõ vai trò của AI (phát hiện bất thường, dự báo, chẩn đoán, đề xuất hành động). Sản phẩm chỉ trực quan hóa dữ liệu hoặc cảnh báo bằng điều kiện cố định sẽ không được xem là đáp ứng đầy đủ yêu cầu.",
            },
            {
              title: "Điều 4. Cấu trúc và lịch trình cuộc thi",
              description:
                "Ngày 1: Khai mạc, chọn track, bốc thăm chủ đề và chia bảng thi đấu. Ngày 2: Thi đấu chính thức (07h00 - 15h00) gồm Milestone 1 (nộp Slide ý tưởng trước 10h00), Milestone 2 (Thuyết trình ý tưởng 5-8 phút & Hoàn thiện sản phẩm), Technical Review (chấm sản phẩm trực tiếp tại bàn) và Vòng chung kết (Top 3 đội trình diễn).",
            },
            {
              title: "Điều 5. Quy định thi đấu",
              description:
                "Thời gian thi đấu chính thức: 07h00 – 15h00. Trễ quá 60 phút sẽ bị loại. Lưu trữ mã nguồn trên GitHub/GitLab; tài liệu quản lý trên Jira, Confluence hoặc Notion. Sản phẩm trình bày dưới dạng slide. Các đội được phép tự do sử dụng mô hình AI (XGBoost, LSTM, Transformer, GPT, Gemini, Claude, Llama, Qwen, Mistral...). Vòng bảng thuyết trình 5 phút + Q&A 3 phút. Vòng chung kết thuyết trình 7 phút + Q&A 3 phút.",
            },
            {
              title: "Điều 6. Cơ cấu thi đấu và chia bảng",
              description:
                "Sau khi các đội chọn Track, BTC sẽ chia bảng, mỗi bảng tối đa 6 đội. Mỗi Track có thể gồm nhiều bảng, tùy vào số lượng đội đăng ký thực tế.",
            },
            {
              title: "Điều 7. Vòng chung kết và điều kiện xét chọn",
              description:
                "Ban Tổ Chức lựa chọn tổng cộng 08 đội có thành tích cao nhất vào Chung kết. Mỗi bảng chọn số lượng đội bằng nhau để đảm bảo công bằng. Trường hợp xét chọn bổ sung sẽ dựa trên điểm số trung bình so sánh giữa các bảng và có thể áp dụng penalty evaluation (mini test tối đa 10 phút).",
            },
            {
              title: "Điều 8. Tiêu chí chấm điểm",
              description:
                "Chấm điểm phân loại theo thang điểm. Vòng bảng: Xử lý dữ liệu thực tế (25%), Hiệu quả AI (25%), Kiến trúc & Tích hợp (20%), Phù hợp Domain & UX (15%), Ý tưởng & Pitching (15%). Vòng chung kết: Độ hoàn thiện (25%), Năng lực phân tích AI (25%), Độ tin cậy & An toàn (20%), Sáng tạo (15%), Demo & Phản biện (15%).",
            },
            {
              title: "Điều 9. Quy định về đạo đức và bản quyền",
              description:
                "Nghiêm cấm mọi hành vi gian lận, đạo nhái, vi phạm bản quyền hoặc can thiệp trái phép vào hệ thống thi đấu. Sản phẩm nộp dự thi phải là kết quả làm việc của chính đội thi trong thời gian cuộc thi.",
            },
            {
              title: "Điều 10. Quy định chung và hiệu lực",
              description:
                "Ban Tổ Chức có toàn quyền giải thích và điều chỉnh điều lệ khi cần thiết. Mọi tình huống không quy định sẽ do BTC xem xét quyết định đảm bảo công bằng. Hiệu lực kể từ ngày công bố.",
            },
          ];

          const displayRules =
            activeEvent?.rules?.length > 0 ? activeEvent.rules : defaultRules;

          return (
            <section className="bg-white/95 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-8 text-left">
              <div className="border-b border-slate-100 pb-4 flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
                  <Scale size={24} className="text-primary" />
                  <span className="font-mono-tech tracking-wide">
                    Điều lệ & Quy định cuộc thi
                  </span>
                </h2>
                <a
                  href={`${(() => {
                    let apiBase = import.meta.env.VITE_API_URL;
                    if (!apiBase) {
                      const hostname = window.location.hostname;
                      if (
                        hostname &&
                        hostname !== "localhost" &&
                        hostname !== "127.0.0.1"
                      ) {
                        apiBase = window.location.origin;
                      } else {
                        apiBase = "http://localhost:5000";
                      }
                    }
                    return apiBase;
                  })()}/THÔNG%20TIN%20VỀ%20CUỘC%20THI.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 border border-primary/30 hover:border-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl text-xs font-mono font-bold text-primary hover:text-primary transition-all cursor-pointer shadow-lg shadow-[#F27024]/5 hover:scale-[1.02]"
                >
                  <Download size={14} />
                  <span>TẢI THỂ LỆ PDF</span>
                </a>
              </div>

              {/* Highlights Dashboard Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 text-left">
                {/* Left Highlight (Điều 8: Tiêu chí chấm điểm) - Spans 6 cols on XL */}
                <div className="xl:col-span-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 flex flex-col">
                  <div className="space-y-4 flex-1 flex flex-col">
                    <h3 className="text-xs text-primary font-extrabold uppercase font-mono tracking-widest flex items-center gap-2.5 pb-2 border-b border-slate-200">
                      <Award size={18} className="text-primary" />
                      <span>Tiêu chí chấm điểm</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-sans flex-1">
                      <div className="space-y-3.5 bg-white/60 p-4 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-500 font-extrabold block uppercase border-b border-slate-200 pb-2 font-mono tracking-wider">
                          1. Vòng bảng
                        </span>
                        <div className="space-y-3">
                          {[
                            { label: "Xử lý dữ liệu thực tế", val: "25%" },
                            { label: "Hiệu quả ứng dụng AI", val: "25%" },
                            { label: "Kiến trúc & Tích hợp", val: "20%" },
                            { label: "Phù hợp Domain & UX", val: "15%" },
                            { label: "Ý tưởng & Pitching", val: "15%" },
                          ].map((item, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-700">
                                <span>{item.label}</span>
                                <span className="text-primary font-mono font-bold">
                                  {item.val}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-linear-to-r from-[#F27024]/80 to-[#F27024] rounded-full shadow-[0_0_8px_rgba(242,112,36,0.3)]"
                                  style={{ width: item.val }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3.5 bg-white/60 p-4 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-500 font-extrabold block uppercase border-b border-slate-200 pb-2 font-mono tracking-wider">
                          2. Vòng chung kết
                        </span>
                        <div className="space-y-3">
                          {[
                            { label: "Độ hoàn thiện & Ổn định", val: "25%" },
                            { label: "Năng lực phân tích AI", val: "25%" },
                            { label: "Độ tin cậy & An toàn", val: "20%" },
                            { label: "Sáng tạo & Thực tế", val: "15%" },
                            { label: "Trình bày & Phản biện", val: "15%" },
                          ].map((item, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-700">
                                <span>{item.label}</span>
                                <span className="text-primary font-mono font-bold">
                                  {item.val}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-linear-to-r from-[#F27024]/80 to-[#F27024] rounded-full shadow-[0_0_8px_rgba(242,112,36,0.3)]"
                                  style={{ width: item.val }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Highlight (Quy chế thi đấu cốt lõi) - Spans 6 cols on XL */}
                <div className="xl:col-span-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 flex flex-col">
                  <div className="space-y-4 w-full flex-1 flex flex-col">
                    <h3 className="text-xs text-primary font-extrabold uppercase font-mono tracking-widest flex items-center gap-2.5 pb-2 border-b border-slate-200">
                      <Terminal size={18} className="text-primary" />
                      <span>Quy chế thi đấu cốt lõi</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-2 gap-4 text-sm font-sans flex-1">
                      {[
                        {
                          icon: <Clock className="text-primary" size={16} />,
                          title: "Thời gian thi đấu",
                          desc: "Theo quy định",
                          detail: "Trễ quá 60 phút sẽ bị hủy quyền tham gia.",
                        },
                        {
                          icon: (
                            <GitBranch className="text-primary" size={16} />
                          ),
                          title: "Lưu trữ mã nguồn",
                          desc: "GitHub",
                          detail:
                            "Bắt buộc phải đẩy mã nguồn lên kho lưu trữ chính thức.",
                        },
                        {
                          icon: (
                            <Terminal className="text-primary" size={16} />
                          ),
                          title: "Hồ sơ tài liệu",
                          desc: "Jira, Confluence, Notion",
                          detail:
                            "Quản lý tiến độ dự án qua các công cụ quy định.",
                        },
                        {
                          icon: (
                            <FileText className="text-primary" size={16} />
                          ),
                          title: "Sản phẩm báo cáo",
                          desc: "Thuyết trình Slide",
                          detail:
                            "Trực tiếp chấm tại bàn và không dùng tài liệu giấy.",
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="bg-white/60 p-4 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-primary/20 transition-colors"
                        >
                          <div className="space-y-1.5 text-left">
                            <div className="flex items-center gap-2">
                              <div className="p-1 rounded-sm bg-primary/5 border border-primary/20">
                                {item.icon}
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase font-mono tracking-wider">
                                {item.title}
                              </span>
                            </div>
                            <p className="text-primary font-bold text-xs font-mono">
                              {item.desc}
                            </p>
                          </div>
                          <p className="text-slate-500 text-[11px] mt-1.5 leading-normal font-sans text-left">
                            {item.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-0 xl:h-2" />
                </div>
              </div>

              {/* All Rules Grid (Fully visible, no nested scrolling) */}
              <div className="space-y-5 text-left pt-4">
                <h3 className="text-base text-primary font-extrabold uppercase font-mono tracking-widest flex items-center gap-2.5 pb-2 border-b border-slate-200">
                  <Compass size={18} className="text-primary" />
                  <span>Chi tiết các Điều lệ &amp; Quy định</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {displayRules.map((r: any, idx: number) => {
                    const getRuleIcon = (index: number) => {
                      switch (index) {
                        case 0:
                          return <Target size={18} />;
                        case 1:
                          return <Users size={18} />;
                        case 2:
                          return <Compass size={18} />;
                        case 3:
                          return <Calendar size={18} />;
                        case 4:
                          return <Clock size={18} />;
                        case 5:
                          return <GitBranch size={18} />;
                        case 6:
                          return <Award size={18} />;
                        case 7:
                          return <Scale size={18} />;
                        case 8:
                          return <Shield size={18} />;
                        default:
                          return <FileText size={18} />;
                      }
                    };

                    return (
                      <div
                        key={idx}
                        className="p-6 border border-slate-200 hover:border-primary/30 bg-white/50 hover:bg-white/80 rounded-2xl flex flex-col space-y-3 hover:shadow-[0_0_20px_-5px_rgba(242,112,36,0.15)] transition-all duration-300 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-primary/5 border border-primary/20 text-primary group-hover:scale-110 transition-transform duration-300">
                            {getRuleIcon(idx)}
                          </div>
                          <span className="text-[10px] sm:text-xs font-mono font-bold px-2.5 py-1 bg-primary/5 border border-primary/20 text-primary rounded-full uppercase tracking-wider">
                            Điều {idx + 1}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-sm sm:text-base font-extrabold text-slate-800 group-hover:text-primary transition-colors leading-snug">
                            {r.title.replace(/^Điều\s+\d+\.\s*/i, "")}
                          </h4>
                          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans font-normal space-y-1.5">
                            {(r.description || "")
                              .split(/(?<=\.)\s+/)
                              .filter(
                                (sentence: string) =>
                                  sentence.trim().length > 0,
                              )
                              .map((sentence: string, sIdx: number) => {
                                if (
                                  sentence.includes("Milestone 1") &&
                                  sentence.includes("Milestone 2")
                                ) {
                                  const parts = sentence.split(
                                    /(?:gồm:?\s*|,\s*|\s+và\s+)(?=Milestone \d|Technical Review|Vòng chung kết)/i,
                                  );
                                  const introText =
                                    parts[0].trim().endsWith("gồm") ||
                                    parts[0].trim().endsWith("gồm:")
                                      ? parts[0]
                                      : `${parts[0]} gồm:`;
                                  return (
                                    <div key={sIdx} className="space-y-1.5">
                                      <p className="flex items-start gap-2">
                                        <span className="text-primary font-extrabold select-none shrink-0">
                                          •
                                        </span>
                                        <span>{introText}</span>
                                      </p>
                                      <div className="pl-4 space-y-1.5">
                                        {parts.slice(1).map((part, pIdx) => (
                                          <p
                                            key={pIdx}
                                            className="flex items-start gap-2"
                                          >
                                            <span className="text-primary font-extrabold select-none shrink-0">
                                              •
                                            </span>
                                            <span>{part}</span>
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <p
                                    key={sIdx}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="text-primary font-extrabold select-none shrink-0">
                                      •
                                    </span>
                                    <span>{sentence}</span>
                                  </p>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })()}

        {/* Bottom CTA */}
        <section className="py-4 flex justify-center">
          {hasTeam ? (
            <button
              onClick={() => navigate("/team-area")}
              className="btn-fpt font-bold text-sm px-12 py-4 uppercase tracking-widest flex items-center gap-2 group"
            >
              <span>Tiếp tục vào Khu vực Đội thi</span>
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          ) : (
            <button
              onClick={() => navigate("/team-area")}
              className="btn-fpt font-bold text-sm px-12 py-4 uppercase tracking-widest flex items-center gap-2 group"
            >
              <span>Đăng ký thành lập đội thi</span>
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
