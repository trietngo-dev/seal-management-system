import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import {
  CalendarPlus,
  Info,
  Calendar,
  Clock,
  Eye,
  X,
  User,
  Activity,
  ChevronDown,
  Trash2,
  Award,
  Plus,
  ArrowUp,
  ArrowDown,
  Settings,
  Rocket,
  Globe,
  FileText,
  Trophy,
  FolderKanban,
  Users,
  Radio,
  Megaphone,
  Layout,
  ScrollText,
  RotateCcw,
  EyeOff,
} from "lucide-react";
import TeamsTab from "./TeamsTab";
import TracksTab from "./TracksTab";
import RoundsTab from "./RoundsTab";
import SeminarTab from "./SeminarTab";
import OperationsTab from "./OperationsTab";
import GithubTab from "../teams/GithubTab";
import { toast } from "sonner";
import { useConform } from "../shared/ModalConform";
import CustomSelect from "../shared/CustomSelect";
import CustomDateTimePicker from "../shared/CustomDateTimePicker";
import CustomDateRangePicker from "../shared/CustomDateRangePicker";

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

const CATEGORY_GROUPS = [
  {
    id: "setup",
    label: "CẤU HÌNH VÀ THỂ THỨC",
    icon: Settings,
    description: "Cấu hình chung, thời gian, vòng thi & bảng đấu",
    tabs: [
      { id: "events", label: "Thông tin sự kiện", icon: FileText },
      { id: "schedule", label: "Thiết lập thời gian", icon: Clock },
      { id: "rounds", label: "Vòng thi & Tiêu chí", icon: Trophy },
      { id: "tracks", label: "Bảng đấu", icon: FolderKanban },
    ],
  },
  {
    id: "operations",
    label: "VẬN HÀNH VÀ ĐỘI THI",
    icon: Rocket,
    description: "Quản lý đội thi, điều hành live & thông báo",
    tabs: [
      { id: "teams", label: "Đội thi tham gia", icon: Users },
      { id: "operations", label: "Điều hành cuộc thi", icon: Radio, highlight: true },
      { id: "seminar", label: "Seminar & Thông báo", icon: Megaphone },
    ],
  },
  {
    id: "tools",
    label: "CÔNG CỤ VÀ TRUYỀN THÔNG",
    icon: Globe,
    description: "Trang chủ, công cụ AI & Nhật ký hệ thống",
    tabs: [
      { id: "portal", label: "Nội dung hiển thị", icon: Layout },
      { id: "github", label: "GitHub & AI Đánh giá", icon: Github },
      { id: "logs", label: "Nhật ký hoạt động", icon: ScrollText },
    ],
  },
];

interface AdminEventsProps {
  defaultTab?: "events";
}

export default function AdminEvents({
  defaultTab = "events",
}: AdminEventsProps) {
  const { readOnly = false, roles = [], user } = useOutletContext<{ readOnly?: boolean; roles?: any[]; user?: any }>();
  const token = localStorage.getItem("token");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const isAssistant = !(user?.isSystemAdmin || currentUser?.isSystemAdmin) && (user?.isStudentAssistant || currentUser?.isStudentAssistant || roles?.some((r: any) => r.role === "student_assistant"));

  useEffect(() => {
    if (token) {
      axios
        .get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setCurrentUser(res.data.user))
        .catch(() => { });
    }
  }, [token]);

  const [searchParams, setSearchParams] = useSearchParams();
  const conform = useConform();

  const eventIdParam = searchParams.get("eventId");
  const [eventName, setEventName] = useState("");
  const [semester, setSemester] = useState("Spring");
  const [year, setYear] = useState("2026");
  const [desc, setDesc] = useState("");
  const [maxTeams, setMaxTeams] = useState("10");
  const [zaloUrl, setZaloUrl] = useState("");

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const displayedEvents = useMemo(() => {
    return isAssistant
      ? events.filter((e: any) =>
        roles?.some(
          (r: any) =>
            r.role === "student_assistant" &&
            (r.eventId?._id === e._id || r.eventId === e._id),
        ),
      )
      : events;
  }, [isAssistant, events, roles]);

  const [tracks, setTracks] = useState<any[]>([]);
  const [trackName, setTrackName] = useState("");
  const [trackDesc, setTrackDesc] = useState("");
  // null while the confidential brief of the track being edited is still loading
  const [trackAiBrief, setTrackAiBrief] = useState<string | null>("");
  const [trackMax, setTrackMax] = useState("5");
  const [trackRoundId, setTrackRoundId] = useState("");
  const [trackAdvanceTopN, setTrackAdvanceTopN] = useState("3");
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [editingTrack, setEditingTrack] = useState<any>(null);

  const [rounds, setRounds] = useState<any[]>([]);
  const [roundName, setRoundName] = useState("");
  const [roundDeadline, setRoundDeadline] = useState("");

  const [rubricTypeOption, setRubricTypeOption] = useState<"new" | "existing">(
    "new",
  );
  const [existingRubrics, setExistingRubrics] = useState<any[]>([]);
  const [selectedSourceRubricId, setSelectedSourceRubricId] = useState("");

  const [rubricName, setRubricName] = useState("");
  const [rubric, setRubric] = useState<any>(null);
  const [criteria, setCriteria] = useState<any[]>([]);

  const [critCode, setCritCode] = useState("");
  const [critName, setCritName] = useState("");
  const [critWeight, setCritWeight] = useState("20");
  const [critDesc, setCritDesc] = useState("");

  const [eventRoles, setEventRoles] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const setMessage = (msg: { type: string; text: string }) => {
    if (msg.text) {
      if (msg.type === "success") {
        toast.success(msg.text);
      } else if (msg.type === "error") {
        toast.error(msg.text);
      }
    }
  };

  // Tab management state
  const [activeTab, setActiveTabState] = useState<
    | "admin"
    | "events"
    | "teams"
    | "rounds"
    | "tracks"
    | "github"
    | "logs"
    | "schedule"
    | "portal"
    | "seminar"
    | "operations"
  >(() => (sessionStorage.getItem("activeTab") as any) || defaultTab);

  const setActiveTab = (
    tab:
      | "admin"
      | "events"
      | "teams"
      | "rounds"
      | "tracks"
      | "github"
      | "logs"
      | "schedule"
      | "portal"
      | "seminar"
      | "operations",
  ) => {
    setActiveTabState(tab);
    sessionStorage.setItem("activeTab", tab);
  };

  const currentGroup = useMemo(() => {
    return (
      CATEGORY_GROUPS.find((group) =>
        group.tabs.some((tab) => tab.id === activeTab),
      ) || CATEGORY_GROUPS[0]
    );
  }, [activeTab]);

  useEffect(() => {
    if (isAssistant && activeTab !== "teams") {
      setActiveTab("teams");
    }
  }, [isAssistant, activeTab]);

  const [eventLogs, setEventLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isEditingEventTitle, setIsEditingEventTitle] = useState(false);
  const eventTitleRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!isEditingEventTitle) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        eventTitleRef.current &&
        !eventTitleRef.current.contains(e.target as Node)
      ) {
        setIsEditingEventTitle(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditingEventTitle]);
  const socketRef = React.useRef<Socket | null>(null);
  // True between starting the create wizard and the eventId URL param being cleared;
  // router updates can land a render later, so the URL-sync effect must wait for it.
  const pendingCreationRef = React.useRef(false);
  // Sidebar collapse state (for premium slide effect)
  // const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Edit Event States
  const [editEventName, setEditEventName] = useState("");
  const [editEventSemester, setEditEventSemester] = useState("Spring");
  const [editEventYear, setEditEventYear] = useState("2026");
  const [editEventDesc, setEditEventDesc] = useState("");
  const [editEventMaxTeams, setEditEventMaxTeams] = useState("10");
  const [editEventGithubOrgName, setEditEventGithubOrgName] = useState("");
  const [editEventRegOpen, setEditEventRegOpen] = useState("");
  const [editEventRegClose, setEditEventRegClose] = useState("");
  const [editEventContestStart, setEditEventContestStart] = useState("");
  const [editEventContestEnd, setEditEventContestEnd] = useState("");
  const [editCommitSyncInterval, setEditCommitSyncInterval] = useState("30");

  // Round Schedule States
  const [selectedRoundForSchedule, setSelectedRoundForSchedule] =
    useState<any>(null);

  // Portal Content States
  const [editMainGoal, setEditMainGoal] = useState("");
  const [editDurationText, setEditDurationText] = useState("");
  const [editMemberLimitText, setEditMemberLimitText] = useState("");
  const [editPrizePoolText, setEditPrizePoolText] = useState("");
  const [editZaloUrl, setEditZaloUrl] = useState("");
  const [editPhase1Description, setEditPhase1Description] = useState("");
  const [editPhase2Description, setEditPhase2Description] = useState("");
  const [editPhase3Description, setEditPhase3Description] = useState("");
  const [editLocationAnnouncement, setEditLocationAnnouncement] = useState("");
  const [editRules, setEditRules] = useState<any[]>([]);
  const [editCustomTimeline, setEditCustomTimeline] = useState<any[]>([]);
  const [editPrizes, setEditPrizes] = useState<any[]>([]);
  const [editSpecialPrizes, setEditSpecialPrizes] = useState<any[]>([]);
  const [portalSubTab, setPortalSubTab] = useState<
    "candidate" | "timeline" | "prizes" | "announcement" | null
  >(null);
  const [newMilestoneTime, setNewMilestoneTime] = useState("");
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");

  // Track Schedule States
  const [_selectedTrackForSchedule, _setSelectedTrackForSchedule] =
    useState<any>(null);
  const [trackStartTime, setTrackStartTime] = useState("");
  const [trackEndTime, setTrackEndTime] = useState("");
  const [trackGradingEndTime, setTrackGradingEndTime] = useState("");

  // Creation Wizard States
  const [isWizardMode, setIsWizardModeState] = useState(
    () => sessionStorage.getItem("isWizardMode") === "true",
  );
  const [_wizardStep, setWizardStepState] = useState(() =>
    parseInt(sessionStorage.getItem("wizardStep") || "1"),
  );

  const setIsWizardMode = (val: boolean) => {
    setIsWizardModeState(val);
    if (val) {
      sessionStorage.setItem("isWizardMode", "true");
    } else {
      sessionStorage.removeItem("isWizardMode");
      sessionStorage.removeItem("wizardStep");
    }
  };

  const setWizardStep = (val: number | ((prev: number) => number)) => {
    setWizardStepState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      sessionStorage.setItem("wizardStep", String(next));
      return next;
    });
  };

  // Rubric Edit Form States
  const [selectedRubricRoundId, setSelectedRubricRoundId] = useState("");
  // Rubric scope inside the selected round: "" = round-wide rubric, otherwise a track id
  const [selectedRubricTrackId, setSelectedRubricTrackId] = useState("");
  const [editingRubric, setEditingRubric] = useState(false);
  const [editRubricName, setEditRubricName] = useState("");
  const [editRubricDesc, setEditRubricDesc] = useState("");
  const [editRubricTotalWeight, setEditRubricTotalWeight] = useState("100");
  const [editRubricMaxScore, setEditRubricMaxScore] = useState("10");
  const [editRubricIsActive, setEditRubricIsActive] = useState(true);

  // Criterion States (Advanced)
  const [critMaxScore, setCritMaxScore] = useState("10");
  const [critOrder, setCritOrder] = useState("1");
  const [critGradingLevels, setCritGradingLevels] = useState<any[]>([]);
  const [editingCriterion, setEditingCriterion] = useState<any>(null);

  // Grading Level Form States
  const [levelLabel, setLevelLabel] = useState("");
  const [levelMinScore, setLevelMinScore] = useState("");
  const [levelMaxScore, setLevelMaxScore] = useState("");
  const [levelDesc, setLevelDesc] = useState("");

  // GitHub integration states
  const [githubOrgName, setGithubOrgName] = useState("sealhackathon-2026");
  const [repos, setRepos] = useState<any[]>([]);

  const formatForDateTimeLocal = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const populateEventSchedule = (eventObj: any) => {
    setEditEventRegOpen(formatForDateTimeLocal(eventObj.registrationOpen));
    setEditEventRegClose(formatForDateTimeLocal(eventObj.registrationClose));
    setEditEventContestStart(formatForDateTimeLocal(eventObj.contestStart));
    setEditEventContestEnd(formatForDateTimeLocal(eventObj.contestEnd));
    setEditCommitSyncInterval(String(eventObj.commitSyncInterval || 30));
  };

  const handleSelectRoundForSchedule = (roundObj: any) => {
    setSelectedRoundForSchedule(roundObj);
    if (roundObj) {
      setTrackStartTime(formatForDateTimeLocal(roundObj.startTime));
      setTrackEndTime(formatForDateTimeLocal(roundObj.endTime));
      setTrackGradingEndTime(formatForDateTimeLocal(roundObj.gradingEndTime));
    } else {
      setTrackStartTime("");
      setTrackEndTime("");
      setTrackGradingEndTime("");
    }
  };

  const handleSaveEventSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    const regOpen = editEventRegOpen ? new Date(editEventRegOpen) : null;
    const regClose = editEventRegClose ? new Date(editEventRegClose) : null;
    const contestStart = editEventContestStart
      ? new Date(editEventContestStart)
      : null;
    const contestEnd = editEventContestEnd
      ? new Date(editEventContestEnd)
      : null;

    if (regOpen && regClose && regOpen > regClose) {
      toast.error("Thời gian mở đăng ký không thể sau thời gian đóng đăng ký!");
      return;
    }
    if (regClose && contestStart && regClose > contestStart) {
      toast.error(
        "Thời gian đóng đăng ký phải diễn ra trước khi thời gian thi đấu bắt đầu!",
      );
      return;
    }
    if (contestStart && contestEnd && contestStart > contestEnd) {
      toast.error(
        "Thời gian bắt đầu thi đấu không thể sau thời gian kết thúc cuộc thi!",
      );
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          registrationOpen: editEventRegOpen
            ? new Date(editEventRegOpen).toISOString()
            : null,
          registrationClose: editEventRegClose
            ? new Date(editEventRegClose).toISOString()
            : null,
          contestStart: editEventContestStart
            ? new Date(editEventContestStart).toISOString()
            : null,
          contestEnd: editEventContestEnd
            ? new Date(editEventContestEnd).toISOString()
            : null,
          commitSyncInterval: parseInt(editCommitSyncInterval) || 30,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setSelectedEvent(res.data.event);
      toast.success("Đã cập nhật lịch trình sự kiện thành công!");
      setMessage({
        type: "success",
        text: "Đã cập nhật lịch trình sự kiện thành công!",
      });
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Lỗi khi cập nhật lịch trình sự kiện.",
      );
      setMessage({
        type: "error",
        text:
          err.response?.data?.message || "Lỗi khi cập nhật lịch trình sự kiện.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoundSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !selectedRoundForSchedule) return;

    const eventStart = editEventContestStart
      ? new Date(editEventContestStart)
      : null;
    const eventEnd = editEventContestEnd ? new Date(editEventContestEnd) : null;

    if (!eventStart || !eventEnd) {
      toast.error("Vui lòng cấu hình thời gian thi đấu của cuộc thi trước!");
      return;
    }

    const rStart = trackStartTime ? new Date(trackStartTime) : null;
    const rEnd = trackEndTime ? new Date(trackEndTime) : null;
    const rGrading = trackGradingEndTime ? new Date(trackGradingEndTime) : null;

    if (rStart && rEnd && rStart > rEnd) {
      toast.error("Thời gian bắt đầu làm bài không thể sau hạn nộp bài!");
      return;
    }
    if (rStart && rStart < eventStart) {
      toast.error(
        "Thời gian bắt đầu làm bài của vòng thi không thể trước thời gian bắt đầu thi đấu của cuộc thi!",
      );
      return;
    }
    if (rEnd && rEnd > eventEnd) {
      toast.error(
        "Hạn nộp bài của vòng thi không thể sau thời gian kết thúc cuộc thi!",
      );
      return;
    }
    if (rEnd && rGrading && rEnd >= rGrading) {
      toast.error(
        "Hạn nộp bài của vòng thi phải diễn ra trước thời gian kết thúc chấm bài!",
      );
      return;
    }
    if (rGrading && eventEnd && rGrading > eventEnd) {
      toast.error(
        "Thời gian chấm bài kết thúc không thể sau thời gian kết thúc cuộc thi!",
      );
      return;
    }

    const roundTracks = tracks.filter(
      (t: any) => t.roundId === selectedRoundForSchedule._id,
    );
    if (roundTracks.length === 0) {
      toast.error(
        "Vòng thi này chưa có bảng đấu nào. Vui lòng tạo bảng đấu trước khi lưu lịch trình!",
      );
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}/rounds/${selectedRoundForSchedule._id}`,
        {
          startTime: trackStartTime
            ? new Date(trackStartTime).toISOString()
            : null,
          endTime: trackEndTime ? new Date(trackEndTime).toISOString() : null,
          gradingEndTime: trackGradingEndTime
            ? new Date(trackGradingEndTime).toISOString()
            : null,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setRounds((prev) =>
        prev.map((r: any) => (r._id === res.data._id ? res.data : r)),
      );
      setSelectedRoundForSchedule(res.data);

      // Refresh tracks (mirrored schedule on backend)
      const detailsRes = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
      );
      setTracks(detailsRes.data.tracks || []);

      toast.success("Đã cập nhật lịch trình vòng thi thành công!");
      setMessage({
        type: "success",
        text: "Đã cập nhật lịch trình vòng thi thành công!",
      });
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Lỗi khi cập nhật lịch trình vòng thi.",
      );
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Lỗi khi cập nhật lịch trình vòng thi.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoundSchedule = async () => {
    if (!selectedEvent || !selectedRoundForSchedule) return;

    const confirmed = await conform({
      title: "Xác nhận xóa",
      message: `Bạn có chắc chắn muốn xóa toàn bộ cài đặt thời gian cho vòng thi "${selectedRoundForSchedule.name}"?`,
      conformText: "Xóa",
      cancelText: "Hủy",
      variant: "danger",
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}/rounds/${selectedRoundForSchedule._id}`,
        {
          startTime: null,
          endTime: null,
          gradingEndTime: null,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setRounds((prev) =>
        prev.map((r: any) => (r._id === res.data._id ? res.data : r)),
      );
      setSelectedRoundForSchedule(res.data);
      setTrackStartTime("");
      setTrackEndTime("");
      setTrackGradingEndTime("");

      // Refresh tracks (mirrored schedule on backend)
      const detailsRes = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
      );
      setTracks(detailsRes.data.tracks || []);

      toast.success("Đã xóa cài đặt thời gian vòng thi thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
        "Lỗi khi xóa cài đặt thời gian vòng thi.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchExistingRubrics();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventDetails();
    }
  }, [selectedEvent?._id]);

  useEffect(() => {
    if (!sessionStorage.getItem("activeTab")) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (activeTab === "logs" && selectedEvent) {
      fetchEventLogs();
      if (token) {
        const socketUrl =
          import.meta.env.VITE_API_URL ||
          (window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1"
            ? window.location.origin
            : "http://localhost:5000");
        const sock = io(socketUrl, { auth: { token } });
        socketRef.current = sock;
        sock.on("new_event_log", (newLog: any) => {
          if (newLog.eventId === selectedEvent._id) {
            setEventLogs((prev) => [newLog, ...prev]);
          }
        });
        return () => {
          sock.disconnect();
          socketRef.current = null;
        };
      }
    }
  }, [activeTab, selectedEvent?._id, token]);

  useEffect(() => {
    if (eventIdParam) {
      if (pendingCreationRef.current) return;
      const creatingId = sessionStorage.getItem("creatingEventId");
      if (!creatingId || eventIdParam !== creatingId) {
        setIsWizardMode(false);
      }
      const foundEvent = displayedEvents.find((e) => e._id === eventIdParam);
      if (foundEvent && selectedEvent?._id !== foundEvent._id) {
        handleSelectEvent(foundEvent);
      }
    } else if (pendingCreationRef.current) {
      pendingCreationRef.current = false;
    } else if (!isWizardMode && displayedEvents.length > 0 && !selectedEvent) {
      const savedEventId = sessionStorage.getItem("lastSelectedEventId") || localStorage.getItem("lastSelectedEventId");
      const foundSaved = savedEventId ? displayedEvents.find((e) => e._id === savedEventId) : null;
      const defaultEvent = foundSaved || displayedEvents[0];
      handleSelectEvent(defaultEvent);
    }
  }, [eventIdParam, displayedEvents, isWizardMode]);

  const fetchSyncProgress = async () => {
    if (!selectedEvent) return false;
    const token = localStorage.getItem("token");
    const reposToSync = teamsList
      .filter((t) => t.repository)
      .map((t) => t.repository._id);

    if (reposToSync.length === 0) return false;

    try {
      const res = await axios.get(
        `http://localhost:5000/api/github-repositories/sync-progress?eventId=${selectedEvent._id}&repositoryIds=${reposToSync.join(",")}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setSyncProgress(res.data);
      return res.data.active;
    } catch (err) {
      console.error("Lỗi lấy tiến trình đồng bộ:", err);
      return false;
    }
  };

  // Check sync progress on selectedEvent change
  useEffect(() => {
    if (selectedEvent) {
      fetchSyncProgress();
    }
  }, [selectedEvent?._id]);

  // Poll sync progress if active
  useEffect(() => {
    let intervalId: any = null;
    if (syncProgress?.active) {
      setSyncingAll(true);
      intervalId = setInterval(async () => {
        const isActive = await fetchSyncProgress();
        if (!isActive) {
          clearInterval(intervalId);
          setSyncingAll(false);
          toast.success("Quá trình đồng bộ tất cả repository đã hoàn thành!");
          fetchEventDetails();
        }
      }, 3000); // check every 3 seconds
    } else {
      setSyncingAll(false);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncProgress?.active]);

  useEffect(() => {
    const createParam = searchParams.get("create");
    if (createParam === "true" && currentUser?.isSystemAdmin) {
      startEventCreation();
    }
  }, [searchParams, setSearchParams, currentUser]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/events");
      setEvents(res.data);
    } catch (err) {
      console.error("Lỗi lấy danh sách sự kiện:", err);
    }
  };

  const fetchExistingRubrics = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/rubrics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExistingRubrics(res.data);
    } catch (err) {
      console.error("Lỗi lấy danh sách rubric cũ:", err);
    }
  };

  const fetchRepositories = async (eventId: string) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/github-repositories?eventId=${eventId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setRepos(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEventDetails = async () => {
    if (!selectedEvent) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
      );
      setTracks(res.data.tracks || []);
      const fetchedRounds = res.data.rounds || [];
      setRounds(fetchedRounds);

      if (res.data.tracks && res.data.tracks.length > 0) {
        if (selectedTrack) {
          const updatedTrack = res.data.tracks.find(
            (t: any) => t._id === selectedTrack._id,
          );
          if (updatedTrack) {
            setSelectedTrack(updatedTrack);
          }
        } else {
          setSelectedTrack(res.data.tracks[0]);
        }
      }

      if (res.data.event) {
        populateEventSchedule(res.data.event);
        setSelectedEvent(res.data.event);
      }

      if (res.data.rounds && res.data.rounds.length > 0) {
        if (selectedRoundForSchedule) {
          const updatedRound = res.data.rounds.find(
            (r: any) => r._id === selectedRoundForSchedule._id,
          );
          if (updatedRound) {
            setSelectedRoundForSchedule(updatedRound);
          }
        } else {
          handleSelectRoundForSchedule(res.data.rounds[0]);
        }
      }

      fetchEventRoles();
      fetchTeamsList();
      fetchRepositories(selectedEvent._id);
      fetchEventLogs();
    } catch (err) {
      console.error("Lỗi fetch chi tiết sự kiện:", err);
    }
  };

  const fetchEventLogs = async () => {
    if (!selectedEvent) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}/logs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setEventLogs(res.data || []);
    } catch (err) {
      console.error("Lỗi lấy nhật ký sự kiện:", err);
    }
  };

  const fetchEventRoles = async () => {
    if (!selectedEvent) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}/roles`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setEventRoles(res.data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách quyền thành viên:", err);
    }
  };

  const fetchTeamsList = async () => {
    if (!selectedEvent) return;
    try {
      console.log(`[CLIENT] fetchTeamsList triggered for eventId: ${selectedEvent._id}`);
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(
        `${apiBase}/api/teams/all/${selectedEvent._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      console.log(`[CLIENT] fetchTeamsList success. Fetched ${res.data?.length} teams.`);
      setTeamsList(res.data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách đội thi:", err);
    }
  };

  const handleSyncRepo = async (repoId: string) => {
    const token = localStorage.getItem("token");
    setSyncingRepoId(repoId);
    try {
      const res = await axios.post(
        `http://localhost:5000/api/github-repositories/${repoId}/sync`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(res.data.message || "Đồng bộ và phân tích AI thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi đồng bộ repository.");
    } finally {
      setSyncingRepoId(null);
    }
  };

  const handleSyncAllRepos = async () => {
    const reposToSync = teamsList
      .filter((t) => t.repository)
      .map((t) => t.repository._id);

    if (reposToSync.length === 0) {
      toast.error("Không có repository nào của đội thi hiện tại để đồng bộ.");
      return;
    }

    const conformed = await conform({
      title: "Đồng bộ tất cả Repository",
      message: `Bạn có chắc chắn muốn kích hoạt đồng bộ và phân tích AI cho ${reposToSync.length} repository của các đội thi hiện tại? Quá trình này sẽ chạy ngầm và mất vài phút để tránh quá tải API.`,
    });
    if (!conformed) return;

    const token = localStorage.getItem("token");
    setSyncingAll(true);

    // Set initial sync progress immediately to show progress bar instantly
    setSyncProgress({
      total: reposToSync.length,
      completed: 0,
      syncing: 0,
      queued: reposToSync.length,
      active: true,
    });

    try {
      const res = await axios.post(
        `http://localhost:5000/api/github-repositories/sync-all?eventId=${selectedEvent._id}`,
        { repositoryIds: reposToSync },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(
        res.data.message ||
        "Đã kích hoạt đồng bộ toàn bộ repository thành công!",
      );
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Lỗi khi đồng bộ toàn bộ repository.",
      );
      setSyncProgress(null);
      setSyncingAll(false);
    }
  };

  const handleDistributeTeams = async () => {
    if (!selectedEvent) return;
    if (tracks.length === 0) {
      setMessage({
        type: "error",
        text: "Vui lòng khởi tạo ít nhất một bảng đấu (Track) trước.",
      });
      return;
    }

    const unassignedTeams = teamsList.filter(
      (t) => t.status === "confirmed" && !t.trackId,
    );
    if (unassignedTeams.length === 0) {
      setMessage({
        type: "error",
        text: "Không tìm thấy đội thi đã xác nhận nào chưa được chia bảng đấu.",
      });
      return;
    }

    const conformed = await conform({
      title: "Phân chia bảng đấu ngẫu nhiên",
      message: `Bạn có chắc chắn muốn phân chia ngẫu nhiên ${unassignedTeams.length} đội thi vào ${tracks.length} bảng đấu? Hệ thống sẽ tự động tạo repository GitHub cho các đội.`,
    });
    if (!conformed) {
      return;
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:5000/api/events/${selectedEvent._id}/distribute-teams`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: res.data.message || "Phân chia bảng đấu ngẫu nhiên thành công!",
      });
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message || "Lỗi khi chia bảng đấu ngẫu nhiên.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTrack = async (teamId: string, trackId: string) => {
    if (!selectedEvent) return;
    if (trackId === "random" && tracks.length === 0) {
      setMessage({
        type: "error",
        text: "Vui lòng khởi tạo ít nhất một bảng đấu (Track) trước.",
      });
      return;
    }

    if (trackId === "random") {
      const conformed = await conform({
        title: "Phân chia bảng đấu ngẫu nhiên",
        message: "Bạn có chắc muốn phân bảng đấu ngẫu nhiên cho đội thi này?",
      });
      if (!conformed) {
        return;
      }
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/teams/${teamId}/assign-track`,
        { trackId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: res.data.message || "Phân bảng đấu thành công!",
      });
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi phân bảng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKickAllCollaborators = async (repoId: string) => {
    const conformed = await conform({
      title: "Xác nhận thu hồi quyền",
      message:
        "Bạn có chắc chắn muốn thu hồi quyền truy cập (gỡ cộng tác viên) của toàn bộ thành viên nhóm và mentor khỏi repository này không?",
    });
    if (!conformed) return;
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await axios.post(
        `http://localhost:5000/api/github-repositories/${repoId}/kick-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setMessage({
        type: "success",
        text: res.data.message || "Thu hồi quyền thành công!",
      });
      if (selectedEvent) {
        fetchRepositories(selectedEvent._id);
      }
    } catch (err: any) {
      console.error("Kick all collaborators error:", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Lỗi khi thu hồi quyền truy cập repository.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Enter the create-event wizard. The eventId URL param must be cleared too, otherwise the
  // URL-sync effect re-selects that event and immediately closes the wizard.
  const startEventCreation = () => {
    if (searchParams.get("eventId")) pendingCreationRef.current = true;
    sessionStorage.removeItem("creatingEventId");
    setSelectedEvent(null);
    setIsWizardMode(true);
    setWizardStep(1);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("eventId");
        updated.delete("create");
        return updated;
      },
      { replace: true }
    );
  };

  const handleSelectEvent = (eventObj: any) => {
    if (!eventObj) return;
    sessionStorage.removeItem("creatingEventId");
    setIsWizardMode(false);
    setSelectedEvent(eventObj);
    if (eventObj._id) {
      sessionStorage.setItem("lastSelectedEventId", eventObj._id);
      localStorage.setItem("lastSelectedEventId", eventObj._id);
      if (searchParams.get("eventId") !== eventObj._id) {
        setSearchParams(
          (prev) => {
            const updated = new URLSearchParams(prev);
            updated.set("eventId", eventObj._id);
            return updated;
          },
          { replace: true }
        );
      }
    }
    setSelectedTrack(null);

    setRubric(null);
    setCriteria([]);
    setMessage({ type: "", text: "" });

    // Restore temporary draft edits for this event if present
    const savedDraftStr = eventObj._id ? sessionStorage.getItem(`event_draft_${eventObj._id}`) : null;
    let draft: any = null;
    if (savedDraftStr) {
      try {
        draft = JSON.parse(savedDraftStr);
      } catch (e) {
        console.error("Error parsing event draft", e);
      }
    }

    setEditEventName(draft?.editEventName !== undefined ? draft.editEventName : (eventObj.name || ""));
    setEditEventSemester(draft?.editEventSemester !== undefined ? draft.editEventSemester : (eventObj.semester || "Spring"));
    setEditEventYear(draft?.editEventYear !== undefined ? draft.editEventYear : String(eventObj.year || 2026));
    setEditEventDesc(draft?.editEventDesc !== undefined ? draft.editEventDesc : (eventObj.description || ""));
    setEditEventMaxTeams(draft?.editEventMaxTeams !== undefined ? draft.editEventMaxTeams : String(eventObj.maxTeams || 10));
    setEditEventGithubOrgName(draft?.editEventGithubOrgName !== undefined ? draft.editEventGithubOrgName : (eventObj.githubOrgName || ""));

    if (draft?.editEventRegOpen !== undefined || draft?.editEventRegClose !== undefined || draft?.editEventContestStart !== undefined || draft?.editEventContestEnd !== undefined) {
      setEditEventRegOpen(draft.editEventRegOpen || "");
      setEditEventRegClose(draft.editEventRegClose || "");
      setEditEventContestStart(draft.editEventContestStart || "");
      setEditEventContestEnd(draft.editEventContestEnd || "");
    } else {
      populateEventSchedule(eventObj);
    }

    setEditMainGoal(
      draft?.editMainGoal !== undefined ? draft.editMainGoal : (eventObj.mainGoal || "Phát triển các giải pháp sáng tạo để giải quyết bài toán thực tế và xây dựng hệ thống phần mềm chất lượng. Các đội thi cần tối ưu mã nguồn, liên kết repository và tối ưu hóa hệ thống dưới sự hỗ trợ của AI.")
    );
    setEditDurationText(draft?.editDurationText !== undefined ? draft.editDurationText : (eventObj.durationText || "48 GIỜ"));
    setEditMemberLimitText(draft?.editMemberLimitText !== undefined ? draft.editMemberLimitText : (eventObj.memberLimitText || "2-4 OPERATORS"));
    setEditPrizePoolText(draft?.editPrizePoolText !== undefined ? draft.editPrizePoolText : (eventObj.prizePoolText || "$50,000 USD"));
    setEditZaloUrl(draft?.editZaloUrl !== undefined ? draft.editZaloUrl : (eventObj.zaloUrl || ""));
    setEditPhase1Description(
      draft?.editPhase1Description !== undefined ? draft.editPhase1Description : (eventObj.phase1Description || "Các đội thi thực hiện đăng ký tài khoản, liên kết thành viên nhóm và liên kết repository Github chính thức để chuẩn bị nhận nhiệm vụ.")
    );
    setEditPhase2Description(
      draft?.editPhase2Description !== undefined ? draft.editPhase2Description : (eventObj.phase2Description || "Giai đoạn lập trình cường độ cao. Các đội thực hiện giải quyết yêu cầu dự án, liên tục push commit để AI tự động phân tích và đánh giá chất lượng mã nguồn.")
    );
    setEditPhase3Description(
      draft?.editPhase3Description !== undefined ? draft.editPhase3Description : (eventObj.phase3Description || "Dừng cổng nộp bài, đóng repository. Các đội thi chuẩn bị báo cáo dự án trước hội đồng giám khảo và nhận kết quả xếp hạng chung cuộc từ hệ thống.")
    );
    const defaultAnnouncement = `THÔNG BÁO KHU VỰC VÒNG SƠ LOẠI:.

- Track A: Seminar 1 Thư viện.

- Track B: Tầng G Thư viện.

- Track C: LB24 tầng 2 Thư viện.`;
    setEditLocationAnnouncement(
      draft?.editLocationAnnouncement !== undefined
        ? draft.editLocationAnnouncement
        : (eventObj.locationAnnouncement !== undefined
            ? eventObj.locationAnnouncement
            : defaultAnnouncement)
    );
    setEditRules(
      eventObj.rules || [
        {
          title: "Mã nguồn tự viết",
          description:
            "Tất cả các dòng code chính và sản phẩm phải được viết trong thời gian diễn ra cuộc thi. Các thư viện và framework có sẵn được phép sử dụng nếu là mã nguồn mở.",
        },
        {
          title: "Giới hạn đội thi",
          description:
            "Mỗi đội phải có từ 2 đến 4 thành viên. Không cho phép tham gia cá nhân hoặc đội thi có số lượng vượt mức quy định.",
        },
        {
          title: "Ranh giới Đạo đức",
          description:
            "Bất kỳ hành vi gian lận hoặc tấn công phá hoại hạ tầng bên ngoài phạm vi quy định sẽ dẫn đến việc truất quyền thi đấu ngay lập tức.",
        },
      ],
    );
    setEditCustomTimeline(eventObj.customTimeline || []);
    setEditPrizes(
      eventObj.prizes && eventObj.prizes.length > 0
        ? eventObj.prizes
        : [
          { title: "01 GIẢI NHẤT", amount: "7.000.000 đồng", benefits: "Giấy chứng nhận + hoa" },
          { title: "01 GIẢI NHÌ", amount: "5.000.000 đồng", benefits: "Giấy chứng nhận + hoa" },
          { title: "01 GIẢI BA", amount: "3.000.000 đồng", benefits: "Giấy chứng nhận + hoa" },
          { title: "01 GIẢI KHUYẾN KHÍCH", amount: "1.500.000 đồng", benefits: "Giấy chứng nhận" },
        ]
    );
    setEditSpecialPrizes(
      eventObj.specialPrizes && eventObj.specialPrizes.length > 0
        ? eventObj.specialPrizes
        : [
          { title: "HẠNG MỤC ĐẶC BIỆT", description: "Vinh danh dành cho thí sinh đồng hành trọn vẹn 3 mùa giải (Fall 2025, Spring 2026, Summer 2026)." },
          { title: "GIẤY CHỨNG NHẬN", description: "Tất cả các thí sinh tham gia cuộc thi đều nhận giấy chứng nhận." },
        ]
    );

    // If we are currently on the 'events' tab/route, sync URL
    if (defaultTab === "events") {
      setSearchParams({ eventId: eventObj._id });
    }

    // Fetch roles immediately when choosing existing event
    axios
      .get(`http://localhost:5000/api/events/${eventObj._id}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setEventRoles(res.data || []))
      .catch(console.error);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/events",
        {
          name: eventName,
          semester,
          year: parseInt(year),
          description: desc,
          maxTeams: parseInt(maxTeams),
          githubOrgName,
          zaloUrl,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const newEvent = res.data.event;
      sessionStorage.setItem("creatingEventId", newEvent._id);
      setSelectedEvent(newEvent);
      setEditEventName(newEvent.name || "");
      setEditEventSemester(newEvent.semester || "Spring");
      setEditEventYear(String(newEvent.year || 2026));
      setEditEventDesc(newEvent.description || "");
      setEditEventMaxTeams(String(newEvent.maxTeams || 10));
      setEditEventGithubOrgName(newEvent.githubOrgName || "");
      setEditZaloUrl(newEvent.zaloUrl || "");
      setZaloUrl("");
      populateEventSchedule(newEvent);
      setSearchParams({ eventId: newEvent._id });
      setTracks([]);
      setRounds([]);
      setSelectedTrack(null);

      setEventName("");
      setDesc("");
      setGithubOrgName("sealhackathon-2026");
      setMessage({
        type: "success",
        text: "Khởi tạo Cuộc thi thành công! Chi tiết cuộc thi hiển thị bên dưới.",
      });

      fetchEvents();
      setIsWizardMode(true);
      setWizardStep(2);
      setActiveTab("rounds");
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi tạo cuộc thi.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          name: editEventName,
          semester: editEventSemester,
          year: parseInt(editEventYear),
          description: editEventDesc,
          maxTeams: parseInt(editEventMaxTeams),
          githubOrgName: editEventGithubOrgName,
          zaloUrl: editZaloUrl,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({ type: "success", text: "Cập nhật sự kiện thành công!" });
      setSelectedEvent(res.data.event);
      fetchEvents();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi cập nhật sự kiện.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEventStatus = async (
    newStatus: string,
    isForce: boolean = false,
  ) => {
    if (!selectedEvent) return;
    const forceFlag = isForce || !!currentUser?.isSystemAdmin;
    if (
      !forceFlag &&
      newStatus !== "cancelled" &&
      newStatus !== selectedEvent.status
    ) {
      toast.error(
        "Trạng thái cuộc thi được tự động chuyển đổi theo thời gian. Bạn chỉ có thể chuyển thủ công sang Hủy (Cancelled)!",
      );
      return;
    }
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        { status: newStatus, isForceOverride: forceFlag },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: forceFlag
          ? "Ép chuyển trạng thái cuộc thi thành công!"
          : "Cập nhật trạng thái cuộc thi thành công!",
      });
      setSelectedEvent(res.data.event);
      fetchEvents();
    } catch (err: any) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Lỗi khi cập nhật trạng thái cuộc thi.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    const conformed = await conform({
      title: "Xác nhận xóa cuộc thi",
      message: `Bạn có chắc chắn muốn xóa cuộc thi "${selectedEvent.name}"? Tất cả dữ liệu vòng thi, tiêu chí và đội thi sẽ bị xóa vĩnh viễn!`,
    });
    if (!conformed) return;
    try {
      await axios.delete(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("Đã xóa cuộc thi thành công!");
      setSelectedEvent(null);
      fetchEvents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi xóa cuộc thi.");
    }
  };

  const handleDeleteRound = async (roundId: string) => {
    if (!selectedEvent || !roundId) return;
    const conformed = await conform({
      title: "Xác nhận xóa vòng thi",
      message:
        "Bạn có chắc chắn muốn xóa vòng thi này? Các tiêu chí và rubric thuộc vòng thi sẽ bị xóa!",
    });
    if (!conformed) return;
    try {
      await axios.delete(
        `http://localhost:5000/api/events/${selectedEvent._id}/rounds/${roundId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("Đã xóa vòng thi thành công!");
      fetchEventDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi xóa vòng thi.");
    }
  };

  const handleUpdateRound = async (roundId: string, updatedData: any) => {
    if (!selectedEvent || !roundId) return;
    try {
      await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}/rounds/${roundId}`,
        updatedData,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("Cập nhật thông tin vòng thi thành công!");
      fetchEventDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật vòng thi.");
    }
  };

  const handleSavePortalContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    // Validate rules
    if (editRules.length === 0) {
      toast.error("Phải có ít nhất 1 quy định cuộc thi.");
      return;
    }
    const invalidRule = editRules.find(
      (r) => !r.title?.trim() || !r.description?.trim(),
    );
    if (invalidRule) {
      toast.error("Mỗi quy định phải có đầy đủ Tiêu đề và Chi tiết.");
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          mainGoal: editMainGoal,
          durationText: editDurationText,
          memberLimitText: editMemberLimitText,
          prizePoolText: editPrizePoolText,
          zaloUrl: editZaloUrl,
          phase1Description: editPhase1Description,
          phase2Description: editPhase2Description,
          phase3Description: editPhase3Description,
          locationAnnouncement: editLocationAnnouncement,
          rules: editRules,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setSelectedEvent(res.data.event);
      toast.success("Đã cập nhật nội dung Guest Portal thành công!");
      setMessage({
        type: "success",
        text: "Đã cập nhật nội dung Guest Portal thành công!",
      });
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
        "Lỗi khi cập nhật nội dung Guest Portal.",
      );
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Lỗi khi cập nhật nội dung Guest Portal.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAnnouncement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedEvent) return;

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          locationAnnouncement: editLocationAnnouncement,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setSelectedEvent(res.data.event);
      toast.success("Đã cập nhật thông báo Khu vực đội thi thành công!");
      setMessage({
        type: "success",
        text: "Đã cập nhật thông báo Khu vực đội thi thành công!",
      });
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
        "Lỗi khi cập nhật thông báo Khu vực đội thi.",
      );
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Lỗi khi cập nhật thông báo Khu vực đội thi.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrizes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    if (editPrizes.length === 0) {
      toast.error("Cơ cấu giải thưởng phải có ít nhất 1 mốc giải thưởng.");
      return;
    }
    const invalidPrize = editPrizes.find(
      (p) => !p.title?.trim() || !p.amount?.trim()
    );
    if (invalidPrize) {
      toast.error("Mỗi giải thưởng phải có đầy đủ Tên giải và Giá trị.");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          prizes: editPrizes,
          specialPrizes: editSpecialPrizes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSelectedEvent(res.data.event);
      toast.success("Đã cập nhật cơ cấu giải thưởng thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Lỗi khi cập nhật cơ cấu giải thưởng."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setLoading(true);
    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          customTimeline: editCustomTimeline,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setSelectedEvent(res.data.event);
      setEditCustomTimeline(res.data.event.customTimeline || []);
      toast.success("Cập nhật lịch trình cuộc thi thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Lỗi khi cập nhật lịch trình cuộc thi.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddMilestone = () => {
    if (!newMilestoneTime.trim() || !newMilestoneTitle.trim()) {
      toast.error("Vui lòng nhập đầy đủ Thời gian và Hoạt động!");
      return;
    }
    const updated = [
      ...editCustomTimeline,
      { time: newMilestoneTime, title: newMilestoneTitle, description: "" },
    ];
    setEditCustomTimeline(updated);
    setNewMilestoneTime("");
    setNewMilestoneTitle("");
  };

  const handleRemoveMilestone = (idx: number) => {
    const updated = [...editCustomTimeline];
    updated.splice(idx, 1);
    setEditCustomTimeline(updated);
  };

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!trackRoundId) {
      setMessage({
        type: "error",
        text: "Vui lòng chọn Vòng thi cho Bảng đấu.",
      });
      return;
    }

    const selectedRound = rounds.find((r) => r._id === trackRoundId);
    if (selectedRound && selectedRound.status === "completed") {
      setMessage({
        type: "error",
        text: "Không thể tạo bảng đấu mới cho vòng thi đã kết thúc.",
      });
      return;
    }

    // Client-side validation: total maxTeams check (excluding Final Round)
    const finalRound = rounds.find((r) => r.advanceTopN === 0);
    const finalRoundId = finalRound?._id || finalRound?.id;
    const isFinalRoundTrack = trackRoundId === finalRoundId;

    const newMaxTeamsNum = parseInt(trackMax) || 0;

    if (!isFinalRoundTrack) {
      const totalAllocatedTeams = tracks
        .filter((t) => {
          const tRoundId = t.roundId?._id || t.roundId;
          return tRoundId && tRoundId !== finalRoundId;
        })
        .reduce((sum, t) => sum + (t.maxTeams || 0), 0);
      const maxEventTeams = selectedEvent.maxTeams || 0;
      if (totalAllocatedTeams + newMaxTeamsNum > maxEventTeams) {
        setMessage({
          type: "error",
          text: `Không thể tạo bảng đấu. Tổng số lượng đội tối đa của các bảng đấu (${totalAllocatedTeams + newMaxTeamsNum}) vượt quá số lượng đội giới hạn của cuộc thi (${maxEventTeams}).`,
        });
        return;
      }
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:5000/api/events/${selectedEvent._id}/tracks`,
        {
          name: trackName,
          description: trackDesc,
          aiBrief: trackAiBrief ?? undefined,
          maxTeams: newMaxTeamsNum,
          roundId: trackRoundId,
          advanceTopN: parseInt(trackAdvanceTopN) || 3,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const newTrack = res.data;
      setTrackName("");
      setTrackDesc("");
      setTrackAiBrief("");
      setTrackRoundId("");
      setTrackMax("");
      setTrackAdvanceTopN("3");

      // Update local tracks state
      const updatedTracks = [...tracks, newTrack];
      setTracks(updatedTracks);
      setSelectedTrack(newTrack);

      // Fetch updated event details to reload tracks with round mapping
      await fetchEventDetails();

      setMessage({ type: "success", text: "Thêm bảng đấu thành công!" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi thêm bảng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !editingTrack) return;
    if (!trackRoundId) {
      setMessage({
        type: "error",
        text: "Vui lòng chọn Vòng thi cho Bảng đấu.",
      });
      return;
    }

    const selectedRound = rounds.find((r) => r._id === trackRoundId);
    if (selectedRound && selectedRound.status === "completed") {
      setMessage({
        type: "error",
        text: "Không thể chỉnh sửa bảng đấu của vòng thi đã kết thúc.",
      });
      return;
    }

    // Client-side validation for max teams limit (excluding Final Round)
    const finalRound = rounds.find((r) => r.advanceTopN === 0);
    const finalRoundId = finalRound?._id || finalRound?.id;
    const isFinalRoundTrack = trackRoundId === finalRoundId;

    const updatedMaxTeamsNum = parseInt(trackMax) || 0;

    if (!isFinalRoundTrack) {
      const totalAllocatedTeams = tracks
        .filter((t) => {
          const tRoundId = t.roundId?._id || t.roundId;
          return (
            t._id !== editingTrack._id && tRoundId && tRoundId !== finalRoundId
          );
        })
        .reduce((sum, t) => sum + (t.maxTeams || 0), 0);
      const maxEventTeams = selectedEvent.maxTeams || 0;
      if (totalAllocatedTeams + updatedMaxTeamsNum > maxEventTeams) {
        setMessage({
          type: "error",
          text: `Không thể cập nhật bảng đấu. Tổng số lượng đội tối đa của các bảng đấu (${totalAllocatedTeams + updatedMaxTeamsNum}) vượt quá số lượng đội giới hạn của cuộc thi (${maxEventTeams}).`,
        });
        return;
      }
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}/tracks/${editingTrack._id}`,
        {
          name: trackName,
          description: trackDesc,
          aiBrief: trackAiBrief ?? undefined,
          maxTeams: updatedMaxTeamsNum,
          roundId: trackRoundId,
          advanceTopN: parseInt(trackAdvanceTopN) || 3,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const updatedTrack = res.data;
      setTrackName("");
      setTrackDesc("");
      setTrackAiBrief("");
      setTrackRoundId("");
      setTrackMax("");
      setTrackAdvanceTopN("3");
      setEditingTrack(null);

      // Update local tracks state
      setTracks(
        tracks.map((t) => (t._id === updatedTrack._id ? updatedTrack : t)),
      );
      setSelectedTrack(updatedTrack);

      // Fetch updated event details to reload tracks with round mapping
      await fetchEventDetails();

      setMessage({ type: "success", text: "Cập nhật bảng đấu thành công!" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi cập nhật bảng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!selectedEvent) return;

    // Check if the round status of this track is completed
    const trackToDelete = tracks.find((t) => t._id === trackId);
    if (trackToDelete) {
      const roundOfTrack = rounds.find((r) => r._id === trackToDelete.roundId);
      if (roundOfTrack && roundOfTrack.status === "completed") {
        setMessage({
          type: "error",
          text: "Không thể xóa bảng đấu của vòng thi đã kết thúc.",
        });
        return;
      }
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      await axios.delete(
        `http://localhost:5000/api/events/${selectedEvent._id}/tracks/${trackId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // If we are currently editing the deleted track, reset edit state
      if (editingTrack?._id === trackId) {
        setTrackName("");
        setTrackDesc("");
        setTrackAiBrief("");
        setTrackRoundId("");
        setTrackMax("");
        setEditingTrack(null);
      }

      // Update local tracks state
      const updatedTracks = tracks.filter((t) => t._id !== trackId);
      setTracks(updatedTracks);

      if (selectedTrack?._id === trackId) {
        setSelectedTrack(updatedTracks.length > 0 ? updatedTracks[0] : null);
      }

      setMessage({ type: "success", text: "Xóa bảng đấu thành công!" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi xóa bảng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      // Calculate the order dynamically (equal to the current highest order, which belongs to Vòng Chung Kết)
      const autoNewRoundOrder =
        rounds.length > 0 ? rounds[rounds.length - 1].order : 1;

      // 1. Create the Round
      const roundRes = await axios.post(
        `http://localhost:5000/api/events/${selectedEvent._id}/rounds`,
        {
          name: roundName,
          order: autoNewRoundOrder,
          submissionDeadline: roundDeadline
            ? new Date(roundDeadline).toISOString()
            : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const newRound = roundRes.data;

      // 2. Setup Rubric (Create empty or Clone)
      let rubricCreated = false;
      try {
        if (rubricTypeOption === "existing" && selectedSourceRubricId) {
          await axios.post(
            "http://localhost:5000/api/rubrics/clone",
            {
              fromRubricId: selectedSourceRubricId,
              eventId: selectedEvent._id,
              roundId: newRound._id,
              name: `Rubric ${newRound.name}`,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          rubricCreated = true;
        } else {
          await axios.post(
            "http://localhost:5000/api/rubrics",
            {
              eventId: selectedEvent._id,
              roundId: newRound._id,
              name: rubricName || `Rubric ${newRound.name}`,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          rubricCreated = true;
        }
      } catch (rubricErr: any) {
        console.error("Rubric creation error:", rubricErr);
        toast.error(
          `Cảnh báo: Tạo Rubric thất bại - ${rubricErr.response?.data?.message || rubricErr.message}`,
        );
      }

      setMessage({
        type: "success",
        text: rubricCreated
          ? `Tạo vòng đấu "${newRound.name}" và Rubric thành công!`
          : `Tạo vòng đấu "${newRound.name}" thành công (chưa tạo được Rubric).`,
      });

      setRoundName("");
      setRoundDeadline("");
      setRubricName("");
      setSelectedSourceRubricId("");

      // Refresh event details and select new round
      await fetchEventDetails();
      setSelectedRubricRoundId(newRound._id);
      await fetchRoundsAndRubric(newRound._id);
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi tạo vòng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundsAndRubric = async (targetRoundId?: string) => {
    const roundToFetch = targetRoundId || selectedRubricRoundId;
    if (!roundToFetch) {
      setRubric(null);
      setCriteria([]);
      return;
    }
    // Only use the track scope if that track belongs to the round being fetched
    const scopeTrack = tracks.find((t: any) => t._id === selectedRubricTrackId);
    const scopeTrackId =
      scopeTrack && String(scopeTrack.roundId?._id || scopeTrack.roundId) === String(roundToFetch)
        ? scopeTrack._id
        : undefined;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/rubrics/round/${roundToFetch}`,
        {
          // exact: show only this scope's rubric so each one is managed separately
          params: { trackId: scopeTrackId, exact: "true" },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setRubric(res.data.rubric);
      setCriteria(res.data.criteria || []);

      // Populate edit fields if rubric exists
      if (res.data.rubric) {
        setEditRubricName(res.data.rubric.name);
        setEditRubricDesc(res.data.rubric.description || "");
        setEditRubricTotalWeight(String(res.data.rubric.totalWeight || 100));
        setEditRubricMaxScore(String(res.data.rubric.maxCriterionScore || 10));
        setEditRubricIsActive(res.data.rubric.isActive);
      }
    } catch (err) {
      setRubric(null);
      setCriteria([]);
    }
  };

  useEffect(() => {
    setSelectedRubricTrackId("");
  }, [selectedRubricRoundId]);

  useEffect(() => {
    fetchRoundsAndRubric();
  }, [selectedRubricRoundId, selectedRubricTrackId]);

  // Auto-save temporary draft for selected event when user makes unsaved edits
  useEffect(() => {
    if (selectedEvent?._id && !isWizardMode) {
      const draftData = {
        editEventName,
        editEventSemester,
        editEventYear,
        editEventDesc,
        editEventMaxTeams,
        editEventGithubOrgName,
        editEventRegOpen,
        editEventRegClose,
        editEventContestStart,
        editEventContestEnd,
        editZaloUrl,
        editMainGoal,
        editDurationText,
        editMemberLimitText,
        editPrizePoolText,
        editPhase1Description,
        editPhase2Description,
        editPhase3Description,
        editLocationAnnouncement,
      };
      sessionStorage.setItem(`event_draft_${selectedEvent._id}`, JSON.stringify(draftData));
    }
  }, [
    selectedEvent?._id,
    isWizardMode,
    editEventName,
    editEventSemester,
    editEventYear,
    editEventDesc,
    editEventMaxTeams,
    editEventGithubOrgName,
    editEventRegOpen,
    editEventRegClose,
    editEventContestStart,
    editEventContestEnd,
    editZaloUrl,
    editMainGoal,
    editDurationText,
    editMemberLimitText,
    editPrizePoolText,
    editPhase1Description,
    editPhase2Description,
    editPhase3Description,
    editLocationAnnouncement,
  ]);

  useEffect(() => {
    if (selectedEvent?._id && selectedRubricRoundId) {
      sessionStorage.setItem(`lastRound_${selectedEvent._id}`, selectedRubricRoundId);
    }
  }, [selectedEvent?._id, selectedRubricRoundId]);

  useEffect(() => {
    // When selected track or rounds change, auto-select a round for rubric selection if not set
    if (!selectedRubricRoundId && selectedTrack && rounds.length > 0) {
      const associatedRound = rounds.find(
        (r: any) => r._id === selectedTrack.roundId,
      );
      if (associatedRound) {
        setSelectedRubricRoundId(associatedRound._id);
      }
    } else if (rounds.length > 0 && !selectedRubricRoundId) {
      const savedRoundId = selectedEvent?._id ? sessionStorage.getItem(`lastRound_${selectedEvent._id}`) : null;
      const foundRound = savedRoundId ? rounds.find((r: any) => r._id === savedRoundId) : null;
      setSelectedRubricRoundId(foundRound ? foundRound._id : rounds[rounds.length - 1]._id);
    } else if (rounds.length > 0) {
      const exists = rounds.some((r: any) => r._id === selectedRubricRoundId);
      if (!exists) {
        const savedRoundId = selectedEvent?._id ? sessionStorage.getItem(`lastRound_${selectedEvent._id}`) : null;
        const foundRound = savedRoundId ? rounds.find((r: any) => r._id === savedRoundId) : null;
        setSelectedRubricRoundId(foundRound ? foundRound._id : rounds[rounds.length - 1]._id);
      }
    }
  }, [selectedTrack, rounds]);

  const handleCreateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !selectedRubricRoundId) return;

    try {
      await axios.post(
        "http://localhost:5000/api/rubrics",
        {
          eventId: selectedEvent._id,
          trackId: selectedRubricTrackId || undefined,
          roundId: selectedRubricRoundId,
          name: rubricName || "Rubric Đánh giá",
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRubricName("");
      setMessage({ type: "success", text: "Khởi tạo Rubric thành công!" });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi khởi tạo Rubric.",
      });
    }
  };

  const handleUpdateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubric) return;
    try {
      const res = await axios.put(
        `http://localhost:5000/api/rubrics/${rubric._id}`,
        {
          name: editRubricName,
          description: editRubricDesc,
          totalWeight: parseFloat(editRubricTotalWeight),
          maxCriterionScore: parseFloat(editRubricMaxScore),
          isActive: editRubricIsActive,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRubric(res.data);
      setEditingRubric(false);
      setMessage({ type: "success", text: "Cập nhật Rubric thành công!" });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi cập nhật Rubric.",
      });
    }
  };

  const handleDeleteRubric = async () => {
    if (!rubric) return;
    const conformed = await conform({
      title: "Xóa Rubric",
      message: "Bạn có chắc chắn muốn xóa/vô hiệu hóa Rubric này?",
      variant: "danger",
    });
    if (!conformed) return;
    try {
      await axios.delete(`http://localhost:5000/api/rubrics/${rubric._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRubric(null);
      setCriteria([]);
      setMessage({ type: "success", text: "Đã xóa Rubric thành công." });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi xóa Rubric.",
      });
    }
  };

  const handleSaveCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubric) return;

    const parsedWeight = parseFloat(critWeight);
    const parsedMaxScore = parseFloat(critMaxScore);
    const parsedOrder = parseInt(critOrder);

    if (isNaN(parsedWeight) || isNaN(parsedMaxScore)) {
      setMessage({
        type: "error",
        text: "Trọng số và điểm tối đa phải là số.",
      });
      return;
    }

    const payload: any = {
      code: critCode.trim().toUpperCase(),
      name: critName.trim(),
      description: critDesc.trim(),
      weight: parsedWeight,
      maxScore: parsedMaxScore,
      gradingLevels: critGradingLevels,
    };

    if (editingCriterion) {
      payload.order = isNaN(parsedOrder) ? undefined : parsedOrder;
    }

    try {
      if (editingCriterion) {
        await axios.put(
          `http://localhost:5000/api/criteria/${editingCriterion._id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMessage({
          type: "success",
          text: "Cập nhật tiêu chí chấm điểm thành công!",
        });
      } else {
        await axios.post(
          `http://localhost:5000/api/criteria/rubric/${rubric._id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMessage({
          type: "success",
          text: "Đã thêm tiêu chí chấm điểm mới!",
        });
      }

      setCritCode("");
      setCritName("");
      setCritDesc("");
      setCritWeight("20");
      setCritMaxScore("10");
      setCritOrder("1");
      setCritGradingLevels([]);
      setEditingCriterion(null);
      fetchRoundsAndRubric();
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi lưu tiêu chí.",
      });
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    const conformed = await conform({
      title: "Xóa tiêu chí",
      message: "Bạn có chắc chắn muốn xóa tiêu chí này?",
      variant: "danger",
    });
    if (!conformed) return;
    try {
      await axios.delete(`http://localhost:5000/api/criteria/${criterionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({ type: "success", text: "Đã xóa tiêu chí thành công." });
      fetchRoundsAndRubric();
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi xóa tiêu chí.",
      });
    }
  };

  const handleStartEditCriterion = (c: any) => {
    setEditingCriterion(c);
    setCritCode(c.code);
    setCritName(c.name);
    setCritDesc(c.description || "");
    setCritWeight(String(c.weight));
    setCritMaxScore(String(c.maxScore || 10));
    setCritOrder(String(c.order || 1));
    setCritGradingLevels(c.gradingLevels || []);
  };

  const handleCancelEditCriterion = () => {
    setEditingCriterion(null);
    setCritCode("");
    setCritName("");
    setCritDesc("");
    setCritWeight("20");
    setCritMaxScore("10");
    setCritOrder("1");
    setCritGradingLevels([]);
  };

  const handleAddGradingLevel = () => {
    if (!levelLabel.trim() || levelMinScore === "" || levelMaxScore === "") {
      alert("Vui lòng điền nhãn, điểm tối thiểu và điểm tối đa.");
      return;
    }
    const min = parseFloat(levelMinScore);
    const max = parseFloat(levelMaxScore);
    if (isNaN(min) || isNaN(max)) {
      alert("Điểm số phải là số.");
      return;
    }
    if (min > max) {
      alert("Điểm tối thiểu không được lớn hơn điểm tối đa.");
      return;
    }

    const newLvl = {
      label: levelLabel.trim(),
      minScore: min,
      maxScore: max,
      description: levelDesc.trim(),
    };

    setCritGradingLevels((prev) => {
      const updated = [...prev, newLvl];
      return updated.sort((a, b) => a.minScore - b.minScore);
    });

    setLevelLabel("");
    setLevelMinScore("");
    setLevelMaxScore("");
    setLevelDesc("");
  };

  const handleRemoveGradingLevel = (index: number) => {
    setCritGradingLevels((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLockRubric = async () => {
    if (!rubric) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:5000/api/rubrics/${rubric._id}/lock`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRubric(res.data.rubric);
      setMessage({
        type: "success",
        text: "Đã khóa Rubric thành công! Bảng điểm đã sẵn sàng sử dụng.",
      });
      fetchRoundsAndRubric();
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khóa Rubric.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockRubric = async () => {
    if (!rubric) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:5000/api/rubrics/${rubric._id}/unlock`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRubric(res.data.rubric);
      setMessage({
        type: "success",
        text: "Đã bẻ khóa (Force Unlock) Rubric thành công! Bạn có thể chỉnh sửa lại tiêu chí.",
      });
      fetchRoundsAndRubric();
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi mở khóa Rubric.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceRound = async (roundId: string) => {
    if (!selectedEvent || !roundId) return;

    const conformed = await conform({
      title: "Chốt và thăng hạng vòng đấu",
      message:
        "Bạn có chắc chắn muốn CHỐT vòng đấu này và THĂNG HẠNG (Advance) các đội xuất sắc nhất vào vòng tiếp theo?",
      variant: "warning",
    });
    if (!conformed) {
      return;
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/grades/advance-round",
        {
          eventId: selectedEvent._id,
          currentRoundId: roundId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setMessage({ type: "success", text: res.data.message });

      // Reload event details, rounds, and teams list
      await fetchEventDetails();
      await fetchTeamsList();
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.message || "Lỗi khi chốt và thăng hạng vòng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRollbackRound = async (roundId: string) => {
    if (!selectedEvent || !roundId) return;

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/grades/rollback-round",
        {
          eventId: selectedEvent._id,
          currentRoundId: roundId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setMessage({ type: "success", text: res.data.message });

      // Reload event details, rounds, and teams list
      await fetchEventDetails();
      await fetchTeamsList();
    } catch (err: any) {
      console.error("Rollback Round Error:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi thu hồi vòng đấu.",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleLockRound = async (roundId: string) => {
    if (!selectedEvent || !roundId) return;

    const conformed = await conform({
      title: "Khóa điểm vòng đấu",
      message:
        "Bạn có chắc chắn muốn KHÓA điểm và CÔNG BỐ kết quả xếp hạng cho vòng đấu này? Sau khi khóa, giám khảo sẽ không thể sửa điểm được nữa.",
      variant: "warning",
    });
    if (!conformed) {
      return;
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/grades/lock-round",
        {
          eventId: selectedEvent._id,
          roundId: roundId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setMessage({ type: "success", text: res.data.message });

      // Reload event details and rounds
      await fetchEventDetails();
      await fetchRoundsAndRubric();
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Lỗi khi khóa điểm và công bố kết quả.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockRound = async (roundId: string) => {
    if (!selectedEvent || !roundId) return;

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/grades/unlock-round",
        {
          eventId: selectedEvent._id,
          roundId: roundId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setMessage({ type: "success", text: res.data.message });

      // Reload event details and rounds
      await fetchEventDetails();
      await fetchRoundsAndRubric();
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi mở khóa điểm vòng đấu.",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // handleUploadExam removed — Drive upload moved to TracksTab component

  // handleSyncDriveAccess removed — Drive links are now direct public links (no OAuth API needed)

  const handleAssignRoleForTrack = async (
    email: string,
    trackId: string,
    role: "judge" | "mentor" = "judge",
    teamId?: string,
    isChiefJudge?: boolean,
  ) => {
    if (!selectedEvent) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      await axios.post(
        "http://localhost:5000/api/auth/assign-role",
        {
          userEmail: email,
          eventId: selectedEvent._id,
          trackId: trackId,
          role: role,
          teamId: teamId || undefined,
          isChiefJudge: isChiefJudge || false,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: `Phân quyền ${role === "judge" ? "Giám khảo" : "Mentor"} thành công!`,
      });
      fetchEventRoles();
      fetchTeamsList();
      if (email.toLowerCase() === currentUser?.email?.toLowerCase()) {
        window.location.reload();
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          `Lỗi phân quyền ${role === "judge" ? "Giám khảo" : "Mentor"}.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!selectedEvent) return;
    const conformed = await conform({
      title: "Thu hồi quyền thành viên",
      message: "Bạn có chắc chắn muốn thu hồi quyền của thành viên này?",
      variant: "danger",
    });
    if (!conformed) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const roleObj = eventRoles.find((r: any) => r._id === roleId);
      await axios.delete(
        `http://localhost:5000/api/events/${selectedEvent._id}/roles/${roleId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: "Thu hồi quyền thành viên thành công!",
      });
      fetchEventRoles();
      if (
        roleObj &&
        roleObj.userId &&
        (roleObj.userId._id === currentUser?.id ||
          roleObj.userId === currentUser?.id)
      ) {
        window.location.reload();
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi thu hồi quyền.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 pb-8 ${isAssistant ? "pt-2 space-y-4" : "pt-4 space-y-6"}`}>
      {/* EVENT HEADER PANEL (if selected) */}
      {selectedEvent && (
        <div className="glass p-6 rounded-2xl relative bg-gradient-to-r from-cyan-950/20 to-slate-900/20 z-30">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex justify-between items-start flex-col md:flex-row gap-4">
            <div className="relative" ref={eventTitleRef}>
              <span className="text-[10px] bg-orange-500/10 text-orange-500 border border-orange-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                [DETAIL_BOARD]
              </span>
              <h1
                className={`text-2xl font-black text-white mt-2 font-mono uppercase tracking-tight flex items-center gap-2 select-none ${displayedEvents.length > 1 && !isAssistant ? "group cursor-pointer" : ""
                  }`}
                onClick={() =>
                  displayedEvents.length > 1 && !isAssistant && setIsEditingEventTitle((v) => !v)
                }
              >
                <span>{selectedEvent.name}</span>
                {displayedEvents.length > 1 && !isAssistant && (
                  <ChevronDown
                    size={18}
                    className={`text-orange-500/80 group-hover:text-orange-500 transition-all mt-0.5 shrink-0 ${isEditingEventTitle ? "rotate-180 text-orange-500" : ""}`}
                  />
                )}
              </h1>
              {/* Floating event picker */}
              {isEditingEventTitle && displayedEvents.length > 1 && !isAssistant && (
                <div className="absolute left-0 top-full mt-2 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-y-auto max-h-60 min-w-[280px] scrollbar-thin scrollbar-thumb-slate-800">
                  {displayedEvents.map((e: any) => (
                    <button
                      key={e._id}
                      onClick={() => {
                        handleSelectEvent(e);
                        setIsEditingEventTitle(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-mono transition-colors cursor-pointer
                        ${e._id === selectedEvent._id
                          ? "bg-orange-500/15 text-orange-400 font-bold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                    >
                      <span className="uppercase font-bold block truncate">
                        {e.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans normal-case">
                        {e.semester} {e.year}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Học kỳ: {selectedEvent.semester} {selectedEvent.year} | Trạng
                thái:{" "}
                <span className="text-orange-500 font-bold uppercase">
                  {selectedEvent.status}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {!isAssistant && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${currentUser?.isSystemAdmin ? "bg-amber-950/20 border-amber-500/40" : "bg-slate-950 border-slate-800"}`}
                >
                  <label
                    className={`text-[10px] font-bold uppercase font-mono ${currentUser?.isSystemAdmin ? "text-amber-400" : "text-slate-400"}`}
                  >
                    Trạng thái:
                  </label>
                  <CustomSelect
                    value={selectedEvent.status}
                    onChange={(val) =>
                      handleUpdateEventStatus(val, currentUser?.isSystemAdmin)
                    }
                    options={[
                      {
                        value: "draft",
                        label: "Draft",
                        disabled:
                          !currentUser?.isSystemAdmin &&
                          selectedEvent.status !== "draft",
                      },
                      {
                        value: "registration",
                        label: "Registration",
                        disabled:
                          !currentUser?.isSystemAdmin &&
                          selectedEvent.status !== "registration",
                      },
                      {
                        value: "ongoing",
                        label: "Ongoing",
                        disabled:
                          !currentUser?.isSystemAdmin &&
                          selectedEvent.status !== "ongoing",
                      },
                      {
                        value: "completed",
                        label: "Completed",
                        disabled:
                          !currentUser?.isSystemAdmin &&
                          selectedEvent.status !== "completed",
                      },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                    className="w-48 font-semibold"
                    disabled={readOnly}
                  />
                </div>
              )}
              {!readOnly && currentUser?.isSystemAdmin && (
                <button
                  onClick={() => {
                    startEventCreation();
                    setActiveTab("events");
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-mono flex items-center gap-1.5 cursor-pointer shrink-0 transition-all shadow-md active:scale-95 z-20"
                >
                  <CalendarPlus size={14} />
                  Tạo cuộc thi mới
                </button>
              )}
              {!readOnly && currentUser?.isSystemAdmin && (
                <button
                  onClick={handleDeleteEvent}
                  className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 px-3.5 py-2 rounded-xl border border-rose-800/40 text-xs font-mono flex items-center gap-1.5 cursor-pointer shrink-0 transition-all shadow-md active:scale-95 z-20 btn-delete-contest"
                  title="Quyền Super-Admin: Xóa vĩnh viễn cuộc thi này"
                >
                  <Trash2 size={14} />
                  Xóa cuộc thi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* TAB NAVIGATION BAR */}
      {defaultTab === "events" && !isAssistant && (
        <div className="flex flex-wrap gap-3 border-b border-slate-800/80 pb-3">
          {isAssistant ? (
            <button
              onClick={() => setActiveTab("teams")}
              className="font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
            >
              Đội thi tham gia
            </button>
          ) : isWizardMode || selectedEvent === null ? (
            <>
              <button
                onClick={() => setActiveTab("events")}
                className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "events"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
                  : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
                  }`}
              >
                1. Thông tin sự kiện
              </button>
              <button
                onClick={() => {
                  if (!selectedEvent) {
                    toast.error(
                      "Vui lòng khởi tạo thông tin sự kiện ở Bước 1 trước!",
                    );
                    return;
                  }
                  setActiveTab("rounds");
                }}
                className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${!selectedEvent ? "opacity-40 cursor-not-allowed" : ""} ${activeTab === "rounds"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
                  : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
                  }`}
              >
                2. Vòng thi & Tiêu chí
              </button>
              <button
                onClick={() => {
                  if (!selectedEvent) {
                    toast.error(
                      "Vui lòng khởi tạo thông tin sự kiện ở Bước 1 trước!",
                    );
                    return;
                  }
                  if (rounds.length === 0) {
                    toast.error(
                      "Vui lòng tạo ít nhất 1 vòng thi ở Bước 2 trước khi sang bước Bảng đấu!",
                    );
                    return;
                  }
                  setActiveTab("tracks");
                }}
                className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${!selectedEvent || rounds.length === 0 ? "opacity-40 cursor-not-allowed" : ""} ${activeTab === "tracks"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
                  : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
                  }`}
              >
                3. Bảng đấu
              </button>
              <button
                onClick={() => {
                  if (!selectedEvent) {
                    toast.error(
                      "Vui lòng khởi tạo thông tin sự kiện ở Bước 1 trước!",
                    );
                    return;
                  }
                  if (rounds.length === 0) {
                    toast.error(
                      "Vui lòng tạo ít nhất 1 vòng thi ở Bước 2 trước!",
                    );
                    return;
                  }
                  if (tracks.length === 0) {
                    toast.error(
                      "Vui lòng tạo ít nhất 1 bảng đấu ở Bước 3 trước khi sang Thiết lập thời gian!",
                    );
                    return;
                  }
                  setActiveTab("schedule");
                }}
                className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${!selectedEvent || tracks.length === 0 ? "opacity-40 cursor-not-allowed" : ""} ${activeTab === "schedule"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
                  : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
                  }`}
              >
                4. Thiết lập thời gian
              </button>
              <button
                onClick={() => {
                  if (!selectedEvent) {
                    toast.error(
                      "Vui lòng khởi tạo thông tin sự kiện ở Bước 1 trước!",
                    );
                    return;
                  }
                  setActiveTab("seminar");
                }}
                className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${!selectedEvent ? "opacity-40 cursor-not-allowed" : ""} ${activeTab === "seminar"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
                  : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
                  }`}
              >
                5. Seminar & Thông báo
              </button>
            </>
          ) : (
            <div className="w-full space-y-3">
              {/* Level 1: Category Group Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-100 dark:bg-slate-900/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-xs">
                {CATEGORY_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  const isActiveGroup = group.id === currentGroup.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        if (!group.tabs.some((t) => t.id === activeTab)) {
                          if (group.id === "operations" && !selectedEvent) {
                            toast.error("Vui lòng chọn cuộc thi trước!");
                            return;
                          }
                          setActiveTab(group.tabs[0].id as any);
                        }
                      }}
                      style={
                        isActiveGroup
                          ? { backgroundColor: "#F27024", color: "#ffffff" }
                          : undefined
                      }
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer text-left select-none min-h-[68px] ${
                        isActiveGroup
                          ? "shadow-md font-bold"
                          : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-[#F27024]/50"
                      }`}
                    >
                      {/* Icon container: Unselected = Icon white in black box */}
                      <div
                        style={
                          isActiveGroup
                            ? { backgroundColor: "rgba(255, 255, 255, 0.25)", color: "#ffffff" }
                            : { backgroundColor: "#0f172a", color: "#ffffff" }
                        }
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                      >
                        <GroupIcon size={16} style={{ color: "#ffffff" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          style={
                            isActiveGroup
                              ? { color: "#ffffff" }
                              : undefined
                          }
                          className={`font-mono text-xs sm:text-[13px] font-extrabold uppercase tracking-wider block leading-tight ${
                            isActiveGroup
                              ? "!text-white"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {group.label}
                        </span>
                        <span
                          style={
                            isActiveGroup
                              ? { color: "rgba(255, 255, 255, 0.95)" }
                              : undefined
                          }
                          className={`text-[10px] font-sans block mt-0.5 leading-normal ${
                            isActiveGroup
                              ? "!text-white/90"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {group.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Level 2: Sub-tabs inside active group */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {currentGroup.tabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isTabActive = activeTab === tab.id;
                  const isOperationsLive = tab.id === "operations";
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        if (isOperationsLive && !selectedEvent) {
                          toast.error("Vui lòng chọn cuộc thi trước!");
                          return;
                        }
                        if (tab.id === "portal") {
                          setPortalSubTab(null);
                        }
                        setActiveTab(tab.id as any);
                      }}
                      className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 select-none ${
                        isTabActive
                          ? isOperationsLive
                            ? "bg-[#F27024] !text-white shadow-md font-extrabold"
                            : "bg-[#F27024] dark:bg-cyan-500 !text-white shadow-md font-bold"
                          : isOperationsLive
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                          : "bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-[#F27024]/40 hover:text-[#F27024]"
                      }`}
                    >
                      <TabIcon
                        size={14}
                        className={isTabActive ? "!text-white" : ""}
                      />
                      <span>{tab.label}</span>
                      {isOperationsLive && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT AREAS */}

      {/* 1. ADMIN TAB */}

      {/* 2. EVENTS SETTINGS TAB */}
      {activeTab === "events" && (
        <div className="w-full">
          {/* Main settings form */}
          <div className="glass p-6 rounded-2xl relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

            {selectedEvent ? (
              // EDIT SELECTED EVENT FORM
              <>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 font-mono">
                  <CalendarPlus size={20} className="text-cyan-400" />
                  <span>CẬP NHẬT THÔNG TIN SỰ KIỆN</span>
                </h2>

                <form onSubmit={handleUpdateEvent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Tên Cuộc thi
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: SEAL Hackathon Spring 2026"
                      value={editEventName}
                      onChange={(e) => setEditEventName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      GitHub Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: sealhackathon-2026"
                      value={editEventGithubOrgName}
                      onChange={(e) =>
                        setEditEventGithubOrgName(e.target.value)
                      }
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={readOnly}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Học kỳ
                      </label>
                      <CustomSelect
                        value={editEventSemester}
                        onChange={(val) => setEditEventSemester(val)}
                        options={[
                          { value: "Spring", label: "Spring" },
                          { value: "Summer", label: "Summer" },
                          { value: "Fall", label: "Fall" },
                        ]}
                        className="w-full"
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Năm
                      </label>
                      <input
                        type="number"
                        required
                        value={editEventYear}
                        onChange={(e) => setEditEventYear(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Số Đội Tối Đa (Max Teams)
                      </label>
                      <input
                        type="number"
                        required
                        value={editEventMaxTeams}
                        onChange={(e) => setEditEventMaxTeams(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Link nhóm Zalo cuộc thi
                    </label>
                    <input
                      type="url"
                      placeholder="Ví dụ: https://zalo.me/g/abcdef"
                      value={editZaloUrl}
                      onChange={(e) => setEditZaloUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Mô tả Chi tiết Cuộc thi
                    </label>
                    <textarea
                      placeholder="Nhập thông tin giới thiệu, thời gian, thể lệ chính của sự kiện..."
                      rows={4}
                      value={editEventDesc}
                      onChange={(e) => setEditEventDesc(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={readOnly}
                    ></textarea>
                  </div>

                  <div className="flex justify-between pt-4">
                    {!readOnly ? (
                      <>
                        <button
                          type="button"
                          onClick={startEventCreation}
                          className="btn-cancel bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-sm border border-slate-700 font-mono flex items-center gap-1.5 cursor-pointer"
                        >
                          Hủy & Tạo mới
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-cyan-500 hover:bg-cyan-500 font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer font-mono"
                        >
                          <span>
                            {loading ? "Đang cập nhật..." : "Lưu thay đổi"}
                          </span>
                          <CalendarPlus size={16} />
                        </button>
                      </>
                    ) : (
                      <div className="text-amber-500/85 text-xs font-mono py-2 bg-amber-500/5 px-4 border border-amber-500/10 rounded-xl w-full text-center">
                        * Bạn đang xem ở chế độ chỉ đọc. Không có quyền thay đổi
                        thông tin cuộc thi.
                      </div>
                    )}
                  </div>
                </form>
              </>
            ) : (
              // CREATE NEW EVENT FORM
              <>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 font-mono">
                  <CalendarPlus size={20} className="text-cyan-400" />
                  <span>THIẾT LẬP SỰ KIỆN: KHỞI TẠO CUỘC THI MỚI</span>
                </h2>

                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Tên Cuộc thi
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: SEAL Hackathon Spring 2026"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      GitHub Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: sealhackathon-2026"
                      value={githubOrgName}
                      onChange={(e) => setGithubOrgName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Học kỳ
                      </label>
                      <CustomSelect
                        value={semester}
                        onChange={(val) => setSemester(val)}
                        options={[
                          { value: "Spring", label: "Spring" },
                          { value: "Summer", label: "Summer" },
                          { value: "Fall", label: "Fall" },
                        ]}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Năm
                      </label>
                      <input
                        type="number"
                        required
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Số Đội Tối Đa (Max Teams)
                      </label>
                      <input
                        type="number"
                        required
                        value={maxTeams}
                        onChange={(e) => setMaxTeams(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Link nhóm Zalo cuộc thi
                    </label>
                    <input
                      type="url"
                      placeholder="Ví dụ: https://zalo.me/g/abcdef"
                      value={zaloUrl}
                      onChange={(e) => setZaloUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-955 border border-slate-850 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Mô tả Chi tiết Cuộc thi
                    </label>
                    <textarea
                      placeholder="Nhập thông tin giới thiệu, thời gian, thể lệ chính của sự kiện..."
                      rows={4}
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    ></textarea>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-cyan-500 hover:bg-cyan-500 font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer font-mono"
                    >
                      <span>
                        {loading
                          ? "Đang khởi tạo..."
                          : isWizardMode || selectedEvent === null
                            ? "Khởi tạo & Đến Bước 2: Vòng thi →"
                            : "Khởi tạo Cuộc thi"}
                      </span>
                      <CalendarPlus size={16} />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. TEAMS TAB */}
      {activeTab === "teams" &&
        (selectedEvent ? (
          <TeamsTab
            selectedEvent={selectedEvent}
            teamsList={teamsList}
            tracks={tracks}
            rounds={rounds}
            loading={loading}
            handleDistributeTeams={handleDistributeTeams}
            handleAssignTrack={handleAssignTrack}
            handleSyncRepo={handleSyncRepo}
            syncingRepoId={syncingRepoId}
            readOnly={readOnly || isAssistant}
            onRefreshTeams={fetchTeamsList}
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            quản lý Đội thi.
          </div>
        ))}

      {/* 4. TRACKS TAB */}
      {activeTab === "tracks" &&
        (selectedEvent ? (
          <div>
            <TracksTab
              selectedEvent={selectedEvent}
              tracks={tracks}
              trackName={trackName}
              setTrackName={setTrackName}
              trackDesc={trackDesc}
              setTrackDesc={setTrackDesc}
              trackAiBrief={trackAiBrief}
              setTrackAiBrief={setTrackAiBrief}
              trackMax={trackMax}
              setTrackMax={setTrackMax}
              trackAdvanceTopN={trackAdvanceTopN}
              setTrackAdvanceTopN={setTrackAdvanceTopN}
              trackRoundId={trackRoundId}
              setTrackRoundId={setTrackRoundId}
              handleCreateTrack={handleCreateTrack}
              selectedTrack={selectedTrack}
              setSelectedTrack={setSelectedTrack}
              editingTrack={editingTrack}
              setEditingTrack={setEditingTrack}
              handleUpdateTrack={handleUpdateTrack}
              handleDeleteTrack={handleDeleteTrack}
              rounds={rounds}
              setSelectedRubricRoundId={setSelectedRubricRoundId}
              setRubric={setRubric}
              setCriteria={setCriteria}
              loading={loading}
              eventRoles={eventRoles}
              handleAssignRoleForTrack={handleAssignRoleForTrack}
              handleRemoveRole={handleRemoveRole}
              teamsList={teamsList}
              token={token}
              fetchEventDetails={fetchEventDetails}
              readOnly={readOnly}
            />
            {isWizardMode && (
              <div className="mt-8 p-4 glass rounded-2xl flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("rounds")}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  ← Quay lại: Vòng thi & Tiêu chí
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (tracks.length === 0) {
                      toast.error(
                        "Vui lòng tạo ít nhất 1 bảng đấu trước khi chuyển sang bước tiếp theo!",
                      );
                      return;
                    }
                    setWizardStep((prev) => Math.max(prev, 4));
                    setActiveTab("schedule");
                  }}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-mono text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  Tiếp tục: Thiết lập thời gian →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            quản lý Bảng đấu.
          </div>
        ))}

      {/* 5. ROUNDS TAB */}
      {activeTab === "rounds" &&
        (selectedEvent ? (
          <div>
            <RoundsTab
              selectedEvent={selectedEvent}
              tracks={tracks}
              rounds={rounds}
              isSystemAdmin={currentUser?.isSystemAdmin}
              selectedTrack={selectedTrack}
              setSelectedTrack={setSelectedTrack}
              selectedRubricRoundId={selectedRubricRoundId}
              setSelectedRubricRoundId={setSelectedRubricRoundId}
              selectedRubricTrackId={selectedRubricTrackId}
              setSelectedRubricTrackId={setSelectedRubricTrackId}
              roundName={roundName}
              setRoundName={setRoundName}
              roundDeadline={roundDeadline}
              setRoundDeadline={setRoundDeadline}
              rubricTypeOption={rubricTypeOption}
              setRubricTypeOption={setRubricTypeOption}
              existingRubrics={existingRubrics}
              selectedSourceRubricId={selectedSourceRubricId}
              setSelectedSourceRubricId={setSelectedSourceRubricId}
              rubricName={rubricName}
              setRubricName={setRubricName}
              handleCreateRound={handleCreateRound}
              rubric={rubric}
              criteria={criteria}
              editingRubric={editingRubric}
              setEditingRubric={setEditingRubric}
              editRubricName={editRubricName}
              setEditRubricName={setEditRubricName}
              editRubricDesc={editRubricDesc}
              setEditRubricDesc={setEditRubricDesc}
              editRubricTotalWeight={editRubricTotalWeight}
              setEditRubricTotalWeight={setEditRubricTotalWeight}
              editRubricMaxScore={editRubricMaxScore}
              setEditRubricMaxScore={setEditRubricMaxScore}
              editRubricIsActive={editRubricIsActive}
              setEditRubricIsActive={setEditRubricIsActive}
              handleUpdateRubric={handleUpdateRubric}
              handleDeleteRubric={handleDeleteRubric}
              handleLockRubric={handleLockRubric}
              handleUnlockRubric={handleUnlockRubric}
              handleAdvanceRound={handleAdvanceRound}
              handleLockRound={handleLockRound}
              handleDeleteRound={handleDeleteRound}
              handleUpdateRound={handleUpdateRound}
              fetchEventDetails={fetchEventDetails}
              critCode={critCode}
              setCritCode={setCritCode}
              critName={critName}
              setCritName={setCritName}
              critWeight={critWeight}
              setCritWeight={setCritWeight}
              critDesc={critDesc}
              setCritDesc={setCritDesc}
              critMaxScore={critMaxScore}
              setCritMaxScore={setCritMaxScore}
              critGradingLevels={critGradingLevels}
              setCritGradingLevels={setCritGradingLevels}
              editingCriterion={editingCriterion}
              setEditingCriterion={setEditingCriterion}
              handleSaveCriterion={handleSaveCriterion}
              handleDeleteCriterion={handleDeleteCriterion}
              handleStartEditCriterion={handleStartEditCriterion}
              handleCancelEditCriterion={handleCancelEditCriterion}
              levelLabel={levelLabel}
              setLevelLabel={setLevelLabel}
              levelMinScore={levelMinScore}
              setLevelMinScore={setLevelMinScore}
              levelMaxScore={levelMaxScore}
              setLevelMaxScore={setLevelMaxScore}
              levelDesc={levelDesc}
              setLevelDesc={setLevelDesc}
              handleAddGradingLevel={handleAddGradingLevel}
              handleRemoveGradingLevel={handleRemoveGradingLevel}
              handleCreateRubric={handleCreateRubric}
              loading={loading}
              setRubric={setRubric}
              setCriteria={setCriteria}
              fetchRoundsAndRubric={fetchRoundsAndRubric}
              readOnly={readOnly}
            />
            {isWizardMode && (
              <div className="mt-8 p-4 glass rounded-2xl flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("events")}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  ← Quay lại: Thông tin sự kiện
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (rounds.length === 0) {
                      toast.error(
                        "Vui lòng tạo ít nhất 1 vòng thi trước khi chuyển sang bước tiếp theo!",
                      );
                      return;
                    }
                    setWizardStep((prev) => Math.max(prev, 3));
                    setActiveTab("tracks");
                  }}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-mono text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  Tiếp tục: Tạo Bảng đấu →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            quản lý Vòng thi.
          </div>
        ))}

      {/* 6. GITHUB TAB */}
      {activeTab === "github" &&
        (selectedEvent ? (
          <GithubTab
            repos={repos}
            selectedEvent={selectedEvent}
            handleSyncAllRepos={handleSyncAllRepos}
            syncingAll={syncingAll}
            syncProgress={syncProgress}
            loading={loading}
            handleKickAllCollaborators={handleKickAllCollaborators}
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            quản lý GitHub.
          </div>
        ))}

      {/* 7. EVENT LOGS TAB */}
      {activeTab === "logs" &&
        (selectedEvent ? (
          <div className="glass p-6 rounded-2xl border border-slate-800/80 bg-slate-900/20 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                  <Info size={20} className="text-cyan-400" />
                  <span>NHẬT KÝ HOẠT ĐỘNG SỰ KIỆN</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Nhật ký lưu lại các thay đổi quan trọng đối với cấu trúc và
                  thiết lập thời gian của sự kiện.
                </p>
              </div>
              <button
                onClick={fetchEventLogs}
                className="bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono transition-all cursor-pointer btn-reload-logs"
              >
                Tải lại nhật ký
              </button>
            </div>

            {eventLogs.length > 0 ? (
              <div className="flow-root">
                <ul className="-mb-8">
                  {eventLogs.map((log: any, logIdx: number) => (
                    <li key={log._id}>
                      <div className="relative pb-8">
                        {logIdx !== eventLogs.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-800"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div
                          onClick={() => setSelectedLog(log)}
                          className="relative flex space-x-3 cursor-pointer group hover:bg-slate-800/30 p-3 -m-3 rounded-2xl transition-all"
                        >
                          <div>
                            <span className="h-8 w-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center ring-8 ring-slate-900/50">
                              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-slate-200">
                                {log.details}{" "}
                                <span className="font-mono text-xs text-slate-500 font-medium">
                                  ({log.action})
                                </span>
                              </p>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                <span>Thực hiện bởi:</span>
                                <span className="text-cyan-400 font-semibold">
                                  {log.actorId?.fullName || "Hệ thống"}
                                </span>
                                <span>({log.actorId?.email || "N/A"})</span>
                              </p>
                            </div>
                            <div className="text-right text-xs whitespace-nowrap text-slate-500 font-mono flex flex-col items-end justify-between">
                              <time dateTime={log.createdAt}>
                                {new Date(log.createdAt).toLocaleString(
                                  "vi-VN",
                                )}
                              </time>
                              <span className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-all text-xs font-mono flex items-center gap-1 mt-1">
                                <span>Chi tiết</span>
                                <Eye size={12} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 font-mono text-sm">
                Chưa có nhật ký hoạt động nào được ghi nhận cho sự kiện này.
              </div>
            )}
          </div>
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            xem Nhật ký hoạt động.
          </div>
        ))}

      {/* 8. SCHEDULE TAB */}
      {activeTab === "schedule" &&
        (selectedEvent ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            {/* Event Schedule Card */}
            <div className="glass p-6 rounded-2xl relative flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl"></div>
              <div>
                <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
                  <Calendar size={16} className="text-cyan-400" />
                  <span>Lịch trình cuộc thi: {selectedEvent.name}</span>
                </h3>

                <form onSubmit={handleSaveEventSchedule} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                      Thời gian đăng ký (Mở đăng ký → Đóng đăng ký)
                    </label>
                    <CustomDateRangePicker
                      startValue={editEventRegOpen}
                      endValue={editEventRegClose}
                      onStartChange={setEditEventRegOpen}
                      onEndChange={setEditEventRegClose}
                      startLabel="Mở đăng ký"
                      endLabel="Đóng đăng ký"
                      maxDate={editEventContestStart}
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                      Thời gian thi đấu (Bắt đầu → Kết thúc)
                    </label>
                    <CustomDateRangePicker
                      startValue={editEventContestStart}
                      endValue={editEventContestEnd}
                      onStartChange={setEditEventContestStart}
                      onEndChange={setEditEventContestEnd}
                      startLabel="Bắt đầu thi"
                      endLabel="Kết thúc"
                      minDate={editEventRegClose}
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                      Chu kỳ tự động đồng bộ Commit (Phút)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editCommitSyncInterval}
                      onChange={(e) =>
                        setEditCommitSyncInterval(e.target.value)
                      }
                      className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="Nhập số phút..."
                      disabled={readOnly}
                    />
                  </div>

                  {!readOnly && (
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20"
                      >
                        {loading ? "Đang lưu..." : "Lưu lịch trình cuộc thi"}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Round Schedule Card */}
            <div className="glass p-6 rounded-2xl relative flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
              <div>
                <h3 className="text-md font-bold text-white mb-4 flex items-center justify-between font-mono">
                  <div className="flex items-center gap-1.5">
                    <Clock size={16} className="text-cyan-400" />
                    <span>Lịch trình vòng thi (Rounds)</span>
                  </div>
                  {!readOnly && selectedRoundForSchedule && (
                    <button
                      type="button"
                      onClick={handleDeleteRoundSchedule}
                      disabled={loading}
                      title="Xóa cài đặt thời gian"
                      className="p-1.5 rounded-lg border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </h3>

                {rounds.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-mono">
                    Chưa có vòng thi nào trong cuộc thi này.
                  </div>
                ) : (
                  <form
                    onSubmit={handleSaveRoundSchedule}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                        Chọn vòng thi (Round)
                      </label>
                      <CustomSelect
                        value={selectedRoundForSchedule?._id || ""}
                        onChange={(val) => {
                          const r = rounds.find(
                            (round: any) => round._id === val,
                          );
                          handleSelectRoundForSchedule(r);
                        }}
                        options={rounds.map((r: any) => ({
                          value: r._id,
                          label: `${r.name}`,
                        }))}
                        className="w-full"
                        disabled={readOnly}
                      />
                    </div>

                    {selectedRoundForSchedule && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                            Thời gian làm bài (Bắt đầu làm bài → Hạn nộp bài)
                          </label>
                          <CustomDateRangePicker
                            startValue={trackStartTime}
                            endValue={trackEndTime}
                            onStartChange={setTrackStartTime}
                            onEndChange={setTrackEndTime}
                            startLabel="Bắt đầu làm bài"
                            endLabel="Hạn nộp bài"
                            minDate={editEventContestStart}
                            maxDate={editEventContestEnd}
                            disabled={readOnly}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                            Thời gian chấm bài kết thúc
                          </label>
                          <CustomDateTimePicker
                            value={trackGradingEndTime}
                            onChange={setTrackGradingEndTime}
                            placeholder="Chọn thời gian kết thúc chấm..."
                            minDate={trackEndTime}
                            maxDate={editEventContestEnd}
                            disabled={readOnly}
                          />
                        </div>

                        {!readOnly && (
                          <div className="pt-4">
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20"
                            >
                              {loading
                                ? "Đang lưu..."
                                : "Lưu lịch trình vòng thi"}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </form>
                )}
              </div>
            </div>
            {isWizardMode && (
              <div className="mt-8 p-4 glass rounded-2xl flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("tracks")}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  ← Quay lại: Bảng đấu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWizardStep((prev) => Math.max(prev, 5));
                    setActiveTab("seminar");
                  }}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-mono text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  Tiếp tục: Seminar &amp; Thông báo →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            thiết lập thời gian.
          </div>
        ))}

      {/* 9. PORTAL TAB */}
      {activeTab === "portal" &&
        (selectedEvent ? (
          <div className="glass p-6 rounded-2xl relative animate-fadeIn">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl"></div>
            <div>
              {/* Sub-tab navigation bar when inside a sub-tab */}
              {portalSubTab !== null && (
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800 flex-wrap">
                  <button
                    onClick={() => setPortalSubTab(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition-all cursor-pointer"
                  >
                    ← Danh mục
                  </button>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setPortalSubTab("candidate")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${portalSubTab === "candidate"
                        ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                        : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                    >
                      Nội dung trang thí sinh
                    </button>
                    <button
                      onClick={() => setPortalSubTab("timeline")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${portalSubTab === "timeline"
                        ? "bg-[#F27024] text-white shadow-md shadow-[#F27024]/20"
                        : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                    >
                      Lịch trình cuộc thi
                    </button>
                    <button
                      onClick={() => setPortalSubTab("prizes")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${portalSubTab === "prizes"
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                        : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                    >
                      Cơ cấu giải thưởng
                    </button>
                    <button
                      onClick={() => setPortalSubTab("announcement")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${portalSubTab === "announcement"
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                    >
                      Thông báo Khu vực đội thi
                    </button>
                  </div>
                </div>
              )}

              {/* Option Cards when portalSubTab is null */}
              {portalSubTab === null && (
                <div className="py-6">
                  <h3 className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-wider font-mono text-center">
                    -- Vui lòng chọn nội dung cấu hình hiển thị --
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {/* Card 1: Candidate Portal */}
                    <div
                      onClick={() => setPortalSubTab("candidate")}
                      className="glass p-8 rounded-2xl border border-slate-800 hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] transition-all duration-300 cursor-pointer group text-center flex flex-col items-center justify-center min-h-[220px]"
                    >
                      <div className="w-16 h-16 bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Info size={32} />
                      </div>
                      <h4 className="text-md font-bold text-white mb-2 font-mono group-hover:text-cyan-400 transition-colors">
                        Nội dung hiển thị trang thí sinh
                      </h4>
                      <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
                        Chỉnh sửa thông tin chung, mục tiêu, quy định và mô tả
                        các giai đoạn cho Guest Portal.
                      </p>
                    </div>

                    {/* Card 2: Custom Timeline */}
                    <div
                      onClick={() => setPortalSubTab("timeline")}
                      className="glass p-8 rounded-2xl border border-slate-800 hover:border-[#F27024]/50 hover:shadow-[0_0_30px_rgba(242,112,36,0.15)] transition-all duration-300 cursor-pointer group text-center flex flex-col items-center justify-center min-h-[220px]"
                    >
                      <div className="w-16 h-16 bg-[#F27024]/5 text-[#F27024] border border-[#F27024]/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Calendar size={32} />
                      </div>
                      <h4 className="text-md font-bold text-white mb-2 font-mono group-hover:text-[#F27024] transition-colors">
                        Lịch trình cuộc thi
                      </h4>
                      <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
                        Thiết lập các mốc thời gian chi tiết của sự kiện hiển
                        thị trên Landing Page.
                      </p>
                    </div>

                    {/* Card 3: Prize Structure */}
                    <div
                      onClick={() => setPortalSubTab("prizes")}
                      className="glass p-8 rounded-2xl border border-slate-800 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] transition-all duration-300 cursor-pointer group text-center flex flex-col items-center justify-center min-h-[220px]"
                    >
                      <div className="w-16 h-16 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Award size={32} />
                      </div>
                      <h4 className="text-md font-bold text-white mb-2 font-mono group-hover:text-amber-400 transition-colors">
                        Cơ cấu giải thưởng
                      </h4>
                      <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
                        Tùy chỉnh các mốc giải thưởng, giá trị số tiền và quyền lợi hiển thị trên Landing Page.
                      </p>
                    </div>

                    {/* Card 4: Team Location Announcement */}
                    <div
                      onClick={() => setPortalSubTab("announcement")}
                      className="glass p-8 rounded-2xl border border-slate-800 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300 cursor-pointer group text-center flex flex-col items-center justify-center min-h-[220px]"
                    >
                      <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Megaphone size={32} />
                      </div>
                      <h4 className="text-md font-bold text-white mb-2 font-mono group-hover:text-emerald-400 transition-colors">
                        Thông báo Khu vực đội thi
                      </h4>
                      <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
                        Chỉnh sửa thông báo nổi bật (vị trí các Track, phòng thi) ghim ở trang Khu vực đội thi của thí sinh.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Portal Content */}
              {portalSubTab === "candidate" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-md font-bold text-white flex items-center gap-1.5 font-mono">
                        <Info size={16} className="text-cyan-400" />
                        <span>Nội dung hiển thị trang thí sinh:</span>
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        Chỉnh sửa các nội dung hiển thị cho thí sinh trên trang
                        chủ Guest Portal (Thông tin, Lộ trình, Quy định cuộc
                        thi).
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSavePortalContent}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column: General info */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                            Mục tiêu chính
                          </label>
                          <textarea
                            rows={4}
                            required
                            value={editMainGoal}
                            onChange={(e) => setEditMainGoal(e.target.value)}
                            className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                            placeholder="Mục tiêu chính của cuộc thi..."
                            disabled={readOnly}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                              Thời gian
                            </label>
                            <input
                              type="text"
                              required
                              value={editDurationText}
                              onChange={(e) =>
                                setEditDurationText(e.target.value)
                              }
                              className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="48 GIỜ"
                              disabled={readOnly}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                              Thành viên
                            </label>
                            <input
                              type="text"
                              required
                              value={editMemberLimitText}
                              onChange={(e) =>
                                setEditMemberLimitText(e.target.value)
                              }
                              className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="2-4 OPERATORS"
                              disabled={readOnly}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                              Giải thưởng
                            </label>
                            <input
                              type="text"
                              required
                              value={editPrizePoolText}
                              onChange={(e) =>
                                setEditPrizePoolText(e.target.value)
                              }
                              className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="$50,000 USD"
                              disabled={readOnly}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                            Mô tả Giai đoạn 1 (Đăng ký)
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={editPhase1Description}
                            onChange={(e) =>
                              setEditPhase1Description(e.target.value)
                            }
                            className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                            placeholder="Mô tả giai đoạn đăng ký..."
                            disabled={readOnly}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                            Mô tả Giai đoạn 2 (Thi đấu)
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={editPhase2Description}
                            onChange={(e) =>
                              setEditPhase2Description(e.target.value)
                            }
                            className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                            placeholder="Mô tả giai đoạn thi đấu..."
                            disabled={readOnly}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                            Mô tả Giai đoạn 3 (Kết thúc)
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={editPhase3Description}
                            onChange={(e) =>
                              setEditPhase3Description(e.target.value)
                            }
                            className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                            placeholder="Mô tả giai đoạn tổng kết..."
                            disabled={readOnly}
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider font-mono">
                              Thông báo nổi bật Khu vực đội thi
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">
                              (Để trống nếu muốn ẩn)
                            </span>
                          </div>
                          <textarea
                            rows={4}
                            value={editLocationAnnouncement}
                            onChange={(e) =>
                              setEditLocationAnnouncement(e.target.value)
                            }
                            className="w-full bg-slate-900/80 border border-slate-700 hover:border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/80 transition-all font-mono leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                            placeholder="Nội dung thông báo nổi bật... (Để trống nếu muốn ẩn ở trang thí sinh)"
                            disabled={readOnly}
                          />
                        </div>
                      </div>

                      {/* Right Column: Quy định (Rules) */}
                      <div className="space-y-4">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider font-mono">
                          Quy định cuộc thi (Rules)
                        </label>

                        <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                          {editRules.map((rule, idx) => (
                            <div
                              key={idx}
                              className="border border-slate-800 p-4 rounded-xl space-y-3 bg-slate-900/30 animate-fadeIn"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-cyan-400 font-mono">
                                  Quy định #{idx + 1}
                                </span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...editRules];
                                      updated.splice(idx, 1);
                                      setEditRules(updated);
                                    }}
                                    className="text-xs text-rose-450 hover:text-rose-450 cursor-pointer font-mono"
                                  >
                                    Xóa
                                  </button>
                                )}
                              </div>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  required
                                  value={rule.title || ""}
                                  placeholder="Tiêu đề quy định"
                                  onChange={(e) => {
                                    const updated = [...editRules];
                                    updated[idx] = {
                                      ...updated[idx],
                                      title: e.target.value,
                                    };
                                    setEditRules(updated);
                                  }}
                                  className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                                  disabled={readOnly}
                                />
                                <textarea
                                  required
                                  value={rule.description || ""}
                                  placeholder="Chi tiết quy định..."
                                  rows={2}
                                  onChange={(e) => {
                                    const updated = [...editRules];
                                    updated[idx] = {
                                      ...updated[idx],
                                      description: e.target.value,
                                    };
                                    setEditRules(updated);
                                  }}
                                  className="w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                                  disabled={readOnly}
                                />
                              </div>
                            </div>
                          ))}
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditRules([
                                  ...editRules,
                                  { title: "", description: "" },
                                ])
                              }
                              className="w-full py-2 border border-dashed border-slate-700 rounded-xl text-slate-400 text-xs hover:text-cyan-400 hover:border-cyan-500/50 transition-colors font-mono cursor-pointer"
                            >
                              + Thêm quy định mới
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-800/85">
                      <button
                        type="button"
                        onClick={() => setPortalSubTab(null)}
                        className="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer"
                      >
                        Quay lại lựa chọn
                      </button>
                      {!readOnly && (
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20 active:scale-95"
                        >
                          {loading ? "Đang lưu..." : "Lưu nội dung Portal"}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* Edit Custom Timeline */}
              {portalSubTab === "timeline" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-md font-bold text-white flex items-center gap-1.5 font-mono">
                        <Calendar size={16} className="text-[#F27024]" />
                        <span>Lịch trình cuộc thi: {selectedEvent.name}</span>
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        Cài đặt lịch trình chi tiết hiển thị trên Landing Page
                        thay vì các mốc thời gian kỹ thuật của hệ thống.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSaveCustomTimeline}
                    className="space-y-6"
                  >
                    {/* List of current custom milestones */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-wider font-mono">
                        Các mốc lịch trình hiện tại ({editCustomTimeline.length}
                        )
                      </label>
                      <div className="space-y-3 mb-6 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                        {editCustomTimeline.length === 0 ? (
                          <div className="border border-dashed border-slate-800 p-8 rounded-xl text-center text-slate-500 text-xs font-mono bg-slate-900/10">
                            Chưa có mốc lịch trình tùy chỉnh nào. Hãy thêm mốc
                            mới bên dưới hoặc sử dụng lịch trình hệ thống mặc
                            định.
                          </div>
                        ) : (
                          editCustomTimeline.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex gap-4 items-center justify-between border border-slate-800 p-4 rounded-xl bg-slate-900/30 animate-fadeIn"
                            >
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <span className="text-[10px] text-slate-500 font-mono block mb-1">
                                    MỐC THỜI GIAN
                                  </span>
                                  <input
                                    type="text"
                                    required
                                    value={item.time}
                                    onChange={(e) => {
                                      const updated = [...editCustomTimeline];
                                      updated[idx] = {
                                        ...updated[idx],
                                        time: e.target.value,
                                      };
                                      setEditCustomTimeline(updated);
                                    }}
                                    className="w-full bg-slate-900/80 border border-slate-700 hover:border-[#F27024]/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F27024]/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                                    disabled={readOnly}
                                  />
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 font-mono block mb-1">
                                    HOẠT ĐỘNG CHÍNH
                                  </span>
                                  <input
                                    type="text"
                                    required
                                    value={item.title}
                                    onChange={(e) => {
                                      const updated = [...editCustomTimeline];
                                      updated[idx] = {
                                        ...updated[idx],
                                        title: e.target.value,
                                      };
                                      setEditCustomTimeline(updated);
                                    }}
                                    className="w-full bg-slate-900/80 border border-slate-700 hover:border-[#F27024]/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F27024]/80 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                                    disabled={readOnly}
                                  />
                                </div>
                              </div>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMilestone(idx)}
                                  className="text-rose-500 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition-colors shrink-0 active:scale-95 cursor-pointer"
                                  title="Xóa mốc"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Add new milestone form */}
                    {!readOnly && (
                      <div className="border border-slate-800/80 p-5 rounded-2xl bg-slate-900/40 space-y-4">
                        <span className="text-xs font-bold text-cyan-400 block font-mono uppercase tracking-wider">
                          + Thêm mốc lịch trình mới
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
                              Thời gian
                            </label>
                            <input
                              type="text"
                              value={newMilestoneTime}
                              onChange={(e) =>
                                setNewMilestoneTime(e.target.value)
                              }
                              placeholder="Ví dụ: 20h00 - 21h30 ngày 13/8/2026 (online)"
                              className="w-full bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
                              Hoạt động chính
                            </label>
                            <input
                              type="text"
                              value={newMilestoneTitle}
                              onChange={(e) =>
                                setNewMilestoneTitle(e.target.value)
                              }
                              placeholder="Ví dụ: Workshop training..."
                              className="w-full bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/80 transition-all font-mono"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddMilestone}
                          className="px-4 py-2 bg-[#F27024]/10 hover:bg-[#F27024] text-[#F27024] hover:text-white border border-[#F27024]/20 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          Thêm vào danh sách
                        </button>
                      </div>
                    )}

                    {/* Save custom timeline */}
                    <div className="flex gap-3 pt-4 border-t border-slate-800/85">
                      <button
                        type="button"
                        onClick={() => setPortalSubTab(null)}
                        className="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer"
                      >
                        Quay lại lựa chọn
                      </button>
                      {!readOnly && (
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20 active:scale-95"
                        >
                          {loading ? "Đang lưu..." : "Lưu lịch trình tùy chỉnh"}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* Edit Prize Structure */}
              {portalSubTab === "prizes" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-md font-bold text-white flex items-center gap-1.5 font-mono">
                        <Award size={16} className="text-amber-400" />
                        <span>Tùy chỉnh Cơ cấu giải thưởng: {selectedEvent.name}</span>
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        Chỉnh sửa danh sách các mốc giải thưởng và thông tin hạng mục phụ hiển thị trên Landing Page.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSavePrizes} className="space-y-8">
                    {/* 1. Primary Prize Tiers */}
                    <div className=" p-5 rounded-2xl border border-slate-800">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-2">
                          Danh sách mốc giải thưởng
                        </h4>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditPrizes([
                                ...editPrizes,
                                {
                                  title: `0${editPrizes.length + 1} GIẢI MỚI`,
                                  amount: "1.000.000 đồng",
                                  benefits: "Giấy chứng nhận",
                                },
                              ]);
                            }}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={14} /> Thêm giải thưởng
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {editPrizes.map((prize, idx) => (
                          <div
                            key={idx}
                            className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center gap-4"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold">
                              {String(idx + 1).padStart(2, "0")}
                            </span>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 w-full">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">
                                  Tên giải thưởng
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={prize.title || ""}
                                  onChange={(e) => {
                                    const updated = [...editPrizes];
                                    updated[idx].title = e.target.value;
                                    setEditPrizes(updated);
                                  }}
                                  placeholder="Ví dụ: 01 GIẢI NHẤT"
                                  disabled={readOnly}
                                  className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">
                                  Giá trị / Số tiền
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={prize.amount || ""}
                                  onChange={(e) => {
                                    const updated = [...editPrizes];
                                    updated[idx].amount = e.target.value;
                                    setEditPrizes(updated);
                                  }}
                                  placeholder="Ví dụ: 7.000.000 đồng"
                                  disabled={readOnly}
                                  className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-lg px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500 font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">
                                  Quyền lợi kèm theo
                                </label>
                                <input
                                  type="text"
                                  value={prize.benefits || ""}
                                  onChange={(e) => {
                                    const updated = [...editPrizes];
                                    updated[idx].benefits = e.target.value;
                                    setEditPrizes(updated);
                                  }}
                                  placeholder="Ví dụ: Giấy chứng nhận + hoa"
                                  disabled={readOnly}
                                  className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
                                />
                              </div>
                            </div>

                            {!readOnly && (
                              <div className="flex items-center gap-1 self-end md:self-center shrink-0">
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...editPrizes];
                                      const temp = updated[idx];
                                      updated[idx] = updated[idx - 1];
                                      updated[idx - 1] = temp;
                                      setEditPrizes(updated);
                                    }}
                                    title="Lên trên"
                                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-md transition-colors cursor-pointer"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                )}
                                {idx < editPrizes.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...editPrizes];
                                      const temp = updated[idx];
                                      updated[idx] = updated[idx + 1];
                                      updated[idx + 1] = temp;
                                      setEditPrizes(updated);
                                    }}
                                    title="Xuống dưới"
                                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-md transition-colors cursor-pointer"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditPrizes(
                                      editPrizes.filter((_, i) => i !== idx)
                                    );
                                  }}
                                  title="Xóa mốc giải"
                                  className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 2. Special Prize Categories */}
                    <div className="p-5 rounded-2xl border border-slate-800">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono flex items-center gap-2">
                          Hạng mục đặc biệt / Thông tin phụ
                        </h4>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditSpecialPrizes([
                                ...editSpecialPrizes,
                                {
                                  title: "HẠNG MỤC MỚI",
                                  description: "Mô tả chi tiết hạng mục...",
                                },
                              ]);
                            }}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={14} /> Thêm hạng mục phụ
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {editSpecialPrizes.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3 relative"
                          >
                            <div className="flex justify-between items-center">
                              <input
                                type="text"
                                required
                                value={item.title || ""}
                                onChange={(e) => {
                                  const updated = [...editSpecialPrizes];
                                  updated[idx].title = e.target.value;
                                  setEditSpecialPrizes(updated);
                                }}
                                placeholder="Tiêu đề hạng mục phụ"
                                disabled={readOnly}
                                className="bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 font-mono w-full mr-2"
                              />
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditSpecialPrizes(
                                      editSpecialPrizes.filter((_, i) => i !== idx)
                                    );
                                  }}
                                  title="Xóa hạng mục phụ"
                                  className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition-colors shrink-0 cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>

                            <textarea
                              rows={2}
                              required
                              value={item.description || ""}
                              onChange={(e) => {
                                const updated = [...editSpecialPrizes];
                                updated[idx].description = e.target.value;
                                setEditSpecialPrizes(updated);
                              }}
                              placeholder="Nội dung chi tiết..."
                              disabled={readOnly}
                              className="w-full bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPortalSubTab(null)}
                        className="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer"
                      >
                        Quay lại lựa chọn
                      </button>
                      {!readOnly && (
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
                        >
                          {loading ? "Đang lưu..." : "Lưu cơ cấu giải thưởng"}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* 4. Edit Team Area Announcement */}
              {portalSubTab === "announcement" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-md font-bold text-white flex items-center gap-2 font-mono">
                        <Megaphone size={18} className="text-emerald-400" />
                        <span>Thông báo nổi bật Khu vực đội thi:</span>
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        Tùy chỉnh thông báo ghim nổi bật xuất hiện ở đầu trang Khu vực đội thi của thí sinh (phân chia địa điểm, phòng thi các Track).
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveAnnouncement} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: Input Editor */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono">
                              Nội dung thông báo (Hiển thị cho thí sinh)
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Hỗ trợ xuống dòng &amp; gạch đầu dòng
                            </span>
                          </div>
                          <textarea
                            rows={8}
                            value={editLocationAnnouncement}
                            onChange={(e) =>
                              setEditLocationAnnouncement(e.target.value)
                            }
                            className="w-full bg-slate-900/80 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-emerald-500/80 transition-all font-mono leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                            placeholder="Nhập nội dung thông báo... (Để trống nếu muốn ẩn hoàn toàn khu vực thông báo này ở trang thí sinh)"
                            disabled={readOnly}
                          />
                        </div>

                        {/* Helper info alert */}
                        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-3">
                          <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-slate-400 leading-relaxed font-sans">
                            <strong className="text-slate-300">Lưu ý hiển thị:</strong> Nếu ô nội dung để trống hoặc xóa hết ký tự, khối thông báo này sẽ <span className="text-amber-400 font-bold">tự động ẩn hoàn toàn</span> trên giao diện của tất cả thí sinh.
                          </div>
                        </div>

                        {/* Quick Action Buttons */}
                        {!readOnly && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const defaultNotice = `THÔNG BÁO KHU VỰC VÒNG SƠ LOẠI:.\n\n- Track A: Seminar 1 Thư viện.\n\n- Track B: Tầng G Thư viện.\n\n- Track C: LB24 tầng 2 Thư viện.`;
                                setEditLocationAnnouncement(defaultNotice);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <RotateCcw size={12} />
                              Khôi phục mẫu mặc định
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditLocationAnnouncement("")}
                              className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Trash2 size={12} />
                              Xóa thông báo (Ẩn với thí sinh)
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: Live Preview */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono">
                          Xem trước hiển thị (Live Preview phía Thí sinh)
                        </label>
                        {editLocationAnnouncement.trim().length > 0 ? (
                          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                            <span className="text-[10px] text-slate-500 font-mono block">
                              Mô phỏng giao diện trang Khu vực đội thi:
                            </span>
                            <div className="relative overflow-hidden bg-gradient-to-r from-orange-500/[0.08] via-amber-500/[0.04] to-slate-900/60 p-5 rounded-2xl border-2 border-[#F27024]/30 shadow-sm">
                              <div className="flex items-start gap-4">
                                <div className="p-3 bg-[#F27024]/15 text-[#F27024] rounded-xl border border-[#F27024]/30 shrink-0 shadow-inner">
                                  <Megaphone size={22} className="animate-pulse" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase font-mono tracking-wider px-2.5 py-0.5 rounded-md bg-[#F27024] text-white shadow-sm shadow-orange-500/20">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                      Thông báo từ BTC
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-mono font-bold">
                                      Khu vực thi &amp; Địa điểm
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-200 leading-relaxed font-sans font-medium whitespace-pre-line break-words">
                                    {editLocationAnnouncement}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-950/60 p-8 rounded-2xl border border-dashed border-slate-800 text-center flex flex-col items-center justify-center min-h-[180px]">
                            <EyeOff size={28} className="text-slate-600 mb-2" />
                            <p className="text-xs text-slate-500 font-mono">
                              Thông báo hiện đang để trống.
                            </p>
                            <p className="text-[11px] text-slate-600 font-sans mt-1">
                              Khối thông báo sẽ bị ẩn hoàn toàn trên giao diện của thí sinh.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex gap-3 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPortalSubTab(null)}
                        className="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer"
                      >
                        Quay lại lựa chọn
                      </button>
                      {!readOnly && (
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2 font-mono"
                        >
                          {loading ? "Đang lưu..." : "Lưu thông báo khu vực thi"}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            thiết lập nội dung Portal.
          </div>
        ))}

      {/* 10. SEMINAR TAB */}
      {activeTab === "seminar" && (
        <SeminarTab
          selectedEvent={selectedEvent}
          fetchEventDetails={fetchEventDetails}
          readOnly={readOnly}
          isWizardMode={isWizardMode}
          onPrevStep={() => setActiveTab("schedule")}
          onCompleteWizard={() => {
            sessionStorage.removeItem("creatingEventId");
            setIsWizardMode(false);
            toast.success(
              "Chúc mừng! Bạn đã hoàn tất toàn bộ các bước khởi tạo cuộc thi mới!",
            );
            setActiveTab("events");
          }}
        />
      )}

      {/* 11. OPERATIONS TAB */}
      {activeTab === "operations" &&
        (selectedEvent ? (
          <OperationsTab
            selectedEvent={selectedEvent}
            rounds={rounds}
            tracks={tracks}
            teamsList={teamsList}
            handleAdvanceRound={handleAdvanceRound}
            handleLockRound={handleLockRound}
            handleUnlockRound={handleUnlockRound}
            handleSyncAllRepos={handleSyncAllRepos}
            handleUpdateRound={handleUpdateRound}
            fetchEventDetails={fetchEventDetails}
            handleRollbackRound={handleRollbackRound}
            readOnly={readOnly}
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            điều hành.
          </div>
        ))}

      {/* DETAIL EVENT LOG MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md transition-all duration-300">
          <div className="relative w-full max-w-lg border border-slate-800/80 bg-slate-950 p-6 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-6 font-sans text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Top decorative line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Activity
                  className="text-cyan-400 shrink-0 animate-pulse"
                  size={20}
                />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Chi tiết Nhật ký Hoạt động
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-4">
              {/* Action Badge */}
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                <span className="text-xs text-slate-400 font-mono">
                  Loại hành động:
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono tracking-wide ${selectedLog.action.includes("event")
                    ? "bg-blue-500/10 border border-blue-500/30 text-blue-400"
                    : selectedLog.action.includes("role")
                      ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
                      : selectedLog.action.includes("track") ||
                        selectedLog.action.includes("team")
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                        : selectedLog.action.includes("rubric") ||
                          selectedLog.action.includes("criterion")
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                          : selectedLog.action.includes("results")
                            ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                            : "bg-slate-500/10 border border-slate-500/30 text-slate-400"
                    }`}
                >
                  {selectedLog.action}
                </span>
              </div>

              {/* Action Description */}
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-mono">
                  Mô tả hoạt động:
                </span>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/80 text-sm text-white font-medium leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>

              {/* Actor Info */}
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-mono">
                  Thực hiện bởi:
                </span>
                <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                  <div className="h-10 w-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 font-bold font-mono">
                    <User size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      {selectedLog.actorId?.fullName || "Hệ thống"}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {selectedLog.actorId?.email || "system@internal"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Time */}
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                <span className="text-xs text-slate-400 font-mono">
                  Thời gian thực hiện:
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {new Date(selectedLog.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800/50">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
