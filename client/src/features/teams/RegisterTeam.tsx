import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, UserPlus, Trash2, Calendar, FolderGit2, CheckCircle, Download, Upload, FileSpreadsheet, AlertTriangle, Mail, ExternalLink } from 'lucide-react';
import UniversityCombobox from '../shared/UniversityCombobox';
import CustomSelect from '../shared/CustomSelect';
import CaptchaInput from '../shared/CaptchaInput';
import { Link, useSearchParams } from 'react-router-dom';
import GithubUserAutocomplete from '../shared/GithubUserAutocomplete';

interface MemberInput {
  email: string;
  fullName: string;
  githubUsername: string;
  studentId: string;
  university: string;
  height: string;
  weight: string;
  universityCustom?: string;
  isUniversityCustom?: boolean;
  checkingStatus?: 'idle' | 'checking' | 'eligible' | 'conflict';
  checkingMessage?: string;
}


export default function RegisterTeam() {
  const [searchParams] = useSearchParams();
  const eventIdParam = searchParams.get('eventId');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  const [teamName, setTeamName] = useState('');

  // Leader info states (to capture missing profile info from Google OAuth)
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderFullName, setLeaderFullName] = useState('');
  const [leaderStudentId, setLeaderStudentId] = useState('');
  const [leaderGithubUsername, setLeaderGithubUsername] = useState('');
  const [leaderUniversity, setLeaderUniversity] = useState('');
  const [leaderHeight, setLeaderHeight] = useState('');
  const [leaderWeight, setLeaderWeight] = useState('');

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState('');

  const [members, setMembers] = useState<MemberInput[]>([]);

  // Refs for auto-checking email to avoid stale closures
  const checkTimers = React.useRef<{ [key: number]: any }>({});
  const membersRef = React.useRef<MemberInput[]>([]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // States & Ref for auto-checking team name
  const [teamNameCheckingStatus, setTeamNameCheckingStatus] = useState<'idle' | 'checking' | 'eligible' | 'conflict'>('idle');
  const [teamNameCheckingMessage, setTeamNameCheckingMessage] = useState('');
  const teamNameTimer = React.useRef<any>(null);

  const handleCheckTeamName = async (name: string) => {
    if (!name.trim() || !selectedEventId) {
      setTeamNameCheckingStatus('idle');
      setTeamNameCheckingMessage('');
      return;
    }

    setTeamNameCheckingStatus('checking');
    setTeamNameCheckingMessage('');

    try {
      const res = await axios.get(
        `http://localhost:5000/api/teams/check-name?name=${encodeURIComponent(name.trim())}&eventId=${selectedEventId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.exists) {
        setTeamNameCheckingStatus('conflict');
        setTeamNameCheckingMessage(res.data.message || 'Tên nhóm đã tồn tại.');
      } else {
        setTeamNameCheckingStatus('eligible');
        setTeamNameCheckingMessage(res.data.message || 'Tên nhóm hợp lệ.');
      }
    } catch (err: any) {
      console.error(err);
      setTeamNameCheckingStatus('idle');
      setTeamNameCheckingMessage(err.response?.data?.message || 'Lỗi kiểm tra tên nhóm.');
    }
  };

  // History reuse states
  const [pastTeams, setPastTeams] = useState<any[]>([]);
  const [selectedPastTeamId, setSelectedPastTeamId] = useState('');
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [infoMessage, setInfoMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, _setSuccess] = useState('');
  const [alreadyHasTeam, setAlreadyHasTeam] = useState(false);
  const [existingTeamName, setExistingTeamName] = useState('');
  const [checkingTeam, setCheckingTeam] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');

  const fetchCaptcha = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/captcha');
      setCaptchaId(res.data.captchaId);
      setCaptchaSvg(res.data.captchaSvg);
    } catch (err) {
      console.error('Error fetching captcha:', err);
    }
  };

  const setError = (msg: string) => {
    if (msg) toast.error(msg);
  };
  const setSuccess = (msg: string) => {
    _setSuccess(msg);
    if (msg) toast.success(msg);
  };

  const token = localStorage.getItem('token');
  const selectedEvent = events.find(e => e._id === selectedEventId);

  useEffect(() => {
    if (!token) {
      setCheckingTeam(false);
      return;
    }
    axios.get('http://localhost:5000/api/teams/my-team', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const team = res.data?.team;
        console.log('DEBUG [RegisterTeam]: team =', team);
        const isEventEnded = team && (
          team.eventId?.status === 'completed' ||
          team.eventId?.status === 'cancelled' ||
          (team.eventId?.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
        );
        console.log('DEBUG [RegisterTeam]: isEventEnded =', isEventEnded, 'contestEnd =', team?.eventId?.contestEnd, 'status =', team?.eventId?.status);
        if (team && !isEventEnded) {
          setAlreadyHasTeam(true);
          setExistingTeamName(team.name);
        } else {
          setAlreadyHasTeam(false);
        }
      })
      .catch(_err => {
        setAlreadyHasTeam(false);
      })
      .finally(() => {
        setCheckingTeam(false);
      });
  }, [token]);

  useEffect(() => {
    // Fetch active events
    setLoadingEvents(true);
    axios.get('http://localhost:5000/api/events')
      .then(res => {
        const activeEvents = res.data.filter((e: any) => e.status === 'registration');
        setEvents(activeEvents);
        if (activeEvents.length > 0) {
          const matchedEvent = activeEvents.find((e: any) => e._id === eventIdParam);
          setSelectedEventId(matchedEvent ? matchedEvent._id : activeEvents[0]._id);
        }
      })
      .catch(err => console.error('Error fetching events:', err))
      .finally(() => {
        setLoadingEvents(false);
      });
    fetchCaptcha();
  }, []);

  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:5000/api/teams/history', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setPastTeams(res.data || []);
      })
      .catch(err => console.error('Error fetching past teams:', err));
  }, [token]);

  const handleApplyPastTeam = () => {
    if (!selectedPastTeamId) return;
    const team = pastTeams.find(t => t._id === selectedPastTeamId);
    if (!team) return;

    setTeamName(team.name);

    if (team.members && Array.isArray(team.members)) {
      setMembers(team.members.map((m: any) => ({
        email: m.email || '',
        fullName: m.fullName || '',
        githubUsername: m.githubUsername || '',
        studentId: m.studentId || '',
        university: m.university || '',
        height: m.height ? String(m.height) : '',
        weight: m.weight ? String(m.weight) : ''
      })));
    }

    setInfoMessage('Đã tải thông tin và tên nhóm từ đội thi cũ.');
    setTimeout(() => setInfoMessage(''), 5000);
  };

  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const u = res.data.user;
        if (u) {
          setLeaderEmail(u.email || '');
          setLeaderFullName(u.fullName || '');
          setLeaderStudentId(u.studentId || '');
          setLeaderGithubUsername(u.githubUsername || '');
          setLeaderHeight(u.height !== undefined && u.height !== null ? String(u.height) : '');
          setLeaderWeight(u.weight !== undefined && u.weight !== null ? String(u.weight) : '');
          const univ = u.university || '';
          if (univ) {
            setLeaderUniversity(univ);
          }
        }
      })
      .catch(err => console.error('Error fetching user profile:', err));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedEventId) return;
    axios.get(`http://localhost:5000/api/teams/my-pending-invitations?eventId=${selectedEventId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setPendingInvitations(res.data.invitations || []);
      })
      .catch(err => console.error('Error fetching pending invitations:', err));
  }, [token, selectedEventId]);

  const handleOpenEmail = (leaderEmail?: string) => {
    if (leaderEmail) {
      const domain = leaderEmail.split('@')[1]?.toLowerCase();
      if (domain === 'gmail.com' || domain === 'fpt.edu.vn') {
        window.open('https://mail.google.com', '_blank');
        return;
      }
      if (domain === 'outlook.com' || domain === 'hotmail.com') {
        window.open('https://outlook.live.com', '_blank');
        return;
      }
    }
    window.open('https://mail.google.com', '_blank');
  };

  const leaderEmailTimeout = useRef<any>(null);

  useEffect(() => {
    if (!leaderEmail || !token) return;
    const emailVal = leaderEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) return;

    if (leaderEmailTimeout.current) clearTimeout(leaderEmailTimeout.current);

    leaderEmailTimeout.current = setTimeout(async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/teams/user-lookup?email=${encodeURIComponent(emailVal)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.user) {
          const u = res.data.user;
          if (u.fullName) setLeaderFullName(u.fullName);
          if (u.studentId) setLeaderStudentId(u.studentId);
          if (u.githubUsername) setLeaderGithubUsername(u.githubUsername);
          if (u.university) setLeaderUniversity(u.university);
          if (u.height !== undefined && u.height !== null) setLeaderHeight(String(u.height));
          if (u.weight !== undefined && u.weight !== null) setLeaderWeight(String(u.weight));
        }
      } catch (err) {
        // Do not overwrite manually entered fields on lookup failure
      }
    }, 500);

    return () => {
      if (leaderEmailTimeout.current) clearTimeout(leaderEmailTimeout.current);
    };
  }, [leaderEmail, token]);

  const eligibilityTimeouts = useRef<{ [key: number]: any }>({});

  const handleMemberChange = (index: number, field: keyof MemberInput, value: any) => {
    const updated = [...members];
    (updated[index] as any)[field] = value;
    setMembers(updated);

    if (field === 'email') {
      if (eligibilityTimeouts.current[index]) {
        clearTimeout(eligibilityTimeouts.current[index]);
      }

      const emailVal = value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(emailVal)) {
        updated[index].checkingStatus = 'checking';
        updated[index].checkingMessage = 'Đang kiểm tra tự động...';
        setMembers([...updated]);

        eligibilityTimeouts.current[index] = setTimeout(() => {
          handleCheckEligibility(index, emailVal);
        }, 500);
      } else {
        updated[index].checkingStatus = 'idle';
        updated[index].checkingMessage = '';
        setMembers([...updated]);
      }
    }
  };

  const addMemberRow = () => {
    setMembers([...members, {
      email: '',
      fullName: '',
      githubUsername: '',
      studentId: '',
      university: '',
      height: '',
      weight: '',
      universityCustom: '',
      isUniversityCustom: false,
      checkingStatus: 'idle',
      checkingMessage: ''
    }]);
  };

  const removeMemberRow = (index: number) => {
    // Clear timer for this index if any
    if (checkTimers.current[index]) {
      clearTimeout(checkTimers.current[index]);
      delete checkTimers.current[index];
    }
    // Shift timers down for indices greater than index
    const nextTimers: { [key: number]: any } = {};
    Object.keys(checkTimers.current).forEach(keyStr => {
      const key = parseInt(keyStr);
      if (key > index) {
        nextTimers[key - 1] = checkTimers.current[key];
      } else if (key < index) {
        nextTimers[key] = checkTimers.current[key];
      }
    });
    checkTimers.current = nextTimers;

    setMembers(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleCheckEligibility = async (index: number, emailToCheck?: string) => {
    const targetEmail = emailToCheck !== undefined ? emailToCheck : (membersRef.current[index]?.email || '');
    if (!targetEmail.trim()) {
      return;
    }

    setMembers(prev => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        checkingStatus: 'checking',
        checkingMessage: ''
      };
      return updated;
    });

    try {
      const res = await axios.get(
        `http://localhost:5000/api/teams/check-eligibility?email=${encodeURIComponent(targetEmail.trim())}&eventId=${selectedEventId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setMembers(prev => {
        if (!prev[index]) return prev;
        const nextUpdated = [...prev];
        if (nextUpdated[index].email.trim() !== targetEmail.trim()) {
          return prev;
        }

        if (res.data.eligible) {
          nextUpdated[index] = {
            ...nextUpdated[index],
            checkingStatus: 'eligible',
            checkingMessage: res.data.message || 'Hợp lệ (Chưa có nhóm)'
          };
          const u = res.data.user;
          if (u) {
            if (u.fullName) nextUpdated[index].fullName = u.fullName;
            if (u.studentId) nextUpdated[index].studentId = u.studentId;
            if (u.githubUsername) nextUpdated[index].githubUsername = u.githubUsername;
            if (u.university) nextUpdated[index].university = u.university;
            if (u.height !== undefined && u.height !== null) nextUpdated[index].height = String(u.height);
            if (u.weight !== undefined && u.weight !== null) nextUpdated[index].weight = String(u.weight);
          }
        } else {
          nextUpdated[index] = {
            ...nextUpdated[index],
            checkingStatus: 'conflict',
            checkingMessage: res.data.message || 'Đã có nhóm!'
          };
        }
        return nextUpdated;
      });
    } catch (err: any) {
      console.error(err);
      setMembers(prev => {
        if (!prev[index]) return prev;
        const nextUpdated = [...prev];
        if (nextUpdated[index].email.trim() !== targetEmail.trim()) {
          return prev;
        }
        nextUpdated[index] = {
          ...nextUpdated[index],
          checkingStatus: 'idle',
          checkingMessage: err.response?.data?.message || 'Lỗi kiểm tra'
        };
        return nextUpdated;
      });
      toast.error(err.response?.data?.message || 'Lỗi khi kiểm tra email.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!teamName.trim()) {
      setError('Tên nhóm không được để trống.');
      setLoading(false);
      return;
    }

    if (!leaderFullName.trim() || !leaderGithubUsername.trim() || !leaderHeight || !leaderWeight) {
      setError('Họ tên, GitHub Username, chiều cao và cân nặng Trưởng nhóm là bắt buộc.');
      setLoading(false);
      return;
    }

    if (isNaN(Number(leaderHeight)) || isNaN(Number(leaderWeight))) {
      setError('Chiều cao và cân nặng Trưởng nhóm phải là số hợp lệ.');
      setLoading(false);
      return;
    }

    if (members.length < 2) {
      setError('Số lượng thành viên không đủ (tối thiểu 3).');
      setLoading(false);
      return;
    }

    // Validate members
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.email.trim() || !m.fullName.trim() || !m.githubUsername.trim() || !m.height || !m.weight) {
        setError(`Thành viên thứ ${i + 1} phải điền đầy đủ Email, Họ Tên, GitHub Username, chiều cao và cân nặng.`);
        setLoading(false);
        return;
      }
      if (isNaN(Number(m.height)) || isNaN(Number(m.weight))) {
        setError(`Thành viên thứ ${i + 1} phải có chiều cao và cân nặng hợp lệ.`);
        setLoading(false);
        return;
      }
      if (m.checkingStatus === 'conflict') {
        setError(`Thành viên thứ ${i + 1} (${m.email}) đã thuộc đội khác hoặc không hợp lệ.`);
        setLoading(false);
        return;
      }
    }

    try {
      if (!captchaValue.trim()) {
        setError('Vui lòng nhập mã xác thực (CAPTCHA).');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        'http://localhost:5000/api/teams/register',
        {
          eventId: selectedEventId,
          trackId: undefined,
          teamName: teamName.trim(),
          membersList: members.map(m => ({
            email: m.email.trim(),
            fullName: m.fullName.trim(),
            githubUsername: m.githubUsername.trim(),
            studentId: m.studentId.trim(),
            university: m.university.trim(),
            height: Number(m.height),
            weight: Number(m.weight)
          })),
          leaderInfo: {
            email: leaderEmail.trim(),
            fullName: leaderFullName.trim(),
            studentId: leaderStudentId.trim(),
            githubUsername: leaderGithubUsername.trim(),
            university: leaderUniversity.trim(),
            height: Number(leaderHeight),
            weight: Number(leaderWeight)
          },
          captchaId,
          captchaValue
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess(response.data.message || 'Đăng ký thành công! Vui lòng chờ các thành viên xác nhận email.');
      // Reset form
      setTeamName('');
      setMembers([]);

      setTimeout(() => {
        window.location.href = '/team-area';
      }, 3000);

    } catch (err: any) {
      console.error(err);
      fetchCaptcha();
      setError(err.response?.data?.message || 'Có lỗi xảy ra trong quá trình đăng ký.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!token) return;
    try {
      const response = await axios.get('http://localhost:5000/api/teams/import-template', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Template_Import_Teams.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải file mẫu.');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast.warning('Vui lòng chọn file Excel trước.');
      return;
    }
    if (!selectedEventId) {
      toast.warning('Vui lòng chọn cuộc thi trước khi import.');
      return;
    }

    setImporting(true);
    setImportErrors([]);
    setImportSuccess('');

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('eventId', selectedEventId);

    try {
      const res = await axios.post('http://localhost:5000/api/teams/import', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(res.data.message || 'Import danh sách đội thi thành công!');
      setImportSuccess(res.data.message || 'Import thành công!');
      setImportFile(null);

      // Redirect after 3s
      setTimeout(() => {
        window.location.href = '/team-area';
      }, 3000);

    } catch (err: any) {
      console.error(err);
      if (err.response?.data?.errors) {
        setImportErrors(err.response.data.errors);
      } else {
        toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi import.');
      }
    } finally {
      setImporting(false);
    }
  };

  if (checkingTeam || loadingEvents) {
    return (
      <div className="team-area-light relative overflow-hidden font-sans bg-slate-50 text-slate-900 min-h-screen flex items-center justify-center font-mono">
        <p className="text-slate-450 text-lg animate-pulse">Đang tải thông tin...</p>
      </div>
    );
  }

  if (alreadyHasTeam) {
    return (
      <div className="team-area-light relative overflow-hidden font-sans bg-[#faf9f6] text-slate-800 min-h-screen flex items-center justify-center py-24">
        {/* Background Grid & Glow */}
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 max-w-xl mx-auto space-y-6 relative z-10 text-center shadow-sm text-slate-800">
          <div className="inline-flex bg-[#F27024]/10 p-4 rounded-full text-[#F27024] mb-2 border border-[#F27024]/20">
            <Users size={40} />
          </div>
          <h3 className="text-2xl font-bold text-slate-800">Bạn đã tham gia đội thi "{existingTeamName}"</h3>
          <p className="text-slate-600 max-w-md mx-auto text-sm leading-relaxed font-sans">
            Hệ thống ghi nhận bạn đã là thành viên chính thức của một đội thi đang hoạt động.
          </p>
          <div>
            <Link
              to="/team-area"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#F27024] hover:bg-[#d95f1f] !text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#F27024]/15"
            >
              Vào Khu vực Đội thi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="team-area-light relative overflow-hidden font-sans bg-[#faf9f6] text-slate-800 min-h-screen py-12">
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 font-mono">
          <div className="flex items-center gap-3 mb-8 text-left">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800">
                <span className="text-[#F27024] font-mono-tech">ĐĂNG KÝ ĐỘI THI</span>
              </h1>
              <p className="text-slate-500 text-sm mt-1 font-sans">Thành lập nhóm và mời các thành viên tham gia</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-3xl text-center mb-8 border border-slate-200 space-y-4 shadow-sm text-slate-800">
            <div className="inline-flex bg-[#F27024]/10 p-4 rounded-full text-[#F27024] mb-2 border border-[#F27024]/20">
              <Calendar size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
              Hiện đang không có cuộc thi nào mở đăng ký
            </h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed font-sans">
              Vui lòng theo dõi thông tin từ Ban tổ chức để cập nhật các sự kiện Hackathon mới nhất sắp diễn ra.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-area-light relative overflow-hidden font-sans bg-[#faf9f6] text-slate-800 min-h-screen">
      {/* Background Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>



      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 font-mono">

      <div className="flex items-center gap-3 mb-8">

        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            <span className="text-[#F27024] text-orange-glow font-mono-tech">ĐĂNG KÝ ĐỘI THI</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-sans">Thành lập nhóm và mời các thành viên tham gia (yêu cầu tối thiểu 3 thành viên bao gồm cả Trưởng nhóm)</p>
        </div>
      </div>

      {pendingInvitations.length > 0 && (
        <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-[#F27024]/40 shadow-lg text-slate-800 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-[#F27024] text-white rounded-2xl shadow-md shrink-0 mt-0.5">
                <Mail size={24} />
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#F27024]/20 text-[#F27024] text-[10px] font-black uppercase tracking-wider mb-1">
                  LỜI MỜI THAM GIA ĐỘI THI
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Bạn đang có lời mời vào đội{' '}
                  <span className="text-[#F27024] font-black">
                    "{pendingInvitations[0].teamName}"
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 font-sans">
                  Mời bởi Trưởng nhóm:{' '}
                  <strong>{pendingInvitations[0].leaderName}</strong> ({pendingInvitations[0].leaderEmail}). Vui lòng kiểm tra email để xác nhận tham gia.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenEmail(pendingInvitations[0].leaderEmail)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#F27024] text-white font-extrabold text-xs uppercase tracking-wider shadow-md hover:bg-[#d95f1f] hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <Mail size={16} />
              <span>Mở Email xác nhận</span>
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      )}

      {success ? (
        <div className="glass glow-blue p-8 rounded-3xl text-center mb-8 border-emerald-500/30 font-mono">
          <div className="inline-flex bg-emerald-500/20 p-4 rounded-full text-emerald-400 mb-4 border border-emerald-500/30">
            <CheckCircle size={40} />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">ĐĂNG KÝ NHÓM THÀNH CÔNG</h3>
          <p className="text-slate-300 max-w-md mx-auto mb-6">{success}</p>
          <div className="inline-flex items-center gap-2 text-sm text-cyan-400 animate-pulse">
            <span>Đang chuyển hướng về Khu vực Đội thi...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Excel Import Card */}
          <div className="glass p-6 rounded-2xl space-y-4 border border-slate-800 hover:border-cyan-500/30 transition-all relative z-[3] mb-8 font-mono">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 font-mono-tech">
              <FileSpreadsheet size={18} className="text-cyan-400" />
              <span className="text-cyan-400">ĐĂNG KÝ BẰNG FILE EXCEL</span>
            </h2>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between text-xs text-slate-500 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1 text-left">
                <p className="font-bold text-slate-800 uppercase tracking-wider">Tải File Excel Mẫu</p>
                <p className="text-[11px]">Điền đầy đủ thông tin trưởng nhóm & các thành viên theo mẫu chuẩn.</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="btn-fpt flex items-center gap-2 px-4 py-2 font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer text-[10px]"
              >
                <Download size={14} />
                Tải file mẫu
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Chọn file Excel đăng ký</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                      id="excel-file-upload"
                    />
                    <label
                      htmlFor="excel-file-upload"
                      className="flex items-center gap-2 w-full bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs hover:border-[#F27024]/50 hover:text-slate-900 transition-all font-mono cursor-pointer"
                    >
                      <Upload size={14} className="text-[#F27024]" />
                      {importFile ? importFile.name : 'Chọn file .xlsx hoặc .xls'}
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={importing || !importFile || !selectedEventId}
                    className="btn-primary font-bold px-6 py-2 rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? 'Đang import...' : 'Bắt đầu Import'}
                  </button>
                </div>
              </div>
            </form>

            {importSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-emerald-400 text-xs font-mono">
                {importSuccess}
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/35 p-4 rounded-xl text-rose-400 text-xs space-y-1 max-h-48 overflow-y-auto">
                <p className="font-bold flex items-center gap-1.5 uppercase text-white mb-2 font-mono">
                  <AlertTriangle size={14} className="text-rose-400" /> Lỗi phân tích dữ liệu Excel:
                </p>
                {importErrors.map((err, idx) => (
                  <p key={idx} className="font-mono text-[11px]">{err}</p>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 uppercase tracking-widest text-center my-6 flex items-center justify-center gap-4">
            <span className="h-px bg-slate-800 flex-1"></span>
            <span>HOẶC ĐĂNG KÝ THỦ CÔNG</span>
            <span className="h-px bg-slate-800 flex-1"></span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">

          {selectedEvent && selectedEvent.maxTeams && (selectedEvent.teamCount || 0) >= selectedEvent.maxTeams && (
            <div className="bg-rose-500/10 border border-rose-500/35 p-5 rounded-2xl text-rose-400 text-xs font-mono flex items-center gap-3">
              <div>
                <strong className="text-white block uppercase tracking-wider mb-1">Đăng ký đã đầy!</strong>
                Cuộc thi "{selectedEvent.name}" đã đạt giới hạn đăng ký tối đa ({selectedEvent.teamCount}/{selectedEvent.maxTeams} đội).
                Vui lòng liên hệ Ban tổ chức hoặc chọn một sự kiện khác.
              </div>
            </div>
          )}

          {/* Step 1: Event & Team Info */}
          <div className="glass p-6 rounded-2xl space-y-6 border border-slate-800 hover:border-cyan-500/30 transition-all relative z-[3]">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 font-mono-tech">
              <Calendar size={18} className="text-cyan-400" />
              <span className="text-cyan-400">1. THÔNG TIN CHUNG</span>
            </h2>



            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Lựa chọn Cuộc thi
                </label>
                <CustomSelect
                  value={selectedEventId}
                  onChange={(val: any) => setSelectedEventId(val)}
                  options={events.map((e) => ({
                    value: e._id,
                    label: `${e.name} (${e.semester} ${e.year})`,
                  }))}
                  placeholder="Chọn cuộc thi..."
                  className="w-full font-mono"
                />
              </div>

              {pastTeams.length > 0 && (
                <div className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/20 space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-orange-500">
                    Tái sử dụng thông tin đội cũ
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <CustomSelect
                      value={selectedPastTeamId}
                      onChange={(val: any) => setSelectedPastTeamId(val)}
                      options={pastTeams.map((t) => ({
                        value: t._id,
                        label: `${t.name} (Sự kiện: ${t.event?.name || "Không rõ"})`,
                      }))}
                      placeholder="Chọn đội cũ..."
                      className="flex-1 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPastTeam}
                      disabled={!selectedPastTeamId}
                      className="bg-[#F27024] hover:bg-[#e05e1b] disabled:bg-slate-200 disabled:text-slate-400 disabled:border-transparent text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all uppercase tracking-wider cursor-pointer border border-orange-500/30 shadow-md active:scale-95 shrink-0"
                    >
                      Áp dụng
                    </button>
                  </div>
                  {infoMessage && (
                    <p className="text-[10px] text-orange-500 font-mono italic mt-1">{infoMessage}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Tên Nhóm thi đấu <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  placeholder="Nhập tên nhóm của bạn"
                  value={teamName}
                  onChange={e => {
                    const val = e.target.value;
                    setTeamName(val);
                    setTeamNameCheckingStatus('idle');
                    setTeamNameCheckingMessage('');

                    if (teamNameTimer.current) {
                      clearTimeout(teamNameTimer.current);
                    }

                    const trimmed = val.trim();
                    if (!trimmed) return;

                    // Debounce kiểm tra tên nhóm sau 800ms
                    teamNameTimer.current = setTimeout(() => {
                      handleCheckTeamName(trimmed);
                    }, 800);
                  }}
                  onBlur={() => {
                    const trimmed = teamName.trim();
                    if (!trimmed) return;

                    if (teamNameTimer.current) {
                      clearTimeout(teamNameTimer.current);
                    }

                    if (teamNameCheckingStatus === 'idle') {
                      handleCheckTeamName(trimmed);
                    }
                  }}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white pl-4 pr-24 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                />
                {teamNameCheckingStatus === 'checking' && (
                  <span className="absolute right-4 text-xs text-cyan-400 font-mono animate-pulse select-none">
                    Đang check...
                  </span>
                )}
              </div>
              {teamNameCheckingMessage && (
                <p className={`text-[10px] font-mono italic mt-1.5 ${
                  teamNameCheckingStatus === 'eligible' ? 'text-emerald-400' :
                  teamNameCheckingStatus === 'conflict' ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {teamNameCheckingMessage}
                </p>
              )}
            </div>
          </div>

          {/* Step 2: Leader Profile Capture */}
          <div className="glass p-6 rounded-2xl space-y-6 border border-slate-800 hover:border-cyan-500/30 transition-all relative z-[2]">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 font-mono-tech">
              <Users size={18} className="text-cyan-400" />
              <span className="text-cyan-400">2. THÔNG TIN TRƯỞNG NHÓM</span>
            </h2>
            <p className="text-xs text-slate-400">
              * Điền chính xác thông tin cá nhân của bạn. <strong>GitHub Username</strong> bắt buộc đúng để truy cập vào Repository của nhóm.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Email Trưởng Nhóm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={leaderEmail}
                  readOnly
                  title="Trưởng nhóm là tài khoản đang đăng nhập"
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="Email Trưởng nhóm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Họ và Tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={leaderFullName}
                  onChange={e => setLeaderFullName(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="Họ và Tên của bạn"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  MSSV (Mã số sinh viên)
                </label>
                <input
                  type="text"
                  value={leaderStudentId}
                  onChange={e => setLeaderStudentId(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="Ví dụ: SE1XXXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  GitHub Username <span className="text-rose-500">*</span>
                </label>
                <GithubUserAutocomplete
                  value={leaderGithubUsername}
                  onChange={setLeaderGithubUsername}
                  className="bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="github-username của bạn"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Trường Đại học
                </label>
                <UniversityCombobox
                  value={leaderUniversity}
                  onChange={setLeaderUniversity}
                  placeholder="Nhập hoặc chọn trường..."
                  className="w-full"
                  inputClassName="bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Chiều cao (cm) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={leaderHeight}
                  onChange={e => setLeaderHeight(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="Ví dụ: 170"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Cân nặng (kg) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={leaderWeight}
                  onChange={e => setLeaderWeight(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="Ví dụ: 60"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Member invites */}
          <div className="glass p-6 rounded-2xl space-y-6 border border-slate-800 hover:border-cyan-500/30 transition-all relative z-[1]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-mono-tech">
                <FolderGit2 size={18} className="text-cyan-400" />
                <span className="text-cyan-400">3. THÀNH VIÊN NHÓM</span>
              </h2>
              <button
                type="button"
                onClick={addMemberRow}
                className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 transition-all cursor-pointer"
              >
                <UserPlus size={14} />
                <span>Thêm thành viên</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              * Điền thông tin thành viên dưới đây. Hệ thống sẽ gửi email yêu cầu xác nhận tham gia.
            </p>

            <div className="space-y-4">
              {members.map((member, index) => {
                const cardZIndex = members.length - index;
                return (
                  <div key={index} className="glass-light p-4 rounded-xl border border-slate-800/80 relative" style={{ zIndex: cardZIndex }}>
                    <div className="absolute right-4 top-4">
                      {members.length > 0 && (
                        <button
                          type="button"
                          onClick={() => removeMemberRow(index)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded-md transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-slate-300">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400">Email <span className="text-rose-500">*</span></label>
                        <div className="relative flex items-center">
                          <input
                            type="email"
                            required
                            placeholder="member@student.edu.vn"
                            value={member.email}
                            onChange={e => {
                              const val = e.target.value;
                              
                              // Cập nhật giá trị tức thời trong state
                              setMembers(prev => {
                                if (!prev[index]) return prev;
                                const updated = [...prev];
                                updated[index] = {
                                  ...updated[index],
                                  email: val,
                                  checkingStatus: 'idle',
                                  checkingMessage: ''
                                };
                                return updated;
                              });

                              // Dọn dẹp timer cũ
                              if (checkTimers.current[index]) {
                                clearTimeout(checkTimers.current[index]);
                              }

                              const trimmed = val.trim();
                              if (!trimmed) return;

                              // Debounce tự động kiểm tra sau 800ms nếu email đúng định dạng
                              checkTimers.current[index] = setTimeout(() => {
                                const currentEmail = membersRef.current[index]?.email || '';
                                if (currentEmail.trim() === trimmed) {
                                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                  if (emailRegex.test(trimmed)) {
                                    handleCheckEligibility(index, trimmed);
                                  }
                                }
                              }, 800);
                            }}
                            onBlur={() => {
                              const trimmed = member.email.trim();
                              if (!trimmed) return;

                              // Dọn dẹp timer cũ để không chạy trùng lặp
                              if (checkTimers.current[index]) {
                                clearTimeout(checkTimers.current[index]);
                              }

                              // Chỉ kích hoạt check ngay lập tức nếu trạng thái đang là 'idle' và email hợp lệ
                              if (member.checkingStatus === 'idle') {
                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                  if (emailRegex.test(trimmed)) {
                                    handleCheckEligibility(index, trimmed);
                                  }
                                }
                              }}
                            className="w-full bg-slate-900/50 border border-slate-800 text-white pl-3 pr-20 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                          />
                          {member.checkingStatus === 'checking' && (
                            <span className="absolute right-3 text-[10px] text-cyan-400 font-mono animate-pulse select-none">
                              Đang check...
                            </span>
                          )}
                        </div>
                        {member.checkingMessage && (
                          <p className={`text-[10px] font-mono italic mt-1 ${member.checkingStatus === 'eligible' ? 'text-emerald-400' :
                              member.checkingStatus === 'conflict' ? 'text-rose-400' : 'text-slate-400'
                            }`}>
                            {member.checkingMessage}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Họ Tên <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          required
                          placeholder="Họ và Tên"
                          value={member.fullName}
                          onChange={e => handleMemberChange(index, 'fullName', e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">GitHub Username <span className="text-rose-500">*</span></label>
                        <GithubUserAutocomplete
                          value={member.githubUsername}
                          onChange={val => handleMemberChange(index, 'githubUsername', val)}
                          className="bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                          placeholder="github-username"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">MSSV (Mã số sinh viên)</label>
                        <input
                          type="text"
                          placeholder="SE18XXXX"
                          value={member.studentId}
                          onChange={e => handleMemberChange(index, 'studentId', e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400">Trường Đại học</label>
                        <UniversityCombobox
                          value={member.university}
                          onChange={(val) => {
                            const updated = [...members];
                            updated[index].university = val;
                            setMembers(updated);
                          }}
                          placeholder="Nhập hoặc chọn trường..."
                          className="w-full"
                          inputClassName="bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Chiều cao (cm) <span className="text-rose-500">*</span></label>
                        <input
                          type="number"
                          required
                          placeholder="Ví dụ: 170"
                          value={member.height}
                          onChange={e => handleMemberChange(index, 'height', e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Cân nặng (kg) <span className="text-rose-500">*</span></label>
                        <input
                          type="number"
                          required
                          placeholder="Ví dụ: 60"
                          value={member.weight}
                          onChange={e => handleMemberChange(index, 'weight', e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CAPTCHA Verification */}
          {captchaSvg && (
            <div className="pt-2 max-w-sm ml-auto">
              <CaptchaInput
                captchaSvg={captchaSvg}
                value={captchaValue}
                onChange={setCaptchaValue}
                onRefresh={fetchCaptcha}
                disabled={loading}
              />
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !!(selectedEvent && selectedEvent.maxTeams && (selectedEvent.teamCount || 0) >= selectedEvent.maxTeams)}
              className="btn-primary font-bold text-sm px-12 py-4 uppercase tracking-widest flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'ĐANG GỬI THÔNG TIN...' : 'XÁC NHẬN ĐĂNG KÝ'}
            </button>
          </div>

        </form>
        </>
      )}

      </div>
    </div>
  );
}
