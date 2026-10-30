import React, { useState, useRef } from "react";
import { ListOrdered, ChevronRight, ChevronDown, Award, Lock, Download, Upload, FileSpreadsheet, X, AlertTriangle, CheckCircle, Trash2, Edit2 } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";
import CustomSelect from "../shared/CustomSelect";
import { useConfirm } from "../shared/ConfirmDialog";

interface RoundsTabProps {
  selectedEvent: any;
  tracks: any[];
  rounds: any[];
  isSystemAdmin?: boolean;
  selectedTrack: any;
  setSelectedTrack: (track: any) => void;
  selectedRubricRoundId: string;
  setSelectedRubricRoundId: (id: string) => void;
  selectedRubricTrackId: string;
  setSelectedRubricTrackId: (id: string) => void;
  fetchEventDetails: () => Promise<void>;
  handleAdvanceRound: (roundId: string) => Promise<void>;
  handleLockRound: (roundId: string) => Promise<void>;
  handleDeleteRound?: (roundId: string) => void;
  handleUpdateRound?: (roundId: string, updatedData: any) => Promise<void>;

  // Create Round form props
  roundName: string;
  setRoundName: (val: string) => void;
  roundDeadline: string;
  setRoundDeadline: (val: string) => void;
  rubricTypeOption: "new" | "existing";
  setRubricTypeOption: (val: "new" | "existing") => void;
  existingRubrics: any[];
  selectedSourceRubricId: string;
  setSelectedSourceRubricId: (val: string) => void;
  rubricName: string;
  setRubricName: (val: string) => void;
  handleCreateRound: (e: React.FormEvent) => Promise<void>;

  // Rubric Display & Edit props
  rubric: any;
  criteria: any[];
  editingRubric: boolean;
  setEditingRubric: (val: boolean) => void;
  editRubricName: string;
  setEditRubricName: (val: string) => void;
  editRubricDesc: string;
  setEditRubricDesc: (val: string) => void;
  editRubricTotalWeight: string;
  setEditRubricTotalWeight: (val: string) => void;
  editRubricMaxScore: string;
  setEditRubricMaxScore: (val: string) => void;
  editRubricIsActive: boolean;
  setEditRubricIsActive: (val: boolean) => void;
  handleUpdateRubric: (e: React.FormEvent) => Promise<void>;
  handleDeleteRubric: () => Promise<void>;
  handleLockRubric: () => Promise<void>;
  handleUnlockRubric: () => Promise<void>;

  // Criteria props
  critCode: string;
  setCritCode: (val: string) => void;
  critName: string;
  setCritName: (val: string) => void;
  critWeight: string;
  setCritWeight: (val: string) => void;
  critDesc: string;
  setCritDesc: (val: string) => void;
  critMaxScore: string;
  setCritMaxScore: (val: string) => void;
  critGradingLevels: any[];
  setCritGradingLevels: React.Dispatch<React.SetStateAction<any[]>>;
  editingCriterion: any;
  setEditingCriterion: (val: any) => void;
  handleSaveCriterion: (e: React.FormEvent) => Promise<void>;
  handleDeleteCriterion: (criterionId: string) => Promise<void>;
  handleStartEditCriterion: (c: any) => void;
  handleCancelEditCriterion: () => void;

  // Grading levels props
  levelLabel: string;
  setLevelLabel: (val: string) => void;
  levelMinScore: string;
  setLevelMinScore: (val: string) => void;
  levelMaxScore: string;
  setLevelMaxScore: (val: string) => void;
  levelDesc: string;
  setLevelDesc: (val: string) => void;
  handleAddGradingLevel: () => void;
  handleRemoveGradingLevel: (index: number) => void;

  // Rubric creation fallback props
  handleCreateRubric: (e: React.FormEvent) => Promise<void>;

  loading: boolean;
  setRubric: (rubric: any) => void;
  setCriteria: (criteria: any[]) => void;
  fetchRoundsAndRubric?: () => Promise<void>;
  readOnly?: boolean;
}

export default function RoundsTab({
  selectedEvent,
  tracks,
  rounds,
  isSystemAdmin,
  selectedTrack,
  setSelectedTrack,
  selectedRubricRoundId,
  setSelectedRubricRoundId,
  selectedRubricTrackId,
  setSelectedRubricTrackId,
  handleAdvanceRound,
  handleLockRound,
  handleDeleteRound,
  handleUpdateRound,

  roundName,
  setRoundName,
  roundDeadline,
  setRoundDeadline,
  rubricTypeOption,
  setRubricTypeOption,
  existingRubrics,
  selectedSourceRubricId,
  setSelectedSourceRubricId,
  rubricName,
  setRubricName,
  handleCreateRound,

  rubric,
  criteria,
  editingRubric,
  setEditingRubric,
  editRubricName,
  setEditRubricName,
  editRubricDesc,
  setEditRubricDesc,
  setEditRubricTotalWeight,
  editRubricMaxScore,
  setEditRubricMaxScore,
  editRubricIsActive,
  setEditRubricIsActive,
  handleUpdateRubric,
  handleDeleteRubric,
  handleLockRubric,
  handleUnlockRubric,

  critCode,
  setCritCode,
  critName,
  setCritName,
  critWeight,
  setCritWeight,
  critDesc,
  setCritDesc,
  critMaxScore,
  setCritMaxScore,
  critGradingLevels,
  editingCriterion,
  handleSaveCriterion,
  handleDeleteCriterion,
  handleStartEditCriterion,
  handleCancelEditCriterion,

  levelLabel,
  setLevelLabel,
  levelMinScore,
  setLevelMinScore,
  levelMaxScore,
  setLevelMaxScore,
  levelDesc,
  setLevelDesc,
  handleAddGradingLevel,
  handleRemoveGradingLevel,

  handleCreateRubric,
  setRubric,
  setCriteria,
  fetchRoundsAndRubric,
  readOnly = false,
}: RoundsTabProps) {
  // Read unused props to satisfy the TS compiler (noUnusedLocals: true)
  const confirm = useConfirm();
  const selectedRound = rounds.find((r: any) => r._id === selectedRubricRoundId);
  const isFinalRound = (round: any) => {
    const normalizedName = String(round?.name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return round?.advanceTopN === 0 || normalizedName.includes("chung ket") || normalizedName.includes("final");
  };
  if (false as boolean) {
    console.log(selectedTrack, setSelectedTrack, setRubric, setCriteria, roundDeadline, setRoundDeadline);
  }

  // Edit Round modal state
  const [editingRound, setEditingRound] = useState<any | null>(null);
  const [editRoundNameInput, setEditRoundNameInput] = useState("");
  const [editRoundOrderInput, setEditRoundOrderInput] = useState("1");
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const isFormVisible = editingCriterion ? true : isManualAddOpen;

  const handleOpenEditRound = (e: React.MouseEvent, r: any) => {
    e.stopPropagation();
    setEditingRound(r);
    setEditRoundNameInput(r.name || "");
    setEditRoundOrderInput(String(r.order || 1));
  };

  const handleSaveEditRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRound || !handleUpdateRound) return;

    if (editingRound.advanceTopN !== 0) {
      const finalRound = rounds.find((r: any) => r.advanceTopN === 0);
      if (finalRound && parseInt(editRoundOrderInput) >= finalRound.order) {
        alert("Thứ tự của vòng thi này phải nhỏ hơn thứ tự của Vòng Chung Kết!");
        return;
      }
    }

    await handleUpdateRound(editingRound._id, {
      name: editRoundNameInput,
      order: parseInt(editRoundOrderInput),
    });
    setEditingRound(null);
  };

  const handleExportRubric = async (rubricId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/rubrics/${rubricId}/export`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Lỗi khi tải file Rubric.");
      }
      const data = await response.json();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `rubric-${rubricId}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error("Export Rubric Error:", err);
      alert("Không thể xuất Rubric. Vui lòng thử lại sau.");
    }
  };

  const handleImportRubric = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rubricData = JSON.parse(event.target?.result as string);
        if (!rubricData.name || !Array.isArray(rubricData.criteria)) {
          alert("File JSON không đúng định dạng Rubric (yêu cầu 'name' và danh sách 'criteria').");
          return;
        }

        const confirmed = await confirm({
          title: "Xác nhận nhập Rubric",
          message: `Bạn có chắc chắn muốn nhập Rubric "${rubricData.name}" vào vòng thi hiện tại không?`
        });
        if (!confirmed) {
          return;
        }

        const token = localStorage.getItem("token");
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/rubrics/import`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            eventId: selectedEvent._id,
            trackId: selectedRubricTrackId || undefined,
            roundId: selectedRubricRoundId,
            rubricData
          })
        });

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.message || "Lỗi khi nhập Rubric.");
        }

        alert("Nhập Rubric thành công!");
        if (resData.rubric) {
          setRubric(resData.rubric);
          setCriteria(resData.criteria || []);
        }
      } catch (err: any) {
        console.error("Import Rubric Error:", err);
        alert(err.message || "Không thể nhập Rubric. Vui lòng kiểm tra lại định dạng file.");
      }
    };
    reader.readAsText(file);
  };

  // === Import Excel State ===
  const token = localStorage.getItem("token");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importGradingDefs, setImportGradingDefs] = useState<any[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string>("");

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/rubrics/template/download", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Template_Criteria.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download template error:", err);
      alert("Lỗi khi tải template. Vui lòng thử lại.");
    }
  };

  // Export criteria of the current rubric to Excel
  const handleExportCriteria = async () => {
    if (!rubric) return;
    if (!criteria || criteria.length === 0) {
      alert("Hiện tại Rubric này chưa có tiêu chí nào để xuất. Vui lòng tự thêm tiêu chí trước hoặc tải file 'Template Excel mẫu' để chỉnh sửa.");
      return;
    }
    try {
      const res = await axios.get(`http://localhost:5000/api/rubrics/${rubric._id}/export-criteria`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const safeName = rubric.name.replace(/\s+/g, "_");
      link.setAttribute("download", `Criteria_${safeName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export criteria error:", err);
      // Đọc thông báo lỗi từ Blob nếu có phản hồi dạng JSON từ server
      if (err.response && err.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorObj = JSON.parse(reader.result as string);
            alert(errorObj.message || "Lỗi khi xuất danh sách tiêu chí ra file Excel.");
          } catch {
            alert("Lỗi khi xuất danh sách tiêu chí ra file Excel. Vui lòng thử lại.");
          }
        };
        reader.readAsText(err.response.data);
      } else {
        alert("Lỗi khi xuất danh sách tiêu chí ra file Excel. Vui lòng thử lại.");
      }
    }
  };

  // Parse Excel file for preview
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    setImportError("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setImportError("File Excel không có sheet nào.");
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        // Auto-detect header format:
        // If the first cell of row 2 (index 1) is a valid criteria code or is not "mã", it is a 1-header file
        const cell0 = String(rawData[0]?.[0] || '').trim().toLowerCase();
        const cell1 = String(rawData[1]?.[0] || '').trim().toUpperCase();
        const isOneHeader = cell0 === 'mã' && (cell1.match(/^[A-Z0-9_-]+$/) || cell1 !== 'mã');

        let headerRow: any[];
        let dataStartIdx: number;
        if (isOneHeader) {
          headerRow = rawData[0];
          dataStartIdx = 1;
        } else {
          if (rawData.length < 3) {
            setImportError("File phải có ít nhất 2 hàng header và 1 hàng dữ liệu.");
            return;
          }
          headerRow = rawData[1];
          dataStartIdx = 2;
        }

        // Parse grading level definitions from headerRow starting from column index 3 (Col D)
        const gradingLevelRegex = /^(.+?)\s*\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\)$/;
        const diemRegex = /^Điểm\s*([\d.]+)$/i;
        const numericRegex = /^([\d.]+)$/;
        const gradingDefs: any[] = [];

        for (let col = 3; col < headerRow.length; col++) {
          const headerVal = String(headerRow[col] || "").trim();
          if (!headerVal) continue;

          // Try matching old format: "Xuất sắc (9.0 - 10.0)"
          let match = headerVal.match(gradingLevelRegex);
          if (match) {
            gradingDefs.push({
              colIndex: col,
              label: match[1].trim(),
              minScore: parseFloat(match[2]),
              maxScore: parseFloat(match[3]),
            });
            continue;
          }

          // Try matching new format: "Điểm 5"
          match = headerVal.match(diemRegex);
          if (match) {
            const score = parseFloat(match[1]);
            gradingDefs.push({
              colIndex: col,
              label: `Điểm ${score}`,
              minScore: score,
              maxScore: score,
            });
            continue;
          }

          // Try matching plain number: "5"
          match = headerVal.match(numericRegex);
          if (match) {
            const score = parseFloat(match[1]);
            gradingDefs.push({
              colIndex: col,
              label: `Điểm ${score}`,
              minScore: score,
              maxScore: score,
            });
            continue;
          }

          // Default fallback
          gradingDefs.push({
            colIndex: col,
            label: headerVal,
            minScore: 0,
            maxScore: 0,
          });
        }

        setImportGradingDefs(gradingDefs);

        // Parse data rows
        const existingCodesMap = new Map(criteria.map((c: any) => [c.code.toUpperCase(), c]));
        const fileCodes = new Set<string>();
        const previewed: any[] = [];

        for (let rowIdx = dataStartIdx; rowIdx < rawData.length; rowIdx++) {
          const row = rawData[rowIdx];
          const code = String(row[0] || "").trim().toUpperCase();
          const name = String(row[1] || "").trim();
          const weightRaw = row[2];

          if (!code && !name && !row[2]) continue; // skip empty rows

          // Parse weight intelligently
          let weight = NaN;
          const weightRawStr = String(weightRaw || '').trim();
          if (weightRawStr.endsWith('%')) {
            weight = parseFloat(weightRawStr);
          } else {
            weight = Number(weightRaw);
            if (!isNaN(weight) && weight > 0 && weight <= 1.0) {
              // Auto-convert decimal fraction (0.25) to percentage (25)
              weight = weight * 100;
            }
          }

          const issues: string[] = [];
          if (!code) issues.push("Thiếu mã tiêu chí");
          if (!name) issues.push("Thiếu tên tiêu chí");
          if (isNaN(weight) || weight <= 0) issues.push("Trọng số không hợp lệ");

          const action = existingCodesMap.has(code) ? "update" : "create";
          fileCodes.add(code);

          const levels = gradingDefs.map((def: any) => {
            const desc = String(row[def.colIndex] || "").trim();
            if (!desc) {
              issues.push(`Thiếu mô tả mức ${def.label}`);
            }
            return {
              label: def.label,
              minScore: def.minScore,
              maxScore: def.maxScore,
              description: desc,
            };
          });

          previewed.push({
            rowNum: rowIdx + 1,
            code,
            name,
            weight: isNaN(weight) ? row[2] : weight,
            gradingLevels: levels,
            issues,
            action, // "create" or "update"
          });
        }

        // Identify deleted criteria (present in DB, but NOT in file)
        criteria.forEach((c: any) => {
          if (!fileCodes.has(c.code.toUpperCase())) {
            previewed.push({
              rowNum: "—",
              code: c.code.toUpperCase(),
              name: c.name,
              weight: c.weight,
              gradingLevels: c.gradingLevels || [],
              issues: [],
              action: "delete",
            });
          }
        });

        setImportPreview(previewed);
        setImportError("");
      } catch (err) {
        console.error("Parse error:", err);
        setImportError("Lỗi khi đọc file Excel. Vui lòng kiểm tra lại file.");
      }
    };
    reader.readAsBinaryString(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload file to server
  const handleConfirmImport = async () => {
    if (!importFile || !rubric) return;
    setImportLoading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await axios.post(
        `http://localhost:5000/api/rubrics/${rubric._id}/import-criteria`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setImportResult(res.data);
      setImportPreview(null);
      setImportFile(null);

      // Refresh criteria list
      if (fetchRoundsAndRubric) {
        await fetchRoundsAndRubric();
      } else {
        // Fallback: fetch criteria directly
        const rubricRes = await axios.get(
          `http://localhost:5000/api/rubrics/${rubric._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRubric(rubricRes.data.rubric);
        setCriteria(rubricRes.data.criteria || []);
      }
    } catch (err: any) {
      const errData = err.response?.data;
      setImportResult({
        message: errData?.message || "Lỗi khi import.",
        errors: errData?.errors || [],
        skippedDetails: errData?.skippedDetails || [],
        imported: 0,
        updated: 0,
        deleted: 0,
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleCancelImport = () => {
    setImportPreview(null);
    setImportFile(null);
    setImportResult(null);
    setImportError("");
    setImportGradingDefs([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Column 1: Rounds list & create form */}
      <div className="lg:col-span-1 glass p-6 rounded-2xl flex flex-col justify-between relative z-20">
        <div>
          <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
            <ListOrdered size={16} className="text-cyan-400" />
            <span>Các Vòng thi</span>
          </h3>
          <div className="space-y-2 mb-6 pr-1">
            {rounds.map((r: any) => (
              <button
                key={r._id}
                onClick={() => {
                  setSelectedRubricRoundId(r._id);
                }}
                className={`w-full text-left p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${selectedRubricRoundId === r._id
                  ? "bg-orange-500/10 border-orange-500/50 text-slate-900 dark:text-orange-300 font-bold shadow-xs"
                  : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:border-orange-500/40 text-slate-900 dark:text-slate-300 shadow-xs"
                  }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <strong className="font-black text-slate-950 dark:text-white text-sm text-track-title">{r.name}</strong>
                    {r.hasCriteria === false && (
                      <span
                        className="inline-flex items-center gap-0.5 bg-amber-950/70 text-amber-400 border border-amber-900/50 px-1 py-0.2 rounded text-[7px] font-bold tracking-wider uppercase shrink-0 font-sans"
                        title="Vòng thi này chưa được cấu hình Tiêu chí chấm điểm (Rubric)"
                      >
                        <AlertTriangle size={8} className="shrink-0 text-amber-400" />
                        Chưa cấu hình
                      </span>
                    )}
                  </div>
                  <p className={`text-[9px] mt-0.5 ${selectedRubricRoundId === r._id ? "text-slate-400 font-semibold" : "text-slate-500"}`}>
                    Thứ tự diễn ra vòng: {r.order}{r.advanceTopN === 0 ? " (Chung kết)" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    Bảng đấu: {tracks
                      .filter((t: any) => t.roundId === r._id)
                      .map((t: any) => (
                        <span
                          key={t._id}
                          className="bg-slate-950 px-1.5 py-0.5 rounded text-[8px] border border-slate-800 text-slate-450 font-sans"
                        >
                          {t.name}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isSystemAdmin && !readOnly && !isFinalRound(r) && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditRound(e, r)}
                        className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Sửa thông tin vòng thi"
                      >
                        <Edit2 size={13} />
                      </button>
                      {handleDeleteRound && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRound(r._id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Xóa vòng thi này"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </>
                  )}
                  <ChevronRight size={14} className={selectedRubricRoundId === r._id ? "text-orange-500" : "text-slate-500"} />
                </div>
              </button>
            ))}
            {rounds.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                Chưa cấu hình vòng thi nào cho sự kiện này.
              </p>
            )}
          </div>
        </div>

        {/* Quick create round form */}
        {!readOnly && (
          <form
            onSubmit={handleCreateRound}
            className="space-y-3 pt-3 border-t border-slate-800/80"
          >
            <p className="text-[10px] font-bold text-slate-300 uppercase font-mono">
              Tạo thêm vòng thi mới:
            </p>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                Tên vòng thi
              </label>
              <input
                type="text"
                required
                placeholder="Tên vòng (e.g. Bán kết)"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                Thứ tự vòng
              </label>
              <input
                type="text"
                disabled
                value={rounds.length > 0 ? rounds[rounds.length - 1].order : 1}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-900 border border-slate-850 text-slate-500 cursor-not-allowed font-bold"
              />
            </div>

            {/* Rubric Configuration */}
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 space-y-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Bảng tiêu chí (Rubric) cho Vòng đấu:
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 font-mono cursor-pointer">
                  <input
                    type="radio"
                    name="roundRubricOption"
                    value="new"
                    checked={rubricTypeOption === "new"}
                    onChange={() => setRubricTypeOption("new")}
                    className="text-cyan-500 focus:ring-0"
                  />
                  Mới
                </label>
                <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 font-mono cursor-pointer">
                  <input
                    type="radio"
                    name="roundRubricOption"
                    value="existing"
                    checked={rubricTypeOption === "existing"}
                    onChange={() => setRubricTypeOption("existing")}
                    className="text-cyan-500 focus:ring-0"
                  />
                  Sao chép cũ
                </label>
              </div>

              {rubricTypeOption === "existing" && (
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">
                    Chọn Rubric cũ để sao chép
                  </label>
                  <CustomSelect
                    value={selectedSourceRubricId}
                    onChange={(val) => setSelectedSourceRubricId(val)}
                    options={existingRubrics.map((r: any) => ({
                      value: r._id,
                      label: `${r.name} (${r.eventId?.name || "Sự kiện cũ"})`,
                    }))}
                    placeholder="-- Chọn Rubric cũ --"
                    className="w-full text-[10px]"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-500 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer font-mono"
            >
              + Thêm Vòng Đấu & Rubric
            </button>
          </form>
        )}
      </div>

      {/* Column 2: Rubric & Criteria setup */}
      <div className="lg:col-span-2 glass p-6 rounded-2xl space-y-4 relative z-10">
        <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
          <Award size={18} className="text-cyan-400" />
          <span>Cấu hình Rubric & Tiêu chí</span>
        </h3>

        {/* Round Selector */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
            Chọn Vòng đấu
          </label>
          <CustomSelect
            value={selectedRubricRoundId}
            onChange={(val) => setSelectedRubricRoundId(val)}
            options={rounds.map((r: any) => ({
              value: r._id,
              label: `${r.name} (Vòng ${r.order})`,
            }))}
            placeholder="-- Chọn Vòng đấu --"
            className="w-full font-mono"
          />
        </div>

        {/* Rubric scope: one round-wide rubric, or a separate rubric per track */}
        {selectedRubricRoundId && (() => {
          const roundTracks = tracks.filter(
            (t: any) => String(t.roundId?._id || t.roundId) === String(selectedRubricRoundId),
          );
          if (roundTracks.length === 0) return null;
          return (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Phạm vi Rubric
              </label>
              <CustomSelect
                value={roundTracks.some((t: any) => t._id === selectedRubricTrackId) ? selectedRubricTrackId : ""}
                onChange={(val) => setSelectedRubricTrackId(val)}
                options={[
                  { value: "", label: "Chung cho cả vòng (áp dụng cho track chưa có rubric riêng)" },
                  ...roundTracks.map((t: any) => ({ value: t._id, label: `Riêng cho track: ${t.name}` })),
                ]}
                className="w-full font-mono"
              />
            </div>
          );
        })()}

        {(() => {
          const currentSelectedRound = rounds.find((r: any) => r._id === selectedRubricRoundId);
          const isSelectedRoundFinal = currentSelectedRound &&
            (currentSelectedRound.name.includes("Chung Kết") ||
              currentSelectedRound.name.includes("Chung kết") ||
              currentSelectedRound.order === (rounds.length > 0 ? rounds[rounds.length - 1].order : -1));
          const showWarning = isSelectedRoundFinal && criteria.length === 0;

          if (showWarning) {
            return (
              <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-xl text-xs text-amber-300 font-sans">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Vòng Chung Kết chưa được cấu hình Rubric</p>
                  <p className="text-[11px] text-amber-450/80 mt-0.5">
                    Vui lòng thêm các tiêu chí chấm điểm bên dưới hoặc chọn import từ Excel để tiếp tục.
                  </p>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {selectedRubricRoundId ? (
          rubric ? (
            editingRubric ? (
              /* Edit Rubric Form */
              <form
                onSubmit={handleUpdateRubric}
                className="space-y-3.5 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 font-mono"
              >
                <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Chỉnh sửa Rubric
                </p>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Tên Rubric
                  </label>
                  <input
                    type="text"
                    required
                    value={editRubricName}
                    onChange={(e) => setEditRubricName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Mô tả
                  </label>
                  <textarea
                    value={editRubricDesc}
                    onChange={(e) => setEditRubricDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Điểm tối đa / Tiêu chí
                  </label>
                  <input
                    type="number"
                    required
                    value={editRubricMaxScore}
                    onChange={(e) => setEditRubricMaxScore(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editRubricIsActive}
                    onChange={(e) => setEditRubricIsActive(e.target.checked)}
                    id="edit-rubric-active"
                  />
                  <label
                    htmlFor="edit-rubric-active"
                    className="text-xs text-slate-300"
                  >
                    Hoạt động
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-cyan-500 hover:bg-cyan-500 text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRubric(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            ) : (
              /* Display Rubric Details & Criteria */
              <div className="space-y-4 font-mono">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-cyan-400">{rubric.name}</p>
                    {rubric.description && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {rubric.description}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Trọng số: {rubric.totalWeight}% | Max điểm:{" "}
                      {rubric.maxCriterionScore}đ
                    </p>
                    {selectedRound && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        Trạng thái vòng:{" "}
                        <span className={`font-bold uppercase ${selectedRound.status === 'completed' ? 'text-emerald-400' :
                          selectedRound.status === 'scoring' ? 'text-amber-400' : 'text-cyan-400'
                          }`}>
                          {selectedRound.status === 'completed' ? 'Đã hoàn thành' :
                            selectedRound.status === 'scoring' ? 'Đang chấm điểm' : 'Đang chuẩn bị'}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {rubric.isLocked ? (
                      <div className="flex flex-col gap-1.5 items-end">
                        <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded text-[10px] font-bold font-mono">
                          <Lock size={10} /> ĐÃ KHÓA
                        </span>

                        {selectedRound && selectedRound.status !== "completed" && !readOnly && (
                          <button
                            onClick={() => handleLockRound(selectedRound._id)}
                            className="bg-cyan-500 hover:bg-cyan-500 text-[10px] font-bold px-3 py-1.5 rounded text-white cursor-pointer font-sans shadow-lg hover:shadow-cyan-500/20 transition-all uppercase tracking-wider mt-1"
                          >
                            Khóa & Công Bố Điểm Vòng Đấu
                          </button>
                        )}

                        {selectedRound && selectedRound.status === "completed" && !readOnly && (() => {
                          const currentOrder = selectedRound.order;
                          const nextRoundObj = rounds.find((r: any) => r.order === currentOrder + 1);
                          const canAdvance = nextRoundObj && nextRoundObj.status === 'pending';

                          if (canAdvance) {
                            return (
                              <button
                                onClick={() => handleAdvanceRound(selectedRound._id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold px-3 py-1.5 rounded text-white cursor-pointer font-sans shadow-lg hover:shadow-emerald-600/20 transition-all uppercase tracking-wider mt-1"
                              >
                                Chốt & Thăng Hạng Đội Thi
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ) : (
                      !readOnly && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditRubricName(rubric.name);
                              setEditRubricDesc(rubric.description || "");
                              setEditRubricTotalWeight(
                                String(rubric.totalWeight),
                              );
                              setEditRubricMaxScore(
                                String(rubric.maxCriterionScore),
                              );
                              setEditRubricIsActive(rubric.isActive);
                              setEditingRubric(true);
                            }}
                            className="bg-slate-850 hover:bg-slate-800 border border-cyan-500/20 text-[9px] font-bold px-2 py-0.5 rounded text-cyan-400 cursor-pointer"
                          >
                            SỬA
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteRubric}
                            className="bg-slate-850 hover:bg-slate-800 border border-rose-500/20 text-[9px] font-bold px-2 py-0.5 rounded text-rose-450 cursor-pointer"
                          >
                            XÓA
                          </button>
                        </div>
                      )
                    )}

                    {!rubric.isLocked && !readOnly ? (
                      <button
                        onClick={handleLockRubric}
                        className="bg-cyan-500 hover:bg-cyan-400 text-[9px] font-bold px-2.5 py-1 rounded text-white cursor-pointer transition-all shadow-md shadow-cyan-500/20"
                      >
                        KHÓA RUBRIC
                      </button>
                    ) : isSystemAdmin && !readOnly ? (
                      <button
                        onClick={handleUnlockRubric}
                        className="bg-amber-600 hover:bg-amber-500 text-[9px] font-bold px-2.5 py-1 rounded text-white cursor-pointer transition-all shadow-md shadow-amber-600/20"
                        title="Quyền Super-Admin: Mở khóa Rubric để mở lại luồng chỉnh sửa tiêu chí"
                      >
                        MỞ KHÓA (UNLOCK)
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleExportRubric(rubric._id)}
                      className="bg-slate-800 hover:bg-slate-750 border border-slate-750 text-[9px] font-bold px-2.5 py-1 rounded text-slate-200 cursor-pointer shadow-md hover:text-white transition-all btn-import-export"
                    >
                      XUẤT JSON (EXPORT)
                    </button>
                  </div>
                </div>

                {/* Weight progress bar */}
                {(() => {
                  const currentWeightSum = criteria.reduce(
                    (sum, c) => sum + (c.weight || 0),
                    0,
                  );
                  const isFullyWeighted =
                    Math.abs(currentWeightSum - rubric.totalWeight) < 0.01;
                  return (
                    <div className="bg-slate-900/30 p-3.5 rounded-xl border border-slate-800 text-[10px] space-y-1.5">
                      <div className="flex justify-between items-center font-semibold font-mono">
                        <span className="text-slate-400">
                          Trọng số tiêu chí đã phân bổ:
                        </span>
                        <span
                          className={
                            isFullyWeighted
                              ? "text-emerald-400 font-bold"
                              : "text-amber-400 font-bold"
                          }
                        >
                          {currentWeightSum} / {rubric.totalWeight}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                        <div
                          className={`h-full transition-all duration-300 ${isFullyWeighted ? "bg-emerald-500" : "bg-cyan-500"
                            }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (currentWeightSum / rubric.totalWeight) * 100,
                            )}%`,
                          }}
                        ></div>
                      </div>
                      {!isFullyWeighted && !rubric.isLocked && (
                        <p className="text-[9px] text-amber-500/80 italic font-mono">
                          * Tổng trọng số tiêu chí phải bằng{" "}
                          {rubric.totalWeight}% mới có thể khoá Rubric.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Criteria list */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-300">
                    Tiêu chí chi tiết:
                  </p>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {criteria.map((c: any) => (
                      <div
                        key={c._id}
                        className="bg-slate-900/30 p-3 rounded-xl border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              [{c.code}] {c.name}
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5 font-normal leading-normal">
                              {c.description || "Không mô tả."}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="text-cyan-400 font-bold text-xs">
                              {c.weight}%
                            </span>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Max: {c.maxScore}đ | Hạng: {c.order || 0}
                            </p>
                          </div>
                        </div>

                        {c.gradingLevels && c.gradingLevels.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-800/80">
                            <div className="flex flex-wrap gap-1">
                              {c.gradingLevels.map((lvl: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="bg-slate-950 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-800 text-slate-300"
                                  title={lvl.description}
                                >
                                  <strong className="text-cyan-300 font-bold">
                                    {lvl.label}
                                  </strong>{" "}
                                  <span className="text-slate-400">
                                    ({lvl.minScore}-{lvl.maxScore}đ)
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {!rubric.isLocked && !readOnly && (
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditCriterion(c)}
                              className="text-[9px] text-cyan-400 hover:underline font-semibold cursor-pointer"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCriterion(c._id)}
                              className="text-[9px] text-rose-400 hover:underline font-semibold cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {criteria.length === 0 && (
                      <p className="text-xs text-slate-500 italic">
                        Chưa có tiêu chí nào.
                      </p>
                    )}
                  </div>
                </div>

                {/* Import/Export Buttons */}

                {!rubric.isLocked && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <span className="text-xs font-bold text-cyan-400 font-mono select-none">
                      Thêm tiêu chí qua file excel:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[12px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all btn-import-export"
                      >
                        <Download size={16} />
                        Tải Template Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCriteria}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[12px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all btn-import-export"
                      >
                        <Download size={16} />
                        Xuất Excel hiện tại
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-[12px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all btn-import-export"
                        >
                          <Upload size={16} />
                          Import từ Excel
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}

                {/* Import Error */}
                {importError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-rose-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-rose-400">{importError}</p>
                    <button onClick={handleCancelImport} className="ml-auto text-rose-400 hover:text-rose-300 cursor-pointer">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {importPreview && importPreview.length > 0 && (() => {
                  const hasIssues = importPreview.some((item: any) => item.issues && item.issues.length > 0);
                  const currentSum = criteria.reduce((s: number, c: any) => s + (c.weight || 0), 0);
                  const newSum = importPreview
                    .filter((item: any) => item.action !== "delete" && item.issues.length === 0)
                    .reduce((s: number, item: any) => s + (Number(item.weight) || 0), 0);
                  const totalAfter = newSum;
                  const exceeds = totalAfter > (rubric?.totalWeight || 100);

                  return (
                    <div className="bg-slate-950/80 border border-cyan-500/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                          <FileSpreadsheet size={14} />
                          Preview Import ({importPreview.length} tiêu chí)
                        </p>
                        <button
                          onClick={handleCancelImport}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Grading level defs summary */}
                      {importGradingDefs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[9px] text-slate-500 mr-1">Mức chấm:</span>
                          {importGradingDefs.map((def: any, i: number) => (
                            <span key={i} className="bg-slate-900 border border-slate-800 text-[8px] px-1.5 py-0.5 rounded text-cyan-300 font-mono">
                              {def.label} ({def.minScore}-{def.maxScore})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Preview table */}
                      <div className="max-h-[250px] overflow-y-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-800">
                              <th className="pb-1 pr-2">#</th>
                              <th className="pb-1 pr-2">Mã</th>
                              <th className="pb-1 pr-2">Tên tiêu chí</th>
                              <th className="pb-1 pr-2">Trọng số</th>
                              <th className="pb-1">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.map((item: any, idx: number) => {
                              const isDelete = item.action === "delete";
                              const isCreate = item.action === "create";
                              return (
                                <tr
                                  key={idx}
                                  className={`border-b border-slate-900/60 ${item.issues.length > 0
                                    ? "bg-rose-500/5"
                                    : isDelete
                                      ? "bg-rose-500/10 opacity-75"
                                      : isCreate
                                        ? "bg-emerald-500/5"
                                        : "bg-amber-500/5"
                                    }`}
                                >
                                  <td className="py-1.5 pr-2 text-slate-500">{item.rowNum}</td>
                                  <td className={`py-1.5 pr-2 font-bold font-mono ${isDelete ? "text-rose-450 line-through" : "text-slate-200"
                                    }`}>{item.code || "—"}</td>
                                  <td className={`py-1.5 pr-2 ${isDelete ? "text-rose-450 line-through" : "text-slate-300"
                                    }`}>{item.name || "—"}</td>
                                  <td className={`py-1.5 pr-2 font-mono ${isDelete ? "text-rose-450 line-through" : "text-cyan-400"
                                    }`}>{item.weight}%</td>
                                  <td className="py-1.5">
                                    {item.issues.length > 0 ? (
                                      <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded">
                                        {item.issues.join(", ")}
                                      </span>
                                    ) : isDelete ? (
                                      <span className="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold">
                                        XÓA
                                      </span>
                                    ) : isCreate ? (
                                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                                        THÊM MỚI
                                      </span>
                                    ) : (
                                      <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                                        CẬP NHẬT
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Weight summary */}
                      <div className={`text-[10px] font-mono p-2 rounded-lg border ${exceeds
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-450"
                        : "bg-slate-900/60 border-slate-800 text-slate-400"
                        }`}>
                        Trọng số hiện tại: {currentSum}% | Trọng số sau đồng bộ: <strong className={exceeds ? "text-rose-300" : "text-emerald-400"}>{totalAfter}%</strong> / {rubric?.totalWeight || 100}%
                        {exceeds && "Vượt quá giới hạn!"}
                        {hasIssues && "Có lỗi trong dữ liệu!"}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleConfirmImport}
                          disabled={importLoading || exceeds || hasIssues}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle size={12} />
                          {importLoading ? "Đang import..." : "Xác nhận Import"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelImport}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-4 rounded-lg cursor-pointer transition-all"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Import Result */}
                {importResult && (
                  <div className={`rounded-xl p-3 space-y-2 border ${(importResult.imported > 0 || importResult.updated > 0 || importResult.deleted > 0)
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-rose-500/10 border-rose-500/20"
                    }`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] font-bold ${(importResult.imported > 0 || importResult.updated > 0 || importResult.deleted > 0) ? "text-emerald-400" : "text-rose-400"
                        }`}>
                        {importResult.message}
                      </p>
                      <button
                        onClick={() => setImportResult(null)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {(importResult.imported > 0 || importResult.updated > 0 || importResult.deleted > 0) && (
                      <p className="text-[10px] text-emerald-300">
                        Đồng bộ thành công:
                        {importResult.imported > 0 && ` +Thêm: ${importResult.imported}`}
                        {importResult.updated > 0 && ` ~Sửa: ${importResult.updated}`}
                        {importResult.deleted > 0 && ` -Xóa: ${importResult.deleted}`}
                        {importResult.errorCount > 0 && ` | ❌ Lỗi: ${importResult.errorCount}`}
                      </p>
                    )}
                    {importResult.errors?.length > 0 && (
                      <div className="text-[9px] text-rose-400 space-y-0.5">
                        {importResult.errors.map((err: string, i: number) => (
                          <p key={i}>• {err}</p>
                        ))}
                      </div>
                    )}
                    {importResult.skippedDetails?.length > 0 && (
                      <div className="text-[9px] text-amber-400 space-y-0.5">
                        {importResult.skippedDetails.map((s: string, i: number) => (
                          <p key={i}>• {s}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Add/Edit Criterion Form */}
                {!rubric.isLocked && !readOnly && (
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    {/* Header trigger span */}
                    <div
                      onClick={() => setIsManualAddOpen(!isManualAddOpen)}
                      className="flex items-center justify-between cursor-pointer group py-1"
                    >
                      <span className="text-xs font-bold text-slate-300 group-hover:text-cyan-400 transition-colors flex items-center gap-1.5 font-mono select-none">
                        {isFormVisible ? (
                          <ChevronDown size={15} className="text-cyan-400" />
                        ) : (
                          <ChevronRight size={15} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
                        )}
                        {editingCriterion
                          ? `Sửa tiêu chí [${editingCriterion.code}]`
                          : "Thêm tiêu chí thủ công"}
                      </span>
                      {!editingCriterion && (
                        <span className="text-[14px] font-mono text-cyan-400/90 group-hover:text-cyan-300 text-cyan-400/90 border text-cyan-400/90 px-2 py-0.5 rounded-full transition-all">
                          {isFormVisible ? "Thu gọn" : "+ Nhập thủ công"}
                        </span>
                      )}
                    </div>

                    {/* Expandable Form Body */}
                    {isFormVisible && (
                      <form
                        onSubmit={handleSaveCriterion}
                        className="space-y-3 pt-1 animate-fadeIn"
                      >
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                              Mã tiêu chí
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Mã (e.g. CODE)"
                              value={critCode}
                              onChange={(e) => setCritCode(e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                              Tên tiêu chí
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Tên tiêu chí (e.g. Clean Code)"
                              value={critName}
                              onChange={(e) => setCritName(e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                              Trọng số %
                            </label>
                            <input
                              type="number"
                              required
                              placeholder="Trọng số %"
                              value={critWeight}
                              onChange={(e) => setCritWeight(e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                              Max Điểm
                            </label>
                            <input
                              type="number"
                              required
                              placeholder="Max Điểm"
                              value={critMaxScore}
                              onChange={(e) => setCritMaxScore(e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                            Mô tả tiêu chí
                          </label>
                          <input
                            type="text"
                            placeholder="Mô tả tiêu chí"
                            value={critDesc}
                            onChange={(e) => setCritDesc(e.target.value)}
                            className="w-full px-3 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                          />
                        </div>

                        {/* Grading Levels Management in Form */}
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900 space-y-2.5">
                          <p className="text-xs font-bold text-slate-350 font-mono uppercase tracking-wider">
                            Định nghĩa mức chấm (Grading Levels)
                          </p>

                          {/* Display currently added levels in form */}
                          {critGradingLevels.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {critGradingLevels.map((lvl, idx) => (
                                <div
                                  key={idx}
                                  className="bg-slate-900 border border-slate-800 text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono"
                                >
                                  <span className="text-slate-300">
                                    <strong className="text-cyan-400">
                                      {lvl.label}
                                    </strong>{" "}
                                    ({lvl.minScore}-{lvl.maxScore}đ)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveGradingLevel(idx)}
                                    className="text-rose-400 font-bold hover:text-rose-350"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Form inputs for new level */}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                                Nhãn
                              </label>
                              <input
                                type="text"
                                placeholder="Nhãn (Tốt)"
                                value={levelLabel}
                                onChange={(e) => setLevelLabel(e.target.value)}
                                className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                                Điểm min
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="Điểm min (7.0)"
                                value={levelMinScore}
                                onChange={(e) => setLevelMinScore(e.target.value)}
                                className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                                Điểm max
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="Điểm max (8.5)"
                                value={levelMaxScore}
                                onChange={(e) => setLevelMaxScore(e.target.value)}
                                className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 font-mono">
                              Mô tả chi tiết mức chấm
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Mô tả chi tiết mức chấm này..."
                                value={levelDesc}
                                onChange={(e) => setLevelDesc(e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-[11px] placeholder:text-slate-500 font-mono"
                              />
                              <button
                                type="button"
                                onClick={handleAddGradingLevel}
                                className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded text-xs font-bold font-mono cursor-pointer whitespace-nowrap"
                              >
                                + Thêm
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold py-2 rounded-lg cursor-pointer"
                          >
                            {editingCriterion ? "Lưu cập nhật" : "Lưu tiêu chí"}
                          </button>
                          {editingCriterion && (
                            <button
                              type="button"
                              onClick={handleCancelEditCriterion}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
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
            )
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleCreateRubric} className="space-y-3 font-mono">
                <p className="text-xs text-slate-400">
                  Chưa khởi tạo Rubric cho Vòng Đấu này.
                </p>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Tên Rubric mới
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tên Rubric (e.g. Rubric Đánh giá Vòng 1)"
                    value={rubricName}
                    onChange={(e) => setRubricName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-200"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-500 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer"
                >
                  Khởi tạo Rubric
                </button>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-[9px] text-slate-550 uppercase tracking-widest font-bold font-mono">HOẶC NHẬP TỪ FILE</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3 font-mono">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Nhập từ file JSON Rubric
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportRubric}
                  className="w-full text-xs text-slate-450 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
                <p className="text-[9px] text-slate-500">
                  * Tải lên tệp cấu hình Rubric JSON đã xuất trước đó để sao chép toàn bộ tiêu chí & mức điểm.
                </p>
              </div>
            </div>
          )
        ) : (
          <p className="text-xs text-slate-500 italic text-center py-4 font-mono">
            Vui lòng chọn Vòng Đấu để cấu hình Rubric.
          </p>
        )}
      </div>

      {/* Edit Round Modal */}
      {editingRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Edit2 className="text-cyan-400" size={18} />
                <span>Chỉnh Sửa Vòng Thi</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingRound(null)}
                className="text-slate-400 hover:text-white cursor-pointer text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditRound} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tên Vòng Thi <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={editRoundNameInput}
                  onChange={(e) => setEditRoundNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Vòng Sơ Loại"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Thứ Tự Vòng <span className="text-rose-500">*</span></label>
                {editingRound.advanceTopN === 0 ? (
                  <input
                    type="text"
                    disabled
                    value={editRoundOrderInput}
                    className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-slate-500 cursor-not-allowed"
                  />
                ) : (
                  <input
                    type="number"
                    required
                    min="1"
                    value={editRoundOrderInput}
                    onChange={(e) => setEditRoundOrderInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRound(null)}
                  className="btn-cancel px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-mono text-xs cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl font-mono text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  Cập Nhật Vòng Thi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
