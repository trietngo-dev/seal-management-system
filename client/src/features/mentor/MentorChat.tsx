import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { Send, Users, User, Quote, Forward, MoreHorizontal, X, ArrowLeft, MessageSquare, Search, Megaphone, MessagesSquare, MessageCircle, Paperclip, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from "../shared/ConfirmDialog";

interface Message {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRecalled?: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  replyTo?: {
    messageId: string;
    senderName: string;
    content: string;
  };
}

interface ChatMember {
  id?: string;
  _id?: string;
  fullName: string;
  role?: string;
  avatar?: string;
}

interface ChatRoom {
  _id: string;
  teamId?: { 
    _id: string; 
    name: string; 
    mentorId?: { _id: string; fullName: string; email: string } 
  };
  mentorId?: { _id: string; fullName: string; email: string };
  trackId?: { _id: string; name: string };
  eventId?: { _id: string; name: string; status: string };
  type: 'team_mentor' | 'track_mentors' | 'event_general';
  members: ChatMember[];
}

interface MentorChatProps {
  roles?: any[];
  isSystemAdmin?: boolean;
}

const ENDED_EVENT_STATUSES = ['completed', 'cancelled'];

function decodeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export default function MentorChat({ roles = [], isSystemAdmin = false }: MentorChatProps) {
  const confirm = useConfirm();
  const apiBase = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  } | null>(null);

  const uploadAttachedFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Tệp đính kèm không được vượt quá 20MB.");
      return;
    }

    setUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem('token');

    try {
      const res = await axios.post(`${apiBase}/api/chat/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      setAttachedFile({
        fileUrl: res.data.fileUrl,
        fileName: res.data.fileName,
        fileSize: res.data.fileSize,
        fileType: res.data.fileType,
      });
      toast.success("Tải lên tệp đính kèm thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi tải lên tệp đính kèm.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAttachedFile(file);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const renamedFile = new File([file], `Screenshot_${Date.now()}.png`, { type: file.type });
          await uploadAttachedFile(renamedFile);
        }
      }
    }
  };

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<{ [roomId: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [mentorTeams, setMentorTeams] = useState<any[]>([]);


  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Zalo reply & menu actions
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const selectedRoomRef = useRef<ChatRoom | null>(null);
  const currentUserRef = useRef<any>(null);
  const pendingSelectRoomRef = useRef<{ teamId?: string; trackId?: string } | null>(null);
  const coordinatorEventIds = new Set(
    roles
      .filter((r) => r.role === 'coordinator')
      .map((r) => (typeof r.eventId === 'object' ? r.eventId?._id : r.eventId)?.toString())
      .filter(Boolean)
  );

  const isRoomReadOnly = (room: ChatRoom | null) =>
    !!room && ENDED_EVENT_STATUSES.includes(room.eventId?.status || '');

  const isRoomVisible = (room: ChatRoom) => {
    const status = room.eventId?.status;
    const eventId = room.eventId?._id?.toString();
    if (ENDED_EVENT_STATUSES.includes(status || '')) {
      return isSystemAdmin || (eventId ? coordinatorEventIds.has(eventId) : false);
    }
    return status === 'ongoing';
  };

  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.08, start);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      const now = audioCtx.currentTime;
      playTone(783.99, now, 0.12);
      playTone(1046.50, now + 0.08, 0.20);
    } catch (error) {
      console.warn("AudioContext failed to play sound:", error);
    }
  };

  const showDesktopNotification = (msg: Message) => {
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try {
        new Notification(`Tin nhắn mới từ ${msg.senderName}`, {
          body: msg.content,
          icon: "/favicon.ico"
        });
      } catch (err) {
        console.warn("Failed to create desktop notification:", err);
      }
    }
  };

  const fetchRooms = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const resRooms = await axios.get(`${apiBase}/api/chat/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const visibleRooms = resRooms.data.filter((r: ChatRoom) => isRoomVisible(r));
      setRooms(visibleRooms);

      // Auto-select room if only 1 exists
      if (visibleRooms.length === 1 && !selectedRoomRef.current) {
        setSelectedRoom(visibleRooms[0]);
      }
    } catch (error) {
      console.error("Error fetching chat rooms:", error);
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);

    // Fetch currentUser profile
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await axios.get(`${apiBase}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCurrentUser(res.data.user);
        }
      } catch (err) {
        console.error("Error fetching user profile in chat:", err);
      }
    };
    const fetchMentorTeams = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await axios.get(`${apiBase}/api/chat/mentor/teams`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setMentorTeams(res.data || []);
        }
      } catch (err) {
        console.error("Error fetching mentor teams:", err);
      }
    };

    fetchUser();
    fetchRooms();
    fetchMentorTeams();

    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Setup socket connection whenever currentUser changes (post-login)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !currentUser) return;

    const socketUrl = apiBase;
    const newSocket = io(socketUrl, {
      auth: { token }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser]);

  // Listen to open_chat_room events from other components
  useEffect(() => {
    const handleOpenRoom = (e: Event) => {
      const customEvent = e as CustomEvent;
      const teamId = customEvent.detail?.teamId;
      const trackId = customEvent.detail?.trackId;

      setIsOpen(true);

      if (rooms.length > 0) {
        let targetRoom;
        if (teamId) {
          targetRoom = rooms.find(r => r.teamId && r.teamId._id === teamId);
        } else if (trackId) {
          targetRoom = rooms.find(r => r.type === 'track_mentors' && r.trackId && r.trackId._id === trackId);
        }
        if (targetRoom) {
          setSelectedRoom(targetRoom);
        }
      } else {
        pendingSelectRoomRef.current = { teamId, trackId };
      }
    };

    window.addEventListener('open_chat_room', handleOpenRoom);
    return () => {
      window.removeEventListener('open_chat_room', handleOpenRoom);
    };
  }, [rooms]);

  // Handle pending select room once room list is loaded
  useEffect(() => {
    if (rooms.length > 0 && pendingSelectRoomRef.current) {
      const { teamId, trackId } = pendingSelectRoomRef.current;
      let targetRoom;
      if (teamId) {
        targetRoom = rooms.find(r => r.teamId && r.teamId._id === teamId);
      } else if (trackId) {
        targetRoom = rooms.find(r => r.type === 'track_mentors' && r.trackId && r.trackId._id === trackId);
      }
      if (targetRoom) {
        setSelectedRoom(targetRoom);
        pendingSelectRoomRef.current = null;
      }
    }
  }, [rooms]);

  // Join all rooms for notification tracking
  useEffect(() => {
    if (socket && rooms.length > 0) {
      rooms.forEach(room => {
        socket.emit('join_room', room._id);
      });
    }
  }, [socket, rooms]);

  // Socket event listeners
  useEffect(() => {
    if (socket) {
      socket.on('connect', () => setIsConnected(true));
      socket.on('disconnect', () => setIsConnected(false));
      socket.on('error', (err: any) => console.error("Socket error:", err));

      socket.on('new_message', (message: Message) => {
        const decodedMessage = {
          ...message,
          content: decodeHTML(message.content),
          replyTo: message.replyTo ? {
            ...message.replyTo,
            content: decodeHTML(message.replyTo.content)
          } : undefined
        };
        const activeR = selectedRoomRef.current;
        if (activeR && decodedMessage.roomId === activeR._id) {
          setMessages(prev => {
            if (prev.find(m => m._id === decodedMessage._id)) return prev;
            return [...prev, decodedMessage];
          });

          const isMsgFromMe = currentUserRef.current && (
            currentUserRef.current.userId === decodedMessage.senderId ||
            currentUserRef.current._id === decodedMessage.senderId ||
            currentUserRef.current.id === decodedMessage.senderId
          );
          if (!isMsgFromMe) {
            playNotificationSound();
          }

          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else {
          const isMsgFromMe = currentUserRef.current && (
            currentUserRef.current.userId === decodedMessage.senderId ||
            currentUserRef.current._id === decodedMessage.senderId ||
            currentUserRef.current.id === decodedMessage.senderId
          );
          if (!isMsgFromMe) {
            setUnreadCounts(prev => ({
              ...prev,
              [decodedMessage.roomId]: (prev[decodedMessage.roomId] || 0) + 1
            }));
            playNotificationSound();
            showDesktopNotification(decodedMessage);
          }
        }
      });

      socket.on('message_recalled', (data: { messageId: string; roomId: string; content: string }) => {
        setMessages(prev => prev.map(m =>
          m._id === data.messageId ? { ...m, isRecalled: true, content: decodeHTML(data.content) } : m
        ));
      });
    }
    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('error');
        socket.off('new_message');
        socket.off('message_recalled');
      }
    };
  }, [socket]);

  // Fetch messages for a selected room
  const fetchMessages = async (roomId: string, pageNum = 1) => {
    try {
      setLoadingMessages(true);
      const token = localStorage.getItem('token');
      const resMsgs = await axios.get(`${apiBase}/api/chat/rooms/${roomId}/messages?page=${pageNum}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const rawMsgs = resMsgs.data || [];
      const decodedMsgs = rawMsgs.map((m: any) => ({
        ...m,
        content: decodeHTML(m.content),
        replyTo: m.replyTo ? {
          ...m.replyTo,
          content: decodeHTML(m.replyTo.content)
        } : undefined
      }));

      if (pageNum === 1) {
        setMessages(decodedMsgs);
        setHasMore(decodedMsgs.length === 50);
        setPage(1);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 100);
      } else {
        const prevScrollHeight = messagesContainerRef.current?.scrollHeight || 0;
        setMessages(prev => [...decodedMsgs, ...prev]);
        setHasMore(decodedMsgs.length === 50);
        setPage(pageNum);
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight;
            messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
          }
        }, 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom._id, 1);
      setUnreadCounts(prev => ({
        ...prev,
        [selectedRoom._id]: 0
      }));
    } else {
      setMessages([]);
    }
  }, [selectedRoom]);

  const loadMoreMessages = () => {
    if (!selectedRoom || !hasMore || loadingMessages) return;
    fetchMessages(selectedRoom._id, page + 1);
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop } = messagesContainerRef.current;
      if (scrollTop === 0) {
        loadMoreMessages();
      }
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Đã sao chép tin nhắn vào bộ nhớ tạm");
  };

  const handleDeleteLocally = (messageId: string) => {
    setMessages(prev => prev.filter(m => m._id !== messageId));
    toast.success("Đã xóa tin nhắn phía bạn");
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachedFile) || !selectedRoom || !socket) return;

    if (isRoomReadOnly(selectedRoom)) {
      toast.error('Cuộc thi đã kết thúc. Chỉ có thể xem lịch sử chat.');
      return;
    }

    socket.emit('send_message', {
      roomId: selectedRoom._id,
      content: newMessage.trim(),
      fileAttachment: attachedFile || undefined,
      replyTo: replyingTo ? {
        messageId: replyingTo._id,
        senderName: replyingTo.senderName,
        content: replyingTo.content
      } : undefined
    });

    setNewMessage('');
    setAttachedFile(null);
    setReplyingTo(null);
  };

  const recallMessage = async (messageId: string) => {
    if (!socket || !selectedRoom) return;
    const confirmed = await confirm({
      title: "Xác nhận thu hồi",
      message: "Bạn có chắc chắn muốn thu hồi tin nhắn này?"
    });
    if (confirmed) {
      socket.emit('recall_message', { messageId, roomId: selectedRoom._id });
    }
  };

  const handleStartChatWithTeam = async (teamId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.post(`${apiBase}/api/chat/rooms/team`, { teamId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const room = res.data;
      setRooms(prev => {
        if (prev.find(r => r._id === room._id)) return prev;
        return [room, ...prev];
      });
      setSelectedRoom(room);
      if (socket) {
        socket.emit('join_room', room._id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể bắt đầu chat với đội thi này.");
    }
  };

  const getRoomName = (room: ChatRoom) => {
    const archivedSuffix = ENDED_EVENT_STATUSES.includes(room.eventId?.status || '')
      ? ' (Lưu trữ)'
      : '';
    if (room.type === 'event_general') {
      return `Kênh Chung - ${room.eventId?.name || 'Cuộc thi'}${archivedSuffix}`;
    }
    if (room.type === 'track_mentors') {
      return `Kênh Mentor - Bảng ${room.trackId?.name || 'Chung'}${archivedSuffix}`;
    }

    const isTeamMember = room.members && room.members.some(m =>
      m.id === currentUser?.id ||
      m._id === currentUser?.id ||
      m.id === currentUser?.userId ||
      m._id === currentUser?.userId
    );

    if (isTeamMember) {
      const mentorName = room.mentorId?.fullName || room.teamId?.mentorId?.fullName;
      return mentorName ? `Mentor: ${mentorName}${archivedSuffix}` : `Hỗ trợ từ Mentor${archivedSuffix}`;
    }
    return `Đội thi: ${room.teamId?.name || 'Đội thi'}${archivedSuffix}`;
  };

  const filteredRooms = rooms.filter(room => {
    const roomName = getRoomName(room).toLowerCase();
    return roomName.includes(searchQuery.toLowerCase());
  });

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  if (rooms.length === 0) {
    return null; // Don't show chat widget if the user has no rooms assigned
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Chat Bubble Button */}
      {!isOpen && (
        <button
          id="floating-chat-trigger"
          onClick={() => setIsOpen(true)}
          className={`relative w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 hover:bg-[#d95f1f] transition-all duration-200 cursor-pointer border border-primary/10 ${
            totalUnread > 0
              ? 'animate-pulse ring-4 ring-[#F27024]/30 shadow-[0_0_20px_rgba(242,112,36,0.4)]'
              : 'hover:shadow-lg'
          }`}
        >
          <MessageSquare className="w-6 h-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white shadow-md animate-bounce">
              {totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div className="w-screen h-screen sm:w-[380px] sm:h-[550px] fixed inset-0 sm:relative sm:inset-auto bg-white border-0 sm:border border-slate-250 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">

          {/* Header */}
          {(() => {
            const isTeamRoom = selectedRoom && selectedRoom.type === 'team_mentor';
            return (
              <div className={`px-4 py-3.5 border-b flex items-center justify-between transition-all duration-300 ${isTeamRoom
                ? 'bg-primary/5 border-slate-200'
                : 'bg-slate-50 border-slate-200'
                }`}>
                {selectedRoom ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {rooms.length > 1 && (
                      <button
                        onClick={() => setSelectedRoom(null)}
                        className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        <ArrowLeft size={16} />
                      </button>
                    )}
                    <div className="truncate flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(() => {
                          let headerTitle = getRoomName(selectedRoom);
                          if (isTeamRoom) {
                            const isTeamMember = selectedRoom.members && selectedRoom.members.some(m =>
                              m.id === currentUser?.id ||
                              m._id === currentUser?.id ||
                              m.id === currentUser?.userId ||
                              m._id === currentUser?.userId
                            );
                            if (isTeamMember) {
                              const mentorName = selectedRoom.mentorId?.fullName || selectedRoom.teamId?.mentorId?.fullName;
                              headerTitle = mentorName ? `Cố vấn: ${mentorName}` : 'Hỗ trợ từ Mentor';
                            } else {
                              headerTitle = selectedRoom.teamId?.name || 'Đội thi';
                            }
                          }
                          return (
                            <h4 className="text-sm font-bold text-slate-800 truncate">
                              {headerTitle}
                            </h4>
                          );
                        })()}
                        {selectedRoom.type === 'event_general' && (
                          <span className="shrink-0 bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                            Chung
                          </span>
                        )}
                        {selectedRoom.type === 'track_mentors' && (
                          <span className="shrink-0 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                            Mentor
                          </span>
                        )}
                        {selectedRoom.type === 'team_mentor' && (
                          <span className="shrink-0 bg-primary/10 text-primary border border-primary/20 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                            Đội thi
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
                        <span className="text-xs text-slate-500">
                          {selectedRoom.type === 'track_mentors'
                            ? `${selectedRoom.members.length} mentor`
                            : isConnected ? 'Trực tuyến' : 'Ngoại tuyến'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Hộp thoại hỗ trợ</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Trao đổi trực tiếp với Mentor & Đội thi</p>
                  </div>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ml-2"
                >
                  <X size={18} />
                </button>
              </div>
            );
          })()}

          {/* Body */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {selectedRoom ? (
              /* Room Chat view */
              <>
                {/* Messages feed */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-white chat-scroll"
                >
                  {loadingMessages && page > 1 && (
                    <div className="text-center text-xs text-primary py-1">Đang tải tin nhắn cũ...</div>
                  )}

                  {messages.length === 0 && !loadingMessages ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-450 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Bắt đầu câu chuyện tại đây!</p>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const isMe = currentUser?.userId === msg.senderId || currentUser?._id === msg.senderId || currentUser?.id === msg.senderId;
                      const isRecalled = msg.isRecalled;
                      return (
                        <div key={msg._id || index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                            <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

                              {/* Small Initials Avatar */}
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${isMe ? 'bg-primary text-white shadow-xs' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                                {(msg?.senderName || "U").charAt(0).toUpperCase()}
                              </div>

                              {/* Message bubble */}
                              <div className="relative group/bubble flex items-center min-w-0 max-w-full">
                                <div className={`px-3 py-1.5 rounded-xl text-xs min-w-0 max-w-full ${isRecalled
                                  ? isMe
                                    ? 'border border-primary/10 bg-primary/5 text-slate-400 italic rounded-br-sm'
                                    : 'border border-slate-200 bg-slate-100 text-slate-400 italic rounded-bl-sm'
                                  : isMe
                                    ? 'bg-primary text-white rounded-br-sm shadow-xs'
                                    : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200 shadow-xs'
                                  }`}>

                                  {/* Reply reference */}
                                  {msg.replyTo && !isRecalled && (
                                    <div className="mb-1.5 px-2 py-1 rounded-sm bg-black/5 border-l-2 border-primary text-[10px] text-slate-600 max-w-full text-left">
                                      <div className="font-bold text-[9px] text-primary">@{msg.replyTo.senderName}</div>
                                      <div className="truncate text-slate-500 max-h-5">{msg.replyTo.content}</div>
                                    </div>
                                  )}

                                  {!isMe && (selectedRoom.type === 'track_mentors' || selectedRoom.members.length > 2) && (
                                    <div className="text-[9px] font-bold text-primary mb-0.5">{msg.senderName}</div>
                                  )}

                                  <div className="wrap-break-word break-all whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                                  {msg.fileUrl && !isRecalled && (() => {
                                    let fileUrlResolved = msg.fileUrl;
                                    if (fileUrlResolved.startsWith("http://localhost:5000")) {
                                      fileUrlResolved = fileUrlResolved.replace("http://localhost:5000", apiBase);
                                    } else if (!fileUrlResolved.startsWith("http://") && !fileUrlResolved.startsWith("https://")) {
                                      fileUrlResolved = `${apiBase}${fileUrlResolved.startsWith('/') ? '' : '/'}${fileUrlResolved}`;
                                    }
                                    
                                    return /(\.png|\.jpg|\.jpeg|\.gif)$/i.test(msg.fileUrl) ? (
                                      <div className="mt-1.5 rounded-lg overflow-hidden border border-black/5 max-w-xs bg-slate-100">
                                        <img
                                          src={fileUrlResolved}
                                          alt={msg.fileName}
                                          className="max-h-40 w-auto object-cover cursor-pointer hover:opacity-90"
                                          onClick={() => window.open(fileUrlResolved, '_blank')}
                                        />
                                      </div>
                                    ) : (
                                      <div className={`mt-1.5 p-2 rounded-lg border flex items-center gap-2 max-w-xs ${
                                        isMe ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                                      }`}>
                                        <FileText className="w-5 h-5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] font-bold truncate leading-tight">{msg.fileName || 'Tài liệu'}</p>
                                          <p className="text-[9px] opacity-70 leading-none">
                                            {msg.fileSize ? `${(msg.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Chưa rõ'}
                                          </p>
                                        </div>
                                        <a
                                          href={fileUrlResolved}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download={msg.fileName}
                                          className={`p-1 rounded hover:bg-black/10 shrink-0 ${
                                            isMe ? 'text-white' : 'text-slate-600'
                                          }`}
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Action Buttons on Hover */}
                                {!isRecalled && (
                                  <div className={`opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto transition-opacity duration-150 absolute ${isMe ? 'right-full pr-1.5' : 'left-full pl-1.5'
                                    } top-1/2 -translate-y-1/2 flex items-center z-10`}
                                  >
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 px-1 py-1 rounded-full shadow-md">

                                      {/* Quote Reply */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReplyingTo(msg);
                                        }}
                                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                        title="Trả lời"
                                      >
                                        <Quote size={10} className="fill-current" />
                                      </button>

                                      {/* Copy */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(msg.content);
                                        }}
                                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                        title="Sao chép"
                                      >
                                        <Forward size={11} />
                                      </button>

                                      {/* More Dropdown trigger */}
                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuId(activeMenuId === msg._id ? null : msg._id);
                                          }}
                                          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-100 text-primary hover:text-[#d95f1f] transition-colors cursor-pointer"
                                        >
                                          <MoreHorizontal size={11} />
                                        </button>

                                        {activeMenuId === msg._id && (
                                          <div
                                            onClick={(e) => e.stopPropagation()}
                                            className={`absolute ${isMe ? 'left-0' : 'right-0'
                                              } bottom-full mb-1.5 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-99 w-32 overflow-hidden`}
                                          >
                                            <button
                                              onClick={() => {
                                                handleCopy(msg.content);
                                                setActiveMenuId(null);
                                              }}
                                              className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                                            >
                                              Sao chép
                                            </button>
                                            {isMe && (
                                              <button
                                                onClick={() => {
                                                  recallMessage(msg._id);
                                                  setActiveMenuId(null);
                                                }}
                                                className="w-full text-left px-2.5 py-1.5 hover:bg-rose-50 text-[11px] text-rose-600 hover:text-rose-700 transition-colors cursor-pointer font-bold"
                                              >
                                                Thu hồi
                                              </button>
                                            )}
                                            <button
                                              onClick={() => {
                                                handleDeleteLocally(msg._id);
                                                setActiveMenuId(null);
                                              }}
                                              className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                            >
                                              Xóa phía tôi
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Timestamp */}
                            <span className={`text-[9px] text-slate-400 mt-0.5 ${isMe ? 'pr-7' : 'pl-7'}`}>
                              {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input block */}
                <div className="p-3 bg-white border-t border-slate-200">
                  {isRoomReadOnly(selectedRoom) ? (
                    <div className="text-center text-[10px] text-slate-400 py-2 uppercase tracking-wide">
                      Cuộc thi đã kết thúc — Chế độ xem lịch sử
                    </div>
                  ) : (
                    <>
                      {replyingTo && (
                        <div className="px-2.5 py-1.5 bg-slate-50 border-l-2 border-primary flex items-center justify-between text-xs text-slate-600 gap-2 mb-2 rounded-lg">
                          <div className="truncate flex-1">
                            <span className="text-primary font-bold">ĐANG TRẢ LỜI @{replyingTo.senderName}:</span>{" "}
                            <span className="italic text-slate-500 truncate">{replyingTo.content}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}

                      {attachedFile && (
                        <div className="px-2.5 py-1.5 bg-slate-50 border-l-2 border-cyan-500 flex items-center justify-between text-xs text-slate-600 gap-2 mb-2 rounded-lg">
                          <div className="truncate flex-1 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            <span className="font-bold text-cyan-500">TỆP ĐÍNH KÈM:</span>{" "}
                            <span className="italic text-slate-500 truncate">{attachedFile.fileName} ({(attachedFile.fileSize / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachedFile(null)}
                            className="text-slate-400 hover:text-slate-650 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}

                      <form onSubmit={sendMessage} className="flex gap-2 items-center">
                        <label className="p-2 border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors text-slate-500 hover:text-slate-700 flex items-center justify-center shrink-0">
                          {uploadingFile ? (
                            <span className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <Paperclip size={14} />
                          )}
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={uploadingFile}
                          />
                        </label>
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onPaste={handlePaste}
                          placeholder="Nhập tin nhắn..."
                          className="flex-1 chat-input-light border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 font-medium transition-all"
                        />
                        <button
                          type="submit"
                          disabled={(!newMessage.trim() && !attachedFile) || !isConnected}
                          className="bg-primary hover:bg-[#d95f1f] disabled:opacity-40 disabled:hover:bg-primary text-white p-2 rounded-xl transition-colors flex items-center justify-center cursor-pointer shadow-xs shadow-[#F27024]/10"
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Rooms List view */
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                {/* Search Bar */}
                {rooms.length > 5 && (
                  <div className="p-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
                    <Search size={14} className="text-slate-450" />
                    <input
                      type="text"
                      placeholder="Tìm phòng chat..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-slate-700 focus:outline-hidden placeholder:text-slate-400"
                    />
                  </div>
                )}

                {/* Room Cards list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {filteredRooms.length === 0 && mentorTeams.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-450 text-xs">
                      Không tìm thấy phòng nào.
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const generalRooms = filteredRooms.filter(r => r.type === 'event_general');
                        const trackRooms = filteredRooms.filter(r => r.type === 'track_mentors');
                        const teamRooms = filteredRooms.filter(r => r.type === 'team_mentor');

                        const renderRoomCard = (room: ChatRoom) => {
                          const roomUnread = unreadCounts[room._id] || 0;
                          const isHighlighted = roomUnread > 0;
                          const isTeamRoom = room.type === 'team_mentor';
                          const archivedSuffix = ENDED_EVENT_STATUSES.includes(room.eventId?.status || '') ? ' (Lưu trữ)' : '';
                          
                          // Custom display title & subtitle
                          let title = getRoomName(room);
                          let subtitle = '';
                          let icon = <Users size={15} />;
                          let iconBg = 'bg-primary/10 text-primary';
                          
                          if (room.type === 'event_general') {
                            title = room.eventId?.name || 'Cuộc thi';
                            subtitle = 'Thảo luận chung toàn cuộc thi';
                            icon = <Megaphone size={15} />;
                            iconBg = 'bg-amber-100 text-amber-700';
                          } else if (room.type === 'track_mentors') {
                            title = `Bảng ${room.trackId?.name || 'Chung'}`;
                            subtitle = 'Trao đổi nội bộ giữa các Mentor';
                            icon = <MessagesSquare size={15} />;
                            iconBg = 'bg-indigo-100 text-indigo-700';
                          } else if (isTeamRoom) {
                            const isTeamMember = room.members && room.members.some(m =>
                              m.id === currentUser?.id ||
                              m._id === currentUser?.id ||
                              m.id === currentUser?.userId ||
                              m._id === currentUser?.userId
                            );
                            
                            if (isTeamMember) {
                              const mentorName = room.mentorId?.fullName || room.teamId?.mentorId?.fullName;
                              title = mentorName ? `Mentor: ${mentorName}` : 'Hỗ trợ từ Mentor';
                              subtitle = `Đội thi: ${room.teamId?.name || 'Đội thi'}`;
                              icon = <User size={15} />;
                              iconBg = 'bg-emerald-100 text-emerald-700';
                            } else {
                              title = room.teamId?.name || 'Đội thi';
                              const mentorName = room.mentorId?.fullName || room.teamId?.mentorId?.fullName;
                              subtitle = mentorName ? `Cố vấn: ${mentorName}` : 'Chưa phân cố vấn';
                              icon = <MessageCircle size={15} />;
                              iconBg = 'bg-primary/10 text-primary';
                            }
                          }
                          
                          return (
                            <div
                              key={room._id}
                              onClick={() => setSelectedRoom(room)}
                              className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group mb-2 border relative ${
                                isHighlighted
                                  ? 'bg-primary/5 border-primary/30 shadow-xs hover:bg-primary/10'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                              }`}
                            >
                              {isHighlighted && (
                                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">

                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                </span>
                              )}
                              
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                                  {icon}
                                </div>
                                <div className="truncate flex-1 min-w-0">
                                  <p className={`text-xs font-bold truncate transition-colors ${
                                    isHighlighted ? 'text-primary' : 'text-slate-800 group-hover:text-primary'
                                  }`}>
                                    {title}{archivedSuffix}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {subtitle}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5 pl-2 shrink-0">
                                {roomUnread > 0 ? (
                                  <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce shadow-xs">
                                    {roomUnread}
                                  </span>
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-primary/40 transition-colors"></span>
                                )}
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-4">
                            {/* Group 1: General channels */}
                            {generalRooms.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-normal px-2 mb-1.5">
                                  <Megaphone size={10} className="text-slate-400" /> Kênh Chung cuộc thi
                                </div>
                                {generalRooms.map(renderRoomCard)}
                              </div>
                            )}

                            {/* Group 2: Mentor channels */}
                            {trackRooms.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-normal px-2 mb-1.5 mt-2">
                                  <MessagesSquare size={10} className="text-slate-400" /> Kênh Thảo Luận Mentor
                                </div>
                                {trackRooms.map(renderRoomCard)}
                              </div>
                            )}

                            {/* Group 3: Team-mentor channels */}
                            {teamRooms.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-normal px-2 mb-1.5 mt-2">
                                  <MessageCircle size={10} className="text-slate-400" />{' '}
                                  {isSystemAdmin || roles.some(r => r.role === 'mentor')
                                    ? 'Đội thi đang hỗ trợ'
                                    : 'Trò chuyện với Mentor'}
                                </div>
                                {teamRooms.map(renderRoomCard)}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {mentorTeams.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-normal px-2 mb-2 flex items-center gap-1">
                            <User size={10} /> Đội thi thuộc bảng đấu của bạn
                          </p>
                          <div className="space-y-1.5">
                            {mentorTeams.map(t => {
                              return (
                                <div
                                  key={t._id}
                                  onClick={() => handleStartChatWithTeam(t._id)}
                                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer bg-slate-50 mb-1 shadow-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                      {t.name.charAt(0)}
                                    </div>
                                    <div className="truncate flex-1 min-w-0">
                                      <p className="text-xs font-bold text-slate-800 truncate">{t.name}</p>
                                      <p className="text-[10px] text-slate-500 truncate">{t.trackName}</p>
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md uppercase shrink-0">Chat</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
