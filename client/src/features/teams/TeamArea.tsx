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
            <span className="text-[10px] text-cyan-400 font-bold border border-cyan-500/30 px-2 py-0.5 rounded bg-cyan-950/20 tracking-widest uppercase">
              [SEMINAR_HƯỚNG_DẪN]
            </span>
            {isOngoing ? (
              <span className="flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-450 uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Đang diễn ra
              </span>
            ) : isUpcoming ? (
              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 uppercase tracking-wider">
                Sắp diễn ra
              </span>
            ) : (
              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-slate-950 border border-slate-900 text-slate-650 uppercase tracking-wider">
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
            <div className="text-xl font-black text-cyan-400 font-mono tracking-widest text-cyan-glow mt-0.5">
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
        return "ĐÃ XÁC NHẬN";
      case "pending_confirm":
        return "ĐANG CHỜ DUYỆT";
      default:
        return status?.toUpperCase() || "";
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
      <div className="team-area-light relative overflow-hidden font-sans bg-slate-50 text-slate-900 min-h-screen flex items-center justify-center font-mono">
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
      <div className="team-area-light relative overflow-hidden font-sans bg-slate-50 text-slate-900 min-h-screen flex items-center justify-center font-mono">
        {/* Background Grid & Glow */}
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>
        <div className="relative z-10 glass p-8 rounded-3xl border border-rose-500/20 max-w-md mx-auto text-center">
          <p className="text-rose-500 font-semibold mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#F27024] hover:bg-[#e05e1b] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
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

  return (
    <div className="team-area-light relative overflow-hidden font-sans bg-[#faf9f6] text-slate-900 min-h-screen">
      {/* Background Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12 space-y-8 font-mono">
        {/* Top Banner team details */}
        <div className="bg-white p-8 rounded-3xl relative overflow-hidden border border-slate-200 shadow-sm transition-all text-slate-800">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Main Info (Col 5): Team name & Status */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded font-extrabold tracking-wider ${team?.status?.toLowerCase() === "confirmed"
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    }`}
                >
                  {getTeamStatusText(team?.status)}
                </span>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-800 uppercase tracking-tight">
                  {team?.name}
                </h1>
              </div>
            </div>

            {/* Vertical Divider (Hidden on mobile) */}
            <div className="hidden lg:block lg:col-span-1 h-16 border-l border-slate-200 mx-auto"></div>

            {/* Contest Metadata (Col 3): Event & Semester */}
            <div className="lg:col-span-3 space-y-3 font-sans">
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-mono tracking-wider font-bold">
                  CUỘC THI
                </span>
                <span className="text-xl font-extrabold text-slate-800 font-mono uppercase truncate block">
                  {team?.eventId?.name || "---"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-mono tracking-wider font-bold">
                  HỌC KỲ
                </span>
                <span className="text-xl font-bold text-slate-600 font-mono">
                  {team?.eventId?.semester
                    ? `${team.eventId.semester} ${team.eventId.year}`
                    : "---"}
                </span>
              </div>
            </div>

            {/* Track & Size Info (Col 3): Bảng đấu & Thành viên */}
            <div className="lg:col-span-3 space-y-3 font-sans">
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-mono tracking-wider font-bold">
                  BẢNG ĐẤU
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F27024] bg-[#F27024]/10 border border-[#F27024]/20 px-3 py-1 rounded-full mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F27024]"></span>
                  {team?.trackId?.name || "Chờ phân bảng"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-mono tracking-wider font-bold">
                  THÀNH VIÊN
                </span>
                <span className="text-xl font-semibold text-slate-600 flex items-center gap-1.5 mt-1 font-mono">
                  <Users size={14} className="text-slate-400" />
                  <span>{members?.length || 0} Thành viên</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Round Banner */}
        {(() => {
          const countdown = getRoundCountdown();
          const isRegistration =
            !hasContestStarted ||
            team?.eventId?.status === "registration" ||
            team?.eventId?.status === "upcoming";

          if (isRegistration) {
            const hasContestStart = team?.eventId?.contestStart;
            return (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm text-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider font-bold">
                      Trạng thái giải đấu
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-800">
                      Chưa mở{" "}
                      <span className="text-[#F27024] font-extrabold uppercase font-mono">
                        (Đang mở đăng ký đội thi)
                      </span>
                    </p>
                  </div>
                </div>
                {/* Timer / Info section */}
                {hasContestStart && (
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 self-start sm:self-auto">
                    <Clock size={14} className="text-[#F27024]" />
                    <div className="text-xs font-mono">
                      <span className="text-slate-400 uppercase tracking-wider text-[9px] block">
                        Thời gian mở cuộc thi
                      </span>
                      <span className="text-amber-600 font-bold">
                        {new Date(hasContestStart) > currentTime
                          ? getRemainingTimeText(hasContestStart)
                          : "Sắp diễn ra"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          if (!team?.currentEventRound) return null;

          return (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm text-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#F27024]"></div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider font-bold">
                    Trạng thái giải đấu
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Vòng thi hiện tại:{" "}
                    <span className="text-[#F27024] font-extrabold uppercase font-mono">
                      {team.currentEventRound}
                    </span>
                  </p>
                </div>
              </div>
              {/* Timer section */}
              {countdown && (
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 self-start sm:self-auto">
                  <Clock size={14} className="text-[#F27024]" />
                  <div className="text-xs font-mono">
                    <span className="text-slate-400 uppercase tracking-wider text-[9px] block">
                      Thời gian làm bài
                    </span>
                    <span className={`${countdown.color} font-bold`}>
                      {countdown.text}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Prominent Team Area Announcement (Location / Preliminary Round Notice) */}
        {team?.eventId?.locationAnnouncement &&
          team.eventId.locationAnnouncement.trim().length > 0 && (
            <div className="relative overflow-hidden bg-gradient-to-r from-orange-500/[0.08] via-amber-500/[0.04] to-slate-50/80 p-5 sm:p-6 rounded-2xl border-2 border-[#F27024]/30 shadow-sm transition-all hover:border-[#F27024]/50">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#F27024]/15 text-[#F27024] rounded-xl border border-[#F27024]/30 shrink-0 shadow-inner">
                  <Megaphone size={22} className="animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase font-mono tracking-wider px-2.5 py-0.5 rounded-md bg-[#F27024] text-white shadow-sm shadow-orange-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      Thông báo từ BTC
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono font-bold">
                      Khu vực thi &amp; Địa điểm
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans font-medium whitespace-pre-line break-words">
                    {team.eventId.locationAnnouncement}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Seminar Widget */}
        {team?.eventId?.seminar?.scheduledAt &&
          !isExamVisible &&
          team?.eventId?.status !== "ongoing" &&
          team?.eventId?.status !== "completed" &&
          !team?.isEliminated && (
            <SeminarWidget seminar={team.eventId.seminar} />
          )}

        {/* Chat Section */}
        {team && team.eventId?.status === "ongoing" && !team.isEliminated && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#F27024]/10 text-[#F27024] rounded-xl border border-[#F27024]/20">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-slate-800 font-bold">Hỗ trợ từ Mentor</h3>
                <p className="text-xs text-slate-500 font-sans">
                  Bạn có câu hỏi hoặc cần sự giúp đỡ? Hãy nhắn tin trao đổi trực
                  tiếp với Mentor hướng dẫn.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open_chat_room", {
                    detail: { teamId: team._id },
                  }),
                );
              }}
              className="px-5 py-2.5 bg-[#F27024] hover:bg-[#d95f1f] !text-white text-xs font-bold uppercase rounded-xl transition-all shadow-md shadow-orange-500/20 whitespace-nowrap cursor-pointer font-sans"
            >
              Nhắn tin ngay
            </button>
          </div>
        )}

        {/* Dynamic Exam / Topic / Round / Code Dashboard Grid */}
        {team && !team.isEliminated && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8 items-stretch">
            {/* Left: Exam & Materials Card */}
            {isExamVisible && (
              <div
                className={`lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-800 relative overflow-hidden flex flex-col justify-between`}
              >
                <div className="flex flex-col justify-between h-full">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 font-mono-tech">
                      <BookOpen size={18} className="text-[#F27024]" />
                      <span className="text-[#F27024]">
                        [ĐỀ_BÀI_&amp;_TÀI_LIỆU_THI]
                      </span>
                    </h2>
                    {round && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono uppercase tracking-wider">
                        Vòng: {round.name}
                      </span>
                    )}
                  </div>

                  {team?.eventId?.contestStart &&
                    new Date(team.eventId.contestStart) > currentTime &&
                    !hasContestStarted ? (
                    <div className="flex flex-col items-center justify-center py-6 space-y-4">
                      <div className="space-y-1.5 text-center">
                        <p className="text-xs text-amber-600 font-sans font-semibold uppercase tracking-wider">
                          Đề bài cuộc thi &quot;{team.eventId.name}&quot; sẽ
                          được mở sau:
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          Thời gian mở đề:{" "}
                          {new Date(team.eventId.contestStart).toLocaleString(
                            "vi-VN",
                          )}
                        </p>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-[#F27024] font-mono bg-slate-50 px-6 py-3.5 rounded-xl border border-slate-200 tracking-widest">
                        {getRemainingTimeText(team.eventId.contestStart)}
                      </div>
                    </div>
                  ) : round?.startTime &&
                    new Date(round.startTime) > currentTime &&
                    !round?.isExamManualOpen &&
                    round?.status !== "active" &&
                    !team?.trackId?.examAccess?.examOpened ? (
                    <div className="flex flex-col items-center justify-center py-6 space-y-4">
                      <div className="space-y-1.5 text-center">
                        <p className="text-xs text-amber-600 font-sans font-semibold uppercase tracking-wider">
                          Đề bài vòng thi &quot;{round.name}&quot; sẽ được mở
                          sau:
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          Thời gian mở đề:{" "}
                          {new Date(round.startTime).toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-[#F27024] font-mono bg-slate-50 px-6 py-3.5 rounded-xl border border-slate-200 tracking-widest">
                        {getRemainingTimeText(round.startTime)}
                      </div>
                    </div>
                  ) : team?.trackId?.examAccess?.examOpened ? (() => {
                    const effectiveTrackName = team.trackId.originalTrackName || team.trackId.name || "";
                    return (
                      <div className="flex flex-col justify-between h-full space-y-4 py-1">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase font-mono tracking-wider">
                              ĐỀ BÀI ĐÃ MỞ KHÓA — BẢNG{" "}
                              {effectiveTrackName.toUpperCase()}
                            </p>
                          </div>
                          <h3
                            className="text-sm sm:text-base font-extrabold text-slate-800 leading-snug font-sans flex items-center gap-2"
                            title={
                              team.trackId.examAccess.examDriveFileName ||
                              `Đề bảng ${effectiveTrackName}`
                            }
                          >
                            <BookOpen
                              size={18}
                              className="text-[#F27024] shrink-0"
                            />
                            {team.trackId.examAccess.examDriveFileName ||
                              `Đề thi & Tài liệu hướng dẫn — Bảng ${effectiveTrackName}`}
                          </h3>
                          <p className="text-xs text-slate-500 font-sans leading-relaxed">
                            Tài liệu đề bài, sơ đồ kiến trúc hệ thống và dữ liệu
                            mẫu được lưu trữ trên thư mục Google Drive riêng của
                            bảng {effectiveTrackName}. Thí sinh vui lòng tải về để
                            bắt đầu nghiên cứu và thiết lập thiết bị làm bài.
                          </p>
                        </div>

                        <div className="pt-2 mt-auto">
                          <a
                            href={team.trackId.examAccess.examDriveFileUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 bg-[#F27024] hover:bg-[#d95f1f] !text-white text-xs font-bold uppercase py-2.5 px-4 rounded-xl transition-all shadow-md shadow-orange-500/20 text-center cursor-pointer"
                          >
                            <BookOpen size={14} />
                            Mở đề thi
                          </a>
                        </div>
                      </div>
                    );
                  })() : team?.trackId?.examAccess?.hasExamMaterial ? (
                    <div className="text-center py-6 text-slate-500 font-sans text-xs">
                      <Clock
                        size={32}
                        className="mx-auto text-amber-500 mb-2"
                      />
                      <p className="font-semibold text-slate-700">
                        Đề thi đang được chuẩn bị
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Đề đã được gắn nhưng chưa đến giờ mở khóa hoặc chưa cấu
                        hình thời gian mở đề.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 italic font-sans text-xs">
                      <BookOpen
                        size={32}
                        className="mx-auto text-slate-300 mb-2"
                      />
                      <p>
                        Hiện chưa có đề bài hoặc tài liệu thi được phân phối cho
                        vòng này.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Right: Members Card */}
            <div
              className={`${isExamVisible ? "lg:col-span-6" : "lg:col-span-12"} flex flex-col h-full`}
            >
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-800 text-left h-full flex flex-col justify-between flex-1">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between font-mono-tech border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-[#F27024]" />
                      <span className="text-[#F27024]">THÀNH VIÊN NHÓM</span>
                    </div>
                    {isLeader && !hasContestStarted && (
                      <button
                        onClick={handleOpenEditModal}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#F27024] hover:bg-[#F27024]/10 px-2.5 py-1 rounded border border-[#F27024]/20 transition-all cursor-pointer font-sans uppercase tracking-wider"
                      >
                        <Edit3 size={10} />
                        Sửa thông tin
                      </button>
                    )}
                  </h2>
                  {!hasContestStarted && (
                    <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-600 leading-relaxed font-sans">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <span>
                        Đảm bảo đúng thông tin đội thi và thành viên trước khi
                        cuộc thi chính thức bắt đầu.
                      </span>
                    </div>
                  )}
                  <div
                    className={
                      !isExamVisible
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
                        : "space-y-3.5 max-h-[300px] overflow-y-auto pr-1"
                    }
                  >
                    {members?.map((m: any) => (
                      <div
                        key={m._id}
                        className={`flex items-center justify-between p-3 bg-slate-50 rounded-xl border text-xs ${m.role === "leader"
                          ? "border-amber-500/30"
                          : "border-slate-200"
                          }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={`font-bold truncate ${m.role === "leader" ? "text-amber-600" : "text-slate-800"}`}
                            >
                              {m.userId?.fullName}
                            </p>
                            {m.role === "leader" && (
                              <Crown
                                size={12}
                                className="text-amber-500 shrink-0 fill-amber-500/20"
                              />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            {m.userId?.email}
                          </p>
                          {(m.userId?.studentId || m.userId?.university) && (
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                              {m.userId?.studentId &&
                                `MSSV: ${m.userId.studentId}`}
                              {m.userId?.studentId &&
                                m.userId?.university &&
                                " • "}
                              {m.userId?.university}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          {m.confirmStatus === "confirmed" ? (
                            m.role === "leader" ? (
                              <span className="flex items-center gap-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase">
                                Leader
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase">
                                Member
                              </span>
                            )
                          ) : (
                            <span className="flex items-center gap-0.5 bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded text-[9px] font-bold">
                              <Clock size={8} /> {m.role === "leader" ? "Leader (Chờ duyệt)" : "Chờ duyệt"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Zalo Card */}
              {team.eventId?.zaloUrl && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-slate-800 relative overflow-hidden text-left">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-600 shrink-0">
                      <MessageSquare size={20} />
                    </div>
                    <div className="space-y-3 flex-1 min-w-0">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 font-mono uppercase tracking-wide">
                          KÊNH ZALO HỖ TRỢ ĐỘI THI
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed font-sans">
                          Tham gia nhóm Zalo hỗ trợ kỹ thuật và nhận thông báo
                          khẩn cấp từ BTC.
                        </p>
                      </div>
                      <a
                        href={team.eventId.zaloUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 !text-white font-bold text-[10px] uppercase rounded-xl transition-all shadow-md shadow-blue-600/10 tracking-wider font-mono cursor-pointer border border-blue-400/20"
                      >
                        <span>Tham gia ngay</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isExamVisible && !team?.isEliminated && (
          <div className="w-full space-y-8 mt-8">
            {/* GitHub Integration & AI Commit Reviews */}
            {repository ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Repository Info Column */}
                <div className="lg:col-span-3 bg-white p-5 rounded-2xl space-y-4 border border-slate-200 shadow-sm text-slate-800 text-left">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-mono-tech border-b border-slate-100 pb-3">
                    <Github size={16} className="text-[#F27024]" />
                    <span className="text-[#F27024]">[GITHUB_REPOSITORY]</span>
                  </h3>

                  <div className="space-y-4 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                        Tên Repo
                      </span>
                      <p className="text-xs font-bold text-slate-800 mt-1 break-all">
                        {repository.orgName
                          ? `${repository.orgName}/${repository.repoName}`
                          : repository.repoName}
                      </p>
                    </div>

                    {repository.repoUrl && (
                      <div className="pt-2">
                        <a
                          href={repository.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 bg-[#F27024] hover:bg-[#d95f1f] !text-white text-xs font-bold uppercase py-2 px-4 rounded-xl transition-all shadow-md shadow-orange-500/20 text-center cursor-pointer"
                        >
                          <ExternalLink size={12} />
                          Mở GitHub Repo
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Commits Area Card (Merged list and details) */}
                <div className="lg:col-span-9 glass p-6 rounded-2xl border border-slate-800 text-left">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono-tech border-b border-slate-800 pb-3 mb-4">
                    <Github size={16} className="text-cyan-400" />
                    <span className="text-cyan-400">
                      [GITHUB_COMMITS_({commits.length})]
                    </span>
                  </h3>

                  {commits.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-8 text-center">
                      Chưa crawl được commit nào. Commit sẽ được đồng bộ mỗi{" "}
                      {team?.eventId?.commitSyncInterval || 30} phút.
                    </p>
                  ) : (
                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                      {commits.map((c: any) => (
                        <div
                          key={c._id}
                          className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2 text-left font-mono"
                        >
                          <div className="flex justify-between items-center text-[10px] text-cyan-400 font-bold font-mono-tech">
                            <span>SHA: {c.commitSha.substring(0, 8)}</span>
                            <span>
                              {new Date(c.committedAt).toLocaleString("vi-VN")}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white leading-snug">
                            {c.message}
                          </h4>
                          <p className="text-xs text-slate-400">
                            Tác giả:{" "}
                            <span className="text-slate-350 font-semibold">
                              {c.authorName} (@{c.authorGithubUsername})
                            </span>
                          </p>
                          <div className="flex gap-3 text-[10px] pt-1">
                            <span className="text-emerald-400">
                              +{c.additions} dòng
                            </span>
                            <span className="text-rose-400">
                              -{c.deletions} dòng
                            </span>
                            <span className="text-slate-400">
                              {c.changedFilesCount} tệp
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-slate-800 text-center flex flex-col items-center justify-center min-h-[300px]">
                <Github size={48} className="text-slate-400 mb-3" />
                <p className="font-semibold text-lg text-slate-800">
                  Chưa thiết lập GitHub Repository
                </p>
                <p className="text-sm text-slate-500 max-w-sm mt-1">
                  Đường dẫn repository sẽ tự động được tạo và phân quyền sau khi
                  tất cả các thành viên xác nhận tham gia nhóm qua link email.
                </p>
              </div>
            )}
          </div>
        )}

        {team?.isEliminated && (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-slate-800 text-center space-y-6 max-w-2xl mx-auto mt-4">
            <div className="w-16 h-16 rounded-full bg-[#F27024]/10 border border-[#F27024]/20 text-[#F27024] flex items-center justify-center mx-auto">
              <Trophy size={28} />
            </div>

            <div className="space-y-2 font-sans">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider font-mono-tech">
                Kết Quả Đạt Được
              </h2>
              <p className="text-xs text-slate-500">
                Thành tích chính thức của đội thi{" "}
                <strong className="text-slate-800">{team.name}</strong> ghi nhận
                tại cuộc thi.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto pt-2">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider font-bold">
                  Thứ hạng (Bảng)
                </span>
                <p className="text-2xl font-black text-[#F27024] font-mono">
                  {team.achievedResult?.rank
                    ? `Top ${team.achievedResult.rank}`
                    : "---"}
                </p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider font-bold">
                  Điểm trung bình
                </span>
                <p className="text-2xl font-black text-emerald-600 font-mono">
                  {team.achievedResult?.score
                    ? `${team.achievedResult.score.toFixed(2)}`
                    : "---"}
                </p>
              </div>
            </div>

            {team.achievedResult && (
              <div className="text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-100 max-w-sm mx-auto">
                <span>
                  Ghi nhận tại: {team.achievedResult.roundName} (
                  {team.achievedResult.trackName})
                </span>
              </div>
            )}

            <p className="text-xs text-slate-500 leading-relaxed font-sans max-w-md mx-auto pt-2">
              Cảm ơn bạn đã cống hiến hết mình tại giải đấu năm nay! Chúc đội
              thi <strong className="text-slate-800">{team.name}</strong> gặt
              hái được nhiều thành công hơn nữa trên con đường phát triển công
              nghệ sắp tới.
            </p>
          </div>
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
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono tracking-wider">
                            Trưởng nhóm
                          </span>
                        ) : (
                          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono tracking-wider">
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
                            className="text-rose-500 hover:text-rose-400 text-[8px] font-bold cursor-pointer font-mono border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 rounded"
                          >
                            XÓA
                          </button>
                        )}
                        {isLeader && !member.isNew && member.role !== "leader" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTransferLeaderParticipant(member.userId, member.fullName)}
                              className="text-amber-500 hover:text-amber-400 text-[8px] font-bold cursor-pointer font-mono border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded"
                              title="Chuyển vai trò Trưởng nhóm"
                            >
                              CHUYỂN TRƯỞNG NHÓM
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMemberParticipant(member.userId, member.fullName)}
                              className="text-rose-500 hover:text-rose-400 text-[8px] font-bold cursor-pointer font-mono border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 rounded"
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
                                className="w-full bg-slate-955 border border-slate-800 text-slate-200 pl-3.5 pr-20 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
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
                            className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
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
                            className="bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
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
                            className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
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
                            inputClassName="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
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
                            className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
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
                            className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
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
                  className={`w-full bg-slate-955 border px-3.5 py-2.5 rounded-xl focus:outline-none transition-all font-mono text-xs ${deleteConfirmTeamName &&
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
