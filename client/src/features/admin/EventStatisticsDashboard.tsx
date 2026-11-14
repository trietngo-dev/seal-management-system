import { useMemo } from "react";
import {
  CheckCircle2,
  Clock3,
  Gavel,
  GraduationCap,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface EventStatisticsDashboardProps {
  selectedEvent: any;
  teamsList: any[];
  eventRoles: any[];
}

const getUserKey = (role: any) =>
  String(role.userId?._id || role.userId || role.email || role._id);

export default function EventStatisticsDashboard({
  selectedEvent,
  teamsList,
  eventRoles,
}: EventStatisticsDashboardProps) {
  const statistics = useMemo(() => {
    const contestantIds = new Set<string>();
    let confirmedContestants = 0;
    let pendingContestants = 0;

    teamsList.forEach((team) => {
      (team.members || []).forEach((member: any) => {
        const memberId = String(member.userId?._id || member.userId || member._id);
        if (contestantIds.has(memberId)) return;
        contestantIds.add(memberId);
        if (member.confirmStatus === "confirmed") confirmedContestants++;
        else if (member.confirmStatus === "pending") pendingContestants++;
      });
    });

    const activePersonnelRoles = eventRoles.filter(
      (role) => role.status === "active" && ["judge", "mentor"].includes(role.role),
    );
    const judgeIds = new Set(
      activePersonnelRoles.filter((role) => role.role === "judge").map(getUserKey),
    );
    const mentorIds = new Set(
      activePersonnelRoles.filter((role) => role.role === "mentor").map(getUserKey),
    );
    const personnelIds = new Set(activePersonnelRoles.map(getUserKey));
    const trackCounts = new Map<string, number>();
    teamsList.forEach((team) => {
      const trackName = team.trackId?.name || "Chưa phân Track";
      trackCounts.set(trackName, (trackCounts.get(trackName) || 0) + 1);
    });

    return {
      teams: teamsList.length,
      confirmedTeams: teamsList.filter((team) => team.status === "confirmed").length,
      pendingTeams: teamsList.filter((team) => team.status === "pending_confirm").length,
      contestants: contestantIds.size,
      confirmedContestants,
      pendingContestants,
      personnel: personnelIds.size,
      judges: judgeIds.size,
      mentors: mentorIds.size,
      trackDistribution: Array.from(trackCounts, ([name, value]) => ({ name, value })),
    };
  }, [eventRoles, teamsList]);

  const cards = [
    {
      label: "Tổng số thí sinh",
      value: statistics.contestants,
      detail: `${statistics.confirmedContestants} đã xác nhận · ${statistics.pendingContestants} đang chờ`,
      icon: GraduationCap,
      tone: "orange",
    },
    {
      label: "Tổng số đội thi",
      value: statistics.teams,
      detail: `${statistics.confirmedTeams} đã xác nhận · ${statistics.pendingTeams} đang chờ`,
      icon: Users,
      tone: "blue",
    },
    {
      label: "Tổng số nhân sự",
      value: statistics.personnel,
      detail: "Mentor và Judge đang hoạt động",
      icon: ShieldCheck,
      tone: "slate",
    },
    {
      label: "Mentor",
      value: statistics.mentors,
      detail: "Nhân sự cố vấn",
      icon: UserRoundCheck,
      tone: "emerald",
    },
    {
      label: "Judge",
      value: statistics.judges,
      detail: "Nhân sự giám khảo",
      icon: Gavel,
      tone: "violet",
    },
  ];

  const toneClasses: Record<string, string> = {
    orange: "border-orange-200 bg-orange-50/70 text-primary",
    blue: "border-sky-200 bg-sky-50/70 text-sky-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
    violet: "border-violet-200 bg-violet-50/70 text-violet-700",
  };

  const contestantStatusData = [
    { name: "Đã xác nhận", value: statistics.confirmedContestants, color: "#10b981" },
    { name: "Chờ xác nhận", value: statistics.pendingContestants, color: "#f59e0b" },
  ].filter((item) => item.value > 0);

  const teamStatusData = [
    { name: "Đã xác nhận", value: statistics.confirmedTeams },
    { name: "Đang chờ", value: statistics.pendingTeams },
    {
      name: "Trạng thái khác",
      value: Math.max(0, statistics.teams - statistics.confirmedTeams - statistics.pendingTeams),
    },
  ].filter((item) => item.value > 0);

  const personnelData = [
    { name: "Mentor", value: statistics.mentors, color: "#10b981" },
    { name: "Judge", value: statistics.judges, color: "#8b5cf6" },
  ].filter((item) => item.value > 0);

  const chartTooltipStyle = {
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    fontSize: 12,
  };

  return (
    <section className="space-y-6" aria-labelledby="event-statistics-title">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              Tổng quan sự kiện
            </p>
            <h2 id="event-statistics-title" className="mt-2 text-2xl font-extrabold text-slate-900">
              {selectedEvent?.name}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Thống kê nhanh quy mô đội thi, thí sinh và nhân sự đang hoạt động.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={15} aria-hidden="true" />
            Dữ liệu hiện tại
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className={`inline-flex rounded-xl border p-2.5 ${toneClasses[tone]}`}>
              <Icon size={20} aria-hidden="true" />
            </div>
            <p className="mt-5 text-3xl font-black tracking-tight text-slate-900">{value}</p>
            <h3 className="mt-1 text-sm font-bold text-slate-800">{label}</h3>
            <p className="mt-2 min-h-8 text-xs leading-5 text-slate-500">{detail}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Clock3 size={17} className="text-amber-600" aria-hidden="true" />
            Tiến độ xác nhận thí sinh
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${statistics.contestants ? (statistics.confirmedContestants / statistics.contestants) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            <strong className="text-slate-800">{statistics.confirmedContestants}/{statistics.contestants}</strong> thí sinh đã xác nhận tham gia.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <ShieldCheck size={17} className="text-violet-600" aria-hidden="true" />
            Cơ cấu nhân sự
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-4"><p className="text-2xl font-black text-emerald-700">{statistics.mentors}</p><p className="mt-1 text-xs font-bold text-emerald-800">Mentor</p></div>
            <div className="rounded-xl bg-violet-50 p-4"><p className="text-2xl font-black text-violet-700">{statistics.judges}</p><p className="mt-1 text-xs font-bold text-violet-800">Judge</p></div>
          </div>
        </article>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Báo cáo trực quan</p>
          <h2 className="mt-1 text-lg font-extrabold text-slate-900">Phân tích quy mô cuộc thi</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Trạng thái thí sinh</h3>
            <p className="mt-1 text-xs text-slate-500">Tỷ lệ xác nhận tham gia đội thi.</p>
            <div className="mt-4 h-64" role="img" aria-label="Biểu đồ trạng thái xác nhận của thí sinh">
              {contestantStatusData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={contestantStatusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3}>
                      {contestantStatusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value} thí sinh`, "Số lượng"]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChartMessage />}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Trạng thái đội thi</h3>
            <p className="mt-1 text-xs text-slate-500">So sánh đội đã hoàn tất và đang chờ xác nhận.</p>
            <div className="mt-4 h-64" role="img" aria-label="Biểu đồ trạng thái đội thi">
              {teamStatusData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamStatusData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value} đội`, "Số lượng"]} cursor={{ fill: "#f8fafc" }} />
                    <Bar dataKey="value" name="Số đội" fill="#0ea5e9" radius={[8, 8, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChartMessage />}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Cơ cấu nhân sự</h3>
            <p className="mt-1 text-xs text-slate-500">Tương quan số Mentor và Judge.</p>
            <div className="mt-4 h-64" role="img" aria-label="Biểu đồ cơ cấu Mentor và Judge">
              {personnelData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={personnelData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3}>
                      {personnelData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value} người`, "Số lượng"]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChartMessage />}
            </div>
          </article>
        </div>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <h3 className="text-sm font-bold text-slate-900">Phân bổ đội theo Track</h3>
          <p className="mt-1 text-xs text-slate-500">Số đội hiện được phân vào từng bảng đấu hoặc Track.</p>
          <div className="mt-5 h-80" role="img" aria-label="Biểu đồ phân bổ đội thi theo Track">
            {statistics.trackDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statistics.trackDistribution} margin={{ top: 8, right: 16, left: -12, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={64} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value} đội`, "Số lượng"]} cursor={{ fill: "#fff7ed" }} />
                  <Bar dataKey="value" name="Số đội" fill="#F27024" radius={[8, 8, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChartMessage />}
          </div>
        </article>
      </div>
    </section>
  );
}

function EmptyChartMessage() {
  return <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">Chưa có dữ liệu để hiển thị.</div>;
}
