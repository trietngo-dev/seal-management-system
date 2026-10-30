import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import {
  Sparkles,
  Save,
  Lock,
  ArrowLeft,
  ExternalLink,
  Activity,
  Code,
  ShieldAlert,
  CheckCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertCircle,
  Terminal,
  BookOpen,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Server,
  Database,
  AlertTriangle,
  Target,
  FlaskConical
} from 'lucide-react';
import { parseImprovementPriority } from './improvementPriority';

export default function JudgeScoring() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryRoundId = searchParams.get('roundId');
  const token = localStorage.getItem('token');

  const [selectedEventId, setSelectedEventId] = useState('');
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [isHighlighted, setIsHighlighted] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const [team, setTeam] = useState<any>(null);
  const [rubric, setRubric] = useState<any>(null);
  const [criteria, setCriteria] = useState<any[]>([]);

  // Commits & AI Insights (for scoring panel)
  const [commits, setCommits] = useState<any[]>([]);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);

  // Main tabs state
  const [activeMainTab, setActiveMainTab] = useState<'scoring' | 'ai_analysis'>('scoring');
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>('');
  const [allAiAnalyses, setAllAiAnalyses] = useState<any[]>([]);
  const [expandedCommitId, setExpandedCommitId] = useState<string | null>(null);
  const [expandedSli, setExpandedSli] = useState<boolean>(false); // for SMB scale details

  // Grade state
  const [scores, setScores] = useState<any>({});
  const [overallComment, setOverallComment] = useState('');
  const [isGraded, setIsGraded] = useState(false);

  // Weighted average, the same formula the server stores as totalWeightedScore
  // (sum of score x weight / sum of weights), so this preview matches the team list and ranking.
  const averageCalc = useMemo(() => {
    let weightedSum = 0;
    let weightedMax = 0;
    let weightTotal = 0;
    let count = 0;
    // A rubric without any weights falls back to equal weighting
    const hasWeights = criteria.some((c: any) => Number(c.weight) > 0);
    criteria.forEach((c: any) => {
      const val = scores[c._id]?.scoreValue;
      if (val !== undefined && val !== null && val !== '') {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          const weight = hasWeights ? Number(c.weight) || 0 : 1;
          weightedSum += num * weight;
          weightedMax += (c.maxScore || 5) * weight;
          weightTotal += weight;
          count++;
        }
      }
    });

    const averageScore = weightTotal > 0 ? (weightedSum / weightTotal).toFixed(2) : '0.00';
    const averageMax = weightTotal > 0 ? (weightedMax / weightTotal).toFixed(1) : '5.0';

    return {
      averageScore,
      averageMax,
      enteredCount: count
    };
  }, [criteria, scores]);

  // Status indicators
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const setMessage = (msg: { type: string; text: string }) => {
    if (msg.text) {
      if (msg.type === 'success') {
        toast.success(msg.text);
      } else if (msg.type === 'error') {
        toast.error(msg.text);
      }
    }
  };

  const currentRound = rounds.find((r: any) => r._id === selectedRoundId);
  const isRoundLocked = currentRound?.status === 'completed';

  // Fetch specific team info & set event context
  useEffect(() => {
    if (!teamId) return;
    axios.get(`http://localhost:5000/api/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        const teamData = res.data.team || res.data;
        if (teamData) {
          setTeam(teamData);
          const evId = teamData.eventId?._id || teamData.eventId;
          if (evId) {
            setSelectedEventId(evId);
          }
        }
      })
      .catch((err: any) => console.error('Error fetching team details:', err));
  }, [teamId, token]);

  // Fetch event details (rounds, tracks)
  useEffect(() => {
    if (!selectedEventId) return;
    axios.get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res: any) => {
        const eventRounds = res.data.rounds || [];
        setRounds(eventRounds);

        // Select the round based on query parameters or fallback to the first round
        if (queryRoundId && eventRounds.some((r: any) => r._id === queryRoundId)) {
          setSelectedRoundId(queryRoundId);
        } else if (eventRounds.length > 0) {
          setSelectedRoundId(eventRounds[0]._id);
        }
      })
      .catch((err: any) => console.error('Error fetching event details:', err));
  }, [selectedEventId, queryRoundId]);

  // Rubric depends on the team's track (track-specific rubric, else the round-wide one)
  const teamTrackId: string | null = team ? (team.trackId?._id || team.trackId || '') : null;

  // Fetch rubric/criteria
  useEffect(() => {
    if (!selectedRoundId || teamTrackId === null) return;

    setRubric(null);
    setCriteria([]);
    setScores({});
    setOverallComment('');

    // Fetch Rubric for round and the team's track
    axios.get(`http://localhost:5000/api/rubrics/round/${selectedRoundId}`, {
      params: { trackId: teamTrackId || undefined },
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        setRubric(res.data.rubric);
        const crits = res.data.criteria || [];
        setCriteria(crits);

        if (crits.length > 0) {
          setSelectedCriterionId(crits[0]._id);
        } else {
          setSelectedCriterionId('summary');
        }

        const initial: any = {};
        crits.forEach((c: any) => {
          initial[c._id] = { scoreValue: '', comment: '' };
        });
        setScores(initial);
      })
      .catch((err: any) => {
        setRubric(null);
        setCriteria([]);
        setSelectedCriterionId('summary');
        console.error('Error fetching rubric:', err);
      });
  }, [selectedRoundId, teamTrackId, token]);

  // Fetch commits & AI reports for active team
  useEffect(() => {
    if (!teamId) return;

    axios.get(`http://localhost:5000/api/analytics/team/${teamId}/commits`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => setCommits(res.data))
      .catch((err: any) => console.error(err));

    axios.get(`http://localhost:5000/api/ai-analyses/team/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        const data = res.data || [];
        setAllAiAnalyses(data);

        const repoReview = data.find((r: any) =>
          (r.analysisType === 'repository_review' || r.analysisType === 'team_aggregate') &&
          ['completed', 'done', 'approved'].includes(r.status)
        );
        const commitReviews = data.filter((r: any) =>
          (r.analysisType === 'commit_review' || r.analysisType === 'per_push') &&
          ['completed', 'done', 'approved'].includes(r.status)
        );
        const questions = repoReview?.result?.suggested_questions_for_team?.length
          ? repoReview.result.suggested_questions_for_team
          : (commitReviews[0]?.result?.suggested_questions_for_team || []);
        setAiQuestions(questions);
      })
      .catch((err: any) => {
        console.error(err);
        setAllAiAnalyses([]);
        setAiQuestions([]);
      });

  }, [teamId, token]);

  // Load existing score
  const fetchExistingScore = useCallback(() => {
    if (!teamId || !selectedRoundId || criteria.length === 0) {
      setOverallComment('');
      setIsGraded(false);
      return;
    }

    axios.get(`http://localhost:5000/api/grades/team/${teamId}/round/${selectedRoundId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        if (res.data && res.data.score) {
          setIsGraded(true);
          setOverallComment(res.data.score.overallComment || '');
          const populated: any = {};
          criteria.forEach((c: any) => {
            populated[c._id] = { scoreValue: '', comment: '' };
          });
          res.data.details.forEach((d: any) => {
            if (populated[d.criterionId]) {
              populated[d.criterionId] = {
                scoreValue: String(d.scoreValue),
                comment: d.comment || ''
              };
            }
          });
          setScores(populated);
        } else {
          setIsGraded(false);
          setOverallComment('');
          const initial: any = {};
          criteria.forEach((c: any) => {
            initial[c._id] = { scoreValue: '', comment: '' };
          });
          setScores(initial);
        }
      })
      .catch((err: any) => {
        console.error('Error fetching existing score:', err);
      });
  }, [teamId, selectedRoundId, criteria, token]);

  useEffect(() => {
    fetchExistingScore();
  }, [fetchExistingScore]);

  // Real-time synchronization for highlighted team
  useEffect(() => {
    if (!selectedEventId || !token || !teamId) return;

    const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
    const socket = io(socketUrl, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_live_room", { eventId: selectedEventId });
    });

    socket.on("team_highlighted", (data: any) => {
      console.log("Team highlighted event received on scoring board:", data);
      if (data.teamId === teamId) {
        setIsHighlighted(true);
        toast.info("Đội thi này đang được chọn để trình bày / chấm điểm bởi Admin!", {
          position: "top-center",
          duration: 5000
        });
      } else {
        setIsHighlighted(false);
      }
    });

    socket.on("score_updated", (data: any) => {
      console.log("Socket Event score_updated on JudgeScoring:", data);
      if (data.teamId === teamId && data.roundId === selectedRoundId) {
        fetchExistingScore();
        toast.info("Điểm số của đội thi này đã được cập nhật/đồng bộ thời gian thực!");
      }
    });

    return () => {
      socket.emit("leave_live_room", { eventId: selectedEventId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedEventId, teamId, selectedRoundId, token, fetchExistingScore]);

  const handleScoreChange = (critId: string, field: string, val: any) => {
    let finalVal = val;

    if (field === 'scoreValue' && val !== '' && val !== null && val !== undefined) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const currentCrit = criteria?.find((item: any) => item._id === critId);
        const maxLimit = currentCrit?.maxScore ?? 5;
        if (num < 0) {
          finalVal = 0;
        } else if (num > maxLimit) {
          finalVal = maxLimit;
        }
      }
    }

    setScores((prev: any) => ({
      ...prev,
      [critId]: {
        ...prev[critId],
        [field]: finalVal
      }
    }));
  };

  const handleGetAiSuggestion = async () => {
    if (!teamId || !selectedRoundId || !rubric) return;
    setAiLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await axios.post(
        'http://localhost:5000/api/grades/suggestion',
        { teamId, roundId: selectedRoundId, rubricId: rubric._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = { ...scores };
      res.data.forEach((item: any) => {
        if (item.criterionId) {
          updated[item.criterionId] = {
            // null = AI did not assess this criterion; leave it blank for the judge
            scoreValue: item.suggestedScore ?? '',
            comment: item.comment
          };
        }
      });
      setScores(updated);
      const analysesResponse = await axios.get(
        `http://localhost:5000/api/ai-analyses/team/${teamId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = analysesResponse.data || [];
      setAllAiAnalyses(data);
      const repoReview = data.find((r: any) =>
        (r.analysisType === 'repository_review' || r.analysisType === 'team_aggregate') &&
        ['completed', 'done', 'approved'].includes(r.status)
      );
      const commitReviews = data.filter((r: any) =>
        (r.analysisType === 'commit_review' || r.analysisType === 'per_push') &&
        ['completed', 'done', 'approved'].includes(r.status)
      );
      const questions = repoReview?.result?.suggested_questions_for_team?.length
        ? repoReview.result.suggested_questions_for_team
        : (commitReviews[0]?.result?.suggested_questions_for_team || []);
      setAiQuestions(questions);
      setOverallComment('Gợi ý AI được tạo từ bằng chứng các đợt push và rubric của vòng đang chọn. Giám khảo cần kiểm tra lại trước khi gửi điểm.');
      setMessage({ type: 'success', text: 'Agent 2 đã phân tích và tạo điểm gợi ý theo rubric của vòng!' });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Không thể tạo gợi ý điểm tự động từ AI.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitScores = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!teamId || !selectedRoundId || !rubric) return;
    setSaving(true);
    setMessage({ type: '', text: '' });

    const details = criteria.map((c: any) => {
      const val = scores[c._id] || {};
      return {
        criterionId: c._id,
        scoreValue: parseFloat(val.scoreValue),
        comment: val.comment || ''
      };
    });

    if (details.some(d => isNaN(d.scoreValue))) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ điểm số cho tất cả tiêu chí.' });
      setSaving(false);
      return;
    }

    try {
      const res = await axios.post(
        'http://localhost:5000/api/grades/submit',
        {
          teamId,
          roundId: selectedRoundId,
          rubricId: rubric._id,
          overallComment,
          details
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsGraded(true);
      setMessage({ type: 'success', text: `Nộp điểm thành công! Tổng điểm: ${res.data.totalWeightedScore}/${rubric ? rubric.maxCriterionScore : 10}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Có lỗi khi nộp điểm.' });
    } finally {
      setSaving(false);
    }
  };

  // Find latest commit review for tech stack / RAG / Agent intelligence cards
  const latestCommitReview = allAiAnalyses.find(
    r => (r.analysisType === 'commit_review' || r.analysisType === 'per_push') &&
      ['completed', 'done', 'approved'].includes(r.status)
  );

  // Find team aggregate review (repository_review or team_aggregate) with fallback
  const teamAggregateReview = allAiAnalyses.find(
    r => (r.analysisType === 'repository_review' || r.analysisType === 'team_aggregate') &&
      ['completed', 'done', 'approved'].includes(r.status) &&
      selectedRoundId &&
      String(r.roundId?._id || r.roundId || '') === String(selectedRoundId)
  ) || allAiAnalyses.find(
    r => (r.analysisType === 'repository_review' || r.analysisType === 'team_aggregate') &&
      ['completed', 'done', 'approved'].includes(r.status) &&
      !r.roundId
  ) || allAiAnalyses.find(
    r => (r.analysisType === 'repository_review' || r.analysisType === 'team_aggregate') &&
      ['completed', 'done', 'approved'].includes(r.status)
  );

  // Filter commit reviews (per-push reviews)
  const commitReviews = allAiAnalyses.filter(
    r => (r.analysisType === 'commit_review' || r.analysisType === 'per_push') &&
      ['completed', 'done', 'approved'].includes(r.status)
  );

  const hardConstraints = teamAggregateReview?.result?.hard_constraints_validation || latestCommitReview?.result?.hard_constraints_validation;

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'FAILED':
        return <XCircle size={16} className="text-rose-500" />;
      case 'WARNING':
        return <AlertCircle size={16} className="text-amber-500" />;
      default:
        return <MinusCircle size={16} className="text-slate-400" />;
    }
  };

  const renderStatusBadge = (status: string) => {
    let classes = "bg-slate-105 text-slate-600 border border-slate-200";
    if (status === 'PASSED') classes = "bg-emerald-50 text-emerald-700 border border-emerald-200";
    if (status === 'FAILED') classes = "bg-rose-50 text-rose-700 border border-rose-200";
    if (status === 'WARNING') classes = "bg-amber-50 text-amber-700 border border-amber-200";

    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${classes}`}>
        {status || 'UNKNOWN'}
      </span>
    );
  };

  if (!team) {
    return (
      <div className="text-center py-20 text-cyan-400 text-xs animate-pulse font-mono">
        [ĐANG TẢI THÔNG TIN ĐỘI THI...]
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      {isHighlighted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between animate-pulse shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-amber-800 uppercase tracking-normal">
                Đội thi đang trình bày / Được chọn chấm
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Ban tổ chức đang tập trung vào đội thi này. Hãy theo dõi và chấm điểm.
              </p>
            </div>
          </div>
          <span className="bg-amber-100 text-amber-850 border border-amber-200 font-bold text-[10px] uppercase px-2.5 py-1 rounded-md tracking-wider">
            Live Focus
          </span>
        </div>
      )}

      {/* Sub-header/Breadcrumb Row */}
      <div className="flex justify-between items-center bg-white border border-slate-200 px-6 py-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/expert/projects')}
            className="text-[#F27024] hover:text-[#d95f1f] text-sm font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Danh sách dự án</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 text-sm font-bold">Chấm điểm đội thi: {team.name}</span>
        </div>

        <div className="flex items-center gap-3">
          {isGraded ? (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
              Đã chấm điểm
            </span>
          ) : (
            <span className="bg-[#F27024]/10 text-[#F27024] border border-[#F27024]/20 px-3 py-1 rounded-full text-xs font-bold">
              Chờ chấm điểm
            </span>
          )}
        </div>
      </div>

      {/* Banner bị loại cảnh báo khẩn cấp */}
      {hardConstraints?.is_disqualified && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 border border-rose-200">
            <ShieldAlert size={26} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-rose-800 uppercase tracking-normal">
              Cảnh báo: Đội thi vi phạm ràng buộc cứng (Bị loại / 0 điểm)
            </h3>
            <p className="text-sm text-rose-750 font-sans leading-relaxed">
              Hệ thống AI tự động phát hiện đội thi vi phạm điều kiện bắt buộc của cuộc thi.
              <strong className="block mt-1.5 bg-white/80 p-2 rounded-xl border border-rose-200 font-sans text-xs">
                Lý do: {hardConstraints.disqualification_reason || "Chưa cập nhật lý do chi tiết."}
              </strong>
            </p>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex gap-4 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveMainTab('scoring')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold relative transition-all ${activeMainTab === 'scoring'
            ? 'text-[#F27024]'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          <Save size={14} />
          <span>Bảng Chấm Điểm</span>
          {activeMainTab === 'scoring' && (
            <div className="absolute bottom-[-5px] left-0 w-full h-[3px] bg-[#F27024] rounded-t"></div>
          )}
        </button>
        <button
          onClick={() => setActiveMainTab('ai_analysis')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold relative transition-all ${activeMainTab === 'ai_analysis'
            ? 'text-[#F27024]'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          <Sparkles size={14} />
          <span>Báo Cáo Phân Tích AI</span>
          {activeMainTab === 'ai_analysis' && (
            <div className="absolute bottom-[-5px] left-0 w-full h-[3px] bg-[#F27024] rounded-t"></div>
          )}
        </button>
      </div>

      {/* Render Main Content depending on Tab */}
      {activeMainTab === 'scoring' ? (
        /* TAB 1: SCORING TAB (Master-Detail layout) */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

          {/* Main Area (12/12): Scoring Master-Detail Container */}
          <div className="xl:col-span-12 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-6">

            {/* Scoring Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] text-[#F27024] font-bold uppercase bg-[#F27024]/10 border border-[#F27024]/20 px-2 py-0.5 rounded-md">
                  Chấm điểm theo Rubric
                </span>
                <h3 className="text-xl font-bold mt-1.5 flex items-center">
                  <span className="text-slate-400 mr-2 font-normal">Đội thi:</span>
                  <span className="text-slate-800 font-extrabold">
                    {team.name}
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-4">
                {/* Dynamic Average Score Badge */}
                {rubric && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 h-12 flex items-center gap-3 shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-normal">Điểm Trung Bình:</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-2xl font-black text-[#F27024] font-mono tracking-tight">{averageCalc.averageScore}</span>
                      <span className="text-xs text-slate-450 font-bold font-mono">/{averageCalc.averageMax}đ</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Inner Master-Detail Layout */}
            {rubric ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[480px]">

                {/* Sidebar menu: list of criteria (col-span-4) */}
                <div className="md:col-span-4 border-r border-slate-100 pr-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-normal mb-2">Tiêu chí</p>
                    {criteria.map((c: any) => {
                      const scoreState = scores[c._id]?.scoreValue;
                      const hasScore = scoreState !== undefined && scoreState !== '';
                      return (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setSelectedCriterionId(c._id)}
                          className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${selectedCriterionId === c._id
                            ? 'bg-[#F27024]/10 border-[#F27024]/30 text-[#F27024]'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                        >
                          <div className="flex flex-col gap-0.5 truncate pr-2">
                            <span className="font-semibold text-slate-550">[{c.code}]</span>
                            <span className="font-bold truncate leading-tight">{c.name}</span>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg font-mono ${hasScore
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-200 text-slate-500 border border-slate-350'
                            }`}>
                            {hasScore ? `${scoreState}đ` : `max ${c.maxScore}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCriterionId('summary')}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${selectedCriterionId === 'summary'
                        ? 'bg-[#F27024]/10 border-[#F27024]/30 text-[#F27024]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold">Tổng kết & Gửi</span>
                        <span className="text-[10px] text-slate-500">Nhập nhận xét tổng quan</span>
                      </div>
                      <Save size={14} className={selectedCriterionId === 'summary' ? 'text-[#F27024]' : 'text-slate-400'} />
                    </button>
                  </div>
                </div>

                {/* Detail pane (col-span-8) */}
                <div className="md:col-span-8 pl-0 md:pl-2 flex flex-col justify-between min-h-[400px]">
                  {selectedCriterionId === 'summary' ? (
                    /* Summary & Submit view */
                    <div className="space-y-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-normal flex items-center gap-1.5">
                            <CheckCircle size={16} className="text-[#F27024]" />
                            <span>Tổng kết điểm đánh giá</span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">Xem lại tóm tắt bảng điểm và nộp kết quả chính thức của bạn.</p>
                        </div>

                        {/* List of current scores */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-normal">Bảng điểm hiện tại:</p>
                          <div className="space-y-2">
                            {criteria.map((c: any) => {
                              const val = scores[c._id]?.scoreValue;
                              const hasScore = val !== undefined && val !== '';
                              return (
                                <div key={c._id} className="flex justify-between items-center text-xs border-b border-slate-200/50 pb-1.5 last:border-0 last:pb-0">
                                  <span className="text-slate-700 font-sans">[{c.code}] {c.name}</span>
                                  <span className="font-bold text-[#F27024] font-mono">
                                    {hasScore ? `${val} / ${c.maxScore}đ` : <span className="text-rose-600 font-normal italic">[Chưa nhập]</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-normal">
                            Ý kiến nhận xét tổng quan (Overall Comment)
                          </label>
                          <textarea
                            placeholder={isRoundLocked ? "Không có nhận xét tổng quan." : "Ý kiến đánh giá thế mạnh, điểm yếu và định hướng phát triển của đội thi..."}
                            rows={5}
                            value={overallComment}
                            onChange={e => setOverallComment(e.target.value)}
                            disabled={isRoundLocked}
                            className="bg-white border border-slate-250 rounded-xl text-slate-700 text-xs sm:text-[13px] px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 focus:border-[#F27024] focus:bg-white disabled:opacity-50 font-sans shadow-inner placeholder-slate-400"
                          ></textarea>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        {!isRoundLocked && (
                          <button
                            type="button"
                            onClick={() => handleSubmitScores()}
                            disabled={saving}
                            className="w-full bg-[#F27024] hover:bg-[#d95f1f] text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 uppercase shadow-sm cursor-pointer"
                          >
                            <Save size={14} />
                            <span>{saving ? 'Đang lưu điểm...' : 'Nộp điểm chính thức'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Individual Criterion grading view */
                    (() => {
                      const c = criteria.find(item => item._id === selectedCriterionId);
                      if (!c) {
                        return (
                          <div className="text-center text-slate-400 py-10 text-xs">
                            [CHỌN MỘT TIÊU CHÍ BÊN TRÁI ĐỂ BẮT ĐẦU CHẤM ĐIỂM]
                          </div>
                        );
                      }

                      const scoreVal = scores[c._id]?.scoreValue || '';
                      const commentVal = scores[c._id]?.comment || '';

                      return (
                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-4">
                            {/* Title & Description */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#F27024] bg-[#F27024]/10 border border-[#F27024]/20 px-1.5 py-0.5 rounded">[{c.code}]</span>
                                <span className="text-sm font-bold text-slate-800 uppercase">{c.name}</span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed font-sans">{c.description || 'Không có mô tả chi tiết.'}</p>
                            </div>

                            {/* Centered Large Score Input Box */}
                            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 my-2">
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max={c.maxScore}
                                  required
                                  placeholder={`0-${c.maxScore}`}
                                  value={scoreVal}
                                  onChange={e => handleScoreChange(c._id, 'scoreValue', e.target.value)}
                                  disabled={isRoundLocked}
                                  style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                                  className="!bg-white bg-white border-2 border-[#F27024]/40 rounded-xl !text-slate-900 text-slate-900 text-center text-lg px-4 py-2 w-32 focus:ring-4 focus:ring-[#F27024]/20 focus:border-[#F27024] focus:outline-none disabled:opacity-50 font-black placeholder-slate-400 font-mono shadow-sm"
                                />
                                <span className="text-lg text-[#F27024] font-black font-mono">/ {c.maxScore}đ</span>
                              </div>
                            </div>

                            {/* Grading Levels Guides */}
                            {c.gradingLevels && c.gradingLevels.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 space-y-1">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-normal">Mức điểm hướng dẫn:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {c.gradingLevels.map((lvl: any, idx: number) => {
                                    const parsedScore = parseFloat(scoreVal);
                                    const isMatched = !isNaN(parsedScore) && parsedScore >= lvl.minScore && parsedScore <= lvl.maxScore;

                                    return (
                                      <div
                                        key={idx}
                                        onClick={() => {
                                          if (!isRoundLocked) {
                                            handleScoreChange(c._id, 'scoreValue', lvl.maxScore);
                                          }
                                        }}
                                        className={`px-3 py-2 rounded-xl border transition-all duration-300 flex flex-col justify-between cursor-pointer text-left ${isMatched
                                          ? 'bg-[#F27024]/10 border-[#F27024]/30 text-[#F27024]'
                                          : 'bg-white border-slate-200 hover:border-slate-350 text-slate-600'
                                          }`}
                                      >
                                        <div className="flex flex-col gap-0.5 text-xs font-bold">
                                          <span className={isMatched ? 'text-[#F27024]' : 'text-slate-800'}>{lvl.label}</span>
                                        </div>
                                        {lvl.description && (
                                          <p className={`text-[11px] mt-1 leading-relaxed font-sans ${isMatched ? 'text-[#F27024]/90' : 'text-slate-500'}`}>{lvl.description}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Comment */}
                            <div className="space-y-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-normal">Nhận xét tiêu chí này</label>
                              <textarea
                                placeholder={isRoundLocked ? "Không có nhận xét." : "Nhập nhận xét cụ thể, lý do chấm điểm và góp ý chi tiết cho tiêu chí này..."}
                                value={commentVal}
                                onChange={e => handleScoreChange(c._id, 'comment', e.target.value)}
                                disabled={isRoundLocked}
                                rows={4}
                                className="bg-white border border-slate-250 rounded-xl text-slate-700 text-xs sm:text-[13px] px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 focus:border-[#F27024] focus:bg-white disabled:opacity-50 shadow-inner placeholder-slate-400 font-sans leading-relaxed resize-y"
                              />
                            </div>
                          </div>

                          {/* Navigation buttons */}
                          <div className="pt-3 border-t border-slate-100 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const currentIndex = criteria.findIndex(item => item._id === c._id);
                                if (currentIndex < criteria.length - 1) {
                                  setSelectedCriterionId(criteria[currentIndex + 1]._id);
                                } else {
                                  setSelectedCriterionId('summary');
                                }
                              }}
                              className="bg-slate-50 hover:bg-slate-100 text-[#F27024] border border-[#F27024]/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 uppercase tracking-normal"
                            >
                              <span>Tiêu chí tiếp theo</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-slate-50 p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[350px] border border-slate-200 shadow-sm rounded-2xl">
                <Lock size={40} className="text-slate-400 mb-3" />
                <p className="font-semibold text-sm text-slate-700">Bảng Rubric chưa sẵn sàng</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  Bảng điểm Rubric của vòng đấu này chưa được cấu hình hoặc chưa khóa chính thức. Giám khảo vui lòng quay lại sau.
                </p>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* TAB 2: AI ANALYSIS TAB (Widescreen layout) */
        <div className="space-y-6">

          {/* Top Row: Tech Stack, RAG Maturity, Agent Intelligence Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Tech Stack Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Server size={14} className="text-[#F27024]" />
                    <span>Tech Stack</span>
                  </span>
                  <span className="bg-[#F27024]/10 text-[#F27024] border border-[#F27024]/20 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    Gemini AI
                  </span>
                </div>

                {latestCommitReview?.result?.tech_stack ? (
                  <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
                    {latestCommitReview.result.tech_stack.frameworks?.length > 0 && (
                      <p className="text-slate-600 font-sans">
                        <strong className="text-slate-800">Frameworks:</strong>{' '}
                        {latestCommitReview.result.tech_stack.frameworks.join(', ')}
                      </p>
                    )}
                    {latestCommitReview.result.tech_stack.llm_models?.length > 0 && (
                      <p className="text-slate-600 font-sans">
                        <strong className="text-slate-800">LLM Models:</strong>{' '}
                        {latestCommitReview.result.tech_stack.llm_models.join(', ')}
                      </p>
                    )}
                    {latestCommitReview.result.tech_stack.vector_db?.length > 0 && (
                      <p className="text-slate-600 font-sans">
                        <strong className="text-slate-800">Vector DB:</strong>{' '}
                        {latestCommitReview.result.tech_stack.vector_db.join(', ')}
                      </p>
                    )}
                    {latestCommitReview.result.tech_stack.agent_frameworks?.length > 0 && (
                      <p className="text-slate-600 font-sans">
                        <strong className="text-slate-800">Agent Frameworks:</strong>{' '}
                        {latestCommitReview.result.tech_stack.agent_frameworks.join(', ')}
                      </p>
                    )}
                    {latestCommitReview.result.tech_stack.third_party_tools?.length > 0 && (
                      <p className="text-slate-600 font-sans">
                        <strong className="text-slate-800">Tools khác:</strong>{' '}
                        {latestCommitReview.result.tech_stack.third_party_tools.join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 italic text-xs flex items-center justify-center gap-1 bg-slate-50 rounded-xl border border-slate-100">
                    <AlertCircle size={12} className="text-slate-400" />
                    <span>Chưa có dữ liệu phân tích từ Gemini AI cho tiêu chí này.</span>
                  </div>
                )}
              </div>
            </div>

            {/* RAG Maturity Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Database size={14} className="text-[#F27024]" />
                    <span>RAG Maturity</span>
                  </span>
                  <span className="bg-[#F27024]/10 text-[#F27024] border border-[#F27024]/20 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    Gemini AI
                  </span>
                </div>

                {latestCommitReview?.result?.rag_maturity ? (
                  <div className="space-y-3 text-xs sm:text-sm leading-relaxed">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-bold font-sans">Mức độ hoàn thiện:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase shadow-sm ${latestCommitReview.result.rag_maturity.level === 'Agentic-RAG'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : latestCommitReview.result.rag_maturity.level === 'Advanced'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                        {latestCommitReview.result.rag_maturity.level}
                      </span>
                    </div>

                    {latestCommitReview.result.rag_maturity.features_detected?.length > 0 && (
                      <div className="space-y-1.5">
                        <strong className="text-slate-700 block font-sans">Features phát hiện:</strong>
                        <div className="flex flex-wrap gap-1.5">
                          {latestCommitReview.result.rag_maturity.features_detected.map((f: string, idx: number) => (
                            <span key={idx} className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-xs">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 italic text-xs flex items-center justify-center gap-1 bg-slate-50 rounded-xl border border-slate-100">
                    <AlertCircle size={12} className="text-slate-400" />
                    <span>Chưa có dữ liệu phân tích từ Gemini AI cho tiêu chí này.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Intelligence Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Cpu size={14} className="text-[#F27024]" />
                    <span>Agent Intelligence</span>
                  </span>
                  <span className="bg-[#F27024]/10 text-[#F27024] border border-[#F27024]/20 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    Gemini AI
                  </span>
                </div>

                {latestCommitReview?.result?.agent_intelligence ? (
                  <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
                    <p className="text-slate-600 font-sans">
                      <strong className="text-slate-800">Động cơ suy luận (Reasoning):</strong>{' '}
                      <span className="font-mono text-[#F27024] font-bold">{latestCommitReview.result.agent_intelligence.reasoning_pattern}</span>
                    </p>
                    <p className="text-slate-600 font-sans">
                      <strong className="text-slate-800">File cấu hình Agent:</strong>{' '}
                      <span className="font-sans text-slate-700">{latestCommitReview.result.agent_intelligence.has_agent_config_files ? 'Đã phát hiện' : 'Không có'}</span>
                    </p>

                    {latestCommitReview.result.agent_intelligence.detected_skills?.length > 0 && (
                      <div className="space-y-1.5">
                        <strong className="text-slate-700 block font-sans">Kỹ năng phát hiện (Skills):</strong>
                        <div className="flex flex-wrap gap-1.5">
                          {latestCommitReview.result.agent_intelligence.detected_skills.map((s: string, idx: number) => (
                            <span key={idx} className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-xs">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 italic text-xs flex items-center justify-center gap-1 bg-slate-50 rounded-xl border border-slate-100">
                    <AlertCircle size={12} className="text-slate-400" />
                    <span>Chưa có dữ liệu phân tích từ Gemini AI cho tiêu chí này.</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Bottom Columns: Team Aggregate (Left 8/12) & Q&A Questions (Right 4/12) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

            {/* Left Area (8/12): Team Aggregate Review & Per-push reviews */}
            <div className="xl:col-span-8 space-y-6">

              {/* Card 0: Hard Constraints Validation Card */}
              {hardConstraints && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                        <Activity size={16} className="text-[#F27024]" />
                        <span>Kiểm định Ràng buộc cứng (Hard Constraints)</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Đánh giá tự động tính hợp lệ của giải pháp từ n8n Pipeline</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${hardConstraints.is_disqualified
                      ? "bg-rose-50 text-rose-750 border border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>
                      {hardConstraints.is_disqualified ? "Không Hợp Lệ (0 Điểm)" : "Đạt Yêu Cầu"}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* 1. Kiểm tra thuật toán AI */}
                    {hardConstraints.ai_algorithm_check && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
                        <div className="mt-0.5 shrink-0">
                          {renderStatusIcon(hardConstraints.ai_algorithm_check.status)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">Kiểm tra Thuật toán AI/LLM</span>
                            {renderStatusBadge(hardConstraints.ai_algorithm_check.status)}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans mt-1">
                            {hardConstraints.ai_algorithm_check.details || "Không có dữ liệu chi tiết."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 2. Kiểm tra độ nghiêm trọng & Độ chính xác */}
                    {hardConstraints.severity_accuracy_check && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
                        <div className="mt-0.5 shrink-0">
                          {renderStatusIcon(hardConstraints.severity_accuracy_check.status)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">Kiểm tra Mức độ Nghiêm trọng & Chính xác</span>
                            {renderStatusBadge(hardConstraints.severity_accuracy_check.status)}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans mt-1">
                            {hardConstraints.severity_accuracy_check.details || "Không có dữ liệu chi tiết."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 3. Kiểm tra UX & Thiết bị */}
                    {hardConstraints.ux_and_devices_check && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
                        <div className="mt-0.5 shrink-0">
                          {renderStatusIcon(hardConstraints.ux_and_devices_check.status)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">Kiểm tra Tài liệu API & Bảo mật Key</span>
                            {renderStatusBadge(hardConstraints.ux_and_devices_check.status)}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans mt-1">
                            {hardConstraints.ux_and_devices_check.details || "Không có dữ liệu chi tiết."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Card 1: Team Aggregate Review (repository_review) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="border-b border-slate-100 pb-4 flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                      <Activity size={16} className="text-[#F27024]" />
                      <span>Tổng hợp phân tích & Đánh giá</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Phân tích sâu toàn bộ lịch sử commits và cấu trúc mã nguồn đối chiếu với rubric.</p>
                  </div>
                  {!isRoundLocked && rubric && (
                    <button
                      type="button"
                      onClick={handleGetAiSuggestion}
                      disabled={aiLoading}
                      className="flex items-center gap-1.5 bg-[#F27024]/10 hover:bg-[#F27024]/20 text-[#F27024] border border-[#F27024]/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      <Sparkles size={13} className={aiLoading ? 'animate-spin' : ''} />
                      <span>{aiLoading ? 'AI đang phân tích...' : (teamAggregateReview ? 'Phân tích lại' : 'Chạy Phân Tích AI ')}</span>
                    </button>
                  )}
                </div>

                {teamAggregateReview ? (
                  <div className="space-y-6 text-xs sm:text-sm leading-relaxed">
                    {/* System Identity Banner */}
                    {teamAggregateReview.result.team_system_identity && (
                      <div className="bg-[#F27024]/5 border border-[#F27024]/20 p-4 rounded-xl space-y-2 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[#F27024] font-bold uppercase tracking-normal">Nhận diện Hệ thống & Track</span>
                          <span className="text-[11px] bg-[#F27024]/10 text-[#F27024] font-bold px-2.5 py-0.5 rounded border border-[#F27024]/20">
                            {teamAggregateReview.result.team_system_identity.detected_track || 'Track Auto-detect'}
                          </span>
                        </div>
                        <p className="text-slate-850 font-bold text-xs sm:text-sm">
                          {teamAggregateReview.result.team_system_identity.project_about || teamAggregateReview.result.smb_scale_advisory?.system_identity_recap}
                        </p>
                        {teamAggregateReview.result.team_system_identity.primary_user_value && (
                          <p className="text-slate-600 text-xs italic">
                            <strong>Giá trị người dùng:</strong> {teamAggregateReview.result.team_system_identity.primary_user_value}
                          </p>
                        )}
                        {Array.isArray(teamAggregateReview.result.team_system_identity.target_personas) && teamAggregateReview.result.team_system_identity.target_personas.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                            <strong className="text-slate-700 text-[11px]">Đối tượng phục vụ:</strong>
                            {teamAggregateReview.result.team_system_identity.target_personas.map((p: string, idx: number) => (
                              <span key={idx} className="bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                        {teamAggregateReview.result.team_system_identity.system_boundary && (
                          <p className="text-slate-500 text-[11px] bg-white/70 p-2 rounded-lg border border-slate-200/60 leading-relaxed font-sans">
                            <strong className="text-slate-700">Ranh giới hệ thống:</strong> {teamAggregateReview.result.team_system_identity.system_boundary}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Disqualification Risks */}
                    {Array.isArray(teamAggregateReview.result.disqualification_risks) && teamAggregateReview.result.disqualification_risks.length > 0 && (
                      <div className="bg-rose-50 border border-rose-250 p-4 rounded-xl space-y-2 shadow-sm">
                        <span className="text-xs text-rose-700 font-bold uppercase tracking-normal flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-rose-600" /> Cảnh báo Rủi ro Loại (Disqualification Risks)
                        </span>
                        <ul className="list-disc pl-5 space-y-1 text-rose-800 text-xs font-medium">
                          {teamAggregateReview.result.disqualification_risks.map((item: any, i: number) => {
                            const isObj = typeof item === 'object' && item !== null;
                            const text = isObj
                              ? `${item.risk ? `[${item.risk}] ` : ''}${item.description || item.message || item.detail || JSON.stringify(item)}`
                              : String(item);
                            return <li key={i}>{text}</li>;
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Historical Synthesis */}
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-normal inline-flex items-center gap-1.5 bg-[#F27024] text-white px-3 py-1.5 rounded-lg shadow-sm">
                          <BookOpen size={12} className="text-white" /> Tóm tắt lịch sử phát triển
                        </span>
                        {typeof teamAggregateReview.result.historical_synthesis === 'object' && teamAggregateReview.result.historical_synthesis?.architectural_style && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono">
                            {teamAggregateReview.result.historical_synthesis.architectural_style}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed font-sans shadow-sm text-xs sm:text-sm">
                        {typeof teamAggregateReview.result.historical_synthesis === 'object' && teamAggregateReview.result.historical_synthesis !== null
                          ? teamAggregateReview.result.historical_synthesis.evolution_summary || teamAggregateReview.result.historical_synthesis.current_focus || 'Đã tổng hợp lịch sử phát triển.'
                          : typeof teamAggregateReview.result.overall_picture?.historical_synthesis === 'string'
                            ? teamAggregateReview.result.overall_picture.historical_synthesis
                            : String(teamAggregateReview.result.historical_synthesis || 'Đã tổng hợp lịch sử phát triển.')}
                      </p>

                      {typeof teamAggregateReview.result.historical_synthesis === 'object' && Array.isArray(teamAggregateReview.result.historical_synthesis.major_capabilities_added) && teamAggregateReview.result.historical_synthesis.major_capabilities_added.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-700 block">Tính năng cốt lõi đã thêm:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {teamAggregateReview.result.historical_synthesis.major_capabilities_added.map((cap: string, cIdx: number) => (
                              <span key={cIdx} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                                ✓ {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {typeof teamAggregateReview.result.historical_synthesis === 'object' && Array.isArray(teamAggregateReview.result.historical_synthesis.regressions_or_unresolved_gaps) && teamAggregateReview.result.historical_synthesis.regressions_or_unresolved_gaps.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-rose-700 block">Khoảng trống & Rào cản còn thiếu:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {teamAggregateReview.result.historical_synthesis.regressions_or_unresolved_gaps.map((gap: string, gIdx: number) => (
                              <span key={gIdx} className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
                                ✕ {gap}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Minimum Acceptance Check */}
                    {Array.isArray(teamAggregateReview.result.minimum_acceptance) && teamAggregateReview.result.minimum_acceptance.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-normal inline-flex items-center gap-1.5 bg-[#F27024] text-white px-3 py-1.5 rounded-lg shadow-sm">
                          <CheckCircle2 size={13} className="text-white" /> Kiểm tra Nghiệm thu Tối thiểu ({teamAggregateReview.result.minimum_acceptance.filter((m: any) => m.status === 'pass' || m.status === 'implemented').length}/{teamAggregateReview.result.minimum_acceptance.length} Đạt)
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                          {teamAggregateReview.result.minimum_acceptance.map((m: any, i: number) => {
                            const isPass = m.status === 'pass' || m.status === 'implemented';
                            const isPartial = m.status === 'partial';
                            return (
                              <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-800">{m.requirement}</p>
                                  {m.evidence && <p className="text-slate-500 text-[11px] font-sans">{m.evidence}</p>}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-normal shrink-0 ${isPass ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  isPartial ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                  {m.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Assessment (Advantages, Disadvantages, Potential Errors) */}
                    {teamAggregateReview.result.assessment && (
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-normal inline-flex items-center gap-1.5 bg-[#F27024] text-white px-3 py-1.5 rounded-lg shadow-sm">
                          <Activity size={13} className="text-white" /> Đánh giá Điểm mạnh, Điểm yếu & Lỗi tiềm ẩn (Agent 2)
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 text-slate-700 shadow-sm">
                            <span className="text-xs text-emerald-700 font-bold uppercase tracking-normal flex items-center gap-1">
                              <CheckCircle2 size={13} className="text-emerald-600" /> Ưu điểm giải pháp (Strengths):
                            </span>
                            <p className="text-xs sm:text-sm leading-relaxed">{teamAggregateReview.result.assessment.advantages || 'Không có ghi nhận.'}</p>
                          </div>
                          <div className="space-y-1.5 bg-rose-50/50 p-4 rounded-xl border border-rose-100 text-slate-700 shadow-sm">
                            <span className="text-xs text-rose-700 font-bold uppercase tracking-normal flex items-center gap-1">
                              <XCircle size={13} className="text-rose-600" /> Hạn chế cốt lõi (Weaknesses):
                            </span>
                            <p className="text-xs sm:text-sm leading-relaxed">{teamAggregateReview.result.assessment.disadvantages || 'Không có ghi nhận.'}</p>
                          </div>
                        </div>

                        {teamAggregateReview.result.assessment.potential_errors && (
                          <div className="space-y-1.5 bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 text-slate-700 shadow-sm">
                            <span className="text-xs text-amber-800 font-bold uppercase tracking-normal flex items-center gap-1.5">
                              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                              Các lỗi & Rủi ro có thể phát sinh trong repo (Potential Errors / Failure Modes):
                            </span>
                            <p className="text-xs sm:text-sm leading-relaxed text-amber-950 font-medium">{teamAggregateReview.result.assessment.potential_errors}</p>
                          </div>
                        )}

                        {/* Additional Assessment Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                          {teamAggregateReview.result.assessment.completeness && (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                              <span className="text-[10px] text-slate-500 font-bold uppercase block">Độ hoàn thiện:</span>
                              <span className="font-semibold text-slate-800">{teamAggregateReview.result.assessment.completeness}</span>
                            </div>
                          )}
                          {teamAggregateReview.result.assessment.demo_readiness && (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                              <span className="text-[10px] text-slate-500 font-bold uppercase block">Sẵn sàng Demo:</span>
                              <span className="font-semibold text-slate-800">{teamAggregateReview.result.assessment.demo_readiness}</span>
                            </div>
                          )}
                          {teamAggregateReview.result.assessment.runtime_resilience && (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                              <span className="text-[10px] text-slate-500 font-bold uppercase block">Chống chịu lỗi:</span>
                              <span className="font-semibold text-slate-800">{teamAggregateReview.result.assessment.runtime_resilience}</span>
                            </div>
                          )}
                          {teamAggregateReview.result.assessment.source_structure && (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                              <span className="text-[10px] text-slate-500 font-bold uppercase block">Cấu trúc Code:</span>
                              <span className="font-semibold text-slate-800">{teamAggregateReview.result.assessment.source_structure}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Qualitative criteria review */}
                    {teamAggregateReview.result.criteria_comments && (
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-normal inline-flex items-center gap-1.5 bg-[#F27024] text-white px-3 py-1.5 rounded-lg shadow-sm">
                          <Code size={12} className="text-white" /> Đánh giá theo tiêu chí Rubric (R1/R2)
                        </span>
                        <div className="space-y-3">
                          {Object.entries(teamAggregateReview.result.criteria_comments).map(([key, value]: [string, any], idx: number) => {
                            const displayName = key.replace(/_/g, ' ').toUpperCase();
                            return (
                              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-850 text-xs sm:text-sm">[{key}] {displayName}</span>
                                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase shadow-sm ${value.grade === 'Xuất sắc' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    value.grade === 'Tốt' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                      value.grade === 'Khá' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                        value.grade === 'Trung bình' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                    {value.suggested_score !== undefined ? `${value.suggested_score}đ / 5đ — ` : ''}{value.grade}
                                  </span>
                                </div>
                                {value.comment && (
                                  <p className="text-slate-600 leading-relaxed font-sans text-xs sm:text-sm pl-3 border-l-2 border-[#F27024]/40 mt-2">
                                    {value.comment}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Improvement Priorities */}
                    {Array.isArray(teamAggregateReview.result.improvement_priorities) && teamAggregateReview.result.improvement_priorities.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-normal inline-flex items-center gap-1.5 bg-[#F27024] text-white px-3 py-1.5 rounded-lg shadow-sm">
                          <Target size={13} className="text-white" /> Danh sách Ưu tiên Cải thiện (P0 / P1 / P2)
                        </span>
                        <div className="space-y-2">
                          {teamAggregateReview.result.improvement_priorities.map((item: unknown, i: number) => {
                            const { priority, text } = parseImprovementPriority(item);
                            return (
                              <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2.5 text-xs">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${priority === 'P0' ? 'bg-rose-500 text-white' :
                                  priority === 'P1' ? 'bg-amber-500 text-white' :
                                    'bg-blue-500 text-white'
                                  }`}>
                                  {priority}
                                </span>
                                <p className="text-slate-700 leading-relaxed font-medium">{text}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Suggested Test Cases */}
                    {Array.isArray(teamAggregateReview.result.suggested_test_cases) && teamAggregateReview.result.suggested_test_cases.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-normal inline-flex items-center gap-1.5 bg-[#F27024] text-white px-3 py-1.5 rounded-lg shadow-sm">
                          <FlaskConical size={13} className="text-white" /> Kịch bản Kiểm thử gợi ý cho Giám khảo (Test Cases)
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                          {teamAggregateReview.result.suggested_test_cases.map((tc: any, i: number) => {
                            const isObj = typeof tc === 'object' && tc !== null;
                            return (
                              <div key={i} className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-xs space-y-1.5 shadow-sm">
                                <p className="font-bold text-slate-800 text-xs">{isObj ? tc.test_case_name : `Test Case #${i + 1}`}</p>
                                {isObj ? (
                                  <div className="text-sm text-slate-600 space-y-1 leading-relaxed">
                                    {tc.given && <p><strong className="text-slate-700 font-bold">Given:</strong> {tc.given}</p>}
                                    {tc.when && <p><strong className="text-slate-700 font-bold">When:</strong> {tc.when}</p>}
                                    {tc.then && <p><strong className="text-slate-700 font-bold">Then:</strong> {tc.then}</p>}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-600 leading-relaxed">{tc}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SMB Scale Advisory (Collapsible) */}
                    {teamAggregateReview.result.smb_scale_advisory && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setExpandedSli(!expandedSli)}
                          className="w-full text-left p-4 flex justify-between items-center hover:bg-slate-100/80 transition-colors"
                        >
                          <span className="text-xs sm:text-sm font-bold uppercase tracking-normal inline-flex items-center gap-1.5 bg-[#F27024] text-white px-3 py-1.5 rounded-lg shadow-sm">
                            <Terminal size={12} className="text-white" /> Tư vấn quy mô SMB (SMB Scale Advisory)
                          </span>
                          {expandedSli ? <ChevronUp size={16} className="text-slate-550" /> : <ChevronDown size={16} className="text-slate-550" />}
                        </button>

                        {expandedSli && (
                          <div className="p-4 border-t border-slate-200 space-y-3.5 bg-white leading-relaxed text-xs sm:text-sm text-slate-600">
                            {teamAggregateReview.result.smb_scale_advisory.system_identity_recap && (
                              <p className="text-slate-600"><strong className="text-[#F27024] font-bold">Hệ thống:</strong> {teamAggregateReview.result.smb_scale_advisory.system_identity_recap}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.summary && (
                              <p className="text-slate-600"><strong className="text-[#F27024] font-bold">Tóm tắt:</strong> {teamAggregateReview.result.smb_scale_advisory.summary}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.tech_and_architecture && (
                              <p className="text-slate-600"><strong className="text-[#F27024] font-bold">Kiến trúc khuyên dùng:</strong> {teamAggregateReview.result.smb_scale_advisory.tech_and_architecture}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.cost_for_smb && (
                              <p className="text-slate-600"><strong className="text-[#F27024] font-bold">Ước lượng chi phí API/Hosting:</strong> {teamAggregateReview.result.smb_scale_advisory.cost_for_smb}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.throughput_and_reliability && (
                              <p className="text-slate-600"><strong className="text-[#F27024] font-bold">Độ tin cậy & Băng thông:</strong> {teamAggregateReview.result.smb_scale_advisory.throughput_and_reliability}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.observability_and_operations && (
                              <p className="text-slate-600"><strong className="text-[#F27024] font-bold">Giám sát & Vận hành (Observability):</strong> {teamAggregateReview.result.smb_scale_advisory.observability_and_operations}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.data_and_integrations && (
                              <p className="text-slate-600"><strong className="text-[#F27024] font-bold">Liên kết & Tích hợp:</strong> {teamAggregateReview.result.smb_scale_advisory.data_and_integrations}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Final Summary Callout */}
                    {teamAggregateReview.result.final_summary && (
                      <div className="bg-amber-50/60 border border-amber-250 p-4 rounded-xl space-y-1.5 shadow-sm">
                        <span className="text-xs font-bold text-[#F27024] uppercase tracking-normal flex items-center gap-1.5">
                          <Sparkles size={13} className="text-[#F27024]" /> Tổng kết Đánh giá Toàn diện từ AI
                        </span>
                        <p className="text-slate-700 text-xs sm:text-sm leading-relaxed font-medium">
                          {typeof teamAggregateReview.result.final_summary === 'object'
                            ? JSON.stringify(teamAggregateReview.result.final_summary)
                            : String(teamAggregateReview.result.final_summary)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 italic text-xs flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                      <AlertCircle size={14} className="text-slate-400" />
                      <span>Chưa có dữ liệu phân tích tổng hợp cấp team từ AI cho vòng thi này.</span>
                    </div>
                    {!isRoundLocked && rubric && (
                      <button
                        type="button"
                        onClick={handleGetAiSuggestion}
                        disabled={aiLoading}
                        className="flex items-center gap-1.5 bg-[#F27024] hover:bg-[#d95f1f] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles size={13} className={aiLoading ? 'animate-spin' : ''} />
                        <span>{aiLoading ? 'AI đang phân tích toàn diện...' : 'Chạy AI phân tích source code'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2: Per-push reviews timeline */}
              <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                    <Activity size={16} className="text-[#F27024]" />
                    <span>Lịch sử phân tích Per-push (Từng đợt Commit/Push)</span>
                  </h3>
                </div>

                <div className="space-y-4">
                  {commitReviews.map((r: any, idx: number) => {
                    const commitInfo = r.commitId || {};
                    const isExpanded = expandedCommitId === r._id;
                    const resObj = r.result || {};

                    const isSignificant = resObj.overall_picture?.significant_change === true || resObj.significant_change === true;
                    const githubIssueUrl = resObj.github_issue_url;

                    return (
                      <div key={r._id || idx} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-all shadow-sm">

                        {/* Collapsed Header */}
                        <div
                          onClick={() => setExpandedCommitId(isExpanded ? null : r._id)}
                          className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer select-none"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-[#F27024] font-mono font-bold bg-[#F27024]/10 border border-[#F27024]/20 px-2 py-0.5 rounded">
                                {commitInfo.commitSha ? commitInfo.commitSha.substring(0, 7) : 'push-sync'}
                              </span>
                              <p className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1">{commitInfo.message || resObj.overall_picture?.push_summary}</p>
                            </div>
                            <div className="flex gap-3 text-xs text-slate-500 font-sans mt-1">
                              <span>Tác giả: <strong className="text-[#F27024] font-semibold">@{commitInfo.authorGithubUsername || commitInfo.authorName || 'unknown'}</strong></span>
                              <span>Ngày: {commitInfo.committedAt ? new Date(commitInfo.committedAt).toLocaleString('vi-VN') : new Date(r.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSignificant && (
                              <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded text-xs font-bold uppercase shadow-sm">
                                Thay đổi quan trọng
                              </span>
                            )}
                            {githubIssueUrl && (
                              <a
                                href={githubIssueUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-250 px-2.5 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1 transition-all"
                              >
                                <span>Issue tự động</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                            {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-200 bg-white space-y-4 text-xs sm:text-sm leading-relaxed text-slate-650">
                            {resObj.overall_picture?.push_summary && (
                              <div className="space-y-1.5">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-normal">Tóm tắt thay đổi đợt push:</span>
                                <p className="text-xs sm:text-sm pl-3 border-l-2 border-[#F27024]/40 text-slate-700">{resObj.overall_picture.push_summary}</p>
                              </div>
                            )}

                            {resObj.overall_picture?.current_focus && (
                              <div className="space-y-1.5">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-normal">Tiêu điểm lập trình:</span>
                                <p className="text-xs sm:text-sm pl-3 border-l-2 border-[#F27024]/40 text-slate-700">{resObj.overall_picture.current_focus}</p>
                              </div>
                            )}

                            {resObj.assessment && (
                              <div className="space-y-3 pt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1.5 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-slate-700">
                                    <span className="text-xs text-emerald-700 font-bold uppercase tracking-normal">Ưu điểm thiết kế:</span>
                                    <p className="text-xs sm:text-sm leading-relaxed">{resObj.assessment.advantages || 'Không có.'}</p>
                                  </div>
                                  <div className="space-y-1.5 bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-slate-700">
                                    <span className="text-xs text-rose-700 font-bold uppercase tracking-normal">Hạn chế & Rủi ro:</span>
                                    <p className="text-xs sm:text-sm leading-relaxed">{resObj.assessment.disadvantages || 'Không có.'}</p>
                                  </div>
                                </div>

                                {resObj.assessment.potential_errors && (
                                  <div className="space-y-1.5 bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 text-slate-700">
                                    <span className="text-xs text-amber-800 font-bold uppercase tracking-normal flex items-center gap-1.5">
                                      <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                                      Các lỗi & Rủi ro có thể xảy ra trong repo:
                                    </span>
                                    <p className="text-xs sm:text-sm leading-relaxed text-amber-950/90">{resObj.assessment.potential_errors}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {resObj.assessment?.security && resObj.assessment?.security !== 'Không phát hiện lỗi bảo mật nghiêm trọng trong đợt commit này.' && (
                              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-xs sm:text-sm text-rose-700 flex items-start gap-2">
                                <ShieldAlert size={14} className="shrink-0 text-rose-600 mt-0.5" />
                                <div>
                                  <strong className="block uppercase text-xs tracking-normal mb-0.5">Khuyến cáo bảo mật:</strong>
                                  <span>{resObj.assessment.security}</span>
                                </div>
                              </div>
                            )}

                            {resObj.assessment?.improvement_areas && (
                              <div className="space-y-1.5">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-normal">Đề xuất cải tiến:</span>
                                <p className="text-xs sm:text-sm text-slate-700">{resObj.assessment.improvement_areas}</p>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}

                  {commitReviews.length === 0 && (
                    <div className="py-8 text-center text-slate-400 italic text-xs flex items-center justify-center gap-1 bg-slate-50 rounded-xl border border-slate-100">
                      <AlertCircle size={12} className="text-slate-400" />
                      <span>Chưa có dữ liệu phân tích per-push cho đội thi này.</span>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Right Area (4/12): suggested questions, project profile */}
            <div className="xl:col-span-4 space-y-6">

              {/* Q&A Suggested questions */}
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-250 border-l-4 border-l-[#F27024] shadow-sm space-y-3">
                <span className="text-sm font-bold text-slate-800 uppercase tracking-normal flex items-center gap-1.5 border-b border-amber-100 pb-2">
                  <ShieldAlert size={16} className="text-[#F27024]" />
                  <span>Gợi ý câu hỏi phản biện</span>
                </span>

                <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 text-xs sm:text-sm font-medium leading-relaxed">
                  {aiQuestions.map((q: string, idx: number) => (
                    <li key={idx} className="hover:text-[#F27024] transition-colors marker:text-[#F27024]">{q}</li>
                  ))}
                  {aiQuestions.length === 0 && (
                    <li className="list-none text-slate-400 italic text-xs py-4">[CHƯA CÓ GỢI Ý CÂU HỎI PHẢN BIỆN]</li>
                  )}
                </ul>
              </div>

              {/* Hoạt động Commit card moved from grading tab */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col h-fit space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-normal flex items-center gap-1.5">
                    <Clock size={14} className="text-[#F27024]" />
                    <span>Hoạt động Commit ({commits.length})</span>
                  </h3>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {commits.map((c: any, idx: number) => (
                    <div key={c._id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs sm:text-sm space-y-1.5 hover:border-slate-200 transition-colors shadow-sm">
                      <p className="font-semibold text-slate-800 truncate leading-snug">{c.message}</p>
                      <div className="flex justify-between items-center text-slate-500 font-sans text-xs">
                        <span className="text-[#F27024] font-semibold">@{c.authorGithubUsername || c.authorName}</span>
                        <span>{new Date(c.committedAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div className="flex gap-2 text-xs font-bold font-mono">
                        <span className="text-emerald-600">+{c.additions}</span>
                        <span className="text-rose-600">-{c.deletions}</span>
                      </div>
                    </div>
                  ))}
                  {commits.length === 0 && (
                    <p className="text-xs sm:text-sm text-slate-400 italic text-center py-10 font-sans">
                      Chưa có hoạt động commit nào.
                    </p>
                  )}
                </div>
              </div>

              {/* Project Profile Info */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-4">
                <span className="text-[10px] text-[#F27024] font-bold uppercase bg-[#F27024]/10 border border-[#F27024]/20 px-2 py-0.5 rounded shadow-sm block w-fit">
                  Hồ sơ dự án đội thi
                </span>
                <h4 className="text-sm sm:text-base font-bold text-slate-850 uppercase truncate">{team.name}</h4>

                {team.members && team.members.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 shadow-sm mt-4">
                    <p className="text-[10px] text-[#F27024] font-bold uppercase tracking-normal mb-2 font-sans">Thành viên nhóm:</p>
                    <div className="space-y-3">
                      {team.members.map((m: any) => (
                        <div key={m._id} className="text-xs text-slate-655 border-b border-slate-200/50 pb-2 last:border-none last:pb-0">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800">{m.userId?.fullName || 'Chưa cập nhật'}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${m.role === 'leader'
                              ? 'bg-[#F27024]/10 text-[#F27024] border border-[#F27024]/20'
                              : 'bg-slate-200 text-slate-600 border border-slate-300'
                              }`}>
                              {m.role === 'leader' ? 'Trưởng nhóm' : 'Thành viên'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                            {m.userId?.studentId && <span>MSSV: {m.userId.studentId} • </span>}
                            {m.userId?.university && <span>Trường: {m.userId.university}</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                            Email: {m.userId?.email || 'N/A'}
                          </div>
                          {m.userId?.githubUsername && (
                            <div className="text-[11px] text-[#F27024] font-sans mt-1 flex items-center gap-1">
                              <span className="text-[9px] bg-slate-200 px-1 py-0.2 rounded border border-slate-300 text-slate-600 font-mono">GitHub</span>
                              <span className="truncate">{m.userId.githubUsername}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
