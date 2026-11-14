import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import axios from "axios";
import errorMessages from "./utils/errorMessages";
import Navbar from "./features/landing/Navbar";
import Footer from "./features/landing/Footer";
import Login from "./features/auth/Login";
import ForgotPassword from "./features/auth/ForgotPassword";
import ResetPassword from "./features/auth/ResetPassword";
import PersonnelInvitationResponse from "./features/auth/PersonnelInvitationResponse";
import LandingPage from "./features/landing/LandingPage";
import AdminDashboard from "./features/admin/AdminDashboard";
import AdminEvents from "./features/admin/AdminEvents";
import EventStatisticsPage from "./features/admin/EventStatisticsPage";
import AdminLiveInteraction from "./features/admin/AdminLiveInteraction";
import PersonnelManagement from "./features/admin/PersonnelManagement";
import TeamArea from "./features/teams/TeamArea";
import MyAchievements from "./features/teams/MyAchievements";
import ConfirmSurvey from "./features/teams/ConfirmSurvey";
import Leaderboard from "./features/leaderboard/Leaderboard";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import GuestPortal from "./features/landing/GuestPortal";
import ExpertLayout from "./features/shared/ExpertLayout";
import ExpertDashboard from "./features/shared/ExpertDashboard";
import JudgeProjects from "./features/judge/JudgeProjects";
import JudgeScoring from "./features/judge/JudgeScoring";
import JudgeTeamActivity from "./features/judge/JudgeTeamActivity";
import AdminGradesView from "./features/admin/AdminGradesView";
import AdminUsersView from "./features/admin/AdminUsersView";
import AdminLayout from "./features/admin/AdminLayout";
import MentorDashboard from "./features/mentor/MentorDashboard";
import MentorTeamDetail from "./features/mentor/MentorTeamDetail";
import MentorChat from "./features/mentor/MentorChat";
import Gallery from "./features/landing/Gallery";
import SupportCenter from "./features/support/SupportCenter";
import { Toaster, toast } from "sonner";
import { ConformProvider } from "./features/shared/ModalConform";
import { ConfirmProvider } from "./features/shared/ConfirmDialog";
import { Settings2, UserCog } from "lucide-react";

function RedirectToExpertScore() {
  const { teamId } = useParams();
  const location = useLocation();
  return <Navigate to={`/expert/score/${teamId}${location.search}`} replace />;
}

function RedirectToExpertActivity() {
  const { teamId } = useParams();
  return <Navigate to={`/expert/activity/${teamId}`} replace />;
}

function RedirectToExpertMentorTeam() {
  const { teamId } = useParams();
  return <Navigate to={`/expert/mentored-team/${teamId}`} replace />;
}

function AppContent({
  user,
  roles,
  handleLoginSuccess,
  handleLogout,
  setUser,
}: any) {
  const location = useLocation();
  const isJudgeRoute =
    location.pathname.startsWith("/judge") ||
    location.pathname.startsWith("/expert");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isCoordinator = !!user?.isSystemAdmin;
  const isMentor =
    roles?.some((r: any) => r.role === "mentor") || user?.isSystemAdmin;
  const isExpertMentorRoute =
    location.pathname.startsWith("/expert/mentored-team") ||
    location.pathname.startsWith("/expert/mentored-teams");

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    studentId: "",
    university: "",
    githubUsername: "",
    height: "",
    weight: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        studentId: user.studentId || "",
        university: user.university || "",
        githubUsername: user.githubUsername || "",
        height:
          user.height !== undefined && user.height !== null
            ? String(user.height)
            : "",
        weight:
          user.weight !== undefined && user.weight !== null
            ? String(user.weight)
            : "",
      });
    }
  }, [user, isProfileOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      toast.error("Họ và tên không được để trống");
      return;
    }
    if (!formData.height || isNaN(Number(formData.height))) {
      toast.error("Chiều cao hợp lệ là bắt buộc");
      return;
    }
    if (!formData.weight || isNaN(Number(formData.weight))) {
      toast.error("Cân nặng hợp lệ là bắt buộc");
      return;
    }

    setIsSaving(true);
    try {
      const apiBase =
        import.meta.env.VITE_API_URL ||
        (window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
          ? window.location.origin
          : "http://localhost:5000");
      const token =
        sessionStorage.getItem("token") || localStorage.getItem("token");

      const response = await axios.put(
        `${apiBase}/api/auth/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success(response.data.message || "Cập nhật thông tin thành công!");
      setIsEditing(false);
      setIsProfileOpen(false);

      if (setUser) {
        setUser(response.data.user);
      }
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      toast.error(err.response?.data?.message || "Cập nhật thông tin thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  const usesLightShell =
    location.pathname === "/" ||
    location.pathname === "/team-area" ||
    location.pathname === "/register-team" ||
    location.pathname === "/login" ||
    location.pathname === "/achievements" ||
    location.pathname === "/my-achievements" ||
    location.pathname === "/support" ||
    location.pathname === "/guest-portal" ||
    location.pathname.startsWith("/album") ||
    location.pathname === "/confirm-survey";
  const isPersonnelInvitationPage = location.pathname === "/personnel-invitation";
  const isConfirmSurveyPage = location.pathname === "/confirm-survey";

  const showChatWidget =
    user &&
    ((!isJudgeRoute && (!isAdminRoute || isCoordinator)) ||
      (isExpertMentorRoute && isMentor));

  const isLightModePage = usesLightShell || isAdminRoute;

  return (
    <div
      className={`min-h-screen ${location.pathname === "/login" ? "bg-[#f5efe8]" : isLightModePage ? "bg-[#faf9f6]" : "bg-gradient-dark"} flex flex-col`}
    >
      {!isJudgeRoute && !isAdminRoute && !isPersonnelInvitationPage && !isConfirmSurveyPage && location.pathname !== "/" && (
        <Navbar
          user={user}
          roles={roles}
          onLogout={handleLogout}
          onOpenProfile={() => setIsProfileOpen(true)}
        />
      )}

      <main className="flex-1">
        <Routes>
          <Route
            path="/personnel-invitation"
            element={<PersonnelInvitationResponse />}
          />
          <Route
            path="/"
            element={
              user ? (
                user.isSystemAdmin ||
                user.isStudentAssistant ||
                roles.some(
                  (r: any) =>
                    r.role === "admin_view" || r.role === "student_assistant",
                ) ? (
                  <Navigate to="/admin" />
                ) : roles.some((r: any) => r.role === "judge") ||
                  roles.some((r: any) => r.role === "mentor") ? (
                  <Navigate to="/expert/dashboard" />
                ) : (
                  <Navigate to="/guest-portal" />
                )
              ) : (
                <LandingPage user={user} />
              )
            }
          />
          <Route
            path="/login"
            element={
              !user ? (
                <Login onLoginSuccess={handleLoginSuccess} />
              ) : (
                <Navigate to="/" />
              )
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/register-team"
            element={<Navigate to="/team-area" replace />}
          />

          <Route
            path="/guest-portal"
            element={
              <ProtectedRoute
                user={user}
                roles={roles}
                allowedRoles={["participant"]}
              >
                <GuestPortal user={user} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/team-area"
            element={
              <ProtectedRoute
                user={user}
                roles={roles}
                allowedRoles={["participant"]}
              >
                <TeamArea />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-achievements"
            element={
              <ProtectedRoute
                user={user}
                roles={roles}
                allowedRoles={["participant"]}
              >
                <MyAchievements />
              </ProtectedRoute>
            }
          />

          <Route
            path="/support"
            element={
              <ProtectedRoute user={user} roles={roles} allowedRoles={["participant"]}>
                <SupportCenter />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes under AdminLayout */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute
                user={user}
                roles={roles}
                allowedRoles={["coordinator", "student_assistant"]}
              >
                <AdminLayout
                  user={user}
                  roles={roles}
                  onLogout={handleLogout}
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="statistics" element={<EventStatisticsPage />} />
            <Route path="users" element={<AdminUsersView />} />
            <Route path="live" element={<AdminLiveInteraction />} />
            <Route path="personnel" element={<PersonnelManagement />} />
            <Route path="support" element={<SupportCenter coordinator />} />
            <Route
              path="grades"
              element={<AdminGradesView user={user} roles={roles} />}
            />
            <Route
              path="leaderboard"
              element={<Leaderboard user={user} roles={roles} />}
            />
            <Route
              path="album"
              element={<Gallery user={user} roles={roles} />}
            />
          </Route>

          {/* Expert Sub-Routes under ExpertLayout (Judge & Mentor combined) */}
          <Route
            path="/expert"
            element={
              <ProtectedRoute
                user={user}
                roles={roles}
                allowedRoles={["judge", "mentor"]}
              >
                <ExpertLayout
                  user={user}
                  roles={roles}
                  onLogout={handleLogout}
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={<ExpertDashboard user={user} roles={roles} />}
            />
            <Route path="projects" element={<JudgeProjects />} />
            <Route path="score/:teamId" element={<JudgeScoring />} />
            <Route path="activity/:teamId" element={<JudgeTeamActivity />} />
            <Route
              path="mentored-teams"
              element={<MentorDashboard user={user} roles={roles} />}
            />
            <Route
              path="mentored-team/:teamId"
              element={<MentorTeamDetail />}
            />
            <Route
              path="album"
              element={<Gallery user={user} roles={roles} />}
            />
          </Route>

          {/* Fallbacks for backward compatibility */}
          <Route
            path="/judge"
            element={<Navigate to="/expert/dashboard" replace />}
          />
          <Route
            path="/judge/dashboard"
            element={<Navigate to="/expert/dashboard" replace />}
          />
          <Route
            path="/judge/projects"
            element={<Navigate to="/expert/projects" replace />}
          />
          <Route
            path="/judge/score/:teamId"
            element={<RedirectToExpertScore />}
          />
          <Route
            path="/judge/activity/:teamId"
            element={<RedirectToExpertActivity />}
          />
          <Route
            path="/mentor/dashboard"
            element={<Navigate to="/expert/mentored-teams" replace />}
          />
          <Route
            path="/mentor/team/:teamId"
            element={<RedirectToExpertMentorTeam />}
          />

          <Route
            path="/leaderboard"
            element={<Leaderboard user={user} roles={roles} />}
          />
          <Route
            path="/album"
            element={<Gallery user={user} roles={roles} />}
          />
          <Route path="/confirm-survey" element={<ConfirmSurvey />} />
        </Routes>
      </main>

      {!isJudgeRoute && !isAdminRoute && !isPersonnelInvitationPage && !isConfirmSurveyPage && <Footer />}

      {showChatWidget && (
        <MentorChat roles={roles} isSystemAdmin={!!user?.isSystemAdmin} />
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-fade-in animate-duration-150">
          <div
            className={`relative w-full max-w-md p-6 rounded-2xl shadow-2xl transition-all duration-300 font-sans ${
              usesLightShell
                ? "bg-[#faf9f6] border border-slate-200 text-slate-800 profile-modal-light"
                : "bg-[#0c1322] border border-cyan-500/30 text-slate-200 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
            }`}
          >
            {/* Top decorative line */}
            <div
              className={`absolute top-0 left-0 w-full h-[2px] rounded-t-2xl ${
                usesLightShell
                  ? "bg-linear-to-r from-transparent via-[#F27024]/50 to-transparent"
                  : "bg-linear-to-r from-transparent via-cyan-500/50 to-transparent"
              }`}
            ></div>

            {/* Header */}
            <div
              className={`flex items-center justify-between pb-4 mb-4 border-b ${
                usesLightShell ? "border-slate-200" : "border-slate-800"
              }`}
            >
              <h3 className="text-base font-bold uppercase tracking-wider flex items-center gap-2">
                {isEditing ? (
                  <Settings2
                    size={18}
                    className={
                      usesLightShell ? "text-primary" : "text-cyan-400"
                    }
                  />
                ) : (
                  <UserCog
                    size={18}
                    className={
                      usesLightShell ? "text-primary" : "text-cyan-400"
                    }
                  />
                )}
                <span>
                  {isEditing ? "Cập nhật thông tin" : "Hồ sơ cá nhân"}
                </span>
              </h3>
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  setIsEditing(false);
                }}
                className={`text-sm p-1 rounded-lg transition-colors ${
                  usesLightShell
                    ? "hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                    : "hover:bg-slate-800 text-slate-500 hover:text-slate-350"
                }`}
              >
                ✕
              </button>
            </div>

            {/* Form / Details */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider ${
                    usesLightShell ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!isEditing}
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  placeholder="Họ và tên"
                  className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-hidden transition-all ${
                    !isEditing
                      ? usesLightShell
                        ? "bg-slate-100/85 border-slate-250 text-slate-500 cursor-not-allowed"
                        : "bg-slate-900/50 border-slate-850 text-slate-500 cursor-not-allowed"
                      : usesLightShell
                        ? "bg-white border-slate-300 text-slate-800 focus:border-primary focus:ring-2 focus:ring-[#F27024]/20"
                        : "bg-slate-900 border-slate-800 text-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  }`}
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider ${
                    usesLightShell ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Mã số sinh viên
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.studentId}
                  onChange={(e) =>
                    setFormData({ ...formData, studentId: e.target.value })
                  }
                  placeholder={
                    isEditing
                      ? "Nhập mã số sinh viên (ví dụ: SE180186)"
                      : "Chưa cập nhật"
                  }
                  className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-hidden transition-all ${
                    !isEditing
                      ? usesLightShell
                        ? "bg-slate-100/85 border-slate-250 text-slate-500 cursor-not-allowed"
                        : "bg-slate-900/50 border-slate-850 text-slate-500 cursor-not-allowed"
                      : usesLightShell
                        ? "bg-white border-slate-300 text-slate-800 focus:border-primary focus:ring-2 focus:ring-[#F27024]/20"
                        : "bg-slate-900 border-slate-800 text-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  }`}
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider ${
                    usesLightShell ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Trường Đại học / Đơn vị
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.university}
                  onChange={(e) =>
                    setFormData({ ...formData, university: e.target.value })
                  }
                  placeholder={
                    isEditing ? "Nhập tên trường đại học" : "Chưa cập nhật"
                  }
                  className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-hidden transition-all ${
                    !isEditing
                      ? usesLightShell
                        ? "bg-slate-100/85 border-slate-250 text-slate-500 cursor-not-allowed"
                        : "bg-slate-900/50 border-slate-850 text-slate-500 cursor-not-allowed"
                      : usesLightShell
                        ? "bg-white border-slate-300 text-slate-800 focus:border-primary focus:ring-2 focus:ring-[#F27024]/20"
                        : "bg-slate-900 border-slate-800 text-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  }`}
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider ${
                    usesLightShell ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Tài khoản GitHub
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.githubUsername}
                  onChange={(e) =>
                    setFormData({ ...formData, githubUsername: e.target.value })
                  }
                  placeholder={
                    isEditing
                      ? "Nhập tên tài khoản GitHub (ví dụ: octocat)"
                      : "Chưa cập nhật"
                  }
                  className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-hidden transition-all ${
                    !isEditing
                      ? usesLightShell
                        ? "bg-slate-100/85 border-slate-250 text-slate-500 cursor-not-allowed"
                        : "bg-slate-900/50 border-slate-850 text-slate-500 cursor-not-allowed"
                      : usesLightShell
                        ? "bg-white border-slate-300 text-slate-800 focus:border-primary focus:ring-2 focus:ring-[#F27024]/20"
                        : "bg-slate-900 border-slate-800 text-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 text-left">
                  <label
                    className={`block text-xs font-semibold uppercase tracking-wider ${
                      usesLightShell ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    Chiều cao (cm) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    disabled={!isEditing}
                    value={formData.height}
                    onChange={(e) =>
                      setFormData({ ...formData, height: e.target.value })
                    }
                    placeholder={isEditing ? "Ví dụ: 170" : "Chưa cập nhật"}
                    className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-hidden transition-all ${
                      !isEditing
                        ? usesLightShell
                          ? "bg-slate-100/85 border-slate-250 text-slate-500 cursor-not-allowed"
                          : "bg-slate-900/50 border-slate-850 text-slate-500 cursor-not-allowed"
                        : usesLightShell
                          ? "bg-white border-slate-300 text-slate-800 focus:border-primary focus:ring-2 focus:ring-[#F27024]/20"
                          : "bg-slate-900 border-slate-800 text-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    }`}
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label
                    className={`block text-xs font-semibold uppercase tracking-wider ${
                      usesLightShell ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    Cân nặng (kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    disabled={!isEditing}
                    value={formData.weight}
                    onChange={(e) =>
                      setFormData({ ...formData, weight: e.target.value })
                    }
                    placeholder={isEditing ? "Ví dụ: 60" : "Chưa cập nhật"}
                    className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-hidden transition-all ${
                      !isEditing
                        ? usesLightShell
                          ? "bg-slate-100/85 border-slate-250 text-slate-500 cursor-not-allowed"
                          : "bg-slate-900/50 border-slate-850 text-slate-500 cursor-not-allowed"
                        : usesLightShell
                          ? "bg-white border-slate-300 text-slate-800 focus:border-primary focus:ring-2 focus:ring-[#F27024]/20"
                          : "bg-slate-900 border-slate-800 text-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/20">
                {!isEditing ? (
                  <>
                    <button
                      key="close-btn"
                      type="button"
                      onClick={() => setIsProfileOpen(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        usesLightShell
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200"
                          : "bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      Đóng
                    </button>
                    <button
                      key="edit-btn"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                      className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                        usesLightShell
                          ? "bg-primary hover:bg-[#e05e1b] text-white shadow-lg shadow-[#F27024]/20"
                          : "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                      }`}
                    >
                      Chỉnh sửa
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      key="cancel-btn"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsEditing(false);
                        if (user) {
                          setFormData({
                            fullName: user.fullName || "",
                            studentId: user.studentId || "",
                            university: user.university || "",
                            githubUsername: user.githubUsername || "",
                            height:
                              user.height !== undefined && user.height !== null
                                ? String(user.height)
                                : "",
                            weight:
                              user.weight !== undefined && user.weight !== null
                                ? String(user.weight)
                                : "",
                          });
                        }
                      }}
                      disabled={isSaving}
                      className="btn-cancel px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      key="submit-btn"
                      type="submit"
                      disabled={isSaving}
                      className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer ${
                        usesLightShell
                          ? "bg-primary hover:bg-[#e05e1b] text-white shadow-lg shadow-[#F27024]/20"
                          : "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                      }`}
                    >
                      {isSaving ? "Đang lưu..." : "Cập nhật"}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);

  const fetchProfile = async (token: string) => {
    try {
      const res = await axios.get("http://localhost:5000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data.user);
      setRoles(res.data.roles || []);
    } catch (err) {
      console.error("Profile fetch failed:", err);
      localStorage.removeItem("token");
      setUser(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  // 1. Single tab detection
  useEffect(() => {
    let tabId = sessionStorage.getItem("tab_id");
    if (!tabId) {
      tabId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem("tab_id", tabId);
    }

    const checkDuplicateTab = () => {
      const activeTabId = localStorage.getItem("active_tab_id");
      const activeTabTimestamp = localStorage.getItem("active_tab_timestamp");
      const now = Date.now();

      if (activeTabId && activeTabId !== tabId && activeTabTimestamp) {
        const timeDiff = now - parseInt(activeTabTimestamp, 10);
        if (timeDiff < 3000) {
          setIsDuplicateTab(true);
          return true;
        }
      }

      localStorage.setItem("active_tab_id", tabId!);
      localStorage.setItem("active_tab_timestamp", now.toString());
      setIsDuplicateTab(false);
      return false;
    };

    const isDup = checkDuplicateTab();

    let heartbeatInterval: any = null;
    if (!isDup) {
      heartbeatInterval = setInterval(() => {
        const activeTabId = localStorage.getItem("active_tab_id");
        if (activeTabId && activeTabId !== tabId) {
          const activeTabTimestamp = localStorage.getItem(
            "active_tab_timestamp",
          );
          if (
            activeTabTimestamp &&
            Date.now() - parseInt(activeTabTimestamp, 10) < 3000
          ) {
            setIsDuplicateTab(true);
            clearInterval(heartbeatInterval);
            return;
          }
        }
        localStorage.setItem("active_tab_id", tabId!);
        localStorage.setItem("active_tab_timestamp", Date.now().toString());
      }, 1000);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "active_tab_timestamp" || e.key === "active_tab_id") {
        const activeTabId = localStorage.getItem("active_tab_id");
        const activeTabTimestamp = localStorage.getItem("active_tab_timestamp");
        const now = Date.now();
        if (activeTabId && activeTabId !== tabId && activeTabTimestamp) {
          if (now - parseInt(activeTabTimestamp, 10) < 3000) {
            setIsDuplicateTab(true);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    const handleUnload = () => {
      const activeTabId = localStorage.getItem("active_tab_id");
      if (activeTabId === tabId) {
        localStorage.removeItem("active_tab_id");
        localStorage.removeItem("active_tab_timestamp");
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  // 2. Fetch profile on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  // 3. Axios Interceptor for Session Expiration & Centralized Error Handling
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // A. Handle Session Expiry (401) or Account Deactivation (403)
        if (
          error.response &&
          error.response.status === 401 &&
          error.response.data?.isSessionExpired
        ) {
          const currentToken = localStorage.getItem("token");
          if ((window as any).isLoggingOut || !currentToken) {
            return Promise.reject(error);
          }
          localStorage.removeItem("token");
          setUser(null);
          setRoles([]);
          window.location.href = "/login?expired=true";
          return Promise.reject(error);
        } else if (
          error.response &&
          error.response.status === 403 &&
          (error.response.data?.isDeactivated ||
            error.response.data?.message?.includes("khóa"))
        ) {
          localStorage.removeItem("token");
          setUser(null);
          setRoles([]);
          window.location.href = "/login?locked=true";
          return Promise.reject(error);
        }

        // B. Centralized Error Message Localization
        // B. Centralized Error Message Localization
        const getFriendlyMessage = () => {
          if (!error.response) {
            return errorMessages.NETWORK_ERROR;
          }
          const statusCode = error.response.status;
          const responseData = error.response.data;

          // Priority 1: Backend detailed message
          if (responseData && typeof responseData.message === "string") {
            return responseData.message;
          }
          // Priority 2: Dictionary lookup by status code
          return errorMessages[statusCode] || errorMessages.DEFAULT_ERROR;
        };

        const friendlyMessage = getFriendlyMessage();

        // Inject friendly message into the error object so all catches benefit automatically
        error.message = friendlyMessage;
        if (error.response && error.response.data) {
          error.response.data.message = friendlyMessage;
        }

        return Promise.reject(error);
      },
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // 4. Periodic API heartbeat when user is logged in
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        await axios.post(
          "http://localhost:5000/api/auth/heartbeat",
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (err) {
        console.error("Session heartbeat failed:", err);
      }
    }, 30000); // Poll once every 30 seconds to reduce traffic and database/Redis workload

    return () => clearInterval(interval);
  }, [user]);

  const handleLoginSuccess = (
    token: string,
    loggedUser: any,
    userRoles: any[],
  ) => {
    sessionStorage.removeItem("login_error_persistent");
    localStorage.setItem("token", token);
    setUser(loggedUser);
    setRoles(userRoles || []);
  };

  const handleLogout = async () => {
    (window as any).isLoggingOut = true;
    sessionStorage.removeItem("login_error_persistent");
    const token = localStorage.getItem("token");
    localStorage.removeItem("token");
    setUser(null);
    setRoles([]);
    if (token) {
      try {
        await axios.post(
          "http://localhost:5000/api/auth/logout",
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (err) {
        console.error("Failed to notify backend of logout:", err);
      }
    }
    (window as any).isLoggingOut = false;
  };

  if (isDuplicateTab) {
    return (
      <div className="min-h-screen bg-[#060a0f] flex items-center justify-center p-4 font-mono text-slate-200">
        <div className="max-w-md w-full glass border border-rose-500/30 p-8 rounded-2xl text-center relative overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-rose-500 to-amber-500 animate-pulse"></div>

          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-bold uppercase tracking-widest text-rose-500 mb-2 font-mono">
            Cảnh báo kết nối
          </h1>
          <p className="text-xs text-rose-300/80 mb-6 uppercase tracking-wider font-semibold">
            Duplicate Session Detected
          </p>

          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl text-left text-xs space-y-3 mb-6 text-slate-400 font-sans leading-relaxed">
            <p>
              Hệ thống phát hiện ứng dụng SEAL Hackathon đang được mở ở một tab
              hoặc cửa sổ khác trên trình duyệt này.
            </p>
            <p className="font-semibold text-slate-300">
              Để tránh xung đột dữ liệu và bảo vệ phiên làm việc của bạn:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Vui lòng đóng các tab khác đang chạy ứng dụng này.</li>
              <li>Tải lại trang (F5) trên tab này để tiếp tục sử dụng.</li>
            </ul>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-sm bg-rose-950/40 border border-rose-500/50 hover:bg-rose-500 hover:text-white transition-all duration-300 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.1)] active:scale-95 text-rose-300"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden font-sans">
        {/* Glow Effects */}
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>

        {/* Spinner & Text */}
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-primary text-sm font-bold tracking-wider uppercase animate-pulse">
            Đang tải Nền tảng SEAL...
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ConformProvider>
        <ConfirmProvider>
          <AppContent
            user={user}
            roles={roles}
            handleLoginSuccess={handleLoginSuccess}
            handleLogout={handleLogout}
            setUser={setUser}
          />
          <Toaster position="top-right" theme="light" closeButton richColors />
        </ConfirmProvider>
      </ConformProvider>
    </BrowserRouter>
  );
}
