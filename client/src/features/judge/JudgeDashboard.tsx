import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Timer, Activity, Play, ArrowRight } from "lucide-react";

export default function JudgeDashboard() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [activeRound, setActiveRound] = useState<any>(null);
  const [assignedTrack, setAssignedTrack] = useState<any>(null);

  const [teams, setTeams] = useState<any[]>([]);
  const [lastGradedTeamId, setLastGradedTeamId] = useState<string | null>(null);
  const [lastGradedTeamName, setLastGradedTeamName] = useState<string>("");

  const [stats, setStats] = useState({
    activeTeamsCount: 0,
    perPushCount: 0,
    totalRecords: 0,
    lastSyncTime: "",
  });

  const [allCommits, setAllCommits] = useState<any[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const [timerLabel, setTimerLabel] = useState("Thời gian chấm còn lại");

  // Fetch active contest details
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/events/judge/active-contest", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res: any) => {
        if (res.data.event) {
          setActiveEvent(res.data.event);
          setSelectedEventId(res.data.event._id);

          if (res.data.currentRound) {
            setActiveRound(res.data.currentRound);
            setSelectedRoundId(res.data.currentRound._id);
          }

          if (res.data.assignedTrack) {
            setAssignedTrack(res.data.assignedTrack);
          } else if (res.data.tracks && res.data.tracks.length > 0) {
            setAssignedTrack(res.data.tracks[0]);
          }
        }
      })
      .catch((err: any) => console.error("Error fetching active contest:", err));
  }, [token]);

  // Fetch AI stats
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/ai-analyses/stats", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res: any) => {
        setStats(res.data);
      })
      .catch((err: any) => console.error("Error fetching stats:", err));
  }, [token]);

  // Fetch Teams and find last graded team
  useEffect(() => {
    if (!selectedEventId) return;
    axios
      .get(`http://localhost:5000/api/teams/all/${selectedEventId}?roundId=${selectedRoundId}&role=judge`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(async (res: any) => {
        const confirmed = res.data.filter((t: any) => t.status === "confirmed");
        setTeams(confirmed);

        if (confirmed.length > 0) {
          // Default last graded team to the first team
          setLastGradedTeamId(confirmed[0]._id);
          setLastGradedTeamName(confirmed[0].name);

          // Let's check which team was actually recently graded
          for (const team of confirmed) {
            try {
              const gradeRes = await axios.get(
                `http://localhost:5000/api/grades/team/${team._id}/round/${selectedRoundId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (gradeRes.data && gradeRes.data.score) {
                setLastGradedTeamId(team._id);
                setLastGradedTeamName(team.name);
                break;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      })
      .catch((err: any) => console.error(err));
  }, [selectedEventId, selectedRoundId, token]);

  // Fetch Commits from all teams
  useEffect(() => {
    if (teams.length === 0) {
      setAllCommits([]);
      return;
    }

    const fetchAllCommits = async () => {
      setCommitsLoading(true);
      const commitList: any[] = [];
      await Promise.all(
        teams.map(async (team) => {
          try {
            const res = await axios.get(
              `http://localhost:5000/api/analytics/team/${team._id}/commits`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (Array.isArray(res.data)) {
              const commitsWithTeam = res.data.map((c) => ({
                ...c,
                teamName: team.name,
                teamId: team._id,
              }));
              commitList.push(...commitsWithTeam);
            }
          } catch (err) {
            console.error("Failed to fetch commits for team:", team.name, err);
          }
        }),
      );

      commitList.sort(
        (a, b) =>
          new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime(),
      );
      setAllCommits(commitList);
      setCommitsLoading(false);
    };

    fetchAllCommits();
  }, [teams, token]);

  // Countdown timer based on track schedules
  useEffect(() => {
    if (!assignedTrack) {
      setTimeLeft("CHƯA CÓ LỊCH");
      setTimerLabel("Thời gian thi đấu");
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const startTime = assignedTrack.startTime ? new Date(assignedTrack.startTime).getTime() : 0;
      const endTime = assignedTrack.endTime ? new Date(assignedTrack.endTime).getTime() : 0;
      const gradingEndTime = assignedTrack.gradingEndTime ? new Date(assignedTrack.gradingEndTime).getTime() : 0;

      if (startTime && now < startTime) {
        setTimerLabel("Trạng thái bảng đấu");
        setTimeLeft("CHƯA BẮT ĐẦU THI");
      } else if (endTime && now < endTime) {
        setTimerLabel("Thời gian làm bài còn lại");
        const diff = endTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      } else if (gradingEndTime && now < gradingEndTime) {
        setTimerLabel("Thời gian chấm còn lại");
        const diff = gradingEndTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      } else {
        setTimerLabel("Trạng thái bảng đấu");
        setTimeLeft("ĐÃ HẾT HẠN CHẤM");
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [assignedTrack]);

  const getSyncTimeElapsed = (dateStr: string) => {
    if (!dateStr) return "Chưa có hoạt động";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `${diffDays} ngày trước`;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) return `${diffHours} giờ trước`;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins} phút trước`;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Title & Countdown Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Tổng quan
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Theo dõi tiến độ chấm điểm và cập nhật Git thời gian thực của các
            đội thi.
          </p>
        </div>

        {/* Countdown Badge */}
        <div className="bg-white border border-slate-200 px-6 py-3.5 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="p-2 bg-rose-50 border border-rose-200 rounded-full">
            <Timer className="text-rose-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold tracking-normal uppercase">
              {timerLabel}
            </p>
            <p className="text-xl font-bold text-rose-600 tracking-normal mt-0.5">
              {timeLeft}
            </p>
          </div>
        </div>
      </div>

      {/* Selectors Row (Read-only Active Contest Info) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-8 items-center animate-fadeIn">
        {activeEvent ? (
          <>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-normal">Cuộc thi đang diễn ra</p>
              <p className="text-sm font-extrabold text-slate-800 mt-1 uppercase">
                {activeEvent.name}
              </p>
            </div>
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-normal">Vòng thi hiện tại</p>
              <p className="text-sm font-extrabold text-primary mt-1 uppercase">
                {activeRound ? (activeRound.advanceTopN > 0 ? `${activeRound.name} (Lấy Top ${activeRound.advanceTopN})` : activeRound.name) : "Không có vòng thi active"}
              </p>
            </div>
            {assignedTrack && (
              <>
                <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-normal">Bảng đấu được phân công</p>
                  <p className="text-sm font-extrabold text-emerald-600 mt-1 uppercase">
                    {assignedTrack.name}
                  </p>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-sm text-rose-600 font-bold uppercase">
            Hiện tại không có cuộc thi nào đang diễn ra.
          </div>
        )}
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 border-l-4 border-l-primary shadow-xs hover:shadow-md transition-all">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Tổng số đội thi
          </p>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {stats.activeTeamsCount || teams.length}
          </p>
          <p className="text-xs text-primary mt-1.5 uppercase font-semibold">
            Tham gia sự kiện
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 border-l-4 border-l-primary shadow-xs hover:shadow-md transition-all">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Push Per-Push (Đã tải)
          </p>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {stats.perPushCount || allCommits.length}
          </p>
          <p className="text-xs text-primary mt-1.5 uppercase font-semibold">
            Đồng bộ từ webhook
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 border-l-4 border-l-emerald-500 shadow-xs hover:shadow-md transition-all">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Hoạt động code gần nhất
          </p>
          <p className="text-sm font-bold text-slate-800 mt-4 truncate">
            {stats.lastSyncTime
              ? new Date(stats.lastSyncTime).toLocaleString("vi-VN")
              : "Chưa cập nhật"}
          </p>
          <p className="text-xs text-emerald-600 mt-1.5 uppercase font-semibold">
            {getSyncTimeElapsed(stats.lastSyncTime)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 border-l-4 border-l-pink-500 shadow-xs hover:shadow-md transition-all">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Tổng bản ghi đã tải
          </p>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {stats.totalRecords || 215}
          </p>
          <p className="text-xs text-pink-600 mt-1.5 uppercase font-semibold">
            Tối đa 1000 bản ghi
          </p>
        </div>
      </div>

      {/* Quick Resume Grading Banner */}
      {lastGradedTeamId && (
        <div className="bg-linear-to-r from-[#F27024]/5 to-[#f9823a]/5 border border-primary/20 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,112,36,0.08),transparent_50%)] pointer-events-none"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary shrink-0">
              <Play size={20} className="fill-primary animate-pulse ml-0.5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                Tiếp tục phiên làm việc
              </h3>
              <p className="text-sm text-slate-600 mt-0.5">
                Tiếp tục xem chi tiết và chấm điểm cho đội thi:{" "}
                <strong className="text-primary font-bold">
                  "{lastGradedTeamName}"
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/expert/score/${lastGradedTeamId}?roundId=${selectedRoundId}`)}
            className="bg-primary hover:bg-[#d95f1f] text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shrink-0 relative z-10 shadow-xs"
          >
            Vào bàn chấm điểm
          </button>
        </div>
      )}

      {/* Recent Activity Feed */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl flex flex-col">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            <span>Hoạt động Git gần nhất từ các đội ({allCommits.length})</span>
          </h3>
          <button
            onClick={() => navigate("/expert/projects")}
            className="text-primary hover:text-[#d95f1f] font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Xem tất cả dự án &rarr;
          </button>
        </div>

        <div className="p-6 max-h-[500px] overflow-y-auto space-y-4">
          {commitsLoading ? (
            <div className="text-center py-12 text-slate-500 text-sm animate-pulse">
              Đang tải dữ liệu hoạt động Git...
            </div>
          ) : allCommits.length > 0 ? (
            allCommits.slice(0, 10).map((c, idx) => (
              <div
                key={c._id || idx}
                className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-200 hover:bg-slate-100/50 transition-all"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-sm shadow-xs">
                      {c.teamName}
                    </span>
                    <span className="text-xs text-primary font-semibold">
                      @{c.authorGithubUsername || c.authorName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      [{c.commitSha?.slice(0, 8) || "sha"}]
                    </span>
                    <span className="text-xs text-slate-400">
                      {getSyncTimeElapsed(c.committedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed truncate">
                    {c.message}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                    <span className="text-emerald-600 font-bold">
                      +{c.additions} lines
                    </span>
                    <span className="text-rose-600 font-bold">
                      -{c.deletions} lines
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/expert/activity/${c.teamId}`)}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white border border-primary/20 hover:border-transparent hover:bg-primary bg-primary/5 px-4 py-2 rounded-lg transition-all uppercase tracking-wider shrink-0"
                >
                  <span>Hoạt động</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 italic text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
              Chưa có hoạt động Git nào được ghi nhận.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
