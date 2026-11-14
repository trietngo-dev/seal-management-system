import { useState, useEffect } from "react";
import { RefreshCw, Clock } from "lucide-react";

const GithubIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
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

interface GithubTabProps {
  repos: any[];
  selectedEvent?: any;
  handleSyncAllRepos: () => Promise<void>;
  syncingAll: boolean;
  syncProgress: {
    total: number;
    completed: number;
    syncing: number;
    queued: number;
    active: boolean;
  } | null;
  loading: boolean;
  handleKickAllCollaborators?: (repoId: string) => Promise<void>;
}

export default function GithubTab({
  repos,
  selectedEvent,
  handleSyncAllRepos,
  syncingAll,
  syncProgress,
  loading,
  handleKickAllCollaborators,
}: GithubTabProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const intervalMinutes = selectedEvent?.commitSyncInterval || 30;

  const getCountdownText = (lastSyncedAt: string | null, syncStatus: string) => {
    if (syncStatus === "syncing") return "Đang đồng bộ...";
    if (syncStatus === "queued") return "Đang chờ...";
    if (!lastSyncedAt) return "Chưa đồng bộ";

    const nextSyncTime = new Date(lastSyncedAt).getTime() + intervalMinutes * 60 * 1000;
    const diff = nextSyncTime - currentTime.getTime();

    if (diff <= 0) {
      return "Đang chờ đồng bộ...";
    }

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor(diff / (1000 * 60 * 60));

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const getGlobalCountdown = () => {
    const eligibleRepos = repos.filter(
      (r) => r.syncStatus !== "syncing" && r.syncStatus !== "queued" && r.lastSyncedAt
    );

    if (eligibleRepos.length === 0) {
      if (repos.some((r) => r.syncStatus === "syncing")) {
        return "Đang đồng bộ...";
      }
      if (repos.some((r) => r.syncStatus === "queued")) {
        return "Đang chờ...";
      }
      return "Đang chờ đồng bộ...";
    }

    const nextSyncTimes = eligibleRepos.map(
      (r) => new Date(r.lastSyncedAt).getTime() + intervalMinutes * 60 * 1000
    );
    const soonestSyncTime = Math.min(...nextSyncTimes);
    const diff = soonestSyncTime - currentTime.getTime();

    if (diff <= 0) {
      return "Đang chờ đồng bộ...";
    }

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor(diff / (1000 * 60 * 60));

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const globalCountdown = getGlobalCountdown();

  return (
    <div className="glass p-6 rounded-2xl w-full mt-2 space-y-6 font-mono">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <GithubIcon size={18} className="text-cyan-400" />
        <span>Quản lý GitHub Repositories của các đội thi</span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2/3): Repositories List */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Danh sách Repositories ({repos.length})
          </h4>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {repos.map((r: any) => (
              <div
                key={r._id}
                className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs"
              >
                <div className="space-y-1">
                  <p className="font-bold text-slate-200">
                    {r.teamId?.name || "Đội thi"}
                  </p>
                  <a
                    href={r.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline break-all block"
                  >
                    {r.repoUrl || r.repoName}
                  </a>
                  <div className="flex gap-2 text-[10px] text-slate-400 flex-wrap">
                    <span>
                      Mặc định:{" "}
                      <span className="text-slate-300 font-semibold">
                        {r.defaultBranch || "main"}
                      </span>
                    </span>
                    <span>•</span>
                    <span>
                      Đồng bộ cuối:{" "}
                      <span className="text-slate-300">
                        {r.lastSyncedAt
                          ? new Date(r.lastSyncedAt).toLocaleString()
                          : "Chưa đồng bộ"}
                      </span>
                    </span>
                    {r.lastSyncedAt && r.syncStatus !== "syncing" && r.syncStatus !== "queued" && (
                      <>
                        <span>•</span>
                        <span>
                          Tự động đồng bộ sau:{" "}
                          <span className="text-emerald-400 font-semibold">
                            {getCountdownText(r.lastSyncedAt, r.syncStatus)}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.syncStatus === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : r.syncStatus === "syncing"
                        ? "bg-cyan-500/10 text-cyan-400 animate-pulse border border-cyan-500/20"
                        : r.syncStatus === "failed"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : r.syncStatus === "queued"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700/50"
                      }`}
                  >
                    {r.syncStatus.toUpperCase()}
                  </span>
                  {selectedEvent?.status === "completed" && handleKickAllCollaborators && (
                    <button
                      onClick={() => handleKickAllCollaborators(r._id)}
                      className="bg-rose-600/90 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border border-rose-500/20 shadow-md shadow-rose-950/20"
                    >
                      Thu hồi quyền (Kick)
                    </button>
                  )}
                </div>
              </div>
            ))}
            {repos.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                Chưa có repository nào được cấu hình cho cuộc thi này.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (1/3): Sync Panel + Countdown + Progress */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-cyan-400" />
              <span>Tự động đồng bộ Github</span>
            </h4>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Chu kỳ quét tự động:</span>
                <span className="text-white font-bold">{intervalMinutes} phút / lần</span>
              </div>

              {!syncingAll && (
                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Đồng bộ tiếp theo sau
                  </div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono tracking-tight animate-pulse">
                    {globalCountdown}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSyncAllRepos}
              disabled={loading || syncingAll || repos.length === 0}
              className={`w-full text-xs font-bold py-3 px-4 rounded-xl text-white font-mono transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${syncingAll
                ? "bg-slate-800 text-slate-500 border border-slate-700/50"
                : repos.length === 0
                  ? "bg-slate-800/80 text-white border border-slate-700/50 cursor-not-allowed"
                  : "bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25 border border-emerald-500/20"
                }`}
            >
              <RefreshCw size={14} className={syncingAll ? "animate-spin" : ""} />
              <span>{syncingAll ? "Đang đồng bộ chung..." : "Đồng bộ tất cả Repo"}</span>
            </button>
          </div>

          {/* Sync Progress Bar */}
          {syncProgress && syncProgress.active && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-emerald-500/25 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin text-emerald-400" />
                  <span>ĐANG ĐỒNG BỘ ({syncProgress.completed}/{syncProgress.total})</span>
                </span>
                <span className="text-slate-400 font-bold">
                  {Math.round((syncProgress.completed / (syncProgress.total || 1)) * 100)}%
                </span>
              </div>
              {/* Bar track */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-linear-to-r from-emerald-500 to-teal-500 h-full transition-all duration-500"
                  style={{ width: `${(syncProgress.completed / (syncProgress.total || 1)) * 100}%` }}
                />
              </div>
              <div className="flex flex-col gap-1 text-[9px] text-slate-500 font-mono">
                <div className="flex justify-between">
                  <span>Hàng đợi: {syncProgress.queued}</span>
                  <span>Đang xử lý: {syncProgress.syncing}</span>
                </div>
                <div className="text-center italic mt-1 border-t border-slate-900/60 pt-1">
                  Quãng nghỉ 12s mỗi repo để bảo vệ API key
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
