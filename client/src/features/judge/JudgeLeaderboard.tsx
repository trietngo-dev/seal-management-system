import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Trophy,
  RefreshCw,
  Award,
  Users,
  Search,
  CheckSquare,
  Download
} from "lucide-react";
import CustomSelect from "../shared/CustomSelect";

export default function JudgeLeaderboard() {
  const token = localStorage.getItem("token");

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedRound, setSelectedRound] = useState<any>(null);

  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch events
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/events")
      .then((res) => {
        setEvents(res.data);
        if (res.data.length > 0) setSelectedEventId(res.data[0]._id);
      })
      .catch((err) => console.error(err));
  }, []);

  // Fetch rounds for selected event
  useEffect(() => {
    if (!selectedEventId) return;
    axios
      .get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res) => {
        setRounds(res.data.rounds || []);
        if (res.data.rounds && res.data.rounds.length > 0) {
          setSelectedRoundId(res.data.rounds[0]._id);
          setSelectedRound(res.data.rounds[0]);
        } else {
          setSelectedRoundId("");
          setSelectedRound(null);
        }
      })
      .catch((err) => console.error(err));
  }, [selectedEventId]);

  const fetchRankings = useCallback(async () => {
    if (!selectedRoundId) {
      setStandings([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:5000/api/grades/judge-ranking/${selectedRoundId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStandings(res.data.standings || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching judge rankings:", err);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRoundId, token]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  // Auto-refresh every 30s for active viewing
  useEffect(() => {
    if (!selectedRoundId) return;
    const interval = setInterval(() => {
      fetchRankings();
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedRoundId, fetchRankings]);

  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    const round = rounds.find((r: any) => r._id === roundId);
    setSelectedRound(round || null);
  };

  const handleExportGradingSheet = async () => {
    if (!selectedRoundId) {
      alert("Vui lòng chọn Vòng thi trước khi xuất bảng điểm.");
      return;
    }
    setExporting(true);
    
    // Defaulting to judge's own score sheet (backend resolves the token user automatically!)
    const url = `http://localhost:5000/api/grades/export-grading-sheet/${selectedRoundId}`;

    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      const roundName = selectedRound?.name?.replace(/\s+/g, "_") || "Round";
      link.setAttribute("download", `Grading_Sheet_Judge_${roundName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Export grading sheet error:", err);
      alert("Lỗi khi xuất phiếu điểm ra file Excel. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  const filteredStandings = standings.filter(
    (item) =>
      item.teamId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.teamId?.topicSubmission?.title
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-[#F27024]/50 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-xl text-primary border border-primary/20 shadow-xs">
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-wide">
              Bảng Xếp Hạng
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Xem xếp hạng thời gian thực dựa trên điểm trung bình của Ban giám khảo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
            <Users size={12} />
            Chế độ Giám khảo
          </span>

          {selectedRoundId && (
            <button
              onClick={handleExportGradingSheet}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={12} className="text-primary" />
              <span>{exporting ? "Đang xuất..." : "Xuất Phiếu Điểm"}</span>
            </button>
          )}

          <button
            onClick={fetchRankings}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-150 hover:bg-slate-200 hover:text-slate-900 text-slate-700 border border-slate-350 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Selectors and Search */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between relative z-10">
        <div className="flex flex-wrap gap-4 items-center z-10">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 font-sans">
              Cuộc thi
            </label>
            <CustomSelect
              value={selectedEventId}
              onChange={(val) => setSelectedEventId(val)}
              options={events.map((e: any) => ({
                value: e._id,
                label: e.name,
              }))}
              className="w-56"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 font-sans">
              Vòng đấu
            </label>
            <CustomSelect
              value={selectedRoundId}
              onChange={(val) => handleRoundChange(val)}
              options={rounds.map((r: any) => ({
                value: r._id,
                label: r.name,
              }))}
              placeholder="Không có vòng đấu"
              className="w-56"
            />
          </div>

          {selectedRound?.status === "completed" && (
            <div className="self-end pb-0.5">
              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-250 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                <CheckSquare size={12} />
                Đã khóa & Công bố
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-primary">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm đội, đề tài..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs pl-9 pr-4 py-2 w-full text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#F27024]/30 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Standings Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden relative z-0">
        {lastUpdated && (
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-500 tracking-normal uppercase">
            <span>Danh sách xếp hạng tạm thời (Live)</span>
            <span>Cập nhật lúc: {lastUpdated.toLocaleTimeString("vi-VN")}</span>
          </div>
        )}

        {loading && standings.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            <RefreshCw size={24} className="animate-spin mx-auto text-primary mb-2" />
            Đang tải bảng xếp hạng...
          </div>
        ) : filteredStandings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-250 text-slate-500 uppercase tracking-normal text-xs font-bold bg-slate-50">
                  <th className="py-4 px-6 w-20 text-center">Hạng</th>
                  <th className="py-4 px-6">Tên Đội</th>
                  <th className="py-4 px-6">Đề Tài Dự Án</th>
                  <th className="py-4 px-6 text-center">Số Lượt Chấm</th>
                  <th className="py-4 px-6 text-center">Điểm Trung Bình</th>
                  <th className="py-4 px-6 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredStandings.map((row: any, idx: number) => {
                  const rank = row.rank ?? idx + 1;
                  const rankStyles =
                    rank === 1
                      ? "bg-amber-100 text-amber-800 border-amber-300 shadow-xs"
                      : rank === 2
                        ? "bg-slate-200 text-slate-800 border-slate-350 shadow-xs"
                        : rank === 3
                          ? "bg-orange-100 text-orange-850 border-orange-250 shadow-xs"
                          : "bg-slate-50 text-slate-550 border-slate-200";

                  return (
                    <tr
                      key={row.teamId?._id || idx}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-200"
                    >
                      <td className="py-4 px-6 text-center font-black">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full border font-bold ${rankStyles}`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-800 text-sm block">
                          {row.teamId?.name}
                        </span>
                        <span className="text-[10px] text-slate-450 block mt-0.5">
                          ID: {row.teamId?._id?.slice(-6)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-800 block max-w-xs truncate text-sm">
                          {row.teamId?.topicSubmission?.title || "Chưa nộp đề tài"}
                        </span>
                        <span className="text-xs text-slate-500 block truncate mt-0.5 max-w-xs leading-relaxed">
                          {row.teamId?.topicSubmission?.description || "Không có mô tả chi tiết."}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center text-slate-700 font-medium">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-sm text-xs font-semibold border border-slate-200">
                          {row.judgeCount} Giám khảo
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-primary font-black text-sm">
                          {row.averageScore != null ? row.averageScore.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {selectedRound?.status !== "completed" ? (
                          <span className="inline-flex items-center bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-sm text-xs font-bold tracking-wide uppercase">
                            Đang Đánh Giá
                          </span>
                        ) : row.isAdvanced ? (
                          <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-250 px-2.5 py-0.5 rounded-sm text-xs font-bold uppercase tracking-normal">
                            Đã Đi Tiếp
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-slate-100 text-slate-400 border border-slate-250 px-2 py-0.5 rounded-sm text-xs font-medium uppercase">
                            Dừng Bước
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500 bg-slate-50 border border-slate-250 rounded-2xl">
            <Award size={36} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-bold text-slate-700 uppercase tracking-normal">Không có dữ liệu xếp hạng</p>
            <p className="text-xs text-slate-450 mt-1 max-w-xs mx-auto">
              Không tìm thấy kết quả xếp hạng nào cho vòng đấu hiện tại hoặc chưa có điểm số nào được nộp.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
