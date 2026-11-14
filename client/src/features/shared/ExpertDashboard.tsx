import { useNavigate } from 'react-router-dom';
import { Award, Users, CheckSquare } from 'lucide-react';

export default function ExpertDashboard({ roles = [] }: any) {
  const navigate = useNavigate();
  const isJudge = roles?.some((r: any) => r.role === 'judge');
  const isMentor = roles?.some((r: any) => r.role === 'mentor');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn font-sans">
      {/* Grid of Roles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Judge Section */}
        {isJudge && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-primary/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Award size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 tracking-normal">Hội đồng Giám khảo</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Thực hiện chấm điểm các dự án thi đấu, đánh giá các tiêu chí chuyên môn và xem xét lịch sử hoạt động mã nguồn của các đội thi trong bảng đấu được giao.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/expert/projects')}
              className="w-full py-3 bg-primary hover:bg-[#d95f1f] text-white font-bold uppercase tracking-wider rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shadow-[#F27024]/10"
            >
              <CheckSquare size={14} /> Đi tới Danh sách Chấm điểm
            </button>
          </div>
        )}

        {/* Mentor Section */}
        {isMentor && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-primary/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Users size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 tracking-normal">Cố vấn & Hướng dẫn</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Theo dõi tiến độ hoàn thành đề tài, kiểm tra mã nguồn, hỗ trợ kỹ thuật và giao tiếp trực tiếp qua kênh trao đổi thảo luận với các đội thi được phân công hướng dẫn.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/expert/mentored-teams')}
              className="w-full py-3 bg-primary hover:bg-[#d95f1f] text-white font-bold uppercase tracking-wider rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shadow-[#F27024]/10"
            >
              <Users size={14} /> Đi tới Các Đội Hướng Dẫn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
