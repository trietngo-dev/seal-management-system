import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";
import CaptchaInput from "../shared/CaptchaInput";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [captchaId, setCaptchaId] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaValue, setCaptchaValue] = useState("");

  const fetchCaptcha = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/auth/captcha");
      setCaptchaId(res.data.captchaId);
      setCaptchaSvg(res.data.captchaSvg);
      setCaptchaValue("");
    } catch (err) {
      console.error("Failed to fetch CAPTCHA:", err);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const res = await axios.post("http://localhost:5000/api/auth/forgot-password", {
        email,
        captchaId,
        captchaValue
      });
      setSuccessMessage(res.data.message);
      toast.success("Yêu cầu gửi liên kết khôi phục thành công!");
    } catch (err: any) {
      fetchCaptcha();
      const msg = err.response?.data?.message || "Lỗi khi gửi yêu cầu khôi phục mật khẩu.";
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
            Quên mật khẩu?
          </h1>
          <p className="text-slate-400 text-xs font-sans">
            Nhập email tài khoản của bạn. Chúng tôi sẽ gửi một liên kết để đặt lại mật khẩu mới.
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

        {successMessage ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Mail size={32} />
            </div>
            <div className="space-y-2">
              <p className="text-emerald-400 font-bold font-mono text-sm">GỬI EMAIL THÀNH CÔNG</p>
              <p className="text-slate-300 text-xs font-sans leading-relaxed">
                {successMessage}
              </p>
            </div>
            <div className="pt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 hover:text-[#7df4ff] transition-colors"
              >
                <ArrowLeft size={14} />
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-mono text-xs text-cyan-400 opacity-80 mb-1.5" htmlFor="email">
                Địa chỉ Email
              </label>
              <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
                <div className="relative terminal-prompt">
                  <input
                    type="email"
                    id="email"
                    required
                    placeholder="example@fpt.edu.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="cyber-input relative z-10 w-full rounded-sm py-2.5 px-4 font-mono text-xs focus:ring-0"
                  />
                  <div className="scanline"></div>
                </div>
              </div>
            </div>

            {/* CAPTCHA Verification */}
            {captchaSvg && (
              <div className="pt-1">
                <CaptchaInput
                  captchaSvg={captchaSvg}
                  value={captchaValue}
                  onChange={setCaptchaValue}
                  onRefresh={fetchCaptcha}
                  disabled={loading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full relative overflow-hidden group cursor-pointer border border-[#7df4ff]/40 bg-cyan-950/40 text-cyan-300 hover:text-white hover:bg-cyan-500/20 active:scale-98 text-xs font-mono font-bold uppercase tracking-wider py-3 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? "Đang gửi yêu cầu..." : "Gửi liên kết khôi phục"}</span>
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
