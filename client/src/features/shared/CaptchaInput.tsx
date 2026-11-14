import { RotateCw } from 'lucide-react';

interface CaptchaInputProps {
  captchaSvg: string;
  value: string;
  onChange: (val: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export default function CaptchaInput({
  captchaSvg,
  value,
  onChange,
  onRefresh,
  disabled = false
}: CaptchaInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-400">
        Mã Xác Thực (CAPTCHA) <span className="text-rose-500">*</span>
      </label>
      
      <div className="flex items-center gap-3">
        {/* Captcha SVG container */}
        <div 
          className="shrink-0 cursor-pointer overflow-hidden rounded-lg hover:opacity-90 transition-opacity"
          onClick={onRefresh}
          title="Click để đổi mã khác"
          dangerouslySetInnerHTML={{ __html: captchaSvg }}
        />
        
        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled}
          className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all focus:outline-hidden disabled:opacity-50"
          title="Tải mã xác thực mới"
        >
          <RotateCw size={16} className="animate-hover-spin" />
        </button>

        {/* Captcha Input Code */}
        <input
          type="text"
          required
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={6}
          className="grow min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500/50 transition-all font-mono placeholder:text-slate-600 tracking-widest text-center text-sm"
          placeholder="MÃ SỐ"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
