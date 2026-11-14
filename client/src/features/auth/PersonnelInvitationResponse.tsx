import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";

export default function PersonnelInvitationResponse() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Liên kết lời mời không hợp lệ.");
      return;
    }
    axios.get(`http://localhost:5000/api/personnel-invitations/respond/${token}`)
      .then((response) => setInvitation(response.data))
      .catch((err) => setError(err.response?.data?.message || "Không thể đọc lời mời."));
  }, [token]);

  const respond = async (decision: "accepted" | "rejected") => {
    try {
      setSubmitting(true);
      const response = await axios.post(
        `http://localhost:5000/api/personnel-invitations/respond/${token}`,
        { decision },
      );
      setInvitation((current: any) => ({ ...current, status: response.data.status }));
    } catch (err: any) {
      setError(err.response?.data?.message || "Không thể gửi phản hồi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] p-6">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck size={28} /></div>
        <h1 className="mt-5 text-center text-2xl font-extrabold text-slate-900">Lời mời tham gia nhân sự</h1>
        {error ? <p className="mt-6 rounded-xl bg-rose-50 p-4 text-center text-sm text-rose-700">{error}</p> : !invitation ? <p className="mt-6 text-center text-sm text-slate-500">Đang tải lời mời...</p> : (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              <p>Xin chào <strong className="text-slate-900">{invitation.fullName}</strong>,</p>
              <p className="mt-2">Bạn được mời tham gia <strong>{invitation.eventName}</strong>.</p>
              <div className="mt-3 flex flex-wrap gap-2">{invitation.assignments?.map((item: any, index: number) => <span key={index} className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{item.role === "judge" ? "Giám khảo" : "Mentor"}{item.trackName ? ` · ${item.trackName}` : ""}</span>)}</div>
            </div>
            {invitation.status === "pending" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button disabled={submitting} onClick={() => respond("accepted")} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-[#d95f1f] focus:outline-hidden focus:ring-2 focus:ring-[#F27024]/30 disabled:opacity-50"><CheckCircle2 size={18} /> Chấp thuận</button>
                <button disabled={submitting} onClick={() => respond("rejected")} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-300 disabled:opacity-50"><XCircle size={18} /> Từ chối</button>
              </div>
            ) : <p className={`rounded-xl p-4 text-center text-sm font-bold ${invitation.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{invitation.status === "accepted" ? "Bạn đã chấp thuận lời mời." : "Bạn đã từ chối lời mời."}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
