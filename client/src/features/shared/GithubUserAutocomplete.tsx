import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface GithubUserAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelectUser?: (user: { username: string; avatarUrl: string }) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  theme?: 'light' | 'dark';
}

export default function GithubUserAutocomplete({
  value,
  onChange,
  onSelectUser,
  onKeyDown,
  placeholder = "Nhập github-username",
  className = "",
  disabled = false,
  theme = "dark"
}: GithubUserAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(
          `${apiBase}/api/github-repositories/search-users?q=${encodeURIComponent(value.trim())}`,
          { headers }
        );
        setSuggestions(res.data || []);
        setIsOpen(Array.isArray(res.data) && res.data.length > 0);
      } catch (err) {
        console.error('Failed to search github users:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (user: { username: string; avatarUrl: string }) => {
    onChange(user.username);
    if (onSelectUser) {
      onSelectUser(user);
    }
    setIsOpen(false);
  };

  const isLight = theme === 'light';

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative flex items-center w-full">
        <input
          type="text"
          disabled={disabled}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          className={`${className} w-full`}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className={`animate-spin rounded-full h-4 w-4 border-2 border-t-transparent ${isLight ? 'border-primary' : 'border-cyan-400'}`}></div>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          className={`absolute z-50 left-0 w-full mt-1.5 rounded-2xl shadow-2xl max-h-56 overflow-y-auto font-sans text-xs border ${
            isLight
              ? 'bg-white border-slate-200/90 text-slate-800 shadow-slate-300/50'
              : 'bg-slate-900 border-slate-800 text-slate-300 shadow-black/80'
          }`}
        >
          <div className="p-1.5 space-y-0.5">
            <div className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Gợi ý tài khoản GitHub
            </div>
            {suggestions.map((u: any) => (
              <button
                key={u.username}
                type="button"
                onClick={() => handleSelect(u)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl transition-all border border-transparent cursor-pointer ${
                  isLight
                    ? 'hover:bg-orange-50 hover:text-primary hover:border-orange-200/60'
                    : 'hover:text-white hover:bg-cyan-500/10 hover:border-cyan-500/30'
                }`}
              >
                <img
                  src={u.avatarUrl}
                  alt={u.username}
                  className={`w-5 h-5 rounded-full object-cover shrink-0 border ${isLight ? 'border-slate-200' : 'border-slate-700'}`}
                />
                <span className="font-mono font-semibold truncate">{u.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
