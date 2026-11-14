import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import EventStatisticsDashboard from "./EventStatisticsDashboard";
import CustomSelect from "../shared/CustomSelect";

export default function EventStatisticsPage() {
  const { readOnly = false, roles = [], user } = useOutletContext<{
    readOnly?: boolean;
    roles?: any[];
    user?: any;
  }>();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [eventRoles, setEventRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId),
    [events, selectedEventId],
  );

  const loadStatistics = async (eventId: string) => {
    if (!eventId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const [teamsResponse, rolesResponse] = await Promise.all([
        axios.get(`${apiBase}/api/teams/all/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${apiBase}/api/events/${eventId}/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setTeamsList(teamsResponse.data || []);
      setEventRoles(rolesResponse.data || []);
    } catch (error) {
      console.error("Load event statistics error:", error);
      toast.error("Không thể tải dữ liệu dashboard thống kê.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const response = await axios.get(`${apiBase}/api/events`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let availableEvents = response.data || [];
        if (!user?.isSystemAdmin && (readOnly || roles.length > 0)) {
          const assignedIds = new Set(
            roles.map((role: any) => String(role.eventId?._id || role.eventId)),
          );
          availableEvents = availableEvents.filter((event: any) => assignedIds.has(String(event._id)));
        }
        setEvents(availableEvents);
        setSelectedEventId((current) => current || availableEvents[0]?._id || "");
      } catch (error) {
        console.error("Load statistics events error:", error);
        toast.error("Không thể tải danh sách sự kiện.");
        setLoading(false);
      }
    };
    void loadEvents();
  }, [readOnly, roles, user?.isSystemAdmin]);

  useEffect(() => {
    if (selectedEventId) void loadStatistics(selectedEventId);
  }, [selectedEventId]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary"><BarChart3 size={20} /><span className="text-xs font-bold uppercase tracking-[0.16em]">Báo cáo quản trị</span></div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Dashboard thống kê</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi quy mô thí sinh, đội thi và nhân sự theo từng sự kiện.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-72">
          <label htmlFor="statistics-event-select" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sự kiện</label>
          <div className="flex gap-2">
            <CustomSelect value={selectedEventId} onChange={setSelectedEventId} options={events.map((event) => ({ value: event._id, label: `${event.name} · ${event.semester} ${event.year}` }))} placeholder="Chọn sự kiện" className="flex-1" />
            <button type="button" onClick={() => void loadStatistics(selectedEventId)} disabled={!selectedEventId || loading} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-primary focus:outline-hidden focus:ring-2 focus:ring-[#F27024]/30 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Làm mới dashboard">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            </button>
          </div>
        </div>
      </header>

      {loading && !selectedEvent ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white text-sm text-slate-500"><Loader2 size={18} className="mr-2 animate-spin" />Đang tải dashboard...</div>
      ) : selectedEvent ? (
        <EventStatisticsDashboard selectedEvent={selectedEvent} teamsList={teamsList} eventRoles={eventRoles} />
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Chưa có sự kiện phù hợp để hiển thị thống kê.</div>
      )}
    </main>
  );
}
