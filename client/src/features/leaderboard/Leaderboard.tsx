import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  BarChart3,
  CheckSquare,
  Lock,
  RefreshCw,
  Radio,
  Download,
  Upload,
  Trophy,
  Check,
} from "lucide-react";
import CustomSelect from "../shared/CustomSelect";
import TeamDetailDrawer from "./TeamDetailDrawer";
import BulkImportScoresModal from "../grading/BulkImportScoresModal";
import { toast } from "sonner";
import { useConfirm } from "../shared/ConfirmDialog";

export default function Leaderboard({
  user,
  roles = [],
}: {
  user?: any;
  roles?: any[];
}) {
  const token = localStorage.getItem("token");
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const queryEventId = searchParams.get("eventId");
  const queryRoundId = searchParams.get("roundId");

  // Detect user role
  const isSystemAdmin = user?.isSystemAdmin;
  const isSystemCoordinator = isSystemAdmin;
  const isAssistant =
    !isSystemAdmin &&
    (user?.isStudentAssistant ||
      roles?.some((r: any) => r.role === "student_assistant"));
  const assistantEventId = roles?.find(
    (r: any) => r.role === "student_assistant",
  )?.eventId;
  const assistantEventIdStr = assistantEventId?._id || assistantEventId;

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedRound, setSelectedRound] = useState<any>(null);

  const [standings, setStandings] = useState<any[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lockedMessage, setLockedMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<string>("");
  const [selectedTeamForDrawer, setSelectedTeamForDrawer] = useState<any>(null);

  // Awards/Prizes states
  const [awards, setAwards] = useState<any[]>([]);
  const [awardActionLoading, setAwardActionLoading] = useState(false);

  const fetchAwards = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/ctsv/events/${selectedEventId}/awards`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setAwards(res.data || []);
    } catch (err) {
      console.error("Failed to fetch awards:", err);
    }
  }, [selectedEventId, token]);

  const handleConfirmAward = async (prizeId: string, notes?: string) => {
    setAwardActionLoading(true);
    try {
      await axios.put(
        `http://localhost:5000/api/ctsv/events/${selectedEventId}/awards/${prizeId}/confirm`,
        {
          notes,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Xác nhận đã trao giải thưởng thành công!");
      fetchAwards();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Không thể xác nhận trao giải.",
      );
    } finally {
      setAwardActionLoading(false);
    }
  };

  const handleRevokeAward = async (prizeId: string) => {
    const confirmed = await confirm({
      title: "Hủy xác nhận trao giải",
      message:
        "Bạn có chắc chắn muốn hủy trạng thái đã trao của giải thưởng này?",
    });
    if (!confirmed) return;
    setAwardActionLoading(true);
    try {
      await axios.put(
        `http://localhost:5000/api/ctsv/events/${selectedEventId}/awards/${prizeId}/revoke`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("Đã hủy trạng thái trao giải.");
      fetchAwards();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Lỗi khi hủy xác nhận trao giải.",
      );
    } finally {
      setAwardActionLoading(false);
    }
  };

  const [exportingCert, setExportingCert] = useState(false);
  const [sendingEmailCert, setSendingEmailCert] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleExportCertZip = async () => {
    if (!selectedEventId) return;
    setExportingCert(true);
    try {
      toast.info("Đang khởi tạo tệp ZIP chứa bằng khen...");
      const res = await axios.get(
        `http://localhost:5000/api/ctsv/events/${selectedEventId}/awards/export`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Bang_Khen_Event.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Xuất danh sách bằng khen thành công!");
    } catch (err: any) {
      toast.error("Không thể xuất bằng khen dưới dạng ZIP.");
    } finally {
      setExportingCert(false);
    }
  };

  const handleSendCertEmails = async () => {
    if (!selectedEventId) return;
    const confirmed = await confirm({
      title: "Gửi Email Bằng Khen Hàng Loạt",
      message:
        "Hệ thống sẽ tiến hành gửi email đính kèm bằng khen PDF cho tất cả thành viên của các đội đạt giải. Bạn chắc chắn muốn thực hiện?",
    });
    if (!confirmed) return;

    setSendingEmailCert(true);
    try {
      toast.info("Đang gửi email bằng khen...");
      const res = await axios.post(
        `http://localhost:5000/api/ctsv/events/${selectedEventId}/awards/email`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(res.data.message || "Gửi email bằng khen thành công!");
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Lỗi khi gửi email bằng khen.",
      );
    } finally {
      setSendingEmailCert(false);
    }
  };

  const assignRanksWithTies = (list: any[]) => {
    if (!list || list.length === 0) return [];
    const sortedList = [...list].sort(
      (a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0),
    );
    let currentRank = 1;
    return sortedList.map((item, idx) => {
      if (idx > 0) {
        const prevItem = sortedList[idx - 1];
        const scoreDiff = Math.abs(
          (item.averageScore ?? 0) - (prevItem.averageScore ?? 0),
        );
        if (scoreDiff > 0.0001) {
          currentRank = idx + 1;
        }
      }
      return {
        ...item,
        displayRank: currentRank,
      };
    });
  };

  // Detect if coordinator for selectedEvent
  const isCoordinator = isSystemAdmin;

  const isJudge = roles.some(
    (r: any) => r.eventId === selectedEventId && r.role === "judge",
  );

  const roundName = selectedRound?.name || "";
  const isFinalRound =
    roundName.toLowerCase() === "chung kết" ||
    roundName.toLowerCase().includes("chung kết") ||
    roundName.toLowerCase() === "final";

  const standingsByTrack = (() => {
    if (isFinalRound) return [];
    const groups: {
      [trackId: string]: { trackId: string; trackName: string; list: any[] };
    } = {};
    standings.forEach((s: any) => {
      const tId = s.trackId?._id || "unknown";
      const tName = s.trackId?.name || "Bảng đấu chưa xác định";
      if (!groups[tId]) {
        groups[tId] = { trackId: tId, trackName: tName, list: [] };
      }
      groups[tId].list.push(s);
    });
    const result = Object.values(groups);
    result.forEach((g) => {
      g.list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    });
    return result;
  })();

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/events")
      .then((res) => {
        const allEvents = res.data;
        const activeEvents = allEvents.filter((e: any) => e.status !== "draft");

        if (isAssistant && assistantEventIdStr) {
          const assistantEvent = activeEvents.filter(
            (e: any) => e._id === assistantEventIdStr,
          );
          setEvents(assistantEvent);
          if (assistantEvent.length > 0) {
            setSelectedEventId(assistantEvent[0]._id);
          }
        } else if (isSystemCoordinator) {
          // SystemAdmin/Coordinator: can see and choose all public events
          setEvents(activeEvents);
          if (
            queryEventId &&
            activeEvents.some((e: any) => e._id === queryEventId)
          ) {
            setSelectedEventId(queryEventId);
          } else if (activeEvents.length > 0) {
            // Sort by newest
            const sorted = activeEvents.sort(
              (a: any, b: any) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
            setSelectedEventId(sorted[0]._id);
          }
        } else {
          // Participant/Judge/Mentor: only see ongoing, or the queryEventId event they are trying to view
          let visibleEvents = activeEvents.filter(
            (e: any) => e.status === "ongoing",
          );
          if (
            queryEventId &&
            activeEvents.some((e: any) => e._id === queryEventId)
          ) {
            const queryEvent = activeEvents.find(
              (e: any) => e._id === queryEventId,
            );
            if (
              queryEvent &&
              !visibleEvents.some((e: any) => e._id === queryEventId)
            ) {
              visibleEvents.push(queryEvent);
            }
          }

          // Fallback to newest if empty
          if (visibleEvents.length === 0) {
            const sorted = activeEvents.sort(
              (a: any, b: any) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
            visibleEvents = sorted.length > 0 ? [sorted[0]] : [];
          }

          setEvents(visibleEvents);
          if (
            queryEventId &&
            activeEvents.some((e: any) => e._id === queryEventId)
          ) {
            setSelectedEventId(queryEventId);
          } else if (visibleEvents.length > 0) {
            setSelectedEventId(visibleEvents[0]._id);
          }
        }
      })
      .catch((err) => console.error(err));
  }, [isSystemCoordinator, queryEventId, isAssistant, assistantEventIdStr]);

  useEffect(() => {
    if (!selectedEventId) return;
    axios
      .get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res) => {
        setRounds(res.data.rounds || []);
        if (res.data.rounds && res.data.rounds.length > 0) {
          if (
            queryRoundId &&
            res.data.rounds.some((r: any) => r._id === queryRoundId)
          ) {
            setSelectedRoundId(queryRoundId);
            const found = res.data.rounds.find(
              (r: any) => r._id === queryRoundId,
            );
            setSelectedRound(found);
          } else {
            const activeRound = res.data.rounds.find(
              (r: any) => r.status === "active",
            );
            if (activeRound) {
              setSelectedRoundId(activeRound._id);
              setSelectedRound(activeRound);
            } else {
              const completedRounds = res.data.rounds.filter(
                (r: any) => r.status === "completed",
              );
              if (completedRounds.length > 0) {
                const lastCompleted = completedRounds.sort(
                  (a: any, b: any) => b.order - a.order,
                )[0];
                setSelectedRoundId(lastCompleted._id);
                setSelectedRound(lastCompleted);
              } else {
                setSelectedRoundId(res.data.rounds[0]._id);
                setSelectedRound(res.data.rounds[0]);
              }
            }
          }
        } else {
          setSelectedRoundId("");
          setSelectedRound(null);
        }
      })
      .catch((err) => console.error(err));
  }, [selectedEventId, queryRoundId]);

  const fetchRankings = useCallback(async () => {
    if (!selectedRoundId) {
      setStandings([]);
      return;
    }
    setLoading(true);
    try {
      if (isCoordinator && selectedRound?.status !== "completed") {
        // Coordinator: use live-ranking for real-time view
        const res = await axios.get(
          `http://localhost:5000/api/grades/live-ranking/${selectedRoundId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setStandings(res.data.standings || []);
        setIsLive(res.data.isLive || true);
        setIsLocked(false);
        setLockedMessage("");
      } else {
        // Non-coordinator or completed round: use normal leaderboard
        const res = await axios.get(
          `http://localhost:5000/api/grades/leaderboard/${selectedRoundId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.data.locked) {
          setIsLocked(true);
          setLockedMessage(res.data.message || "");
          setStandings([]);
        } else {
          setIsLocked(false);
          setLockedMessage("");
          setStandings(res.data.standings || []);
        }
        setIsLive(false);
      }
    } catch (err) {
      console.error(err);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRoundId, isCoordinator, token, selectedRound]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  useEffect(() => {
    if (selectedEventId) {
      fetchAwards();
    }
  }, [selectedEventId, fetchAwards]);

  useEffect(() => {
    if (standingsByTrack && standingsByTrack.length > 0) {
      const exists = standingsByTrack.some(
        (g: any) => g.trackId === activeTrackId,
      );
      if (!exists || !activeTrackId) {
        setActiveTrackId(standingsByTrack[0].trackId);
      }
    }
  }, [standingsByTrack, activeTrackId]);

  // Auto-refresh every 30s for coordinator (real-time) when the tab is active
  useEffect(() => {
    if (!isCoordinator || !selectedRoundId) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchRankings();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isCoordinator, selectedRoundId, fetchRankings]);

  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    const round = rounds.find((r: any) => r._id === roundId);
    setSelectedRound(round || null);
    setActiveTrackId("");
  };

  const handleExportGradingSheet = async (forJudgeOnly: boolean) => {
    if (!selectedRoundId) {
      alert("Vui lòng chọn Vòng thi trước khi xuất bảng điểm.");
      return;
    }
    setExporting(true);

    let url = `http://localhost:5000/api/grades/export-grading-sheet/${selectedRoundId}`;
    if (forJudgeOnly && user?._id) {
      url += `?judgeId=${user._id}`;
    }

    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      const roundName = selectedRound?.name?.replace(/\s+/g, "_") || "Round";
      const filename = forJudgeOnly
        ? `Grading_Sheet_Judge_${roundName}.xlsx`
        : `Grading_Summary_${roundName}.xlsx`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Export grading sheet error:", err);
      alert("Lỗi khi xuất bảng điểm ra file Excel. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 font-mono">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white">
              <span className="text-cyan-400 text-cyan-glow font-mono-tech">
                BẢNG XẾP HẠNG CHUNG CUỘC
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Thứ hạng của các đội thi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live badge for coordinator */}
          {isCoordinator && isLive && (
            <span className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse">
              <Radio size={12} />
              LIVE — Cập nhật mỗi 30 giây
            </span>
          )}

          {/* Export buttons for Judge / Coordinator */}
          {selectedRoundId && (
            <>
              {isJudge && (
                <button
                  onClick={() => handleExportGradingSheet(true)}
                  disabled={exporting}
                  className="flex items-center gap-1.5 bg-cyan-950/40 hover:bg-cyan-950/60 text-white border border-cyan-500/25 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={12} className="text-cyan-400" />
                  <span>{exporting ? "Đang xuất..." : "Xuất Phiếu Điểm"}</span>
                </button>
              )}

              {isCoordinator && (
                <>
                  {activeTrackId && (
                    <button
                      onClick={() => setIsImportModalOpen(true)}
                      className="flex items-center gap-1.5 bg-primary hover:bg-[#d95d16] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                      title="Import điểm cho toàn bộ đội trong bảng đấu"
                    >
                      <Upload size={12} className="text-white" />
                      <span>Import Điểm Bảng</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleExportGradingSheet(false)}
                    disabled={exporting}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={12} className="text-cyan-400" />
                    <span>
                      {exporting ? "Đang xuất..." : "Xuất Điểm Tổng Hợp"}
                    </span>
                  </button>
                </>
              )}
              {isFinalRound && standings.length > 0 && isAssistant && (
                <>
                  <button
                    onClick={handleExportCertZip}
                    disabled={exportingCert}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Download size={12} className="text-white" />
                    <span>
                      {exportingCert
                        ? "Đang xuất ZIP..."
                        : "Xuất ZIP Bằng Khen"}
                    </span>
                  </button>

                  <button
                    onClick={handleSendCertEmails}
                    disabled={sendingEmailCert}
                    className="flex items-center gap-1.5 bg-primary hover:bg-[#d95f1f] text-white border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Check size={12} className="text-white" />
                    <span>
                      {sendingEmailCert ? "Đang gửi..." : "Gửi Email Bằng Khen"}
                    </span>
                  </button>
                </>
              )}
            </>
          )}

          {/* Manual refresh for coordinator */}
          {isCoordinator && (
            <button
              onClick={fetchRankings}
              disabled={loading}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Làm mới
            </button>
          )}
        </div>
      </div>

      {/* Selectors */}
      <div className="glass p-6 rounded-2xl flex flex-wrap gap-6 items-center border border-slate-800 hover:border-cyan-500/20 transition-all relative z-20">
        {isSystemCoordinator || events.length > 1 ? (
          <div className="relative z-20">
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
              Cuộc thi
            </label>
            <CustomSelect
              value={selectedEventId}
              onChange={(val) => setSelectedEventId(val)}
              options={events.map((e: any) => ({
                value: e._id,
                label: e.name,
              }))}
              className="w-48"
            />
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1 font-mono tracking-wider">
              Cuộc thi
            </label>
            <span className="text-sm font-extrabold text-cyan-400 uppercase tracking-tight block py-1.5 font-mono">
              {events.find((e) => e._id === selectedEventId)?.name || "---"}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-slate-800"></div>

        <div className="relative z-20">
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Vòng đấu (Round)
          </label>
          <CustomSelect
            value={selectedRoundId}
            onChange={(val) => handleRoundChange(val)}
            options={rounds.map((r: any) => ({
              value: r._id,
              label: r.name,
            }))}
            placeholder="Không có vòng đấu"
            className="w-48"
          />
        </div>

        {/* Round status pill */}
        {selectedRound?.status === "completed" && (
          <div className="ml-2">
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
              Trạng thái vòng
            </label>
            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold">
              <CheckSquare size={12} />
              Đã khóa & Công bố
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass p-6 rounded-3xl border border-slate-800 text-center py-12 text-slate-500 text-xs">
          Đang tải bảng điểm xếp hạng...
        </div>
      ) : isLocked ? (
        /* Locked state for non-coordinator */
        <div className="glass p-6 rounded-3xl relative overflow-hidden border border-slate-800 hover:border-cyan-500/30 transition-all text-center text-slate-500 py-16 z-5">
          <Lock size={36} className="mx-auto text-slate-700 mb-3" />
          <p className="text-sm font-semibold text-slate-400">
            Bảng xếp hạng chưa được công bố
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
            {lockedMessage ||
              "Bảng xếp hạng sẽ tự động hiển thị sau khi ban tổ chức tiến hành chốt khóa điểm thi và xếp hạng cuối cùng."}
          </p>
        </div>
      ) : standings.length > 0 ? (
        isFinalRound ? (
          <div className="glass p-6 rounded-3xl relative overflow-hidden border border-slate-800 hover:border-cyan-500/30 transition-all z-5">
            {/* Coordinator live header */}
            {isCoordinator && isLive && standings.length > 0 && (
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-800">
                <Radio size={14} className="text-rose-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-300">
                  Bảng xếp hạng tạm thời (Live) —{" "}
                  <span className="text-rose-400">{standings.length} đội</span>{" "}
                  — Điểm TB từ{" "}
                  {standings.reduce(
                    (max: number, s: any) => Math.max(max, s.judgeCount),
                    0,
                  )}{" "}
                  giám khảo (tối đa)
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-4 px-4 w-[10%] text-center">Thứ Hạng</th>
                    <th className="py-4 px-4 w-[45%]">Tên Đội Thi</th>
                    <th className="py-4 px-4 w-[15%] text-center">
                      Điểm Trung Bình
                    </th>
                    <th className="py-4 px-4 w-[15%]">Giải Thưởng</th>
                    {isAssistant && (
                      <th className="py-4 px-4 w-[15%] text-center">
                        Đã Trao?
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {assignRanksWithTies(standings).map(
                    (row: any, idx: number) => {
                      const rank = row.displayRank;
                      const rankStyles =
                        rank === 1
                          ? "text-amber-400 bg-amber-500/10"
                          : rank === 2
                            ? "text-slate-300 bg-slate-300/10"
                            : rank === 3
                              ? "text-amber-600 bg-amber-700/10"
                              : "text-slate-400 bg-slate-800/40";

                      const teamId = row.teamId?._id || row.teamId;
                      const teamAward = awards.find(
                        (a: any) =>
                          (a.teamId?._id || a.teamId)?.toString() ===
                          teamId?.toString(),
                      );

                      return (
                        <tr
                          key={row._id || row.teamId?._id || idx}
                          onClick={() =>
                            setSelectedTeamForDrawer({
                              ...row,
                              trackName: "Chung Kết",
                            })
                          }
                          className="border-b border-slate-800/60 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-4 text-center font-black">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${rankStyles}`}
                            >
                              {rank}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-100 text-sm">
                            {row.teamId?.name}
                          </td>
                          <td className="py-4 px-4 text-center font-black text-cyan-400 text-sm font-mono-tech">
                            {row.averageScore != null
                              ? row.averageScore.toFixed(2)
                              : "—"}
                          </td>
                          <td className="py-4 px-4">
                            {teamAward ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                  <Trophy
                                    size={12}
                                    className="text-primary shrink-0"
                                  />
                                  {teamAward.title}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {teamAward.value}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          {isAssistant && (
                            <td
                              className="py-4 px-4 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {teamAward ? (
                                teamAward.disbursementStatus === "delivered" ? (
                                  <button
                                    onClick={() =>
                                      handleRevokeAward(teamAward._id)
                                    }
                                    disabled={awardActionLoading}
                                    className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold rounded-lg cursor-pointer transition-all shrink-0"
                                    title={`Đã trao bởi ${teamAward.disbursedBy?.fullName || "CTSV"} lúc ${new Date(teamAward.disbursedAt).toLocaleString("vi-VN")}. Click để hủy.`}
                                  >
                                    Đã trao ✓
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleConfirmAward(teamAward._id)
                                    }
                                    disabled={awardActionLoading}
                                    className="px-2.5 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold rounded-lg cursor-pointer transition-all shrink-0"
                                  >
                                    Chưa trao
                                  </button>
                                )
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Track Selector Tabs */}
            {standingsByTrack.length > 1 && (
              <div className="flex flex-wrap gap-2 pb-1 relative z-10">
                {standingsByTrack.map((group: any) => (
                  <button
                    key={group.trackId}
                    onClick={() => setActiveTrackId(group.trackId)}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                      activeTrackId === group.trackId
                        ? "bg-cyan-600 border-cyan-500 text-white shadow-md shadow-cyan-600/10"
                        : "bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800"
                    }`}
                  >
                    BẢNG ĐẤU: {group.trackName}
                  </button>
                ))}
              </div>
            )}

            {/* Selected Track Standings Card */}
            {(() => {
              const group =
                standingsByTrack.find(
                  (g: any) => g.trackId === activeTrackId,
                ) || standingsByTrack[0];
              if (!group) return null;

              return (
                <div
                  key={group.trackId}
                  className="glass p-6 rounded-3xl relative overflow-hidden border border-slate-800 hover:border-cyan-500/30 transition-all z-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                      <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">
                        BẢNG ĐẤU:{" "}
                        <span className="text-cyan-400">{group.trackName}</span>
                      </h3>
                    </div>
                    {isCoordinator && isLive && (
                      <span className="flex items-center gap-1 bg-rose-500/10 text-[10px] text-rose-400 px-2 py-0.5 border border-rose-500/20 rounded-md font-bold">
                        <Radio size={10} className="animate-pulse" /> LIVE
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                          <th className="py-4 px-4 w-[12%] text-center">
                            Thứ Hạng
                          </th>
                          <th className="py-4 px-4 w-[53%]">Tên Đội Thi</th>
                          <th className="py-4 px-4 w-[15%] text-center">
                            Điểm Trung Bình
                          </th>
                          <th className="py-4 px-4 w-[20%] text-center">
                            Trạng Thái
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignRanksWithTies(group.list).map(
                          (row: any, idx: number) => {
                            const rank = row.displayRank;
                            const rankStyles =
                              rank === 1
                                ? "text-amber-400 bg-amber-500/10"
                                : rank === 2
                                  ? "text-slate-300 bg-slate-300/10"
                                  : rank === 3
                                    ? "text-amber-600 bg-amber-700/10"
                                    : "text-slate-400 bg-slate-800/40";

                            return (
                              <tr
                                key={row._id || row.teamId?._id || idx}
                                onClick={() =>
                                  setSelectedTeamForDrawer({
                                    ...row,
                                    trackName: group.trackName,
                                  })
                                }
                                className="border-b border-slate-850 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                              >
                                <td className="py-4 px-4 text-center font-black">
                                  <span
                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${rankStyles}`}
                                  >
                                    {rank}
                                  </span>
                                </td>
                                <td className="py-4 px-4 font-bold text-slate-100 text-sm">
                                  {row.teamId?.name}
                                </td>
                                <td className="py-4 px-4 text-center font-black text-cyan-400 text-sm font-mono-tech">
                                  {row.averageScore != null
                                    ? row.averageScore.toFixed(2)
                                    : "—"}
                                </td>
                                <td className="py-4 px-4 text-center">
                                  {selectedRound?.status !==
                                  "completed" ? null : row.isAdvanced ? (
                                    <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md text-[10px] font-bold">
                                      <CheckSquare size={10} /> ĐÃ ĐI TIẾP
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 bg-slate-800 text-slate-500 border border-slate-700 px-2 py-1 rounded-md text-[10px]">
                                      Bị loại
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )
      ) : (
        <div className="glass p-6 rounded-3xl border border-slate-800 text-center py-16 z-5">
          <BarChart3 size={32} className="mx-auto text-slate-700 mb-2" />
          <p className="text-xs">Bảng xếp hạng chưa được công bố.</p>
          <p className="text-[10px] text-slate-600 max-w-sm mx-auto mt-1">
            {isCoordinator
              ? "Chưa có giám khảo nào nộp điểm cho vòng này."
              : "Bảng xếp hạng sẽ tự động hiển thị tại đây sau khi ban tổ chức tiến hành chốt khoá điểm thi và xếp hạng cuối cùng."}
          </p>
        </div>
      )}

      {/* Team Detail Slide-over Drawer */}
      {selectedTeamForDrawer && (
        <TeamDetailDrawer
          teamId={
            selectedTeamForDrawer.teamId?._id || selectedTeamForDrawer.teamId
          }
          roundId={selectedRoundId}
          roundName={selectedRound?.name}
          roundStatus={selectedRound?.status}
          rankData={{
            rank: selectedTeamForDrawer.rank,
            displayRank: selectedTeamForDrawer.displayRank,
            averageScore: selectedTeamForDrawer.averageScore,
            trackName: selectedTeamForDrawer.trackName,
            isAdvanced: selectedTeamForDrawer.isAdvanced,
            judgeCount: selectedTeamForDrawer.judgeCount,
          }}
          isCoordinator={isCoordinator}
          isJudge={isJudge}
          onClose={() => setSelectedTeamForDrawer(null)}
        />
      )}

      {/* Bulk Import Scores Modal */}
      {isImportModalOpen && selectedRoundId && activeTrackId && (
        <BulkImportScoresModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          roundId={selectedRoundId}
          roundName={selectedRound?.name || ''}
          trackId={activeTrackId}
          trackName={standingsByTrack.find((g: any) => g.trackId === activeTrackId)?.trackName || ''}
          onSuccess={() => {
            fetchRankings();
          }}
        />
      )}
    </div>
  );
}
