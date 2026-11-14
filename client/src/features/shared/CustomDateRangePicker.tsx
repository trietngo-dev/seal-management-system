import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import ReactDOM from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useLocation } from "react-router-dom";

interface CustomDateRangePickerProps {
  startValue: string; // YYYY-MM-DDTHH:MM
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

const MONTHS = [
  "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
  "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12",
];
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const isSameDay = (d1: Date, d2: Date) =>
  d1.getDate() === d2.getDate() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getFullYear() === d2.getFullYear();

const isPastDay = (d: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(d);
  check.setHours(0, 0, 0, 0);
  return check < today;
};

// Display format: MM/DD/YYYY HH:MM AM/PM
const displayFormat = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  const hr = d.getHours();
  const ampm = hr >= 12 ? "PM" : "AM";
  const hr12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${m}/${day}/${y} ${String(hr12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
};

const parseToDate = (str: string): Date | null => {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const toOutputString = (date: Date, hour24: number, min: number): string => {
  const d = new Date(date);
  d.setHours(hour24, min, 0, 0);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${da}T${h}:${mi}`;
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
                  ? "text-slate-300 opacity-40 cursor-not-allowed"
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

export default function CustomDateRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startLabel = "Bắt đầu",
  endLabel = "Kết thúc",
  disabled = false,
  minDate,
  maxDate,
}: CustomDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const location = useLocation();
  const usesLightShell = location.pathname === '/' || location.pathname === '/team-area' || location.pathname === '/register-team' || location.pathname === '/login' || location.pathname === '/achievements' || location.pathname === '/guest-portal' || location.pathname.startsWith('/admin');

  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Selecting mode: first click = start, second = end
  const [selectingEnd, setSelectingEnd] = useState(false);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startHour, setStartHour] = useState(8);
  const [startMin, setStartMin] = useState(0);

  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endHour, setEndHour] = useState(17);
  const [endMin, setEndMin] = useState(0);

  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Parse initial values
  useEffect(() => {
    const s = parseToDate(startValue);
    if (s) {
      setStartDate(s);
      setStartHour(s.getHours());
      setStartMin(s.getMinutes());
      setCurrentMonth(new Date(s.getFullYear(), s.getMonth(), 1));
    } else {
      setStartDate(null);
      if (minDate) {
        const parsedMin = new Date(minDate);
        if (!isNaN(parsedMin.getTime())) {
          setCurrentMonth(new Date(parsedMin.getFullYear(), parsedMin.getMonth(), 1));
        }
      }
    }

    const e = parseToDate(endValue);
    if (e) {
      setEndDate(e);
      setEndHour(e.getHours());
      setEndMin(e.getMinutes());
    } else setEndDate(null);
  }, [startValue, endValue, isOpen, minDate]);

  // Compute position (flip up if not enough space below, relative to document body)
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !popoverRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current || !popoverRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popover = popoverRef.current;
      const popW = popover.offsetWidth || 560;
      const popH = popover.offsetHeight || 380;
      const gap = 8;

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;

      // Flip up if not enough space below and more space above
      const showBelow = spaceBelow >= popH || spaceBelow >= spaceAbove;

      const top = showBelow
        ? rect.bottom + scrollTop + gap
        : rect.top + scrollTop - popH - gap;

      let leftViewport = rect.left;
      if (leftViewport + popW > window.innerWidth - 8) {
        leftViewport = window.innerWidth - popW - 8;
      }
      const left = Math.max(8, leftViewport) + scrollLeft;

      setPopoverStyle({
        position: "absolute",
        top: Math.max(8, top),
        left: left,
        width: popW,
        zIndex: 9999,
        opacity: 1,
        pointerEvents: "auto",
      });
    };

    // Initially hide popover during layout computation to avoid flashing
    setPopoverStyle({
      position: "absolute",
      opacity: 0,
      pointerEvents: "none",
    });

    const animId = requestAnimationFrame(() => {
      updatePosition();
    });

    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Click outside + close on scroll of other scrollable containers
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      // Ignore scroll inside the popover itself
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) return;
      // Do not close if scrolling the window/document since absolute positioning keeps us aligned
      if (e.target === document || e.target === window) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const isDateDisabled = (d: Date) => {
    if (isPastDay(d)) return true;
    if (minDate) {
      const minD = new Date(minDate);
      minD.setHours(0, 0, 0, 0);
      const checkD = new Date(d);
      checkD.setHours(0, 0, 0, 0);
      if (checkD < minD) return true;
    }
    if (maxDate) {
      const maxD = new Date(maxDate);
      maxD.setHours(23, 59, 59, 999);
      const checkD = new Date(d);
      checkD.setHours(0, 0, 0, 0);
      if (checkD > maxD) return true;
    }
    return false;
  };

  // Calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotal = new Date(year, month, 0).getDate();

  const cells: { day: number; isCurrentMonth: boolean; date: Date }[] = [];
  for (let i = firstDayIndex - 1; i >= 0; i--)
    cells.push({ day: prevTotal - i, isCurrentMonth: false, date: new Date(year, month - 1, prevTotal - i) });
  for (let i = 1; i <= totalDays; i++)
    cells.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
  // Only pad to complete the last row, not always 42
  const rowRem = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let i = 1; i <= rowRem; i++)
    cells.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });

  const isInRange = (d: Date) => {
    const lo = startDate;
    const hi = selectingEnd && hoverDate ? hoverDate : endDate;
    if (!lo || !hi) return false;
    const a = lo < hi ? lo : hi, b = lo < hi ? hi : lo;
    const dc = new Date(d); dc.setHours(0,0,0,0);
    const ac = new Date(a); ac.setHours(0,0,0,0);
    const bc = new Date(b); bc.setHours(0,0,0,0);
    return dc > ac && dc < bc;
  };
  const isRangeStart = (d: Date) => startDate ? isSameDay(d, startDate) : false;
  const isRangeEnd = (d: Date) => {
    const e = selectingEnd && hoverDate ? hoverDate : endDate;
    return e ? isSameDay(d, e) : false;
  };

  const handleDayClick = (date: Date) => {
    if (isDateDisabled(date)) return;
    if (!selectingEnd) {
      setStartDate(date);
      setEndDate(null);
      setSelectingEnd(true);
    } else {
      if (startDate && date < startDate) {
        setEndDate(startDate);
        setStartDate(date);
      } else {
        setEndDate(date);
      }
      setSelectingEnd(false);
    }
  };

  const getValidationError = (): string => {
    if (!startDate || !endDate) return "";
    const startCombined = new Date(startDate);
    startCombined.setHours(startHour, startMin, 0, 0);
    const endCombined = new Date(endDate);
    endCombined.setHours(endHour, endMin, 0, 0);

    const now = new Date();
    if (startCombined < now) {
      return "Không chọn thời gian quá khứ";
    }

    if (startCombined >= endCombined) {
      return "Thời gian bắt đầu phải trước thời gian kết thúc";
    }

    const formatD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hr = d.getHours();
      const ampm = hr >= 12 ? "PM" : "AM";
      const hr12 = hr % 12 === 0 ? 12 : hr % 12;
      const hrStr = String(hr12).padStart(2, "0");
      const minStr = String(d.getMinutes()).padStart(2, "0");
      return `${m}/${day}/${y} ${hrStr}:${minStr} ${ampm}`;
    };

    if (minDate) {
      const minD = new Date(minDate);
      if (startCombined < minD) {
        return `Thời gian bắt đầu phải từ ${formatD(minD)}`;
      }
    }

    if (maxDate) {
      const maxD = new Date(maxDate);
      if (endCombined > maxD) {
        return `Thời gian kết thúc phải trước ${formatD(maxD)}`;
      }
    }

    return "";
  };

  const validationError = getValidationError();

  const handleConfirm = () => {
    if (validationError) return;
    if (startDate) onStartChange(toOutputString(startDate, startHour, startMin));
    if (endDate) onEndChange(toOutputString(endDate, endHour, endMin));
    setIsOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const now = new Date();
    setStartDate(now);
    setEndDate(now);
    setStartHour(now.getHours());
    setStartMin(now.getMinutes());
    setEndHour(now.getHours());
    setEndMin(now.getMinutes());
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectingEnd(false);
  };

  const hoursArr = Array.from({ length: 24 }, (_, i) => i);
  const minsArr = Array.from({ length: 60 }, (_, i) => i);

  const getDisabledStartHours = () => {
    if (!startDate) return [];
    const disabled: number[] = [];
    for (let h = 0; h < 24; h++) {
      const dateToCheck = new Date(startDate);
      if (minDate) {
        const minD = new Date(minDate);
        dateToCheck.setHours(h, 59, 59, 999);
        if (dateToCheck < minD) {
          disabled.push(h);
          continue;
        }
      }
      const now = new Date();
      dateToCheck.setHours(h, 59, 59, 999);
      if (dateToCheck < now) {
        disabled.push(h);
      }
    }
    return disabled;
  };

  const getDisabledStartMinutes = (h: number = startHour) => {
    if (!startDate) return [];
    const disabled: number[] = [];
    for (let m = 0; m < 60; m++) {
      const dateToCheck = new Date(startDate);
      dateToCheck.setHours(h, m, 0, 0);
      if (minDate) {
        const minD = new Date(minDate);
        if (dateToCheck < minD) {
          disabled.push(m);
          continue;
        }
      }
      const now = new Date();
      if (dateToCheck < now) {
        disabled.push(m);
      }
    }
    return disabled;
  };

  const getDisabledEndHours = () => {
    if (!endDate) return [];
    const disabled: number[] = [];
    for (let h = 0; h < 24; h++) {
      const dateToCheck = new Date(endDate);
      if (startDate) {
        const startCombined = new Date(startDate);
        startCombined.setHours(startHour, startMin, 0, 0);
        dateToCheck.setHours(h, 59, 59, 999);
        if (dateToCheck < startCombined) {
          disabled.push(h);
          continue;
        }
      }
      if (maxDate) {
        const maxD = new Date(maxDate);
        dateToCheck.setHours(h, 0, 0, 0);
        if (dateToCheck > maxD) {
          disabled.push(h);
        }
      }
    }
    return disabled;
  };

  const getDisabledEndMinutes = (h: number = endHour) => {
    if (!endDate) return [];
    const disabled: number[] = [];
    for (let m = 0; m < 60; m++) {
      const dateToCheck = new Date(endDate);
      if (startDate) {
        const startCombined = new Date(startDate);
        startCombined.setHours(startHour, startMin, 0, 0);
        dateToCheck.setHours(h, m, 0, 0);
        if (dateToCheck < startCombined) {
          disabled.push(m);
          continue;
        }
      }
      if (maxDate) {
        const maxD = new Date(maxDate);
        dateToCheck.setHours(h, m, 0, 0);
        if (dateToCheck > maxD) {
          disabled.push(m);
        }
      }
    }
    return disabled;
  };

  // Clamp effect for start and end hour/min
  useEffect(() => {
    if (startDate) {
      const disabledHrs = getDisabledStartHours();
      let currentStartHour = startHour;
      if (disabledHrs.includes(currentStartHour)) {
        const validHr = hoursArr.find((h) => !disabledHrs.includes(h));
        if (validHr !== undefined) currentStartHour = validHr;
      }

      const disabledMins = getDisabledStartMinutes(currentStartHour);
      let currentStartMin = startMin;
      if (disabledMins.includes(currentStartMin)) {
        const validMin = minsArr.find((m) => !disabledMins.includes(m));
        if (validMin !== undefined) currentStartMin = validMin;
      }

      if (currentStartHour !== startHour) setStartHour(currentStartHour);
      if (currentStartMin !== startMin) setStartMin(currentStartMin);
    }

    if (endDate) {
      const disabledHrs = getDisabledEndHours();
      let currentEndHour = endHour;
      if (disabledHrs.includes(currentEndHour)) {
        const validHr = hoursArr.find((h) => !disabledHrs.includes(h));
        if (validHr !== undefined) currentEndHour = validHr;
      }

      const disabledMins = getDisabledEndMinutes(currentEndHour);
      let currentEndMin = endMin;
      if (disabledMins.includes(currentEndMin)) {
        const validMin = minsArr.find((m) => !disabledMins.includes(m));
        if (validMin !== undefined) currentEndMin = validMin;
      }

      if (currentEndHour !== endHour) setEndHour(currentEndHour);
      if (currentEndMin !== endMin) setEndMin(currentEndMin);
    }
  }, [startDate, endDate, minDate, maxDate, startHour, startMin, endHour, endMin]);

  const popover = isOpen ? (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className={`border rounded-2xl flex overflow-hidden animate-fadeIn ${
        usesLightShell
          ? "bg-white border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-slate-800"
          : "bg-[#0d1117] border border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-slate-350"
      }`}
    >
      {/* LEFT: Calendar */}
      <div className="p-5 flex flex-col" style={{ width: 280 }}>
        {/* Month nav */}
        <div className="flex justify-between items-center mb-4">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setCurrentMonth(new Date(year, month - 1, 1)); }}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer ${
              usesLightShell 
                ? "text-slate-600 hover:text-primary hover:bg-slate-100" 
                : "text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <span className={`text-sm font-bold font-mono tracking-widest uppercase ${
            usesLightShell ? "text-slate-800" : "text-white"
          }`}>
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setCurrentMonth(new Date(year, month + 1, 1)); }}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer ${
              usesLightShell 
                ? "text-slate-600 hover:text-primary hover:bg-slate-100" 
                : "text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase py-1 font-mono">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const past = isDateDisabled(cell.date);
            const isStart = isRangeStart(cell.date);
            const isEnd = isRangeEnd(cell.date);
            const inRange = isInRange(cell.date);
            const isToday = isSameDay(cell.date, new Date());
            const bothSame = startDate && endDate && isSameDay(startDate, endDate);

            let cellClass = "relative flex items-center justify-center text-[12px] font-mono h-9 transition-all ";

            if (past) {
              cellClass += usesLightShell ? "text-slate-350 cursor-not-allowed " : "text-slate-700 cursor-not-allowed ";
            } else if (isStart || isEnd) {
              cellClass += "cursor-pointer z-10 ";
            } else if (inRange) {
              cellClass += usesLightShell
                ? "bg-primary/10 cursor-pointer text-primary "
                : "bg-cyan-500/10 cursor-pointer text-cyan-200 ";
            } else if (!cell.isCurrentMonth) {
              cellClass += usesLightShell
                ? "text-slate-350 cursor-pointer hover:text-slate-500 "
                : "text-slate-600 cursor-pointer hover:text-slate-400 ";
            } else if (isToday) {
              cellClass += usesLightShell
                ? "text-primary cursor-pointer hover:bg-slate-100 rounded-lg "
                : "text-cyan-400 cursor-pointer hover:bg-slate-800 rounded-lg ";
            } else {
              cellClass += usesLightShell
                ? "text-slate-700 cursor-pointer hover:bg-slate-100 hover:text-primary rounded-lg "
                : "text-slate-300 cursor-pointer hover:bg-slate-800 hover:text-white rounded-lg ";
            }

            return (
              <div
                key={idx}
                className={cellClass}
                onClick={() => !past && handleDayClick(cell.date)}
                onMouseEnter={() => selectingEnd && setHoverDate(cell.date)}
                onMouseLeave={() => setHoverDate(null)}
              >
                {/* Range highlight background strip */}
                {inRange && (
                  <span className={`absolute inset-y-0 inset-x-0 ${usesLightShell ? 'bg-primary/10' : 'bg-cyan-500/10'}`} />
                )}
                {/* Dot for today */}
                {isToday && !isStart && !isEnd && (
                  <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${usesLightShell ? 'bg-primary' : 'bg-cyan-400'}`} />
                )}
                {/* Selected circle */}
                {(isStart || isEnd) ? (
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold z-10 relative ${
                    usesLightShell
                      ? 'bg-primary text-white shadow-[0_0_12px_rgba(242,112,36,0.35)]'
                      : 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  } ${!bothSame && isStart ? 'rounded-r-full' : ''} ${!bothSame && isEnd ? 'rounded-l-full' : ''}`}>
                    {cell.day}
                  </span>
                ) : (
                  <span className="relative z-10">{cell.day}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Hint text */}
        <div className="mt-3 text-[10px] text-slate-600 font-mono">
          {selectingEnd ? "← Chọn ngày kết thúc" : "Chọn ngày bắt đầu →"}
        </div>
      </div>

      {/* Divider */}
      <div className={`w-px my-4 ${usesLightShell ? 'bg-slate-200' : 'bg-slate-800'}`} />

      {/* RIGHT: Time pickers */}
      <div className="flex-1 p-5 flex flex-col justify-between">
        {/* Start + End time side by side */}
        <div className="flex items-start gap-0">
          {/* Start time */}
          <div className="flex-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">
              Giờ bắt đầu
            </div>
            <div className="flex items-center gap-1.5">
              <TimeSelect value={startHour} onChange={setStartHour} options={hoursArr} disabledOptions={getDisabledStartHours()} />
              <span className="text-slate-400 font-mono font-bold text-lg self-center">:</span>
              <TimeSelect value={startMin} onChange={setStartMin} options={minsArr} disabledOptions={getDisabledStartMinutes()} />
            </div>
            {startDate && (
              <div className="text-[10px] text-slate-500 mt-1.5 font-mono">
                {startDate.getDate()}/{startDate.getMonth() + 1}/{startDate.getFullYear()}
                {" · "}{String(startHour).padStart(2, "0")}:{String(startMin).padStart(2, "0")}
                {" "}{startHour >= 12 ? "PM" : "AM"}
              </div>
            )}
          </div>

          {/* Arrow divider */}
          <div className="flex flex-col items-center justify-center self-stretch px-3">
            <div className={`w-px flex-1 ${usesLightShell ? 'bg-slate-200' : 'bg-slate-800'}`} />
            <ArrowRight size={13} className="text-slate-500 my-2 shrink-0" />
            <div className={`w-px flex-1 ${usesLightShell ? 'bg-slate-200' : 'bg-slate-800'}`} />
          </div>

          {/* End time */}
          <div className="flex-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">
              Giờ kết thúc
            </div>
            <div className="flex items-center gap-1.5">
              <TimeSelect value={endHour} onChange={setEndHour} options={hoursArr} disabledOptions={getDisabledEndHours()} />
              <span className="text-slate-400 font-mono font-bold text-lg self-center">:</span>
              <TimeSelect value={endMin} onChange={setEndMin} options={minsArr} disabledOptions={getDisabledEndMinutes()} />
            </div>
            {endDate && (
              <div className="text-[10px] text-slate-500 mt-1.5 font-mono">
                {endDate.getDate()}/{endDate.getMonth() + 1}/{endDate.getFullYear()}
                {" · "}{String(endHour).padStart(2, "0")}:{String(endMin).padStart(2, "0")}
                {" "}{endHour >= 12 ? "PM" : "AM"}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto pt-5">
          {validationError && (
            <div className="text-[10px] text-rose-500 font-semibold font-mono text-center mb-1">
              {validationError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleToday}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider font-mono transition-all cursor-pointer ${
                usesLightShell
                  ? "border-primary/40 text-primary hover:bg-primary/10"
                  : "border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!startDate || !endDate || !!validationError}
              className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
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
    </div>
  ) : null;

  return (
    <div className="relative w-full">
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        className={`w-full border rounded-xl px-4 py-2.5 text-xs flex items-center justify-between cursor-pointer select-none transition-all ${
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
        <span className="flex items-center gap-2 font-mono">
          {startValue ? (
            <span className={usesLightShell ? "text-slate-800" : "text-white"}>{displayFormat(startValue)}</span>
          ) : (
            <span className={usesLightShell ? "text-slate-400" : "text-slate-500"}>{startLabel}...</span>
          )}
          <ArrowRight size={12} className={usesLightShell ? "text-slate-400" : "text-slate-500"} />
          {endValue ? (
            <span className={usesLightShell ? "text-slate-800" : "text-white"}>{displayFormat(endValue)}</span>
          ) : (
            <span className={usesLightShell ? "text-slate-400" : "text-slate-500"}>{endLabel}...</span>
          )}
        </span>
        <Calendar size={16} className={usesLightShell ? "text-primary shrink-0 ml-2" : "text-cyan-300 shrink-0 ml-2"} />
      </div>

      {typeof document !== "undefined" && ReactDOM.createPortal(popover, document.body)}
    </div>
  );
}
