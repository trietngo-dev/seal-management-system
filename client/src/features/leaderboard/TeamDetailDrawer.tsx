import { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  Users,
  Award,
  GitBranch,
  ExternalLink,
  ShieldCheck,
  CheckSquare,
  FileText,
  User,
  Crown,
  Loader2,
  Lock,
  Layers,
} from "lucide-react";

interface TeamDetailDrawerProps {
  teamId: string;
  roundId: string;
  roundName?: string;
  roundStatus?: string;
  rankData?: {
    rank?: number;
    displayRank?: number;
    averageScore?: number;
    trackName?: string;
    isAdvanced?: boolean;
    judgeCount?: number;
  };
  isCoordinator: boolean;
  isJudge: boolean;
  onClose: () => void;
}

export default function TeamDetailDrawer({
  teamId,
  roundId,
  roundName,
  roundStatus,
  rankData,
  isCoordinator,
  isJudge,
  onClose,
}: TeamDetailDrawerProps) {
  const token = localStorage.getItem("token");

  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [repository, setRepository] = useState<any>(null);

  const [scoreData, setScoreData] = useState<any>(null);
  const [commits, setCommits] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canSeeDetailedInfo = isCoordinator || isJudge;

  useEffect(() => {
    if (!teamId) return;

    setLoading(true);
    setError("");

    const fetchPromises: Promise<any>[] = [
      axios.get(`http://localhost:5000/api/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ];

    if (canSeeDetailedInfo && roundId) {
      fetchPromises.push(
        axios
          .get(`http://localhost:5000/api/grades/team/${teamId}/round/${roundId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => ({ data: null }))
      );

      fetchPromises.push(
        axios
          .get(`http://localhost:5000/api/analytics/team/${teamId}/commits`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => ({ data: [] }))
      );
    }

    Promise.all(fetchPromises)
      .then(([teamRes, gradeRes, commitRes]) => {
        if (teamRes?.data) {
          setTeam(teamRes.data);
          setMembers(teamRes.data.members || []);
          setRepository(teamRes.data.repository || null);
        }
        if (gradeRes?.data) {
          setScoreData(gradeRes.data);
        }
        if (commitRes?.data) {
          setCommits(commitRes.data || []);
        }
      })
      .catch((err) => {
        console.error("Error fetching team detail:", err);
        setError("Không thể tải thông tin chi tiết đội thi.");
      })
      .finally(() => setLoading(false));
  }, [teamId, roundId, token, canSeeDetailedInfo]);

  const displayRank = rankData?.displayRank ?? rankData?.rank ?? "—";
  const displayScore =
    rankData?.averageScore != null ? rankData.averageScore.toFixed(2) : "—";

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 md:p-5 animate-fade-in font-mono">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Box - Perfectly Balanced Size (w-[90vw] max-w-5xl) */}
      <div className="relative w-[90vw] max-w-5xl bg-[#faf9f6] border border-slate-300 text-slate-800 rounded-3xl shadow-2xl p-6 z-10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-linear-to-r from-orange-400 via-orange-500 to-amber-500" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 font-bold shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight font-mono">
                  {team?.name || "Chi Tiết Đội Thi"}
                </h2>
                {rankData?.isAdvanced && (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    <CheckSquare size={12} /> ĐÃ ĐI TIẾP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-sans">
                Thông tin tổng hợp đội thi trong vòng đấu
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center text-slate-500 gap-2.5 text-xs font-sans">
            <Loader2 size={22} className="animate-spin text-orange-500" />
            <span>Đang tải thông tin đội thi...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 text-xs text-center rounded-xl my-3">
            {error}
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Top Summary Banner - Balanced Horizontal Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
              {/* Round Info */}
              <div className="flex items-center gap-3 border-r border-slate-100 pr-2">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <Layers size={18} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider">
                    Vòng Đấu
                  </span>
                  <span className="text-xs md:text-sm font-extrabold text-slate-800 truncate block">
                    {roundName || rankData?.trackName || "Chưa xác định"}
                  </span>
                  {roundStatus && (
                    <span className="text-[11px] text-slate-500 capitalize block">
                      ({roundStatus === "completed" ? "Đã kết thúc" : roundStatus})
                    </span>
                  )}
                </div>
              </div>

              {/* Track Info */}
              <div className="flex items-center gap-3 border-r border-slate-100 pr-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider">
                    Bảng Đấu
                  </span>
                  <span className="text-xs md:text-sm font-extrabold text-slate-800 truncate block">
                    {rankData?.trackName || team?.trackId?.name || "Chung"}
                  </span>
                </div>
              </div>

              {/* Rank */}
              <div className="flex items-center gap-3 border-r border-slate-100 pr-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Award size={18} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider">
                    Thứ Hạng
                  </span>
                  <span className="text-sm md:text-lg font-black text-amber-600 font-mono-tech">
                    #{displayRank}
                  </span>
                </div>
              </div>

              {/* Score */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider">
                    Điểm TB
                  </span>
                  <span className="text-sm md:text-lg font-black text-emerald-600 font-mono-tech">
                    {displayScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Main Content - Horizontal Multi-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Column 1: Members (4 cols) */}
              <div className="md:col-span-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-3 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5 text-xs md:text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                    <Users size={16} className="text-orange-500" />
                    <span>Thành Viên ({members.length})</span>
                  </div>
                </div>

                <div className="space-y-2.5 flex-1">
                  {members.map((m: any, idx: number) => {
                    const u = m.userId || {};
                    const isLeader = m.role === "leader";

                    return (
                      <div
                        key={m._id || idx}
                        className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-start gap-2.5 text-xs"
                      >
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          {isLeader ? (
                            <Crown size={14} className="text-amber-500" />
                          ) : (
                            <User size={14} className="text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs md:text-sm">
                              {u.fullName || "N/A"}
                            </span>
                            {isLeader && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-md font-bold border border-amber-200">
                                Trưởng đội
                              </span>
                            )}
                          </div>
                          {canSeeDetailedInfo && (
                            <div className="text-xs text-slate-500 space-y-0.5 mt-1 font-sans">
                              {u.studentId && (
                                <div className="font-medium">MSSV: {u.studentId}</div>
                              )}
                              {u.university && (
                                <div className="truncate">Trường: {u.university}</div>
                              )}
                              {u.email && (
                                <div className="truncate text-slate-400 text-[11px]">{u.email}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: Grading Breakdown (5 cols) */}
              <div className="md:col-span-5 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-3 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5 text-xs md:text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                    <FileText size={16} className="text-orange-500" />
                    <span>Chi Tiết Chấm Điểm</span>
                  </div>
                </div>

                {canSeeDetailedInfo ? (
                  isCoordinator && scoreData?.judgesScores ? (
                    <div className="space-y-3 text-xs flex-1 max-h-[320px] overflow-y-auto pr-1">
                      {scoreData.judgesScores.length === 0 ? (
                        <p className="text-slate-400 text-center py-6 text-xs font-sans">
                          Chưa có giám khảo nào nộp điểm.
                        </p>
                      ) : (
                        scoreData.judgesScores.map((js: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1.5"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5 text-xs">
                              <span className="font-bold text-slate-800">
                                GK: {js.judge?.fullName || "Ẩn danh"}
                              </span>
                              <span className="font-black text-orange-600 font-mono-tech text-xs md:text-sm">
                                {js.score?.totalWeightedScore != null
                                  ? js.score.totalWeightedScore.toFixed(2)
                                  : "—"}{" "}
                               / 100đ
                              </span>
                            </div>

                            {js.score?.overallComment && (
                              <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200 font-sans">
                                "{js.score.overallComment}"
                              </p>
                            )}

                            {js.details && js.details.length > 0 && (
                              <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-xs">
                                {js.details.map((d: any, dIdx: number) => (
                                  <div
                                    key={d._id || dIdx}
                                    className="flex justify-between items-center bg-white px-2 py-1 rounded-lg border border-slate-200"
                                  >
                                    <span className="text-slate-500 truncate pr-1">
                                      TC #{dIdx + 1}
                                    </span>
                                    <span className="font-bold text-slate-900 font-mono">
                                      {d.scoreValue ?? d.score ?? "—"}đ
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : isJudge && scoreData?.score ? (
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2.5 text-xs flex-1">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="font-bold text-slate-800 text-xs md:text-sm">
                          Điểm Bạn Đã Chấm
                        </span>
                        <span className="font-black text-orange-600 font-mono-tech text-sm md:text-base">
                          {scoreData.score.totalWeightedScore?.toFixed(2) ?? "—"}đ
                        </span>
                      </div>

                      {scoreData.score.overallComment && (
                        <p className="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200 font-sans">
                          "{scoreData.score.overallComment}"
                        </p>
                      )}

                      {scoreData.details && scoreData.details.length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-xs">
                          {scoreData.details.map((d: any, dIdx: number) => (
                            <div
                              key={d._id || dIdx}
                              className="flex justify-between items-center bg-white px-2 py-1 rounded-lg border border-slate-200"
                            >
                              <span className="text-slate-500">
                                Tiêu chí #{dIdx + 1}
                              </span>
                              <span className="font-bold text-slate-900 font-mono">
                                {d.scoreValue ?? d.score ?? "—"}đ
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-6 text-xs font-sans flex-1">
                      Chưa có bảng điểm chi tiết.
                    </p>
                  )
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5 flex-1 font-sans">
                    <Lock size={18} className="text-slate-400" />
                    <span>
                      Bảng điểm chi tiết theo tiêu chí chỉ dành cho Giám khảo và Điều phối viên.
                    </span>
                  </div>
                )}
              </div>

              {/* Column 3: GitHub Activity & Actions (3 cols) */}
              <div className="md:col-span-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                    <div className="flex items-center gap-1.5 text-xs md:text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                      <GitBranch size={16} className="text-orange-500" />
                      <span>GitHub Activity</span>
                    </div>
                  </div>

                  {canSeeDetailedInfo ? (
                    <div className="space-y-2.5 text-xs">
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                        <span className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                          Tổng Commits
                        </span>
                        <span className="text-lg font-black text-slate-900">
                          {commits.length}
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                        <span className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                          Default Branch
                        </span>
                        <span className="text-xs font-bold text-cyan-700 truncate block">
                          {repository?.defaultBranch || "main"}
                        </span>
                      </div>

                      {repository?.repoUrl ? (
                        <a
                          href={repository.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 w-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 py-2.5 rounded-xl text-xs font-bold transition-all"
                        >
                          <span>Xem Repository</span>
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <div className="text-xs text-slate-400 text-center py-1.5 font-sans">
                          Chưa liên kết Repository
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-center py-4 text-xs font-sans">
                      Thông tin repo ẩn với Participant.
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={onClose}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-xs md:text-sm transition-all cursor-pointer shadow-md shadow-orange-500/10"
                  >
                    Đóng Màn Hình
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
