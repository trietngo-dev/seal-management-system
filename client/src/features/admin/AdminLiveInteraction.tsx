import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import {
  Sparkles,
  Tv,
  ListFilter,
  UserCheck,
  Edit3,
  Save,
  Activity,
  ChevronRight,
  History,
  ShieldCheck,
  BellRing,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import CustomSelect from "../shared/CustomSelect";

export default function AdminLiveInteraction() {
  const { readOnly = false } = useOutletContext<{ readOnly?: boolean }>();
  const token = localStorage.getItem("token");
  const socketRef = useRef<Socket | null>(null);

  // Selector states
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedRankingTrackId, setSelectedRankingTrackId] = useState("");

  // Data states
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [judges, setJudges] = useState<any[]>([]);
  const [rubric, setRubric] = useState<any | null>(null);
  const [criteria, setCriteria] = useState<any[]>([]);

  // Live Sync states
  const [highlightedTeamId, setHighlightedTeamId] = useState<string | null>(
    null,
  );
  const [liveLogs, setLiveLogs] = useState<any[]>([]);

  // Score Override Panel states
  const [selectedJudgeId, setSelectedJudgeId] = useState("");
  const [overrideScores, setOverrideScores] = useState<{
    [criterionId: string]: number;
  }>({});
  const [overrideComment, setOverrideComment] = useState("");
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [isAssistActionLoading, setIsAssistActionLoading] = useState(false);
  const [assistAccess, setAssistAccess] = useState({
    allowed: false,
    status: "not_requested",
    autoGrantAvailable: false,
    gradingEndTime: null as string | null,
  });
  const [scoreAccessState, setScoreAccessState] = useState<{
    canSubmit: boolean;
    reason: string;
    existingScores: any[];
    history: any[];
  }>({
    canSubmit: true,
    reason: "",
    existingScores: [],
    history: [],
  });

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, []);

  // Refs to avoid stale closures in socket callbacks
  const selectedRoundIdRef = useRef(selectedRoundId);
  const selectedTeamRef = useRef(selectedTeam);

  useEffect(() => {
    selectedRoundIdRef.current = selectedRoundId;
  }, [selectedRoundId]);

  useEffect(() => {
    selectedTeamRef.current = selectedTeam;
  }, [selectedTeam]);

  // Fetch rounds and roles when event is selected, and connect to socket room
  useEffect(() => {
    if (!selectedEventId) {
      setRounds([]);
      setSelectedRoundId("");
      setTeams([]);
      setSelectedTeam(null);
      return;
    }

    fetchEventDetails();
    fetchJudges();

    // Socket Connection
    const socketUrl =
      import.meta.env.VITE_API_URL ||
      (window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
        ? window.location.origin
        : "http://localhost:5000");
    const socket = io(socketUrl, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_live_room", { eventId: selectedEventId });
      console.log(`Connected to live socket for event: ${selectedEventId}`);
    });

    socket.on("team_highlighted", (data: any) => {
      console.log("Socket Event: team_highlighted", data);
      if (!data.roundId || data.roundId === selectedRoundIdRef.current) {
        setHighlightedTeamId(data.teamId);
      }
    });

    // Listen for real-time score updates to refresh rankings
    socket.on("score_updated", (data: any) => {
      console.log("Socket Event: score_updated in AdminLiveInteraction:", data);
      if (data.roundId === selectedRoundIdRef.current) {
        fetchLiveRankings();
        if (
          selectedTeamRef.current &&
          selectedTeamRef.current.teamId._id === data.teamId
        ) {
          fetchJudgeScoresForTeam();
        }
      }
    });

    // Real-time EventLogs pushing to live center
    socket.on("new_event_log", (newLog: any) => {
      if (
        newLog.eventId?._id === selectedEventId ||
        newLog.eventId === selectedEventId
      ) {
        setLiveLogs((prev) => [newLog, ...prev].slice(0, 15)); // keep last 15 logs
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_live_room", { eventId: selectedEventId });
        socketRef.current.disconnect();
      }
    };
  }, [selectedEventId]);

  // Fetch team rankings when round is selected
  useEffect(() => {
    if (!selectedRoundId) {
      setTeams([]);
      setSelectedTeam(null);
      return;
    }
    fetchLiveRankings();
  }, [selectedRoundId]);

  // Rubric follows the selected team's track (track-specific rubric, else the round-wide one)
  const selectedTeamTrackId = selectedTeam?.trackId?._id;
  useEffect(() => {
    if (selectedRoundId) fetchRubric();
  }, [selectedRoundId, selectedTeamTrackId]);

  // Fetch score override details when selected team or judge changes
  useEffect(() => {
    if (!selectedTeam || !selectedRoundId || !selectedJudgeId) {
      setOverrideScores({});
      setOverrideComment("");
      return;
    }
    fetchJudgeScoresForTeam();
  }, [selectedTeam, selectedJudgeId, selectedRoundId]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const eventPriority: Record<string, number> = {
        ongoing: 0,
        prepare: 1,
        registration: 2,
        draft: 3,
        completed: 4,
        cancelled: 5,
      };
      const sortedEvents = [...res.data].sort(
        (a: any, b: any) => (eventPriority[a.status] ?? 99) - (eventPriority[b.status] ?? 99),
      );
      setEvents(sortedEvents);

      const activeEvent = sortedEvents.find(
        (event: any) => event.status === "ongoing" && !event.isArchived,
      );
      const upcomingEvent = sortedEvents.find(
        (event: any) => ["prepare", "registration"].includes(event.status) && !event.isArchived,
      );
      setSelectedEventId(activeEvent?._id || upcomingEvent?._id || "");
    } catch (err) {
      toast.error("Không thể tải danh sách cuộc thi");
    }
  };

  const fetchEventDetails = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEventId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setRounds(res.data.rounds || []);
      if (res.data.rounds && res.data.rounds.length > 0) {
        const currentRound = res.data.rounds.find(
          (round: any) => ["active", "scoring"].includes(round.status),
        );
        const upcomingRound = res.data.rounds.find(
          (round: any) => round.status === "pending",
        );
        setSelectedRoundId(currentRound?._id || upcomingRound?._id || "");
      } else {
        setSelectedRoundId("");
      }
    } catch (err) {
      toast.error("Không thể tải chi tiết cuộc thi");
    }
  };

  const fetchJudges = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEventId}/roles`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const judgeRoles = res.data.filter(
        (r: any) => r.role === "judge" && r.userId,
      );
      setJudges(judgeRoles.map((r: any) => r.userId));
      if (judgeRoles.length > 0) {
        setSelectedJudgeId(judgeRoles[0].userId._id);
      }
    } catch (err) {
      toast.error("Không thể tải danh sách giám khảo");
    }
  };

  const fetchLiveRankings = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/grades/live-ranking/${selectedRoundId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setTeams(res.data.standings || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRubric = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/rubrics/round/${selectedRoundId}`,
        {
          params: { trackId: selectedTeamTrackId || undefined },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.data && res.data.rubric) {
        const activeRubric = res.data.rubric;
        setRubric(activeRubric);
        setCriteria(res.data.criteria || []);
      } else {
        setRubric(null);
        setCriteria([]);
      }
    } catch (err) {
      console.error("Fetch Rubric Error:", err);
      setRubric(null);
      setCriteria([]);
    }
  };

  const fetchJudgeScoresForTeam = async () => {
    if (!selectedTeam || !selectedRoundId) {
      setScoreAccessState({ canSubmit: true, reason: "", existingScores: [], history: [] });
      setAssistAccess({ allowed: false, status: "not_requested", autoGrantAvailable: false, gradingEndTime: null });
      return;
    }

    try {
      const res = await axios.get(
        `http://localhost:5000/api/grades/team/${selectedTeam.teamId._id}/round/${selectedRoundId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const normalizedScores = Array.isArray(res.data.scores)
        ? res.data.scores
        : Array.isArray(res.data.judgesScores)
          ? res.data.judgesScores
          : [];

      const selectedJudgeHasScore = selectedJudgeId
        ? normalizedScores.some((entry: any) => {
            const judge = entry.judge || entry.judgeId || entry.judgeId?._id || entry.judge?._id;
            const judgeId = judge?._id ? judge._id.toString() : judge?._id?.toString() || judge?.toString();
            return judgeId === selectedJudgeId;
          })
        : false;
      const selectedJudgeScore = selectedJudgeId
        ? normalizedScores.find((entry: any) => {
            const judge = entry.judge || entry.judgeId;
            const judgeId = judge?._id?.toString() || judge?.toString();
            return judgeId === selectedJudgeId;
          })
        : null;
      const hasExistingScore = Boolean(res.data.score || selectedJudgeHasScore);

      if (selectedJudgeScore) {
        const scoresByCriterion = (selectedJudgeScore.details || []).reduce(
          (scores: Record<string, number>, detail: any) => {
            const criterionId = detail.criterionId?._id?.toString()
              || detail.criterionId?.toString();
            if (criterionId) scores[criterionId] = detail.scoreValue;
            return scores;
          },
          {},
        );
        setOverrideScores(scoresByCriterion);
        setOverrideComment(selectedJudgeScore.score?.overallComment || "");
      } else {
        setOverrideScores({});
        setOverrideComment("");
      }
      setScoreAccessState((prev) => ({
        ...prev,
        canSubmit: !hasExistingScore,
        reason: hasExistingScore
          ? ""
          : "",
        existingScores: normalizedScores,
      }));

      if (selectedJudgeId) {
        const assistRes = await axios.get(
          "http://localhost:5000/api/grades/assist/status",
          {
            params: {
              teamId: selectedTeam.teamId._id,
              roundId: selectedRoundId,
              judgeId: selectedJudgeId,
            },
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setAssistAccess({
          allowed: Boolean(assistRes.data.allowed),
          status: assistRes.data.status || "not_requested",
          autoGrantAvailable: Boolean(assistRes.data.autoGrantAvailable),
          gradingEndTime: assistRes.data.gradingEndTime || null,
        });
      }

      const historyRes = await axios.get(
        `http://localhost:5000/api/grades/team/${selectedTeam.teamId._id}/round/${selectedRoundId}/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setScoreAccessState((prev) => ({
        ...prev,
        history: historyRes.data.history || [],
      }));
    } catch (err) {
      console.error("Error fetching judge scores for team", err);
    }
  };

  const handleAssistAction = async (action: "remind" | "request") => {
    if (!selectedTeam || !selectedRoundId || !selectedJudgeId) {
      toast.error("Vui lòng chọn đội thi và giám khảo.");
      return;
    }
    try {
      setIsAssistActionLoading(true);
      const response = await axios.post(
        `http://localhost:5000/api/grades/assist/${action}`,
        {
          teamId: selectedTeam.teamId._id,
          roundId: selectedRoundId,
          judgeId: selectedJudgeId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message);
      await fetchJudgeScoresForTeam();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể gửi yêu cầu đến giám khảo.");
    } finally {
      setIsAssistActionLoading(false);
    }
  };

  const handleHighlightTeam = (teamId: string) => {
    if (!socketRef.current) return;

    if (highlightedTeamId === teamId) {
      // Toggle off highlight
      socketRef.current.emit("coordinator_select_team", {
        eventId: selectedEventId,
        teamId: null,
        roundId: selectedRoundId,
      });
      setHighlightedTeamId(null);
      toast.success("Đã tắt highlight đội thi");
    } else {
      // Highlight new team
      socketRef.current.emit("coordinator_select_team", {
        eventId: selectedEventId,
        teamId,
        roundId: selectedRoundId,
      });
      setHighlightedTeamId(teamId);
      toast.success(
        `Đang highlight đội thi: ${teams.find((t) => t.teamId._id === teamId)?.teamId.name}`,
      );
    }
  };

  const handleScoreChange = (criterionId: string, val: number) => {
    setOverrideScores((prev) => ({
      ...prev,
      [criterionId]: val,
    }));
  };

  const handleSaveOverride = async () => {
    if (!selectedTeam || !rubric || !selectedJudgeId) {
      toast.error("Vui lòng chọn đầy đủ Đội thi, Giám khảo và Rubric.");
      return;
    }

    if (!scoreAccessState.canSubmit) {
      toast.error(
        scoreAccessState.reason || "Kết quả chấm điểm đã được gửi.",
      );
      return;
    }

    if (!assistAccess.allowed) {
      toast.error("Bạn cần được giám khảo chấp thuận trước khi hỗ trợ chấm điểm.");
      return;
    }

    // Verify all criteria are scored
    const emptyCriteria = criteria.filter(
      (c) => overrideScores[c._id] === undefined,
    );
    if (emptyCriteria.length > 0) {
      toast.error(
        `Vui lòng nhập điểm cho tất cả tiêu chí: ${emptyCriteria.map((c) => c.code).join(", ")}`,
      );
      return;
    }

    setIsSubmittingOverride(true);
    try {
      const details = Object.entries(overrideScores).map(
        ([critId, scoreVal]) => ({
          criterionId: critId,
          scoreValue: scoreVal,
        }),
      );

      await axios.post(
        "http://localhost:5000/api/grades/submit",
        {
          teamId: selectedTeam.teamId._id,
          roundId: selectedRoundId,
          rubricId: rubric._id,
          judgeId: selectedJudgeId, // override judge
          details,
          overallComment: overrideComment,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      toast.success("Đã cập nhật điểm số thành công!");
      fetchLiveRankings(); // reload list rankings
      fetchJudgeScoresForTeam(); // reload detail override form
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật điểm số");
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Group teams by track
  const groupedTeams: {
    [trackId: string]: { trackName: string; items: any[] };
  } = {};
  teams.forEach((item) => {
    const trackId = item.trackId?._id || "unassigned";
    const trackName = item.trackId?.name || "Chưa phân bảng";
    if (!groupedTeams[trackId]) {
      groupedTeams[trackId] = { trackName, items: [] };
    }
    groupedTeams[trackId].items.push(item);
  });

  const rankingTrackEntries = Object.entries(groupedTeams);
  const activeRankingTrack = groupedTeams[selectedRankingTrackId]
    || rankingTrackEntries[0]?.[1];

  useEffect(() => {
    const availableTrackIds = teams.map(
      (item) => item.trackId?._id?.toString() || "unassigned",
    );
    if (!availableTrackIds.includes(selectedRankingTrackId)) {
      setSelectedRankingTrackId(availableTrackIds[0] || "");
    }
  }, [teams, selectedRankingTrackId]);

  const eventOptions = events.map((ev) => ({
    value: ev._id,
    label: `${ev.name} (${ev.semester})`,
  }));

  const roundOptions =
    rounds.length > 0
      ? rounds.map((rd) => ({ value: rd._id, label: rd.name }))
      : [];

  return (
    <div className="space-y-6 font-sans text-slate-300">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm gap-4 relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#F27024]/10 border border-[#F27024]/20 flex items-center justify-center text-[#F27024]">
            <Tv size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-widest font-mono">
              SEAL LIVE CONTROL CENTER
            </h2>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>Đồng bộ và điều khiển chấm điểm thời gian thực</span>
            </p>
          </div>
        </div>

        {/* SELECTORS */}
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto relative z-30">
          {/* Event Selector */}
          <div className="flex flex-col gap-1 w-full sm:w-64">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest">
              Cuộc thi
            </span>
            <CustomSelect
              value={selectedEventId}
              onChange={setSelectedEventId}
              options={eventOptions}
              className="w-full font-sans"
              placeholder="Chọn cuộc thi..."
            />
          </div>

          {/* Round Selector */}
          <div className="flex flex-col gap-1 w-full sm:w-48">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest">
              Vòng thi
            </span>
            <CustomSelect
              value={selectedRoundId}
              onChange={setSelectedRoundId}
              options={roundOptions}
              className="w-full font-sans"
              placeholder="Chọn vòng thi..."
              disabled={rounds.length === 0}
            />
          </div>
        </div>
      </div>

      {/* MAIN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: TEAMS RANKING & SOCKET LOGS (col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* TEAMS CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 font-mono flex items-center gap-2">
                <ListFilter size={16} className="text-[#F27024]" />
                <span>DANH SÁCH ĐỘI & ĐIỂM SỐ LIVE</span>
              </h3>
              <button
                onClick={fetchLiveRankings}
                className="text-[10px] font-mono text-[#F27024] hover:text-[#d95f1f] transition-colors"
              >
                Tải lại
              </button>
            </div>

            <div className="space-y-4">
              {rankingTrackEntries.length > 0 ? (
                <>
                  <div
                    role="tablist"
                    aria-label="Chọn bảng đấu"
                    className="grid grid-cols-1 gap-2 border-b border-slate-200 pb-3 sm:grid-cols-2"
                  >
                    {rankingTrackEntries.map(([trackId, group]) => {
                      const isActive = trackId === selectedRankingTrackId
                        || (!selectedRankingTrackId && trackId === rankingTrackEntries[0]?.[0]);
                      return (
                        <button
                          key={trackId}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => {
                            setSelectedRankingTrackId(trackId);
                            setSelectedTeam(group.items[0] || null);
                          }}
                          className={`min-w-0 rounded-lg border px-3 py-2 text-xs font-bold font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 ${isActive
                            ? "border-[#F27024]/50 bg-[#F27024]/10 text-[#F27024]"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                            }`}
                        >
                          {group.trackName}
                          <span className={`ml-2 rounded px-1.5 py-0.5 text-[9px] ${isActive
                            ? "bg-[#F27024]/15 text-[#F27024]"
                            : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {group.items.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    role="tabpanel"
                    className="space-y-2 max-h-[440px] overflow-y-auto pr-1"
                  >
                    {activeRankingTrack?.items.map((item, idx) => {
                        const isHighlighted =
                          highlightedTeamId === item.teamId._id;
                        const isSelected =
                          selectedTeam?.teamId._id === item.teamId._id;
                        const rank = item.trackRank || idx + 1;
                        return (
                          <button
                            key={item.teamId._id}
                            type="button"
                            onClick={() => setSelectedTeam(item)}
                            aria-pressed={isSelected}
                            className={`relative flex w-full items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 focus:border-[#F27024] ${isSelected
                              ? "bg-[#F27024]/10 border-[#F27024]/50 shadow-sm"
                              : isHighlighted
                                ? "bg-amber-500/10 border-amber-500/40"
                                : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100"
                              }`}
                          >
                            {/* Left glowing marker */}
                            {isHighlighted && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l animate-pulse" />
                            )}

                            <div className="flex items-center gap-3">
                              {/* Rank Badge */}
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold font-mono text-[10px] ${rank === 1
                                  ? "bg-amber-500/15 text-amber-700 border border-amber-500/30"
                                  : rank === 2
                                    ? "bg-slate-200 text-slate-700 border border-slate-300"
                                    : rank === 3
                                      ? "bg-orange-900/10 text-orange-800 border border-orange-900/20"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                              >
                                {rank}
                              </div>

                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs tracking-wide text-slate-800">
                                    {item.teamId.name}
                                  </span>
                                  {isHighlighted && (
                                    <span className="bg-amber-500 text-slate-950 font-black text-[7px] px-1 py-0.5 rounded tracking-widest uppercase animate-pulse">
                                      LIVE
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 block truncate max-w-[200px] mt-0.5 font-sans">
                                  {item.teamId.topicSubmission?.title ||
                                    "Chưa nộp đề tài"}
                                </span>
                              </div>
                            </div>

                            {/* Right: Scores */}
                            <div className="text-right flex items-center gap-4">
                              <div>
                                <span className="text-xs font-mono font-bold text-[#F27024] block">
                                  {item.averageScore > 0
                                    ? `${item.averageScore}đ`
                                    : "--"}
                                </span>
                                <span className="text-[9px] text-slate-500 block font-mono">
                                  {item.judgeCount} Giám khảo
                                </span>
                              </div>
                              <ChevronRight
                                size={14}
                                className="text-slate-400 group-hover:text-[#F27024] transition-colors"
                              />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </>
              ) : (
                <p className="text-center py-8 text-slate-500 font-mono text-xs">
                  Không có đội thi nào được ghi nhận trong bảng này.
                </p>
              )}
            </div>
          </div>

          {/* REAL-TIME EVENT LOGS BLOCK */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 font-mono flex items-center gap-2 pb-2 border-b border-slate-100">
              <Activity size={16} className="text-[#F27024]" />
              <span>LIVE LOGGING (SOCKET)</span>
            </h3>
            <div className="space-y-2.5 max-h-[180px] overflow-y-auto text-[10px] font-mono pr-1">
              {liveLogs.length > 0 ? (
                liveLogs.map((log, lIdx) => (
                  <div
                    key={lIdx}
                    className="flex gap-2 pb-2 border-b border-slate-100 last:border-0 last:pb-0"
                  >
                    <span className="text-slate-400 shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="text-slate-600">{log.details}</span>
                  </div>
                ))
              ) : (
                <p className="text-center py-4 text-slate-400 italic">
                  Chờ các tương tác hoặc cập nhật từ server...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL CONTROL PANEL & SCORE OVERRIDE (col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedTeam ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
              {/* Profile Card */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-850">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[10px] font-bold font-mono uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      ĐỘI THI
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      ID: {selectedTeam.teamId._id}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white tracking-wide">
                    {selectedTeam.teamId.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Đề tài:{" "}
                    {selectedTeam.teamId.topicSubmission?.title ||
                      "Chưa đăng ký đề tài"}
                  </p>
                </div>

                {/* Highlight Controller Button */}
                {!readOnly && (
                  <button
                    onClick={() => handleHighlightTeam(selectedTeam.teamId._id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg ${highlightedTeamId === selectedTeam.teamId._id
                      ? "bg-amber-500 text-slate-950 hover:bg-amber-400 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse"
                      : "bg-slate-900 hover:bg-slate-850 text-amber-500 border border-amber-500/20"
                      }`}
                  >
                    <Sparkles size={14} />
                    <span>
                      {highlightedTeamId === selectedTeam.teamId._id
                        ? "BỎ SPOTLIGHT"
                        : "SPOTLIGHT"}
                    </span>
                  </button>
                )}
              </div>

              {/* LIVE JUDGES SCORES DETAILS CARD */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider font-mono">
                  Chi tiết điểm từ các Giám khảo
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTeam.judges && selectedTeam.judges.length > 0 ? (
                    selectedTeam.judges.map((j: any, jIdx: number) => {
                      const judgeId = (j._id || j.judgeId?._id || j.judgeId)?.toString();
                      const isSelected = judgeId === selectedJudgeId;
                      return (
                      <button
                        key={judgeId || jIdx}
                        type="button"
                        onClick={() => judgeId && setSelectedJudgeId(judgeId)}
                        aria-pressed={isSelected}
                        className={`p-3 rounded-xl border flex justify-between items-center text-xs text-left transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/70 ${isSelected
                          ? "bg-cyan-500/10 border-cyan-500/60 shadow-[0_0_16px_rgba(6,182,212,0.12)]"
                          : "bg-slate-900/30 border-slate-850 hover:border-slate-700 hover:bg-slate-900/60"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className={isSelected ? "text-cyan-400" : "text-slate-500"} />
                          <span className="font-bold text-slate-200">
                            {j.fullName}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-cyan-400 bg-cyan-900/10 border border-cyan-900/20 px-2 py-0.5 rounded">
                          {j.score}đ
                        </span>
                      </button>
                      );
                    })
                  ) : (
                    <p className="col-span-2 text-xs text-slate-500 font-mono italic">
                      Chưa có giám khảo nào hoàn tất và nộp điểm.
                    </p>
                  )}
                </div>
              </div>

              {/* QUICK SCORE EDIT PANEL (OVERRIDE JUDGE SCORE) */}
              <div className="bg-slate-900/20 border border-slate-850 p-5 rounded-2xl space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-850">
                  <div className="flex items-center gap-2">
                    <Edit3 size={16} className="text-cyan-400" />
                    <h4 className="text-xs font-extrabold uppercase text-white tracking-widest font-mono">
                      THEO DÕI & HỖ TRỢ HOÀN TẤT CHẤM ĐIỂM
                    </h4>
                  </div>

                  {/* Select Judge to Override */}
                  <select
                    value={selectedJudgeId}
                    onChange={(e) => setSelectedJudgeId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-350 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none w-48 font-semibold"
                  >
                    {judges.map((jg) => (
                      <option key={jg._id} value={jg._id}>
                        {jg.fullName} ({jg.email.split("@")[0]})
                      </option>
                    ))}
                  </select>
                </div>

                {rubric ? (
                  <div className="space-y-4">
                    {readOnly ? (
                      <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400 font-mono">
                        Chế độ xem: chọn giám khảo để xem chi tiết điểm đã chấm.
                      </p>
                    ) : null}
                    {scoreAccessState.reason ? (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-200">
                        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold uppercase tracking-[0.2em] text-amber-300">
                            Kết quả chấm điểm
                          </p>
                          <p>{scoreAccessState.reason}</p>
                        </div>
                      </div>
                    ) : null}

                    {scoreAccessState.canSubmit && !readOnly && !assistAccess.allowed ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                        <div>
                          <p className="text-xs font-bold text-slate-200">
                            Giám khảo chưa gửi kết quả chấm
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Bạn có thể gửi nhắc nhở hoặc đề nghị giám khảo cho phép hỗ trợ hoàn tất bài chấm.
                          </p>
                        </div>
                        {assistAccess.status === "pending" ? (
                          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                            Đề nghị đã được gửi và đang chờ giám khảo phản hồi.
                          </p>
                        ) : null}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            disabled={isAssistActionLoading}
                            onClick={() => handleAssistAction("remind")}
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50"
                          >
                            <BellRing size={14} />
                            Nhắc hoàn tất chấm điểm
                          </button>
                          <button
                            type="button"
                            disabled={isAssistActionLoading || assistAccess.status === "pending"}
                            onClick={() => handleAssistAction("request")}
                            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:opacity-50"
                          >
                            <UserRoundCheck size={14} />
                            Đề nghị hỗ trợ chấm điểm
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {scoreAccessState.canSubmit && assistAccess.allowed ? (
                      <div className="flex items-start gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-xs text-cyan-200">
                        <UserRoundCheck size={16} className="mt-0.5 shrink-0" />
                        <p>
                          {assistAccess.status === "auto_granted"
                            ? "Thời gian chấm còn không quá 5 phút. Quyền hỗ trợ hoàn tất bài chấm đã được mở tự động."
                            : "Giám khảo đã chấp thuận. Bạn có thể hỗ trợ hoàn tất bài chấm này."}
                        </p>
                      </div>
                    ) : null}

                    {(!scoreAccessState.canSubmit || assistAccess.allowed) && <div className="space-y-4">
                      {/* CRITERIA SCORES OVERRIDE INPUTS */}
                      <div className="space-y-3.5">
                        {criteria.map((c) => {
                          const val = overrideScores[c._id];
                          return (
                            <div
                              key={c._id}
                              className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold font-mono text-[10px] text-cyan-400 bg-cyan-900/10 px-1.5 py-0.5 rounded border border-cyan-900/25">
                                    {c.code}
                                  </span>
                                  <span className="text-xs font-bold text-slate-200">
                                    {c.name}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate max-w-sm">
                                  Trọng số: {c.weight}% | Tối đa: {c.maxScore}đ
                                </p>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <input
                                  type="number"
                                  min={0}
                                  max={c.maxScore}
                                  step={0.5}
                                  value={val !== undefined ? val : ""}
                                  disabled={readOnly || !scoreAccessState.canSubmit || !assistAccess.allowed}
                                  onChange={(e) =>
                                    handleScoreChange(
                                      c._id,
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="bg-slate-900 border border-slate-750 text-slate-200 text-xs px-2 py-1 w-16 text-center rounded-lg font-bold font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:cursor-default disabled:opacity-80"
                                />
                                <span className="text-xs text-slate-500 font-mono">
                                  / {c.maxScore}đ
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">
                          Ý kiến nhận xét tổng quan của giám khảo
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Admin nhập phản hồi bổ sung hoặc nhận xét của giám khảo..."
                          value={overrideComment}
                          disabled={readOnly || !scoreAccessState.canSubmit || !assistAccess.allowed}
                          onChange={(e) => setOverrideComment(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-slate-350 text-xs px-3 py-2 w-full rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-650"
                        />
                      </div>

                      {!readOnly && scoreAccessState.canSubmit && assistAccess.allowed && <button
                        onClick={handleSaveOverride}
                        disabled={isSubmittingOverride}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase py-2.5 rounded-xl tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                      >
                        <Save size={14} />
                        <span>
                          {isSubmittingOverride ? "Đang xử lý..." : "Hoàn tất hỗ trợ chấm điểm"}
                        </span>
                      </button>}
                    </div>}

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <History size={16} className="text-cyan-400" />
                        <h5 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-200">
                          Lịch sử chấm điểm
                        </h5>
                      </div>

                      {scoreAccessState.history.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                          {scoreAccessState.history.map((item: any) => (
                            <div
                              key={item._id}
                              className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-slate-100">
                                  {item.action === "submit_score"
                                    ? "Chấm điểm"
                                    : item.action === "regrade_score"
                                      ? "Điều chỉnh kết quả có kiểm soát"
                                      : "Hành động bị chặn"}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(item.createdAt).toLocaleString("vi-VN")}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {item.summary}
                              </p>
                              <p className="mt-1 text-[10px] text-cyan-300">
                                Người thực hiện: {item.actorId?.fullName || item.actorId?.email || "Hệ thống"}
                              </p>
                              {item.changeDetails?.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-[10px] text-slate-400">
                                  {item.changeDetails.map((detail: any, idx: number) => (
                                    <li key={`${item._id}-${idx}`}>
                                      • {detail.criterionName}: {detail.change?.from ?? "-"} → {detail.change?.to ?? "-"}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center py-4 text-xs text-slate-500 font-mono italic">
                          Chưa có lịch sử chấm điểm cho đội này.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-center py-4 text-xs text-slate-500 font-mono italic">
                    Chưa kích hoạt hoặc chưa khóa Rubric cho vòng thi này. Không
                    thể sửa điểm.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm flex flex-col items-center justify-center space-y-4">
              <Tv size={48} className="text-slate-300" />
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
                  LIVE CONTROL PANEL
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mx-auto leading-relaxed">
                  Chọn một đội thi bất kỳ từ danh sách bên trái để mở trung tâm
                  highlight và cập nhật điểm số live của họ.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
