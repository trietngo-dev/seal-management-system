import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import CustomDateRangePicker from "../shared/CustomDateRangePicker";

interface SeminarTabProps {
  selectedEvent: any;
  fetchEventDetails: () => Promise<void>;
  readOnly?: boolean;
  isWizardMode?: boolean;
  onPrevStep?: () => void;
  onCompleteWizard?: () => void;
}

export default function SeminarTab({
  selectedEvent,
  fetchEventDetails,
  readOnly = false,
  isWizardMode = false,
  onPrevStep,
  onCompleteWizard,
}: SeminarTabProps) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attendanceFormUrl, setAttendanceFormUrl] = useState("");
  const [attendanceSpreadsheetUrl, setAttendanceSpreadsheetUrl] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedEvent && selectedEvent.seminar) {
      const sem = selectedEvent.seminar;
      setScheduledAt(sem.scheduledAt ? new Date(sem.scheduledAt).toISOString().slice(0, 16) : "");
      setScheduledEnd(sem.scheduledEnd ? new Date(sem.scheduledEnd).toISOString().slice(0, 16) : "");
      setMeetUrl(sem.meetUrl || "");
      setTitle(sem.title || "Buổi Seminar Hướng Dẫn & Giải Đáp Thắc Mắc Cuộc Thi");
      setDescription(sem.description || "");
      setAttendanceFormUrl(sem.attendanceFormUrl || "");
      setAttendanceSpreadsheetUrl(sem.attendanceSpreadsheetUrl || "");
    } else {
      setScheduledAt("");
      setScheduledEnd("");
      setMeetUrl("");
      setTitle("Buổi Seminar Hướng Dẫn & Giải Đáp Thắc Mắc Cuộc Thi");
      setDescription("");
      setAttendanceFormUrl("");
      setAttendanceSpreadsheetUrl("");
    }
  }, [selectedEvent]);

  if (!selectedEvent) {
    return (
      <div className="glass p-8 rounded-2xl text-center text-slate-400 font-mono">
        Vui lòng chọn một cuộc thi để cấu hình Seminar & Thông báo.
      </div>
    );
  }

  const token = localStorage.getItem("token");

  const handleSaveSeminar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}/seminar`,
        {
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
          meetUrl,
          title,
          description,
          attendanceFormUrl,
          attendanceSpreadsheetUrl,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || "Đã lưu cấu hình Seminar thành công!");
      await fetchEventDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi lưu cấu hình Seminar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="glass p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wide">
              Quản Lỳ Lịch Seminar & Link Google Meet
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Thiết lập lịch Seminar hướng dẫn và link phòng họp Google Meet. Thông tin này sẽ được đính kèm trực tiếp vào email mời tham gia gửi đến thí sinh.
            </p>
          </div>
        </div>
      </div>

      {/* Form Grid */}
      <form onSubmit={handleSaveSeminar} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Seminar Info Setup */}
        <div className="lg:col-span-2 glass p-6 rounded-2xl space-y-4 font-mono">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
            Thông Tin Lịch Họp & Link Meet
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Tiêu Đề Buổi Seminar <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={readOnly}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-cyan-500"
              placeholder="e.g. Seminar Hướng Dẫn & Giải Đáp Thắc Mắc Cuộc Thi"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              Thời Gian Tổ Chức Seminar (Mở Seminar → Đóng Seminar) <span className="text-rose-500">*</span>
            </label>
            <CustomDateRangePicker
              startValue={scheduledAt}
              endValue={scheduledEnd}
              onStartChange={setScheduledAt}
              onEndChange={setScheduledEnd}
              startLabel="Bắt đầu Seminar"
              endLabel="Kết thúc Seminar"
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Link Phòng Họp (Google Meet URL) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="url"
                required
                disabled={readOnly}
                value={meetUrl}
                onChange={(e) => setMeetUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-16 py-2.5 text-xs text-cyan-300 focus:outline-hidden focus:border-cyan-500 font-mono"
                placeholder="https://meet.google.com/abc-xyz-def"
              />
              {meetUrl && (
                <a
                  href={meetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute right-3 top-2.5 text-[10px] text-cyan-400 hover:underline font-bold"
                  title="Mở link Meet thử"
                >
                  [MỞ LINK]
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nội Dung Mô Tả / Lưu Ý Phổ Biến
            </label>
            <textarea
              rows={3}
              disabled={readOnly}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-cyan-500"
              placeholder="Nhập nội dung lưu ý cho thí sinh (ví dụ: Chuẩn bị thẻ sinh viên, bật camera khi tham gia...)"
            />
          </div>

          {!readOnly && (
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 uppercase tracking-wider font-mono"
              >
                {saving ? "Đang lưu..." : "Lưu Cấu Hình Seminar"}
              </button>
            </div>
          )}
        </div>

        {/* Column 3: Attendance Setup & Bonus Features */}
        <div className="lg:col-span-1 glass p-6 rounded-2xl space-y-4 font-mono flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              Điểm Danh & Minh Chứng
            </h3>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tích hợp Google Form để thí sinh gửi ảnh chụp minh chứng tham gia Seminar và link Google Sheet cho Admin theo dõi.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Link Google Form Điểm Danh
              </label>
              <input
                type="url"
                disabled={readOnly}
                value={attendanceFormUrl}
                onChange={(e) => setAttendanceFormUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                placeholder="https://forms.google.com/..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Link Google Sheet Tổng Hợp
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  disabled={readOnly}
                  value={attendanceSpreadsheetUrl}
                  onChange={(e) => setAttendanceSpreadsheetUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300 focus:outline-hidden focus:border-emerald-500"
                  placeholder="https://docs.google.com/spreadsheets/..."
                />
                {attendanceSpreadsheetUrl && (
                  <a
                    href={attendanceSpreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 hover:text-white rounded-xl flex items-center justify-center shrink-0 transition-colors text-[10px] font-bold"
                    title="Mở Google Sheet điểm danh"
                  >
                    [XEM SHEET]
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-850 text-[10px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-300">Ghi chú hệ thống:</div>
            <div>- Hệ thống tự động quét và chỉ phát email 1 lần duy nhất khi đến thời gian bắt đầu Seminar.</div>
            <div>- Hoặc Ban tổ chức có thể bấm "Gửi Mail Ngay" để phát thủ công bất cứ lúc nào.</div>
          </div>
        </div>
      </form>

      {isWizardMode && (
        <div className="mt-8 p-4 glass rounded-2xl flex justify-between items-center">
          <button
            type="button"
            onClick={onPrevStep}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            ← Quay lại: Thiết lập thời gian
          </button>
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              try {
                const res = await axios.put(
                  `http://localhost:5000/api/events/${selectedEvent._id}/seminar`,
                  {
                    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
                    scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
                    meetUrl,
                    title,
                    description,
                    attendanceFormUrl,
                    attendanceSpreadsheetUrl,
                  },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success(res.data.message || "Đã lưu cấu hình Seminar thành công!");
                await fetchEventDetails();
                if (onCompleteWizard) {
                  onCompleteWizard();
                }
              } catch (err: any) {
                toast.error(err.response?.data?.message || "Lỗi khi lưu cấu hình Seminar.");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? "Đang lưu & hoàn tất..." : "Hoàn tất khởi tạo cuộc thi ✓"}
          </button>
        </div>
      )}
    </div>
  );
}
