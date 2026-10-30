import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Search,
  Trophy,
  Users,
  Award,
  Lock,
  BookOpen,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Download,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '../shared/CustomSelect';
import BulkImportScoresModal from '../grading/BulkImportScoresModal';

interface AdminGradesViewProps {
  user?: any;
  roles?: any[];
}

export default function AdminGradesView({ user, roles = [] }: AdminGradesViewProps) {
  const token = localStorage.getItem('token');
  const isAssistant = !user?.isSystemAdmin && (user?.isStudentAssistant || roles?.some((r: any) => r.role === 'student_assistant'));

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rounds, setRounds] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [selectedRoundName, setSelectedRoundName] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [exportingSummary, setExportingSummary] = useState(false);
  const [exportingJudge, setExportingJudge] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [downloadingBulkTemplate, setDownloadingBulkTemplate] = useState(false);

  // Compute active round document based on selectedRoundName
  const selectedRound = rounds.find((r: any) => r.name === selectedRoundName) || null;
  const selectedRoundId = selectedRound ? selectedRound._id : '';

  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Grading details from coordinator viewpoint
  const [gradingsData, setGradingsData] = useState<any>(null);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [errorGrades, setErrorGrades] = useState('');

  const [loadingTeams, setLoadingTeams] = useState(false);

  const [activeJudgeIndex, setActiveJudgeIndex] = useState(0);

  // Reset active judge index when selection changes
  useEffect(() => {
    setActiveJudgeIndex(0);
  }, [selectedTeamId, selectedRoundId]);

  console.log('AdminGradesView State Log:', {
    roundsLength: rounds.length,
    tracksLength: tracks.length,
    selectedRoundName,
    selectedTrackId,
    selectedRoundId,
    selectedRound,
    selectedTeamId
  });

  // Keep selectedTrackId in sync with selectedRoundName
  useEffect(() => {
    if (!selectedRoundName || rounds.length === 0 || tracks.length === 0) {
      setSelectedTrackId('');
      return;
    }

    const matchingRoundIds = rounds
      .filter((r: any) => r.name === selectedRoundName)
      .map((r: any) => r._id.toString());

    const currentTrack = tracks.find((t: any) => t._id === selectedTrackId);
    const currentTrackRoundId = currentTrack ? (currentTrack.roundId?._id || currentTrack.roundId)?.toString() : '';

    if (!currentTrackRoundId || !matchingRoundIds.includes(currentTrackRoundId)) {
      const firstMatchingTrack = tracks.find((t: any) => {
        const tRoundId = (t.roundId?._id || t.roundId)?.toString();
        return matchingRoundIds.includes(tRoundId);
      });
      if (firstMatchingTrack) {
        setSelectedTrackId(firstMatchingTrack._id);
      } else {
        setSelectedTrackId('');
      }
    }
  }, [selectedRoundName, rounds, tracks, selectedTrackId]);

  // Filter tracks to display only those belonging to the selected round name
  const filteredTracksForDropdown = tracks.filter((t: any) => {
    const tRoundId = (t.roundId?._id || t.roundId)?.toString();
    const matchingRounds = rounds.filter((r: any) => r.name === selectedRoundName);
    return matchingRounds.some((r: any) => r._id.toString() === tRoundId);
  });

  const assistantEventId = roles?.find((r: any) => r.role === 'student_assistant')?.eventId;
  const assistantEventIdStr = assistantEventId?._id || assistantEventId;

  // Fetch events on mount
  useEffect(() => {
    axios.get('http://localhost:5000/api/events')
      .then((res: any) => {
        let eventData = res.data;
        if (isAssistant && assistantEventIdStr) {
          eventData = eventData.filter((e: any) => e._id === assistantEventIdStr);
        }
        setEvents(eventData);
        if (eventData.length > 0) {
          setSelectedEventId(eventData[0]._id);
        }
      })
      .catch((err: any) => console.error('Error fetching events:', err));
  }, [isAssistant, assistantEventIdStr]);

  // Fetch event details (tracks & rounds)
  useEffect(() => {
    if (!selectedEventId) return;
    axios.get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res: any) => {
        const fetchedTracks = res.data.tracks || [];
        const fetchedRounds = res.data.rounds || [];
        setTracks(fetchedTracks);
        setRounds(fetchedRounds);

        const uniqueNames = Array.from(new Set(fetchedRounds.map((r: any) => r.name))) as string[];
        if (uniqueNames.length > 0) {
          setSelectedRoundName(uniqueNames[0]);
        } else {
          setSelectedRoundName('');
        }

        if (fetchedTracks.length > 0) {
          setSelectedTrackId(fetchedTracks[0]._id);
        } else {
          setSelectedTrackId('');
        }
      })
      .catch((err: any) => console.error('Error fetching event details:', err));
  }, [selectedEventId]);

  // Fetch teams for the selected event and filter by selected track or round
  useEffect(() => {
    if (!selectedEventId || !selectedRoundId) {
      setTeams([]);
      setSelectedTeamId('');
      setGradingsData(null);
      return;
    }

    // Check if the current round has any tracks
    const matchingRoundIds = rounds
      .filter((r: any) => r.name === selectedRoundName)
      .map((r: any) => r._id.toString());
    const hasTracks = tracks.some((t: any) => {
      const tRoundId = (t.roundId?._id || t.roundId)?.toString();
      return matchingRoundIds.includes(tRoundId);
    });

    if (hasTracks && !selectedTrackId) {
      setTeams([]);
      setSelectedTeamId('');
      setGradingsData(null);
      return;
    }

    setLoadingTeams(true);
    axios.get(`http://localhost:5000/api/teams/all/${selectedEventId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        // Filter confirmed teams matching the selected track or round
        const matchedTeams = res.data.filter((t: any) => {
          if (t.status !== 'confirmed') return false;

          if (hasTracks) {
            const tTrackId = t.trackId && typeof t.trackId === 'object' ? t.trackId._id : t.trackId;
            const currentTrackMatch = String(tTrackId) === String(selectedTrackId);
            const historicalTrackMatch = t.rankings?.some((r: any) => {
              const rTrackId = r.trackId && typeof r.trackId === 'object' ? r.trackId._id : r.trackId;
              return String(rTrackId) === String(selectedTrackId);
            });
            return currentTrackMatch || historicalTrackMatch;
          } else {
            const tRoundId = t.currentRoundId && typeof t.currentRoundId === 'object' ? t.currentRoundId._id : t.currentRoundId;
            const currentRoundMatch = String(tRoundId) === String(selectedRoundId);
            const historicalRoundMatch = t.rankings?.some((r: any) => {
              const rRoundId = r.roundId && typeof r.roundId === 'object' ? r.roundId._id : r.roundId;
              return String(rRoundId) === String(selectedRoundId);
            });
            return currentRoundMatch || historicalRoundMatch;
          }
        });
        setTeams(matchedTeams);
        if (matchedTeams.length > 0) {
          setSelectedTeamId(matchedTeams[0]._id);
        } else {
          setSelectedTeamId('');
          setGradingsData(null);
        }
      })
      .catch((err: any) => console.error('Error fetching teams:', err))
      .finally(() => setLoadingTeams(false));
  }, [selectedEventId, selectedRoundId, selectedTrackId, token, rounds, tracks, selectedRoundName]);

  // Fetch detailed scores for the selected team
  const fetchDetailedScores = useCallback(async (teamId: string, roundId: string) => {
    if (!teamId || !roundId) {
      setGradingsData(null);
      return;
    }
    setLoadingGrades(true);
    setErrorGrades('');
    const selectedTeamObj = teams.find(t => t._id === teamId);
    try {
      const [gradesRes, rubricRes] = await Promise.all([
        axios.get(
          `http://localhost:5000/api/grades/team/${teamId}/round/${roundId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `http://localhost:5000/api/rubrics/round/${roundId}`,
          {
            params: { trackId: selectedTeamObj?.trackId?._id || selectedTeamObj?.trackId || undefined },
            headers: { Authorization: `Bearer ${token}` }
          }
        ).catch(err => {
          console.warn('No active rubric found for this round:', err);
          return { data: { rubric: null, criteria: [] } };
        })
      ]);
      setGradingsData({
        team: selectedTeamObj,
        gradings: gradesRes.data.judgesScores || [],
        criteria: rubricRes.data?.criteria || [],
        rubric: rubricRes.data?.rubric || null
      });
    } catch (err: any) {
      console.error('Error fetching grades:', err);
      setGradingsData(null);
      setErrorGrades(err.response?.data?.message || 'Không thể tải bảng điểm chi tiết.');
    } finally {
      setLoadingGrades(false);
    }
  }, [token, teams]);

  useEffect(() => {
    if (selectedTeamId && selectedRoundId) {
      fetchDetailedScores(selectedTeamId, selectedRoundId);
    } else {
      setGradingsData(null);
    }
  }, [selectedTeamId, selectedRoundId, fetchDetailedScores]);



  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.topicSubmission?.title && t.topicSubmission.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const calculateFinalAverage = () => {
    if (!gradingsData || !gradingsData.gradings || gradingsData.gradings.length === 0) return 0;
    const totalWeightedSum = gradingsData.gradings.reduce((sum: number, g: any) => sum + (g.score?.totalWeightedScore || 0), 0);
    return Math.round((totalWeightedSum / gradingsData.gradings.length) * 100) / 100;
  };

  const handleExportGradingSheet = async (forActiveJudge: boolean) => {
    if (!selectedRoundId) {
      alert("Vui lòng chọn Vòng thi trước khi xuất bảng điểm.");
      return;
    }
    
    let url = `http://localhost:5000/api/grades/export-grading-sheet/${selectedRoundId}`;
    const params: string[] = [];
    
    if (selectedTrackId) {
      params.push(`trackId=${selectedTrackId}`);
    }

    if (forActiveJudge) {
      const activeJudge = gradingsData?.gradings?.[activeJudgeIndex]?.judge;
      if (!activeJudge?._id) {
        alert("Không tìm thấy thông tin Giám khảo đang chọn. Vui lòng chọn Đội thi và Giám khảo tương ứng trước.");
        return;
      }
      params.push(`judgeId=${activeJudge._id}`);
      setExportingJudge(true);
    } else {
      setExportingSummary(true);
    }

    if (params.length > 0) {
      url += `?${params.join("&")}`;
    }

    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      
      const roundName = selectedRoundName.replace(/\s+/g, "_");
      const filename = forActiveJudge 
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
      setExportingSummary(false);
      setExportingJudge(false);
    }
  };

  const handleDownloadBulkTemplate = async () => {
    if (!selectedRoundId || !selectedTrackId) {
      toast.error('Vui lòng chọn Vòng thi và Bảng đấu để tải form mẫu chấm điểm.');
      return;
    }
    const currentTrack = tracks.find((t: any) => t._id === selectedTrackId);
    setDownloadingBulkTemplate(true);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/grades/track/${selectedTrackId}/round/${selectedRoundId}/import-template`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const cleanTrackName = (currentTrack?.name || 'Track').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      const cleanRoundName = (selectedRoundName || 'Round').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      const filename = `Form_Cham_Diem_${cleanTrackName}_${cleanRoundName}.xlsx`;

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã tải về form mẫu chấm điểm của bảng thành công!');
    } catch (err: any) {
      console.error('Download bulk template error:', err);
      toast.error(err.response?.data?.message || 'Lỗi khi tải form mẫu chấm điểm.');
    } finally {
      setDownloadingBulkTemplate(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            <span className="text-cyan-400 text-cyan-glow font-mono-tech">XEM CHI TIẾT ĐIỂM</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Theo dõi chi tiết điểm số của từng giám khảo chấm cho từng đội thi
          </p>
        </div>

        {/* Action & Export Buttons */}
        {!isAssistant && (
          <div className="flex flex-wrap gap-2.5 items-center">
            {/* Download Template Button */}
            <button
              onClick={handleDownloadBulkTemplate}
              disabled={!selectedRoundId || !selectedTrackId || downloadingBulkTemplate}
              className="text-xs font-bold px-3.5 py-2 rounded-xl text-white font-mono transition-all flex items-center justify-center gap-1.5 bg-orange-950/40 hover:bg-orange-950/70 border border-[#F27024]/30 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Tải file Excel mẫu chấm điểm cho toàn bộ đội và toàn bộ giám khảo trong bảng đấu"
            >
              <Download size={14} className="text-[#F27024]" />
              <span>{downloadingBulkTemplate ? "Đang tạo..." : "Tải Form Mẫu Bảng"}</span>
            </button>

            {/* Import Scores Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              disabled={!selectedRoundId || !selectedTrackId}
              className="text-xs font-bold px-3.5 py-2 rounded-xl text-white font-mono transition-all flex items-center justify-center gap-1.5 bg-[#F27024] hover:bg-[#d95d16] border border-[#F27024] shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
              title="Import điểm hàng loạt từ file Excel"
            >
              <Upload size={14} className="text-white" />
              <span>Import Điểm Bảng</span>
            </button>

            <button
              onClick={() => handleExportGradingSheet(false)}
              disabled={!selectedRoundId || exportingSummary}
              className="text-xs font-bold px-3.5 py-2 rounded-xl text-white font-mono transition-all flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 cursor-pointer border border-slate-700/80 shadow-md disabled:opacity-40 disabled:cursor-not-allowed btn-import-export"
            >
              <Download size={14} className="text-cyan-400" />
              <span>{exportingSummary ? "Đang xuất..." : "Xuất Điểm Tổng Hợp"}</span>
            </button>

            <button
              onClick={() => handleExportGradingSheet(true)}
              disabled={!selectedRoundId || exportingJudge || !gradingsData?.gradings?.length}
              className="text-xs font-bold px-3.5 py-2 rounded-xl text-white font-mono transition-all flex items-center justify-center gap-1.5 bg-cyan-950/40 hover:bg-cyan-950/60 cursor-pointer border border-cyan-500/25 shadow-md disabled:opacity-40 disabled:cursor-not-allowed btn-import-export"
            >
              <Download size={14} className="text-cyan-400" />
              <span>{exportingJudge ? "Đang xuất..." : "Xuất Phiếu Điểm GK"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Selectors Event & Round */}
      <div className="glass p-6 rounded-2xl flex flex-wrap gap-4 items-center animate-fadeIn relative z-20">
        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Cuộc thi
          </label>
          <CustomSelect
            value={selectedEventId}
            onChange={(val) => setSelectedEventId(val)}
            disabled={isAssistant}
            options={events.map((e: any) => ({
              value: e._id,
              label: e.name,
            }))}
            className="w-56"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Vòng thi (Round)
          </label>
          <CustomSelect
            value={selectedRoundName}
            onChange={(val) => setSelectedRoundName(val)}
            options={Array.from(new Set(rounds.map((r: any) => r.name))).map((name: any) => ({
              value: name,
              label: name,
            }))}
            placeholder="Không có vòng thi"
            className="w-56"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Bảng đấu (Track)
          </label>
          <CustomSelect
            value={selectedTrackId}
            onChange={(val) => setSelectedTrackId(val)}
            options={filteredTracksForDropdown.map((t: any) => ({
              value: t._id,
              label: t.name,
            }))}
            placeholder="Không có bảng đấu"
            className="w-64"
          />
        </div>
      </div>

      {/* Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Teams Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass p-5 rounded-2xl space-y-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-3">
              <Users size={16} className="text-cyan-400" />
              <span>Danh sách Đội thi ({filteredTeams.length})</span>
            </h2>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Tìm kiếm đội thi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950/80 border border-slate-800 rounded-xl text-xs pl-9 pr-4 py-2 w-full text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {loadingTeams ? (
                <div className="text-center py-10 text-slate-400 text-xs animate-pulse font-mono">[ĐANG TẢI...]</div>
              ) : filteredTeams.length > 0 ? (
                filteredTeams.map((t: any) => (
                  <button
                    key={t._id}
                    onClick={() => setSelectedTeamId(t._id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs flex items-center gap-3 ${selectedTeamId === t._id
                      ? 'bg-cyan-500/10 border-cyan-500/60 shadow-md'
                      : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono ${selectedTeamId === t._id ? 'bg-cyan-500 text-white' : 'bg-slate-850 text-slate-400'
                      }`}>
                      {t.name.charAt(0)}
                    </div>
                    <div className="truncate flex-1">
                      <span className="font-bold block truncate text-slate-900 dark:text-white">{t.name}</span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {t.topicSubmission?.title || 'Chưa đăng ký đề tài'}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs italic">
                  Không tìm thấy đội thi nào phù hợp.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Grading Details View */}
        <div className="lg:col-span-8 space-y-6">
          {loadingGrades ? (
            <div className="glass rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
              <RefreshCw size={32} className="animate-spin text-cyan-500 mb-3" />
              <p className="text-xs">Đang tải chi tiết bảng điểm...</p>
            </div>
          ) : errorGrades ? (
            <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl text-center">
              <p className="text-rose-400 text-xs">{errorGrades}</p>
            </div>
          ) : gradingsData && gradingsData.team ? (
            <div className="space-y-6">

              {/* Solution Summary */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-start flex-wrap gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-md">
                      Thông tin đề tài
                    </span>
                    <h2 className="text-2xl font-black text-white mt-2 uppercase">{gradingsData.team.name}</h2>
                    <p className="text-xs font-semibold text-slate-300 mt-1">Đề tài: {gradingsData.team.topicSubmission?.title || 'Chưa đăng ký'}</p>
                  </div>
                  {gradingsData.team.topicSubmission?.demoUrl && (
                    <a
                      href={gradingsData.team.topicSubmission.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/60 px-4 py-2 rounded-xl transition-all shadow-sm"
                    >
                      <ExternalLink size={14} />
                      <span>Xem Demo</span>
                    </a>
                  )}
                </div>

                {gradingsData.team.topicSubmission?.description && (
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 font-mono">Ý tưởng giải pháp:</p>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{gradingsData.team.topicSubmission.description}</p>
                  </div>
                )}

                {/* Final calculated live average */}
                <div className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/25 p-4 rounded-xl">
                  <Trophy className="text-cyan-400 shrink-0" size={24} />
                  <div>
                    <span className="text-xs font-semibold text-slate-300">Điểm trung bình chung cuộc: </span>
                    <span className="text-lg font-black text-cyan-300 font-mono ml-1">
                      {calculateFinalAverage()} / {(gradingsData.rubric?.maxCriterionScore || 10).toFixed(1)}đ
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Tính toán tự động từ {gradingsData.gradings?.length || 0} giám khảo đã nộp
                    </span>
                  </div>
                </div>
              </div>

              {/* Judges score breakdowns */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Award size={18} className="text-cyan-400" />
                  <span>Chi tiết bảng điểm từ từng Giám khảo</span>
                </h3>

                {gradingsData.gradings && gradingsData.gradings.length > 0 ? (
                  <div className="space-y-6">
                    {/* Judge Tabs */}
                    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
                      {gradingsData.gradings.map((g: any, idx: number) => (
                        <button
                          key={g.score?._id || idx}
                          onClick={() => setActiveJudgeIndex(idx)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${activeJudgeIndex === idx
                            ? 'bg-cyan-500/20 border-cyan-500/60 text-white shadow-md'
                            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/70'
                            }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${activeJudgeIndex === idx ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                          <span>{g.judge?.fullName || `Giám khảo ${idx + 1}`}</span>
                        </button>
                      ))}
                    </div>

                    {/* Selected Judge Card */}
                    {gradingsData.gradings[activeJudgeIndex] && (() => {
                      const g = gradingsData.gradings[activeJudgeIndex];
                      return (
                        <div key={g.score?._id || activeJudgeIndex} className="glass p-6 rounded-3xl space-y-4 border-l-4 border-l-cyan-500 animate-fadeIn">

                          {/* Judge Header */}
                          <div className="flex justify-between items-start gap-4 border-b border-slate-800 pb-3 flex-wrap">
                            <div>
                              <span className="text-xs font-extrabold text-white block">
                                {g.judge?.fullName || 'Giám khảo ẩn danh'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {g.judge?.email}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs text-slate-450 block font-mono">Điểm trung bình:</span>
                              <span className="text-xl font-black text-cyan-400 font-mono">
                                {g.score?.totalWeightedScore || 0}
                              </span>
                              <span className="text-slate-550 text-xs font-bold font-mono"> / {gradingsData.rubric?.maxCriterionScore || 10}đ</span>
                            </div>
                          </div>

                          {/* Criteria Score Breakdown Table */}
                          <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
                            <table className="w-full text-left text-xs border-collapse text-slate-350">
                              <thead>
                                <tr className="bg-slate-900/60 text-slate-450 font-mono text-[9px] font-bold uppercase border-b border-slate-800">
                                  <th className="p-3">Mã</th>
                                  <th className="p-3">Tiêu chí</th>
                                  <th className="p-3 text-center">Trọng số</th>
                                  <th className="p-3 text-center">Điểm số</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850 bg-slate-950/30">
                                {gradingsData.criteria?.map((c: any) => {
                                  const detail = g.details?.find((d: any) => d.criterionId === c._id);
                                  return (
                                    <tr key={c._id} className="hover:bg-slate-900/10">
                                      <td className="p-3 font-mono font-bold text-cyan-400">{c.code}</td>
                                      <td className="p-3">
                                        <p className="font-bold text-slate-200">{c.name}</p>
                                        {detail?.comment && (
                                          <p className="text-[10px] text-slate-450 italic mt-0.5 flex items-center gap-1">
                                            <MessageSquare size={10} className="shrink-0" />
                                            <span>"{detail.comment}"</span>
                                          </p>
                                        )}
                                      </td>
                                      <td className="p-3 text-center font-mono">{c.weight}%</td>
                                      <td className="p-3 text-center font-mono font-bold text-slate-105">
                                        {detail ? detail.scoreValue : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Overall Comment */}
                          {g.score?.overallComment && (
                            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-xs italic text-slate-300 leading-relaxed">
                              " {g.score.overallComment} "
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="glass p-12 text-center text-slate-450 flex flex-col items-center justify-center min-h-[250px]">
                    <Lock size={32} className="text-slate-700 mb-2" />
                    <p className="text-xs italic text-slate-500">Chưa có giám khảo nào hoàn tất nộp điểm cho đội thi này.</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="glass rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
              <BookOpen size={48} className="text-slate-700 mb-3" />
              <p className="font-bold text-md text-slate-300">Vui lòng chọn đội thi</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Chọn một đội thi ở danh sách bên trái để theo dõi chi tiết điểm số phân rã từ ban giám khảo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Import Scores Modal */}
      {isImportModalOpen && selectedRoundId && selectedTrackId && (
        <BulkImportScoresModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          roundId={selectedRoundId}
          roundName={selectedRoundName}
          trackId={selectedTrackId}
          trackName={tracks.find((t: any) => t._id === selectedTrackId)?.name || ''}
          onSuccess={() => {
            // Refresh current team grading or team list
            if (selectedTeamId && selectedRoundId) {
              // Trigger reload
              setSelectedTeamId((prev) => prev);
            }
          }}
        />
      )}

    </div>
  );
}
