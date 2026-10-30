import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { CircleHelp, Clock3, Mail, MessageSquare, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";

type Status = "pending" | "processing" | "waiting_for_candidate" | "resolved" | "reopened" | "closed";
type RequestItem = {
  _id: string; requestCode: string; title: string; description: string; status: Status; category: string;
  requesterId?: { _id?: string; fullName: string; email?: string }; guestName?: string; guestEmail?: string; teamId?: { _id?: string; name: string }; eventId?: { _id?: string; name: string };
  replies: Array<{ _id: string; senderName: string; senderRole: "participant" | "coordinator"; content: string; createdAt: string }>;
  updatedAt: string;
};

const API = "http://localhost:5000/api/support";
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const labels: Record<Status, string> = { pending: "Chờ xử lý", processing: "Đang xử lý", waiting_for_candidate: "Chờ thí sinh", resolved: "Đã giải quyết", reopened: "Đã mở lại", closed: "Đã đóng" };
const styles: Record<Status, string> = { pending: "bg-amber-50 text-amber-700 border-amber-200", processing: "bg-sky-50 text-sky-700 border-sky-200", waiting_for_candidate: "bg-violet-50 text-violet-700 border-violet-200", resolved: "bg-emerald-50 text-emerald-700 border-emerald-200", reopened: "bg-[#F27024]/10 text-[#c94f12] border-[#F27024]/25", closed: "bg-slate-100 text-slate-600 border-slate-200" };
const categories = [["account", "Tài khoản và đăng nhập"], ["team", "Đội thi và thành viên"], ["github", "GitHub / Repository"], ["submission", "Nộp bài và vòng thi"], ["schedule", "Lịch trình / Seminar"], ["grading", "Chấm điểm và kết quả"], ["appeal", "Khiếu nại"], ["other", "Vấn đề khác"]];

export default function SupportCenter({ coordinator = false }: { coordinator?: boolean }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [selected, setSelected] = useState<RequestItem | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reply, setReply] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ category: "other", title: "", description: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = coordinator ? `${API}/coordinator/requests?status=${filter}` : `${API}/requests/my`;
      const { data } = await axios.get(url, { headers: headers() });
      setItems(data);
      setSelected((current) => current ? data.find((item: RequestItem) => item._id === current._id) || null : null);
    } catch (error: any) { toast.error(error.response?.data?.message || "Không thể tải yêu cầu hỗ trợ."); }
    finally { setLoading(false); }
  }, [coordinator, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.origin : "http://localhost:5000");
    const socket = io(socketUrl, { auth: { token } });
    socket.on("support_updated", () => load());
    return () => {
      socket.off("support_updated");
      socket.disconnect();
    };
  }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await axios.post(`${API}/requests`, form, { headers: headers() });
      toast.success("Đã gửi yêu cầu hỗ trợ.");
      setCreating(false);
      setForm((value) => ({ ...value, title: "", description: "" }));
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể gửi yêu cầu.");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/requests/${selected._id}/replies`, { content: reply, sendEmail }, { headers: headers() });
      setSelected({ ...selected, ...data });
      setReply("");
      if (coordinator && sendEmail) {
        toast.success("Đã gửi phản hồi và gửi email thông báo tới thí sinh.");
      } else {
        toast.success("Đã gửi phản hồi.");
      }
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể gửi phản hồi.");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    try {
      const endpoint = !coordinator && status === "reopened" ? "reopen" : "status";
      const { data } = await axios.patch(`${API}/requests/${selected._id}/${endpoint}`, endpoint === "status" ? { status } : {}, { headers: headers() });
      setSelected({ ...selected, ...data });
      await load();
      toast.success("Đã cập nhật trạng thái.");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể cập nhật trạng thái.");
    }
  };

  const recipientEmail = selected?.requesterId?.email || selected?.guestEmail || "";
  const requesterDisplayName = selected?.requesterId?.fullName || selected?.guestName || selected?.guestEmail || "Thí sinh";
  const teamDisplayName = selected?.teamId?.name || "Chưa đăng ký đội";

  return <main className={`support-light ${coordinator ? "p-4 md:p-8" : "mx-auto min-h-screen w-full max-w-7xl px-4 py-8 md:px-6"} bg-[#faf9f6] text-slate-900`}>
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F27024]">Support center</p><h1 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">Yêu cầu hỗ trợ</h1><p className="mt-1 text-sm text-slate-500">{coordinator ? "Theo dõi và phản hồi yêu cầu của thí sinh." : "Gửi vấn đề và trao đổi trực tiếp với Coordinator."}</p></div>{!coordinator && <button id="create-support-request" onClick={() => setCreating(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F27024] px-4 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition hover:bg-[#d95f1f] focus:outline-none focus:ring-4 focus:ring-[#F27024]/20 active:scale-[0.98]"><Plus size={18}/>Gửi yêu cầu</button>}</header>
    {coordinator && <nav aria-label="Lọc trạng thái" className="mb-5 flex gap-2 overflow-x-auto pb-2">{["all", ...Object.keys(labels)].map((key) => <button key={key} onClick={() => setFilter(key)} className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-[#F27024]/20 ${filter === key ? "border-[#F27024] bg-[#F27024]/10 text-[#c94f12]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>{key === "all" ? "Tất cả" : labels[key as Status]}</button>)}</nav>}
    <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[380px_1fr]">
      <section aria-label="Danh sách yêu cầu" className="border-b border-slate-200 lg:border-b-0 lg:border-r">{loading ? <p className="p-8 text-center text-sm text-slate-500">Đang tải...</p> : !items.length ? <div className="p-10 text-center"><CircleHelp className="mx-auto text-slate-300" size={38}/><p className="mt-3 font-bold text-slate-700">Chưa có yêu cầu</p></div> : items.map((item) => <button key={item._id} onClick={() => setSelected(item)} className={`w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#F27024] ${selected?._id === item._id ? "bg-[#F27024]/5" : ""}`}><div className="flex items-start justify-between gap-3"><span className="text-xs font-mono font-bold text-[#c94f12]">{item.requestCode}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${styles[item.status]}`}>{labels[item.status]}</span></div><h2 className="mt-2 line-clamp-1 text-sm font-bold text-slate-900">{item.title}</h2><p className="mt-1 line-clamp-1 text-xs text-slate-500"><span className="font-semibold text-slate-700">{item.teamId?.name || "Chưa đăng ký đội"}</span> · {item.requesterId?.fullName || item.guestName || item.guestEmail}</p><p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><Clock3 size={12}/>{new Date(item.updatedAt).toLocaleString("vi-VN")}</p></button>)}</section>
      <section aria-label="Chi tiết yêu cầu" className="flex min-h-[560px] flex-col">{!selected ? <div className="m-auto text-center text-slate-400"><MessageSquare className="mx-auto" size={42}/><p className="mt-3 text-sm">Chọn một yêu cầu để xem trao đổi</p></div> : <><header className="border-b border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-mono font-bold text-orange-700">{selected.requestCode}</p><h2 className="mt-1 text-lg font-black text-slate-900">{selected.title}</h2><div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600"><span className="font-bold text-slate-800">{requesterDisplayName}</span>{recipientEmail && <span className="font-mono text-slate-400 text-[11px]">({recipientEmail})</span>}<span className="text-slate-300">•</span><span className={`rounded px-2 py-0.5 text-xs font-semibold ${selected.teamId?.name ? "bg-orange-50 text-[#c94f12] border border-orange-200" : "bg-slate-100 text-slate-500"}`}>{teamDisplayName}</span></div></div><span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${styles[selected.status]}`}>{labels[selected.status]}</span></div>{coordinator && <div className="mt-4 flex flex-wrap gap-2">{(["processing", "waiting_for_candidate", "resolved", "closed"] as Status[]).map((value) => <button key={value} disabled={selected.status === value} onClick={() => updateStatus(value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">{labels[value]}</button>)}</div>}{!coordinator && ["resolved", "closed"].includes(selected.status) && <button onClick={() => updateStatus("reopened")} className="mt-4 rounded-lg border border-orange-300 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-50">Mở lại yêu cầu</button>}</header>
        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-5"><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">Nội dung ban đầu</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.description}</p></article>{selected.replies?.map((message) => <article key={message._id} className={`max-w-[88%] rounded-2xl border p-4 ${message.senderRole === "coordinator" ? "ml-auto border-orange-200 bg-orange-50" : "border-slate-200 bg-white"}`}><div className="flex gap-2 text-xs"><strong>{message.senderName}</strong><span className="text-slate-400">{message.senderRole === "coordinator" ? "Coordinator" : "Thí sinh"}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.content}</p><time className="mt-2 block text-[10px] text-slate-400">{new Date(message.createdAt).toLocaleString("vi-VN")}</time></article>)}</div>
        {selected.status !== "closed" && <footer className="flex flex-col gap-2.5 border-t border-slate-200 bg-white p-4">
          {coordinator && (
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 hover:text-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#F27024] focus:ring-[#F27024]/30 cursor-pointer"
                />
                <span className="flex items-center gap-1.5 font-medium">
                  <Mail size={14} className={sendEmail ? "text-[#F27024]" : "text-slate-400"} />
                  Gửi kèm email thông báo cho thí sinh {recipientEmail ? <span className="font-mono text-slate-500 font-normal">({recipientEmail})</span> : ""}
                </span>
              </label>
              {sendEmail && (
                <span className="text-[11px] text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                  Sẽ gửi email thông báo
                </span>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <textarea
              id="support-reply"
              aria-label="Nội dung phản hồi"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendReply();
                }
              }}
              maxLength={4000}
              rows={2}
              placeholder="Nhập nội dung phản hồi..."
              className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
            <button
              aria-label="Gửi phản hồi"
              disabled={!reply.trim() || busy}
              onClick={sendReply}
              className="self-end rounded-xl bg-[#F27024] p-3 text-white shadow-md shadow-orange-500/20 hover:bg-[#d95f1f] disabled:opacity-40 transition active:scale-95"
            >
              <Send size={20}/>
            </button>
          </div>
        </footer>}</>}</section>
    </div>
    {creating && <div role="dialog" aria-modal="true" aria-labelledby="support-dialog-title" className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><form onSubmit={create} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-[#faf9f6] p-6 shadow-2xl"><div className="flex justify-between"><div><h2 id="support-dialog-title" className="text-xl font-black text-slate-900">Gửi yêu cầu hỗ trợ</h2><p className="mt-1 text-sm text-slate-500">Coordinator sẽ nhận và phản hồi yêu cầu của bạn.</p></div><button type="button" aria-label="Đóng" onClick={() => setCreating(false)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30"><X size={20}/></button></div><div className="mt-6 space-y-4"><label className="block text-sm font-bold text-slate-700">Phân loại<select value={form.category} onChange={(event) => setForm({...form, category: event.target.value})} style={{ colorScheme: "light" }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 outline-none transition hover:border-slate-400 focus:border-[#F27024] focus:ring-2 focus:ring-[#F27024]/10">{categories.map(([value, label]) => <option key={value} value={value} className="bg-white text-slate-800">{label}</option>)}</select></label><label className="block text-sm font-bold text-slate-700">Tiêu đề<input required maxLength={160} value={form.title} onChange={(event) => setForm({...form, title: event.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal outline-none transition focus:border-[#F27024] focus:ring-2 focus:ring-[#F27024]/10"/></label><label className="block text-sm font-bold text-slate-700">Mô tả chi tiết<textarea required maxLength={4000} rows={5} value={form.description} onChange={(event) => setForm({...form, description: event.target.value})} className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal outline-none transition focus:border-[#F27024] focus:ring-2 focus:ring-[#F27024]/10"/></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCreating(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300">Hủy</button><button disabled={busy} className="rounded-xl bg-[#F27024] px-5 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition hover:bg-[#d95f1f] focus:outline-none focus:ring-4 focus:ring-[#F27024]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Đang gửi..." : "Gửi yêu cầu"}</button></div></form></div>}
  </main>;
}

