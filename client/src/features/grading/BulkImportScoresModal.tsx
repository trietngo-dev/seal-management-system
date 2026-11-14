import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface BulkImportScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  roundId: string;
  roundName: string;
  trackId: string;
  trackName: string;
  onSuccess: () => void;
}

export default function BulkImportScoresModal({
  isOpen,
  onClose,
  roundId,
  roundName,
  trackId,
  trackName,
  onSuccess
}: BulkImportScoresModalProps) {
  const token = localStorage.getItem('token');

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [parsingFile, setParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  if (!isOpen) return null;

  // Handle template download
  const handleDownloadTemplate = async () => {
    if (!trackId || !roundId) {
      toast.error('Vui lòng chọn đầy đủ Vòng thi và Bảng đấu để tải form mẫu.');
      return;
    }

    setDownloadingTemplate(true);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/grades/track/${trackId}/round/${roundId}/import-template`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const cleanTrackName = (trackName || 'Track').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      const cleanRoundName = (roundName || 'Round').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      const filename = `Form_Cham_Diem_${cleanTrackName}_${cleanRoundName}.xlsx`;

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Đã tải về file form mẫu chấm điểm thành công!');
    } catch (err: any) {
      console.error('Download template error:', err);
      toast.error(err.response?.data?.message || 'Lỗi khi tải file form mẫu chấm điểm.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Handle file select and preview parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParseError('');
    setImportResult(null);
    setParsingFile(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames.find(
        (n) => n.toUpperCase().includes('FORM') || n.toUpperCase().includes('DIEM')
      ) || workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error('Không tìm thấy sheet dữ liệu trong file Excel.');
      }

      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      if (!rawRows || rawRows.length < 2) {
        throw new Error('File Excel không có dữ liệu để hiển thị.');
      }

      // Locate header row
      let headerRowIdx = -1;
      for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r];
        if (
          row.some(
            (cell) =>
              typeof cell === 'string' &&
              (cell.includes('Mã Đội') || cell.includes('_teamId') || cell.includes('Tên Đội Thi'))
          )
        ) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx === -1) {
        throw new Error('Không tìm thấy dòng tiêu đề bảng điểm (cần có cột Mã Đội, Tên Đội Thi, Email Giám Khảo...).');
      }

      const headers = rawRows[headerRowIdx].map((h) => String(h || '').trim());
      // Filter out hidden columns starting with '_' for the preview
      const visibleHeaders = headers.filter((h) => !h.startsWith('_'));
      setPreviewHeaders(visibleHeaders);

      const rows: any[] = [];
      for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.every((cell) => String(cell || '').trim() === '')) continue;

        const rowObj: any = {};
        headers.forEach((h, cIdx) => {
          rowObj[h] = row[cIdx] !== undefined ? row[cIdx] : '';
        });
        rows.push(rowObj);
      }

      setPreviewRows(rows);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setParseError(err.message || 'Lỗi đọc file Excel.');
      setPreviewRows([]);
      setPreviewHeaders([]);
    } finally {
      setParsingFile(false);
    }
  };

  // Submit bulk import
  const handleImportSubmit = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn file Excel để import.');
      return;
    }

    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (roundId) formData.append('roundId', roundId);
    if (trackId) formData.append('trackId', trackId);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/grades/import-track-scores',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const resData = response.data;
      setImportResult(resData);
      toast.success(resData.message || 'Import điểm thành công!');
      onSuccess();
    } catch (err: any) {
      console.error('Import scores error:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi import điểm.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto flex flex-col space-y-5">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-xl bg-orange-50 text-primary border border-orange-100">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                Import Điểm Chấm Thi Theo Bảng Đấu
              </h3>
              <span className="rounded-lg bg-orange-100 border border-orange-200 px-2.5 py-0.5 text-xs font-bold text-primary font-mono">
                {trackName || 'Bảng đấu'}
              </span>
              <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {roundName || 'Vòng thi'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              Tải form mẫu đã điền sẵn danh sách đội và toàn bộ giám khảo, nhập điểm chi tiết từng tiêu chí và tải lên để cập nhật hàng loạt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Download Template */}
        <div className="bg-linear-to-r from-orange-50/70 to-slate-50 border border-orange-200/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                1
              </span>
              <h4 className="text-sm font-bold text-slate-800">Tải Form Mẫu Đầy Đủ Giám Khảo</h4>
            </div>
            <p className="text-xs text-slate-600 pl-8">
              File Excel bao gồm toàn bộ đội thi trong bảng, toàn bộ giám khảo được phân công cho vòng thi và thang điểm Rubric.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl text-white bg-primary hover:bg-[#d95d16] active:scale-[0.98] transition shadow-xs whitespace-nowrap self-stretch sm:self-auto justify-center"
          >
            {downloadingTemplate ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang tạo form...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Tải File Form Mẫu (.xlsx)</span>
              </>
            )}
          </button>
        </div>

        {/* Step 2: Upload File */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              2
            </span>
            <h4 className="text-sm font-bold text-slate-800">Tải Lên File Excel Đã Điền Điểm</h4>
          </div>

          <label className="border-2 border-dashed border-slate-300 hover:border-primary bg-slate-50/50 hover:bg-orange-50/20 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition text-center group">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="sr-only"
            />
            <div className="p-3 rounded-full bg-white shadow-xs border border-slate-200 group-hover:border-orange-300 group-hover:scale-105 transition mb-2 text-primary">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-slate-700">
              {selectedFile ? selectedFile.name : 'Nhấp để chọn hoặc kéo thả file Excel (.xlsx, .xls)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Hỗ trợ định dạng Excel tiêu chuẩn xuất từ hệ thống. Dung lượng tối đa 10MB.
            </p>
          </label>
        </div>

        {/* Parse Error */}
        {parseError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Lỗi xử lý file Excel:</p>
              <p>{parseError}</p>
            </div>
          </div>
        )}

        {/* Parsing Indicator */}
        {parsingFile && (
          <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Đang đọc và phân tích dữ liệu bảng điểm...</span>
          </div>
        )}

        {/* Step 3: Data Preview */}
        {previewRows.length > 0 && !parsingFile && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                  3
                </span>
                <h4 className="text-sm font-bold text-slate-800">
                  Xem Trước Dữ Liệu ({previewRows.length} dòng phiếu chấm)
                </h4>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Kiểm tra trước khi xác nhận lưu
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700 font-bold text-[11px] uppercase border-b border-slate-200">
                  <tr>
                    {previewHeaders.map((h, i) => (
                      <th key={i} className="p-2.5 whitespace-nowrap">
                        {h.split('\n')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/80 transition font-sans">
                      {previewHeaders.map((h, cIdx) => {
                        const val = row[h];
                        const isScore = typeof val === 'number' || (!isNaN(Number(val)) && val !== '');
                        return (
                          <td
                            key={cIdx}
                            className={`p-2.5 text-slate-700 whitespace-nowrap ${
                              isScore ? 'font-mono text-center font-semibold text-slate-900' : ''
                            }`}
                          >
                            {val !== '' ? String(val) : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 4: Import Result Report */}
        {importResult && (
          <div
            className={`p-4 rounded-xl border ${
              importResult.errorCount > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {importResult.errorCount > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              <span>{importResult.message}</span>
            </div>
            <div className="text-xs mt-2 space-y-1">
              <p>
                ✓ Số phiếu chấm hợp lệ đã lưu:{' '}
                <strong className="text-emerald-700">{importResult.successCount}</strong> (trong đó{' '}
                {importResult.updatedCount} cập nhật mới).
              </p>
              {importResult.errorCount > 0 && (
                <div>
                  <p className="text-rose-700 font-semibold">
                    ⚠ Có {importResult.errorCount} dòng gặp lỗi:
                  </p>
                  <ul className="list-disc list-inside mt-1 max-h-24 overflow-y-auto pl-2 text-[11px] text-rose-800">
                    {importResult.errors?.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleImportSubmit}
            disabled={importing || !selectedFile || previewRows.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-primary hover:bg-[#d95d16] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition active:scale-[0.98]"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý import...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Xác Nhận Import Điểm</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
