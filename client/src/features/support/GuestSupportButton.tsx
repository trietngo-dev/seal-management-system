import { useState } from "react";
import axios from "axios";
import { LifeBuoy, Send, X } from "lucide-react";
import { toast } from "sonner";

const categories = [["account", "Tài khoản và đăng nhập"], ["team", "Đội thi và thành viên"], ["github", "GitHub / Repository"], ["submission", "Nộp bài và vòng thi"], ["schedule", "Lịch trình / Seminar"], ["grading", "Chấm điểm và kết quả"], ["appeal", "Khiếu nại"], ["other", "Vấn đề khác"]];

export default function GuestSupportButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", category: "other", title: "", description: "" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const { data } = await axios.post("http://localhost:5000/api/support/guest/requests", form);
      toast.success(`${data.message} Mã yêu cầu: ${data.requestCode}`);
      setOpen(false); setForm({ name: "", email: "", category: "other", title: "", description: "" });
    } catch (error: any) { toast.error(error.response?.data?.message || "Không thể gửi yêu cầu hỗ trợ."); }
    finally { setBusy(false); }
  };

  return <div className="support-light fixed bottom-6 right-6 z-40">
    <button id="guest-support-button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-[#F27024] px-5 py-3 font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-[#d95f1f] focus:outline-none focus:ring-4 focus:ring-[#F27024]/25 active:scale-[0.98]"><LifeBuoy size={19}/><span>Hỗ trợ</span></button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="guest-support-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-[#faf9f6] p-6 shadow-2xl"><header className="flex items-start justify-between"><div><h2 id="guest-support-title" className="text-xl font-black text-slate-900">Gửi yêu cầu hỗ trợ</h2><p className="mt-1 text-sm text-slate-500">Phản hồi từ Coordinator sẽ được gửi tới email của bạn.</p></div><button type="button" aria-label="Đóng" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:ring-2 focus:ring-[#F27024]/30"><X size={20}/></button></header>
      <div className="mt-6 space-y-4"><label className="block text-sm font-bold text-slate-700">Họ và tên<input required maxLength={100} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 outline-none focus:border-[#F27024]"/></label><label className="block text-sm font-bold text-slate-700">Email<input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 outline-none focus:border-[#F27024]"/></label><label className="block text-sm font-bold text-slate-700">Phân loại<select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 outline-none focus:border-[#F27024]">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-bold text-slate-700">Tiêu đề<input required maxLength={160} value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 outline-none focus:border-[#F27024]"/></label><label className="block text-sm font-bold text-slate-700">Nội dung<textarea required rows={5} maxLength={4000} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 outline-none focus:border-[#F27024]"/></label></div>
      <button disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F27024] px-5 py-3 font-bold text-white transition hover:bg-[#d95f1f] focus:ring-4 focus:ring-[#F27024]/20 disabled:opacity-40"><Send size={18}/>{busy ? "Đang gửi..." : "Gửi yêu cầu"}</button></form></div>}
  </div>;
}
