import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { KeyRound, ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      const msg = "Mật khẩu xác nhận không khớp.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (newPassword.length < 6) {
      const msg = "Mật khẩu phải dài tối thiểu 6 ký tự.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await axios.post("http://localhost:5000/api/auth/reset-password", {
        email,
        token,
        newPassword,
      });
      setSuccess(true);
      toast.success(res.data.message);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Lỗi khi đặt lại mật khẩu mới.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12">
      <div className="glass-panel w-full max-w-md p-8 rounded-xl relative overflow-hidden z-10">
        {/* Top Rule */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-linear-to-r from-transparent via-cyan-500 to-transparent opacity-80"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-cyan-500 to-transparent opacity-30"></div>

        {/* Header Section */}
        <div className="text-center mb-6 flex flex-col items-center">
          <h1 className="font-mono text-2xl font-bold text-cyan-300 mb-2 tracking-tight uppercase">
            Đặt lại mật khẩu
          </h1>
          <p className="text-slate-400 text-xs font-sans">
            Tài khoản: <strong className="text-cyan-400 font-mono text-[11px]">{email}</strong>
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-950/90 border border-rose-500/80 rounded-xl text-rose-200 text-xs font-mono flex items-center justify-between shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="text-rose-400 hover:text-white font-bold ml-3 text-sm cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {success ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <KeyRound size={32} />
            </div>
            <div className="space-y-2">
              <p className="text-emerald-400 font-bold font-mono text-sm">ĐỔI MẬT KHẨU THÀNH CÔNG</p>
              <p className="text-slate-300 text-xs font-sans leading-relaxed">
                Mật khẩu của bạn đã được đặt lại thành công. Bạn đang được chuyển hướng về trang đăng nhập...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-cyan-400 opacity-80 mb-1" htmlFor="newPassword">
                Mật khẩu mới
              </label>
              <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
                <div className="relative terminal-prompt flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="newPassword"
                    required
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="cyber-input relative z-10 w-full rounded-sm py-2.5 pl-4 pr-11 font-mono text-xs focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 z-20 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <div className="scanline"></div>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-cyan-400 opacity-80 mb-1" htmlFor="confirmPassword">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
                <div className="relative terminal-prompt">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="confirmPassword"
                    required
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="cyber-input relative z-10 w-full rounded-sm py-2.5 px-4 font-mono text-xs focus:ring-0"
                  />
                  <div className="scanline"></div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || !token || !email}
              className="w-full relative overflow-hidden group cursor-pointer border border-[#7df4ff]/40 bg-cyan-950/40 text-cyan-300 hover:text-white hover:bg-cyan-500/20 active:scale-98 text-xs font-mono font-bold uppercase tracking-wider py-3 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? "Đang cập nhật..." : "Xác nhận đổi mật khẩu"}</span>
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={14} />
                Quay lại đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
