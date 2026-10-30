import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "axios";
import { Search, Check, ChevronRight, AlertCircle } from "lucide-react";
import { io, Socket } from "socket.io-client";

export default function JudgeProjects() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [activeRound, setActiveRound] = useState<any>(null);
  const [assignedTrack, setAssignedTrack] = useState<any>(null);

  const [teams, setTeams] = useState<any[]>([]);
  const [gradedTeams, setGradedTeams] = useState<{ [teamId: string]: boolean }>(
    {},
  );
  const [teamScores, setTeamScores] = useState<{ [teamId: string]: any }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "graded"
  >("all");
  const [loading, setLoading] = useState(false);
  const [highlightedTeamId, setHighlightedTeamId] = useState<string | null>(null);
  const [rubric, setRubric] = useState<any>(null);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);

  // Real-time synchronization
  useEffect(() => {
    if (!selectedEventId || !token) return;

    const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
    const socket = io(socketUrl, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_live_room", { eventId: selectedEventId });
    });

    socket.on("team_highlighted", (data: any) => {
      console.log("Team highlighted via socket:", data);
      if (!data.roundId || data.roundId === selectedRoundId) {
        setHighlightedTeamId(data.teamId);
      }
    });

    socket.on("score_updated", (data: any) => {
      console.log("Socket Event: score_updated received on JudgeProjects:", data);
      if (data.roundId === selectedRoundId) {
        axiosInstance.get(`http://localhost:5000/api/grades/team/${data.teamId}/round/${selectedRoundId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res: any) => {
            setGradedTeams(prev => ({
              ...prev,
              [data.teamId]: !!(res.data && res.data.score)
            }));
            setTeamScores(prev => ({
              ...prev,
              [data.teamId]: res.data?.score || null
            }));
          })
          .catch(err => console.error("Error refreshing team score via socket:", err));
      }
    });

    return () => {
      socket.emit("leave_live_room", { eventId: selectedEventId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedEventId, selectedRoundId, token]);

  // Fetch active contest details
  useEffect(() => {
    axiosInstance
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

  // Fetch teams & scores
  useEffect(() => {
    if (!selectedRoundId) {
      setTeams([]);
      setError("");
      return;
    }
    setError("");
    setLoading(true);
    axiosInstance
      .get(`http://localhost:5000/api/teams/all/${selectedEventId}?roundId=${selectedRoundId}&role=judge`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(async (res: any) => {
        const confirmed = res.data.filter((t: any) => t.status === "confirmed");
        setTeams(confirmed);

        // Fetch scores for each team
        const statusMap: { [teamId: string]: boolean } = {};
        const scoreMap: { [teamId: string]: any } = {};

        await Promise.all(
          confirmed.map(async (team: any) => {
            try {
              const gradeRes = await axiosInstance.get(
                `http://localhost:5000/api/grades/team/${team._id}/round/${selectedRoundId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (gradeRes.data && gradeRes.data.score) {
                statusMap[team._id] = true;
                scoreMap[team._id] = gradeRes.data.score;
              } else {
                statusMap[team._id] = false;
              }
            } catch (err) {
              statusMap[team._id] = false;
            }
          }),
        );

        setGradedTeams(statusMap);
        setTeamScores(scoreMap);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error(err);
        const errMsg = err.response?.data?.message || "Đã xảy ra lỗi khi tải danh sách dự án.";
        setError(errMsg);
        setLoading(false);
      });
  }, [selectedRoundId, selectedEventId, token]);

  // Fetch rubric for round to know max score
  useEffect(() => {
    if (!selectedRoundId) {
      setRubric(null);
      return;
    }
    axiosInstance
      .get(`http://localhost:5000/api/rubrics/round/${selectedRoundId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res: any) => {
        if (res.data && res.data.rubric) {
          setRubric(res.data.rubric);
        }
      })
      .catch((err: any) => console.error("Error fetching rubric:", err));
  }, [selectedRoundId, token]);

  const filteredTeams = teams.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());

    const isGraded = gradedTeams[t._id];
    const matchFilter =
      statusFilter === "all" ||
      (statusFilter === "graded" && isGraded) ||
      (statusFilter === "pending" && !isGraded);
    return matchSearch && matchFilter;
  });

  const isRoundCompleted = activeRound?.status === 'completed';

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Chấm điểm
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Đánh giá và chấm điểm chất lượng mã nguồn, giải pháp kỹ thuật của các đội thi.
          </p>
        </div>
      </div>

      {/* Selectors & Filter Row */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center animate-fadeIn">
        <div className="flex flex-wrap gap-8 items-center w-full md:w-auto">
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
                <p className="text-sm font-extrabold text-[#F27024] mt-1 uppercase">
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

        {/* Filter Tab buttons & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F27024]">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm dự án, đội..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-full text-xs pl-9 pr-4 py-2 w-full text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 focus:border-[#F27024] focus:bg-white shadow-inner"
            />
          </div>

          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === "all"
                ? "bg-[#F27024] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === "pending"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Chưa chấm
            </button>
            <button
              onClick={() => setStatusFilter("graded")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === "graded"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Đã chấm
            </button>
          </div>
        </div>
      </div>

      {/* Projects Data Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm animate-pulse">
            Đang tải danh sách dự án...
          </div>
        ) : error ? (
          <div className="text-center py-20 text-rose-600 text-sm font-semibold px-4">
            {error}
          </div>
        ) : filteredTeams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-black border-b border-slate-200 text-xs font-bold text-slate-500">
                  <th className="px-6 py-4">Tên đội thi (Team)</th>
                  <th className="px-6 py-4">Trạng thái chấm</th>
                  <th className="px-6 py-4">Điểm</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredTeams.map((team) => {
                  const isGraded = gradedTeams[team._id];
                  const scoreObj = teamScores[team._id];
                  return (
                    <tr
                      key={team._id}
                      className={`transition-all ${team._id === highlightedTeamId
                        ? "bg-amber-50/50 border-l-4 border-amber-500 shadow-sm animate-pulse"
                        : "hover:bg-slate-50"
                        }`}
                    >
                      {/* Column 1: Team Info */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#F27024]/10 border border-[#F27024]/20 flex items-center justify-center text-[#F27024] font-bold text-sm">
                            {team.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-slate-800 block">
                                {team.name}
                              </span>
                              {(team.originalTrackName || team.trackId?.name) && (
                                <span className="bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                                  {team.originalTrackName || team.trackId?.name}
                                </span>
                              )}
                              {team._id === highlightedTeamId && (
                                <span className="bg-amber-100 text-amber-800 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-md tracking-normal animate-pulse">
                                  Đang chấm
                                </span>
                              )}
                            </div>
                            {(team.originalTrackId?.topicName || team.trackId?.topicName || team.topicSubmission?.title) && (
                              <span className="text-xs text-slate-500 block mt-0.5">
                                Đề tài: {team.originalTrackId?.topicName || team.trackId?.topicName || team.topicSubmission?.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Status */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-250 px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-normal">
                            <Check size={10} /> Đã chấm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-[#F27024]/10 text-[#F27024] border border-[#F27024]/20 px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-normal">
                            Chờ chấm
                          </span>
                        )}
                      </td>

                      {/* Column 3.5: Score */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        {isGraded ? (
                          <span className="text-[#F27024] font-bold text-sm bg-[#F27024]/5 border border-[#F27024]/20 px-2.5 py-1 rounded-lg">
                            {scoreObj?.totalWeightedScore !== undefined ? scoreObj.totalWeightedScore : '0'}/{rubric ? rubric.maxCriterionScore : 10}đ
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-sm">
                            chưa chấm
                          </span>
                        )}
                      </td>

                      {/* Column 4: Action */}
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        {!isRoundCompleted && (
                          <button
                            onClick={() => navigate(`/expert/score/${team._id}?roundId=${selectedRoundId}`)}
                            className={`inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isGraded
                              ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              : "bg-[#F27024] hover:bg-[#d95f1f] text-white"
                              }`}
                          >
                            <span>{isGraded ? "Xem & Sửa" : "Bắt đầu chấm"}</span>
                            <ChevronRight size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50">
            <AlertCircle size={36} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-500">
              Không tìm thấy đội thi nào phù hợp với bộ lọc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
