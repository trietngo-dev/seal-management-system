import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Users, FileText, MessageSquare, GitCommit, ListChecks, Bot } from "lucide-react";
import MentorTeamDetailChat from "./MentorTeamDetailChat";
import MentorJudgeAiReviewTab from "./MentorJudgeAiReviewTab";

export default function MentorTeamDetail() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [activeTab, setActiveTab] = useState("overview"); // overview, chat, commits, rubric
  const [team, setTeam] = useState<any>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [rubrics, setRubrics] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const teamRes = await axios.get(`http://localhost:5000/api/teams/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = teamRes.data;
        setTeam({ ...payload.team, members: payload.members });

        // 3. Fetch commits
        try {
          const commitsRes = await axios.get(`http://localhost:5000/api/analytics/team/${teamId}/commits`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCommits(commitsRes.data);
        } catch (e) {
          console.error("No commits found");
        }

        // 4. Fetch rubric for this track's round
        if (payload.team?.trackId?.roundId) {
          const roundId = typeof payload.team.trackId.roundId === 'object'
            ? payload.team.trackId.roundId._id
            : payload.team.trackId.roundId;
          try {
            const rubricRes = await axios.get(`http://localhost:5000/api/rubrics/round/${roundId}`, {
              params: { trackId: payload.team.trackId._id || undefined },
              headers: { Authorization: `Bearer ${token}` }
            });
            setRubrics(rubricRes.data);
          } catch(e) {
            console.error("No rubric found");
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId, token]);



  if (loading || !team) {
    return <div className="text-center py-20 text-slate-500 text-sm">Đang tải dữ liệu đội thi...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/mentor/dashboard')}
          className="text-[#F27024] hover:text-[#d95f1f] font-bold flex items-center gap-1.5 bg-[#F27024]/5 hover:bg-[#F27024]/10 border border-[#F27024]/20 px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Quản lý Đội thi: {team.name}</h1>
          <p className="text-slate-500 text-sm mt-1">Bảng đấu: {team.trackId?.name || 'Không rõ'} | Sự kiện: {team.eventId?.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
        {[
          { id: "overview", icon: Users, label: "Tổng quan & Đề thi" },
          { id: "chat", icon: MessageSquare, label: "Chat" },
          { id: "commits", icon: GitCommit, label: "Lịch sử Code" },
          { id: "ai-review", icon: Bot, label: "AI Review" },
          { id: "rubric", icon: ListChecks, label: "Tiêu chí chấm điểm" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === tab.id 
                ? "bg-[#F27024] text-white shadow-sm" 
                : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Users className="text-[#F27024]" size={18}/> Thành viên trong đội</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {team.members?.map((m: any) => (
                  <div key={m._id} className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                    <p className="font-bold text-slate-800">{m.userId?.fullName}</p>
                    <p className="text-sm text-slate-500 mt-1">{m.userId?.email}</p>
                    {m.userId?._id === team.leaderId?._id && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-[#F27024]/10 text-[#F27024] text-xs font-bold rounded">Trưởng nhóm</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText className="text-[#F27024]" size={18}/> Đề thi vòng thi</h3>
              {(team.trackId?.roundId?.hasExamMaterial || team.trackId?.examDriveFileId || team.trackId?.examDriveFileUrl) ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-600 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <p className="text-slate-800 font-bold">
                      {team.trackId?.examDriveFileName || team.trackId?.roundId?.driveFileName || team.trackId?.roundId?.name || `Đề thi ${team.trackId?.name || ''}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {team.trackId?.examDriveFileId ? "Đề thi cấp bảng đấu." : "Đề thi cấp vòng thi."}
                    </p>
                  </div>
                  {(team.trackId?.examDriveFileUrl || team.trackId?.roundId?.driveFileUrl) && (
                    <a
                      href={team.trackId?.examDriveFileUrl || team.trackId?.roundId?.driveFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#F27024] hover:bg-[#d95f1f] text-white text-xs font-bold rounded-xl transition-all shrink-0 text-center"
                    >
                      Xem đề thi
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">Chưa có đề cho vòng thi này.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          team.eventId?.status === 'ongoing' ? (
            <MentorTeamDetailChat team={team} token={token} />
          ) : (
            <div className="py-16 text-center flex flex-col items-center justify-center max-w-md mx-auto animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4 border border-slate-200">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-slate-700 font-bold text-lg mb-2">
                {team.eventId?.status === 'completed' || team.eventId?.status === 'cancelled'
                  ? 'Kênh chat đã đóng'
                  : 'Hộp thoại chat chưa khả dụng'}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {team.eventId?.status === 'completed' || team.eventId?.status === 'cancelled'
                  ? 'Cuộc thi đã kết thúc. Lịch sử chat đã lưu trữ.'
                  : 'Kênh chat sẽ được mở khi cuộc thi chính thức bước vào giai đoạn thi đấu.'}
              </p>
            </div>
          )
        )}

        {/* Commits Tab */}
        {activeTab === "commits" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <GitCommit className="text-pink-500" size={20}/> Lịch sử Code (Commits)
            </h3>
            {commits.length === 0 ? (
              <p className="text-sm text-slate-500 italic text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">Đội thi chưa có hoạt động code nào được ghi nhận.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {commits.map(c => (
                  <div key={c._id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center gap-4">
                    <div>
                      <p className="font-bold text-sm text-slate-800 mb-1">{c.message}</p>
                      <p className="text-xs text-slate-500 font-sans">
                        <span className="text-[#F27024] font-semibold">@{c.authorGithubUsername || c.authorName}</span> 
                        <span className="mx-2">•</span> 
                        {new Date(c.committedAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                      <span className="text-emerald-600 font-bold">+{c.additions}</span>
                      <span className="text-rose-600 font-bold">-{c.deletions}</span>
                      <span className="bg-slate-200 px-2 py-1 rounded text-slate-700 ml-2 font-mono">{c.commitSha?.slice(0,7)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Read-only technical projection of Judge AI reviews */}
        {activeTab === "ai-review" && (
          <MentorJudgeAiReviewTab teamId={teamId!} token={token} />
        )}

        {/* Rubric Tab */}
        {activeTab === "rubric" && (
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <ListChecks className="text-[#F27024]" size={20}/> Tiêu chí chấm điểm
            </h3>
            {rubrics ? (
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h4 className="font-bold text-[#F27024] text-lg mb-2">{rubrics.name}</h4>
                <p className="text-slate-600 text-sm mb-6">{rubrics.description}</p>
                <div className="space-y-4">
                  {rubrics.criteria?.map((c: any, idx: number) => (
                    <div key={c._id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{idx + 1}. {c.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-center shrink-0 ml-4">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Trọng số</p>
                        <p className="text-lg font-black text-[#F27024] font-mono">{c.weight}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">Chưa có rubric nào được cấu hình cho vòng thi này.</p>
            )}
          </div>
        )}
      </div>


    </div>
  );
}
