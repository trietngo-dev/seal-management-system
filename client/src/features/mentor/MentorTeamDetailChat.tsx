import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { Send, MessageCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRecalled?: boolean;
  replyTo?: {
    messageId: string;
    senderName: string;
    content: string;
  };
}

interface ChatRoom {
  _id: string;
  teamId?: any;
  type: string;
  members: any[];
}

interface Props {
  team: any;
  token: string | null;
}

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

export default function MentorTeamDetailChat({ team, token }: Props) {
  const apiBase = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch or create chat room and load messages
  useEffect(() => {
    if (!team?._id || !token) return;

    const initChat = async () => {
      setLoading(true);
      try {
        // Ensure chat room exists for this team
        const roomRes = await axios.post(
          `${apiBase}/api/chat/rooms/team`,
          { teamId: team._id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const activeRoom = roomRes.data;
        setRoom(activeRoom);

        // Fetch messages history
        const msgRes = await axios.get(
          `${apiBase}/api/chat/rooms/${activeRoom._id}/messages?limit=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const rawMessages = Array.isArray(msgRes.data) ? msgRes.data : (msgRes.data.messages || []);
        const decodedMsgs = rawMessages.map((m: any) => ({
          ...m,
          content: decodeHTML(m.content),
          replyTo: m.replyTo ? {
            ...m.replyTo,
            content: decodeHTML(m.replyTo.content)
          } : undefined
        }));
        setMessages(decodedMsgs);
      } catch (err: any) {
        console.error('Failed to initialize team chat:', err);
        toast.error(err.response?.data?.message || 'Không thể tải lịch sử trò chuyện.');
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [team?._id, token]);

  // 2. Setup socket connection once room is loaded
  useEffect(() => {
    if (!room || !token) return;

    const socketUrl = apiBase;
    const newSocket = io(socketUrl, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join_room', room._id);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('new_message', (message: Message) => {
      if (message.roomId === room._id) {
        const decodedMessage = {
          ...message,
          content: decodeHTML(message.content),
          replyTo: message.replyTo ? {
            ...message.replyTo,
            content: decodeHTML(message.replyTo.content)
          } : undefined
        };
        setMessages(prev => {
          if (prev.find(m => m._id === decodedMessage._id)) return prev;
          return [...prev, decodedMessage];
        });
      }
    });

    newSocket.on('message_recalled', (data: { messageId: string; roomId: string; content: string }) => {
      if (data.roomId === room._id) {
        setMessages(prev => prev.map(m =>
          m._id === data.messageId ? { ...m, isRecalled: true, content: decodeHTML(data.content) } : m
        ));
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [room, token]);

  // 3. Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !room || !socket || !isConnected) return;

    socket.emit('send_message', {
      roomId: room._id,
      content: newMessage.trim()
    });

    setNewMessage('');
  };
  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 text-sm animate-pulse">
        Đang kết nối phòng chat...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="py-12 text-center text-rose-650 text-sm flex flex-col items-center gap-2">
        <AlertCircle size={24} />
        Không thể khởi tạo phòng chat với đội thi này.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-xs animate-fadeIn">
      {/* Sub-Header */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
          <span className="text-xs font-bold text-slate-500">
            {isConnected ? 'Kênh trực tuyến (Real-time)' : 'Mất kết nối'}
          </span>
        </div>
        <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-sm">
          {team.name}
        </span>
      </div>

      {/* Messages Feed */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
            <MessageCircle className="w-8 h-8 text-slate-300" />
            <p className="text-xs">Bắt đầu trao đổi với đội thi tại đây!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const currentUserToken = token ? JSON.parse(atob(token.split('.')[1])) : null;
            const currentUserId = currentUserToken?._id || currentUserToken?.id;
            const isMe = currentUserId === msg.senderId;

            return (
              <div key={msg._id || index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Initial Avatar */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isMe ? 'bg-primary text-white shadow-xs' : 'bg-slate-200 text-slate-655 border border-slate-300'
                    }`}>
                      {(msg.senderName || 'U').charAt(0).toUpperCase()}
                    </div>

                    {/* Bubble */}
                    <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed min-w-0 max-w-full ${
                      msg.isRecalled
                        ? 'border border-slate-200 bg-slate-100 text-slate-400 italic rounded-bl-sm'
                        : isMe
                          ? 'bg-primary text-white rounded-br-sm shadow-xs'
                          : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200 shadow-xs'
                    }`}>
                      {!isMe && !msg.isRecalled && (
                        <div className="text-[10px] font-bold text-primary mb-0.5">{msg.senderName}</div>
                      )}
                      <div className="wrap-break-word break-all whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={sendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Nhập tin nhắn trao đổi với đội thi..."
          disabled={!isConnected}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-805 focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-[#F27024]/30 transition-all placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || !isConnected}
          className="bg-primary hover:bg-[#d95f1f] disabled:opacity-40 text-white px-4 py-2 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-xs shadow-[#F27024]/10 hover:shadow-[#F27024]/20 animate-fadeIn"
        >
          <Send size={13} className="mr-1" />
          <span className="text-xs font-bold uppercase">Gửi</span>
        </button>
      </form>
    </div>
  );
}
