import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useLocation } from "react-router-dom";

interface CustomDateTimePickerProps {
  value: string; // Format: YYYY-MM-DDTHH:MM
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

const MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const getCombinedDate = (date: Date | null, hr24: number, min: number): Date | null => {
  if (!date) return null;
  const newDate = new Date(date);
  newDate.setHours(hr24, min, 0, 0);
  return newDate;
};

// Custom scrollable picker (replaces native select to control dropdown height)
function TimeSelect({
  value,
  onChange,
  options,
  disabledOptions = [],
}: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
  disabledOptions?: number[];
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const usesLightShell = location.pathname === '/' || location.pathname === '/team-area' || location.pathname === '/register-team' || location.pathname === '/login' || location.pathname === '/achievements' || location.pathname === '/guest-portal' || location.pathname.startsWith('/admin');

  // Scroll selected item into center on mount/value change
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const idx = options.indexOf(value);
    if (idx < 0) return;
    const itemH = 32; // h-8
    el.scrollTop = idx * itemH - el.clientHeight / 2 + itemH / 2;
  }, [value, options]);

  return (
    <div
      ref={listRef}
      className={`w-16 h-[128px] overflow-y-auto scrollbar-none border rounded-lg ${
        usesLightShell
          ? "bg-white border-slate-200 text-slate-800"
          : "bg-slate-900 border border-slate-700 text-slate-400"
      }`}
      style={{ scrollbarWidth: "none" }}
    >
      {options.map((o) => {
        const active = o === value;
        const isDisabled = disabledOptions.includes(o);
        return (
          <button
            key={o}
            type="button"
            disabled={isDisabled}
            onClick={() => onChange(o)}
            className={`w-full h-8 flex items-center justify-center text-xs font-mono font-semibold transition-all ${
              isDisabled
                ? usesLightShell
                  ? "text-slate-350 opacity-40 cursor-not-allowed"
                  : "text-slate-800 opacity-20 cursor-not-allowed"
                : active
                ? usesLightShell
                  ? "bg-primary text-white font-bold cursor-pointer"
                  : "bg-cyan-500 text-slate-955 font-bold cursor-pointer"
                : usesLightShell
                ? "text-slate-600 hover:bg-slate-100 hover:text-primary cursor-pointer"
                : "text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            }`}
          >
            {String(o).padStart(2, "0")}
          </button>
        );
      })}
    </div>
  );
}

export default function CustomDateTimePicker({
  value,
  onChange,
  placeholder = "Chọn thời gian...",
  disabled = false,
  minDate,
  maxDate,
}: CustomDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const usesLightShell = location.pathname === '/' || location.pathname === '/team-area' || location.pathname === '/register-team' || location.pathname === '/login' || location.pathname === '/achievements' || location.pathname === '/guest-portal' || location.pathname.startsWith('/admin');

  // Date state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Time state (24-hour format)
  const [selectedHour, setSelectedHour] = useState(() => new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(() => new Date().getMinutes());
  const [timeError, setTimeError] = useState("");

  // Parse initial value
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setCurrentMonth(parsed);
        
        setSelectedHour(parsed.getHours());
        setSelectedMinute(parsed.getMinutes());
        
        const err = validate(parsed, parsed.getHours(), parsed.getMinutes());
        setTimeError(err);
        return;
      }
    } else {
      setSelectedDate(null);
      let defaultDate = new Date();
      if (minDate) {
        const parsedMin = new Date(minDate);
        if (!isNaN(parsedMin.getTime()) && parsedMin > defaultDate) {
          defaultDate = parsedMin;
        }
      }
      setCurrentMonth(new Date(defaultDate.getFullYear(), defaultDate.getMonth(), 1));
      
      setSelectedHour(defaultDate.getHours());
      setSelectedMinute(defaultDate.getMinutes());
      setTimeError("");
    }
  }, [value, isOpen, minDate, maxDate]);

  // Helper to check if a specific hour is disabled
  const isHourDisabled = (hr: number, customDate: Date | null = selectedDate) => {
    if (!customDate) return false;
    const dateToCheck = new Date(customDate);
    if (minDate) {
      const minD = new Date(minDate);
      dateToCheck.setHours(hr, 59, 59, 999);
      if (dateToCheck <= minD) return true;
    }
    if (maxDate) {
      const maxD = new Date(maxDate);
      dateToCheck.setHours(hr, 0, 0, 0);
      if (dateToCheck > maxD) return true;
    }
    const now = new Date();
    dateToCheck.setHours(hr, 59, 59, 999);
    if (dateToCheck < now) return true;
    return false;
  };

  // Helper to check if a specific minute is disabled under a given hour
  const isMinuteDisabled = (min: number, h: number = selectedHour, customDate: Date | null = selectedDate) => {
    if (!customDate) return false;
    const dateToCheck = new Date(customDate);
    dateToCheck.setHours(h, min, 0, 0);
    if (minDate) {
      const minD = new Date(minDate);
      if (dateToCheck <= minD) return true;
    }
    if (maxDate) {
      const maxD = new Date(maxDate);
      if (dateToCheck > maxD) return true;
    }
    const now = new Date();
    if (dateToCheck < now) return true;
    return false;
  };

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  const minutesArray = Array.from({ length: 60 }, (_, i) => i);

  // Time clamping effect to ensure selected hour/min are always valid
  useEffect(() => {
    if (!value || !selectedDate) return;

    let dateObj = selectedDate;
    if (isDateDisabled(selectedDate) && minDate) {
      const minD = new Date(minDate);
      dateObj = minD;
    }

    let currentHour = selectedHour;
    if (isHourDisabled(currentHour, dateObj)) {
      const validHr = hoursArray.find((h) => !isHourDisabled(h, dateObj));
      if (validHr !== undefined) currentHour = validHr;
    }

    let currentMin = selectedMinute;
    if (isMinuteDisabled(currentMin, currentHour, dateObj)) {
      const validMin = minutesArray.find((m) => !isMinuteDisabled(m, currentHour, dateObj));
      if (validMin !== undefined) currentMin = validMin;
    }

    if (currentHour !== selectedHour) setSelectedHour(currentHour);
    if (currentMin !== selectedMinute) setSelectedMinute(currentMin);
  }, [selectedDate, minDate, maxDate]);

  // Click outside handling
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleOpen = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  const displayFormat = (date: Date | null) => {
    if (!date) return "";
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const y = date.getFullYear();
    const hr = date.getHours();
    const min = String(date.getMinutes()).padStart(2, "0");
    const ampm = hr >= 12 ? "PM" : "AM";
    const hr12 = hr % 12 === 0 ? 12 : hr % 12;
    return `${m}/${d}/${y} ${String(hr12).padStart(2, "0")}:${min} ${ampm}`;
  };

  const validate = (date: Date | null, hr: number, min: number): string => {
    if (!date) return "";
    const combined = getCombinedDate(date, hr, min);
    if (!combined) return "";
    
    const now = new Date();
    if (combined < now) {
      return "Không chọn thời gian quá khứ";
    }
    
    if (minDate) {
      const minD = new Date(minDate);
      if (combined < minD) {
        return "Thời gian không hợp lệ (trước mốc tối thiểu)";
      }
    }
    
    if (maxDate) {
      const maxD = new Date(maxDate);
      if (combined > maxD) {
        return "Thời gian không hợp lệ (vượt mốc tối đa)";
      }
    }
    
    return "";
  };

  const handleSelectDay = (date: Date) => {
    if (isDateDisabled(date)) return;
    setSelectedDate(date);
    const err = validate(date, selectedHour, selectedMinute);
    setTimeError(err);
  };

  const handleSelectHour = (hr: number) => {
    setSelectedHour(hr);
    const err = validate(selectedDate, hr, selectedMinute);
    setTimeError(err);
  };

  const handleSelectMinute = (min: number) => {
    setSelectedMinute(min);
    const err = validate(selectedDate, selectedHour, min);
    setTimeError(err);
  };

  const handleConfirm = () => {
    const err = validate(selectedDate, selectedHour, selectedMinute);
    if (err) {
      setTimeError(err);
      return;
    }
    if (selectedDate) {
      const formatted = toOutputString(selectedDate, selectedHour, selectedMinute);
      onChange(formatted);
    }
    setIsOpen(false);
  };

  const toOutputString = (date: Date, hr: number, min: number): string => {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(hr).padStart(2, "0");
    const m = String(min).padStart(2, "0");
    return `${y}-${mo}-${d}T${h}:${m}`;
  };

  const handleClear = () => {
    onChange("");
    setSelectedDate(null);
    setIsOpen(false);
  };

  const handleToday = () => {
    const now = new Date();
    if (isDateDisabled(now)) return;
    setSelectedDate(now);
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
    setCurrentMonth(now);
    const err = validate(now, now.getHours(), now.getMinutes());
    setTimeError(err);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const isDateDisabled = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(d);
    checkDate.setHours(0, 0, 0, 0);
    if (checkDate < today) return true;

    if (minDate) {
      const minD = new Date(minDate);
      minD.setHours(0, 0, 0, 0);
      if (checkDate < minD) return true;
    }
    if (maxDate) {
      const maxD = new Date(maxDate);
      maxD.setHours(23, 59, 59, 999);
      if (checkDate > maxD) return true;
    }
    return false;
  };

  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotal = new Date(year, month, 0).getDate();

  const cells: { day: number; isCurrentMonth: boolean; date: Date }[] = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    cells.push({
      day: prevTotal - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevTotal - i),
    });
  }
  for (let i = 1; i <= totalDays; i++) {
    cells.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    });
  }
  const rowRem = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let i = 1; i <= rowRem; i++) {
    cells.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Display Area */}
      <div
        onClick={toggleOpen}
        className={`w-full border rounded-xl px-4 py-2.5 text-xs flex justify-between items-center cursor-pointer select-none transition-all ${
          usesLightShell
            ? "bg-white border-slate-300 hover:border-primary text-slate-800"
            : "bg-slate-900/80 border-slate-700 hover:border-cyan-500/50 text-white"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${
          isOpen
            ? usesLightShell
              ? "border-primary shadow-[0_0_10px_rgba(242,112,36,0.15)]"
              : "border-cyan-500/80 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
            : ""
        }`}
      >
        <span className={value ? usesLightShell ? "text-slate-800 font-mono" : "text-white font-mono" : "text-slate-400"}>
          {value ? displayFormat(getCombinedDate(selectedDate, selectedHour, selectedMinute)) : placeholder}
        </span>
        <Calendar size={16} className={usesLightShell ? "text-primary shrink-0 cursor-pointer" : "text-cyan-300 hover:text-cyan-400 shrink-0 cursor-pointer transition-colors"} />
      </div>

      {/* Popover DateTime Picker Dropdown */}
      {isOpen && (
        <div className={`absolute z-50 mt-2 p-4 border rounded-2xl flex gap-4 animate-fadeIn select-none right-0 md:left-0 md:right-auto min-w-[500px] ${
          usesLightShell
            ? "bg-white border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-slate-800"
            : "bg-slate-955 border border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_15px_rgba(0,240,255,0.05)] text-slate-300"
        }`}>
          {/* LEFT: Calendar Section */}
          <div className={`w-[260px] border-r pr-4 ${usesLightShell ? 'border-slate-200' : 'border-slate-800/80'}`}>
            {/* Header: Prev, Month/Year, Next */}
            <div className="flex justify-between items-center mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  usesLightShell 
                    ? "border-slate-200 hover:border-primary/40 hover:bg-primary/10 text-slate-600 hover:text-primary" 
                    : "border-slate-800 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400"
                }`}
              >
                <ChevronLeft size={14} />
              </button>
              
              <span className={`text-xs font-bold font-mono uppercase tracking-wider ${usesLightShell ? "text-slate-800" : "text-white"}`}>
                {MONTHS[month]} {year}
              </span>
              
              <button
                type="button"
                onClick={handleNextMonth}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  usesLightShell 
                    ? "border-slate-200 hover:border-primary/40 hover:bg-primary/10 text-slate-600 hover:text-primary" 
                    : "border-slate-800 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400"
                }`}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Weekdays Headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-1 font-mono">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {cells.map((cell, idx) => {
                const isSelected = selectedDate ? isSameDay(cell.date, selectedDate) : false;
                const isToday = isSameDay(cell.date, new Date());
                const isDisabled = isDateDisabled(cell.date);
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(cell.date)}
                    disabled={isDisabled}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-mono font-semibold transition-all ${
                      isDisabled
                        ? usesLightShell
                          ? "text-slate-350 opacity-40 cursor-not-allowed"
                          : "text-slate-800 opacity-20 cursor-not-allowed"
                        : !cell.isCurrentMonth
                        ? usesLightShell
                          ? "text-slate-350 hover:text-slate-500 hover:bg-slate-100 cursor-pointer"
                          : "text-slate-600 hover:text-slate-400 hover:bg-slate-900 cursor-pointer"
                        : isSelected
                        ? usesLightShell
                          ? "bg-primary text-white font-bold shadow-[0_0_12px_rgba(242,112,36,0.35)] cursor-pointer"
                          : "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)] cursor-pointer"
                        : isToday
                        ? usesLightShell
                          ? "border border-primary/50 text-primary cursor-pointer"
                          : "border border-cyan-500/50 text-cyan-400 cursor-pointer"
                        : usesLightShell
                        ? "text-slate-700 hover:bg-slate-100 hover:text-primary cursor-pointer"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Bottom Controls */}
            <div className={`flex justify-between items-center mt-4 pt-3 border-t ${usesLightShell ? 'border-slate-200' : 'border-slate-900'}`}>
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
              >
                Xóa
              </button>
              
              <button
                type="button"
                onClick={handleToday}
                className={`text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  usesLightShell ? 'text-primary hover:text-[#e05e1b]' : 'text-cyan-400 hover:text-cyan-300'
                }`}
              >
                Hôm nay
              </button>
            </div>
          </div>

          {/* RIGHT: Time Selection Section */}
          <div className="grow flex flex-col justify-between pl-4">
            <div>
              <div className={`border-b pb-2 mb-3 flex items-center gap-1.5 ${usesLightShell ? 'border-slate-200' : 'border-slate-800/80'}`}>
                <Clock size={12} className={usesLightShell ? 'text-primary' : 'text-cyan-400'} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Thời gian</span>
              </div>

              <div className="flex items-center justify-center gap-2 h-[128px] mb-4">
                <TimeSelect
                  value={selectedHour}
                  onChange={handleSelectHour}
                  options={hoursArray}
                  disabledOptions={hoursArray.filter(hr => isHourDisabled(hr))}
                />
                <span className="text-slate-400 font-mono font-bold text-lg self-center">:</span>
                <TimeSelect
                  value={selectedMinute}
                  onChange={handleSelectMinute}
                  options={minutesArray}
                  disabledOptions={minutesArray.filter(min => isMinuteDisabled(min))}
                />
              </div>
            </div>

            {/* OK Button */}
            <div className={`pt-2 border-t flex flex-col gap-2 ${usesLightShell ? 'border-slate-200' : 'border-slate-900'}`}>
              {timeError && (
                <span className="text-[10px] text-rose-500 font-bold font-mono text-center">
                  {timeError}
                </span>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!!timeError || !selectedDate}
                className={`w-full py-2 text-xs font-bold uppercase tracking-wider font-mono rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  usesLightShell
                    ? "bg-primary hover:bg-[#e05e1b] text-white shadow-[0_0_16px_rgba(242,112,36,0.25)]"
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_16px_rgba(0,240,255,0.25)]"
                }`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
