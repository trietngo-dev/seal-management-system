import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, 
  HelpCircle,
  GitBranch,
  Sparkles,
  AlertCircle,
  Calendar,
  Award,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Target
} from 'lucide-react';

export default function JudgeTeamActivity() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [team, setTeam] = useState<any>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const fetchAiData = () => {
    if (!teamId) return;
    axios.get(`http://localhost:5000/api/ai-analyses/team/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        const agg = res.data.find((r: any) => r.analysisType === 'repository_review' && r.status === 'completed');
        setAiInsight(agg ? agg.result : null);

        const commitReview = res.data.find((r: any) => r.analysisType === 'commit_review' && r.status === 'completed');
        const questions = agg?.result?.suggested_questions_for_team || commitReview?.result?.suggested_questions_for_team || [];
        setAiQuestions(questions);
      })
      .catch((err: any) => {
        console.error(err);
      });
  };

  // Fetch specific team info directly
  useEffect(() => {
    if (!teamId) return;
    
    setLoading(true);
    axios.get(`http://localhost:5000/api/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        setTeam(res.data);
      })
      .catch((err: any) => {
        console.error('Error fetching team info:', err);
      })
      .finally(() => setLoading(false));
  }, [teamId, token]);

  // Fetch commits & AI reports for active team
  useEffect(() => {
    if (!teamId) return;

    axios.get(`http://localhost:5000/api/analytics/team/${teamId}/commits`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => setCommits(res.data))
      .catch((err: any) => console.error(err));

    fetchAiData();
  }, [teamId, token]);

  const handleTriggerAgent2 = async () => {
    if (!teamId) return;
    setTriggerLoading(true);
    setTriggerMessage({ type: '', text: '' });

    try {
      // 1. Get active round and rubric
      const activeContestRes = await axios.get("http://localhost:5000/api/events/judge/active-contest", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const roundId = activeContestRes.data?.currentRound?._id || team?.currentRoundId;
      if (!roundId) {
        throw new Error('Chưa xác định được vòng thi hiện tại của sự kiện.');
      }

      const rubricRes = await axios.get(`http://localhost:5000/api/rubrics/round/${roundId}`, {
        params: { trackId: team?.trackId?._id || team?.trackId || undefined },
        headers: { Authorization: `Bearer ${token}` }
      });
      const rubricId = rubricRes.data?.rubric?._id;
      if (!rubricId) {
        throw new Error('Chưa tìm thấy Rubric active được gán cho vòng thi này.');
      }

      // 2. Trigger Agent 2 manual aggregate review
      const res = await axios.post(`http://localhost:5000/api/ai-analyses/team/${teamId}/aggregate`, {
        roundId,
        rubricId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.analysis?.result) {
        setAiInsight(res.data.analysis.result);
        const questions = res.data.analysis.result.suggested_questions_for_team || [];
        if (questions.length > 0) {
          setAiQuestions(questions);
        }
      } else {
        fetchAiData();
      }

      setTriggerMessage({ type: 'success', text: 'Agent 2 đã hoàn tất phân tích tổng hợp lịch sử đội thi theo Rubric!' });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err.message || 'Lỗi khi kích hoạt Agent 2.';
      setTriggerMessage({ type: 'error', text: errMsg });
    } finally {
      setTriggerLoading(false);
    }
  };

  const getSyncTimeElapsed = (dateStr: string) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `${diffDays} ngày trước`;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) return `${diffHours} giờ trước`;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins} phút trước`;
  };

  if (loading || !team) {
    return (
      <div className="text-center py-20 text-slate-550 text-sm animate-pulse">
        Đang tải hoạt động và báo cáo AI của đội thi...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Breadcrumb Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-200 px-6 py-4 rounded-2xl shadow-sm gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/expert/dashboard')}
            className="text-[#F27024] hover:text-[#d95f1f] text-sm font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-bold text-sm">Chi tiết hoạt động</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-normal">Đội:</span>
          <span className="bg-[#F27024]/10 text-[#F27024] font-black px-3 py-1 rounded-xl text-sm border border-[#F27024]/20 shadow-sm">
            {team.teamName || team.name}
          </span>
          {team.trackId && (
            <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-xl text-xs border border-slate-200">
              {team.trackId.name}
            </span>
          )}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Repository Commits Stream */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                <GitBranch size={16} className="text-[#F27024]" />
                <span>Nhật ký Commit Đồng bộ ({commits.length})</span>
              </h3>
              <span className="text-xs font-medium text-slate-450">Tự động đối soát định kỳ</span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {commits.map((c: any, index: number) => (
                <div key={index} className="p-4 rounded-xl border border-slate-150 bg-slate-50 hover:bg-white hover:border-[#F27024]/40 transition-all shadow-sm flex flex-col space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-bold text-[#F27024] bg-[#F27024]/10 px-2 py-0.5 rounded border border-[#F27024]/20">
                      {c.commitSha ? c.commitSha.substring(0, 7) : 'Commit'}
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-450 text-[11px] font-medium">
                      <Calendar size={12} />
                      <span>{getSyncTimeElapsed(c.committedAt)}</span>
                    </div>
                  </div>

                  <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                    {c.message}
                  </p>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>Tác giả: <strong className="text-slate-700">{c.authorName || c.authorGithubUsername || 'N/A'}</strong></span>
                    {c.diffSummary && (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Award size={12} /> Đã kiểm toán bằng chứng
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {commits.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs italic">
                  Chưa có commit nào được đồng bộ cho đội thi này.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis & Preview Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                <Sparkles size={16} className="text-[#F27024]" />
                <span>Đánh giá Tổng quan từ AI (Agent 2)</span>
              </h3>

              {/* Action Button to Trigger Agent 2 */}
              <button
                type="button"
                onClick={handleTriggerAgent2}
                disabled={triggerLoading}
                className="flex items-center gap-1.5 bg-[#F27024] hover:bg-[#d95f1f] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={triggerLoading ? 'animate-spin' : ''} />
                <span>{triggerLoading ? 'Agent 2 đang chạy...' : 'Chạy Agent 2 Phân tích'}</span>
              </button>
            </div>

            {/* Notification message */}
            {triggerMessage.text && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                triggerMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {triggerMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{triggerMessage.text}</span>
              </div>
            )}

            {aiInsight ? (
              <div className="space-y-6">
                {/* System Identity & Track */}
                <div className="bg-[#F27024]/5 p-4 rounded-xl border border-[#F27024]/20 shadow-sm space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#F27024] font-bold uppercase tracking-normal block">Nhận diện Hệ thống</span>
                    <span className="text-[11px] bg-[#F27024]/10 text-[#F27024] font-bold px-2 py-0.5 rounded">
                      {aiInsight.team_system_identity?.detected_track || aiInsight.system_identity?.detected_track || 'Track Auto-detect'}
                    </span>
                  </div>
                  <p className="text-slate-800 font-bold text-xs mt-1">
                    {aiInsight.team_system_identity?.project_about || aiInsight.smb_scale_advisory?.system_identity_recap || aiInsight.overall_picture?.project_about || 'Hệ thống Multi-Agent AI × IoT'}
                  </p>
                  {aiInsight.team_system_identity?.primary_user_value && (
                    <p className="text-slate-600 text-[11px] mt-1 italic">
                      <strong>Giá trị:</strong> {aiInsight.team_system_identity.primary_user_value}
                    </p>
                  )}
                </div>

                {/* Disqualification Risks */}
                {Array.isArray(aiInsight.disqualification_risks) && aiInsight.disqualification_risks.length > 0 && (
                  <div className="bg-rose-50 border border-rose-250 p-4 rounded-xl space-y-1.5 shadow-sm">
                    <span className="text-xs text-rose-700 font-bold uppercase tracking-normal flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-rose-600" /> Cảnh báo Rủi ro Loại (Disqualification Risks)
                    </span>
                    <ul className="list-disc pl-5 space-y-1 text-rose-800 text-xs font-medium">
                      {aiInsight.disqualification_risks.map((risk: string, i: number) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Overall Historical Synthesis */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-normal block">Tổng hợp lịch sử phát triển</span>
                  <p className="text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs leading-relaxed font-sans shadow-sm">
                    {aiInsight.historical_synthesis?.evolution_summary || aiInsight.overall_picture?.historical_synthesis || 'Chưa có tóm tắt lịch sử.'}
                  </p>
                </div>

                {/* Minimum Acceptance Check */}
                {Array.isArray(aiInsight.minimum_acceptance) && aiInsight.minimum_acceptance.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-700 font-bold uppercase tracking-normal flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-[#F27024]" /> Kiểm tra Nghiệm thu Tối thiểu ({aiInsight.minimum_acceptance.filter((m: any) => m.status === 'pass' || m.status === 'implemented').length}/{aiInsight.minimum_acceptance.length} Đạt)
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {aiInsight.minimum_acceptance.map((m: any, i: number) => {
                        const isPass = m.status === 'pass' || m.status === 'implemented';
                        const isPartial = m.status === 'partial';
                        return (
                          <div key={i} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 text-[11px]">{m.requirement}</p>
                              {m.evidence && <p className="text-slate-500 text-[10px] font-sans">{m.evidence}</p>}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-normal shrink-0 ${
                              isPass ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
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

                {/* Qualitative Ratings & Rubric Scores */}
                <div className="space-y-3">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-normal block">Đánh giá tiêu chí Rubric</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(aiInsight.criteria_comments || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex flex-col gap-1 shadow-sm hover:border-slate-350 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-700 uppercase tracking-normal text-[10px]">[{key}]</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-normal ${
                            value.grade === 'Xuất sắc' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            value.grade === 'Tốt' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            value.grade === 'Khá' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            value.grade === 'Trung bình' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {value.suggested_score !== undefined ? `${value.suggested_score}đ / 5đ — ` : ''}{value.grade}
                          </span>
                        </div>
                        {value.comment && (
                          <p className="text-slate-600 text-[11px] line-clamp-3 mt-0.5">
                            {value.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Suggested Critique Questions */}
                <div className="space-y-3 bg-amber-50 p-4 rounded-xl border border-amber-250 border-l-4 border-l-[#F27024] shadow-sm">
                  <span className="text-xs font-bold text-[#F27024] uppercase tracking-normal block flex items-center gap-1.5 border-b border-amber-100 pb-2">
                    <HelpCircle size={14} className="text-[#F27024]" />
                    <span>Bộ câu hỏi phản biện gợi ý cho Giám khảo</span>
                  </span>
                  <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 text-xs font-medium leading-relaxed">
                    {aiQuestions.map((q: string, idx: number) => (
                      <li key={idx} className="hover:text-[#F27024] transition-colors marker:text-[#F27024]">{q}</li>
                    ))}
                    {aiQuestions.length === 0 && (
                      <li className="list-none text-slate-400 italic font-sans">[Chưa cấu hình câu hỏi phản biện gợi ý]</li>
                    )}
                  </ul>
                </div>

                {/* Improvement Priorities */}
                {Array.isArray(aiInsight.improvement_priorities) && aiInsight.improvement_priorities.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-normal flex items-center gap-1.5">
                      <Target size={13} className="text-[#F27024]" /> Danh sách Ưu tiên Cải thiện
                    </span>
                    <div className="space-y-2">
                      {aiInsight.improvement_priorities.map((item: any, idx: number) => {
                        const isObj = typeof item === 'object' && item !== null;
                        const priority = isObj ? item.priority : (typeof item === 'string' && item.startsWith('P0') ? 'P0' : item.startsWith('P1') ? 'P1' : 'P2');
                        const text = isObj ? `${item.requirement_gap ? `[${item.requirement_gap}] ` : ''}${item.actionable_step || ''}` : item;
                        return (
                          <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2.5 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                              priority === 'P0' ? 'bg-rose-500 text-white' :
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

                {/* Final Summary */}
                {aiInsight.final_summary && (
                  <div className="bg-amber-50/60 border border-amber-250 p-4 rounded-xl space-y-1.5 shadow-sm">
                    <span className="text-xs font-bold text-[#F27024] uppercase tracking-normal flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#F27024]" /> Tổng kết Đánh giá từ Agent 2
                    </span>
                    <p className="text-slate-700 text-xs leading-relaxed font-medium">
                      {aiInsight.final_summary}
                    </p>
                  </div>
                )}

              </div>
            ) : (
              <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <AlertCircle size={28} className="mx-auto text-slate-400" />
                <p className="text-xs text-slate-500 font-medium">Chưa có dữ liệu đánh giá tổng hợp từ Agent 2 cho đội này.</p>
                <p className="text-[11px] text-slate-400">Nhấn nút "Chạy Agent 2 Phân tích" ở góc trên để kích hoạt ngay.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
