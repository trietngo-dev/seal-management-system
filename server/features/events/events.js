const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const XLSX = require('xlsx-js-style');

const Event = mongoose.model('Event');
const Track = mongoose.model('Track');
const Round = mongoose.model('Round');
const EventRole = mongoose.model('EventRole');
const User = mongoose.model('User');
const Team = mongoose.model('Team');
const TeamMember = mongoose.model('TeamMember');
const GithubRepository = mongoose.model('GithubRepository');
const EventLog = mongoose.model('EventLog');

const emailService = require('../notifications/emailService');
const githubService = require('../github-ai/githubService');
const { ensureChatRoomForTeam, ensureChatRoomsForMentorTrack } = require('../chat/chatRoomService');
const { provisionTeamRepository } = require('../github-ai/repoProvisioning');
const { findJudgeRoleForRound } = require('../teams/teamAccess');

const {
  extractDriveFileId,
  sanitizeRoundForAdmin
} = require('./examAccessService');
const { syncDriveAccessForRound, getDriveStatus } = require('./driveAccessService');
const { authenticateToken, requireSystemAdmin, requireEventRole } = require('../auth/authMiddleware');
const { addEmailJob, isQueueAvailable } = require('../notifications/notificationQueue');

/**
 * Downgrades all active judge/mentor roles of an event to participant when the event completes.
 */
async function downgradeEventRolesToParticipant(eventId) {
  const targetRoles = await EventRole.find({
    eventId,
    role: { $in: ['judge', 'mentor'] },
    status: 'active'
  });

  for (const roleRecord of targetRoles) {
    const participantExists = await EventRole.findOne({
      userId: roleRecord.userId,
      eventId: roleRecord.eventId,
      role: 'participant',
      status: 'active'
    });

    if (participantExists) {
      await EventRole.deleteOne({ _id: roleRecord._id });
    } else {
      roleRecord.role = 'participant';
      await roleRecord.save();
    }
  }
}

/**
 * Assigns all active student assistants to a newly opened event.
 */
async function assignStudentAssistantsToEvent(eventId, actorId) {
  try {
    const User = mongoose.model('User');
    const assistants = await User.find({ isStudentAssistant: true, isActive: true });
    for (const assistant of assistants) {
      // Check if they already have an active staff role in this event
      const hasOtherStaffRole = await EventRole.findOne({
        userId: assistant._id,
        eventId,
        role: { $in: ['judge', 'mentor'] },
        status: 'active'
      });

      let hasTeammateRole = false;
      const isParticipant = await EventRole.findOne({
        userId: assistant._id,
        eventId,
        role: 'participant',
        status: 'active'
      });
      if (isParticipant) {
        const TeamMember = mongoose.model('TeamMember');
        const isTeamMember = await TeamMember.findOne({
          userId: assistant._id,
          eventId,
          confirmStatus: 'confirmed'
        });
        if (isTeamMember) {
          hasTeammateRole = true;
        }
      }

      if (hasOtherStaffRole || hasTeammateRole) {
        // If they already have a conflicting role, delete student_assistant role if it exists to ensure mutual exclusion
        await EventRole.deleteMany({ userId: assistant._id, eventId, role: 'student_assistant' });
        console.log(`[EVENT] Cleaned up and skipped student assistant auto-assignment for user ${assistant.email} because they already have a conflicting role.`);
        continue;
      }

      await EventRole.updateOne(
        { userId: assistant._id, eventId, role: 'student_assistant' },
        { $set: { status: 'active', assignedBy: actorId } },
        { upsert: true }
      );
    }
    console.log(`[EVENT] Automatically assigned student assistants to event: ${eventId}`);
  } catch (err) {
    console.error(`[EVENT ERROR] Failed to assign student assistants to event ${eventId}:`, err.message);
  }
}

/**
 * Automatically kicks all student team members and mentors from GitHub repositories
 * associated with a completed event.
 */
async function autoKickAllRepoCollaborators(eventId, actorId) {
  try {
    const repos = await GithubRepository.find({ eventId });
    if (repos.length === 0) return;

    // Get all mentors for this event
    const mentors = await EventRole.find({ eventId, role: 'mentor', status: 'active' }).populate('userId');

    for (const repo of repos) {
      try {
        // Get all confirmed team members for the repository's team
        const members = await TeamMember.find({ teamId: repo.teamId }).populate('userId');

        // Extract unique github usernames
        const usernames = new Set();
        members.forEach(m => {
          if (m.userId && m.userId.githubUsername) {
            usernames.add(m.userId.githubUsername);
          }
        });
        mentors.forEach(m => {
          if (m.userId && m.userId.githubUsername) {
            usernames.add(m.userId.githubUsername);
          }
        });

        const kickedList = [];
        for (const username of usernames) {
          const success = await githubService.removeCollaborator(repo.repoName, username, repo.orgName);
          if (success) {
            kickedList.push(username);
          }
        }

        if (kickedList.length > 0) {
          const newLog = new EventLog({
            eventId,
            actorId,
            action: 'kick_collaborators',
            type: 'system',
            details: `[AUTO-COMPLETE] Tự động thu hồi quyền truy cập repository ${repo.repoName} của các thành viên và mentor: ${kickedList.join(', ')}`
          });
          await newLog.save();
        }
      } catch (repoErr) {
        console.error(`[AUTO-KICK ERROR] Failed to kick collaborators for repo ${repo.repoName}:`, repoErr.message);
      }
    }
  } catch (err) {
    console.error(`[AUTO-KICK ERROR] Failed during auto-kick query for event ${eventId}:`, err.message);
  }
}

/**
 * @route   GET /api/events
 * @desc    Get all events (filtered by semester/year/status)
 * @access  Public
 */
router.get('/', async (req, res) => {
  const { semester, year, status } = req.query;
  const filter = {};

  if (semester) filter.semester = semester;
  if (year) filter.year = parseInt(year);
  if (status) filter.status = status;

  // Check optional auth to decide if archived events can be shown
  const JWT_SECRET = require('../auth/jwtSecret');
  const jwt = require('jsonwebtoken');
  const User = mongoose.model('User');
  const EventRole = mongoose.model('EventRole');

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let showArchived = false;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        if (user.isSystemAdmin) {
          showArchived = true;
        } else {
          const coordinatorRole = await EventRole.findOne({
            userId: user._id,
            role: { $in: ['admin_view', 'student_assistant'] },
            status: 'active'
          });
          if (coordinatorRole) {
            showArchived = true;
          }
        }
      }
    } catch (err) {
      // Ignore invalid token, show non-archived events only
    }
  }

  if (!showArchived) {
    filter.isArchived = { $ne: true };
  }

  try {
    const events = await Event.find(filter).sort({ year: -1, semester: 1 }).lean();

    const eventsWithTeamCount = await Promise.all(events.map(async (event) => {
      const teamCount = await Team.countDocuments({ eventId: event._id });
      return { ...event, teamCount };
    }));

    res.json(eventsWithTeamCount);
  } catch (error) {
    console.error('Fetch Events Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy danh sách sự kiện.' });
  }
});

/**
 * @route   POST /api/events
 * @desc    Create a new event (System Admin only)
 * @access  Private (System Admin)
 */
router.post('/', authenticateToken, requireSystemAdmin, async (req, res) => {
  const { name, semester, year, description, bannerUrl, maxTeams, githubOrgName, commitSyncInterval, zaloUrl } = req.body;

  if (!name || !semester || !year) {
    return res.status(400).json({ message: 'Tên sự kiện, học kỳ và năm là bắt buộc.' });
  }

  try {
    // Check if event already exists for this semester and year
    const existing = await Event.findOne({ semester, year, isArchived: { $ne: true } });
    if (existing) {
      return res.status(400).json({
        message: `Sự kiện cho học kỳ "${semester}" và năm "${year}" đã tồn tại.`
      });
    }

    const newEvent = new Event({
      name,
      semester,
      year: parseInt(year),
      description,
      bannerUrl,
      maxTeams: maxTeams ? parseInt(maxTeams) : 20,
      githubOrgName: githubOrgName || 'sealhackathon-2026',
      commitSyncInterval: commitSyncInterval ? parseInt(commitSyncInterval) : 30,
      zaloUrl: zaloUrl || '',
      status: 'draft',
      registrationOpen: null,
      registrationClose: null
    });

    // Auto-provision or link Github organization
    await githubService.createOrganization(newEvent.githubOrgName);

    await newEvent.save();

    // Auto-create default Final Round (Vòng Chung Kết)
    const newRound = new Round({
      eventId: newEvent._id,
      name: 'Vòng Chung Kết',
      order: 1,
      advanceTopN: 0,
      status: 'pending'
    });
    await newRound.save();

    // Create default Track for Vòng Chung Kết (always available)
    const finalTrack = new Track({
      eventId: newEvent._id,
      roundId: newRound._id,
      name: 'Bảng Chung Kết',
      description: 'Bảng đấu tập trung dành cho các đội xuất sắc nhất vượt qua các vòng thi trước',
      maxTeams: 6,
      topicSubmissionOpen: true
    });
    await finalTrack.save();

    // Create an empty Rubric for this round
    const Rubric = mongoose.model('Rubric');
    const rubricObj = new Rubric({
      eventId: newEvent._id,
      roundId: newRound._id,
      name: 'Rubric Vòng Chung Kết',
      totalWeight: 100,
      maxCriterionScore: 10,
      isLocked: false
    });
    await rubricObj.save();



    if (newEvent.status === 'registration' || newEvent.status === 'ongoing') {
      await assignStudentAssistantsToEvent(newEvent._id, req.user._id);
    }

    // Create EventLog
    const newLog = new EventLog({
      eventId: newEvent._id,
      actorId: req.user._id,
      action: 'create_event',
      type: 'operation',
      details: `Tạo sự kiện mới: "${newEvent.name}" (Học kỳ: ${newEvent.semester}, Năm: ${newEvent.year}, Số lượng đội tối đa: ${newEvent.maxTeams || 0})`
    });
    await newLog.save();

    res.status(201).json({
      message: 'Tạo sự kiện thành công!',
      event: newEvent
    });

  } catch (error) {
    console.error('Create Event Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tạo sự kiện.' });
  }
});

/**
 * @route   GET /api/events/judge/active-contest
 * @desc    Get the current ongoing event and its active round (for judge screens)
 * @access  Private (Authenticated users)
 */
router.get('/judge/active-contest', authenticateToken, async (req, res) => {
  try {
    // 1. Find the ongoing event
    const event = await Event.findOne({ status: 'ongoing' }).lean();
    if (!event) {
      return res.json({ event: null, currentRound: null, rounds: [], tracks: [], assignedTrack: null });
    }

    // 2. Find all rounds for this event, sorted by order ascending
    const rounds = await Round.find({ eventId: event._id }).sort({ order: 1 }).lean();

    // 3. Find the current active round (first round that is not 'completed')
    const currentRound = rounds.find(r => r.status !== 'completed') || rounds[rounds.length - 1] || null;

    // 4. Find all tracks for this round
    let tracks = [];
    if (currentRound) {
      tracks = await Track.find({ roundId: currentRound._id }).lean();
    }

    // 5. Find the judge's assigned track in the current round (if any)
    let assignedTrack = null;
    const userRole = currentRound
      ? await findJudgeRoleForRound(req.user._id, event._id, currentRound._id)
      : null;

    let isFinalRound = false;
    if (currentRound) {
      if (currentRound.name.toLowerCase().includes('chung kết') || currentRound.advanceTopN === 0) {
        isFinalRound = true;
      }
    }

    if (isFinalRound) {
      assignedTrack = null;
    } else if (userRole && userRole.trackId) {
      assignedTrack = await Track.findById(userRole.trackId).lean();
    }

    res.json({
      event,
      currentRound,
      rounds,
      tracks,
      assignedTrack
    });
  } catch (error) {
    console.error('Fetch Active Contest for Judge Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy thông tin cuộc thi đang hoạt động.' });
  }
});

/**
 * @route   GET /api/events/all/logs
 * @desc    Get all activity logs across all events
 * @access  Private (Coordinator or Admin)
 */
router.get('/all/logs', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        role: 'admin_view',
        status: 'active'
      });
      if (!coordinatorRole) {
        return res.status(403).json({ message: 'Không có quyền truy cập. Chỉ có quản trị viên hệ thống mới có thể xem nhật ký sự kiện.' });
      }
    }

    const logs = await EventLog.find({ type: { $ne: 'login' } })
      .populate('actorId', 'fullName email')
      .populate('eventId', 'name semester year')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(logs);
  } catch (error) {
    console.error('Fetch All Event Logs Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy nhật ký sự kiện.' });
  }
});


/**
 * @route   GET /api/events/:id
 * @desc    Get detailed event info including tracks & rounds
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    }

    if (event.isArchived) {
      // Enforce auth check for archived events
      const JWT_SECRET = require('../auth/jwtSecret');
      const jwt = require('jsonwebtoken');
      const User = mongoose.model('User');
      const EventRole = mongoose.model('EventRole');

      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      let authorized = false;

      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const user = await User.findById(decoded.id);
          if (user) {
            if (user.isSystemAdmin) {
              authorized = true;
            } else {
              const coordinatorRole = await EventRole.findOne({
                userId: user._id,
                eventId: event._id,
                role: { $in: ['admin_view', 'student_assistant'] },
                status: 'active'
              });
              authorized = !!coordinatorRole;
            }
          }
        } catch (err) { }
      }

      if (!authorized) {
        return res.status(403).json({ message: 'Sự kiện này đã bị ẩn. Bạn không có quyền truy cập.' });
      }
    }

    const tracks = await Track.find({ eventId: event._id });
    let rounds = await Round.find({ eventId: event._id }).sort({ order: 1 });

    const Rubric = mongoose.model('Rubric');
    const Criterion = mongoose.model('Criterion');

    // Self-healing: Check if a Final Round exists (advanceTopN === 0)
    let finalRound = rounds.find(r => r.advanceTopN === 0);
    if (!finalRound) {
      const nextOrder = rounds.length > 0 ? (rounds[rounds.length - 1].order + 1) : 1;
      finalRound = new Round({
        eventId: event._id,
        name: 'Vòng Chung Kết',
        order: nextOrder,
        advanceTopN: 0,
        status: 'pending'
      });
      await finalRound.save();

      const rubricObj = new Rubric({
        eventId: event._id,
        roundId: finalRound._id,
        name: 'Rubric Vòng Chung Kết',
        totalWeight: 100,
        maxCriterionScore: 10,
        isLocked: false
      });
      await rubricObj.save();

      // Re-fetch rounds
      rounds = await Round.find({ eventId: event._id }).sort({ order: 1 });
    }

    // Self-healing: Check if the Final Round has a consolidated Track (Bảng Chung Kết)
    const finalRoundTrack = await Track.findOne({ roundId: finalRound._id });
    if (!finalRoundTrack) {
      const finalTrack = new Track({
        eventId: event._id,
        roundId: finalRound._id,
        name: 'Bảng Chung Kết',
        description: 'Bảng đấu tập trung dành cho các đội xuất sắc nhất vượt qua các vòng thi trước',
        maxTeams: 6,
        topicSubmissionOpen: true
      });
      await finalTrack.save();
    }

    const roundsWithRubricStatus = [];
    for (const r of rounds) {
      const rubric = await Rubric.findOne({ roundId: r._id });
      const hasCriteria = rubric ? (rubric.isLocked || (await Criterion.exists({ rubricId: rubric._id })) !== null) : false;
      roundsWithRubricStatus.push({
        ...sanitizeRoundForAdmin(r),
        hasCriteria
      });
    }

    res.json({
      event,
      tracks,
      rounds: roundsWithRubricStatus,
      driveIntegration: getDriveStatus()
    });
  } catch (error) {
    console.error('Fetch Event Details Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy chi tiết sự kiện.' });
  }
});

/**
 * @route   POST /api/events/:eventId/tracks
 * @desc    Create a Track in an event
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/tracks', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  const { name, description, maxTeams, roundId, startTime, endTime, gradingEndTime, advanceTopN, topicName, topicLink, aiBrief } = req.body;

  if (!name || !roundId) {
    return res.status(400).json({ message: 'Tên bảng đấu và vòng thi là bắt buộc.' });
  }

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    }

    const round = await Round.findById(roundId);
    if (!round) {
      return res.status(404).json({ message: 'Không tìm thấy vòng thi.' });
    }

    if (round.status === 'completed') {
      return res.status(400).json({ message: 'Không thể tạo bảng đấu mới cho vòng thi đã kết thúc.' });
    }

    // Auth check: System Admin only
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ có quản trị viên hệ thống mới có thể tạo bảng đấu.' });
    }

    // Check maxTeams limits (excluding final round tracks)
    const finalRound = await Round.findOne({ eventId, advanceTopN: 0 });
    const finalRoundIdStr = finalRound ? finalRound._id.toString() : '';

    const isFinalRoundTrack = roundId.toString() === finalRoundIdStr;
    const newMaxTeamsNum = maxTeams ? parseInt(maxTeams) : 10;

    if (!isFinalRoundTrack) {
      const existingTracks = await Track.find({ eventId });
      const currentTotalMaxTeams = existingTracks
        .filter(t => t.roundId && t.roundId.toString() !== finalRoundIdStr)
        .reduce((sum, t) => sum + (t.maxTeams || 0), 0);

      if (currentTotalMaxTeams + newMaxTeamsNum > event.maxTeams) {
        return res.status(400).json({
          message: `Tổng số đội tối đa của các bảng đấu (${currentTotalMaxTeams + newMaxTeamsNum}) vượt quá số lượng đội giới hạn của cuộc thi (${event.maxTeams}).`
        });
      }
    }

    const newTrack = new Track({
      eventId,
      roundId,
      name,
      description,
      maxTeams: newMaxTeamsNum,
      topicSubmissionOpen: true,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      gradingEndTime: gradingEndTime ? new Date(gradingEndTime) : undefined,
      advanceTopN: advanceTopN ? parseInt(advanceTopN) : undefined,
      topicName,
      topicLink,
      aiBrief: aiBrief || undefined
    });

    await newTrack.save();

    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'create_track',
      type: 'operation',
      details: `Tạo bảng đấu mới: "${newTrack.name}" trong vòng thi: "${round.name}" (Số lượng đội tối đa: ${newTrack.maxTeams || 'Không giới hạn'}, Đội đi tiếp: ${newTrack.advanceTopN || 'Không giới hạn'})`
    });
    await newLog.save();

    res.status(201).json(newTrack);

  } catch (error) {
    console.error('Create Track Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tạo bảng đấu.' });
  }
});

/**
 * @route   PUT /api/events/:eventId/tracks/:trackId
 * @desc    Update a Track in an event
 * @access  Private (Coordinator or Admin)
 */
router.put('/:eventId/tracks/:trackId', authenticateToken, async (req, res) => {
  const { eventId, trackId } = req.params;
  const { name, description, maxTeams, roundId, startTime, endTime, gradingEndTime, advanceTopN, topicName, topicLink, aiBrief } = req.body;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    }

    const track = await Track.findOne({ _id: trackId, eventId }).select('+aiBrief');
    if (!track) {
      return res.status(404).json({ message: 'Không tìm thấy bảng đấu.' });
    }

    const finalRoundId = roundId || track.roundId;
    const round = await Round.findById(finalRoundId);
    if (!round) {
      return res.status(404).json({ message: 'Không tìm thấy vòng thi.' });
    }

    if (round.status === 'completed') {
      return res.status(400).json({ message: 'Không thể chỉnh sửa bảng đấu của vòng thi đã kết thúc.' });
    }

    // Auth check: System Admin only
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ có quản trị viên hệ thống mới có thể cập nhật bảng đấu.' });
    }

    // Check maxTeams limits
    const logDetails = [];
    const oldName = track.name;
    const oldDescription = track.description;
    const oldMaxTeams = track.maxTeams;
    const oldRoundId = track.roundId;
    const oldStartTime = track.startTime;
    const oldEndTime = track.endTime;
    const oldGradingEndTime = track.gradingEndTime;

    if (maxTeams !== undefined) {
      const finalRound = await Round.findOne({ eventId, advanceTopN: 0 });
      const finalRoundIdStr = finalRound ? finalRound._id.toString() : '';

      const isFinalRoundTrack = finalRoundId.toString() === finalRoundIdStr;

      if (!isFinalRoundTrack) {
        const existingTracks = await Track.find({ eventId });
        const otherTracksMaxTeams = existingTracks
          .filter(t => t._id.toString() !== trackId && t.roundId && t.roundId.toString() !== finalRoundIdStr)
          .reduce((sum, t) => sum + (t.maxTeams || 0), 0);
        const updatedMaxTeamsNum = parseInt(maxTeams) || 0;
        if (otherTracksMaxTeams + updatedMaxTeamsNum > event.maxTeams) {
          return res.status(400).json({
            message: `Tổng số đội tối đa của các bảng đấu (${otherTracksMaxTeams + updatedMaxTeamsNum}) vượt quá số lượng đội giới hạn của cuộc thi (${event.maxTeams}).`
          });
        }
      }

      const updatedMaxTeamsNum = parseInt(maxTeams) || 0;
      track.maxTeams = updatedMaxTeamsNum;
      if (oldMaxTeams !== updatedMaxTeamsNum) {
        logDetails.push(`Số lượng đội tối đa: ${oldMaxTeams || 0} -> ${updatedMaxTeamsNum}`);
      }
    }

    if (name && name !== oldName) {
      logDetails.push(`Tên bảng đấu: "${oldName}" -> "${name}"`);
      track.name = name;
    }
    if (description !== undefined && description !== oldDescription) {
      logDetails.push(`Mô tả bảng đấu: "${oldDescription || ''}" -> "${description || ''}"`);
      track.description = description;
    }
    if (roundId && roundId.toString() !== oldRoundId.toString()) {
      const oldRoundObj = await Round.findById(oldRoundId);
      const newRoundObj = await Round.findById(roundId);
      const oldRoundName = oldRoundObj ? oldRoundObj.name : oldRoundId;
      const newRoundName = newRoundObj ? newRoundObj.name : roundId;
      logDetails.push(`Vòng thi: "${oldRoundName}" -> "${newRoundName}"`);
      track.roundId = roundId;
    }

    if (startTime !== undefined) {
      const newStart = startTime ? new Date(startTime) : null;
      const oldStart = oldStartTime;
      if ((!oldStart && newStart) || (oldStart && !newStart) || (oldStart && newStart && oldStart.getTime() !== newStart.getTime())) {
        logDetails.push(`Thời gian bắt đầu: ${oldStart ? oldStart.toLocaleString('vi-VN') : 'Trống'} -> ${newStart ? newStart.toLocaleString('vi-VN') : 'Trống'}`);
        track.startTime = newStart || undefined;
      }
    }
    if (endTime !== undefined) {
      const newEnd = endTime ? new Date(endTime) : null;
      const oldEnd = oldEndTime;
      if ((!oldEnd && newEnd) || (oldEnd && !newEnd) || (oldEnd && newEnd && oldEnd.getTime() !== newEnd.getTime())) {
        logDetails.push(`Thời gian kết thúc: ${oldEnd ? oldEnd.toLocaleString('vi-VN') : 'Trống'} -> ${newEnd ? newEnd.toLocaleString('vi-VN') : 'Trống'}`);
        track.endTime = newEnd || undefined;
      }
    }
    if (gradingEndTime !== undefined) {
      const newGradingEnd = gradingEndTime ? new Date(gradingEndTime) : null;
      const oldGradingEnd = oldGradingEndTime;
      if ((!oldGradingEnd && newGradingEnd) || (oldGradingEnd && !newGradingEnd) || (oldGradingEnd && newGradingEnd && oldGradingEnd.getTime() !== newGradingEnd.getTime())) {
        logDetails.push(`Thời gian kết thúc chấm thi: ${oldGradingEnd ? oldGradingEnd.toLocaleString('vi-VN') : 'Trống'} -> ${newGradingEnd ? newGradingEnd.toLocaleString('vi-VN') : 'Trống'}`);
        track.gradingEndTime = newGradingEnd || undefined;
      }
    }

    if (advanceTopN !== undefined) {
      const updatedAdvanceTopN = advanceTopN ? parseInt(advanceTopN) : undefined;
      if (track.advanceTopN !== updatedAdvanceTopN) {
        logDetails.push(`Số lượng đội đi tiếp: ${track.advanceTopN || 'Không giới hạn'} -> ${updatedAdvanceTopN || 'Không giới hạn'}`);
        track.advanceTopN = updatedAdvanceTopN;
      }
    }
    if (topicName !== undefined && topicName !== track.topicName) {
      logDetails.push(`Tên đề tài: "${track.topicName || 'Trống'}" -> "${topicName}"`);
      track.topicName = topicName;
    }
    if (topicLink !== undefined && topicLink !== track.topicLink) {
      logDetails.push(`Link đề tài: "${track.topicLink || 'Trống'}" -> "${topicLink}"`);
      track.topicLink = topicLink;
    }
    if (aiBrief !== undefined && aiBrief !== (track.aiBrief || '')) {
      // The brief is confidential exam content, so only record that it changed.
      logDetails.push('Đã cập nhật mô tả đề cho AI');
      track.aiBrief = aiBrief;
    }


    await track.save();

    if (logDetails.length > 0) {
      const newLog = new EventLog({
        eventId,
        actorId: req.user._id,
        action: 'update_track',
        type: 'operation',
        details: `Cập nhật thông tin bảng đấu "${track.name}": ${logDetails.join(', ')}`
      });
      await newLog.save();
    }

    res.json(track);

  } catch (error) {
    console.error('Update Track Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật bảng đấu.' });
  }
});

/**
 * @route   GET /api/events/:eventId/tracks/:trackId/ai-brief
 * @desc    Read the confidential AI brief of a track (excluded from every other track query)
 * @access  Private (System Admin)
 */
router.get('/:eventId/tracks/:trackId/ai-brief', authenticateToken, async (req, res) => {
  if (!req.user.isSystemAdmin) {
    return res.status(403).json({ message: 'Quyền truy cập bị từ chối.' });
  }
  try {
    const track = await Track.findOne({ _id: req.params.trackId, eventId: req.params.eventId }).select('+aiBrief');
    if (!track) {
      return res.status(404).json({ message: 'Không tìm thấy bảng đấu.' });
    }
    res.json({ aiBrief: track.aiBrief || '' });
  } catch (error) {
    console.error('Get Track AI Brief Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải mô tả đề cho AI.' });
  }
});

/**
 * @route   DELETE /api/events/:eventId/tracks/:trackId
 * @desc    Delete a Track in an event
 * @access  Private (Coordinator or Admin)
 */
router.delete('/:eventId/tracks/:trackId', authenticateToken, async (req, res) => {
  const { eventId, trackId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    }

    const track = await Track.findOne({ _id: trackId, eventId });
    if (!track) {
      return res.status(404).json({ message: 'Không tìm thấy bảng đấu.' });
    }

    // Check if there is a round associated and if it's completed
    const round = await Round.findById(track.roundId);
    if (round && round.status === 'completed') {
      return res.status(400).json({ message: 'Không thể xóa bảng đấu của vòng thi đã kết thúc.' });
    }

    // Auth check: System Admin only
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ có quản trị viên hệ thống mới có thể xóa bảng đấu.' });
    }

    // Check if any teams are assigned to this track
    const teamCount = await Team.countDocuments({ trackId });
    if (teamCount > 0) {
      return res.status(400).json({ message: 'Không thể xóa bảng đấu này vì đã có đội thi tham gia.' });
    }

    await Track.deleteOne({ _id: trackId });

    // Create EventLog
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'delete_track',
      type: 'operation',
      details: `Xóa bảng đấu: "${track.name}"`
    });
    await newLog.save();

    res.json({ message: 'Xóa bảng đấu thành công!' });

  } catch (error) {
    console.error('Delete Track Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi xóa bảng đấu.' });
  }
});

/**
 * @route   POST /api/events/:eventId/rounds
 * @desc    Add a Round to an event
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/rounds', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  const { name, order, submissionDeadline, advanceTopN } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Tên vòng thi là bắt buộc.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ có quản trị viên hệ thống mới có thể tạo vòng thi.' });
    }

    // Find the round with the highest order (the Final Round)
    const finalRound = await Round.findOne({ eventId }).sort({ order: -1 });
    let assignedOrder = 1;

    if (finalRound) {
      assignedOrder = finalRound.order;
      finalRound.order = finalRound.order + 1;
      await finalRound.save();
    }

    const newRound = new Round({
      eventId,
      name,
      order: assignedOrder,
      submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : undefined,
      advanceTopN: advanceTopN ? parseInt(advanceTopN) : undefined,
      status: 'pending'
    });

    await newRound.save();

    // Create EventLog
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'create_round',
      type: 'operation',
      details: `Tạo vòng thi mới: "${newRound.name}" (Thứ tự: ${newRound.order}, Đội đi tiếp: ${newRound.advanceTopN || 'Tất cả'})`
    });
    await newLog.save();

    res.status(201).json(newRound);

  } catch (error) {
    console.error('Create Round Error:', error.message);
    if (error.code === 11000) {
      return res.status(400).json({ message: `Thứ tự vòng thi (${order}) đã tồn tại trong cuộc thi này. Vui lòng chọn thứ tự khác.` });
    }
    res.status(500).json({ message: 'Lỗi hệ thống khi tạo vòng thi.' });
  }
});

/**
 * @route   PUT /api/events/:eventId/rounds/:roundId
 * @desc    Update a Round in an event
 * @access  Private (System Admin or Coordinator)
 */
router.put('/:eventId/rounds/:roundId', authenticateToken, async (req, res) => {
  const { eventId, roundId } = req.params;
  const { name, order, submissionDeadline, advanceTopN, startTime, endTime, gradingEndTime, isExamManualOpen, status } = req.body;

  try {
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ có quản trị viên hệ thống mới có thể chỉnh sửa vòng thi.' });
    }

    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: 'Không tìm thấy vòng thi.' });

    // Validate Final Round constraints
    if (round.advanceTopN === 0) {
      if (advanceTopN !== undefined && parseInt(advanceTopN) !== 0) {
        return res.status(400).json({ message: 'Không thể thay đổi số lượng đội đi tiếp của Vòng Chung Kết (phải là 0).' });
      }
      if (order !== undefined) {
        const maxOtherRound = await Round.findOne({ eventId, _id: { $ne: roundId } }).sort({ order: -1 });
        if (maxOtherRound && parseInt(order) <= maxOtherRound.order) {
          return res.status(400).json({ message: 'Thứ tự của Vòng Chung Kết phải là lớn nhất trong tất cả các vòng.' });
        }
      }
    } else {
      // Validate intermediate round constraints
      const finalRound = await Round.findOne({ eventId, advanceTopN: 0 });
      if (finalRound) {
        if (order !== undefined && parseInt(order) >= finalRound.order) {
          return res.status(400).json({ message: 'Thứ tự của vòng thi này phải nhỏ hơn thứ tự của Vòng Chung Kết.' });
        }
        if (advanceTopN !== undefined && parseInt(advanceTopN) === 0) {
          return res.status(400).json({ message: 'Chỉ có duy nhất một vòng chung kết.' });
        }
      }
    }

    if (name !== undefined) round.name = name;
    if (order !== undefined) round.order = parseInt(order);
    if (submissionDeadline !== undefined) round.submissionDeadline = submissionDeadline ? new Date(submissionDeadline) : undefined;
    if (advanceTopN !== undefined) round.advanceTopN = advanceTopN ? parseInt(advanceTopN) : undefined;
    if (startTime !== undefined) round.startTime = startTime ? new Date(startTime) : null;
    if (endTime !== undefined) round.endTime = endTime ? new Date(endTime) : null;
    if (gradingEndTime !== undefined) round.gradingEndTime = gradingEndTime ? new Date(gradingEndTime) : null;

    const wasManualOpen = round.isExamManualOpen;
    const wasActive = round.status === 'active';

    if (isExamManualOpen !== undefined) round.isExamManualOpen = !!isExamManualOpen;
    if (status !== undefined) round.status = status;

    const isNewlyOpened = (round.isExamManualOpen && !wasManualOpen) || (round.status === 'active' && !wasActive);

    if (status === 'active') {
      // Deactivate all other active rounds in the same event
      await Round.updateMany(
        { eventId, _id: { $ne: roundId }, status: 'active' },
        { status: 'pending' }
      );
    }

    if (isNewlyOpened) {
      console.log(`[DRIVE] Round "${round.name}" is opened. Auto-syncing Drive access in background...`);
      syncDriveAccessForRound(round._id).catch(err => {
        console.error(`[DRIVE ERROR] Auto-sync failed on manual open for round ${round.name}:`, err.message);
      });
    }

    // Mirror schedule to tracks in this round for backward compatibility
    if (startTime !== undefined || endTime !== undefined || gradingEndTime !== undefined) {
      const trackUpdate = {};
      if (startTime !== undefined) trackUpdate.startTime = startTime ? new Date(startTime) : null;
      if (endTime !== undefined) trackUpdate.endTime = endTime ? new Date(endTime) : null;
      if (gradingEndTime !== undefined) trackUpdate.gradingEndTime = gradingEndTime ? new Date(gradingEndTime) : null;
      if (Object.keys(trackUpdate).length > 0) {
        await Track.updateMany({ roundId: round._id }, trackUpdate);
      }
    }

    await round.save();

    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'update_round',
      details: `Cập nhật thông tin vòng thi: "${round.name}" (Thứ tự: ${round.order})`
    });
    await newLog.save();

    res.json(sanitizeRoundForAdmin(round));
  } catch (error) {
    console.error('Update Round Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật vòng thi.' });
  }
});

/**
 * @route   POST /api/events/:eventId/rounds/:roundId/sync-drive-access
 * @desc    Share round exam Drive folder with all eligible registered emails
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/rounds/:roundId/sync-drive-access', authenticateToken, async (req, res) => {
  const { eventId, roundId } = req.params;

  try {
    if (!req.user.isSystemAdmin) {
      const isCoord = await EventRole.findOne({ userId: req.user._id, eventId, role: { $in: ['admin_view', 'student_assistant'] }, status: 'active' });
      if (!isCoord) return res.status(403).json({ message: 'Không có quyền truy cập.' });
    }

    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: 'Không tìm thấy vòng thi.' });
    if (!round.driveFileId) {
      return res.status(400).json({ message: 'Vòng thi chưa có link Google Drive. Hãy upload đề trước.' });
    }

    const result = await syncDriveAccessForRound(roundId);
    const updatedRound = await Round.findById(roundId);

    res.json({
      message: `Đồng bộ quyền Drive: ${result.synced}/${result.total} email thành công.`,
      sync: result,
      round: sanitizeRoundForAdmin(updatedRound),
      driveIntegration: getDriveStatus()
    });
  } catch (error) {
    console.error('Sync Drive Access Error:', error.message);
    const status = /chưa cấu hình|Không tìm thấy file service account/i.test(error.message) ? 503 : 500;
    res.status(status).json({ message: error.message || 'Lỗi đồng bộ quyền Google Drive.', detail: error.message });
  }
});

/**
 * @route   POST /api/events/:eventId/upload-exam
 * @desc    Save exam material — Admin pastes a Google Drive URL directly (no OAuth needed).
 *          Supports per-track links: pass `trackId` to assign a drive link to a specific track (bảng).
 *          Pass `roundId` (legacy) to assign to the whole round.
 *          The link should already be set to "Anyone with the link" on Drive.
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/upload-exam', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  const { trackId, fileName, fileUrl, roundId } = req.body;

  if (!fileName || !fileUrl) {
    return res.status(400).json({ message: 'Tên file và URL Drive là bắt buộc.' });
  }

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });

    if (!req.user.isSystemAdmin) {
      const isCoord = await EventRole.findOne({ userId: req.user._id, eventId, role: 'student_assistant' });
      if (!isCoord) return res.status(403).json({ message: 'Không có quyền truy cập.' });
    }

    const driveFileId = extractDriveFileId(fileUrl) || null;

    // ── PER-TRACK (bảng riêng): Store link directly on the Track ──
    if (trackId) {
      const track = await Track.findById(trackId);
      if (!track || track.eventId.toString() !== eventId) {
        return res.status(404).json({ message: 'Không tìm thấy bảng đấu trong event này.' });
      }

      track.examDriveFileId = driveFileId;
      track.examDriveFileName = fileName;
      track.examDriveFileUrl = fileUrl;
      await track.save();

      const newLog = new EventLog({
        eventId,
        actorId: req.user._id,
        action: 'upload_track_exam',
        details: `Gắn đề Google Drive riêng cho bảng "${track.name}" (${fileName})`
      });
      await newLog.save();

      // Auto-sync Drive access in background on upload
      if (track.roundId && driveFileId) {
        console.log(`[DRIVE] Auto-syncing Drive access for track upload in background...`);
        syncDriveAccessForRound(track.roundId).catch(err => {
          console.error(`[DRIVE ERROR] Auto-sync failed on track exam upload:`, err.message);
        });
      }

      return res.json({
        message: `Đã lưu và đồng bộ link Drive riêng cho bảng "${track.name}".`,
        track: {
          _id: track._id,
          name: track.name,
          examDriveFileName: track.examDriveFileName,
          examDriveFileUrl: track.examDriveFileUrl
        }
      });
    }

    // ── ROUND-LEVEL (legacy / toàn vòng): Store on Round ──
    if (roundId) {
      const round = await Round.findById(roundId);
      if (!round || round.eventId.toString() !== eventId) {
        return res.status(404).json({ message: 'Không tìm thấy vòng thi của sự kiện này.' });
      }

      round.driveFileId = driveFileId;
      round.driveFileName = fileName;
      round.driveFileUrl = fileUrl;
      round.isDriveAccessSynced = false;
      round.driveSyncedEmailCount = 0;
      round.driveSyncErrors = [];
      await round.save();

      const newLog = new EventLog({
        eventId,
        actorId: req.user._id,
        action: 'upload_round_exam',
        details: `Gắn đề Google Drive cho vòng "${round.name}" (${fileName})`
      });
      await newLog.save();

      // Auto-sync Drive access in background on upload
      if (driveFileId) {
        console.log(`[DRIVE] Auto-syncing Drive access for round upload in background...`);
        syncDriveAccessForRound(roundId).catch(err => {
          console.error(`[DRIVE ERROR] Auto-sync failed on round exam upload:`, err.message);
        });
      }

      return res.json({
        message: 'Đã lưu và đồng bộ link Drive cho vòng thi.',
        round: sanitizeRoundForAdmin(round)
      });
    }

    // Legacy: track-level attachment (deprecated)
    const fileMeta = {
      id: `file-${Date.now()}`,
      fileName,
      fileUrl,
      trackId: trackId || null,
      uploadedAt: new Date(),
      uploadedBy: req.user.fullName
    };

    event.attachments.push(fileMeta);
    await event.save();

    res.json({
      message: 'Lưu tài liệu (event level). Nên dùng trackId để gắn link Drive per bảng.',
      attachment: fileMeta
    });

  } catch (error) {
    console.error('Upload Exam Details Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi lưu tài liệu đề bài.' });
  }
});

/**
 * @route   GET /api/events/:eventId/roles
 * @desc    Get all assigned roles for an event
 * @access  Private (Coordinator or Admin)
 */
router.get('/:eventId/roles', authenticateToken, async (req, res) => {
  const { eventId } = req.params;

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: { $in: ['admin_view', 'student_assistant'] },
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Không có quyền truy cập.' });
    }

    // Auto-heal missing trackId for roles with roundId (such as Final Round)
    const unassignedRoles = await EventRole.find({ eventId, status: 'active', trackId: null, roundId: { $ne: null } });
    if (unassignedRoles.length > 0) {
      for (const roleObj of unassignedRoles) {
        const roundTracks = await Track.find({ roundId: roleObj.roundId });
        if (roundTracks.length >= 1) {
          const matchedTrack = roundTracks.find(t => t.name.toLowerCase().includes('chung kết')) || (roundTracks.length === 1 ? roundTracks[0] : null);
          if (matchedTrack) {
            roleObj.trackId = matchedTrack._id;
            await roleObj.save();
          }
        }
      }
    }

    const roles = await EventRole.find({ eventId, status: 'active' })
      .populate('userId', 'email fullName studentId university githubUsername')
      .populate('trackId', 'name');

    res.json(roles);
  } catch (error) {
    console.error('Fetch Event Roles Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy vai trò người dùng.' });
  }
});

/**
 * @route   DELETE /api/events/:eventId/roles/:roleId
 * @desc    Remove an event role assignment
 * @access  Private (Coordinator or Admin)
 */
router.delete('/:eventId/roles/:roleId', authenticateToken, async (req, res) => {
  const { eventId, roleId } = req.params;

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: { $in: ['admin_view', 'student_assistant'] },
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Không có quyền truy cập.' });
    }

    const roleToUpdate = await EventRole.findById(roleId);
    if (!roleToUpdate) return res.status(404).json({ message: 'Không tìm thấy phân công vai trò.' });

    // Mark status as removed
    roleToUpdate.status = 'removed';
    await roleToUpdate.save();

    // If the removed role is mentor, unset mentorId on all teams in this event for this user
    if (roleToUpdate.role === 'mentor') {
      const TeamModel = mongoose.model('Team');
      await TeamModel.updateMany(
        { eventId, mentorId: roleToUpdate.userId },
        { $unset: { mentorId: 1 } }
      );
    }

    // Create EventLog
    const targetUser = await User.findById(roleToUpdate.userId);
    const userEmailStr = targetUser ? targetUser.email : 'Unknown User';
    let roleDetails = `Gỡ vai trò "${roleToUpdate.role}" của người dùng ${userEmailStr}`;
    if (roleToUpdate.trackId) {
      const Track = mongoose.model('Track');
      const track = await Track.findById(roleToUpdate.trackId);
      if (track) {
        roleDetails += ` tại bảng đấu: "${track.name}"`;
      }
    }
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'remove_role',
      type: 'operation',
      details: roleDetails
    });
    await newLog.save();

    res.json({ message: 'Xóa phân công vai trò thành công.' });
  } catch (error) {
    console.error('Remove Role Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi xóa vai trò.' });
  }
});

/**
 * @route   POST /api/events/:eventId/distribute-teams
 * @desc    Randomly distribute confirmed teams (without trackId) to tracks of this event
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/distribute-teams', authenticateToken, async (req, res) => {
  const { eventId } = req.params;

  try {
    // 1. Auth Check (Admin or Coordinator)
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: 'student_assistant',
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Không có quyền truy cập. Yêu cầu quyền Admin hoặc CTSV.' });
    }

    // Fetch Event to get org name
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });

    // 2. Fetch tracks, excluding those belonging to the final round(s)
    const Round = mongoose.model('Round');
    const rounds = await Round.find({ eventId });
    const finalRoundIds = rounds
      .filter(r => r.name.toLowerCase().includes('chung kết') || r.name.toLowerCase() === 'final' || r.advanceTopN === 0)
      .map(r => r._id.toString());

    const tracks = await Track.find({
      eventId,
      roundId: { $nin: finalRoundIds }
    });
    if (tracks.length === 0) {
      return res.status(400).json({ message: 'Sự kiện này chưa có bảng đấu hợp lệ (không phải chung kết) nào để chia bảng. Vui lòng tạo bảng đấu trước.' });
    }

    // 3. Fetch confirmed teams without trackId
    const teams = await Team.find({
      eventId,
      status: 'confirmed',
      $or: [{ trackId: null }, { trackId: { $exists: false } }]
    });

    if (teams.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy nhóm thi đấu nào đã xác nhận mà chưa chia bảng.' });
    }

    // 4. Shuffle teams (Fisher-Yates)
    const shuffledTeams = [...teams];
    for (let i = shuffledTeams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
    }

    // 5. Distribute teams to tracks evenly
    const distributionResult = [];
    for (let i = 0; i < shuffledTeams.length; i++) {
      const team = shuffledTeams[i];
      const trackIndex = i % tracks.length;
      const track = tracks[trackIndex];

      team.trackId = track._id;
      await team.save();

      provisionTeamRepository(team, { trackId: track._id })
        .then(({ created }) => {
          if (created) {
            console.log(`[DISTRIBUTION] Provisioned GitHub repo and added collaborators for team: ${team.name}`);
          }
        })
        .catch(gitErr => {
          console.error(`[DISTRIBUTION] Error provisioning GitHub repo for team ${team.name}:`, gitErr.message);
        });

      // Also ensure chat room is created if mentor exists
      await ensureChatRoomForTeam(team);

      distributionResult.push({
        teamId: team._id,
        teamName: team.name,
        trackId: track._id,
        trackName: track.name
      });
    }

    // Auto-sync Google Drive access for the active round if it exists
    const activeRound = await Round.findOne({ eventId, status: 'active' });
    if (activeRound) {
      console.log(`[DISTRIBUTION] Auto-syncing Drive access for active round "${activeRound.name}" after team distribution...`);
      syncDriveAccessForRound(activeRound._id).catch(err => {
        console.error(`[DISTRIBUTION ERROR] Auto-sync Drive failed:`, err.message);
      });
    }

    // Create EventLog
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'distribute_teams',
      type: 'operation',
      details: `Tự động phân bổ ${shuffledTeams.length} đội thi vào ${tracks.length} bảng đấu (${tracks.map(t => t.name).join(', ')})`
    });
    await newLog.save();

    res.json({
      message: `Đã phân chia thành công ${shuffledTeams.length} đội thi vào ${tracks.length} bảng đấu.`,
      distribution: distributionResult
    });

  } catch (error) {
    console.error('Distribute Teams Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống trong quá trình chia bảng đấu.' });
  }
});

/**
 * @route   PUT /api/events/:id
 * @desc    Update event details/status (System Admin or Coordinator)
 * @access  Private
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, semester, year, description, bannerUrl, maxTeams, githubOrgName, status, registrationOpen, registrationClose, contestStart, contestEnd, commitSyncInterval, mainGoal, durationText, memberLimitText, prizePoolText, phase1Description, phase2Description, phase3Description, rules, zaloUrl, customTimeline, prizes, specialPrizes, locationAnnouncement } = req.body;
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });

    const oldStatus = event.status;
    let logDetails = [];
    let isTimeUpdated = false;

    // Auth check: System Admin only
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ có quản trị viên hệ thống mới có thể cập nhật sự kiện.' });
    }

    // Validation for event status change
    if (status && status !== oldStatus) {
      // CRITICAL SAFETY CHECK: Only one active event (registration or ongoing) can exist at any time.
      // This check must NEVER be bypassed, even by system admins or force overrides!
      if (status === 'registration' || status === 'ongoing') {
        const activeEvent = await Event.findOne({
          _id: { $ne: event._id },
          status: { $in: ['registration', 'ongoing'] }
        });
        if (activeEvent) {
          return res.status(400).json({
            message: `Không thể chuyển sự kiện sang trạng thái "${status}" vì đang có sự kiện khác đang hoạt động: "${activeEvent.name}" (Trạng thái: ${activeEvent.status}). Chỉ khi sự kiện đó được chuyển thành completed hoặc cancelled thì mới có thể mở hoạt động sự kiện khác.`
          });
        }
      }

      const isForceOverride = req.body.isForceOverride === true || req.user.isSystemAdmin;
      if (!isForceOverride) {
        // 1. If there is any event currently ongoing, a draft event cannot change its status
        if (oldStatus === 'draft') {
          const ongoingEvent = await Event.findOne({ status: 'ongoing' });
          if (ongoingEvent) {
            return res.status(400).json({
              message: `Không thể thay đổi trạng thái của sự kiện đang ở trạng thái draft vì đang có sự kiện khác đang diễn ra (ongoing): "${ongoingEvent.name}".`
            });
          }
        }

        // 2. Define valid transitions mapping (supports prepare and ongoing transition)
        const validTransitions = {
          draft: ['registration', 'cancelled'],
          registration: ['prepare', 'ongoing', 'cancelled'],
          prepare: ['ongoing', 'cancelled'],
          ongoing: ['completed'],
          completed: [],
          cancelled: []
        };

        const allowedNext = validTransitions[oldStatus];
        if (!allowedNext || !allowedNext.includes(status)) {
          return res.status(400).json({
            message: `Không thể chuyển trạng thái từ "${oldStatus}" sang "${status}". Trạng thái sự kiện phải được nâng theo từng bậc và không thể nhảy vọt.`
          });
        }
      } else {
        logDetails.push(`[SUPER-ADMIN OVERRIDE] Ép chuyển trạng thái: "${oldStatus}" -> "${status}"`);
      }
    }

    if (name && name !== event.name) {
      logDetails.push(`Tên sự kiện: "${event.name}" -> "${name}"`);
      event.name = name;
    }
    if (semester && semester !== event.semester) {
      logDetails.push(`Học kỳ: "${event.semester}" -> "${semester}"`);
      event.semester = semester;
    }
    if (year && parseInt(year) !== event.year) {
      logDetails.push(`Năm: ${event.year} -> ${year}`);
      event.year = parseInt(year);
    }
    if (description !== undefined && description !== event.description) {
      logDetails.push(`Mô tả sự kiện`);
      event.description = description;
    }
    if (bannerUrl !== undefined && bannerUrl !== event.bannerUrl) {
      logDetails.push(`Ảnh banner`);
      event.bannerUrl = bannerUrl;
    }
    if (maxTeams && parseInt(maxTeams) !== event.maxTeams) {
      logDetails.push(`Số lượng đội tối đa: ${event.maxTeams || 0} -> ${maxTeams}`);
      event.maxTeams = parseInt(maxTeams);
    }

    if (commitSyncInterval !== undefined) {
      const parsedInterval = parseInt(commitSyncInterval);
      if (!isNaN(parsedInterval) && parsedInterval > 0) {
        if (event.commitSyncInterval !== parsedInterval) {
          logDetails.push(`Chu kỳ đồng bộ commit: ${event.commitSyncInterval || 30} phút -> ${parsedInterval} phút`);
          event.commitSyncInterval = parsedInterval;
        }
      }
    }

    if (registrationOpen !== undefined) {
      const newOpen = registrationOpen ? new Date(registrationOpen) : null;
      const oldOpen = event.registrationOpen;
      if ((!oldOpen && newOpen) || (oldOpen && !newOpen) || (oldOpen && newOpen && oldOpen.getTime() !== newOpen.getTime())) {
        event.registrationOpen = newOpen;
        logDetails.push(`Thời gian mở đăng ký: ${newOpen ? newOpen.toLocaleString('vi-VN') : 'Trống'}`);
        isTimeUpdated = true;
      }
    }

    if (registrationClose !== undefined) {
      const newClose = registrationClose ? new Date(registrationClose) : null;
      const oldClose = event.registrationClose;
      if ((!oldClose && newClose) || (oldClose && !newClose) || (oldClose && newClose && oldClose.getTime() !== newClose.getTime())) {
        event.registrationClose = newClose;
        logDetails.push(`Thời gian đóng đăng ký: ${newClose ? newClose.toLocaleString('vi-VN') : 'Trống'}`);
        isTimeUpdated = true;
      }
    }

    if (contestStart !== undefined) {
      const newStart = contestStart ? new Date(contestStart) : null;
      const oldStart = event.contestStart;
      if ((!oldStart && newStart) || (oldStart && !newStart) || (oldStart && newStart && oldStart.getTime() !== newStart.getTime())) {
        event.contestStart = newStart;
        logDetails.push(`Thời gian bắt đầu sự kiện: ${newStart ? newStart.toLocaleString('vi-VN') : 'Trống'}`);
        isTimeUpdated = true;
      }
    }

    if (contestEnd !== undefined) {
      const newEnd = contestEnd ? new Date(contestEnd) : null;
      const oldEnd = event.contestEnd;
      if ((!oldEnd && newEnd) || (oldEnd && !newEnd) || (oldEnd && newEnd && oldEnd.getTime() !== newEnd.getTime())) {
        event.contestEnd = newEnd;
        logDetails.push(`Thời gian kết thúc sự kiện: ${newEnd ? newEnd.toLocaleString('vi-VN') : 'Trống'}`);
        isTimeUpdated = true;
      }
    }

    if (githubOrgName && githubOrgName !== event.githubOrgName) {
      logDetails.push(`GitHub Org: "${event.githubOrgName || 'Chưa liên kết'}" -> "${githubOrgName}"`);
      event.githubOrgName = githubOrgName;
      // Auto-provision or link new organization
      await githubService.createOrganization(githubOrgName);
    }

    if (mainGoal !== undefined) {
      logDetails.push(`Mục tiêu chính`);
      event.mainGoal = mainGoal;
    }
    if (durationText !== undefined) {
      logDetails.push(`Thời gian cuộc thi`);
      event.durationText = durationText;
    }
    if (memberLimitText !== undefined) {
      logDetails.push(`Giới hạn thành viên`);
      event.memberLimitText = memberLimitText;
    }
    if (prizePoolText !== undefined) {
      logDetails.push(`Quỹ giải thưởng`);
      event.prizePoolText = prizePoolText;
    }
    if (zaloUrl !== undefined) {
      logDetails.push(`Link Zalo`);
      event.zaloUrl = zaloUrl;
    }
    if (phase1Description !== undefined) {
      logDetails.push(`Mô tả Giai đoạn 1`);
      event.phase1Description = phase1Description;
    }
    if (phase2Description !== undefined) {
      logDetails.push(`Mô tả Giai đoạn 2`);
      event.phase2Description = phase2Description;
    }
    if (phase3Description !== undefined) {
      logDetails.push(`Mô tả Giai đoạn 3`);
      event.phase3Description = phase3Description;
    }
    if (rules !== undefined) {
      logDetails.push(`Quy định cuộc thi`);
      event.rules = rules;
    }
    if (customTimeline !== undefined) {
      logDetails.push(`Lịch trình tùy chỉnh`);
      event.customTimeline = customTimeline;
    }
    if (prizes !== undefined) {
      logDetails.push(`Cơ cấu giải thưởng tùy chỉnh`);
      event.prizes = prizes;
    }
    if (specialPrizes !== undefined) {
      logDetails.push(`Giải thưởng phụ/Hạng mục đặc biệt`);
      event.specialPrizes = specialPrizes;
    }
    if (locationAnnouncement !== undefined) {
      logDetails.push(`Thông báo khu vực thi / Đội thi`);
      event.locationAnnouncement = locationAnnouncement;
    }

    let action = 'update_event';
    let details = `Cập nhật thông tin sự kiện: ${event.name}`;

    if (status && status !== oldStatus) {
      event.status = status;
      if (status === 'registration' || status === 'ongoing') {
        try {
          await assignStudentAssistantsToEvent(event._id, req.user._id);
        } catch (err) {
          console.error(`[EVENT ERROR] Failed to auto-assign student assistants on event status update:`, err.message);
        }
      }
      if (status === 'ongoing') {
        action = 'event_started';
        details = `Sự kiện "${event.name}" chính thức bắt đầu (ongoing)`;
      } else if (status === 'completed') {
        action = 'event_completed';
        details = `Sự kiện "${event.name}" đã hoàn thành (completed)`;

        try {
          await downgradeEventRolesToParticipant(event._id);
          console.log(`[EVENT] Downgraded roles for completed event: ${event.name}`);
        } catch (err) {
          console.error(`[EVENT ERROR] Failed to downgrade roles for event ${event._id}:`, err.message);
        }

        try {
          await autoKickAllRepoCollaborators(event._id, req.user._id);
          console.log(`[EVENT] Automatically kicked all repository collaborators for completed event: ${event.name}`);
        } catch (err) {
          console.error(`[EVENT ERROR] Failed to auto-kick collaborators:`, err.message);
        }
      } else {
        details = `Thay đổi trạng thái sự kiện "${event.name}" từ ${oldStatus} sang ${status}`;
      }
    } else if (logDetails.length > 0) {
      if (isTimeUpdated && logDetails.every(detail => detail.includes('Thời gian'))) {
        action = 'update_event_time';
      }
      details = `Cập nhật thông tin sự kiện "${event.name}": ${logDetails.join(', ')}`;
    }

    await event.save();

    // Create EventLog
    const newLog = new EventLog({
      eventId: event._id,
      actorId: req.user._id,
      action,
      type: 'operation',
      details
    });
    await newLog.save();

    res.json({ message: 'Cập nhật sự kiện thành công!', event });
  } catch (error) {
    console.error('Update Event Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật sự kiện.' });
  }
});

/**
 * @route   GET /api/events/:eventId/logs
 * @desc    Get all activity logs for a specific event
 * @access  Private (Coordinator or Admin)
 */
router.get('/:eventId/logs', authenticateToken, async (req, res) => {
  const { eventId } = req.params;

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ có quản trị viên hệ thống mới có thể xem nhật ký sự kiện.' });
    }

    const logs = await EventLog.find({ eventId, type: { $ne: 'login' } })
      .populate('actorId', 'fullName email')
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (error) {
    console.error('Fetch Event Logs Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy nhật ký sự kiện.' });
  }
});

/**
 * @route   DELETE /api/events/:id
 * @desc    Soft-delete / Archive an event by setting isArchived to true
 *          (All information remains in DB, but hidden from everyone except admin/coordinators)
 * @access  Private (System Admin)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Only System Admin can permanently delete events
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền hạn không đủ. Chỉ Admin hệ thống mới có thể xóa vĩnh viễn sự kiện.' });
    }

    const eventId = req.params.id;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    }

    const Rubric = mongoose.model('Rubric');
    const Criterion = mongoose.model('Criterion');
    const Score = mongoose.model('Score');
    const Ranking = mongoose.model('Ranking');

    // 1. Get all teams in this event
    const teams = await Team.find({ eventId });
    const teamIds = teams.map(t => t._id);

    // 2. Delete team members
    await TeamMember.deleteMany({ teamId: { $in: teamIds } });

    // 3. Delete github repositories associated with these teams
    await GithubRepository.deleteMany({ teamId: { $in: teamIds } });

    // 4. Delete scores and rankings
    await Score.deleteMany({ eventId });
    await Ranking.deleteMany({ eventId });

    // 5. Delete criteria and rubrics
    const rubrics = await Rubric.find({ eventId });
    const rubricIds = rubrics.map(r => r._id);
    await Criterion.deleteMany({ rubricId: { $in: rubricIds } });
    await Rubric.deleteMany({ eventId });

    // 6. Delete tracks, rounds, roles, logs
    await Track.deleteMany({ eventId });
    await Round.deleteMany({ eventId });
    await EventRole.deleteMany({ eventId });
    await EventLog.deleteMany({ eventId });

    // 7. Delete teams
    await Team.deleteMany({ eventId });

    // 8. Delete the event itself
    await Event.findByIdAndDelete(eventId);

    res.json({ message: 'Sự kiện và toàn bộ dữ liệu liên quan đã được xóa vĩnh viễn thành công.' });
  } catch (error) {
    console.error('Delete Event Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi xóa sự kiện.' });
  }
});

/**
 * @route   DELETE /api/events/:eventId/rounds/:roundId
 * @desc    Delete a Round in an Event
 * @access  Private (System Admin or Event Coordinator)
 */
router.delete('/:eventId/rounds/:roundId', authenticateToken, async (req, res) => {
  const { eventId, roundId } = req.params;
  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });

    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ System Admin mới có quyền xóa vòng thi.' });
    }

    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: 'Không tìm thấy vòng thi.' });

    const Rubric = mongoose.model('Rubric');
    await Round.findByIdAndDelete(roundId);
    await Rubric.deleteMany({ roundId });
    await Track.updateMany({ roundId }, { $unset: { roundId: "" } });

    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'delete_round',
      type: 'operation',
      details: `Xóa vòng thi: "${round.name}" (Vòng ${round.order})`
    });
    await newLog.save();

    res.json({ message: 'Đã xóa vòng thi thành công!' });
  } catch (error) {
    console.error('Delete Round Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi xóa vòng thi.' });
  }
});

/**
 * @route   PUT /api/events/:id/seminar
 * @desc    Configure Seminar schedule and meet link for an event
 * @access  Private (Coordinator or Admin)
 */
router.put('/:id/seminar', authenticateToken, async (req, res) => {
  const eventId = req.params.id;
  const { scheduledAt, scheduledEnd, meetUrl, title, description, attendanceFormUrl, attendanceSpreadsheetUrl } = req.body;

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });

    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ System Admin mới có quyền cấu hình seminar.' });
    }

    if (scheduledAt) {
      const semDate = new Date(scheduledAt);
      if (isNaN(semDate.getTime())) {
        return res.status(400).json({ message: 'Thời gian bắt đầu Seminar không hợp lệ.' });
      }
    }

    if (scheduledEnd) {
      const semEndDate = new Date(scheduledEnd);
      if (isNaN(semEndDate.getTime())) {
        return res.status(400).json({ message: 'Thời gian kết thúc Seminar không hợp lệ.' });
      }
      if (scheduledAt && semEndDate <= new Date(scheduledAt)) {
        return res.status(400).json({ message: 'Thời gian kết thúc Seminar phải diễn ra SAU thời gian bắt đầu.' });
      }
    }

    if (!event.seminar) event.seminar = {};

    if (scheduledAt !== undefined) event.seminar.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined;
    if (scheduledEnd !== undefined) event.seminar.scheduledEnd = scheduledEnd ? new Date(scheduledEnd) : undefined;
    if (meetUrl !== undefined) event.seminar.meetUrl = meetUrl;
    if (title !== undefined) event.seminar.title = title;
    if (description !== undefined) event.seminar.description = description;
    if (attendanceFormUrl !== undefined) event.seminar.attendanceFormUrl = attendanceFormUrl;
    if (attendanceSpreadsheetUrl !== undefined) event.seminar.attendanceSpreadsheetUrl = attendanceSpreadsheetUrl;

    await event.save();

    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'update_seminar',
      type: 'operation',
      details: `Cập nhật thông tin Seminar: "${event.seminar.title}" (Link Meet: ${meetUrl || 'Chưa có'})`
    });
    await newLog.save();

    res.json({ message: 'Cập nhật cấu hình Seminar thành công!', seminar: event.seminar, event });
  } catch (error) {
    console.error('Update Seminar Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật Seminar.' });
  }
});

/**
 * @route   POST /api/events/:id/seminar/send-email
 * @desc    Send Seminar Google Meet invitation emails to all registered contestants
 * @access  Private (Coordinator or Admin)
 */
router.post('/:id/seminar/send-email', authenticateToken, async (req, res) => {
  const eventId = req.params.id;

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });

    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ System Admin mới có quyền gửi email Seminar.' });
    }

    if (!event.seminar || !event.seminar.meetUrl) {
      return res.status(400).json({ message: 'Vui lòng nhập Link phòng họp (Google Meet) trước khi gửi mail thông báo!' });
    }

    // Fetch only team leaders for this event
    const members = await TeamMember.find({ eventId, role: 'leader' }).populate('userId', 'email fullName');

    // Extract unique contestant emails & names
    const recipientMap = new Map();
    members.forEach(m => {
      if (m.userId && m.userId.email) {
        recipientMap.set(m.userId.email.toLowerCase(), {
          email: m.userId.email,
          name: m.userId.fullName || 'Thí sinh'
        });
      }
    });

    const recipients = Array.from(recipientMap.values());

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'Chưa có trưởng nhóm/đội thi nào đăng ký tham gia sự kiện này để gửi mail.' });
    }

    // Send emails
    let successCount = 0;
    for (const rec of recipients) {
      try {
        await emailService.sendSeminarInvitation(rec.email, rec.name, event.name, event.seminar, event._id);
        successCount++;
      } catch (err) {
        console.error(`Failed to send seminar email to ${rec.email}:`, err.message);
      }
    }

    event.seminar.isEmailSent = true;
    event.seminar.emailSentAt = new Date();
    await event.save();

    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'send_seminar_email',
      type: 'system',
      details: `Đã gửi email mời Seminar cho ${successCount}/${recipients.length} thí sinh.`
    });
    await newLog.save();

    res.json({
      message: `Đã phát email thông báo Seminar thành công cho ${successCount} thí sinh!`,
      sentCount: successCount,
      totalCount: recipients.length,
      emailSentAt: event.seminar.emailSentAt
    });
  } catch (error) {
    console.error('Send Seminar Email Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi gửi email thông báo Seminar.' });
  }
});

/**
 * @route   GET /api/events/:eventId/export-teams
 * @desc    Export all confirmed/pending teams in an event as Excel
 * @access  Coordinator/Admin only
 */
router.get('/:eventId/export-teams', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.eventId;

    // Check permission
    if (!req.user.isSystemAdmin) {
      const role = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: { $in: ['admin_view', 'student_assistant'] },
        status: 'active'
      });
      if (!role) {
        return res.status(403).json({ message: 'Không có quyền truy cập.' });
      }
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    }

    // Load teams (all statuses to let them view pending and disqualified too)
    const teams = await Team.find({ eventId })
      .populate('trackId', 'name')
      .populate('leaderId', 'fullName email')
      .populate('mentorId', 'fullName email');

    // Load all confirmed team members for these teams
    const teamIds = teams.map(t => t._id);
    const allMembers = await TeamMember.find({ teamId: { $in: teamIds } })
      .populate('userId', 'fullName studentId email githubUsername university');

    // Load all GitHub Repositories for these teams
    const repos = await GithubRepository.find({ teamId: { $in: teamIds } });

    const wb = XLSX.utils.book_new();
    const wsData = [
      // Title
      [`DANH SÁCH ĐỘI THI - ${event.name.toUpperCase()}`],
      [`Kỳ học: Kỳ ${event.semester} ${event.year}`],
      [], // Empty row
      // Table Headers
      ["STT", "Tên Đội", "Trạng thái", "Bảng đấu (Track)", "Github Repository", "Trưởng nhóm", "Email Trưởng nhóm", "Thành viên", "Mentor"]
    ];

    // Build row data
    teams.forEach((team, index) => {
      const members = allMembers.filter(m => m.teamId.toString() === team._id.toString());
      const memberNames = members.map(m => {
        let txt = m.userId?.fullName || 'N/A';
        if (m.userId?.studentId) txt += ` (${m.userId.studentId})`;
        if (m.role === 'leader') txt += ' [L]';
        return txt;
      }).join(', ');

      const statusMap = {
        'confirmed': 'Đã xác nhận',
        'pending_confirm': 'Chờ duyệt',
        'disqualified': 'Đã loại'
      };

      const teamRepo = repos.find(rp => rp.teamId.toString() === team._id.toString());
      const repoUrl = teamRepo ? teamRepo.repoUrl : 'Chưa liên kết';

      wsData.push([
        index + 1,
        team.name,
        statusMap[team.status] || team.status,
        team.trackId?.name || 'Chưa chia bảng',
        repoUrl,
        team.leaderId?.fullName || 'N/A',
        team.leaderId?.email || 'N/A',
        memberNames,
        team.mentorId ? `${team.mentorId.fullName} (${team.mentorId.email})` : 'Chưa gán'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge title cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }
    ];

    // Columns width
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 25 }, // Tên Đội
      { wch: 15 }, // Trạng thái
      { wch: 20 }, // Bảng đấu
      { wch: 30 }, // Github Repo
      { wch: 22 }, // Trưởng nhóm
      { wch: 25 }, // Email Trưởng nhóm
      { wch: 50 }, // Thành viên
      { wch: 25 }  // Mentor
    ];

    // Styling worksheet using xlsx-js-style
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = range.s.r; r <= range.e.r; ++r) {
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;

        const cell = ws[cellRef];
        cell.s = cell.s || {};

        if (r === 0) {
          // Main Title
          cell.s.font = { bold: true, size: 14, name: 'Calibri', color: { rgb: '0F172A' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === 1) {
          // Subtitle
          cell.s.font = { italic: true, size: 11, name: 'Calibri', color: { rgb: '475569' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === 3) {
          // Table Headers
          cell.s.font = { bold: true, name: 'Calibri', color: { rgb: 'FFFFFF' } };
          cell.s.fill = { patternType: 'solid', fgColor: { rgb: '0F172A' } }; // Dark slate header
          cell.s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          cell.s.border = {
            top: { style: 'medium', color: { rgb: '475569' } },
            bottom: { style: 'medium', color: { rgb: '475569' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
          };
        } else if (r > 3) {
          // Data rows
          cell.s.font = { name: 'Calibri', size: 10 };
          cell.s.alignment = {
            vertical: 'center',
            horizontal: c === 0 || c === 2 || c === 3 ? 'center' : 'left',
            wrapText: true
          };
          cell.s.border = {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          };
          // Alternating row background
          if (r % 2 === 1) {
            cell.s.fill = { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } };
          }
        }
      }
    }

    // Set row height for headers
    ws['!rows'] = [];
    ws['!rows'][0] = { hpx: 30 }; // Title row height
    ws['!rows'][1] = { hpx: 20 }; // Subtitle row height
    ws['!rows'][3] = { hpx: 26 }; // Table Header row height

    XLSX.utils.book_append_sheet(wb, ws, 'Teams');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Teams_${event.name.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Export Teams Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi xuất dữ liệu đội thi.' });
  }
});

module.exports = router;
