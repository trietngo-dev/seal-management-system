import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import XLSXStyle from "xlsx-js-style";
import { BriefcaseBusiness, CheckCircle2, Download, FileSpreadsheet, Loader2, Pencil, RefreshCw, Save, ShieldCheck, Trash2, Upload, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useConform } from "../shared/ModalConform";
import CustomSelect from "../shared/CustomSelect";

type PersonnelRow = {
  fullName: string;
  email: string;
  password: string;
  unit: string;
  role: "judge" | "mentor";
  isChiefJudge: boolean;
  existingStatus?: "pending" | "accepted" | "rejected";
  existingInvitationId?: string;
  roundName: string;
  trackName: string;
  note: string;
};

const statusMap: Record<string, string> = {
  draft: "Bản nháp",
  registration: "Mở đăng ký",
  prepare: "Chuẩn bị",
  ongoing: "Đang diễn ra",
  closed: "Đã kết thúc",
  archived: "Lưu trữ",
};

export default function PersonnelManagement() {
  const conform = useConform();
  const { readOnly = false, roles: userRoles = [], user } = useOutletContext<{
    readOnly?: boolean;
    roles?: any[];
    user?: any;
  }>();
  const token = localStorage.getItem("token");
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [event, setEvent] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [preview, setPreview] = useState<PersonnelRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isPreviewConfirmed, setIsPreviewConfirmed] = useState(false);
  const [isImportingPersonnel, setIsImportingPersonnel] = useState(false);
  const [isAccountActionLoading, setIsAccountActionLoading] = useState(false);
  const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null);
  const [personnelDraft, setPersonnelDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const eventsRes = await axios.get("http://localhost:5000/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      let availableEvents = eventsRes.data || [];
      if (!user?.isSystemAdmin && (readOnly || userRoles.length > 0)) {
        const assignedIds = new Set(
          userRoles.map((role: any) => String(role.eventId?._id || role.eventId))
        );
        availableEvents = availableEvents.filter((e: any) => assignedIds.has(String(e._id)));
      }
      setEvents(availableEvents);

      setSelectedEventId((prev) => {
        if (prev && availableEvents.some((e: any) => e._id === prev)) {
          return prev;
        }
        const PERSONNEL_ALLOWED_STATUSES = ["draft", "registration", "prepare", "ongoing"];
        const activeEvent = availableEvents.find(
          (item: any) => PERSONNEL_ALLOWED_STATUSES.includes(item.status) && !item.isArchived,
        );
        return activeEvent?._id || availableEvents[0]?._id || "";
      });
    } catch (error) {
      console.error("Load events error", error);
      toast.error("Không thể tải danh sách sự kiện.");
    } finally {
      setLoading(false);
    }
  };

  const loadPersonnelData = async (eventId: string) => {
    if (!eventId) {
      setEvent(null);
      setRoles([]);
      setInvitations([]);
      setRounds([]);
      setTracks([]);
      return;
    }
    try {
      setIsRefreshing(true);
      const [rolesRes, invitationsRes, eventDetailsRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/events/${eventId}/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`http://localhost:5000/api/personnel-invitations/event/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`http://localhost:5000/api/events/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const eventData = eventDetailsRes.data?.event || eventDetailsRes.data;
      setEvent(eventData);
      setRoles(rolesRes.data.filter((item: any) => ["judge", "mentor"].includes(item.role)));
      setInvitations(invitationsRes.data || []);
      setRounds(eventDetailsRes.data?.rounds || eventData?.rounds || []);
      setTracks(eventDetailsRes.data?.tracks || eventData?.tracks || []);
    } catch (error) {
      console.error("Load personnel data error", error);
      toast.error("Không thể tải danh sách nhân sự sự kiện.");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [readOnly, userRoles, user?.isSystemAdmin]);

  useEffect(() => {
    if (selectedEventId) {
      loadPersonnelData(selectedEventId);
    }
  }, [selectedEventId]);

  const handleEventChange = (newEventId: string) => {
    setSelectedEventId(newEventId);
    setPreview([]);
    setFileName("");
    setIsPreviewConfirmed(false);
    setEditingPersonnelId(null);
    setPersonnelDraft(null);
  };

  const eventOptions = useMemo(() => {
    return events.map((e: any) => {
      const statusText = statusMap[e.status] || e.status;
      return {
        value: e._id,
        label: `${e.name} · ${e.semester} ${e.year} (${statusText})`,
      };
    });
  }, [events]);

  const downloadTemplate = () => {
    if (!event) {
      toast.error("Không có sự kiện đang hoạt động để tạo form mẫu.");
      return;
    }

    const borderStyle = {
      top: { style: "thin", color: { rgb: "D9D9D9" } },
      bottom: { style: "thin", color: { rgb: "D9D9D9" } },
      left: { style: "thin", color: { rgb: "D9D9D9" } },
      right: { style: "thin", color: { rgb: "D9D9D9" } },
    };

    const headerStyle = {
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1F497D" } }, // Dark Navy Blue
      alignment: { horizontal: "center", vertical: "center" },
      border: borderStyle,
    };

    const mainBannerStyle = {
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "E36C09" } }, // Vibrant Orange
      alignment: { horizontal: "left", vertical: "center" },
      border: borderStyle,
    };

    const subBannerStyle = {
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "9C0006" } },
      fill: { fgColor: { rgb: "FDE9D9" } }, // Soft Peach
      alignment: { horizontal: "left", vertical: "center" },
      border: borderStyle,
    };

    const dataStyleLeft = {
      font: { name: "Segoe UI", sz: 10 },
      alignment: { horizontal: "left", vertical: "center" },
      border: borderStyle,
    };

    const dataStyleCenter = {
      font: { name: "Segoe UI", sz: 10 },
      alignment: { horizontal: "center", vertical: "center" },
      border: borderStyle,
    };

    const dataStyleEmail = {
      font: { name: "Segoe UI", sz: 10, color: { rgb: "0000FF" }, underline: true },
      alignment: { horizontal: "left", vertical: "center" },
      border: borderStyle,
    };

    const makeCell = (val: any, style: any) => ({
      v: val,
      t: typeof val === "number" ? "n" : "s",
      s: style,
    });

    const makeBannerRow = (title: string, style: any) => [
      makeCell(title, style),
      makeCell("", style),
      makeCell("", style),
      makeCell("", style),
      makeCell("", style),
      makeCell("", style),
    ];

    const wsData: any[][] = [];

    // Row 1: Header
    wsData.push([
      makeCell("#", headerStyle),
      makeCell("HỌ TÊN", headerStyle),
      makeCell("EMAIL", headerStyle),
      makeCell("PASSWORD", headerStyle),
      makeCell("KHOA/PHÒNG BAN", headerStyle),
      makeCell("NHIỆM VỤ", headerStyle),
    ]);

    // Section 1: MENTOR
    wsData.push(makeBannerRow("MENTOR", mainBannerStyle));
    for (let i = 1; i <= 5; i++) {
      wsData.push([
        makeCell(i, dataStyleCenter),
        makeCell("", dataStyleLeft),
        makeCell("", dataStyleEmail),
        makeCell("", dataStyleLeft),
        makeCell("", dataStyleLeft),
        makeCell("Mentor", dataStyleLeft),
      ]);
    }

    // Section 2: BAN GIÁM KHẢO
    wsData.push(makeBannerRow("BAN GIÁM KHẢO", mainBannerStyle));

    // Dynamic Round Sections
    const nonFinalRounds = rounds.filter((r: any) => r.advanceTopN !== 0);
    const finalRound = rounds.find((r: any) => r.advanceTopN === 0);

    if (nonFinalRounds.length > 0) {
      for (const r of nonFinalRounds) {
        const roundTracks = tracks.filter((t: any) => String(t.roundId) === String(r._id));
        if (roundTracks.length > 0) {
          for (const t of roundTracks) {
            const markerName = `${r.name.trim().toUpperCase()} - ${t.name.trim().toUpperCase()}`;
            wsData.push(makeBannerRow(markerName, subBannerStyle));
            for (let i = 1; i <= 5; i++) {
              wsData.push([
                makeCell(i, dataStyleCenter),
                makeCell("", dataStyleLeft),
                makeCell("", dataStyleEmail),
                makeCell("", dataStyleLeft),
                makeCell("", dataStyleLeft),
                makeCell(`Giám khảo ${r.name}`, dataStyleLeft),
              ]);
            }
          }
        } else {
          const markerName = r.name.trim().toUpperCase();
          wsData.push(makeBannerRow(markerName, subBannerStyle));
          for (let i = 1; i <= 5; i++) {
            wsData.push([
              makeCell(i, dataStyleCenter),
              makeCell("", dataStyleLeft),
              makeCell("", dataStyleEmail),
              makeCell("", dataStyleLeft),
              makeCell("", dataStyleLeft),
              makeCell(`Giám khảo ${r.name}`, dataStyleLeft),
            ]);
          }
        }
      }
    } else {
      wsData.push(makeBannerRow("VÒNG SƠ LOẠI - BẢNG A", subBannerStyle));
      for (let i = 1; i <= 5; i++) {
        wsData.push([
          makeCell(i, dataStyleCenter),
          makeCell("", dataStyleLeft),
          makeCell("", dataStyleEmail),
          makeCell("", dataStyleLeft),
          makeCell("", dataStyleLeft),
          makeCell("Giám khảo Vòng sơ loại", dataStyleLeft),
        ]);
      }
    }

    // Section 3: Final Round
    const finalMarkerName = finalRound ? finalRound.name.trim().toUpperCase() : "VÒNG CHUNG KẾT";
    wsData.push(makeBannerRow(finalMarkerName, subBannerStyle));
    for (let i = 1; i <= 5; i++) {
      wsData.push([
        makeCell(i, dataStyleCenter),
        makeCell("", dataStyleLeft),
        makeCell("", dataStyleEmail),
        makeCell("", dataStyleLeft),
        makeCell("", dataStyleLeft),
        makeCell("Giám khảo Vòng chung kết", dataStyleLeft),
      ]);
    }

    const worksheet = XLSXStyle.utils.aoa_to_sheet(wsData);

    worksheet["!cols"] = [
      { wch: 12 }, // Col A (# / Marker)
      { wch: 28 }, // Col B (Họ tên)
      { wch: 34 }, // Col C (Email)
      { wch: 18 }, // Col D (Password)
      { wch: 34 }, // Col E (Khoa/Phòng ban)
      { wch: 28 }, // Col F (Nhiệm vụ)
    ];

    const rowHeights: { hpt: number }[] = [];
    for (let r = 0; r < wsData.length; r++) {
      if (r === 0 || wsData[r][0]?.v === "MENTOR" || wsData[r][0]?.v === "BAN GIÁM KHẢO" || String(wsData[r][0]?.v).includes("VÒNG")) {
        rowHeights.push({ hpt: 24 });
      } else {
        rowHeights.push({ hpt: 20 });
      }
    }
    worksheet["!rows"] = rowHeights;

    const workbook = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(workbook, worksheet, "NHÂN SỰ");

    const cleanEventName = (event?.name || "SEAL_HACKATHON")
      .replace(/[^a-zA-Z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂẾỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸ\s]/g, "")
      .replace(/\s+/g, "_");

    XLSXStyle.writeFile(workbook, `FORM_MAU_NHAN_SU_${cleanEventName}.xlsx`);
    toast.success("Đã tải xuống file form mẫu nhân sự (được định dạng đẹp).");
  };

  const parseMasterSheet = async (file: File) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const personnelSheetName = workbook.SheetNames.find(
        (name) => name.trim().toLocaleUpperCase("vi-VN") === "NHÂN SỰ",
      );
      if (!personnelSheetName) throw new Error("Không tìm thấy tab NHÂN SỰ.");

      const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[personnelSheetName], {
        header: 1,
        defval: "",
      });
      const converted: PersonnelRow[] = [];
      const credentialsByName = new Map<string, { email: string; password: string }>();
      for (const row of rows.slice(1)) {
        const fullName = String(row[1] || "").trim();
        const email = String(row[2] || "").trim().toLowerCase();
        const password = String(row[3] || "").trim();
        if (fullName && email) credentialsByName.set(fullName.toLocaleLowerCase("vi-VN"), { email, password });
      }
      let role: "judge" | "mentor" | "" = "";
      let roundName = "";
      let trackName = "";

      for (const row of rows.slice(1)) {
        const marker = String(row[0] || "").trim().toLocaleUpperCase("vi-VN");
        if (marker === "MENTOR") {
          role = "mentor";
          roundName = "Tất cả các vòng";
          trackName = "";
          continue;
        }
        if (marker === "BAN GIÁM KHẢO") {
          role = "judge";
          continue;
        }

        // Dynamic round/track matching
        if (marker) {
          const normalizeKey = (str: string) =>
            str.trim().toLowerCase().replace(/^(bảng|track|vòng)\s*/i, "").trim();

          const matchedRound = rounds.find((r: any) =>
            marker.startsWith(r.name.trim().toLocaleUpperCase("vi-VN")) ||
            (marker.includes("CHUNG KẾT") && (r.advanceTopN === 0 || r.name.toLowerCase().includes("chung kết"))) ||
            (marker.includes("LOẠI") && r.name.toLowerCase().includes("loại"))
          );

          if (matchedRound) {
            role = "judge";
            roundName = matchedRound.name;
            const isFinal = matchedRound.advanceTopN === 0 || matchedRound.name.toLowerCase().includes("chung kết");
            const dashIndex = marker.indexOf("-");
            const rawTrack = dashIndex >= 0
              ? marker.substring(dashIndex + 1).trim()
              : (marker.match(/TRACK\s*\d+(?:\s*:\s*.+)?/i)?.[0] || "").replace(/\s*:\s*/g, ": ").trim();

            const roundTracks = tracks.filter((t: any) => String(t.roundId) === String(matchedRound._id));
            const matchedTrack = roundTracks.find(
              (t: any) =>
                t.name.trim().toLocaleUpperCase("vi-VN") === rawTrack.toLocaleUpperCase("vi-VN") ||
                (rawTrack && (
                  normalizeKey(t.name) === normalizeKey(rawTrack) ||
                  rawTrack.toLocaleUpperCase("vi-VN").startsWith(t.name.trim().toLocaleUpperCase("vi-VN")) ||
                  t.name.trim().toLocaleUpperCase("vi-VN").startsWith(rawTrack.toLocaleUpperCase("vi-VN"))
                ))
            ) || (isFinal ? (roundTracks[0] || tracks.find((t) => t.name.toLowerCase().includes("chung kết"))) : undefined);

            if (matchedTrack) {
              trackName = matchedTrack.name;
            } else if (isFinal) {
              trackName = "Bảng Chung Kết";
            } else if (rawTrack) {
              trackName = /^bảng\s+/i.test(rawTrack) ? rawTrack : `Bảng ${rawTrack}`;
            } else {
              trackName = "";
            }
            continue;
          }

          if (marker.startsWith("VÒNG SƠ LOẠI") || marker.startsWith("LOẠI")) {
            role = "judge";
            roundName = "Vòng sơ loại";
            const dashIndex = marker.indexOf("-");
            const rawTrack = dashIndex >= 0
              ? marker.substring(dashIndex + 1).trim()
              : (marker.match(/TRACK\s*\d+(?:\s*:\s*.+)?/i)?.[0] || "").replace(/\s*:\s*/g, ": ").trim();
            const matchedTrack = tracks.find((track: any) =>
              rawTrack.toLocaleUpperCase("vi-VN").startsWith(track.name.trim().toLocaleUpperCase("vi-VN")) ||
              normalizeKey(track.name) === normalizeKey(rawTrack)
            );
            trackName = matchedTrack ? matchedTrack.name : (rawTrack ? (/^bảng\s+/i.test(rawTrack) ? rawTrack : `Bảng ${rawTrack}`) : "");
            continue;
          }
          if (marker === "VÒNG CHUNG KẾT" || marker.startsWith("VÒNG CHUNG KẾT")) {
            role = "judge";
            roundName = "Vòng chung kết";
            trackName = "Bảng Chung Kết";
            continue;
          }
        }

        if (!role || !row[1]) continue;
        if (String(row[1]).trim().toLocaleUpperCase("vi-VN") === "HỌ TÊN") continue;

        const fullName = String(row[1]).trim();
        const credentials = credentialsByName.get(fullName.toLocaleLowerCase("vi-VN"));
        converted.push({
          fullName,
          email: String(row[2] || credentials?.email || "").trim().toLowerCase(),
          password: String(row[3] || credentials?.password || "").trim(),
          unit: String(row[4] || "").trim(),
          role,
          isChiefJudge: false,
          roundName,
          trackName: role === "mentor" ? "" : trackName,
          note: String(row[5] || "").trim(),
        });
      }

      if (!converted.length) throw new Error("Không đọc được Mentor hoặc Judge từ file.");
      setFileName(file.name);
      const hasChiefJudge = invitations.some((invitation) => ["pending", "accepted"].includes(invitation.status) && invitation.assignments?.some((assignment: any) => assignment.role === "judge" && assignment.isChiefJudge))
        || roles.some((role) => role.role === "judge" && role.isChiefJudge);
      setPreview(converted.map((item) => {
        const existing = invitations.find((invitation) => invitation.email === item.email);
        return {
          ...item,
          existingStatus: existing?.status,
          existingInvitationId: existing?._id,
        };
      }).filter((item) => !item.existingStatus || (!hasChiefJudge && item.role === "judge" && item.existingStatus !== "rejected")));
      setIsPreviewConfirmed(false);
      toast.success(`Đã chuyển đổi ${converted.length} phân công nhân sự.`);
    } catch (error: any) {
      setFileName("");
      setPreview([]);
      setIsPreviewConfirmed(false);
      toast.error(error.message || "File Master Sheet không hợp lệ.");
    }
  };

  const shouldProcessPreviewRow = (item: PersonnelRow) => !item.existingStatus || Boolean(item.isChiefJudge);

  const stats = useMemo(() => ({
    judges: roles.filter((item) => item.role === "judge").length,
    mentors: roles.filter((item) => item.role === "mentor").length,
    acceptedPreview: preview.filter((item) => shouldProcessPreviewRow(item) && item.email && item.password.length >= 6).length,
    invalidPreview: preview.filter((item) => shouldProcessPreviewRow(item) && (!item.email || item.password.length < 6)).length,
  }), [roles, preview]);

  const visiblePreview = preview
    .map((item, index) => ({ item, index }));

  const updateChiefJudge = (index: number, isChiefJudge: boolean) => {
    setPreview((current) => current.map((item, itemIndex) => ({
      ...item,
      isChiefJudge: item.role === "judge" && itemIndex === index ? isChiefJudge : false,
    })));
    setIsPreviewConfirmed(false);
  };

  const confirmConvertedPersonnel = async () => {
    const invalidRows = preview.filter(
      (item) => shouldProcessPreviewRow(item) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) || item.password.length < 6),
    );
    if (invalidRows.length > 0) {
      toast.error(`Còn ${invalidRows.length} dòng có email hoặc mật khẩu không hợp lệ.`);
      return;
    }
    const currentEventId = selectedEventId || event?._id;
    if (!currentEventId) {
      toast.error("Vui lòng chọn một cuộc thi hợp lệ trước khi nhập danh sách.");
      return;
    }
    const personnelToImport = preview.filter((item) => !item.existingStatus);
    const existingChiefJudge = preview.find((item) => item.existingInvitationId && item.isChiefJudge);
    if (!personnelToImport.length && !existingChiefJudge) {
      toast.info("Không có nhân sự mới hoặc Chủ tịch Hội đồng cần cập nhật.");
      return;
    }
    try {
      setIsImportingPersonnel(true);
      let successMessage = "Đã cập nhật danh sách nhân sự.";
      if (existingChiefJudge) {
        const chiefResponse = await axios.put(
          `http://localhost:5000/api/personnel-invitations/${existingChiefJudge.existingInvitationId}/chief-judge`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        successMessage = chiefResponse.data.message || successMessage;
      }
      if (personnelToImport.length) {
        const response = await axios.post(
          `http://localhost:5000/api/personnel-invitations/event/${currentEventId}/import`,
          { personnel: personnelToImport },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        successMessage = response.data.message || successMessage;
      }
      setPreview([]);
      setFileName("");
      setIsPreviewConfirmed(false);
      toast.success(successMessage);
      await loadPersonnelData(selectedEventId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể nhập danh sách nhân sự.");
    } finally {
      setIsImportingPersonnel(false);
    }
  };

  const downloadConvertedPersonnel = () => {
    const rows = preview.map((item, index) => ({
      STT: index + 1,
      "HỌ VÀ TÊN": item.fullName,
      EMAIL: item.email,
      PASSWORD: item.password,
      "ĐƠN VỊ": item.unit,
      "VAI TRÒ": item.role.toUpperCase(),
      "CHỦ TỊCH HỘI ĐỒNG": item.role === "judge" && item.isChiefJudge ? "Có" : "Không",
      "VÒNG THI": item.roundName,
      "TRACK/BẢNG": item.trackName,
      "GHI CHÚ": item.note,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 7 }, { wch: 24 }, { wch: 30 }, { wch: 18 }, { wch: 34 },
      { wch: 13 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 28 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NHÂN SỰ");
    XLSX.writeFile(workbook, "NHAN_SU_SEAL_HACKATHON_DA_CHUYEN_DOI.xlsx");
  };

  const runAccountAction = async (path: string, successFallback: string, requireConfirmation = false) => {
    if (requireConfirmation) {
      const confirmed = await conform({
        title: "Xác nhận thu hồi quyền",
        message: "Bạn có chắc chắn muốn thu hồi quyền nhân sự đã chọn?",
        conformText: "Thu hồi",
        cancelText: "Hủy",
        variant: "danger",
      });
      if (!confirmed) return;
    }
    try {
      setIsAccountActionLoading(true);
      const response = await axios.post(
        `http://localhost:5000/api/personnel-invitations/${path}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || successFallback);
      await loadPersonnelData(selectedEventId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể cập nhật quyền nhân sự.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const deleteInvitation = async (invitation: any) => {
    const isProvisioned = invitation.accountStatus === "provisioned" || invitation.status === "accepted";
    const confirmed = await conform({
      title: "Xác nhận xóa nhân sự",
      message: isProvisioned
        ? `Bạn có chắc chắn muốn xóa nhân sự ${invitation.fullName} (${invitation.email})? Quyền Judge/Mentor của nhân sự này trong sự kiện sẽ bị thu hồi và xóa hoàn toàn.`
        : `Bạn có chắc chắn muốn xóa lời mời của ${invitation.fullName} (${invitation.email})?`,
      conformText: "Xóa nhân sự",
      cancelText: "Hủy",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      setIsAccountActionLoading(true);
      const response = await axios.delete(
        `http://localhost:5000/api/personnel-invitations/${invitation._id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || "Đã xóa nhân sự.");
      await loadPersonnelData(selectedEventId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể xóa nhân sự.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const resendInvitation = async (invitation: any) => {
    try {
      setIsAccountActionLoading(true);
      const response = await axios.post(
        `http://localhost:5000/api/personnel-invitations/${invitation._id}/resend`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || "Đã gửi lại lời mời.");
      await loadPersonnelData(selectedEventId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể gửi lại lời mời.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const groupedProvisionedRoles = useMemo(() => {
    const map = new Map<string, { user: any; roles: any[] }>();
    for (const item of roles) {
      const email = item.userId?.email?.toLowerCase() || item.userId?._id || item._id;
      if (!email) continue;
      if (!map.has(email)) {
        map.set(email, {
          user: item.userId,
          roles: [],
        });
      }
      map.get(email)!.roles.push(item);
    }
    return Array.from(map.values());
  }, [roles]);

  const updateInvitationAssignmentTrack = async (invitationId: string, assignmentIndex: number, trackId: string) => {
    if (!trackId) return;
    try {
      setIsAccountActionLoading(true);
      const response = await axios.put(
        `http://localhost:5000/api/personnel-invitations/${invitationId}/assignment-track`,
        { assignmentIndex, trackId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || "Đã cập nhật track.");
      await loadPersonnelData(selectedEventId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể cập nhật track.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const startEditingPersonnel = (invitation: any) => {
    setEditingPersonnelId(invitation._id);
    setPersonnelDraft({
      email: invitation.email,
      password: "",
      assignments: invitation.assignments?.map((item: any) => ({ ...item })) || [],
    });
  };

  const toggleDraftRole = (role: "judge" | "mentor") => {
    setPersonnelDraft((current: any) => {
      const assignments = current.assignments || [];
      const hasRole = assignments.some((item: any) => item.role === role);
      return {
        ...current,
        assignments: hasRole
          ? assignments.filter((item: any) => item.role !== role)
          : [...assignments, { role, isChiefJudge: false, roundName: role === "mentor" ? "Tất cả các vòng" : "", trackName: "", note: "" }],
      };
    });
  };

  const savePersonnelDetails = async (invitationId: string) => {
    if (!personnelDraft?.assignments?.length) {
      toast.error("Nhân sự phải có ít nhất một vai trò.");
      return;
    }
    try {
      setIsAccountActionLoading(true);
      const response = await axios.put(
        `http://localhost:5000/api/personnel-invitations/${invitationId}/details`,
        personnelDraft,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || "Đã cập nhật nhân sự.");
      setEditingPersonnelId(null);
      setPersonnelDraft(null);
      await loadPersonnelData(selectedEventId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể cập nhật nhân sự.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Đang tải nhân sự...</div>;
  }

  return (
    <div className="space-y-6 text-slate-800">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#F27024]/20 bg-[#F27024]/10 text-[#F27024]">
            <BriefcaseBusiness size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wide text-slate-900">Quản lý nhân sự</h1>
            <p className="mt-1 text-xs text-slate-500">
              Phân công và cấp quyền Ban Giám Khảo (Judge) và Cố vấn (Mentor) theo từng cuộc thi.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[320px]">
          <label htmlFor="personnel-event-select" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Cuộc thi / Sự kiện
          </label>
          <div className="flex items-center gap-2">
            <CustomSelect
              value={selectedEventId}
              onChange={handleEventChange}
              options={eventOptions}
              placeholder="Chọn cuộc thi..."
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => loadPersonnelData(selectedEventId)}
              disabled={!selectedEventId || isRefreshing}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-[#F27024] focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 disabled:cursor-not-allowed disabled:opacity-50"
              title="Tải lại dữ liệu sự kiện"
            >
              {isRefreshing ? <Loader2 size={16} className="animate-spin text-[#F27024]" /> : <RefreshCw size={16} />}
            </button>
          </div>
        </div>
      </header>

      {!event ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          {events.length === 0
            ? "Hiện tại không có cuộc thi nào trong hệ thống hoặc bạn chưa được phân quyền quản lý cuộc thi."
            : "Vui lòng chọn một cuộc thi từ danh sách phía trên để bắt đầu quản lý nhân sự."}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Judge đã cấp quyền", stats.judges],
              ["Mentor đã cấp quyền", stats.mentors],
              ["Dòng hợp lệ trong file", stats.acceptedPreview],
              ["Dòng thiếu email", stats.invalidPreview],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-[#F27024]">{value}</p>
              </div>
            ))}
          </section>

          {!readOnly && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold"><FileSpreadsheet size={18} className="text-[#F27024]" /> Chuyển đổi Master Sheet</h2>
                  <p className="mt-1 text-xs text-slate-500">Tải form mẫu đã được thiết lập theo vòng thi & track hoặc import file Master Sheet đã điền.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30"
                  >
                    <Download size={15} className="text-[#F27024]" /> Tải form mẫu
                  </button>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F27024] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#d95f1f] focus-within:ring-2 focus-within:ring-[#F27024]/30">
                    <Upload size={15} /> Import Excel
                    <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => event.target.files?.[0] && parseMasterSheet(event.target.files[0])} />
                  </label>
                </div>
              </div>
              {fileName && <p className="mt-3 text-xs text-slate-500">File đang kiểm duyệt: <strong>{fileName}</strong></p>}
            </section>
          )}

          {preview.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold">Danh sách nhân sự xem trước</h2>
                  <p className="mt-1 text-xs text-slate-500">Kiểm tra dữ liệu trước khi nhập vào danh sách nhân sự.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isPreviewConfirmed ? (
                    <>
                      <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={14} /> Đã xác nhận
                      </span>
                      <button
                        type="button"
                        onClick={downloadConvertedPersonnel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30"
                      >
                        <Download size={14} /> Tải file đã chuyển đổi
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={confirmConvertedPersonnel}
                      disabled={stats.invalidPreview > 0 || isImportingPersonnel}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#F27024] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#d95f1f] focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} /> {isImportingPersonnel ? "Đang nhập nhân sự..." : "Xác nhận & nhập nhân sự"}
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] table-fixed text-left text-xs">
                  <colgroup><col className="w-[220px]" /><col className="w-[300px]" /><col className="w-[160px]" /><col className="w-[200px]" /><col className="w-[240px]" /><col className="w-[60px]" /></colgroup>
                  <thead className="bg-slate-50 text-[12px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Họ tên</th><th className="p-3">Email / tài khoản</th><th className="p-3">Mật khẩu</th><th className="p-3">Vai trò</th><th className="p-3">Vòng/Track</th><th className="p-3">Kiểm tra</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiblePreview.map(({ item, index }) => (
                      <tr key={`${item.email}-${item.role}-${index}`}><td className="p-3 font-semibold" title={item.fullName}>{item.fullName}</td><td className="p-3 font-mono text-slate-600" title={item.email}><span className="block overflow-hidden text-ellipsis whitespace-nowrap">{item.email || "Thiếu email"}</span></td><td className="p-3 font-mono text-slate-600"><span className="block whitespace-nowrap">{item.password || "Thiếu mật khẩu"}</span></td><td className="p-3"><div className="flex flex-col items-start gap-2"><span className="rounded-md bg-[#F27024]/10 px-2 py-1 font-bold text-[#F27024]">{item.role.toUpperCase()}</span>{item.role === "judge" && <label className="inline-flex cursor-pointer items-center gap-2 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={item.isChiefJudge} onChange={(event) => updateChiefJudge(index, event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#F27024] focus:ring-2 focus:ring-[#F27024]/30" />Chủ tịch Hội đồng</label>}</div></td><td className="p-3 leading-snug text-slate-500">{item.role === "mentor" ? <span>Chọn Track sau khi import</span> : <>{item.roundName}{item.trackName ? ` · ${item.trackName}` : ""}</>}</td><td className="p-3">{item.email && item.password.length >= 6 ? <CheckCircle2 size={16} className="text-emerald-600" /> : <span className="text-rose-600">Thiếu thông tin</span>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-sm font-bold">Danh sách nhân sự đã nhập</h2><p className="mt-1 text-xs text-slate-500">Theo dõi phân công và trạng thái cấp quyền của nhân sự.</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={isAccountActionLoading || !invitations.some((item) => item.status === "accepted" && item.accountStatus !== "provisioned")} onClick={() => runAccountAction(`event/${selectedEventId || event?._id}/provision-all`, "Đã cấp tài khoản.")} className="rounded-lg bg-[#F27024] px-3 py-2 text-xs font-bold text-white hover:bg-[#d95f1f] disabled:opacity-50">Cấp tất cả đã chấp thuận</button>
                <button type="button" disabled={isAccountActionLoading || !invitations.some((item) => item.accountStatus === "provisioned")} onClick={() => runAccountAction(`event/${selectedEventId || event?._id}/revoke-all`, "Đã thu hồi tất cả.", true)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">Thu hồi tất cả</button>
                <button type="button" onClick={() => loadPersonnelData(selectedEventId)} disabled={isRefreshing} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50" aria-label="Tải lại trạng thái"><RefreshCw size={15} className={isRefreshing ? "animate-spin text-[#F27024]" : ""} /></button>
              </div>
            </div>
            {invitations.length ? (
              <div className="space-y-3 bg-slate-50/70 p-4">
                {invitations.map((invitation) => {
                  const statusStyle = invitation.status === "accepted"
                    ? "bg-emerald-50 text-emerald-700"
                    : invitation.status === "rejected"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-700";
                  const statusLabel = invitation.status === "accepted" ? "Đã xác nhận" : invitation.status === "rejected" ? "Đã từ chối" : "Chờ xử lý";
                  return (
                    <article key={invitation._id} className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 text-[#F27024] ring-1 ring-orange-200">
                            <UserRoundCheck size={21} aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-extrabold tracking-tight text-slate-900">{invitation.fullName}</p>
                            <p className="mt-0.5 truncate font-mono text-xs font-medium text-slate-500" title={invitation.email}>{invitation.email}</p>
                            <p className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-500">Mật khẩu: ••••••••</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {invitation.assignments?.map((item: any, index: number) => (
                            <span key={index} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${item.isChiefJudge ? "border-amber-200 bg-amber-50 text-amber-700" : item.role === "mentor" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                              {item.role}{item.roundName ? ` · ${item.roundName}` : ""}{item.trackName ? ` · ${item.trackName}` : ""}{item.isChiefJudge ? " · Chủ tịch Hội đồng" : ""}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                          {invitation.assignments?.map((item: any, assignIndex: number) => {
                            const roundObj = rounds.find((r) => r.name.trim().toLowerCase() === (item.roundName || "").trim().toLowerCase());
                            const isFinalRound = (roundObj && roundObj.advanceTopN === 0) || String(item.roundName || "").toLowerCase().includes("chung kết");
                            if (isFinalRound) {
                              return (
                                <div key={assignIndex} className="block w-full min-w-56 flex-1 sm:max-w-72">
                                  <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                    Track ({item.role.toUpperCase()}{item.roundName ? ` · ${item.roundName}` : ""})
                                  </span>
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm">
                                    Bảng Chung Kết
                                  </div>
                                </div>
                              );
                            }

                            const roundTracks = roundObj ? tracks.filter((t) => String(t.roundId) === String(roundObj._id)) : tracks;
                            const availableTracks = roundTracks.length > 0 ? roundTracks : tracks;
                            const matchedTrackId = availableTracks.find((t) => t.name.trim().toLowerCase() === (item.trackName || "").trim().toLowerCase())?._id || "";
                            return (
                              <label key={assignIndex} className="block w-full min-w-56 flex-1 sm:max-w-72">
                                <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                  Track ({item.role.toUpperCase()}{item.roundName ? ` · ${item.roundName}` : ""})
                                </span>
                                <select
                                  value={matchedTrackId}
                                  disabled={isAccountActionLoading}
                                  onChange={(event) => updateInvitationAssignmentTrack(invitation._id, assignIndex, event.target.value)}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 shadow-sm transition-colors hover:border-orange-300 focus:border-[#F27024] focus:outline-none focus:ring-4 focus:ring-[#F27024]/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="">Chọn track ({item.role})</option>
                                  {availableTracks.map((track) => (
                                    <option key={track._id} value={track._id}>
                                      {track.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            );
                          })}
                        </div>
                        {editingPersonnelId === invitation._id && personnelDraft && (
                          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                            <label className="text-xs font-bold text-slate-600">Email / tài khoản
                              <input value={personnelDraft.email} onChange={(event) => setPersonnelDraft((current: any) => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono font-normal focus:outline-none focus:ring-2 focus:ring-[#F27024]/30" />
                            </label>
                            <label className="text-xs font-bold text-slate-600">Mật khẩu mới
                              <input type="password" value={personnelDraft.password} placeholder="Để trống nếu không đổi" onChange={(event) => setPersonnelDraft((current: any) => ({ ...current, password: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono font-normal focus:outline-none focus:ring-2 focus:ring-[#F27024]/30" />
                            </label>
                            <fieldset className="sm:col-span-2">
                              <legend className="text-xs font-bold text-slate-600">Vai trò</legend>
                              <div className="mt-2 flex gap-4">
                                {(["judge", "mentor"] as const).map((role) => <label key={role} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={personnelDraft.assignments.some((item: any) => item.role === role)} onChange={() => toggleDraftRole(role)} className="h-4 w-4 rounded border-slate-300 accent-[#F27024]" />{role === "judge" ? "Judge" : "Mentor"}</label>)}
                              </div>
                            </fieldset>
                            <div className="flex gap-2 sm:col-span-2">
                              <button type="button" disabled={isAccountActionLoading} onClick={() => savePersonnelDetails(invitation._id)} className="inline-flex items-center gap-2 rounded-lg bg-[#F27024] px-3 py-2 text-xs font-bold text-white hover:bg-[#d95f1f] focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 disabled:opacity-50"><Save size={13} />Lưu thay đổi</button>
                              <button type="button" onClick={() => { setEditingPersonnelId(null); setPersonnelDraft(null); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"><X size={13} />Hủy</button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:max-w-56 sm:justify-end">
                        <span className={`rounded-lg border border-current/15 px-2.5 py-1.5 text-[10px] font-extrabold ${statusStyle}`}>{statusLabel}</span>
                        {invitation.emailStatus === "failed" && <span className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700">Gửi email thất bại</span>}
                        {invitation.accountEmailStatus === "failed" && <span className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700">Email tài khoản thất bại</span>}
                        {["pending", "rejected"].includes(invitation.status) && <button type="button" disabled={isAccountActionLoading} onClick={() => resendInvitation(invitation)} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10px] font-bold text-orange-700 transition-colors hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50">Gửi lại lời mời</button>}
                        {invitation.status === "accepted" && invitation.accountStatus !== "provisioned" && <button type="button" disabled={isAccountActionLoading} onClick={() => runAccountAction(`${invitation._id}/provision`, "Đã cấp tài khoản.")} className="rounded-lg bg-[#F27024] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#d95f1f] disabled:opacity-50">{invitation.accountStatus === "revoked" ? "Cấp lại tài khoản" : "Cấp tài khoản"}</button>}
                        {invitation.accountStatus === "provisioned" && <><span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">Đã cấp tài khoản</span><button type="button" disabled={isAccountActionLoading} onClick={() => runAccountAction(`${invitation._id}/revoke`, "Đã thu hồi quyền.", true)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Thu hồi</button></>}
                        {invitation.accountStatus === "revoked" && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600">Đã thu hồi</span>}
                        {!readOnly && <button type="button" disabled={isAccountActionLoading} onClick={() => startEditingPersonnel(invitation)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 disabled:opacity-50"><Pencil size={12} />Chỉnh sửa</button>}
                        <button
                          type="button"
                          aria-label={`Xóa nhân sự ${invitation.fullName}`}
                          disabled={isAccountActionLoading}
                          onClick={() => deleteInvitation(invitation)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-700 transition-colors hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={12} aria-hidden="true" />
                          Xóa nhân sự
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <p className="p-8 text-center text-xs text-slate-500">Chưa có nhân sự nào được nhập.</p>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5"><h2 className="flex items-center gap-2 text-sm font-bold"><UserRoundCheck size={18} className="text-[#F27024]" /> Nhân sự đã được cấp quyền</h2></div>
            {groupedProvisionedRoles.length ? (
              <div className="divide-y divide-slate-100">
                {groupedProvisionedRoles.map(({ user, roles: userRoles }) => (
                  <div key={user?._id || user?.email} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{user?.fullName || "Chưa rõ tên"}</p>
                      <p className="text-xs text-slate-500 font-mono">{user?.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <ShieldCheck size={13} /> Đã cấp tài khoản
                      </span>
                      {userRoles.map((roleItem: any) => {
                        const isJudge = roleItem.role === "judge";
                        const badgeStyle = isJudge
                          ? "bg-slate-100 text-slate-700 border-slate-200"
                          : "bg-amber-50 text-amber-700 border-amber-200";
                        const trackLabel = roleItem.trackId?.name || "Toàn sự kiện";
                        return (
                          <span key={roleItem._id} className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase border ${badgeStyle}`}>
                            {roleItem.role}{" · "}{trackLabel}{roleItem.isChiefJudge ? " · Chủ tịch Hội đồng" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="p-8 text-center text-xs text-slate-500">Chưa có Judge hoặc Mentor nào được cấp quyền.</p>}
          </section>
        </>
      )}
    </div>
  );
}
