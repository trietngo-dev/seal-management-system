import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Users,
  UserPlus,
  Lock,
  Search,
  Trash2,
  Edit2,
  CheckCircle,
  Eye,
  EyeOff,
  Shirt,
  Download,
  History,
  Undo2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "../shared/ConfirmDialog";
import UniversityCombobox from "../shared/UniversityCombobox";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface UsersTabProps {
  token: string | null;
  readOnly?: boolean;
  roles?: any[];
  user?: any;
}

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? window.location.origin
    : "http://localhost:5000");

export const UsersTab: React.FC<UsersTabProps> = ({
  token,
  readOnly = false,
  roles = [],
  user,
}) => {
  const confirm = useConfirm();
  const isAssistant =
    !user?.isSystemAdmin &&
    (user?.isStudentAssistant ||
      roles?.some((r: any) => r.role === "student_assistant"));
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Merchandise (Apparel Size) states
  const [eventId, setEventId] = useState<string | null>(null);
  const [merchandise, setMerchandise] = useState<any[]>([]);
  const [merchStats, setMerchStats] = useState<any | null>(null);
  const [isMerchModalOpen, setIsMerchModalOpen] = useState(false);
  const [selectedMerchUser, setSelectedMerchUser] = useState<any | null>(null);
  const [selectedMerchSize, setSelectedMerchSize] = useState<string>("S");
  const merchReasonRef = useRef<HTMLTextAreaElement>(null);
  const [merchActionLoading, setMerchActionLoading] = useState(false);
  const [merchHistory, setMerchHistory] = useState<any[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>(
    {},
  );

  const displayedUsers = (() => {
    const list = isAssistant ? users.filter((u: any) => u.isTeamMember) : users;
    return [...list].sort((a, b) => {
      if (isAssistant) {
        const aMerch = merchandise.find(
          (m: any) => m.userId.toString() === a._id.toString(),
        );
        const bMerch = merchandise.find(
          (m: any) => m.userId.toString() === b._id.toString(),
        );
        const aDist = aMerch?.merchandiseRecord?.isDistributed ? 1 : 0;
        const bDist = bMerch?.merchandiseRecord?.isDistributed ? 1 : 0;
        if (aDist !== bDist) {
          return aDist - bDist; // Put undistributed (0) first, distributed (1) last
        }
      }
      return (a.fullName || "").localeCompare(b.fullName || "", "vi");
    });
  })();

  const handleSizeSelectChange = (userId: string, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [userId]: size }));
  };

  const handleDirectDistributeMerch = async (u: any, size: string) => {
    if (!eventId) return;
    const confirmed = await confirm({
      title: "Xác nhận phát áo",
      message: `Bạn có chắc chắn muốn phát áo size ${size} cho thí sinh ${u.fullName}?`,
    });
    if (!confirmed) return;

    try {
      await axios.put(
        `${API_BASE}/api/ctsv/events/${eventId}/merchandise/${u._id}/distribute`,
        { size },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        `Đã ghi nhận phát áo size ${size} cho ${u.fullName} thành công!`,
      );
      fetchMerchandiseData(eventId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi phát áo.");
    }
  };

  // Logic gợi ý size áo dựa trên chiều cao/cân nặng
  const suggestShirtSize = (
    height: number | null,
    weight: number | null,
  ): string => {
    if (!height || !weight) return "N/A";
    if (height <= 155 && weight <= 50) return "S";
    if (height <= 165 && weight <= 60) return "M";
    if (height <= 175 && weight <= 70) return "L";
    if (height <= 180 && weight <= 80) return "XL";
    if (height <= 185 && weight <= 90) return "XXL";
    return "3XL";
  };

  const fetchMerchandiseData = async (evtId: string) => {
    try {
      const [listRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/ctsv/events/${evtId}/merchandise/list`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE}/api/ctsv/events/${evtId}/merchandise/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setMerchandise(listRes.data);
      setMerchStats(statsRes.data);
    } catch (err) {
      console.error("Error fetching merchandise data:", err);
    }
  };

  // Form state for creation / editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    studentId: "",
    university: "",
    isActive: true,
    isStudentAssistant: false,
  });

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE}/api/auth/users?search=${encodeURIComponent(search)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      // Filter out any admin users just in case
      setUsers(res.data.filter((u: any) => !u.isSystemAdmin));
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Lỗi khi tải danh sách người dùng.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();

      const savedId =
        sessionStorage.getItem("lastSelectedEventId") ||
        localStorage.getItem("lastSelectedEventId");
      if (savedId) {
        setEventId(savedId);
      }

      axios
        .get(`${API_BASE}/api/events`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          if (!savedId) {
            const activeEvent =
              res.data.find((e: any) =>
                ["registration", "ongoing"].includes(e.status),
              ) || res.data[0];
            if (activeEvent) {
              setEventId(activeEvent._id);
            }
          }
        })
        .catch((err) =>
          console.error("Failed to fetch events for active check", err),
        );
    }
  }, [token, search]);

  useEffect(() => {
    if (token && eventId && isAssistant) {
      fetchMerchandiseData(eventId);
    }
  }, [token, eventId, isAssistant]);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      password: "",
      fullName: "",
      studentId: "",
      university: "",
      isActive: true,
      isStudentAssistant: false,
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      fullName: user.fullName || "",
      studentId: user.studentId || "",
      university: user.university || "FPT University",
      isActive: user.isActive !== undefined ? !!user.isActive : true,
      isStudentAssistant: !!user.isStudentAssistant,
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!editingUser) {
        const emailExists = users.some(
          (u) => u.email.toLowerCase() === formData.email.trim().toLowerCase(),
        );
        if (emailExists) {
          toast.error("Tài khoản với email này đã tồn tại trong hệ thống.");
          return;
        }
      }
      if (editingUser) {
        const normalizedEmail = formData.email.trim().toLowerCase();
        const emailConflict = users.some(
          (u) =>
            u._id !== editingUser._id &&
            u.email.toLowerCase() === normalizedEmail,
        );
        if (emailConflict) {
          toast.error("Tài khoản với email này đã tồn tại trong hệ thống.");
          return;
        }

        // Update basic User info
        await axios.put(
          `${API_BASE}/api/auth/users/${editingUser._id}`,
          {
            email: normalizedEmail,
            fullName: formData.fullName,
            studentId: formData.studentId,
            university: formData.university,
            password: formData.password || undefined,
            isActive: formData.isActive,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        toast.success("Cập nhật thông tin tài khoản thành công!");
      } else {
        // Create User
        await axios.post(
          `${API_BASE}/api/auth/users`,
          {
            email: formData.email,
            password: formData.password || undefined,
            fullName: formData.fullName,
            studentId: formData.studentId,
            university: formData.university,
            isActive: formData.isActive,
            isStudentAssistant: formData.isStudentAssistant,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        toast.success("Tạo tài khoản thành công!");
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Lỗi khi lưu thông tin người dùng.",
      );
    }
  };

  const handleToggleActive = async (user: any) => {
    try {
      await axios.put(
        `${API_BASE}/api/auth/users/${user._id}`,
        {
          isActive: !user.isActive,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(
        user.isActive ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản!",
      );
      fetchUsers(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi cập nhật trạng thái.");
    }
  };
  const handleToggleStudentAssistant = async (user: any) => {
    try {
      const res = await axios.post(
        `${API_BASE}/api/auth/users/${user._id}/toggle-student-assistant`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(res.data.message || "Cập nhật quyền thành công!");
      fetchUsers(true);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Lỗi khi cập nhật quyền công tác sinh viên.",
      );
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await confirm({
      title: "Xác nhận xóa tài khoản",
      message:
        "Bạn có chắc chắn muốn xóa tài khoản người dùng này? Thao tác không thể hoàn tác!",
    });
    if (!confirmed) return;
    try {
      const res = await axios.delete(`${API_BASE}/api/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(res.data.message || "Đã xóa người dùng.");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi xóa người dùng.");
    }
  };

  const handleExportExcel = async () => {
    if (!eventId) {
      toast.error("Không xác định được sự kiện hiện tại.");
      return;
    }
    try {
      toast.info("Đang tạo file Excel...");
      const res = await axios.get(
        `${API_BASE}/api/ctsv/events/${eventId}/merchandise/export`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Danh_Sach_Size_Ao_Event.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Xuất file Excel thành công!");
    } catch (err: any) {
      toast.error("Lỗi khi xuất file Excel.");
    }
  };

  const handleOpenMerchModal = async (u: any) => {
    const merchUser = merchandise.find(
      (m: any) => m.userId.toString() === u._id.toString(),
    ) || {
      userId: u._id,
      fullName: u.fullName,
      studentId: u.studentId || "N/A",
      email: u.email,
      gender: u.gender || "N/A",
      height: u.height || null,
      weight: u.weight || null,
      university: u.university || "N/A",
      teamName: u.teamName || "N/A",
      suggestedSize: suggestShirtSize(u.height, u.weight),
      merchandiseRecord: {
        isDistributed: false,
        size: null,
        distributedAt: null,
        distributedBy: null,
        distributionHistory: [],
      },
    };

    setSelectedMerchUser(merchUser);
    setSelectedMerchSize(
      merchUser.merchandiseRecord?.size || merchUser.suggestedSize || "M",
    );
    if (merchReasonRef.current) merchReasonRef.current.value = "";
    setIsMerchModalOpen(true);
    setMerchHistory([]);

    try {
      const res = await axios.get(
        `${API_BASE}/api/ctsv/events/${eventId}/merchandise/${u._id}/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setMerchHistory(res.data.history || []);
    } catch (err) {
      console.error("Error loading merchandise history:", err);
    }
  };

  const handleDistributeMerch = async () => {
    if (!eventId || !selectedMerchUser) return;
    setMerchActionLoading(true);
    try {
      await axios.put(
        `${API_BASE}/api/ctsv/events/${eventId}/merchandise/${selectedMerchUser.userId}/distribute`,
        { size: selectedMerchSize },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Đã ghi nhận phát áo thành công!");
      setIsMerchModalOpen(false);
      fetchMerchandiseData(eventId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi phát áo.");
    } finally {
      setMerchActionLoading(false);
    }
  };

  const handleRevokeMerch = async () => {
    if (!eventId || !selectedMerchUser) return;
    const reason = merchReasonRef.current?.value || "";
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do thu hồi áo.");
      return;
    }
    const confirmed = await confirm({
      title: "Xác nhận thu hồi áo",
      message: "Bạn có chắc chắn muốn thu hồi áo đã phát cho thí sinh này?",
    });
    if (!confirmed) return;
    setMerchActionLoading(true);
    try {
      await axios.put(
        `${API_BASE}/api/ctsv/events/${eventId}/merchandise/${selectedMerchUser.userId}/revoke`,
        { reason: reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Đã thu hồi áo thành công!");
      if (merchReasonRef.current) merchReasonRef.current.value = "";
      setIsMerchModalOpen(false);
      fetchMerchandiseData(eventId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi thu hồi áo.");
    } finally {
      setMerchActionLoading(false);
    }
  };

  const handleExchangeMerch = async () => {
    if (!eventId || !selectedMerchUser) return;
    const reason = merchReasonRef.current?.value || "";
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do đổi size áo.");
      return;
    }
    setMerchActionLoading(true);
    try {
      await axios.put(
        `${API_BASE}/api/ctsv/events/${eventId}/merchandise/${selectedMerchUser.userId}/exchange`,
        { size: selectedMerchSize, reason: reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Đổi size áo thành công!");
      if (merchReasonRef.current) merchReasonRef.current.value = "";
      setIsMerchModalOpen(false);
      fetchMerchandiseData(eventId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi đổi size áo.");
    } finally {
      setMerchActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 shadow-sm p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-mono">
            <Users className="text-[#F27024]" size={24} />
            <span>
              {isAssistant ? "Danh sách Thí sinh" : "Quản lý Tài khoản"}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAssistant
              ? "Xem danh sách các thí sinh chính thức tham gia cuộc thi."
              : "Quản lý danh sách tài khoản người dùng tham gia hệ thống."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Tìm theo tên, email, MSSV..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#F27024] w-56 transition-all font-mono"
            />
          </div>

          {eventId && isAssistant && (
            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 border border-emerald-500/20"
            >
              <Download size={16} />
              Xuất Excel Size Áo
            </button>
          )}

          {!readOnly && !isAssistant && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-[#F27024] hover:bg-[#d95f1f] text-white px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <UserPlus size={16} />
              Thêm Tài Khoản Mới
            </button>
          )}
        </div>
      </div>

      {/* Merchandise Sizing Stats Dashboard */}
      {eventId && isAssistant && merchStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 border border-slate-200/80 p-6 rounded-2xl shadow-sm">
          {/* Sizing Stats Metric Cards */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Shirt size={16} className="text-[#F27024]" />
                <span>Thống Kê Size Áo</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tự động tính toán dựa trên số liệu Chiều cao & Cân nặng của thí
                sinh.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 p-3 rounded-xl text-center shadow-sm">
                <span className="text-[10px] text-slate-500 block font-mono">
                  TỔNG YÊU CẦU
                </span>
                <span className="text-xl font-bold text-slate-800 font-mono">
                  {merchStats.totalRequired}
                </span>
              </div>
              <div className="bg-emerald-50/40 border border-emerald-200 p-3 rounded-xl text-center">
                <span className="text-[10px] text-emerald-600 block font-mono">
                  ĐÃ PHÁT
                </span>
                <span className="text-xl font-bold text-emerald-600 font-mono">
                  {merchStats.totalDistributed}
                </span>
              </div>
              <div className="bg-amber-50/40 border border-amber-200 p-3 rounded-xl text-center">
                <span className="text-[10px] text-amber-600 block font-mono">
                  CHƯA PHÁT
                </span>
                <span className="text-xl font-bold text-amber-600 font-mono">
                  {merchStats.totalPending}
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${merchStats.totalRequired > 0 ? (merchStats.totalDistributed / merchStats.totalRequired) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Chart Container */}
          <div className="lg:col-span-2 h-44 w-full bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Object.keys(merchStats.stats).map((size) => ({
                  name: size,
                  "Yêu cầu": merchStats.stats[size].required,
                  "Đã phát": merchStats.stats[size].distributed,
                }))}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  labelStyle={{ color: "#1e293b", fontWeight: "bold" }}
                  itemStyle={{ color: "#475569" }}
                />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, marginTop: 5 }}
                />
                <Bar dataKey="Yêu cầu" fill="#f27024" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Đã phát" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono text-[11px]">
              <tr>
                <th className="p-4">Người Dùng</th>
                <th className="p-4">MSSV / Trường</th>
                <th className="p-4">Vai Trò</th>
                {eventId && isAssistant && <th className="p-4">Size Áo</th>}
                {eventId && isAssistant && <th className="p-4">Phát Áo</th>}
                {!isAssistant && <th className="p-4 text-center">CTSV</th>}
                {!isAssistant && <th className="p-4">Trạng Thái Tài Khoản</th>}
                <th className="p-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={isAssistant ? (eventId ? 6 : 4) : eventId ? 8 : 6}
                    className="p-8 text-center text-slate-500 font-mono"
                  >
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : displayedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAssistant ? (eventId ? 6 : 4) : 6}
                    className="p-8 text-center text-slate-500 font-mono"
                  >
                    Không có người dùng nào.
                  </td>
                </tr>
              ) : (
                displayedUsers.map((u) => {
                  return (
                    <tr
                      key={u._id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
                            {u.fullName
                              ? u.fullName.charAt(0).toUpperCase()
                              : "U"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              {u.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono">
                        <div className="text-slate-700">
                          {u.studentId || "N/A"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {u.university || "FPT University"}
                        </div>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const openEventRoles = u.roles
                            ? u.roles.filter(
                                (r: any) =>
                                  r.eventId &&
                                  ["registration", "ongoing"].includes(
                                    r.eventId.status,
                                  ),
                              )
                            : [];

                          const renderedBadges = openEventRoles
                            .map((roleRecord: any) => {
                              const role = roleRecord.role;
                              const eventName =
                                roleRecord.eventId?.name ||
                                roleRecord.eventId?.semester;
                              if (role === "student_assistant") {
                                return (
                                  <div
                                    key={roleRecord._id}
                                    className="flex flex-col gap-0.5 items-start"
                                  >
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none whitespace-nowrap">
                                      Công tác sinh viên
                                    </span>
                                    {eventName && (
                                      <span
                                        className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]"
                                        title={eventName}
                                      >
                                        {eventName}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              if (role === "judge") {
                                return (
                                  <div
                                    key={roleRecord._id}
                                    className="flex flex-col gap-0.5 items-start"
                                  >
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 select-none whitespace-nowrap">
                                      Giám khảo
                                    </span>
                                    {eventName && (
                                      <span
                                        className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]"
                                        title={eventName}
                                      >
                                        {eventName}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              if (role === "mentor") {
                                return (
                                  <div
                                    key={roleRecord._id}
                                    className="flex flex-col gap-0.5 items-start"
                                  >
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 select-none whitespace-nowrap">
                                      Mentor
                                    </span>
                                    {eventName && (
                                      <span
                                        className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]"
                                        title={eventName}
                                      >
                                        {eventName}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              if (role === "coordinator") {
                                return (
                                  <div
                                    key={roleRecord._id}
                                    className="flex flex-col gap-0.5 items-start"
                                  >
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none whitespace-nowrap">
                                      Admin
                                    </span>
                                    {eventName && (
                                      <span
                                        className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]"
                                        title={eventName}
                                      >
                                        {eventName}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              if (role === "participant" && u.isTeamMember) {
                                return (
                                  <div
                                    key={roleRecord._id}
                                    className="flex flex-col gap-0.5 items-start"
                                  >
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 border border-blue-500/30 select-none whitespace-nowrap">
                                      Thí sinh
                                    </span>
                                    {eventName && (
                                      <span
                                        className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]"
                                        title={eventName}
                                      >
                                        {eventName}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })
                            .filter(Boolean);

                          if (
                            u.isStudentAssistant &&
                            !openEventRoles.some(
                              (r: any) => r.role === "student_assistant",
                            )
                          ) {
                            renderedBadges.unshift(
                              <div
                                key="global-ctsv"
                                className="flex flex-col gap-0.5 items-start"
                              >
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none whitespace-nowrap">
                                  Công tác sinh viên
                                </span>
                              </div>,
                            );
                          }

                          return (
                            <div className="flex flex-wrap items-center gap-2">
                              {renderedBadges.length === 0 ? (
                                <span className="text-slate-500 font-medium text-xs select-none whitespace-nowrap">
                                  Người tham gia
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {renderedBadges}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      {eventId && isAssistant && (
                        <td className="p-4">
                          {(() => {
                            const merchInfo = merchandise.find(
                              (m: any) =>
                                m.userId.toString() === u._id.toString(),
                            );
                            if (!merchInfo) {
                              return (
                                <span className="text-slate-500 italic text-[11px]">
                                  N/A
                                </span>
                              );
                            }

                            const isDistributed =
                              merchInfo.merchandiseRecord?.isDistributed;
                            const defaultSize =
                              merchInfo.merchandiseRecord?.size ||
                              (merchInfo.suggestedSize !== "N/A"
                                ? merchInfo.suggestedSize
                                : "M") ||
                              "M";
                            const currentSelectedSize =
                              selectedSizes[u._id] || defaultSize;

                            return (
                              <div className="flex items-center">
                                <select
                                  value={currentSelectedSize}
                                  disabled={isDistributed}
                                  onChange={(e) =>
                                    handleSizeSelectChange(
                                      u._id,
                                      e.target.value,
                                    )
                                  }
                                  className={`bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-0.5 focus:outline-none focus:border-[#F27024] font-mono text-[11px] ${
                                    isDistributed
                                      ? "opacity-60 cursor-not-allowed"
                                      : "cursor-pointer"
                                  }`}
                                >
                                  {["S", "M", "L", "XL", "XXL", "3XL"].map(
                                    (sz) => (
                                      <option key={sz} value={sz}>
                                        {sz}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>
                            );
                          })()}
                        </td>
                      )}
                      {eventId && isAssistant && (
                        <td className="p-4">
                          {(() => {
                            const merchInfo = merchandise.find(
                              (m: any) =>
                                m.userId.toString() === u._id.toString(),
                            );
                            if (!merchInfo) {
                              return (
                                <span className="text-slate-500 italic text-[11px]">
                                  -
                                </span>
                              );
                            }

                            const isDistributed =
                              merchInfo.merchandiseRecord?.isDistributed;
                            const wasRevoked =
                              !isDistributed &&
                              merchInfo.merchandiseRecord?.distributionHistory?.some(
                                (h: any) => h.action === "revoked",
                              );

                            const defaultSize =
                              merchInfo.merchandiseRecord?.size ||
                              (merchInfo.suggestedSize !== "N/A"
                                ? merchInfo.suggestedSize
                                : "M") ||
                              "M";
                            const currentSelectedSize =
                              selectedSizes[u._id] || defaultSize;

                            return (
                              <div className="flex items-center gap-2">
                                {isDistributed ? (
                                  <button
                                    onClick={() => handleOpenMerchModal(u)}
                                    className="px-3 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-600 text-white flex items-center gap-1 cursor-pointer transition-all hover:bg-emerald-700 shadow-sm"
                                    title="Xem lịch sử, đổi size hoặc thu hồi"
                                  >
                                    <span>Đã phát ✓</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleDirectDistributeMerch(
                                        u,
                                        currentSelectedSize,
                                      )
                                    }
                                    className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                                      wasRevoked
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                        : "bg-[#F27024]/10 border-[#F27024]/30 text-[#F27024] hover:bg-[#F27024]/20"
                                    }`}
                                  >
                                    <span>
                                      {wasRevoked
                                        ? "Đã thu hồi (Phát lại)"
                                        : "Phát áo"}
                                    </span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      )}
                      {!isAssistant && (
                        <td className="p-4 text-center">
                          {(() => {
                            const isCtsv = Boolean(
                              u.isStudentAssistant ||
                                (u.roles &&
                                  u.roles.some(
                                    (r: any) => r.role === "student_assistant",
                                  )),
                            );
                            const openEventRoles = u.roles
                              ? u.roles.filter(
                                  (r: any) =>
                                    r.eventId &&
                                    ["registration", "ongoing"].includes(
                                      r.eventId.status,
                                    ),
                                )
                              : [];
                            const hasOtherRole = openEventRoles.some(
                              (r: any) =>
                                ["judge", "mentor"].includes(r.role) ||
                                (r.role === "participant" && u.isTeamMember),
                            );

                            if (hasOtherRole) return null;

                            return (
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={() =>
                                    handleToggleStudentAssistant(u)
                                  }
                                  disabled={readOnly}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                    readOnly
                                      ? "cursor-not-allowed opacity-50"
                                      : "cursor-pointer"
                                  } ${
                                    isCtsv
                                      ? "bg-orange-500"
                                      : "bg-slate-200 hover:bg-slate-300"
                                  }`}
                                  title={
                                    isCtsv
                                      ? "Thu hồi quyền Công tác sinh viên"
                                      : "Cấp quyền Công tác sinh viên"
                                  }
                                >
                                  <span
                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                                      isCtsv
                                        ? "translate-x-5"
                                        : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      )}
                      {!isAssistant && (
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={readOnly || isAssistant}
                            className={`text-[10px] font-mono font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                              readOnly || isAssistant
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer"
                            } ${
                              u.isActive
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" +
                                  (readOnly || isAssistant
                                    ? ""
                                    : " hover:bg-emerald-500/20")
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400" +
                                  (readOnly || isAssistant
                                    ? ""
                                    : " hover:bg-rose-500/20")
                            }`}
                          >
                            {u.isActive ? (
                              <CheckCircle size={12} />
                            ) : (
                              <Lock size={12} />
                            )}
                            {u.isActive ? "Hoạt Động" : "Đã Khóa"}
                          </button>
                        </td>
                      )}
                      {isAssistant ? (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Xem chi tiết"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!readOnly ? (
                              <>
                                <button
                                  onClick={() => handleOpenEditModal(u)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Sửa thông tin"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u._id)}
                                  className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 rounded-lg transition-colors cursor-pointer btn-delete-user"
                                  title="Xóa tài khoản"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">
                                Nguồn xem
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                {isAssistant ? (
                  <Eye className="text-cyan-400" size={18} />
                ) : editingUser ? (
                  <Edit2 className="text-cyan-400" size={18} />
                ) : (
                  <UserPlus className="text-cyan-400" size={18} />
                )}
                <span>
                  {isAssistant
                    ? "Chi Tiết Thí Sinh"
                    : editingUser
                      ? "Chỉnh Sửa Tài Khoản"
                      : "Thêm Tài Khoản Mới"}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-sm font-mono"
              >
                ✕
              </button>
            </div>

            {isAssistant ? (
              <div className="space-y-5 text-sm font-sans">
                {/* Profile Header Card */}
                <div className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                  <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg font-mono">
                    {editingUser?.fullName?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white leading-tight">
                      {editingUser?.fullName}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      {editingUser?.email}
                    </p>
                  </div>
                </div>

                {/* Personal Information Group */}
                <div className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-800/50">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                    Thông tin cá nhân
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        Mã số sinh viên (MSSV)
                      </span>
                      <span className="text-slate-200 font-mono font-bold">
                        {editingUser?.studentId || "Chưa cập nhật"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        Trường đại học
                      </span>
                      <span className="text-slate-200 font-bold">
                        {editingUser?.university || "Chưa cập nhật"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        Chiều cao
                      </span>
                      <span className="text-slate-200 font-mono font-bold">
                        {editingUser?.height
                          ? `${editingUser.height} cm`
                          : "Chưa cập nhật"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        Cân nặng
                      </span>
                      <span className="text-slate-200 font-mono font-bold">
                        {editingUser?.weight
                          ? `${editingUser.weight} kg`
                          : "Chưa cập nhật"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        Trạng thái tài khoản
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border ${
                          editingUser?.isActive
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}
                      >
                        {editingUser?.isActive ? "Hoạt Động" : "Đã Khóa"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tournament Information Group */}
                <div className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-800/50">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                    Thông tin cuộc thi
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        Đội thi tham gia
                      </span>
                      <span className="text-slate-200 font-bold">
                        {editingUser?.teamName || "Chưa tham gia đội"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        Vai trò đội thi
                      </span>
                      <span className="text-slate-200 font-bold">
                        {editingUser?.teamRole === "leader"
                          ? "Trưởng nhóm (Leader)"
                          : editingUser?.teamRole === "member"
                            ? "Thành viên"
                            : "Chưa tham gia"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-mono text-xs cursor-pointer shadow-lg shadow-black/20"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 text-xs font-sans"
              >
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {editingUser ? (
                      <>
                        Mật khẩu{" "}
                        <span className="text-slate-500 font-normal">
                          (Để trống nếu không đổi)
                        </span>
                      </>
                    ) : (
                      <>
                        Mật khẩu{" "}
                        <span className="text-slate-500 font-normal">
                          (Mặc định: password123 nếu để trống)
                        </span>
                      </>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 pr-10 text-white focus:outline-none focus:border-cyan-500 font-mono"
                      placeholder={
                        editingUser
                          ? "••••••••"
                          : "Nhập mật khẩu (hoặc để trống)"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Họ và Tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:border-cyan-500 font-sans"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Mã Số Sinh Viên (MSSV)
                    </label>
                    <input
                      type="text"
                      value={formData.studentId}
                      onChange={(e) =>
                        setFormData({ ...formData, studentId: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:border-cyan-500 font-mono"
                      placeholder="SE180000"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Trường Học
                    </label>
                    <UniversityCombobox
                      value={formData.university}
                      onChange={(val) =>
                        setFormData({ ...formData, university: val })
                      }
                      placeholder="Chọn trường..."
                      className="w-full"
                      inputClassName="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-sans disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0 disabled:opacity-50"
                    />
                    <span>
                      Tài khoản{" "}
                      <strong className="text-slate-400 font-bold">
                        Hoạt động (Active)
                      </strong>
                    </span>
                  </label>

                  {!editingUser && (
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-1">
                      <input
                        type="checkbox"
                        checked={formData.isStudentAssistant || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isStudentAssistant: e.target.checked,
                          })
                        }
                        className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                      />
                      <span>
                        Vai trò{" "}
                        <strong className="text-slate-400 font-bold">
                          Công tác sinh viên (Student Assistant)
                        </strong>
                      </span>
                    </label>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-cancel px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-mono text-xs cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl font-mono text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    {editingUser ? "Cập Nhật" : "Tạo Mới"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Merchandise Modal */}
      {isMerchModalOpen && selectedMerchUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 font-sans max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-800 font-mono flex flex-wrap items-center gap-2">
                <Shirt className="text-[#F27024]" size={18} />
                <span>Phát áo: {selectedMerchUser.fullName}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-lg text-[9px] font-mono font-bold select-none whitespace-nowrap border ${
                    selectedMerchUser.merchandiseRecord?.isDistributed
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {selectedMerchUser.merchandiseRecord?.isDistributed
                    ? "Đã phát"
                    : "Chưa phát"}
                </span>
              </h3>
              <button
                onClick={() => setIsMerchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto flex-grow pr-1 py-1">
              {/* Operations Control Panel */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                <h5 className="text-[10px] font-bold text-[#F27024] uppercase tracking-wider font-mono">
                  Thao Tác Phân Phối
                </h5>

                {!selectedMerchUser.merchandiseRecord?.isDistributed ? (
                  // Distribute Form
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="text-slate-700 font-medium">
                        Chọn size phát thực tế:
                      </label>
                      <select
                        value={selectedMerchSize}
                        onChange={(e) => setSelectedMerchSize(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#F27024] font-mono text-xs cursor-pointer"
                      >
                        {["S", "M", "L", "XL", "XXL", "3XL"].map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={merchActionLoading}
                      onClick={handleDistributeMerch}
                      className="w-full py-2 bg-[#F27024] hover:bg-[#d95f1f] disabled:opacity-50 text-white font-bold rounded-xl font-mono text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#F27024]/10 cursor-pointer"
                    >
                      <Shirt size={14} />
                      Xác Nhận Phát Áo
                    </button>
                  </div>
                ) : (
                  // Exchange & Revoke forms
                  <div className="space-y-3">
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <label className="text-slate-500 font-mono text-[10px] block">
                          CHỌN SIZE ĐỂ ĐỔI
                        </label>
                        <select
                          value={selectedMerchSize}
                          onChange={(e) => setSelectedMerchSize(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#F27024] font-mono text-xs cursor-pointer"
                        >
                          {["S", "M", "L", "XL", "XXL", "3XL"].map((sz) => (
                            <option key={sz} value={sz}>
                              {sz}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-500 font-mono text-[10px] block">
                          LÝ DO THAO TÁC{" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          ref={merchReasonRef}
                          placeholder="Nhập lý do đổi size hoặc thu hồi áo..."
                          defaultValue=""
                          rows={2}
                          className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#F27024] text-xs resize-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        disabled={merchActionLoading}
                        onClick={handleRevokeMerch}
                        className="py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-50 font-bold rounded-xl font-mono text-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Undo2 size={13} />
                        Thu Hồi Áo
                      </button>

                      <button
                        type="button"
                        disabled={merchActionLoading}
                        onClick={handleExchangeMerch}
                        className="py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl font-mono text-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={13} />
                        Đổi Size Áo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* History Timeline */}
              {merchHistory.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <History size={12} />
                    <span>Lịch sử phân phối</span>
                  </h5>

                  <div className="space-y-3 pr-1 font-sans border-l border-slate-200 pl-3.5 ml-2.5">
                    {merchHistory.map((item, idx) => {
                      const getIcon = () => {
                        if (item.action === "distributed")
                          return (
                            <Shirt size={10} className="text-emerald-600" />
                          );
                        if (item.action === "revoked")
                          return <Undo2 size={10} className="text-rose-600" />;
                        return (
                          <RefreshCw size={10} className="text-cyan-600" />
                        );
                      };

                      const getActionText = () => {
                        if (item.action === "distributed")
                          return `Phát áo size ${item.size}`;
                        if (item.action === "revoked")
                          return `Thu hồi áo (size cũ ${item.size})`;
                        return `Đổi sang size ${item.size}`;
                      };

                      return (
                        <div
                          key={idx}
                          className="relative text-[10.5px] leading-relaxed"
                        >
                          {/* Timeline dot */}
                          <div className="absolute -left-[20.5px] top-3 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                            {getIcon()}
                          </div>
                          <div className="bg-slate-50 border border-slate-100/80 rounded-lg p-2">
                            <div className="font-semibold text-slate-800">
                              {getActionText()}
                            </div>
                            <div className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                              Tác nhân: {item.performedBy?.fullName || "CTSV"} |{" "}
                              {new Date(item.performedAt).toLocaleString(
                                "vi-VN",
                              )}
                            </div>
                            {item.reason && (
                              <div className="text-[9.5px] text-amber-600 font-medium italic mt-0.5">
                                Lý do: "{item.reason}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsMerchModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-mono text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
