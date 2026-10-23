const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

let io;

// Track last message timestamp per user to prevent spamming (Rate Limiting)
const userLastMessageTimes = new Map();

// Helper to escape HTML characters and prevent Stored XSS injection
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.use((socket, next) => {
      // Support secure auth token handshake or query token fallback
      const token = socket.handshake.auth?.token || (socket.handshake.query && socket.handshake.query.token);
      if (token) {
        jwt.verify(token, require('../auth/jwtSecret'), function (err, decoded) {
          if (err) {
            console.error('Socket authentication error:', err.message);
            return next(new Error('Authentication error'));
          }
          socket.decoded = decoded;
          next();
        });
      }
      else {
        next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      const userId = socket.decoded.id;
      console.log(`User connected: ${userId}`);

      const getAccessOptions = async (requireWrite = false) => {
        const User = mongoose.model('User');
        const user = await User.findById(userId).select('isSystemAdmin').lean();
        return { isSystemAdmin: !!user?.isSystemAdmin, requireWrite };
      };

      // Each user joins their personal room for targeted push notifications
      socket.join(`user:${userId}`);

      socket.on('join_room', async (roomId) => {
        try {
          const ChatRoom = mongoose.model('ChatRoom');
          const room = await ChatRoom.findById(roomId);
          if (room) {
            const { checkRoomAccess } = require('./chatRoomService');
            const accessOptions = await getAccessOptions(false);
            const hasAccess = await checkRoomAccess(room, userId, accessOptions);

            if (hasAccess) {
              socket.join(roomId);
              console.log(`User ${userId} joined room ${roomId}`);
            } else {
              console.warn(`Unauthorized join attempt by ${userId} to room ${roomId}`);
              socket.emit('error', { message: 'Unauthorized to join this room' });
            }
          } else {
            console.warn(`Room not found: ${roomId}`);
            socket.emit('error', { message: 'Room not found' });
          }
        } catch (error) {
          console.error("Error joining room:", error);
        }
      });

      socket.on('leave_room', (roomId) => {
        socket.leave(roomId);
        console.log(`User ${userId} left room ${roomId}`);
      });

      socket.on('send_message', async (data) => {
        try {
          const ChatMessage = mongoose.model('ChatMessage');
          const ChatRoom = mongoose.model('ChatRoom');
          const Notification = mongoose.model('Notification');
          const User = mongoose.model('User');
          const { roomId, content, replyTo, fileAttachment } = data;

          let finalContent = content;
          if ((!finalContent || String(finalContent).trim().length === 0) && fileAttachment && fileAttachment.fileUrl) {
            finalContent = `[Tệp đính kèm: ${fileAttachment.fileName || 'Tài liệu'}]`;
          }

          // [CRITICAL-2 FIX] Validate input trước khi thực hiện bất kỳ thác tác nào
          if (!finalContent || typeof finalContent !== 'string' || finalContent.trim().length === 0) {
            return socket.emit('error', { message: 'Nội dung tin nhắn không được để trống.' });
          }
          if (finalContent.length > 2000) {
            return socket.emit('error', { message: 'Tin nhắn quá dài (tối đa 2000 ký tự).' });
          }
          if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return socket.emit('error', { message: 'ID phòng chat không hợp lệ.' });
          }

          // [CRITICAL-2 FIX] Kiểm tra quyền gửi tin nhắn — bắt buộc, chần mọi bypass
          const room = await ChatRoom.findById(roomId);
          if (!room) {
            return socket.emit('error', { message: 'Không tìm thấy phòng chat.' });
          }
          const { checkRoomAccess } = require('./chatRoomService');
          const accessOptions = await getAccessOptions(true);
          const canSend = await checkRoomAccess(room, userId, accessOptions);
          if (!canSend) {
            console.warn(`[SECURITY] Unauthorized send_message attempt by user ${userId} to room ${roomId}`);
            return socket.emit('error', { message: 'Unauthorized: Bạn không có quyền nhắn tin trong phòng này.' });
          }

          // [CRITICAL] Rate Limiting: Max 2 messages per second
          const now = Date.now();
          const lastTime = userLastMessageTimes.get(userId.toString());
          if (lastTime && now - lastTime < 500) {
            return socket.emit('error', { message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng đợi 1 giây trước khi thử lại.' });
          }
          userLastMessageTimes.set(userId.toString(), now);

          const user = await User.findById(userId);
          if (!user) {
            console.warn(`Sender user not found for ID: ${userId}`);
            return;
          }

          // [CRITICAL] XSS Mitigation: React automatically escapes on client side, keep content raw in DB to support code snippets / URLs
          const cleanContent = finalContent.trim();
          const cleanReplyToContent = replyTo ? replyTo.content : undefined;

          const newMessage = new ChatMessage({
            roomId,
            senderId: user._id,
            senderName: user.fullName || user.email,
            content: cleanContent,
            fileUrl: fileAttachment ? fileAttachment.fileUrl : undefined,
            fileName: fileAttachment ? fileAttachment.fileName : undefined,
            fileSize: fileAttachment ? fileAttachment.fileSize : undefined,
            fileType: fileAttachment ? fileAttachment.fileType : undefined,
            replyTo: replyTo ? {
              messageId: replyTo.messageId,
              senderName: replyTo.senderName,
              content: cleanReplyToContent
            } : undefined
          });

          await newMessage.save();

          // Broadcast to all clients in the room including sender
          io.to(roomId).emit('new_message', newMessage);

          // Create in-app Notification for all room members EXCEPT sender
          try {
            const room = await ChatRoom.findById(roomId);
            if (room) {
              const allUsers = [...(room.members || [])];
              if (room.mentorId) {
                allUsers.push(room.mentorId);
              }
              // Nếu là phòng chat của đội thi với mentor, gửi thông báo cho tất cả mentor của bảng đấu đó
              if (room.type === 'team_mentor' && room.trackId) {
                const EventRole = mongoose.model('EventRole');
                const trackMentors = await EventRole.find({
                  eventId: room.eventId,
                  trackId: room.trackId,
                  role: 'mentor',
                  status: 'active'
                });
                const mentorUserIds = trackMentors.map(m => m.userId);
                allUsers.push(...mentorUserIds);
              }
              // Deduplicate and filter out sender
              const uniqueUserIds = Array.from(new Set(allUsers.map(id => id.toString())));
              const recipients = uniqueUserIds.filter(
                idStr => idStr !== userId.toString()
              );

              const preview = content.length > 60 ? content.slice(0, 60) + '…' : content;
              const notifDocs = recipients.map(recipientId => ({
                userId: recipientId,
                type: 'chat_message',
                title: `Tin nhắn mới từ ${user.fullName || user.email}`,
                body: preview,
                channel: 'in_app',
                status: 'sent',
                isRead: false,
                metadata: { roomId, messageId: newMessage._id },
                sentAt: new Date()
              }));
              if (notifDocs.length > 0) {
                const savedNotifs = await Notification.insertMany(notifDocs);
                // Push real-time bell notification to each recipient's personal socket room
                savedNotifs.forEach((notif) => {
                  io.to(`user:${notif.userId.toString()}`).emit('new_notification', notif);
                });
              }
            }
          } catch (notifError) {
            console.error('Failed to create chat notifications:', notifError.message);
          }

        } catch (error) {
          console.error("Error sending message via socket", error);
        }
      });

      socket.on('recall_message', async (data) => {
        try {
          const ChatMessage = mongoose.model('ChatMessage');
          const { messageId, roomId } = data;

          // [CRITICAL-3 FIX] Validate roomId hợp lệ trước khi làm gì
          if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(messageId)) {
            return socket.emit('error', { message: 'Dữ liệu không hợp lệ.' });
          }

          const message = await ChatMessage.findById(messageId);
          if (!message) {
            console.warn(`Message not found: ${messageId}`);
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          // [CRITICAL-3 FIX] Xác minh tin nhắn thuộc đúng phòng được truyền lên
          if (message.roomId.toString() !== roomId.toString()) {
            console.warn(`[SECURITY] recall_message roomId mismatch by user ${userId}: expected ${message.roomId}, got ${roomId}`);
            return socket.emit('error', { message: 'Tin nhắn này không thuộc phòng chat đã chỉ định.' });
          }

          // Verify the sender is the one recalling it
          if (message.senderId.toString() !== userId.toString()) {
            console.warn(`Unauthorized recall attempt by user ${userId} for message ${messageId}`);
            socket.emit('error', { message: 'You can only recall your own messages' });
            return;
          }

          const ChatRoom = mongoose.model('ChatRoom');
          const room = await ChatRoom.findById(roomId);
          if (!room) {
            return socket.emit('error', { message: 'Không tìm thấy phòng chat.' });
          }

          const { checkRoomAccess } = require('./chatRoomService');
          const accessOptions = await getAccessOptions(true);
          const canRecall = await checkRoomAccess(room, userId, accessOptions);
          if (!canRecall) {
            return socket.emit('error', { message: 'Cuộc thi đã kết thúc. Không thể thu hồi tin nhắn.' });
          }

          message.isRecalled = true;
          message.content = "Tin nhắn đã bị thu hồi";
          await message.save();

          // Broadcast the recall event to all clients in the room
          io.to(roomId).emit('message_recalled', { messageId, roomId, content: message.content });

        } catch (error) {
          console.error("Error recalling message via socket", error);
        }
      });

      // --- Real-time Interaction (Admin & Judge Synchronization) ---
      // The live room broadcasts every judge's score in real time (score_updated),
      // so only organisers and judges of the event may join it.
      socket.on('join_live_room', async (data) => {
        try {
          const eventId = data && data.eventId;
          if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return;

          const User = mongoose.model('User');
          const EventRole = mongoose.model('EventRole');
          const user = await User.findById(userId).select('isSystemAdmin isStudentAssistant').lean();
          const isAllowed = !!user && (
            user.isSystemAdmin ||
            user.isStudentAssistant ||
            await EventRole.exists({
              userId,
              eventId,
              role: { $in: ['admin_view', 'student_assistant', 'judge'] },
              status: 'active'
            })
          );

          if (!isAllowed) {
            console.warn(`Unauthorized live room join by user ${userId} for event ${eventId}`);
            return;
          }

          socket.join(`live:${eventId}`);
          console.log(`User ${userId} joined live room for event ${eventId}`);
        } catch (err) {
          console.error('Error in join_live_room socket handler:', err);
        }
      });

      socket.on('leave_live_room', (data) => {
        const { eventId } = data;
        if (eventId) {
          socket.leave(`live:${eventId}`);
          console.log(`User ${userId} left live room for event ${eventId}`);
        }
      });

      socket.on('coordinator_select_team', async (data) => {
        try {
          const { eventId, teamId, roundId } = data;
          if (!eventId) return;

          // Optional validation: check if user is coordinator or admin
          const EventRole = mongoose.model('EventRole');
          const User = mongoose.model('User');
          const userObj = await User.findById(userId).select('isSystemAdmin').lean();

          const isAllowed = userObj && userObj.isSystemAdmin;

          if (isAllowed) {
            console.log(`Coordinator ${userId} highlighted team ${teamId} in event ${eventId}`);
            // Broadcast to the entire live room (including the judges)
            io.to(`live:${eventId}`).emit('team_highlighted', { teamId, roundId });
          } else {
            console.warn(`Unauthorized team selection by user ${userId} in event ${eventId}`);
          }
        } catch (err) {
          console.error('Error in coordinator_select_team socket handler:', err);
        }
      });

      socket.on('disconnect', () => {
        console.log('User disconnected', userId);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  }
};
