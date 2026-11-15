import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  Clock,
  BookOpen,
  Users,
  MessageSquare,
  Crown,
  Trophy,
  Edit3,
  ExternalLink,
  AlertTriangle,
  Megaphone,
  ArrowRight,
  LifeBuoy,
  Calendar,
  LayoutGrid,
  CircleCheck,
} from "lucide-react";
import RegisterTeam from "./RegisterTeam";
import { useConform } from "../shared/ModalConform";
import GithubUserAutocomplete from "../shared/GithubUserAutocomplete";
import UniversityCombobox from "../shared/UniversityCombobox";

const Github = ({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface SeminarWidgetProps {
  seminar: {
    scheduledAt?: string;
    scheduledEnd?: string;
    meetUrl?: string;
    title?: string;
    description?: string;
    attendanceFormUrl?: string;
  };
}

function SeminarWidget({ seminar }: SeminarWidgetProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!seminar || !seminar.scheduledAt) return null;

  const start = new Date(seminar.scheduledAt);
  const end = seminar.scheduledEnd ? new Date(seminar.scheduledEnd) : null;

  const isUpcoming = now < start;
  const isOngoing = now >= start && (!end || now <= end);
  const isEnded = end ? now > end : false;

  const formatTimeStr = (d: Date) => {
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getCountdownText = () => {
    const diff = start.getTime() - now.getTime();
    if (diff <= 0) return "00:00:00";

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num: number) => num.toString().padStart(2, "0");

    if (days > 0) {
      return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  return (
    <div
      className={`glass p-6 rounded-3xl border transition-all relative overflow-hidden flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 ${isOngoing
        ? "border-cyan-500/40 glow-cyan bg-slate-900/10 shadow-[inset_0_0_20px_rgba(0,240,255,0.02)] animate-pulse"
        : "border-slate-800 hover:border-cyan-500/30"
        }`}
    >
      {isOngoing && (
        <div className="absolute inset-0 pointer-events-none laser-scan-effect opacity-10"></div>
      )}

      {/* Left side: Icon, title, description, time */}
      <div className="flex-1 flex flex-col sm:flex-row items-start gap-4">
        <div
          className={`p-4 rounded-2xl bg-cyan-950/50 border border-cyan-800/30 shrink-0 ${isOngoing ? "animate-pulse" : ""}`}
        >
          <BookOpen size={24} className="text-cyan-400" />
        </div>
        <div className="space-y-2 min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-cyan-400 font-bold border border-cyan-500/30 px-2 py-0.5 rounded-sm bg-cyan-950/20 tracking-widest uppercase">
              Seminar hướng dẫn
            </span>
            {isOngoing ? (
              <span className="flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded-sm bg-emerald-500/15 border border-emerald-500/30 text-emerald-450 uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Đang diễn ra
              </span>
            ) : isUpcoming ? (
              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 uppercase tracking-wider">
                Sắp diễn ra
              </span>
            ) : (
              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-sm bg-slate-950 border border-slate-900 text-slate-650 uppercase tracking-wider">
                Đã kết thúc
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-snug">
              {seminar.title}
            </h3>
            {seminar.description && (
              <p className="text-xs text-slate-400 mt-1 font-sans leading-relaxed">
                {seminar.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-350 font-sans pt-1">
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-slate-500" />
              <strong>Lịch:</strong> {formatTimeStr(start)}{" "}
              {end ? ` - ${formatTimeStr(end)}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Countdown or Action button */}
      <div className="w-full md:w-auto flex flex-col justify-center items-center md:items-end gap-3 shrink-0">
        {isUpcoming && (
          <div className="bg-slate-950/60 border border-slate-900 p-3.5 rounded-2xl flex flex-col items-center justify-center min-w-[200px] text-center shadow-inner">
            <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">
              Thời gian đếm ngược
            </span>
            <div className="text-xl font-bold text-cyan-400 tabular-nums tracking-wide mt-0.5">
              {getCountdownText()}
            </div>
          </div>
        )}

        {isOngoing && seminar.meetUrl && (
          <a
            href={seminar.meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-center cursor-pointer hover:-translate-y-0.5 duration-150 whitespace-nowrap font-sans"
          >
            <BookOpen size={16} />
            Tham gia Google Meet
          </a>
        )}

        {isEnded && (
          <div className="text-xs text-slate-500 italic bg-slate-950/30 px-4 py-2 border border-slate-900 rounded-xl text-center">
            Đã kết thúc
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamArea() {
  const conform = useConform();
  const [searchParams] = useSearchParams();
  const eventIdParam = searchParams.get("eventId");
  const token = localStorage.getItem("token");
  const [data, setData] = useState<any>(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const hasContestStarted = !!(
    data?.team?.eventId?.status === "ongoing" ||
    data?.team?.eventId?.status === "completed" ||
    data?.team?.eventId?.status === "cancelled" ||
    (data?.team?.eventId?.contestStart &&
      new Date(data.team.eventId.contestStart) <= currentTime)
  );

  const [showEditModal, setShowEditModal] = useState(false);
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [editMembers, setEditMembers] = useState<any[]>([]);
  const editMembersRef = useRef<any[]>([]);
  const checkTimers = useRef<{ [key: number]: any }>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmTeamName, setDeleteConfirmTeamName] = useState("");
  const [deletingTeam, setDeletingTeam] = useState(false);

  useEffect(() => {
    editMembersRef.current = editMembers;
  }, [editMembers]);

  const handleCheckEligibility = async (
    index: number,
    emailToCheck?: string,
  ) => {
    const targetEmail =
      emailToCheck !== undefined
        ? emailToCheck
        : editMembersRef.current[index]?.email || "";
    if (!targetEmail.trim()) {
      return;
    }
    const currentEventId = data?.team?.eventId?._id;
    if (!currentEventId) return;

    setEditMembers((prev) => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        checkingStatus: "checking",
        checkingMessage: "",
      };
      return updated;
    });

    try {
      const res = await axios.get(
        `http://localhost:5000/api/teams/check-eligibility?email=${encodeURIComponent(targetEmail.trim())}&eventId=${currentEventId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setEditMembers((prev) => {
        if (!prev[index]) return prev;
        const nextUpdated = [...prev];
        if (nextUpdated[index].email.trim() !== targetEmail.trim()) {
          return prev;
        }

        if (res.data.eligible) {
          nextUpdated[index] = {
            ...nextUpdated[index],
            checkingStatus: "eligible",
            checkingMessage: res.data.message || "Hợp lệ (Chưa có nhóm)",
          };
          const u = res.data.user;
          if (u) {
            if (u.fullName) nextUpdated[index].fullName = u.fullName;
            if (u.studentId) nextUpdated[index].studentId = u.studentId;
            if (u.githubUsername)
              nextUpdated[index].githubUsername = u.githubUsername;
            if (u.university) nextUpdated[index].university = u.university;
            if (u.height !== undefined && u.height !== null)
              nextUpdated[index].height = String(u.height);
            if (u.weight !== undefined && u.weight !== null)
              nextUpdated[index].weight = String(u.weight);
          }
        } else {
          nextUpdated[index] = {
            ...nextUpdated[index],
            checkingStatus: "conflict",
            checkingMessage: res.data.message || "Đã có nhóm!",
          };
        }
        return nextUpdated;
      });
    } catch (err: any) {
      console.error(err);
      setEditMembers((prev) => {
        if (!prev[index]) return prev;
        const nextUpdated = [...prev];
        if (nextUpdated[index].email.trim() !== targetEmail.trim()) {
          return prev;
        }
        nextUpdated[index] = {
          ...nextUpdated[index],
          checkingStatus: "idle",
          checkingMessage: err.response?.data?.message || "Lỗi kiểm tra",
        };
        return nextUpdated;
      });
      toast.error(err.response?.data?.message || "Lỗi khi kiểm tra email.");
    }
  };

  const handleDeleteTeam = async () => {
    const activeTeam = data?.team;
    if (!activeTeam) return;

    if (hasContestStarted) {
      toast.error("Cuộc thi đã bắt đầu, không thể xóa thông tin đội thi!");
      return;
    }

    if (deleteConfirmTeamName.trim() !== activeTeam.name) {
      toast.error("Tên nhóm xác nhận không chính xác.");
      return;
    }
    setDeletingTeam(true);
    try {
      await axios.delete(`http://localhost:5000/api/teams/${activeTeam._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Đã xóa đội thi thành công.");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Không thể xóa đội thi.");
    } finally {
      setDeletingTeam(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleOpenEditModal = () => {
    if (hasContestStarted) {
      toast.error(
        "Cuộc thi đã bắt đầu, không thể chỉnh sửa thông tin đội thi!",
      );
      return;
    }
    if (data?.members) {
      setEditMembers(
        data.members.map((m: any) => ({
          userId: m.userId?._id,
          email: m.userId?.email,
          role: m.role,
          fullName: m.userId?.fullName || "",
          githubUsername: m.userId?.githubUsername || "",
          studentId: m.userId?.studentId || "",
          university: m.userId?.university || "",
          height: m.userId?.height !== undefined && m.userId?.height !== null ? String(m.userId?.height) : "",
          weight: m.userId?.weight !== undefined && m.userId?.weight !== null ? String(m.userId?.weight) : "",
        })),
      );
    }
    setShowEditModal(true);
  };

  const track = data?.team?.trackId;
  const round = track?.roundId;
  const isExamVisible =
    hasContestStarted &&
    !!(
      round?.startTime ||
      round?.isExamManualOpen ||
      round?.status === "active" ||
      track?.examAccess?.examOpened
    );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getRemainingTimeText = (startTimeStr: string) => {
    const diff = new Date(startTimeStr).getTime() - currentTime.getTime();
    if (diff <= 0) return "00:00:00";

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num: number) => num.toString().padStart(2, "0");

    if (days > 0) {
      return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const getRoundCountdown = () => {
    const startVal = track?.startTime || round?.startTime;
    const endVal = track?.endTime || round?.endTime;

    if (!startVal || !endVal) {
      return null;
    }

    const start = new Date(startVal);
    const end = new Date(endVal);

    if (currentTime < start) {
      const diffMs = start.getTime() - currentTime.getTime();
      const seconds = Math.floor((diffMs / 1000) % 60);
      const minutes = Math.floor((diffMs / 1000 / 60) % 60);
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const pad = (num: number) => num.toString().padStart(2, "0");
      const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      const text =
        days > 0
          ? `Bắt đầu sau: ${days} ngày ${timeStr}`
          : `Bắt đầu sau: ${timeStr}`;

      return {
        text,
        color: "text-amber-400 font-bold",
      };
    } else if (currentTime >= start && currentTime <= end) {
      const diffMs = end.getTime() - currentTime.getTime();
      const seconds = Math.floor((diffMs / 1000) % 60);
      const minutes = Math.floor((diffMs / 1000 / 60) % 60);
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const pad = (num: number) => num.toString().padStart(2, "0");
      const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      const text =
        days > 0 ? `Còn lại: ${days} ngày ${timeStr}` : `Còn lại: ${timeStr}`;

      return {
        text,
        color: "text-emerald-500 font-bold",
      };
    } else {
      return {
        text: "Đã kết thúc thời gian làm bài",
        color: "text-slate-400 font-medium",
      };
    }
  };

  const getTeamStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "Đã xác nhận";
      case "pending_confirm":
        return "Đang chờ duyệt";
      default:
        return status || "";
    }
  };

  // Git commits & AI report
  const [commits, setCommits] = useState<any[]>([]);

  // Status indicators
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState("");
  const setError = (msg: string) => {
    _setError(msg);
    if (msg) toast.error(msg);
  };

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError("");
      const url = eventIdParam
        ? `http://localhost:5000/api/teams/my-team?eventId=${eventIdParam}`
        : "http://localhost:5000/api/teams/my-team";
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const team = res.data?.team;
      console.log("DEBUG [TeamArea]: team =", team);
      const isEventEnded =
        team &&
        (team.eventId?.status === "completed" ||
          team.eventId?.status === "cancelled" ||
          (team.eventId?.contestEnd &&
            new Date(team.eventId.contestEnd) <= new Date()));
      console.log(
        "DEBUG [TeamArea]: isEventEnded =",
        isEventEnded,
        "contestEnd =",
        team?.eventId?.contestEnd,
        "status =",
        team?.eventId?.status,
      );
      if (isEventEnded) {
        setData({ team: null });
      } else {
        setData(res.data);

        // Fetch commits if repo exists
        if (res.data.repository) {
          fetchCommits(res.data.team._id);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 404) {
        setData({ team: null });
      } else {
        setError(err.response?.data?.message || "Lỗi tải thông tin đội thi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCommits = async (teamId: string) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/analytics/team/${teamId}/commits`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setCommits(res.data);
    } catch (err: any) {
      console.error("Error fetching commits:", err);
    }
  };

  const handleSaveBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.team?._id) return;

    if (hasContestStarted) {
      toast.error(
        "Cuộc thi đã bắt đầu, không thể chỉnh sửa thông tin đội thi!",
      );
      return;
    }

    // Validate members
    for (let i = 0; i < editMembers.length; i++) {
      const m = editMembers[i];
      if (m.isNew && !m.email.trim()) {
        toast.error(`Thành viên thứ ${i + 1}: Email là bắt buộc.`);
        return;
      }
      if (!m.fullName.trim() || !m.githubUsername.trim() || !m.height || !m.weight) {
        toast.error(
          `Thành viên thứ ${i + 1}: Họ tên, GitHub Username, chiều cao và cân nặng là bắt buộc.`,
        );
        return;
      }
      if (isNaN(Number(m.height)) || isNaN(Number(m.weight))) {
        toast.error(
          `Thành viên thứ ${i + 1}: Chiều cao và cân nặng phải là số hợp lệ.`,
        );
        return;
      }
    }

    setSavingBasicInfo(true);
    try {
      const res = await axios.put(
        `http://localhost:5000/api/teams/${data.team._id}/basic-info`,
        {
          members: editMembers.map((m) => ({
            userId:
              m.userId && typeof m.userId === "object"
                ? m.userId._id || m.userId
                : m.userId,
            fullName: m.fullName,
            githubUsername: m.githubUsername,
            studentId: m.studentId || "",
            university: m.university || "",
            height: Number(m.height),
            weight: Number(m.weight),
            isNew: m.isNew,
            email: m.email,
          })),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(res.data.message || "Cập nhật thông tin thành công!");
      setShowEditModal(false);
      await fetchTeamData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật thông tin.");
    } finally {
      setSavingBasicInfo(false);
    }
  };

  const handleDeleteMemberParticipant = async (userId: string, name: string) => {
    if (!data?.team?._id) return;
    const conformed = await conform({
      title: "Xóa thành viên",
      message: `Bạn có chắc chắn muốn xóa thành viên "${name}" khỏi đội thi không?`,
      variant: "danger",
    });
    if (!conformed) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.delete(
        `${apiBase}/api/teams/${data.team._id}/members/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || "Đã xóa thành viên thành công!");
      if (res.data.autoApproved) {
        toast.info("Đội thi đã được tự động duyệt do tất cả thành viên còn lại đều đã xác nhận!");
      }
      setShowEditModal(false);
      await fetchTeamData();
    } catch (err: any) {
      console.error("Leader delete member error:", err);
      toast.error(err.response?.data?.message || "Lỗi khi xóa thành viên.");
    }
  };

  const handleTransferLeaderParticipant = async (userId: string, name: string) => {
    if (!data?.team?._id) return;
    const conformed = await conform({
      title: "Chuyển vai trò Trưởng nhóm",
      message: `Bạn có chắc chắn muốn bổ nhiệm "${name}" làm Trưởng nhóm mới không? Bạn sẽ chuyển thành thành viên bình thường.`,
      variant: "warning",
    });
    if (!conformed) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.put(
        `${apiBase}/api/teams/${data.team._id}/members/${userId}/transfer-leader`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || "Đã chuyển vai trò Trưởng nhóm thành công!");
      if (res.data.autoApproved) {
        toast.info("Đội thi đã được tự động duyệt do tất cả thành viên còn lại đều đã xác nhận!");
      }
      setShowEditModal(false);
      await fetchTeamData();
    } catch (err: any) {
      console.error("Leader transfer leader error:", err);
      toast.error(err.response?.data?.message || "Lỗi khi chuyển vai trò Trưởng nhóm.");
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  if (loading) {
    return (
      <div className="team-area-light relative overflow-hidden font-sans bg-slate-50 text-slate-900 min-h-screen flex items-center justify-center">
        {/* Background Grid & Glow */}
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>
        <p className="relative z-10 text-slate-500 text-lg animate-pulse">
          Đang tải thông tin đội thi...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="team-area-light relative overflow-hidden font-sans bg-slate-50 text-slate-900 min-h-screen flex items-center justify-center">
        {/* Background Grid & Glow */}
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>
        <div className="relative z-10 glass p-8 rounded-3xl border border-rose-500/20 max-w-md mx-auto text-center">
          <p className="text-rose-500 font-semibold mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-[#e05e1b] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            Tải lại
          </button>
        </div>
      </div>
    );
  }

  const { team, members, repository, isLeader } = data || {};

  const isEventEnded =
    team &&
    (team.eventId?.status === "completed" ||
      team.eventId?.status === "cancelled" ||
      (team.eventId?.contestEnd &&
        new Date(team.eventId.contestEnd) <= new Date()));

  if (!team || isEventEnded) {
    return <RegisterTeam />;
  }

  const isConfirmedTeam = team?.status?.toLowerCase() === "confirmed";
  const isRegistrationPhase =
    !hasContestStarted ||
    team?.eventId?.status === "registration" ||
    team?.eventId?.status === "upcoming";
  const roundCountdown = getRoundCountdown();
  const contestStartAt = team?.eventId?.contestStart;

  const phase: {
    label: string;
    value: string;
    timerLabel?: string;
    timerValue?: string;
  } | null = isRegistrationPhase
    ? {
        label: "Trạng thái giải đấu",
        value: "Đang mở đăng ký",
        ...(contestStartAt && {
          timerLabel: "Cuộc thi bắt đầu sau",
          timerValue:
            new Date(contestStartAt) > currentTime
              ? getRemainingTimeText(contestStartAt)
              : "Sắp diễn ra",
        }),
      }
    : team?.currentEventRound
      ? {
          label: "Vòng thi hiện tại",
          value: team.currentEventRound,
          ...(roundCountdown && {
            timerLabel: "Thời gian làm bài",
            timerValue: roundCountdown.text,
          }),
        }
      : null;

  const showMentorChat = team?.eventId?.status === "ongoing" && !team?.isEliminated;
  const showZalo = !!team?.eventId?.zaloUrl;
  const hasSupport = showMentorChat || showZalo;
  const hasSidebar = isExamVisible || hasSupport;

  const initialOf = (name?: string) =>
    (name || "").trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || "?";

  const renderMembersCard = (wide: boolean) => (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Users size={20} className="text-primary" />
          Thành viên
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
            {members?.length || 0}
          </span>
        </h2>
        {isLeader && !hasContestStarted && (
          <button
            type="button"
            onClick={handleOpenEditModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/25 px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-secondary-soft cursor-pointer"
          >
            <Edit3 size={14} />
            Sửa thông tin
          </button>
        )}
      </header>

      {!hasContestStarted && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Kiểm tra kỹ thông tin đội và thành viên trước khi cuộc thi chính
            thức bắt đầu.
          </span>
        </div>
      )}

      <ul
        className={
          wide
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            : "max-h-[420px] space-y-2.5 overflow-y-auto pr-1"
        }
      >
        {members?.map((m: any) => {
          const isLeaderRow = m.role === "leader";
          const isConfirmed = m.confirmStatus === "confirmed";
          return (
            <li
              key={m._id}
              className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-3"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isLeaderRow ? "bg-primary text-white!" : "bg-secondary-soft text-secondary"
                }`}
              >
                {initialOf(m.userId?.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold text-ink">
                    {m.userId?.fullName}
                  </p>
                  {isLeaderRow && (
                    <Crown size={14} className="shrink-0 fill-amber-400/30 text-amber-500" />
                  )}
                </div>
                <p className="truncate text-xs text-ink-muted">{m.userId?.email}</p>
                {(m.userId?.studentId || m.userId?.university) && (
                  <p className="truncate text-xs text-ink-muted">
                    {m.userId?.studentId}
                    {m.userId?.studentId && m.userId?.university && " · "}
                    {m.userId?.university}
                  </p>
                )}
              </div>
              {isConfirmed ? (
                isLeaderRow ? (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    Trưởng nhóm
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <CircleCheck size={12} />
                    Đã xác nhận
                  </span>
                )
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  <Clock size={12} />
                  Chờ duyệt
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  const renderSupportCard = () =>
    hasSupport && (
      <section className="space-y-3 rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <LifeBuoy size={20} className="text-primary" />
          Hỗ trợ
        </h2>
        {showMentorChat && (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("open_chat_room", { detail: { teamId: team._id } }),
              )
            }
            className="group flex w-full items-center gap-3 rounded-xl border border-line bg-canvas p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary-soft/50 cursor-pointer"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <MessageSquare size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Nhắn tin Mentor</p>
              <p className="text-xs text-ink-muted">Hỏi đáp trực tiếp với Mentor hướng dẫn.</p>
            </div>
            <ArrowRight size={16} className="shrink-0 text-ink-muted transition-colors group-hover:text-primary" />
          </button>
        )}
        {showZalo && (
          <a
            href={team.eventId.zaloUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex w-full items-center gap-3 rounded-xl border border-line bg-canvas p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/60"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <MessageSquare size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Nhóm Zalo đội thi</p>
              <p className="text-xs text-ink-muted">Hỗ trợ kỹ thuật và thông báo khẩn từ BTC.</p>
            </div>
            <ExternalLink size={16} className="shrink-0 text-ink-muted transition-colors group-hover:text-blue-600" />
          </a>
        )}
      </section>
    );

  const renderExamCountdown = (title: string, openAt: string) => (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <p className="text-sm font-medium text-amber-700">{title}</p>
      <div className="rounded-xl bg-primary-soft px-6 py-3.5 text-3xl font-bold tracking-wide text-primary tabular-nums">
        {getRemainingTimeText(openAt)}
      </div>
      <p className="text-xs text-ink-muted">
        Thời gian mở đề: {new Date(openAt).toLocaleString("vi-VN")}
      </p>
    </div>
  );

  const renderExamCard = () => (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <BookOpen size={20} className="text-primary" />
          Đề bài &amp; tài liệu thi
        </h2>
        {round && (
          <span className="rounded-full bg-secondary-soft px-2.5 py-1 text-xs font-semibold text-secondary">
            Vòng {round.name}
          </span>
        )}
      </header>

      {team?.eventId?.contestStart &&
      new Date(team.eventId.contestStart) > currentTime &&
      !hasContestStarted ? (
        renderExamCountdown(
          `Đề bài cuộc thi "${team.eventId.name}" sẽ được mở sau`,
          team.eventId.contestStart,
        )
      ) : round?.startTime &&
        new Date(round.startTime) > currentTime &&
        !round?.isExamManualOpen &&
        round?.status !== "active" &&
        !team?.trackId?.examAccess?.examOpened ? (
        renderExamCountdown(`Đề bài vòng "${round.name}" sẽ được mở sau`, round.startTime)
      ) : team?.trackId?.examAccess?.examOpened ? (
        (() => {
          const effectiveTrackName =
            team.trackId.originalTrackName || team.trackId.name || "";
          return (
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Đề đã mở khóa · Bảng {effectiveTrackName}
              </span>
              <h3
                className="text-xl font-bold leading-snug text-ink"
                title={team.trackId.examAccess.examDriveFileName || `Đề bảng ${effectiveTrackName}`}
              >
                {team.trackId.examAccess.examDriveFileName ||
                  `Đề thi & tài liệu hướng dẫn — Bảng ${effectiveTrackName}`}
              </h3>
              <p className="text-sm leading-relaxed text-ink-muted">
                Tài liệu đề bài, sơ đồ kiến trúc hệ thống và dữ liệu mẫu nằm trong
                thư mục Google Drive riêng của bảng {effectiveTrackName}. Tải về để
                bắt đầu nghiên cứu và thiết lập môi trường làm bài.
              </p>
              <a
                href={team.trackId.examAccess.examDriveFileUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white! shadow-sm transition-colors hover:bg-primary-hover"
              >
                <BookOpen size={16} />
                Mở đề thi
                <ExternalLink size={14} />
              </a>
            </div>
          );
        })()
      ) : team?.trackId?.examAccess?.hasExamMaterial ? (
        <div className="py-6 text-center">
          <Clock size={32} className="mx-auto mb-2 text-amber-500" />
          <p className="font-semibold text-ink">Đề thi đang được chuẩn bị</p>
          <p className="mt-1 text-sm text-ink-muted">
            Đề đã được gắn nhưng chưa đến giờ mở khóa hoặc chưa cấu hình thời gian mở đề.
          </p>
        </div>
      ) : (
        <div className="py-6 text-center">
          <BookOpen size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-ink-muted">
            Hiện chưa có đề bài hoặc tài liệu thi được phân phối cho vòng này.
          </p>
        </div>
      )}
    </section>
  );

  const renderGithubCard = () =>
    repository ? (
      <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white!">
              <Github size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-ink-muted">GitHub repository</p>
              <p className="truncate font-semibold text-ink">
                {repository.orgName
                  ? `${repository.orgName}/${repository.repoName}`
                  : repository.repoName}
              </p>
            </div>
          </div>
          {repository.repoUrl && (
            <a
              href={repository.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-secondary/25 px-4 py-2 text-sm font-semibold text-secondary transition-colors hover:bg-secondary-soft"
            >
              Mở repo
              <ExternalLink size={14} />
            </a>
          )}
        </header>

        <div className="pt-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            Commit gần đây
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {commits.length}
            </span>
          </h3>
          {commits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-ink-muted">
              Chưa có commit nào. Commit được đồng bộ mỗi{" "}
              {team?.eventId?.commitSyncInterval || 30} phút.
            </p>
          ) : (
            <ul className="max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
              {commits.map((c: any) => (
                <li
                  key={c._id}
                  className="rounded-xl border border-line bg-canvas p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 wrap-break-word font-semibold leading-snug text-ink">
                      {c.message}
                    </p>
                    <code className="shrink-0 rounded-md bg-white px-2 py-0.5 font-mono text-xs text-secondary ring-1 ring-line">
                      {c.commitSha.substring(0, 7)}
                    </code>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span>
                      <span className="font-medium text-ink">{c.authorName}</span> @{c.authorGithubUsername}
                    </span>
                    <span>{new Date(c.committedAt).toLocaleString("vi-VN")}</span>
                    <span className="font-medium text-emerald-600">+{c.additions}</span>
                    <span className="font-medium text-rose-600">−{c.deletions}</span>
                    <span>{c.changedFilesCount} tệp</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    ) : (
      <section className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <Github size={44} className="mb-3 text-slate-300" />
        <p className="text-lg font-semibold text-ink">Chưa thiết lập GitHub repository</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Repository sẽ được tự động tạo và phân quyền sau khi tất cả thành viên
          xác nhận tham gia qua email.
        </p>
      </section>
    );

  return (
    <div className="team-area-light relative min-h-screen overflow-hidden bg-canvas text-ink">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(1,67,145,0.05)_0%,transparent_40%)]"></div>

      <div className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        {/* Team banner */}
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-secondary to-secondary-hover p-6 text-white! shadow-lg shadow-secondary/20 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl font-bold ring-1 ring-white/30 sm:h-20 sm:w-20 sm:text-4xl">
                {(team?.name || "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 space-y-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                    isConfirmedTeam
                      ? "bg-emerald-400/20 text-emerald-100 ring-emerald-300/40"
                      : "bg-amber-400/20 text-amber-100 ring-amber-300/40"
                  }`}
                >
                  {isConfirmedTeam ? <CircleCheck size={12} /> : <Clock size={12} />}
                  {getTeamStatusText(team?.status)}
                </span>
                <h1 className="truncate text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {team?.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/80">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy size={14} />
                    {team?.eventId?.name || "---"}
                  </span>
                  {team?.eventId?.semester && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} />
                      {team.eventId.semester} {team.eventId.year}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutGrid size={14} />
                    {team?.trackId?.name ? `Bảng ${team.trackId.name}` : "Chờ phân bảng"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={14} />
                    {members?.length || 0} thành viên
                  </span>
                </div>
              </div>
            </div>

            {phase && (
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-sm lg:min-w-72">
                <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                  {phase.label}
                </p>
                <p className="mt-1 text-xl font-bold">{phase.value}</p>
                {phase.timerLabel && (
                  <div className="mt-3 flex items-center gap-2.5 border-t border-white/15 pt-3">
                    <Clock size={18} className="shrink-0 text-primary" />
                    <div>
                      <p className="text-xs text-white/70">{phase.timerLabel}</p>
                      <p className="font-semibold tabular-nums">{phase.timerValue}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Announcement from organisers */}
        {team?.eventId?.locationAnnouncement &&
          team.eventId.locationAnnouncement.trim().length > 0 && (
            <div className="flex items-start gap-4 rounded-2xl border border-primary/30 bg-primary-soft p-5 sm:p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white!">
                <Megaphone size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Thông báo từ BTC
                </p>
                {team.eventId.locationAnnouncementTitle?.trim() && (
                  <h3 className="mt-0.5 text-lg font-bold leading-snug text-ink wrap-break-word">
                    {team.eventId.locationAnnouncementTitle.trim()}
                  </h3>
                )}
                <div className="mt-2 whitespace-pre-line wrap-break-word text-sm leading-relaxed text-ink">
                  {team.eventId.locationAnnouncement}
                </div>
              </div>
            </div>
          )}

        {/* Seminar Widget */}
        {team?.eventId?.seminar?.scheduledAt &&
          !isExamVisible &&
          team?.eventId?.status !== "ongoing" &&
          team?.eventId?.status !== "completed" &&
          !team?.isEliminated && <SeminarWidget seminar={team.eventId.seminar} />}

        {/* Main content + sidebar */}
        {team && !team.isEliminated && (
          <div className={`grid items-start gap-6 ${hasSidebar ? "lg:grid-cols-12" : ""}`}>
            <div className={`space-y-6 ${hasSidebar ? "lg:col-span-8" : ""}`}>
              {isExamVisible ? (
                <>
                  {renderExamCard()}
                  {renderGithubCard()}
                </>
              ) : (
                renderMembersCard(!hasSidebar)
              )}
            </div>
            {hasSidebar && (
              <aside className="space-y-6 lg:sticky lg:top-24 lg:col-span-4">
                {isExamVisible && renderMembersCard(false)}
                {renderSupportCard()}
              </aside>
            )}
          </div>
        )}

        {team?.isEliminated && (
          <section className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Trophy size={28} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-ink">Kết quả đạt được</h2>
              <p className="text-sm text-ink-muted">
                Thành tích chính thức của đội{" "}
                <strong className="text-ink">{team.name}</strong> tại cuộc thi.
              </p>
            </div>

            <div className="mx-auto grid max-w-md grid-cols-2 gap-4">
              <div className="space-y-1 rounded-2xl border border-line bg-canvas p-4">
                <span className="block text-xs font-medium text-ink-muted">Thứ hạng (bảng)</span>
                <p className="text-2xl font-bold text-primary tabular-nums">
                  {team.achievedResult?.rank ? `Top ${team.achievedResult.rank}` : "---"}
                </p>
              </div>
              <div className="space-y-1 rounded-2xl border border-line bg-canvas p-4">
                <span className="block text-xs font-medium text-ink-muted">Điểm trung bình</span>
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">
                  {team.achievedResult?.score ? `${team.achievedResult.score.toFixed(2)}` : "---"}
                </p>
              </div>
            </div>

            {team.achievedResult && (
              <p className="mx-auto max-w-sm border-t border-line pt-3 text-xs text-ink-muted">
                Ghi nhận tại: {team.achievedResult.roundName} ({team.achievedResult.trackName})
              </p>
            )}

            <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-muted">
              Cảm ơn bạn đã cống hiến hết mình tại giải đấu năm nay! Chúc đội{" "}
              <strong className="text-ink">{team.name}</strong> gặt hái nhiều thành
              công hơn nữa trên con đường phát triển công nghệ.
            </p>
          </section>
        )}

        {/* Edit Basic Info Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-fade-in animate-duration-150">
            <div className="glass max-w-2xl w-full rounded-3xl border border-slate-800 p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl">
              <form
                onSubmit={handleSaveBasicInfo}
                className="space-y-4 font-sans text-xs"
              >
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {editMembers.map((member, index) => (
                    <div
                      key={member.userId || `new-${index}`}
                      className="border border-slate-850 p-4 rounded-xl bg-slate-900/10 space-y-3 relative text-left"
                    >
                      <div className="absolute top-3 right-4 flex items-center gap-2">
                        {member.role === "leader" ? (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-sm text-[8px] font-extrabold uppercase font-mono tracking-wider">
                            Trưởng nhóm
                          </span>
                        ) : (
                          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-sm text-[8px] font-extrabold uppercase font-mono tracking-wider">
                            Thành viên
                          </span>
                        )}
                        {member.isNew && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editMembers.filter(
                                (_, idx) => idx !== index,
                              );
                              setEditMembers(updated);
                            }}
                            className="text-rose-500 hover:text-rose-400 text-[8px] font-bold cursor-pointer font-mono border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 rounded-sm"
                          >
                            XÓA
                          </button>
                        )}
                        {isLeader && !member.isNew && member.role !== "leader" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTransferLeaderParticipant(member.userId, member.fullName)}
                              className="text-amber-500 hover:text-amber-400 text-[8px] font-bold cursor-pointer font-mono border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded-sm"
                              title="Chuyển vai trò Trưởng nhóm"
                            >
                              CHUYỂN TRƯỞNG NHÓM
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMemberParticipant(member.userId, member.fullName)}
                              className="text-rose-500 hover:text-rose-400 text-[8px] font-bold cursor-pointer font-mono border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 rounded-sm"
                              title="Xóa thành viên khỏi đội"
                            >
                              XÓA
                            </button>
                          </>
                        )}
                      </div>

                      <div className="text-[10px] font-bold text-slate-350 font-mono flex items-center gap-1.5 border-b border-slate-850 pb-2 mb-2 uppercase">
                        <span className="text-cyan-400">{`[THÀNH VIÊN #${index + 1}]`}</span>
                        {!member.isNew && (
                          <span className="text-slate-500">{member.email}</span>
                        )}
                        {member.isNew && (
                          <span className="text-emerald-400 font-extrabold">
                            [MỚI]
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Email (Only for new members) */}
                        {member.isNew && (
                          <div className="space-y-1 md:col-span-2">
                            <label className="block text-slate-450 font-semibold uppercase tracking-wider text-[9px]">
                              Địa Chỉ Email{" "}
                              <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="email"
                                required
                                placeholder="Nhập email thành viên"
                                value={member.email}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditMembers((prev) => {
                                    if (!prev[index]) return prev;
                                    const updated = [...prev];
                                    updated[index] = {
                                      ...updated[index],
                                      email: val,
                                      checkingStatus: "idle",
                                      checkingMessage: "",
                                    };
                                    return updated;
                                  });

                                  if (checkTimers.current[index]) {
                                    clearTimeout(checkTimers.current[index]);
                                  }

                                  const trimmed = val.trim();
                                  if (!trimmed) return;

                                  checkTimers.current[index] = setTimeout(
                                    () => {
                                      const currentEmail =
                                        editMembersRef.current[index]?.email ||
                                        "";
                                      if (currentEmail.trim() === trimmed) {
                                        const emailRegex =
                                          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                        if (emailRegex.test(trimmed)) {
                                          handleCheckEligibility(
                                            index,
                                            trimmed,
                                          );
                                        }
                                      }
                                    },
                                    800,
                                  );
                                }}
                                onBlur={() => {
                                  const trimmed = member.email.trim();
                                  if (!trimmed) return;

                                  if (checkTimers.current[index]) {
                                    clearTimeout(checkTimers.current[index]);
                                  }

                                  if (
                                    member.checkingStatus === "idle" ||
                                    !member.checkingStatus
                                  ) {
                                    const emailRegex =
                                      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                    if (emailRegex.test(trimmed)) {
                                      handleCheckEligibility(index, trimmed);
                                    }
                                  }
                                }}
                                className="w-full bg-slate-955 border border-slate-800 text-slate-200 pl-3.5 pr-20 py-2.5 rounded-xl focus:outline-hidden focus:border-cyan-500/50 transition-all font-mono"
                              />
                              {member.checkingStatus === "checking" && (
                                <span className="absolute right-3.5 text-[10px] text-cyan-400 font-mono animate-pulse select-none">
                                  Đang check...
                                </span>
                              )}
                            </div>
                            {member.checkingMessage && (
                              <p
                                className={`text-[9px] font-mono italic mt-1 ${member.checkingStatus === "eligible"
                                  ? "text-emerald-400"
                                  : member.checkingStatus === "conflict"
                                    ? "text-rose-400"
                                    : "text-slate-400"
                                  }`}
                              >
                                {member.checkingMessage}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Full Name */}
                        <div className="space-y-1">
                          <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                            Họ Tên <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={member.fullName}
                            onChange={(e) => {
                              const updated = [...editMembers];
                              updated[index].fullName = e.target.value;
                              setEditMembers(updated);
                            }}
                            className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-cyan-500/50 transition-all font-mono"
                          />
                        </div>

                        {/* GitHub Username */}
                        <div className="space-y-1">
                          <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                            GitHub Username{" "}
                            <span className="text-rose-500">*</span>
                          </label>
                          <GithubUserAutocomplete
                            value={member.githubUsername}
                            onChange={(val) => {
                              const updated = [...editMembers];
                              updated[index].githubUsername = val;
                              setEditMembers(updated);
                            }}
                            placeholder="nhập github-username"
                            className="bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-cyan-500/50 transition-all font-mono"
                          />
                        </div>

                        {/* Student ID */}
                        <div className="space-y-1">
                          <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                            MSSV (Mã số sinh viên)
                          </label>
                          <input
                            type="text"
                            value={member.studentId}
                            onChange={(e) => {
                              const updated = [...editMembers];
                              updated[index].studentId = e.target.value;
                              setEditMembers(updated);
                            }}
                            className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-cyan-500/50 transition-all font-mono"
                          />
                        </div>

                        {/* University */}
                        <div className="space-y-1">
                          <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                            Trường Đại Học
                          </label>
                          <UniversityCombobox
                            value={member.university}
                            onChange={(val) => {
                              const updated = [...editMembers];
                              updated[index].university = val;
                              setEditMembers(updated);
                            }}
                            placeholder="Nhập hoặc chọn trường..."
                            className="w-full"
                            inputClassName="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-cyan-500/50 transition-all font-mono"
                          />
                        </div>

                        {/* Height */}
                        <div className="space-y-1">
                          <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                            Chiều cao (cm) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            value={member.height || ""}
                            onChange={(e) => {
                              const updated = [...editMembers];
                              updated[index].height = e.target.value;
                              setEditMembers(updated);
                            }}
                            placeholder="Ví dụ: 170"
                            className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-cyan-500/50 transition-all font-mono"
                          />
                        </div>

                        {/* Weight */}
                        <div className="space-y-1">
                          <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                            Cân nặng (kg) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            value={member.weight || ""}
                            onChange={(e) => {
                              const updated = [...editMembers];
                              updated[index].weight = e.target.value;
                              setEditMembers(updated);
                            }}
                            placeholder="Ví dụ: 60"
                            className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-cyan-500/50 transition-all font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add member button */}
                  {editMembers.length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditMembers([
                          ...editMembers,
                          {
                            isNew: true,
                            email: "",
                            fullName: "",
                            githubUsername: "",
                            studentId: "",
                            university: "",
                            height: "",
                            weight: "",
                          },
                        ]);
                      }}
                      className="w-full py-3 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl text-slate-400 hover:text-cyan-400 text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase"
                    >
                      + Thêm thành viên mới
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                  <div>
                    {isLeader && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditModal(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 hover:border-rose-500/40 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer font-sans"
                      >
                        Xóa đội thi
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="btn-cancel px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer font-sans"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingBasicInfo}
                      className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg shadow-cyan-600/25 cursor-pointer font-sans"
                    >
                      {savingBasicInfo ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-fade-in animate-duration-150">
            <div className="bg-slate-900 max-w-md w-full rounded-3xl border border-rose-500/20 p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl">
              <div className="space-y-2 text-left font-sans">
                <h3 className="text-lg font-black text-rose-400 uppercase tracking-wider font-mono-tech">
                  XÁC NHẬN XÓA ĐỘI THI
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Hành động này sẽ xóa vĩnh viễn đội thi{" "}
                  <strong className="text-slate-200">{team?.name}</strong> cùng
                  toàn bộ danh sách thành viên và tài nguyên liên quan. Hành
                  động này{" "}
                  <strong className="text-rose-400 uppercase">
                    không thể khôi phục
                  </strong>
                  .
                </p>
              </div>

              <div className="space-y-2.5 text-left font-sans">
                <label className="block text-[10px] text-slate-450 font-semibold uppercase tracking-wider">
                  Vui lòng nhập tên đội thi để xác nhận:
                </label>
                <input
                  type="text"
                  value={deleteConfirmTeamName}
                  onChange={(e) => setDeleteConfirmTeamName(e.target.value)}
                  placeholder={team?.name}
                  className={`w-full bg-slate-955 border px-3.5 py-2.5 rounded-xl focus:outline-hidden transition-all font-mono text-xs ${deleteConfirmTeamName &&
                    deleteConfirmTeamName.trim().toLowerCase() !==
                    team?.name?.toLowerCase()
                    ? "border-rose-500/40 text-rose-400 focus:border-rose-500/70"
                    : "border-slate-800 text-slate-200 focus:border-cyan-500/50"
                    }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmTeamName("");
                  }}
                  className="btn-cancel px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer font-sans"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={
                    deleteConfirmTeamName.trim().toLowerCase() !==
                    team?.name?.toLowerCase() || deletingTeam
                  }
                  onClick={handleDeleteTeam}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent disabled:shadow-none disabled:cursor-not-allowed text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg shadow-rose-600/25 cursor-pointer font-sans"
                >
                  {deletingTeam ? "Đang xóa..." : "Xóa vĩnh viễn"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
