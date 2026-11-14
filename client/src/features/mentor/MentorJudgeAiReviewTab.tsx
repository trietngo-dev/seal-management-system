import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, Bot, CheckCircle2, GitCommit, ShieldCheck } from "lucide-react";

function TextBlock({ title, value }: { title: string; value?: string }) {
  if (!value) return null;
  return <section><h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h4><p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{value}</p></section>;
}

function StringList({ title, items }: { title: string; items?: unknown[] }) {
  if (!items?.length) return null;
  const safeItems = items.map(item => {
    if (typeof item === "string") return item;
    if (typeof item === "number" || typeof item === "boolean") return String(item);
    if (item && typeof item === "object") {
      const value = item as Record<string, unknown>;
      const action = value.action || value.actionable_step || value.description || value.title;
      if (typeof action === "string") return `${typeof value.priority === "string" ? `[${value.priority}] ` : ""}${action}`;
      return Object.entries(value).filter(([, field]) => ["string", "number", "boolean"].includes(typeof field)).map(([key, field]) => `${key}: ${String(field)}`).join(" | ");
    }
    return "";
  }).filter(Boolean);
  if (!safeItems.length) return null;
  return <section><h4 className="text-sm font-bold text-slate-800">{title}</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">{safeItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>;
}

export default function MentorJudgeAiReviewTab({ teamId, token }: { teamId: string; token: string | null }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`http://localhost:5000/api/ai-analyses/mentor/team/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => {
      setReviews(data.reviews || []);
      setSelectedId(data.reviews?.[0]?.id || "");
    }).catch((err) => setError(err.response?.data?.message || "Không thể tải AI review kỹ thuật."))
      .finally(() => setLoading(false));
  }, [teamId, token]);

  const selected = useMemo(() => reviews.find(review => String(review.id) === String(selectedId)) || reviews[0], [reviews, selectedId]);
  const technical = selected?.technical;

  if (loading) return <div className="py-16 text-center text-sm text-slate-500" aria-live="polite">Đang tải AI review...</div>;
  if (error) return <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>;

  return <section aria-labelledby="mentor-ai-review-title" className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 id="mentor-ai-review-title" className="flex items-center gap-2 text-lg font-bold text-slate-800"><Bot size={20} className="text-primary" /> AI Review kỹ thuật</h2><p className="mt-1 text-sm text-slate-500">Kết quả phân tích source đã có của hệ thống Judge, được lọc riêng cho mentor.</p></div>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><ShieldCheck size={14} /> Không gồm điểm và rubric</span>
    </header>

    {!reviews.length ? <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center"><Bot className="mx-auto text-slate-300" size={30} /><p className="mt-3 text-sm font-semibold text-slate-600">Chưa có AI review hoàn tất cho đội này.</p><p className="mt-1 text-xs text-slate-400">Kết quả sẽ xuất hiện sau khi hệ thống Judge phân tích commit hoặc repository.</p></div> : <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <nav aria-label="Lịch sử AI review" className="space-y-2">
        {reviews.map(review => <button key={review.id} type="button" onClick={() => setSelectedId(review.id)} aria-current={String(selected?.id) === String(review.id)} className={`w-full rounded-xl border p-3 text-left transition focus:outline-hidden focus:ring-2 focus:ring-[#F27024]/30 ${String(selected?.id) === String(review.id) ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">{review.analysisType === "repository_review" ? "Tổng hợp repository" : "Review commit"}</span><CheckCircle2 size={14} className="text-emerald-600" /></div>
          {review.commit?.sha && <code className="mt-2 block text-xs text-[#c95015]">{review.commit.sha.slice(0, 10)}</code>}
          <time className="mt-1 block text-[11px] text-slate-400">{new Date(review.completedAt || review.createdAt).toLocaleString("vi-VN")}</time>
        </button>)}
      </nav>

      <article className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        {selected.commit && <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"><GitCommit size={17} className="mt-0.5 text-primary" /><div><code className="text-xs font-bold text-slate-700">{selected.commit.sha?.slice(0, 12)}</code><p className="mt-1 text-sm text-slate-600">{selected.commit.message}</p></div></div>}
        <div className="grid gap-5 sm:grid-cols-2"><TextBlock title="Hệ thống" value={technical?.summary?.projectAbout} /><TextBlock title="Trọng tâm hiện tại" value={technical?.summary?.currentFocus} /><TextBlock title="Kiến trúc" value={technical?.summary?.architecturalStyle} /><TextBlock title="Tiến trình phát triển" value={technical?.summary?.evolutionSummary || technical?.summary?.pushSummary} /></div>
        <div className="border-t border-slate-200 pt-5"><h3 className="mb-4 text-sm font-bold text-slate-800">Nhận xét source code</h3><div className="grid gap-5 sm:grid-cols-2"><TextBlock title="Điểm mạnh" value={technical?.assessment?.advantages} /><TextBlock title="Điểm cần cải thiện" value={technical?.assessment?.improvementAreas || technical?.assessment?.disadvantages} /><TextBlock title="Lỗi tiềm ẩn" value={technical?.assessment?.potentialErrors} /><TextBlock title="Bảo mật" value={technical?.assessment?.security} /><TextBlock title="Độ ổn định runtime" value={technical?.assessment?.runtimeResilience} /><TextBlock title="Cấu trúc source" value={technical?.assessment?.sourceStructure} /></div></div>
        <StringList title="Khoảng trống chưa xử lý" items={technical?.unresolvedGaps} /><StringList title="Ưu tiên cải thiện" items={technical?.improvements} /><StringList title="Test case được đề xuất" items={technical?.suggestedTests} /><StringList title="Câu hỏi mentor có thể trao đổi với đội" items={technical?.questionsForTeam} />
      </article>
    </div>}
  </section>;
}
