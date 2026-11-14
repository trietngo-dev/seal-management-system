import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useLocation } from "react-router-dom";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
  placeholder = "Chọn tùy chọn...",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const usesLightShell = location.pathname === '/' || location.pathname === '/team-area' || location.pathname === '/register-team' || location.pathname === '/login' || location.pathname === '/achievements' || location.pathname === '/guest-portal' || location.pathname === '/confirm-survey' || location.pathname.startsWith('/admin');

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: any) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${isOpen ? "z-9999" : ""} ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        title={displayLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full min-h-11 flex items-center justify-between gap-2 border rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:outline-hidden font-semibold transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          usesLightShell
            ? "bg-white border-slate-300 text-slate-800 shadow-xs hover:border-primary focus:ring-[#F27024]/20 focus:border-primary"
            : "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700 focus:ring-cyan-500/20 focus:border-cyan-500"
        } ${isOpen ? (usesLightShell ? "ring-2 ring-[#F27024]/20 border-primary" : "ring-2 ring-cyan-500/20 border-cyan-500") : ""}`}
      >
        <span className="truncate flex-1 min-w-0">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 shrink-0 ${
            usesLightShell
              ? `text-slate-400 ${isOpen ? "transform rotate-180 text-primary" : ""}`
              : `text-slate-400 ${isOpen ? "transform rotate-180 text-cyan-400" : ""}`
          }`}
        />
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <div role="listbox" className={`absolute left-0 mt-2 w-full min-w-[200px] max-h-60 overflow-y-auto border rounded-xl shadow-xl z-9999 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150 scrollbar-thin ${
          usesLightShell
            ? "bg-white border-orange-200 shadow-[0_16px_40px_rgba(15,23,42,0.12)] text-slate-800 scrollbar-thumb-orange-200 scrollbar-track-transparent"
            : "bg-slate-900 border-slate-800 shadow-[0_4px_25px_rgba(0,0,0,0.5)] text-slate-200 scrollbar-thumb-slate-800 scrollbar-track-transparent"
        }`}>
          {options.length === 0 ? (
            <div className={`px-4 py-5 text-center text-sm ${usesLightShell ? "rounded-lg bg-orange-50 text-slate-500" : "text-slate-500 italic"}`}>
              Không có tùy chọn
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              const isDisabled = opt.disabled || false;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={isDisabled}
                  title={opt.label}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => !isDisabled && handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    isDisabled
                      ? usesLightShell
                        ? "text-slate-350 cursor-not-allowed opacity-40 bg-transparent"
                        : "text-slate-650 cursor-not-allowed opacity-40 bg-transparent"
                      : isSelected
                      ? usesLightShell
                        ? "bg-primary/10 text-primary font-bold border border-primary/20 shadow-[0_0_10px_rgba(242,112,36,0.1)]"
                        : "bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                      : usesLightShell
                      ? "text-slate-700 hover:bg-slate-100 hover:text-primary border border-transparent"
                      : "text-slate-450 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <span className="truncate block w-full">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
