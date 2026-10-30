import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  FolderKanban,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Users,
  Edit,
  Trash2,
  ExternalLink,
  Crown,
  BriefcaseBusiness,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useConform } from "../shared/ModalConform";
import CustomSelect from "../shared/CustomSelect";

interface TracksTabProps {
  selectedEvent: any;
  tracks: any[];
  trackName: string;
  setTrackName: (val: string) => void;
  trackDesc: string;
  setTrackDesc: (val: string) => void;
  trackAiBrief: string | null;
  setTrackAiBrief: (val: string | null) => void;
  trackMax: string;
  setTrackMax: (val: string) => void;
  trackAdvanceTopN: string;
  setTrackAdvanceTopN: (val: string) => void;
  trackRoundId: string;
  setTrackRoundId: (val: string) => void;
  handleCreateTrack: (e: React.FormEvent) => Promise<void>;
  selectedTrack: any;
  setSelectedTrack: (track: any) => void;
  editingTrack: any;
  setEditingTrack: (track: any) => void;
  handleUpdateTrack: (e: React.FormEvent) => Promise<void>;
  handleDeleteTrack: (trackId: string) => Promise<void>;
  rounds: any[];
  setSelectedRubricRoundId: (id: string) => void;
  setRubric: (rubric: any) => void;
  setCriteria: (criteria: any[]) => void;

  loading: boolean;

  // Event roles and judge assignment props
  eventRoles?: any[];
  handleAssignRoleForTrack?: (
    email: string,
    trackId: string,
    role?: "judge" | "mentor",
    teamId?: string,
    isChiefJudge?: boolean,
  ) => Promise<void>;
  handleRemoveRole?: (roleId: string) => Promise<void>;

  // Team mentor assignment props
  teamsList?: any[];
  allUsers?: any[];
  token: string | null;
  fetchEventDetails?: () => Promise<void>;
  readOnly?: boolean;
}

const formatTrackName = (name: string) => {
  if (!name) return "";
  const trimmed = name.trim();
  if (/^bảng\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Bảng ${trimmed}`;
};

const isFinalRound = (round: any) => {
  const name = String(round?.name || "").toLowerCase();
  return (
    round?.advanceTopN === 0 ||
    name.includes("chung kết") ||
    name.includes("chung ket") ||
    name === "final"
  );
};

// Personnel assignment is temporarily centralized in Admin > Quản lý nhân sự.
const SHOW_TRACK_PERSONNEL_ACTIONS = false;

export default function TracksTab({
  selectedEvent,
  tracks,
  trackName,
  setTrackName,
  setTrackDesc,
  trackAiBrief,
  setTrackAiBrief,
  trackMax,
  setTrackMax,
  trackAdvanceTopN,
  setTrackAdvanceTopN,
  trackRoundId,
  setTrackRoundId,
  handleCreateTrack,
  selectedTrack,
  setSelectedTrack,
  editingTrack,
  setEditingTrack,
  handleUpdateTrack,
  handleDeleteTrack,
  rounds,
  setSelectedRubricRoundId,
  setRubric,
  setCriteria,

  eventRoles = [],
  handleAssignRoleForTrack,
  handleRemoveRole,
  teamsList = [],
  allUsers = [],
  token,
  fetchEventDetails,
  readOnly = false,
}: TracksTabProps) {
  const [judgeEmail, setJudgeEmail] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [accountSuggestions, setAccountSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [memberRole, setMemberRole] = useState<"judge" | "mentor">("judge");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [isChiefJudge, setIsChiefJudge] = useState(false);
  const [isCreateTrackOpen, setIsCreateTrackOpen] = useState(false);
  const isFormVisible = editingTrack ? true : isCreateTrackOpen;

  // The AI brief is excluded from track listings, so fetch it separately when editing.
  const loadTrackAiBrief = async (trackId: string) => {
    setTrackAiBrief(null);
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}/tracks/${trackId}/ai-brief`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setTrackAiBrief(res.data.aiBrief || "");
    } catch (err: any) {
      // Leave it null so saving the form does not overwrite the stored brief.
      toast.error(err.response?.data?.message || "Không tải được mô tả đề cho AI.");
    }
  };
  const conform = useConform();
  // Import judges via Excel
  const handleImportJudges = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEvent) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", selectedEvent._id);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/import-judges", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      toast.success(res.data.message || "Import Giám khảo thành công!");
      if (fetchEventDetails) await fetchEventDetails();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || "Lỗi import Giám khảo.";
      const detailedErrors = err.response?.data?.errors;
      if (detailedErrors && detailedErrors.length > 0) {
        toast.error(`${errMsg} Chi tiết: ${detailedErrors.join(", ")}`);
      } else {
        toast.error(errMsg);
      }
    }
  };

  // Drive upload state
  const [driveFileName, setDriveFileName] = useState("");
  const [driveFileUrl, setDriveFileUrl] = useState("");
  const [uploadingDrive, setUploadingDrive] = useState(false);

  const handleUploadDriveForTrack = async () => {
    if (!selectedTrack || !driveFileName || !driveFileUrl) return;
    setUploadingDrive(true);
    try {
      await axios.post(
        `http://localhost:5000/api/events/${selectedEvent._id}/upload-exam`,
        {
          fileName: driveFileName,
          fileUrl: driveFileUrl,
          trackId: selectedTrack._id,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        `Đã lưu link Drive riêng cho bảng "${selectedTrack.name}"!`,
      );
      setDriveFileName("");
      setDriveFileUrl("");
      if (fetchEventDetails) await fetchEventDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi lưu link Drive.");
    } finally {
      setUploadingDrive(false);
    }
  };

  const maxEventTeams = selectedEvent?.maxTeams || 0;
  const finalRound = rounds.find(isFinalRound);
  const finalRoundId = finalRound?._id || finalRound?.id;
  const availableTrackRounds = useMemo(
    () => rounds.filter((r: any) => !isFinalRound(r)),
    [rounds],
  );
  const isDefaultFinalRoundTrack = (track: any) => {
    const trackRoundId = track.roundId?._id || track.roundId;
    return Boolean(
      trackRoundId &&
      finalRoundId &&
      trackRoundId.toString() === finalRoundId.toString(),
    );
  };
  const totalAllocatedTeams = tracks
    .filter((t: any) => {
      const tRoundId = t.roundId?._id || t.roundId;
      return tRoundId && tRoundId.toString() !== finalRoundId?.toString();
    })
    .reduce((sum: number, t: any) => sum + (t.maxTeams || 0), 0);
  const remainingTeams = maxEventTeams - totalAllocatedTeams;

  const displayableTracks = useMemo(
    () => tracks,
    [tracks],
  );

  useEffect(() => {
    if (displayableTracks.length > 0 && !selectedTrack) {
      setSelectedTrack(displayableTracks[0]);
    }
  }, [displayableTracks, selectedTrack, setSelectedTrack]);

  const trackMembers = eventRoles.filter((role: any) => {
    if (role.role !== "judge" && role.role !== "mentor") return false;
    const roleTrackId = role.trackId?._id || role.trackId;
    const roleRoundId = role.roundId?._id || role.roundId;
    const selectedTrackRoundId = selectedTrack?.roundId?._id || selectedTrack?.roundId;

    if (roleTrackId) {
      return String(roleTrackId) === String(selectedTrack?._id);
    }
    if (roleRoundId && selectedTrackRoundId) {
      return String(roleRoundId) === String(selectedTrackRoundId);
    }
    return false;
  });

  useEffect(() => {
    if (editingTrack || !trackRoundId) return;
    const hasAllowedRound = availableTrackRounds.some(
      (r: any) => r._id === trackRoundId,
    );
    if (!hasAllowedRound) setTrackRoundId("");
  }, [availableTrackRounds, editingTrack, setTrackRoundId, trackRoundId]);
  useEffect(() => {
    const query = judgeEmail.trim();
    if (!showSuggestions || query.length < 2 || !token || allUsers.length > 0) {
      setAccountSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await axios.get(
          `http://localhost:5000/api/auth/users?search=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!cancelled) {
          setAccountSuggestions(
            (res.data || []).filter((user: any) => !user.isSystemAdmin),
          );
        }
      } catch (err) {
        if (!cancelled) setAccountSuggestions([]);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [allUsers.length, judgeEmail, showSuggestions, token]);

  const filteredUsers = useMemo(() => {
    const query = judgeEmail.trim().toLowerCase();
    if (!query) return [];

    const sourceUsers = allUsers.length > 0 ? allUsers : accountSuggestions;
    return sourceUsers
      .filter((user: any) => {
        const emailLower = String(user.email || "").toLowerCase();
        const fullNameLower = String(user.fullName || "").toLowerCase();
        return emailLower.includes(query) || fullNameLower.includes(query);
      })
      .slice(0, 6);
  }, [accountSuggestions, allUsers, judgeEmail]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Column 1: Tracks List & Form */}
      <div className="glass p-6 rounded-2xl flex flex-col justify-between">
        <div>
          <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
            <FolderKanban size={16} className="text-cyan-400" />
            <span>Các bảng đấu (Tracks)</span>
          </h3>
          <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto pr-1">
            {displayableTracks.map((t: any) => (
              <div
                key={t._id}
                className={`w-full p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${selectedTrack?._id === t._id
                  ? "bg-orange-500/10 border-orange-500/50 text-slate-900 dark:text-orange-300 font-bold shadow-xs"
                  : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:border-orange-500/40 text-slate-900 dark:text-slate-300 shadow-xs"
                  }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTrack(t);
                    // Auto select the round of this track
                    const roundOfTrack = rounds.find(
                      (r) => r._id === t.roundId,
                    );
                    if (roundOfTrack) {
                      setSelectedRubricRoundId(roundOfTrack._id);
                    } else {
                      setSelectedRubricRoundId("");
                      setRubric(null);
                      setCriteria([]);
                    }
                  }}
                  className="text-left flex-1 cursor-pointer"
                >
                  <div className="block">
                    <strong className="text-slate-950 dark:text-white font-black text-sm text-track-title">
                      {formatTrackName(t.name)}
                    </strong>
                    {!t.name.toLowerCase().includes("chung kết") && (
                      <span className="text-slate-600 dark:text-slate-400 font-normal text-xs ml-1">
                        (Tối đa {t.maxTeams} đội)
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    Vòng:{" "}
                    {rounds.find((r) => r._id === t.roundId)?.name ||
                      "Chưa gán"}
                  </span>
                </button>
                <div className="flex items-center gap-2.5 ml-2 shrink-0">
                  {!readOnly && !isDefaultFinalRoundTrack(t) && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTrack(t);
                          setTrackRoundId(t.roundId);
                          setTrackName(t.name);
                          setTrackMax(t.maxTeams.toString());
                          setTrackAdvanceTopN(
                            t.advanceTopN ? t.advanceTopN.toString() : "",
                          );
                          setTrackDesc(t.description || "");
                          loadTrackAiBrief(t._id);
                        }}
                        className="text-slate-400 hover:text-cyan-400 transition-colors p-1 cursor-pointer"
                        title="Chỉnh sửa bảng đấu"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const conformed = await conform({
                            title: "Xóa bảng đấu",
                            message: `Bạn có chắc chắn muốn xóa bảng đấu "${t.name}"?`,
                            variant: "danger",
                          });
                          if (conformed) {
                            handleDeleteTrack(t._id);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title="Xóa bảng đấu"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <ChevronRight
                    size={14}
                    className={
                      selectedTrack?._id === t._id
                        ? "text-cyan-400"
                        : "text-slate-600"
                    }
                  />
                </div>
              </div>
            ))}
            {displayableTracks.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                Chưa có bảng đấu nào.
              </p>
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            {/* Header trigger span */}
            <div
              onClick={() => setIsCreateTrackOpen(!isCreateTrackOpen)}
              className="flex items-center justify-between cursor-pointer group py-1 select-none"
            >
              <span className="text-xs font-bold text-slate-300 group-hover:text-cyan-400 transition-colors flex items-center gap-1.5 font-mono">
                {isFormVisible ? (
                  <ChevronDown size={15} className="text-cyan-400" />
                ) : (
                  <ChevronRight size={15} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
                )}
                {editingTrack
                  ? `Cập nhật bảng đấu [${editingTrack.name}]`
                  : "Tạo thêm bảng đấu"}
              </span>
              {!editingTrack && (
                <span className="text-[14px] font-mono text-cyan-400/90 group-hover:text-cyan-300 text-cyan-400/90 border text-cyan-400/90 px-2 py-0.5 rounded-full transition-all">
                  {isFormVisible ? "Thu gọn" : "+ Thêm bảng đấu"}
                </span>
              )}
            </div>

            {/* Expandable Form Body */}
            {isFormVisible && (
              <form
                onSubmit={editingTrack ? handleUpdateTrack : handleCreateTrack}
                className="space-y-3.5 pt-1 animate-fadeIn"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                    Chọn Vòng thi
                  </label>
                  <CustomSelect
                    value={trackRoundId}
                    onChange={(val) => setTrackRoundId(val)}
                    options={availableTrackRounds.map((r: any) => ({
                      value: r._id,
                      label: `${r.name} (Vòng ${r.order})${r.status === "completed" ? " - Đã kết thúc" : ""}`,
                      disabled: r.status === "completed",
                    }))}
                    placeholder="-- Chọn Vòng thi --"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                    Tên bảng đấu
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tên bảng đấu (e.g. AI & IoT)"
                    value={trackName}
                    onChange={(e) => setTrackName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                    Số lượng đội tối đa{" "}
                    {maxEventTeams > 0
                      ? editingTrack
                        ? `(Còn lại: ${remainingTeams + (editingTrack.maxTeams || 0)} / ${maxEventTeams} đội)`
                        : `(Còn lại: ${remainingTeams} / ${maxEventTeams} đội)`
                      : ""}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Số lượng đội tối đa (e.g. 5)"
                    value={trackMax}
                    onChange={(e) => setTrackMax(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                    Số đội lấy đi tiếp (N đội cao điểm nhất)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Số đội đi tiếp (e.g. 3)"
                    value={trackAdvanceTopN}
                    onChange={(e) => setTrackAdvanceTopN(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                    Mô tả đề cho AI chấm (bảo mật, thí sinh không thấy)
                  </label>
                  <textarea
                    rows={6}
                    disabled={trackAiBrief === null}
                    placeholder={trackAiBrief === null ? "Đang tải..." : "Mục tiêu, pipeline, đầu vào/đầu ra, yêu cầu tối thiểu, ghi chú chấm của track. Để trống nếu chưa có đề chính thức."}
                    value={trackAiBrief ?? ""}
                    onChange={(e) => setTrackAiBrief(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 disabled:opacity-50"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer font-mono transition-colors"
                  >
                    {editingTrack ? "Lưu thay đổi" : "+ Thêm Bảng đấu"}
                  </button>
                  {editingTrack && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTrack(null);
                        setTrackRoundId("");
                        setTrackName("");
                        setTrackMax("");
                        setTrackAdvanceTopN("");
                        setTrackDesc("");
                        setTrackAiBrief("");
                      }}
                      className="px-4 py-2 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer font-mono transition-all"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Column 2: Attachments & Judges list stack */}
      <div className="space-y-6">
        {/* Drive Upload Card — gắn link Drive cho bảng đấu đang chọn (Không hiển thị ở Bảng Chung Kết) */}
        {selectedTrack && !isDefaultFinalRoundTrack(selectedTrack) && (
          <div className="glass p-6 rounded-2xl space-y-4">
            <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-mono border-b border-slate-200 dark:border-slate-800/80 pb-3">
              <BookOpen size={16} className="text-orange-500" />
              <span>Đề bài & Tài liệu</span>
              {selectedTrack && (
                <span className="ml-auto text-xs font-bold text-orange-500 border border-orange-500/30 bg-orange-500/10 px-3 py-1 rounded font-mono uppercase tracking-wider">
                  {formatTrackName(selectedTrack.name)}
                </span>
              )}
            </h3>

            {(() => {
              // Đọc trực tiếp từ track — mỗi bảng có link riêng
              const currentUrl = selectedTrack.examDriveFileUrl;
              const currentName = selectedTrack.examDriveFileName;
              return (
                <div className="space-y-3">
                  {/* Hiển thị link đã gắn */}
                  {currentUrl ? (
                    <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-xl border border-emerald-500/30 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          Drive riêng — Chỉ bảng này
                        </p>
                      </div>
                      <p className="text-xs font-black text-[#0f172a] dark:text-white">
                        {currentName}
                      </p>
                      <a
                        href={currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-orange-500 hover:text-orange-600 font-mono truncate max-w-full"
                      >
                        <ExternalLink size={10} />
                        {currentUrl.length > 50
                          ? currentUrl.slice(0, 50) + "…"
                          : currentUrl}
                      </a>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-950/20 rounded-xl border border-amber-800/30">
                      <p className="text-[10px] text-amber-400 italic font-sans">
                        Bảng <strong>{selectedTrack.name}</strong> chưa có link
                        Drive riêng nào.
                      </p>
                    </div>
                  )}

                  {/* Form upload mới */}
                  {!readOnly && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        {currentUrl
                          ? "Cập nhật link Drive riêng:"
                          : "Gắn link Drive riêng cho bảng này:"}
                      </p>
                      <input
                        type="text"
                        placeholder="VD: Đề Bảng AI & IoT - Vòng Sơ loại"
                        value={driveFileName}
                        onChange={(e) => setDriveFileName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={driveFileUrl}
                        onChange={(e) => setDriveFileUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                      <p className="text-[9px] text-amber-400 font-sans">
                        Đặt Drive là <strong>"Anyone with the link"</strong> rồi
                        mới paste link vào đây.
                      </p>
                      <button
                        type="button"
                        disabled={
                          uploadingDrive || !driveFileName || !driveFileUrl
                        }
                        onClick={handleUploadDriveForTrack}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        {uploadingDrive
                          ? "Đang lưu..."
                          : "Lưu Link Drive Riêng"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Judge Assignment Card */}
        {selectedTrack ? (
          <div className="glass p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-1.5 font-mono">
                <Users size={16} className="text-cyan-400" />
                <span>
                  Ban chuyên môn (
                  <span className="text-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.35)]">
                    {formatTrackName(selectedTrack.name)}
                  </span>
                  )
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <Link
                  to="/admin/personnel"
                  className="flex items-center gap-1.5 bg-slate-900 border border-cyan-500/30 hover:border-cyan-400/50 text-[10px] font-mono font-bold text-cyan-400 px-3 py-1.5 rounded-lg transition-all hover:bg-cyan-500/10 hover:shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                >
                  <BriefcaseBusiness size={12} />
                  <span>Quản lý nhân sự</span>
                </Link>
                {SHOW_TRACK_PERSONNEL_ACTIONS && !readOnly && (
                  <label className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] font-mono font-bold text-slate-300 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all hover:bg-slate-800">
                    <span>Import Giám khảo</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      className="hidden"
                      onChange={handleImportJudges}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* List of judges and mentors */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {trackMembers.map((role: any) => {
                const mentoredTeam = teamsList.find(
                  (t) =>
                    String(t.mentorId?._id || t.mentorId) ===
                    String(role.userId?._id || role.userId),
                );
                return (
                  <div
                    key={role._id}
                    className="p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/60 text-xs flex justify-between items-center font-sans"
                  >
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-bold text-slate-200">
                          {role.userId?.fullName || "Chưa rõ tên"}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {role.userId?.email}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${role.role === "judge" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"}`}
                        >
                          {role.role === "judge" ? "Giám khảo" : "Mentor"}
                        </span>
                        {role.role === "judge" && role.isChiefJudge && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-400" />
                            Chủ tịch
                          </span>
                        )}
                        {role.role === "mentor" && mentoredTeam && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                            Đội: {mentoredTeam.name}
                          </span>
                        )}
                      </div>
                    </div>
                    {SHOW_TRACK_PERSONNEL_ACTIONS && handleRemoveRole && !readOnly && (
                      <button
                        onClick={() => handleRemoveRole(role._id)}
                        className="text-rose-500 hover:text-rose-400 font-bold text-[9px] uppercase font-mono border border-rose-500/10 hover:border-rose-500/30 px-2 py-0.5 rounded bg-rose-500/5 cursor-pointer animate-all"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                );
              })}
              {trackMembers.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2 text-center font-sans">
                  Chưa có giám khảo hay mentor nào được phân cho bảng này.
                </p>
              )}
            </div>

            {/* Form to add member */}
            {SHOW_TRACK_PERSONNEL_ACTIONS && handleAssignRoleForTrack && !readOnly && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!judgeEmail) return;
                  await handleAssignRoleForTrack(
                    judgeEmail,
                    selectedTrack._id,
                    memberRole,
                    selectedTeamId || undefined,
                    memberRole === "judge" ? isChiefJudge : false,
                  );
                  setJudgeEmail("");
                  setSelectedTeamId("");
                  setIsChiefJudge(false);
                }}
                className="space-y-3.5 pt-3 border-t border-slate-800/80"
              >
                <div className="flex gap-4 items-center">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Phân quyền:
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                    <input
                      type="radio"
                      name="memberRole"
                      value="judge"
                      checked={memberRole === "judge"}
                      onChange={() => setMemberRole("judge")}
                      className="accent-cyan-500"
                    />
                    Giám khảo
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                    <input
                      type="radio"
                      name="memberRole"
                      value="mentor"
                      checked={memberRole === "mentor"}
                      onChange={() => setMemberRole("mentor")}
                      className="accent-cyan-500"
                    />
                    Mentor
                  </label>
                  {memberRole === "judge" && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300 ml-auto">
                      <input
                        type="checkbox"
                        checked={isChiefJudge}
                        onChange={(e) => setIsChiefJudge(e.target.checked)}
                        className="accent-cyan-500 rounded border-slate-800"
                      />
                      Chủ tịch Hội đồng
                    </label>
                  )}
                </div>

                <div className="flex gap-2 relative">
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      required
                      placeholder="email@domain.com"
                      value={judgeEmail}
                      onChange={(e) => {
                        setJudgeEmail(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() =>
                        setTimeout(() => setShowSuggestions(false), 200)
                      }
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                    {showSuggestions &&
                      (loadingSuggestions || filteredUsers.length > 0) && (
                        <div className="absolute left-0 right-0 bottom-full mb-1 z-50 max-h-45 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-xl divide-y divide-slate-800/60">
                          {loadingSuggestions && filteredUsers.length === 0 && (
                            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                              Đang tìm tài khoản...
                            </div>
                          )}
                          {filteredUsers.map((user: any) => (
                            <button
                              key={user._id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setJudgeEmail(user.email);
                                setShowSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-slate-800 text-slate-300 hover:text-white transition-colors block cursor-pointer"
                            >
                              <span className="font-semibold">
                                {user.fullName}
                              </span>{" "}
                              ({user.email})
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                  <button
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer font-mono whitespace-nowrap transition-colors"
                  >
                    + Phân công
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="glass p-6 rounded-2xl text-center py-10 text-slate-500 font-mono border-dashed border-slate-800">
            <Users size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs">
              Chọn một bảng đấu ở cột bên trái để quản lý Ban chuyên môn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
