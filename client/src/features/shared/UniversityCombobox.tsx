import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Loader2 } from 'lucide-react';


export interface University {
  name: string;
  short: string;
  aliases: string[];
}

// Curated list of major Vietnamese universities with common abbreviations and aliases for instant matching
const LOCAL_UNIVERSITIES: University[] = [
  { name: 'Trường Đại học FPT TP.HCM', short: 'FPT TP.HCM', aliases: ['FPT', 'FPT University', 'FU', 'FU HCMC'] },
  { name: 'Trường Đại học Công nghệ thông tin - ĐHQG TP.HCM', short: 'UIT', aliases: ['UIT', 'CNTT', 'Cong nghe thong tin'] },
  { name: 'Trường Đại học Bách Khoa - ĐHQG TP.HCM', short: 'HCMUT', aliases: ['HCMUT', 'Bach Khoa HCM', 'BK TP.HCM', 'Bach Khoa'] },
  { name: 'Trường Đại học Khoa học tự nhiên - ĐHQG TP.HCM', short: 'HCMUS', aliases: ['HCMUS', 'KHTN', 'Khoa hoc tu nhien'] },
  { name: 'Trường Đại học Sư phạm Kỹ thuật TP.HCM', short: 'HCMUTE', aliases: ['HCMUTE', 'SPKT', 'Su pham Ky thuat'] },
  { name: 'Học viện Công nghệ Bưu chính Viễn thông - Cơ sở TP.HCM', short: 'PTIT TP.HCM', aliases: ['PTIT', 'PTIT HCM', 'Buu chinh vien thong'] },
  { name: 'Đại học Greenwich Việt Nam (Cơ sở TP.HCM)', short: 'Greenwich TP.HCM', aliases: ['Greenwich', 'GW', 'Greenwich VN'] },
  { name: 'Đại học Swinburne Việt Nam (Cơ sở TP.HCM)', short: 'Swinburne TP.HCM', aliases: ['Swinburne', 'SUT', 'Swinburne VN'] },
  { name: 'Trường Đại học Công nghệ TP.HCM', short: 'HUTECH', aliases: ['HUTECH', 'DKC', 'Cong nghe TPHCM'] },
  { name: 'Trường Đại học Tôn Đức Thắng', short: 'TDTU', aliases: ['TDTU', 'TDT', 'Ton Duc Thang'] },
  { name: 'Trường Đại học Ngoại thương - Cơ sở 2 TP.HCM', short: 'FTU2', aliases: ['FTU', 'Ngoai thuong CS2'] },
  { name: 'Trường Đại học Văn Lang', short: 'VLU', aliases: ['VLU', 'Van Lang'] },
  { name: 'Trường Đại học Hoa Sen', short: 'HSU', aliases: ['HSU', 'Hoa Sen'] },
  { name: 'Trường Đại học Sài Gòn', short: 'SGU', aliases: ['SGU', 'Sai Gon'] },
  { name: 'Trường Đại học Công nghiệp TP.HCM', short: 'IUH', aliases: ['IUH', 'Cong nghiep TPHCM', 'Cong nghiep'] },
  { name: 'Trường Đại học Mở TP.HCM', short: 'OU', aliases: ['OU', 'Mo TPHCM', 'Dai hoc Mo'] },
  { name: 'Trường Đại học Ngoại ngữ - Tin học TP.HCM', short: 'HUFLIT', aliases: ['HUFLIT', 'Ngoai ngu Tin hoc'] },
  { name: 'Trường Đại học Quốc tế - ĐHQG TP.HCM', short: 'IU', aliases: ['IU', 'Quoc te', 'International University'] },
  { name: 'Trường Đại học Kinh tế - Luật - ĐHQG TP.HCM', short: 'UEL', aliases: ['UEL', 'Kinh te Luat'] },
  { name: 'Trường Đại học Tài chính - Marketing', short: 'UFM', aliases: ['UFM', 'Tai chinh Marketing'] },
  { name: 'Trường Đại học RMIT Việt Nam (Cơ sở Nam Sài Gòn)', short: 'RMIT TP.HCM', aliases: ['RMIT', 'Dai hoc RMIT'] }
];

// Helper to remove accents/diacritics for search matching
const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};



interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputClassName?: string;
}

export default function UniversityCombobox({
  value,
  onChange,
  placeholder = 'Nhập hoặc chọn tên trường...',
  className = '',
  disabled = false,
  inputClassName = '',
}: Props) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [universities, setUniversities] = useState<University[]>(LOCAL_UNIVERSITIES);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value -> internal input (displays short name for brevity if matched)
  useEffect(() => {
    const matched = LOCAL_UNIVERSITIES.find(u => u.name === value || u.short === value);
    if (matched) {
      setInputValue(matched.short);
    } else {
      setInputValue(value || '');
    }
  }, [value]);

  // Load universities from local dataset (external API disabled to focus on HCMC IT scope)
  useEffect(() => {
    setUniversities(LOCAL_UNIVERSITIES);
    setLoading(false);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter logic using normalized accent-free matching + aliases support
  const query = removeAccents(inputValue.trim()).toLowerCase();
  
  const filtered = query
    ? universities.filter(u => {
        const nameMatch = removeAccents(u.name).toLowerCase().includes(query);
        const shortMatch = removeAccents(u.short).toLowerCase().includes(query);
        const aliasMatch = u.aliases.some(alias => 
          removeAccents(alias).toLowerCase().includes(query)
        );
        return nameMatch || shortMatch || aliasMatch;
      })
    : universities;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    setIsOpen(true);
  };

  const handleSelect = (university: University) => {
    // Save/fill the input box with the short name (e.g. FPT TP.HCM) to avoid truncation confusion,
    // but propagate the full name (e.g. Trường Đại học FPT TP.HCM) to the parent state to save in DB.
    setInputValue(university.short);
    onChange(university.name);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    inputRef.current?.focus();
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={inputValue}
          onChange={handleInput}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full pr-16 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white px-3 py-2 rounded-xl text-xs focus:outline-hidden focus:border-primary transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed ${inputClassName}`}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {loading && (
            <Loader2 size={12} className="animate-spin text-slate-500" />
          )}
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer p-0.5"
              tabIndex={-1}
            >
              <X size={11} />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setIsOpen(o => !o); inputRef.current?.focus(); }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer p-0.5 disabled:opacity-50"
            tabIndex={-1}
          >
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'text-slate-400'}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute z-9999 left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-900/5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100 uni-combobox-dropdown">
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            {filtered.length > 0 ? (
              filtered.map(u => {
                const isSelected = u.short === value || u.name === value;
                return (
                  <button
                    key={u.name}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); handleSelect(u); }}
                    className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-mono transition-all cursor-pointer flex flex-col justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-orange-500/10 text-primary font-semibold border border-orange-500/25'
                        : 'text-slate-700 hover:bg-orange-500/10 hover:text-primary'
                    }`}
                  >
                    {/* Primary acronym / short name */}
                    <span className={`font-bold text-xs block leading-tight ${isSelected ? 'text-primary' : 'text-slate-800'}`}>
                      {u.short}
                    </span>
                    {/* Secondary full name */}
                    {u.short !== u.name && (
                      <span className={`text-[9.5px] font-mono leading-normal block whitespace-normal wrap-break-word ${
                        isSelected ? 'text-orange-500/80' : 'text-slate-400'
                      }`}>
                        {u.name}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-xs text-slate-400 font-mono italic text-center">
                Không tìm thấy trường này
              </div>
            )}
          </div>
          {inputValue.trim() && !universities.some(u => u.name.toLowerCase() === inputValue.trim().toLowerCase() || u.short.toLowerCase() === inputValue.trim().toLowerCase()) && (
            <div className="border-t border-slate-200 px-3 py-2.5 bg-slate-50">
              <p className="text-[10px] font-mono text-primary flex items-center gap-1.5 leading-relaxed">
                <span>✎ Sẽ lưu tên tự nhập:</span>
                <span className="text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">
                  {inputValue.trim()}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
