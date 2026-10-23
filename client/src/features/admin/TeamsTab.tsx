import { useState, useEffect } from "react";
import axios from "axios";
import {
  Users,
  RefreshCw,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Search,
  Send,
  FileText,
  X,
  Trash2
} from "lucide-react";

import CustomSelect from "../shared/CustomSelect";
import { useConform } from "../shared/ModalConform";
import { toast } from "sonner";

interface TeamsTabProps {
  selectedEvent: any;
  teamsList: any[];
  tracks: any[];
  rounds?: any[];
  loading: boolean;
  handleDistributeTeams: () => Promise<void>;
  handleAssignTrack: (teamId: string, trackId: string) => Promise<void>;
  handleSyncRepo: (repoId: string) => Promise<void>;
  syncingRepoId: string | null;
  readOnly?: boolean;
  onRefreshTeams?: () => Promise<void> | void;
}

export default function TeamsTab({
  selectedEvent,
  teamsList,
  tracks,
  rounds = [],
  loading,
  handleDistributeTeams,
  handleAssignTrack,
  handleSyncRepo,
  syncingRepoId,
  readOnly = false,
  onRefreshTeams,
}: TeamsTabProps) {
  const conform = useConform();
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    teamIds?: string[];
    memberCount?: number;
    errors?: string[];
  } | null>(null);

  // 2-Step Confirmation Email State
  // 0: Initial / No recent import
  // 1: Imported -> Show "Đã xác nhận danh sách import"
  // 2: Confirmed -> Button changes to "Gửi email mời (N thành viên)"
  const [emailStep, setEmailStep] = useState<0 | 1 | 2>(0);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [activeTeamView, setActiveTeamView] = useState<"teams" | "contestants">("teams");
  const [contestantSearch, setContestantSearch] = useState("");
  const [sendingMemberIds, setSendingMemberIds] = useState<string[]>([]);
  const [emailResult, setEmailResult] = useState<{
    sent: number;
    failed: number;
    total: number;
    message: string;
  } | null>(null);

  // Helper to persist flow state to localStorage
  const persistFlowState = (
    newImportResult: typeof importResult,
    newEmailStep: 0 | 1 | 2,
    newEmailResult: typeof emailResult
  ) => {
    if (!selectedEvent?._id) return;
    const key = `seal_import_flow_${selectedEvent._id}`;
    try {
      if (!newImportResult && newEmailStep === 0 && !newEmailResult) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(
          key,
          JSON.stringify({
            importResult: newImportResult,
            emailStep: newEmailStep,
            emailResult: newEmailResult,
            updatedAt: Date.now(),
          })
        );
      }
    } catch (e) {
      console.warn("Failed to save import flow state:", e);
    }
  };

  const hasPendingTeams = teamsList.some((t: any) => t.status === "pending_confirm");

  // Load saved state on mount or when selectedEvent changes
  useEffect(() => {
    if (!selectedEvent?._id) return;
    const key = `seal_import_flow_${selectedEvent._id}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && (saved.emailStep === 1 || saved.emailStep === 2 || saved.importResult || saved.emailResult)) {
          setImportResult(saved.importResult || null);
          setEmailStep(saved.emailStep || 0);
          setEmailResult(saved.emailResult || null);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to parse saved import flow state:", e);
    }

    // Reset state if current event has no saved import flow
    setImportResult(null);
    setEmailStep(0);
    setEmailResult(null);
  }, [selectedEvent?._id]);

  const [creatingRepoTeamId, setCreatingRepoTeamId] = useState<string | null>(null);

  const handleCreateRepo = async (teamId: string) => {
    setCreatingRepoTeamId(teamId);
    try {
      const token = localStorage.getItem("token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      await axios.post(
        `${apiBase}/api/github-repositories/create`,
        { teamId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Đã tạo GitHub repository và mời các thành viên.");
      await onRefreshTeams?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể tạo GitHub repository.");
    } finally {
      setCreatingRepoTeamId(null);
    }
  };

  const handleDismissImportResult = () => {
    setImportResult(null);
    persistFlowState(null, emailStep, emailResult);
  };

  const handleDismissEmailResult = () => {
    setEmailResult(null);
    persistFlowState(importResult, emailStep, null);
  };

  const handleExportTeams = async () => {
    if (!selectedEvent?._id) return;
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}/export-teams`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const safeName = selectedEvent.name.replace(/\s+/g, "_");
      link.setAttribute("download", `Teams_${safeName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export teams error:", err);
      alert("Lỗi khi xuất danh sách đội thi ra file Excel. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const token = localStorage.getItem("token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${apiBase}/api/teams/import-template?type=admin`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Template_Import_Teams_Admin.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download template error:", err);
      alert("Lỗi khi tải file template mẫu. Vui lòng thử lại.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportTeams = async () => {
    if (!importFile || !selectedEvent?._id) return;
    setImporting(true);
    setImportResult(null);
    setEmailStep(0);
    setEmailResult(null);
    persistFlowState(null, 0, null);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("eventId", selectedEvent._id);
      formData.append("skipEmail", "true");

      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${apiBase}/api/teams/import`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const newResult = {
        success: true,
        message: res.data.message || `Đã import thành công ${res.data.count} đội thi!`,
        count: res.data.count,
        teamIds: res.data.teamIds || [],
        memberCount: res.data.memberCount || 0,
      };

      const newStep = (res.data.memberCount || 0) > 0 ? 1 : 0;

      setImportResult(newResult);
      setEmailStep(newStep);
      persistFlowState(newResult, newStep, null);

      // Refresh team list in parent
      if (onRefreshTeams) {
        await onRefreshTeams();
      }
    } catch (err: any) {
      console.error("Import error:", err);
      const resData = err.response?.data;
      const errorResult = {
        success: false,
        message: resData?.message || "Lỗi khi import danh sách đội thi.",
        errors: resData?.errors || [],
      };
      setImportResult(errorResult);
      persistFlowState(errorResult, 0, null);
    } finally {
      setImporting(false);
      setImportFile(null);
    }
  };

  const handleConfirmStep1 = () => {
    setEmailStep(2);
    persistFlowState(importResult, 2, emailResult);
  };

  const handleSendInvitations = async () => {
    if (!selectedEvent?._id) return;
    setSendingEmails(true);
    setEmailResult(null);

    try {
      const token = localStorage.getItem("token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(
        `${apiBase}/api/teams/send-member-invitations`,
        {
          eventId: selectedEvent?._id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const newEmailResult = {
        sent: res.data.queued || res.data.sent || 0,
        failed: res.data.failed || 0,
        total: res.data.total || 0,
        message: res.data.message || `Đã gửi thành công ${res.data.sent} email mời!`,
      };

      setEmailResult(newEmailResult);
      setEmailStep(0);
      persistFlowState(null, 0, newEmailResult);

      // Refresh team list to update any UI states
      if (onRefreshTeams) {
        await onRefreshTeams();
      }
    } catch (err: any) {
      console.error("Send invitations error:", err);
      alert(err.response?.data?.message || "Lỗi khi gửi email mời thành viên.");
    } finally {
      setSendingEmails(false);
    }
  };

  const pendingContestants = teamsList.flatMap((team: any) =>
    (team.members || [])
      .filter((member: any) => member.confirmStatus === "pending")
      .map((member: any) => ({ ...member, teamName: team.name }))
  );

  const visibleContestants = pendingContestants.filter((member: any) => {
    const keyword = contestantSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [member.userId?.fullName, member.userId?.email, member.userId?.studentId, member.teamName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  useEffect(() => {
    if (activeTeamView !== "contestants" || !onRefreshTeams) return;
    const refreshTimer = window.setInterval(() => void onRefreshTeams(), 5000);
    return () => window.clearInterval(refreshTimer);
  }, [activeTeamView, onRefreshTeams]);

  const getEmailStatus = (member: any) => {
    const status = member.invitationEmailStatus || (member.invitationEmailSent ? "sent" : "pending");
    const statuses: Record<string, { label: string; className: string }> = {
      pending: { label: "Chưa gửi", className: "border-slate-200 bg-slate-50 text-slate-600" },
      queued: { label: "Đang chờ", className: "border-sky-200 bg-sky-50 text-sky-700" },
      sending: { label: "Đang gửi", className: "border-violet-200 bg-violet-50 text-violet-700" },
      sent: { label: "Đã gửi", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
      failed: { label: "Gửi lỗi", className: "border-rose-200 bg-rose-50 text-rose-700" },
    };
    return statuses[status] || statuses.pending;
  };

  const canQueueEmail = (member: any) =>
    !["queued", "sending"].includes(member.invitationEmailStatus);

  const handleSendMemberEmails = async (memberIds?: string[]) => {
    if (!selectedEvent?._id) return;
    const ids = memberIds || pendingContestants
      .filter((member: any) => !member.invitationEmailSent && canQueueEmail(member))
      .map((member: any) => member._id);
    if (ids.length === 0) {
      toast.info("Không có thí sinh nào đang chờ gửi email.");
      return;
    }

    setSendingMemberIds(ids);
    try {
      const token = localStorage.getItem("token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(
        `${apiBase}/api/teams/send-member-invitations`,
        { eventId: selectedEvent._id, memberIds: ids },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.failed > 0) toast.warning(res.data.message);
      else toast.success(res.data.message);
      if (onRefreshTeams) await onRefreshTeams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể gửi email lời mời.");
    } finally {
      setSendingMemberIds([]);
    }
  };

  const handleAddMember = async (teamId: string, value: string) => {
    if (!value.trim()) return;
    const token = localStorage.getItem("token");
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
    try {
      console.log(`[CLIENT] Adding member. teamId: ${teamId}, value: ${value}`);
      const res = await axios.post(
        `${apiBase}/api/teams/${teamId}/admin/members`,
        { value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[CLIENT] Add member success. Response:`, res.data);
      toast.success(res.data.message || "Đã thêm thành viên và gửi mail mời thành công!");
      if (onRefreshTeams) {
        console.log(`[CLIENT] Refreshing teams list...`);
        await onRefreshTeams();
      }
    } catch (err: any) {
      console.error("Add member error:", err);
      toast.error(err.response?.data?.message || "Lỗi khi thêm thành viên.");
    }
  };

  const handleDeleteMember = async (teamId: string, userId: string, name: string) => {
    const conformed = await conform({
      title: "Xóa thành viên",
      message: `Bạn có chắc chắn muốn xóa thành viên "${name}" khỏi đội không?`,
      variant: "danger",
    });
    if (!conformed) return;

    const token = localStorage.getItem("token");
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
    try {
      console.log(`[CLIENT] Deleting member. teamId: ${teamId}, userId: ${userId}`);
      const res = await axios.delete(
        `${apiBase}/api/teams/${teamId}/admin/members/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[CLIENT] Delete success. Response:`, res.data);
      toast.success(res.data.message || "Đã xóa thành viên thành công!");
      if (res.data.autoApproved) {
        toast.info("Đội thi đã tự động xác nhận do tất cả thành viên còn lại đều đã xác nhận!");
      }
      if (onRefreshTeams) {
        console.log(`[CLIENT] Refreshing teams list...`);
        await onRefreshTeams();
      } else {
        console.warn(`[CLIENT] onRefreshTeams prop is missing!`);
      }
    } catch (err: any) {
      console.error("Delete member error:", err);
      toast.error(err.response?.data?.message || "Lỗi khi xóa thành viên.");
    }
  };

  const handleSetLeader = async (teamId: string, userId: string) => {
    const conformed = await conform({
      title: "Bổ nhiệm Trưởng nhóm",
      message: `Bạn có chắc chắn muốn bổ nhiệm thành viên này làm Trưởng nhóm mới không? Trưởng nhóm cũ sẽ chuyển thành thành viên thường.`,
      variant: "warning",
    });
    if (!conformed) return;

    const token = localStorage.getItem("token");
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
    try {
      console.log(`[CLIENT] Setting leader. teamId: ${teamId}, userId: ${userId}`);
      const res = await axios.put(
        `${apiBase}/api/teams/${teamId}/admin/members/${userId}/role`,
        { role: "leader" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[CLIENT] Set leader success. Response:`, res.data);
      toast.success(res.data.message || "Đã chuyển đổi trưởng nhóm thành công!");
      if (res.data.autoApproved) {
        toast.info("Đội thi đã tự động xác nhận do tất cả thành viên còn lại đều đã xác nhận!");
      }
      if (onRefreshTeams) {
        console.log(`[CLIENT] Refreshing teams list...`);
        await onRefreshTeams();
      }
    } catch (err: any) {
      console.error("Set leader error:", err);
      toast.error(err.response?.data?.message || "Lỗi khi chuyển đổi trưởng nhóm.");
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const conformed = await conform({
      title: "Xóa vĩnh viễn đội thi",
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn đội thi "${teamName}" khỏi hệ thống không? Tất cả thành viên và dữ liệu liên quan sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu và không thể khôi phục.`,
      variant: "danger",
    });
    if (!conformed) return;

    const token = localStorage.getItem("token");
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
    try {
      console.log(`[CLIENT] Deleting team permanently. teamId: ${teamId}, teamName: ${teamName}`);
      const res = await axios.delete(
        `${apiBase}/api/teams/${teamId}/admin`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || `Đã xóa vĩnh viễn đội thi "${teamName}" thành công!`);
      if (onRefreshTeams) {
        await onRefreshTeams();
      }
    } catch (err: any) {
      console.error("Delete team error:", err);
      toast.error(err.response?.data?.message || "Lỗi khi xóa đội thi.");
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 font-mono">
            <Users size={18} className="text-[#F27024]" />
            <span>Đội thi & Thí sinh ({teamsList.length} đội)</span>
          </h3>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            onClick={handleExportTeams}
            disabled={exporting || teamsList.length === 0}
            className="text-xs font-bold px-4 py-2.5 rounded-xl font-mono transition-all flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer border border-slate-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} className="text-[#F27024]" />
            <span>{exporting ? "Đang xuất..." : "Xuất Excel"}</span>
          </button>

          {!readOnly && (
            <div className="flex flex-col items-stretch md:items-end gap-1">
              <button
                onClick={handleDistributeTeams}
                disabled={
                  loading ||
                  tracks.length === 0 ||
                  !teamsList.some((t) => t.status === "confirmed" && !t.trackId)
                }
                className={`text-xs font-bold px-4 py-2.5 rounded-xl font-mono transition-all flex items-center justify-center gap-1.5 ${
                  tracks.length > 0 &&
                  teamsList.some((t) => t.status === "confirmed" && !t.trackId)
                    ? "bg-[#F27024] hover:bg-[#d95f1d] text-white cursor-pointer shadow-md shadow-[#F27024]/20"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
              >
                Chia bảng ngẫu nhiên vào Track
              </button>
              {tracks.length === 0 && (
                <span className="text-[10px] text-rose-500 font-mono text-center md:text-right">
                  * Cần tạo Bảng đấu (Track) trước
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1" aria-label="Chế độ quản lý đội thi">
        <button type="button" onClick={() => setActiveTeamView("teams")} aria-pressed={activeTeamView === "teams"} className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#F27024]/40 ${activeTeamView === "teams" ? "bg-white text-[#F27024] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          Danh sách đội ({teamsList.length})
        </button>
        <button type="button" onClick={() => setActiveTeamView("contestants")} aria-pressed={activeTeamView === "contestants"} className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#F27024]/40 ${activeTeamView === "contestants" ? "bg-white text-[#F27024] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          Email thí sinh ({pendingContestants.length})
        </button>
      </nav>

      {activeTeamView === "contestants" && (
        <section className="space-y-4" aria-labelledby="contestant-email-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 id="contestant-email-title" className="text-sm font-bold text-slate-900">Quản lý email xác nhận</h4>
              <p className="mt-1 text-xs text-slate-500">Theo dõi và gửi lại lời mời cho các thí sinh chưa xác nhận.</p>
            </div>
            {!readOnly && <button type="button" onClick={() => handleSendMemberEmails()} disabled={sendingMemberIds.length > 0 || !pendingContestants.some((member: any) => !member.invitationEmailSent && canQueueEmail(member))} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F27024] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#d95f1d] focus:outline-none focus:ring-2 focus:ring-[#F27024]/40 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
              {sendingMemberIds.length > 0 ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Gửi tất cả email chưa gửi
            </button>}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-[#F27024] focus-within:ring-2 focus-within:ring-[#F27024]/10">
            <Search size={15} className="text-slate-400" aria-hidden="true" /><span className="sr-only">Tìm thí sinh</span>
            <input value={contestantSearch} onChange={(event) => setContestantSearch(event.target.value)} placeholder="Tìm theo tên, email, MSSV hoặc đội..." className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
          </label>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 font-bold">Thí sinh</th><th className="px-4 py-3 font-bold">Đội / Vai trò</th><th className="px-4 py-3 font-bold">Xác nhận</th><th className="px-4 py-3 font-bold">Email</th>{!readOnly && <th className="px-4 py-3 text-right font-bold">Thao tác</th>}</tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">{visibleContestants.map((member: any) => {
                const isSending = sendingMemberIds.includes(member._id);
                return <tr key={member._id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-800">{member.userId?.fullName || "Chưa cập nhật"}</p><p className="mt-0.5 text-slate-500">{member.userId?.email}</p></td>
                  <td className="px-4 py-3 text-slate-600"><p>{member.teamName}</p><p className="mt-0.5 text-[10px] uppercase text-slate-400">{member.role === "leader" ? "Trưởng nhóm" : "Thành viên"}</p></td>
                  <td className="px-4 py-3"><span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Chờ xác nhận</span></td>
                  <td className="px-4 py-3"><span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${getEmailStatus(member).className}`}>{getEmailStatus(member).label}</span>{member.invitationEmailLastError && <p className="mt-1 max-w-xs truncate text-[10px] text-rose-600" title={member.invitationEmailLastError}>{member.invitationEmailLastError}</p>}</td>
                  {!readOnly && <td className="px-4 py-3 text-right"><button type="button" onClick={() => handleSendMemberEmails([member._id])} disabled={sendingMemberIds.length > 0 || !canQueueEmail(member)} aria-label={`Gửi email lời mời cho ${member.userId?.fullName || member.userId?.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-1.5 font-bold text-[#F27024] transition-all hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 disabled:cursor-not-allowed disabled:opacity-50">{isSending || !canQueueEmail(member) ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}{canQueueEmail(member) ? (member.invitationEmailSent ? "Gửi lại" : "Gửi mail") : "Đang xử lý"}</button></td>}
                </tr>;
              })}</tbody>
            </table></div>
            {visibleContestants.length === 0 && <p className="px-4 py-10 text-center text-xs text-slate-500">Không có thí sinh chờ xác nhận phù hợp.</p>}
          </div>
        </section>
      )}

      {/* ─── IMPORT EXCEL SECTION FOR ADMIN (WHITE THEME) ─── */}
      {!readOnly && activeTeamView === "teams" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-[#F27024] uppercase tracking-wider font-mono flex items-center gap-2">
              <Upload size={15} />
              <span>Import Danh sách Đội thi từ Excel</span>
            </h4>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="text-xs font-mono text-slate-600 hover:text-[#F27024] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {downloadingTemplate ? (
                <Loader2 size={13} className="animate-spin text-[#F27024]" />
              ) : (
                <FileText size={13} className="text-[#F27024]" />
              )}
              <span>Tải file Excel mẫu</span>
            </button>
          </div>

          {/* Upload Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-8">
              <label className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-dashed border-slate-200 hover:border-[#F27024]/60 hover:bg-orange-50/20 rounded-2xl cursor-pointer transition-all group">
                <div className="p-2 rounded-xl bg-orange-50 group-hover:bg-orange-100/70 transition-colors">
                  <FileSpreadsheet
                    size={20}
                    className="text-[#F27024] shrink-0"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 font-mono truncate">
                    {importFile ? importFile.name : "Nhấn để chọn hoặc kéo thả file Excel (.xlsx, .xls)"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Form chuẩn: STT, MSSV, Họ và Tên, Tên Đội, Mail, Vai Trò, Trường
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] || null);
                    setImportResult(null);
                    setEmailStep(0);
                    setEmailResult(null);
                  }}
                />
              </label>
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportTeams}
                disabled={!importFile || importing}
                className="w-full text-xs font-bold px-5 py-3 rounded-xl font-mono text-white transition-all flex items-center justify-center gap-2 bg-[#F27024] hover:bg-[#d95f1d] cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none shadow-md shadow-[#F27024]/20 active:scale-[0.99]"
              >
                {importing ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>Đang xử lý dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    <span>Import Danh Sách</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Result Feedback */}
          {importResult && (hasPendingTeams || !importResult.success) && (
            <div
              className={`p-4 rounded-2xl text-xs space-y-2 animate-in fade-in duration-200 border relative ${
                importResult.success
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                  : "bg-rose-50/80 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold font-mono">
                  {importResult.success ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600" />
                  )}
                  <span>{importResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDismissImportResult}
                  className={`p-1 rounded-lg transition-all cursor-pointer ${
                    importResult.success
                      ? "hover:bg-emerald-200/60 text-emerald-700"
                      : "hover:bg-rose-200/60 text-rose-700"
                  }`}
                  title="Đóng thông báo"
                >
                  <X size={14} />
                </button>
              </div>

              {importResult.success && importResult.memberCount !== undefined && hasPendingTeams && (
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  ✓ Hệ thống đã tạo danh sách đội thi. Email mời tham gia đội hiện <strong>chưa được gửi</strong> (tránh quá tải). Hãy xác nhận 2 bước bên dưới để tiến hành gửi email.
                </p>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-rose-200/80 max-h-48 overflow-y-auto font-mono text-[11px]">
                  {importResult.errors.map((err, idx) => (
                    <p key={idx} className="text-rose-700">
                      • {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── 2-STEP CONFIRMATION EMAIL SENDING (WHITE/LIGHT THEME) ─── */}
          {hasPendingTeams && emailStep === 1 && (
            <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <AlertCircle size={16} />
                </div>
                <div className="space-y-1 flex-1">
                  <h5 className="text-xs font-bold text-amber-800 font-mono uppercase">
                    Bước 1/2: Xác nhận danh sách vừa import
                  </h5>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Vui lòng kiểm tra lại danh sách các đội thi vừa import ở bên dưới. Nhấn <strong>"Đã xác nhận"</strong> để mở khóa bước gửi email mời tham gia ({importResult?.memberCount || pendingContestants.length || 0} thí sinh bao gồm cả Trưởng nhóm & Thành viên).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmStep1}
                className="w-full text-xs font-bold font-mono py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 active:scale-[0.99]"
              >
                <CheckCircle2 size={15} />
                <span>ĐÃ XÁC NHẬN DANH SÁCH ĐỘI THI</span>
              </button>
            </div>
          )}

          {hasPendingTeams && emailStep === 2 && (
            <div className="p-5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-orange-100 text-[#F27024] shrink-0 mt-0.5">
                  <Mail size={16} />
                </div>
                <div className="space-y-1 flex-1">
                  <h5 className="text-xs font-bold text-[#F27024] font-mono uppercase">
                    Bước 2/2: Gửi email mời thí sinh vào đội
                  </h5>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Hệ thống sẽ gửi email mời qua hàng đợi (rate-limiting chống quá tải) tới toàn bộ <strong>{importResult?.memberCount || pendingContestants.length || 0} thí sinh (gồm cả Trưởng nhóm & Thành viên)</strong> để họ xác nhận và điền GitHub Username.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendInvitations}
                disabled={sendingEmails}
                className="w-full text-xs font-bold font-mono py-3.5 px-4 rounded-xl bg-[#F27024] hover:bg-[#d95f1d] text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#F27024]/25 active:scale-[0.99]"
              >
                {sendingEmails ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang gửi email mời theo hàng đợi...</span>
                  </>
                ) : (
                  <>
                    <Mail size={15} />
                    <span>GỬI EMAIL MỜI ({importResult?.memberCount || pendingContestants.length || 0} THÍ SINH)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Email Result Notification */}
          {emailResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{emailResult.message}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-emerald-700">
                  Thành công: <strong>{emailResult.sent} / {emailResult.total}</strong>
                  {emailResult.failed > 0 && ` (Thất bại: ${emailResult.failed})`}
                </span>
                <button
                  type="button"
                  onClick={handleDismissEmailResult}
                  className="p-1 rounded-lg hover:bg-emerald-200/60 text-emerald-700 transition-all cursor-pointer"
                  title="Đóng thông báo"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grouped lists */}
      {activeTeamView === "teams" && <div className="space-y-6">
        {/* 1. Confirmed Teams */}
        <div>
          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
            <span>
              ✓ Đội thi đã Xác nhận (
              {teamsList.filter((t) => t.status === "confirmed").length})
            </span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamsList
              .filter((t) => t.status === "confirmed")
              .map((team: any) => (
                <div
                  key={team._id}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-[#F27024] font-mono block">
                        ĐỘI THI
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm truncate" title={team.name}>
                        {team.name}
                      </h5>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {selectedEvent?.status !== "registration" &&
                        selectedEvent?.status !== "upcoming" &&
                        team.currentRoundId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold bg-orange-50 text-[#F27024] border border-orange-200 shrink-0">
                            {(() => {
                              if (typeof team.currentRoundId === "object") {
                                return team.currentRoundId?.name || "";
                              }
                              const rObj = (rounds || []).find(
                                (r: any) => r._id === team.currentRoundId,
                              );
                              return rObj ? rObj.name : team.currentRoundId;
                            })()}
                          </span>
                        )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold shrink-0 ${
                          team.trackId
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {team.trackId?.name
                          ? team.trackId.name.startsWith("Bảng")
                            ? team.trackId.name
                            : `Bảng ${team.trackId.name}`
                          : team.trackId
                            ? "Đã gán"
                            : "Chưa chia bảng"}
                      </span>
                    </div>
                  </div>

                  {/* Leader & Repo Info */}
                  <div className="text-xs text-slate-600 space-y-1.5 min-w-0">
                    <p className="truncate" title={`Trưởng nhóm: ${team.leaderId?.fullName || "Chưa thiết lập"} (${team.leaderId?.email || ""})`}>
                      Trưởng nhóm:{" "}
                      <strong className="text-slate-800 font-semibold">
                        {team.leaderId?.fullName || "Chưa thiết lập"}
                      </strong>{" "}
                      {team.leaderId?.email && (
                        <span className="text-slate-500 font-normal">({team.leaderId.email})</span>
                      )}
                    </p>
                    {team.mentorId && (
                      <p className="truncate" title={`Mentor: ${team.mentorId?.fullName || team.mentorId} ${team.mentorId?.email ? `(${team.mentorId.email})` : ""}`}>
                        Mentor:{" "}
                        <strong className="text-emerald-700 font-semibold">
                          {team.mentorId?.fullName || team.mentorId}
                        </strong>{" "}
                        {team.mentorId?.email && (
                          <span className="text-slate-500 font-normal">({team.mentorId.email})</span>
                        )}
                      </p>
                    )}
                    {team.repository ? (
                      <p className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="shrink-0">Repository:</span>
                        <a
                          href={team.repository.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F27024] hover:underline font-mono truncate max-w-[170px] sm:max-w-[220px]"
                          title={team.repository.repoName}
                        >
                          {team.repository.repoName}
                        </a>
                        {!readOnly && (
                          <button
                            onClick={() => handleSyncRepo(team.repository._id)}
                            disabled={
                              loading || syncingRepoId === team.repository._id
                            }
                            title="Đồng bộ commit và chạy AI đánh giá thủ công ngay lập tức"
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shrink-0 ${
                              syncingRepoId === team.repository._id
                                ? "bg-orange-100 text-orange-700 border-orange-200"
                                : "bg-orange-50 hover:bg-orange-100 text-[#F27024] border-orange-200"
                            }`}
                          >
                            <RefreshCw
                              size={10}
                              className={
                                syncingRepoId === team.repository._id
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                            <span>
                              {syncingRepoId === team.repository._id
                                ? "Đang đồng bộ..."
                                : "Đồng bộ AI"}
                            </span>
                          </button>
                        )}
                      </p>
                    ) : team.status === "confirmed" ? (
                      // Confirmed teams without a repo cannot be scored, so make it visible and fixable.
                      <p className="flex items-center gap-2 flex-wrap min-w-0 text-rose-600">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>Chưa có GitHub Repo (chưa thể chấm điểm)</span>
                        {!readOnly && (
                          <button
                            onClick={() => handleCreateRepo(team._id)}
                            disabled={loading || creatingRepoTeamId === team._id}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shrink-0 bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                          >
                            {creatingRepoTeamId === team._id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <RefreshCw size={10} />
                            )}
                            <span>
                              {creatingRepoTeamId === team._id ? "Đang tạo..." : "Tạo repo"}
                            </span>
                          </button>
                        )}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">
                        GitHub Repo: Chưa cấp phát (chờ đủ thành viên xác nhận)
                      </p>
                    )}
                  </div>

                  {/* Members */}
                  <div className="border-t border-slate-100 pt-2.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Thành viên ({team.members?.length || 0}):
                    </p>
                    <div className="space-y-1">
                      {team.members?.map((m: any) => {
                        const memberFullInfo = [
                          m.userId?.fullName || "Chưa cập nhật",
                          m.userId?.studentId ? `(${m.userId.studentId})` : "",
                          m.userId?.university ? `- ${m.userId.university}` : "",
                        ].filter(Boolean).join(" ");

                        return (
                          <div
                            key={m.userId?._id || m._id}
                            className="flex items-center justify-between text-xs gap-2 py-0.5 hover:bg-slate-50/80 px-1 rounded transition-colors"
                          >
                            {/* Cột trái: Tên + MSSV + Trường (truncate) + Nút/Badge vai trò (shrink-0) */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="text-slate-400 shrink-0 select-none">•</span>
                              <span
                                className="text-slate-700 truncate font-medium text-[11.5px]"
                                title={memberFullInfo}
                              >
                                {m.userId?.fullName || "Chưa cập nhật"}{" "}
                                {m.userId?.studentId && (
                                  <span className="text-slate-500 font-normal">({m.userId.studentId})</span>
                                )}{" "}
                                {m.userId?.university && (
                                  <span className="text-slate-500 font-normal">- {m.userId.university}</span>
                                )}
                              </span>

                              {m.role === "leader" ? (
                                <span className="text-[10px] font-bold text-[#F27024] bg-orange-50 border border-orange-200/80 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                                  Trưởng nhóm
                                </span>
                              ) : (
                                !readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetLeader(team._id, m.userId?._id)}
                                    className="text-[10px] text-[#F27024] hover:text-[#d65f1a] hover:bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200/60 font-semibold shrink-0 whitespace-nowrap transition-colors cursor-pointer"
                                    title="Bổ nhiệm làm Trưởng nhóm mới"
                                  >
                                    Lên Trưởng nhóm
                                  </button>
                                )
                              )}
                            </div>

                            {/* Cột phải: GitHub username + Nút xóa (shrink-0) */}
                            <div className="flex items-center gap-2 shrink-0 ml-1">
                              <span
                                className="text-slate-400 font-mono text-[11px] max-w-[85px] sm:max-w-[110px] truncate text-right shrink-0"
                                title={m.userId?.githubUsername || "Chưa liên kết Git"}
                              >
                                {m.userId?.githubUsername || "Chưa liên kết Git"}
                              </span>

                              {!readOnly && m.role !== "leader" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(team._id, m.userId?._id, m.userId?.fullName)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                                  title="Xóa thành viên khỏi nhóm"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!readOnly && (
                      <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100 flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Nhập Email hoặc MSSV để thêm..."
                          id={`add-member-input-${team._id}`}
                          className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#F27024] placeholder:text-slate-400 font-sans"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddMember(team._id, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const inputEl = document.getElementById(`add-member-input-${team._id}`) as HTMLInputElement;
                            if (inputEl && inputEl.value.trim()) {
                              handleAddMember(team._id, inputEl.value);
                              inputEl.value = "";
                            }
                          }}
                          className="shrink-0 bg-[#F27024] hover:bg-[#d65f1a] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors font-sans whitespace-nowrap cursor-pointer"
                        >
                          Thêm
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Assign Track controls */}
                  {!readOnly && (
                    <div className="border-t border-slate-100 pt-2.5 flex flex-col gap-1.5">
                      <p className="text-[10px] font-bold text-[#F27024] uppercase tracking-wider font-mono">
                        Phân chia / Thay đổi bảng đấu:
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAssignTrack(team._id, "random")}
                          disabled={loading || tracks.length === 0}
                          className="flex-1 bg-white hover:bg-orange-50 disabled:bg-slate-100 disabled:text-slate-400 text-xs text-[#F27024] font-bold py-1.5 px-3 rounded-xl font-mono transition-all flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed border border-orange-200"
                        >
                          Phân ngẫu nhiên
                        </button>

                        {tracks.length > 0 && (
                          <CustomSelect
                            value={team.trackId?._id || team.trackId || ""}
                            onChange={(val) => {
                              if (val) {
                                handleAssignTrack(team._id, val);
                              }
                            }}
                            disabled={loading}
                            options={tracks
                              .filter((track: any) => {
                                const currentTrackId =
                                  team.trackId?._id || team.trackId;
                                const isCurrentTrack =
                                  track._id === currentTrackId;
                                return (
                                  isCurrentTrack ||
                                  (track.name.toLowerCase() !==
                                    "bảng chung kết" &&
                                    !track.name
                                      .toLowerCase()
                                      .includes("chung kết"))
                                );
                              })
                              .map((track: any) => ({
                                value: track._id,
                                label: track.name.startsWith("Bảng")
                                  ? track.name
                                  : `Bảng ${track.name}`,
                              }))}
                            placeholder="-- Chọn Bảng đấu --"
                            className="flex-1"
                          />
                        )}
                      </div>
                      {tracks.length === 0 && (
                        <p className="text-[9px] text-rose-500 font-mono italic">
                          * Cần tạo Bảng đấu (Track) trước
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            {teamsList.filter((t) => t.status === "confirmed").length === 0 && (
              <p className="col-span-2 text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                Chưa có đội thi nào xác nhận hoàn tất.
              </p>
            )}
          </div>
        </div>

        {/* 2. Pending Teams */}
        <div>
          <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider font-mono mb-3">
            Đội thi đang chờ xác nhận (
            {teamsList.filter((t) => t.status === "pending_confirm").length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamsList
              .filter((t) => t.status === "pending_confirm")
              .map((team: any) => (
                <div
                  key={team._id}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-[#F27024] font-mono block">
                        ĐỘI CHỜ DUYỆT
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm truncate" title={team.name}>
                        {team.name}
                      </h5>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-mono font-bold shrink-0">
                        Chờ duyệt
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTeam(team._id, team.name)}
                          className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 transition-colors cursor-pointer shrink-0"
                          title="Xóa vĩnh viễn đội thi khỏi hệ thống"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Leader & Repo Info */}
                  <div className="text-xs text-slate-600 space-y-1.5 min-w-0">
                    <p className="truncate" title={`Trưởng nhóm: ${team.leaderId?.fullName || "Chưa thiết lập"} (${team.leaderId?.email || ""})`}>
                      Trưởng nhóm:{" "}
                      <strong className="text-slate-800 font-semibold">
                        {team.leaderId?.fullName || "Chưa thiết lập"}
                      </strong>{" "}
                      {team.leaderId?.email && (
                        <span className="text-slate-500 font-normal">({team.leaderId.email})</span>
                      )}
                    </p>
                    {team.repository ? (
                      <p className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="shrink-0">Repository:</span>
                        <a
                          href={team.repository.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F27024] hover:underline font-mono truncate max-w-[170px] sm:max-w-[220px]"
                          title={team.repository.repoName}
                        >
                          {team.repository.repoName}
                        </a>
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">
                        GitHub Repo: Chưa cấp phát (chờ chia bảng)
                      </p>
                    )}
                  </div>

                  {/* Members with status */}
                  <div className="border-t border-slate-100 pt-2.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Thành viên ({team.members?.length || 0}):
                    </p>
                    <div className="space-y-1">
                      {team.members?.map((m: any) => {
                        const memberFullInfo = [
                          m.userId?.fullName || "Chưa cập nhật",
                          m.userId?.studentId ? `(${m.userId.studentId})` : "",
                          m.userId?.university ? `- ${m.userId.university}` : "",
                        ].filter(Boolean).join(" ");

                        return (
                          <div
                            key={m.userId?._id || m._id}
                            className="flex items-center justify-between text-xs gap-2 py-0.5 hover:bg-slate-50/80 px-1 rounded transition-colors"
                          >
                            {/* Cột trái: Tên + MSSV + Trường (truncate) + Nút/Badge vai trò (shrink-0) */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="text-slate-400 shrink-0 select-none">•</span>
                              <span
                                className="text-slate-700 truncate font-medium text-[11.5px]"
                                title={memberFullInfo}
                              >
                                {m.userId?.fullName || "Chưa cập nhật"}{" "}
                                {m.userId?.studentId && (
                                  <span className="text-slate-500 font-normal">({m.userId.studentId})</span>
                                )}{" "}
                                {m.userId?.university && (
                                  <span className="text-slate-500 font-normal">- {m.userId.university}</span>
                                )}
                              </span>

                              {m.role === "leader" ? (
                                <span className="text-[10px] font-bold text-[#F27024] bg-orange-50 border border-orange-200/80 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                                  Trưởng nhóm
                                </span>
                              ) : (
                                !readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetLeader(team._id, m.userId?._id)}
                                    className="text-[10px] text-[#F27024] hover:text-[#d65f1a] hover:bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200/60 font-semibold shrink-0 whitespace-nowrap transition-colors cursor-pointer"
                                    title="Bổ nhiệm làm Trưởng nhóm mới"
                                  >
                                    Lên Trưởng nhóm
                                  </button>
                                )
                              )}
                            </div>

                            {/* Cột phải: Badge trạng thái + Nút gửi mail + Nút xóa (shrink-0) */}
                            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap ${
                                  m.confirmStatus === "confirmed"
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : "text-amber-700 bg-amber-50 border-amber-200"
                                }`}
                              >
                                {m.confirmStatus === "confirmed"
                                  ? "Đã nhận"
                                  : "Chờ xác nhận"}
                              </span>

                              {!readOnly && m.confirmStatus === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleSendMemberEmails([m._id])}
                                  disabled={sendingMemberIds.length > 0 || !canQueueEmail(m)}
                                  className="inline-flex items-center gap-1 rounded-md border border-orange-200 px-1.5 py-0.5 text-[10px] font-bold text-[#F27024] transition-colors hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 disabled:cursor-not-allowed disabled:opacity-50 shrink-0 cursor-pointer"
                                  title={m.invitationEmailSent ? "Gửi lại email lời mời" : "Gửi email lời mời"}
                                >
                                  {sendingMemberIds.includes(m._id) || !canQueueEmail(m) ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <Mail size={11} />
                                  )}
                                  <span>{canQueueEmail(m) ? (m.invitationEmailSent ? "Gửi lại" : "Gửi mail") : "Đang xử lý"}</span>
                                </button>
                              )}

                              {!readOnly && m.role !== "leader" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(team._id, m.userId?._id, m.userId?.fullName)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                                  title="Xóa thành viên khỏi nhóm"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!readOnly && (
                      <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100 flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Nhập Email hoặc MSSV để thêm..."
                          id={`add-member-input-${team._id}`}
                          className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#F27024] placeholder:text-slate-400 font-sans"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddMember(team._id, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const inputEl = document.getElementById(`add-member-input-${team._id}`) as HTMLInputElement;
                            if (inputEl && inputEl.value.trim()) {
                              handleAddMember(team._id, inputEl.value);
                              inputEl.value = "";
                            }
                          }}
                          className="shrink-0 bg-[#F27024] hover:bg-[#d65f1a] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors font-sans whitespace-nowrap cursor-pointer"
                        >
                          Thêm
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            {teamsList.filter((t) => t.status === "pending_confirm").length ===
              0 && (
                <p className="col-span-2 text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                  Không có nhóm nào ở trạng thái chờ xác nhận.
                </p>
              )}
          </div>
        </div>
      </div>}
    </div>
  );
}
