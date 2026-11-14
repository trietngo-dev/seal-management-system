import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import GithubUserAutocomplete from "../shared/GithubUserAutocomplete";

const Github = ({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function ConfirmSurvey() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const teamNameFromUrl = searchParams.get("teamName") || "";

  const [activeToken, setActiveToken] = useState<string>(
    tokenFromUrl || localStorage.getItem("token") || ""
  );

  const [githubUsername, setGithubUsername] = useState<string>("");
  const [validating, setValidating] = useState<boolean>(false);
  const [validateStatus, setValidateStatus] = useState<"idle" | "success" | "error">("idle");
  const [validateMessage, setValidateMessage] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      setActiveToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  // Load existing profile GitHub username
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const currentToken = tokenFromUrl || localStorage.getItem("token");
      if (!currentToken) return;
      try {
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (res.data?.githubUsername) {
          setGithubUsername(res.data.githubUsername);
          setValidateStatus("success");
          setValidateMessage(`Tài khoản GitHub "${res.data.githubUsername}" đã được liên kết với hồ sơ.`);
        }
      } catch (err) {
        console.error("Lỗi khi tải thông tin tài khoản:", err);
      }
    };

    fetchCurrentUser();
  }, [tokenFromUrl]);

  // Auto-validate GitHub username on debounce when typed manually
  useEffect(() => {
    const trimmed = githubUsername.trim();
    if (!trimmed) {
      setValidateStatus("idle");
      setValidateMessage("");
      return;
    }

    if (trimmed.length < 2) {
      setValidateStatus("idle");
      return;
    }

    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(
          `${apiBase}/api/teams/validate-github/${encodeURIComponent(trimmed)}`
        );
        if (res.data && res.data.exists) {
          setValidateStatus("success");
          setValidateMessage(`Tài khoản GitHub "${trimmed}" hợp lệ và sẵn sàng cấp phát repository.`);
        } else {
          setValidateStatus("error");
          setValidateMessage(`Không tìm thấy tài khoản GitHub "${trimmed}". Vui lòng kiểm tra lại.`);
        }
      } catch (err) {
        console.error("Lỗi xác thực GitHub tự động:", err);
      } finally {
        setValidating(false);
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [githubUsername]);

  const handleSelectUser = (user: { username: string; avatarUrl: string }) => {
    setGithubUsername(user.username);
    setValidateStatus("success");
    setValidateMessage(`Tài khoản GitHub "${user.username}" hợp lệ và sẵn sàng cấp phát repository.`);
  };

  const handleSaveAndFinish = async () => {
    const trimmed = githubUsername.trim();
    if (!trimmed) {
      navigate("/team-area");
      return;
    }

    const currentToken = activeToken || localStorage.getItem("token");

    setSaving(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      if (currentToken) {
        await axios.patch(
          `${apiBase}/api/auth/github-username`,
          { githubUsername: trimmed },
          {
            headers: { Authorization: `Bearer ${currentToken}` },
          }
        );
      }
      navigate("/team-area");
    } catch (err: any) {
      console.error("Lỗi khi lưu GitHub Username:", err);
      setValidateStatus("error");
      setValidateMessage(
        err.response?.data?.message || "Lỗi khi cập nhật GitHub Username. Vui lòng thử lại."
      );
    } finally {
      setSaving(false);
    }
  };

  const isReadyToSave = validateStatus === "success" && !validating && !saving;

  return (
    <main className="team-area-light min-h-screen bg-[#faf9f6] text-slate-800 font-sans flex items-center justify-center p-4 sm:p-8 lg:p-12">
      <section aria-labelledby="confirm-survey-title" className="w-full max-w-xl bg-white border border-orange-100 rounded-3xl shadow-[0_24px_70px_rgba(15,23,42,0.10)] p-6 sm:p-10 space-y-8 relative overflow-visible">
        {/* Top Decorative Banner */}
        <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-orange-400 via-[#F27024] to-amber-500 rounded-t-3xl"></div>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 text-primary border border-orange-500/20 text-xs font-mono font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>XÁC NHẬN THAM GIA THÀNH CÔNG</span>
          </div>

          <h1 id="confirm-survey-title" className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Cập Nhật Thông Tin GitHub
          </h1>

          {teamNameFromUrl && (
            <p className="text-xs font-semibold text-slate-500">
              Đội thi: <span className="text-primary font-bold">{teamNameFromUrl}</span>
            </p>
          )}

          <p className="text-slate-600 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Vui lòng cung cấp chính xác <strong>GitHub Username</strong> của bạn để Ban Tổ chức tự động cấp quyền truy cập mã nguồn và phân quyền vào Repository của đội thi.
          </p>
        </div>

        {/* GitHub Input Card */}
        <div className="bg-orange-50/60 p-5 sm:p-6 rounded-2xl border border-orange-200/80 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Github size={14} className="text-primary" />
              <span>GitHub Username <span className="text-rose-500">*</span></span>
            </label>
            <div className="w-full">
              <GithubUserAutocomplete
                value={githubUsername}
                onChange={(val) => {
                  setGithubUsername(val);
                }}
                onSelectUser={handleSelectUser}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isReadyToSave) {
                    e.preventDefault();
                    handleSaveAndFinish();
                  }
                }}
                theme="light"
                placeholder="Nhập tên tài khoản GitHub (ví dụ: octocat, trietngo-dev)..."
                className="min-h-12 bg-white border border-slate-300 text-slate-900 px-4 py-3 rounded-xl text-sm font-mono shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[#F27024]/20 focus:border-primary transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * Mẹo: Gõ từ 2 ký tự để xem và chọn nhanh từ danh sách gợi ý tài khoản GitHub.
            </p>
          </div>

          {/* Validating indicator */}
          {validating && (
            <div className="flex items-center gap-2 text-xs text-primary font-mono animate-in fade-in duration-150">
              <Loader2 size={13} className="animate-spin" />
              <span>Đang kiểm tra tài khoản GitHub...</span>
            </div>
          )}

          {/* Success Banner */}
          {!validating && validateStatus === "success" && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-0.5 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-emerald-700 font-mono">
                <CheckCircle2 size={15} />
                <span>XÁC THỰC THÀNH CÔNG</span>
              </div>
              <p className="leading-relaxed">{validateMessage}</p>
            </div>
          )}

          {/* Error Banner */}
          {!validating && validateStatus === "error" && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-0.5 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-rose-700 font-mono">
                <AlertCircle size={15} />
                <span>KHÔNG TÌM THẤY TÀI KHOẢN</span>
              </div>
              <p className="leading-relaxed">{validateMessage}</p>
            </div>
          )}
        </div>

        {/* Action Button (Mandatory Save) */}
        <div className="pt-4 border-t border-slate-200">
          <button
            type="button"
            disabled={!isReadyToSave}
            onClick={handleSaveAndFinish}
            className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-primary hover:bg-[#d95f1d] focus:outline-hidden focus:ring-2 focus:ring-[#F27024]/30 focus:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed shadow-[0_10px_24px_rgba(242,112,36,0.22)] active:scale-[0.99] font-mono"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>ĐANG LƯU THÔNG TIN...</span>
              </>
            ) : (
              <>
                <span>LƯU & VÀO KHU VỰC ĐỘI THI</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </section>
    </main>
  );
}
