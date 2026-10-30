const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const XLSX = require('xlsx-js-style');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const Score = mongoose.model('Score');
const ScoreDetail = mongoose.model('ScoreDetail');
const ScoreAudit = mongoose.model('ScoreAudit');
const GradingAssistRequest = mongoose.model('GradingAssistRequest');
const Notification = mongoose.model('Notification');
const Rubric = mongoose.model('Rubric');
const Criterion = mongoose.model('Criterion');
const Team = mongoose.model('Team');
const Round = mongoose.model('Round');
const GithubRepository = mongoose.model('GithubRepository');
const RepositorySnapshot = mongoose.model('RepositorySnapshot');
const Commit = mongoose.model('Commit');
const AiAnalysis = mongoose.model('AiAnalysis');
const Ranking = mongoose.model('Ranking');
const EventRole = mongoose.model('EventRole');
const Track = mongoose.model('Track');
const User = mongoose.model('User');

const aiService = require('../github-ai/aiService');
const { authenticateToken } = require('../auth/authMiddleware');
const { addInAppJob, isQueueAvailable } = require('../notifications/notificationQueue');
const { validateScoreSubmissionPolicy, buildScoreChangeSummary } = require('./scorePolicy');
const { findActiveRubric } = require('./rubricResolver');

const AUTO_GRANT_WINDOW_MS = 5 * 60 * 1000;

function isAutoAssistWindow(round) {
  if (!round?.gradingEndTime) return false;
  return new Date(round.gradingEndTime).getTime() - Date.now() <= AUTO_GRANT_WINDOW_MS;
}

async function findCoordinatorRole(userId, eventId) {
  return EventRole.findOne({
    userId,
    eventId,
    role: { $in: ['admin_view', 'student_assistant'] },
    status: 'active',
  });
}

async function resolveAssistAccess({ team, round, judgeId, coordinatorId }) {
  let request = await GradingAssistRequest.findOne({
    teamId: team._id,
    roundId: round._id,
    judgeId,
    coordinatorId,
  });

  if (isAutoAssistWindow(round) && !['approved', 'auto_granted'].includes(request?.status)) {
    request = await GradingAssistRequest.findOneAndUpdate(
      { teamId: team._id, roundId: round._id, judgeId, coordinatorId },
      { $set: { status: 'auto_granted', autoGrantedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  return {
    allowed: ['approved', 'auto_granted'].includes(request?.status),
    request,
    autoGrantAvailable: isAutoAssistWindow(round),
    gradingEndTime: round.gradingEndTime,
  };
}

/**
 * @route   POST /api/grades/suggestion
 * @desc    Get Gemini AI suggested grading based on commits & rubric
 * @access  Private (Judges / Coords)
 */
router.post('/suggestion', authenticateToken, async (req, res) => {
  const { teamId, roundId, rubricId } = req.body;

  if (!teamId || !roundId || !rubricId) {
    return res.status(400).json({ message: 'Missing teamId, roundId, or rubricId parameters.' });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    let activeRubric = await Rubric.findOne({ _id: rubricId, roundId, isActive: true });
    if (!activeRubric) {
      activeRubric = await Rubric.findOne({ _id: rubricId, roundId }) || await Rubric.findById(rubricId);
    }
    if (!activeRubric) {
      return res.status(400).json({ message: 'Rubric is not active or is not assigned to the selected round.' });
    }

    // Verify track permissions for judges
    if (!req.user.isSystemAdmin) {
      let userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        roundId: roundId,
        role: { $in: ['judge', 'admin_view', 'student_assistant'] },
        status: 'active'
      });

      if (!userRole) {
        userRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          role: { $in: ['judge', 'admin_view', 'student_assistant'] },
          $or: [{ roundId: null }, { roundId: { $exists: false } }],
          status: 'active'
        });
      }

      if (!userRole) {
        return res.status(403).json({ message: 'Only assigned judges or coordinators can request suggestions.' });
      }

      if (userRole.role === 'judge' && userRole.trackId) {
        if (!team.trackId || team.trackId.toString() !== userRole.trackId.toString()) {
          return res.status(403).json({ message: 'Bạn chỉ có quyền lấy gợi ý chấm điểm cho đội thuộc bảng đấu được phân công.' });
        }
      }
    }

    // 1. Fetch criteria
    const criteria = await Criterion.find({ rubricId: activeRubric._id }).sort({ order: 1 });
    if (criteria.length === 0) {
      return res.status(404).json({ message: 'No criteria found for this rubric.' });
    }

    // 2. Fetch repo & commits
    const repo = await GithubRepository.findOne({ teamId });
    if (!repo) {
      return res.status(404).json({ message: 'No GitHub repository associated with this team.' });
    }

    const commits = await Commit.find({ teamId, message: { $not: /initial commit/i } }).sort({ committedAt: -1 }).limit(10);

    // 3. Find or create a snapshot representation
    let snapshot = await RepositorySnapshot.findOne({ teamId, roundId });
    if (!snapshot) {
      snapshot = new RepositorySnapshot({
        repositoryId: repo._id,
        teamId,
        roundId,
        commitSha: repo.lastCommitSha || 'mock-sha-latest',
        branch: repo.defaultBranch || 'main',
        capturedReason: 'AI Grading Pre-fetch Generation'
      });
      await snapshot.save();
    } else if (repo.lastCommitSha && snapshot.commitSha !== repo.lastCommitSha) {
      snapshot.commitSha = repo.lastCommitSha;
      snapshot.branch = repo.defaultBranch || snapshot.branch;
      snapshot.capturedReason = 'AI Grading Refresh';
      await snapshot.save();
    }

    // 4. Agent 2 evaluates saved Agent 1 evidence (if any) along with commit history
    // against the active rubric assigned to the selected round.
    const priorReviews = await AiAnalysis.find({
      teamId,
      repositoryId: repo._id,
      analysisType: { $in: ['commit_review', 'per_push'] },
      status: { $in: ['completed', 'done', 'approved'] }
    }).sort({ createdAt: -1 }).limit(10);

    let aggregateResult;
    try {
      aggregateResult = await aiService.analyzeTeamAggregate(
        teamId,
        commits,
        priorReviews,
        { roundId, rubricId: activeRubric._id, criteria }
      );
    } catch (aggErr) {
      console.warn('[AI GRADES] analyzeTeamAggregate failed:', aggErr.message);
      return res.status(503).json({ message: `Không thể phân tích AI lúc này: ${aggErr.message}` });
    }

    const aggregateAnalysis = new AiAnalysis({
      repositoryId: repo._id,
      teamId,
      roundId,
      repositorySnapshotId: snapshot._id,
      analysisType: 'repository_review',
      provider: aggregateResult._provider || 'Google Gemini',
      model: aggregateResult._model || 'gemini-3.1-flash-lite',
      inputSummary: {
        trigger: 'judge_ai_analysis_button',
        rubricId: activeRubric._id,
        rubricVersion: activeRubric.version || 1,
        agent1AnalysisIds: priorReviews.map(review => review._id)
      },
      result: aggregateResult,
      status: 'completed',
      completedAt: new Date()
    });
    await aggregateAnalysis.save();

    // 5. Convert Agent 2 qualitative evaluation into score suggestions. The
    // judge remains responsible for editing and submitting the official score.
    let suggestions;
    try {
      suggestions = await aiService.generateScoringSuggestion(snapshot, commits, criteria);
    } catch (sugErr) {
      console.warn('[AI GRADES] generateScoringSuggestion failed:', sugErr.message);
      return res.status(503).json({ message: `Không thể tạo gợi ý điểm: ${sugErr.message}` });
    }

    // Map code back to Criterion ID for UI ease
    const mappedSuggestions = suggestions.map(s => {
      const match = criteria.find(c => c.code === s.criterionCode);
      return {
        ...s,
        criterionId: match ? match._id : null
      };
    });

    res.json(mappedSuggestions);

  } catch (error) {
    console.error('AI Grading Suggestion Error:', error.message);
    res.status(500).json({ message: error.message || 'Server error generating suggestions.' });
  }
});

/**
 * @route   GET /api/grades/team/:teamId/achievements
 * @desc    Get rankings and achievements for a team
 * @access  Private (Participants of the team, Mentors, Coords, System Admin)
 */
router.get('/team/:teamId/achievements', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    const Event = mongoose.model('Event');
    const parentEvent = await Event.findById(team.eventId);
    if (parentEvent && parentEvent.isArchived) {
      let isCoordinatorOrAdmin = req.user.isSystemAdmin;
      if (!isCoordinatorOrAdmin) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          role: { $in: ['admin_view', 'student_assistant'] },
          status: 'active'
        });
        isCoordinatorOrAdmin = !!coordRole;
      }
      if (!isCoordinatorOrAdmin) {
        return res.status(403).json({ message: 'Sự kiện của đội thi này đã bị ẩn. Bạn không có quyền truy cập.' });
      }
    }

    // 1. Auth check
    let authorized = req.user.isSystemAdmin;

    // Check if system coordinator
    if (!authorized) {
      const coordRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ['admin_view', 'student_assistant'] },
        status: 'active'
      });
      authorized = !!coordRole;
    }

    // Check if team member
    if (!authorized) {
      const TeamMember = mongoose.model('TeamMember');
      const member = await TeamMember.findOne({
        teamId: team._id,
        userId: req.user._id,
        confirmStatus: 'confirmed'
      });
      authorized = !!member;
    }

    // Check if team mentor
    if (!authorized) {
      const mentorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        trackId: team.trackId,
        role: 'mentor',
        status: 'active'
      });
      authorized = !!mentorRole;
    }

    if (!authorized) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập thông tin thành tích của nhóm này.' });
    }

    const rankings = await Ranking.find({ teamId: req.params.teamId })
      .populate('roundId', 'name status')
      .populate('trackId', 'name')
      .populate('eventId', 'name semester year status')
      .sort({ createdAt: -1 })
      .lean();

    res.json(rankings);
  } catch (error) {
    console.error('Fetch Team Achievements Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải thành tích nhóm.' });
  }
});

/**
 * @route   GET /api/grades/team/:teamId/round/:roundId
 * @desc    Get existing score for a team in a round by the current judge
 * @access  Private (Judges / Coords)
 */
router.get('/team/:teamId/round/:roundId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    // Block non-coordinators/non-admins if event is archived
    const Event = mongoose.model('Event');
    const parentEvent = await Event.findById(team.eventId);
    if (parentEvent && parentEvent.isArchived) {
      let isCoordinatorOrAdmin = req.user.isSystemAdmin;
      if (!isCoordinatorOrAdmin) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          role: { $in: ['admin_view', 'student_assistant'] },
          status: 'active'
        });
        isCoordinatorOrAdmin = !!coordRole;
      }
      if (!isCoordinatorOrAdmin) {
        return res.status(403).json({ message: 'Sự kiện của đội thi này đã bị ẩn. Bạn không có quyền truy cập.' });
      }
    }

    // Check if the user is a coordinator or system admin
    const coordinatorRole = await EventRole.findOne({
      userId: req.user._id,
      eventId: team.eventId,
      role: { $in: ['admin_view', 'student_assistant'] },
      status: 'active'
    });
    const isCoordinator = req.user.isSystemAdmin || !!coordinatorRole;

    // Verify track permissions for judges
    if (!isCoordinator) {
      let userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        roundId: req.params.roundId,
        role: { $in: ['judge', 'admin_view', 'student_assistant'] },
        status: 'active'
      });

      if (!userRole) {
        userRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          role: { $in: ['judge', 'admin_view', 'student_assistant'] },
          $or: [{ roundId: null }, { roundId: { $exists: false } }],
          status: 'active'
        });
      }

      if (!userRole) {
        return res.status(403).json({ message: 'Only assigned judges or coordinators can access scores.' });
      }

      if (userRole.trackId) {
        if (!team.trackId || team.trackId.toString() !== userRole.trackId.toString()) {
          return res.status(403).json({ message: 'Bạn chỉ có quyền xem điểm của các đội thuộc bảng đấu được phân công.' });
        }
      }
    }

    if (isCoordinator) {
      // Coordinator views all scores submitted/locked by all judges for this team/round
      const scores = await Score.find({
        teamId: req.params.teamId,
        roundId: req.params.roundId,
        status: { $in: ['submitted', 'locked'] }
      }).populate('judgeId', 'fullName email');

      const results = [];
      for (const s of scores) {
        const details = await ScoreDetail.find({ scoreId: s._id });
        results.push({
          judge: s.judgeId,
          score: s,
          details: details
        });
      }

      return res.json({
        isCoordinator: true,
        judgesScores: results
      });
    }

    // Standard Judge views their own score
    const score = await Score.findOne({
      teamId: req.params.teamId,
      roundId: req.params.roundId,
      judgeId: req.user._id
    });

    if (!score) {
      return res.json({ score: null, details: [] });
    }

    const details = await ScoreDetail.find({ scoreId: score._id });
    res.json({ score, details });
  } catch (error) {
    console.error('Fetch Score Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving scores.' });
  }
});

/**
 * @route   GET /api/grades/team/:teamId/round/:roundId/history
 * @desc    Fetch score audit history for a team in a round
 * @access  Private (Judges / Coords)
 */
router.get('/team/:teamId/round/:roundId/history', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    const Event = mongoose.model('Event');
    const parentEvent = await Event.findById(team.eventId);
    if (parentEvent && parentEvent.isArchived) {
      let isCoordinatorOrAdmin = req.user.isSystemAdmin;
      if (!isCoordinatorOrAdmin) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          role: { $in: ['admin_view', 'student_assistant'] },
          status: 'active'
        });
        isCoordinatorOrAdmin = !!coordRole;
      }
      if (!isCoordinatorOrAdmin) {
        return res.status(403).json({ message: 'Sự kiện của đội thi này đã bị ẩn. Bạn không có quyền truy cập lịch sử điểm.' });
      }
    }

    const history = await ScoreAudit.find({
      teamId: req.params.teamId,
      roundId: req.params.roundId,
    }).sort({ createdAt: -1 }).populate('actorId', 'fullName email').lean();

    res.json({ history });
  } catch (error) {
    console.error('Fetch Score History Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving score history.' });
  }
});

router.get('/assist/status', authenticateToken, async (req, res) => {
  try {
    const { teamId, roundId, judgeId } = req.query;
    if (!teamId || !roundId || !judgeId) {
      return res.status(400).json({ message: 'Thiếu thông tin đội, vòng thi hoặc giám khảo.' });
    }

    const [team, round, existingScore] = await Promise.all([
      Team.findById(teamId),
      Round.findById(roundId),
      Score.findOne({ teamId, roundId, judgeId }),
    ]);
    if (!team || !round) return res.status(404).json({ message: 'Không tìm thấy đội hoặc vòng thi.' });

    const coordinatorRole = await findCoordinatorRole(req.user._id, team.eventId);
    if (!req.user.isSystemAdmin && !coordinatorRole) {
      return res.status(403).json({ message: 'Bạn không có quyền quản lý hoạt động chấm điểm.' });
    }

    const access = await resolveAssistAccess({
      team,
      round,
      judgeId,
      coordinatorId: req.user._id,
    });
    res.json({
      hasScore: Boolean(existingScore),
      allowed: !existingScore && access.allowed,
      status: access.request?.status || 'not_requested',
      autoGrantAvailable: access.autoGrantAvailable,
      gradingEndTime: access.gradingEndTime,
    });
  } catch (error) {
    console.error('Fetch Assist Status Error:', error.message);
    res.status(500).json({ message: 'Không thể kiểm tra quyền hỗ trợ chấm điểm.' });
  }
});

router.post('/assist/remind', authenticateToken, async (req, res) => {
  try {
    const { teamId, roundId, judgeId } = req.body;
    const [team, round] = await Promise.all([Team.findById(teamId), Round.findById(roundId)]);
    if (!team || !round || !judgeId) return res.status(400).json({ message: 'Thông tin nhắc chấm điểm không hợp lệ.' });

    const coordinatorRole = await findCoordinatorRole(req.user._id, team.eventId);
    if (!req.user.isSystemAdmin && !coordinatorRole) {
      return res.status(403).json({ message: 'Bạn không có quyền gửi nhắc nhở.' });
    }
    const existingScore = await Score.exists({ teamId, roundId, judgeId });
    if (existingScore) return res.status(409).json({ message: 'Giám khảo đã hoàn tất chấm điểm cho đội này.' });

    const recentReminder = await Notification.exists({
      userId: judgeId,
      type: 'grading_reminder',
      'metadata.teamId': teamId,
      'metadata.roundId': roundId,
      createdAt: { $gte: new Date(Date.now() - AUTO_GRANT_WINDOW_MS) },
    });
    if (recentReminder) return res.status(429).json({ message: 'Đã gửi nhắc nhở trong 5 phút gần đây.' });

    await Notification.create({
      userId: judgeId,
      type: 'grading_reminder',
      title: 'Nhắc hoàn tất chấm điểm',
      body: `Điều phối viên nhắc bạn hoàn tất chấm điểm cho đội ${team.name}.`,
      metadata: { teamId, roundId },
      channel: 'in_app',
      status: 'sent',
      sentAt: new Date(),
    });
    res.json({ message: 'Đã gửi nhắc nhở đến giám khảo.' });
  } catch (error) {
    console.error('Send Grading Reminder Error:', error.message);
    res.status(500).json({ message: 'Không thể gửi nhắc nhở chấm điểm.' });
  }
});

router.post('/assist/request', authenticateToken, async (req, res) => {
  try {
    const { teamId, roundId, judgeId } = req.body;
    const [team, round] = await Promise.all([Team.findById(teamId), Round.findById(roundId)]);
    if (!team || !round || !judgeId) return res.status(400).json({ message: 'Thông tin đề nghị hỗ trợ không hợp lệ.' });

    const coordinatorRole = await findCoordinatorRole(req.user._id, team.eventId);
    if (!req.user.isSystemAdmin && !coordinatorRole) {
      return res.status(403).json({ message: 'Bạn không có quyền gửi đề nghị hỗ trợ.' });
    }
    if (await Score.exists({ teamId, roundId, judgeId })) {
      return res.status(409).json({ message: 'Giám khảo đã hoàn tất chấm điểm cho đội này.' });
    }

    const access = await resolveAssistAccess({ team, round, judgeId, coordinatorId: req.user._id });
    if (access.allowed) {
      return res.json({ message: 'Quyền hỗ trợ chấm điểm đã được mở.', status: access.request.status });
    }

    const request = await GradingAssistRequest.findOneAndUpdate(
      { teamId, roundId, judgeId, coordinatorId: req.user._id },
      { $set: { status: 'pending' }, $unset: { respondedAt: 1, autoGrantedAt: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await Notification.create({
      userId: judgeId,
      type: 'grading_assist_request',
      title: 'Đề nghị hỗ trợ chấm điểm',
      body: `Điều phối viên đề nghị được hỗ trợ hoàn tất bài chấm cho đội ${team.name}.`,
      metadata: { requestId: request._id, teamId, roundId },
      channel: 'in_app',
      status: 'sent',
      sentAt: new Date(),
    });
    res.json({ message: 'Đã gửi đề nghị đến giám khảo.', status: request.status });
  } catch (error) {
    console.error('Create Assist Request Error:', error.message);
    res.status(500).json({ message: 'Không thể gửi đề nghị hỗ trợ chấm điểm.' });
  }
});

router.patch('/assist/:requestId/respond', authenticateToken, async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Phản hồi không hợp lệ.' });
    }
    const request = await GradingAssistRequest.findOne({
      _id: req.params.requestId,
      judgeId: req.user._id,
      status: 'pending',
    }).populate('teamId', 'name');
    if (!request) return res.status(404).json({ message: 'Đề nghị không còn hiệu lực.' });

    request.status = decision;
    request.respondedAt = new Date();
    await request.save();
    await Notification.updateMany(
      {
        userId: req.user._id,
        type: 'grading_assist_request',
        'metadata.requestId': request._id,
      },
      {
        $set: {
          isRead: true,
          'metadata.requestStatus': decision,
        },
      },
    );
    await Notification.create({
      userId: request.coordinatorId,
      type: 'grading_assist_response',
      title: decision === 'approved' ? 'Đã chấp thuận hỗ trợ chấm điểm' : 'Đã từ chối hỗ trợ chấm điểm',
      body: `Giám khảo đã ${decision === 'approved' ? 'chấp thuận' : 'từ chối'} đề nghị hỗ trợ cho đội ${request.teamId?.name || ''}.`,
      metadata: { requestId: request._id, status: decision },
      channel: 'in_app',
      status: 'sent',
      sentAt: new Date(),
    });
    res.json({ message: decision === 'approved' ? 'Đã chấp thuận đề nghị.' : 'Đã từ chối đề nghị.', status: decision });
  } catch (error) {
    console.error('Respond Assist Request Error:', error.message);
    res.status(500).json({ message: 'Không thể cập nhật phản hồi.' });
  }
});

/**
 * @route   POST /api/grades/submit
 * @desc    Submit score for a team by a judge
 * @access  Private (Judges / Coords)
 */
router.post('/submit', authenticateToken, async (req, res) => {
  const { teamId, roundId, rubricId, overallComment, details } = req.body;

  if (!teamId || !roundId || !rubricId || !details || !Array.isArray(details)) {
    return res.status(400).json({ message: 'Missing required grading submission parameters.' });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    const rubric = await Rubric.findById(rubricId);
    if (!rubric) return res.status(404).json({ message: 'Rubric not found.' });
    if (!rubric.isLocked) {
      return res.status(400).json({ message: 'Rubric must be locked by the coordinator before scores can be input.' });
    }

    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });
    if (rubric.roundId.toString() !== round._id.toString()) {
      return res.status(400).json({ message: 'Rubric không thuộc vòng thi đang chấm.' });
    }
    if (round.status === 'completed') {
      return res.status(400).json({ message: 'Vòng đấu này đã bị khoá. Điểm số đã được chốt và không thể sửa đổi.' });
    }

    // Verify user is a Judge or Coordinator in this event
    let userRole = await EventRole.findOne({
      userId: req.user._id,
      eventId: team.eventId,
      roundId: roundId,
      role: { $in: ['judge', 'admin_view', 'student_assistant'] },
      status: 'active'
    });

    if (!userRole) {
      userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ['judge', 'admin_view', 'student_assistant'] },
        $or: [{ roundId: null }, { roundId: { $exists: false } }],
        status: 'active'
      });
    }

    if (!userRole && !req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Only assigned judges or coordinators can submit scores.' });
    }

    // Verify track assignment if user is a judge
    if (userRole && userRole.role === 'judge' && userRole.trackId) {
      if (!team.trackId || team.trackId.toString() !== userRole.trackId.toString()) {
        return res.status(403).json({ message: 'Bạn chỉ có quyền chấm điểm cho các đội thuộc bảng đấu được phân công.' });
      }
    }

    const repo = await GithubRepository.findOne({ teamId });
    // Score requires both (schema + unique index); fail with a clear message instead of a 500.
    if (!repo) {
      return res.status(400).json({ message: 'Đội thi chưa có GitHub repository nên chưa thể chấm điểm. Vui lòng liên hệ Ban tổ chức.' });
    }
    if (!team.trackId) {
      return res.status(400).json({ message: 'Đội thi chưa được phân vào bảng đấu nên chưa thể chấm điểm.' });
    }
    const snapshot = await RepositorySnapshot.findOne({ teamId, roundId });

    const existingScores = await Score.find({ teamId, roundId }).sort({ createdAt: 1 });
    let targetJudgeId = req.user._id;
    if (req.body.judgeId && (
      req.user.isSystemAdmin
      || (userRole && ['admin_view', 'student_assistant'].includes(userRole.role))
    )) {
      targetJudgeId = req.body.judgeId;
    }

    if (targetJudgeId.toString() !== req.user._id.toString()) {
      const assistAccess = await resolveAssistAccess({
        team,
        round,
        judgeId: targetJudgeId,
        coordinatorId: req.user._id,
      });
      if (!assistAccess.allowed) {
        return res.status(403).json({
          message: assistAccess.request?.status === 'pending'
            ? 'Đang chờ giám khảo chấp thuận đề nghị hỗ trợ chấm điểm.'
            : 'Bạn chưa được giám khảo cấp quyền hỗ trợ chấm điểm cho đội này.',
        });
      }
    }

    const policy = validateScoreSubmissionPolicy(existingScores, userRole?.role || 'judge', targetJudgeId);
    if (!policy.allowed) {
      await ScoreAudit.create({
        teamId,
        roundId,
        judgeId: targetJudgeId,
        actorId: req.user._id,
        actorRole: userRole?.role || 'judge',
        action: 'blocked_regrade',
        summary: policy.reason,
        reason: policy.reason,
      });
      return res.status(409).json({ message: policy.reason });
    }

    // Calculate score totals
    let totalRawScore = 0;
    let totalWeightedScore = 0;

    const criteriaList = await Criterion.find({ rubricId });
    const detailsToSave = [];
    const scoredCriterionIds = new Set();

    for (const d of details) {
      const { criterionId, comment } = d;
      // Coerce explicitly: a string "5" would otherwise be concatenated into the total,
      // and null/undefined would slip past the range check below.
      const scoreValue = typeof d.scoreValue === 'string' && d.scoreValue.trim() !== ''
        ? Number(d.scoreValue)
        : d.scoreValue;
      const criterion = criterionId && criteriaList.find(c => c._id.toString() === criterionId.toString());

      if (!criterion) {
        return res.status(400).json({ message: `Criterion ID ${criterionId} not found in rubric.` });
      }
      if (scoredCriterionIds.has(criterion._id.toString())) {
        return res.status(400).json({ message: `Tiêu chí "${criterion.name}" bị chấm trùng.` });
      }
      scoredCriterionIds.add(criterion._id.toString());

      if (typeof scoreValue !== 'number' || !Number.isFinite(scoreValue)) {
        return res.status(400).json({ message: `Điểm của tiêu chí "${criterion.name}" không hợp lệ.` });
      }

      if (scoreValue < 0 || scoreValue > criterion.maxScore) {
        return res.status(400).json({
          message: `Score value ${scoreValue} violates boundaries (0 to ${criterion.maxScore}) for ${criterion.name}.`
        });
      }

      // Math weighted score: scoreValue * (weight / totalRubricWeight)
      const wScore = scoreValue * (criterion.weight / rubric.totalWeight);

      totalRawScore += scoreValue;
      totalWeightedScore += wScore;

      detailsToSave.push({
        criterionId,
        scoreValue,
        weightedScore: Math.round(wScore * 100) / 100,
        comment
      });
    }

    // A partial sheet would rank the team on a smaller total than everyone else.
    const missingCriteria = criteriaList.filter(c => !scoredCriterionIds.has(c._id.toString()));
    if (missingCriteria.length > 0) {
      return res.status(400).json({
        message: `Chưa chấm đủ tiêu chí: ${missingCriteria.map(c => c.name).join(', ')}.`
      });
    }

    let previousScore = null;
    let score = await Score.findOne({ teamId, roundId, judgeId: targetJudgeId });
    if (score) {
      previousScore = {
        overallComment: score.overallComment,
        details: await ScoreDetail.find({ scoreId: score._id }).lean(),
      };
      if (score.status === 'locked' && !req.user.isSystemAdmin && !(userRole && userRole.role === 'student_assistant')) {
        return res.status(400).json({ message: 'Điểm số của bạn cho đội thi này trong vòng đấu này đã bị khoá.' });
      }
      score.totalRawScore = totalRawScore;
      score.totalWeightedScore = Math.round(totalWeightedScore * 100) / 100;
      score.overallComment = overallComment;
      score.status = 'submitted';
      score.submittedAt = new Date();
      await score.save();
    } else {
      score = new Score({
        teamId,
        repositoryId: repo ? repo._id : undefined,
        repositorySnapshotId: snapshot ? snapshot._id : undefined,
        eventId: team.eventId,
        trackId: team.trackId,
        roundId,
        rubricId,
        judgeId: targetJudgeId,
        totalRawScore,
        totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
        overallComment,
        status: 'submitted',
        submittedAt: new Date()
      });
      await score.save();
    }

    // Save details (re-create for clarity)
    await ScoreDetail.deleteMany({ scoreId: score._id });

    const preparedDetails = detailsToSave.map(d => ({
      scoreId: score._id,
      ...d
    }));
    await ScoreDetail.insertMany(preparedDetails);

    const auditAction = previousScore ? 'regrade_score' : 'submit_score';
    const changeDetails = buildScoreChangeSummary(previousScore, {
      overallComment,
      details: preparedDetails,
    }, criteriaList);

    await ScoreAudit.create({
      scoreId: score._id,
      teamId,
      roundId,
      judgeId: targetJudgeId,
      actorId: req.user._id,
      actorRole: userRole?.role || 'judge',
      action: auditAction,
      summary: previousScore ? 'Kết quả chấm điểm đã được điều chỉnh theo quy trình kiểm soát.' : 'Giám khảo đã chấm điểm cho đội thi.',
      changeDetails,
      before: previousScore,
      after: {
        overallComment,
        details: preparedDetails,
        totalRawScore,
        totalWeightedScore: score.totalWeightedScore,
      },
    });

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const scoreLog = new EventLog({
      eventId: team.eventId,
      actorId: req.user._id,
      action: 'submit_score',
      type: 'grading',
      details: `Giám khảo ${req.user.fullName} đã nộp điểm cho đội thi: "${team.name}" (Điểm thô: ${totalRawScore}, Điểm quy đổi: ${score.totalWeightedScore})`
    });
    await scoreLog.save();

    // Emit real-time score update via Socket.IO
    try {
      const socketModule = require('../chat/socket');
      const io = socketModule.getIO();
      io.to(`live:${team.eventId}`).emit('score_updated', {
        teamId: team._id.toString(),
        roundId: roundId.toString(),
        judgeId: targetJudgeId.toString(),
        totalRawScore,
        totalWeightedScore: score.totalWeightedScore,
        overallComment,
        details: preparedDetails
      });
    } catch (socketErr) {
      console.warn('Socket emit score_updated failed:', socketErr.message);
    }

    res.json({
      message: 'Scores submitted successfully!',
      scoreId: score._id,
      totalRawScore,
      totalWeightedScore: score.totalWeightedScore
    });

  } catch (error) {
    console.error('Submit Grade Error:', error.message);
    res.status(500).json({ message: 'Server error saving scores.' });
  }
});

/**
 * @route   POST /api/grades/lock-round
 * @desc    Finalize all scores and generate rankings
 * @access  Private (Coordinator or Admin)
 */
router.post('/lock-round', authenticateToken, async (req, res) => {
  const { eventId, roundId, trackId } = req.body;

  if (!eventId || !roundId) {
    return res.status(400).json({ message: 'Event ID and Round ID are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({ userId: req.user._id, eventId, role: 'student_assistant' });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    // 1. Get all tracks in this round
    const tracks = await Track.find({ roundId });
    const trackIds = tracks.map(t => t._id);

    // 2. Get all confirmed teams in these tracks
    const teams = await Team.find({ eventId, trackId: { $in: trackIds }, status: 'confirmed' });
    if (teams.length === 0) {
      return res.status(400).json({ message: 'No confirmed teams found in this round.' });
    }

    // 3. Fetch all scores submitted for this round
    const scores = await Score.find({ roundId, status: { $in: ['submitted', 'locked'] } });

    // 4. For each team, calculate average weighted score
    const rankingsData = [];
    for (const team of teams) {
      const teamScores = scores.filter(s => s.teamId.toString() === team._id.toString());
      const judgeCount = teamScores.length;

      let averageScore = 0;
      if (judgeCount > 0) {
        const sum = teamScores.reduce((acc, s) => acc + s.totalWeightedScore, 0);
        averageScore = Math.round((sum / judgeCount) * 100) / 100;
      }

      rankingsData.push({
        teamId: team._id,
        trackId: team.trackId,
        averageScore,
        judgeCount
      });
    }

    // 5. Group by trackId and sort within each track to calculate trackRank
    const tracksMap = {};
    rankingsData.forEach(item => {
      if (item.trackId) {
        const tId = item.trackId.toString();
        if (!tracksMap[tId]) {
          tracksMap[tId] = [];
        }
        tracksMap[tId].push(item);
      }
    });

    for (const tId in tracksMap) {
      const trackTeams = tracksMap[tId];
      trackTeams.sort((a, b) => b.averageScore - a.averageScore);
      trackTeams.forEach((item, idx) => {
        item.trackRank = idx + 1;
      });
    }

    // 6. Sort overall by trackRank ascending, then averageScore descending
    rankingsData.sort((a, b) => {
      const aTrackRank = a.trackRank || 999;
      const bTrackRank = b.trackRank || 999;
      if (aTrackRank !== bTrackRank) {
        return aTrackRank - bTrackRank;
      }
      return b.averageScore - a.averageScore;
    });

    // Get event/round details and build tracksCache
    const round = await Round.findById(roundId);
    const tracksCache = {};
    for (const t of tracks) {
      tracksCache[t._id.toString()] = t;
    }

    // Save rankings
    await Ranking.deleteMany({ roundId });

    const rankingsToSave = [];
    for (let idx = 0; idx < rankingsData.length; idx++) {
      const item = rankingsData[idx];
      const rank = idx + 1;
      const track = tracksCache[item.trackId.toString()];
      const trackLimit = (track && typeof track.advanceTopN === 'number') ? track.advanceTopN : 999;
      const isAdvanced = (item.trackRank || 999) <= trackLimit;

      const rankingRecord = new Ranking({
        eventId,
        trackId: item.trackId,
        roundId,
        teamId: item.teamId,
        averageScore: item.averageScore,
        finalScore: item.averageScore, // custom edits can adjust later
        judgeCount: item.judgeCount,
        rank,
        isAdvanced,
        status: 'published',
        calculatedAt: new Date(),
        publishedAt: new Date()
      });
      rankingsToSave.push(rankingRecord);

      // Lock all scores for this round
      await Score.updateMany({ roundId, teamId: item.teamId }, { status: 'locked', lockedAt: new Date() });
    }

    await Ranking.insertMany(rankingsToSave);

    // Update Round status to completed
    round.status = 'completed';
    await round.save();

    // ----------------------------------------------------
    // TỰ ĐỘNG GÁN GIẢI THƯỞNG CHO VÒNG CHUNG KẾT (Pha 2)
    // ----------------------------------------------------
    try {
      const allRounds = await Round.find({ eventId });
      const maxOrder = Math.max(...allRounds.map(r => r.order || 0));
      if (round.order === maxOrder) {
        const Prize = mongoose.model('Prize');
        const Event = mongoose.model('Event');
        
        // Safety Check: Xóa giải thưởng cũ của vòng thi này để tránh trùng lặp
        await Prize.deleteMany({ eventId, roundId });
        
        const event = await Event.findById(eventId);
        if (event) {
          const defaultPrizes = [
            { title: '01 GIẢI NHẤT', amount: '7.000.000 đồng', benefits: 'Giấy chứng nhận + hoa' },
            { title: '01 GIẢI NHÌ', amount: '5.000.000 đồng', benefits: 'Giấy chứng nhận + hoa' },
            { title: '01 GIẢI BA', amount: '3.000.000 đồng', benefits: 'Giấy chứng nhận + hoa' },
            { title: '01 GIẢI KHUYẾN KHÍCH', amount: '1.500.000 đồng', benefits: 'Giấy chứng nhận' }
          ];
          const eventPrizes = event.prizes && event.prizes.length > 0 ? event.prizes : defaultPrizes;
          
          // Lấy top các đội xếp hạng cao nhất
          const savedRankings = await Ranking.find({ roundId }).sort({ rank: 1 }).limit(eventPrizes.length);
          
          const prizesToSave = [];
          savedRankings.forEach(ranking => {
            const prizeConfig = eventPrizes[ranking.rank - 1];
            if (prizeConfig) {
              prizesToSave.push({
                eventId,
                trackId: ranking.trackId,
                roundId,
                teamId: ranking.teamId,
                rank: ranking.rank,
                title: prizeConfig.title,
                value: prizeConfig.amount,
                description: prizeConfig.benefits,
                announcedAt: new Date(),
                disbursementStatus: 'pending'
              });
            }
          });
          
          if (prizesToSave.length > 0) {
            await Prize.insertMany(prizesToSave);
          }
        }
      }
    } catch (prizeErr) {
      console.error('Error auto-assigning prizes:', prizeErr.message);
    }
    // ----------------------------------------------------

    // Gửi thông báo in-app tới toàn bộ thành viên trong bảng đấu
    const TeamMember = mongoose.model('TeamMember');

    for (const team of teams) {
      const members = await TeamMember.find({ teamId: team._id, confirmStatus: 'confirmed' });
      for (const member of members) {
        if (isQueueAvailable()) {
          await addInAppJob({
            userId: member.userId.toString(),
            type: 'round_result',
            title: `Kết quả vòng "${round.name}" đã công bố`,
            body: `Vòng "${round.name}" đã hoàn tất chấm điểm và công bố kết quả. Hãy kiểm tra bảng xếp hạng ngay!`,
            metadata: { roundId: round._id, roundName: round.name, eventId, trackId },
          });
        } else {
          // Fallback: synchronous
          const Notification = mongoose.model('Notification');
          await new Notification({
            userId: member.userId,
            type: 'round_result',
            title: `Kết quả vòng "${round.name}" đã công bố`,
            body: `Vòng "${round.name}" đã hoàn tất chấm điểm và công bố kết quả. Hãy kiểm tra bảng xếp hạng ngay!`,
            channel: 'in_app',
            status: 'sent',
            metadata: { roundId: round._id, roundName: round.name, eventId, trackId },
          }).save();
        }
      }
    }

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'publish_results',
      type: 'grading',
      details: `Khóa điểm và công bố xếp hạng vòng thi: ${round.name}`
    });
    await newLog.save();

    res.json({
      message: 'Round scores finalized, locked, and team rankings generated successfully!',
      rankings: rankingsToSave
    });

  } catch (error) {
    console.error('Lock Round Grades Error:', error.message);
    res.status(500).json({ message: 'Server error locking round grades.' });
  }
});

/**
 * @route   POST /api/grades/unlock-round
 * @desc    Unlock all scores for a round to allow editing again
 * @access  Private (Coordinator or Admin)
 */
router.post('/unlock-round', authenticateToken, async (req, res) => {
  const { eventId, roundId } = req.body;

  if (!eventId || !roundId) {
    return res.status(400).json({ message: 'Event ID and Round ID are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({ userId: req.user._id, eventId, role: 'student_assistant' });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    const round = await Round.findById(roundId);
    if (!round) {
      return res.status(404).json({ message: 'Round not found.' });
    }

    // Safety check: is there a next round that is active or completed?
    const nextRound = await Round.findOne({ eventId, order: { $gt: round.order } }).sort({ order: 1 });
    if (nextRound && (nextRound.status === 'active' || nextRound.status === 'completed')) {
      return res.status(400).json({
        message: `Không thể mở khóa vòng "${round.name}" vì vòng thi tiếp theo "${nextRound.name}" đã được bắt đầu hoặc hoàn thành. Bạn cần thu hồi vòng thi tiếp theo trước.`
      });
    }

    // 1. Delete generated rankings and prizes for this round
    await Ranking.deleteMany({ roundId });
    const Prize = mongoose.model('Prize');
    await Prize.deleteMany({ eventId, roundId });

    // 2. Unlock all scores (set status back to 'submitted')
    await Score.updateMany({ roundId }, { status: 'submitted', $unset: { lockedAt: 1 } });

    // 3. Set round status back to 'active'
    round.status = 'active';
    await round.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'unlock_results',
      type: 'grading',
      details: `Mở khóa điểm và thu hồi xếp hạng vòng thi: ${round.name}`
    });
    await newLog.save();

    res.json({
      message: 'Mở khóa điểm vòng thi thành công. Giám khảo bây giờ có thể tiếp tục chấm điểm và chỉnh sửa.',
      round
    });

  } catch (error) {
    console.error('Unlock Round Grades Error:', error.message);
    res.status(500).json({ message: 'Server error unlocking round grades.' });
  }
});

/**
 * @route   GET /api/grades/leaderboard/:roundId
 * @desc    Get team rankings leaderboard for a round
 * @access  Private
 *   - Coordinator / SystemAdmin: luôn xem được khi đã có ranking (sau lock)
 *   - Các role khác (judge, participant): chỉ xem khi round status = 'completed'
 */
router.get('/leaderboard/:roundId', authenticateToken, async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });

    // Check if the requester is coordinator or system admin
    let isCoordinator = req.user.isSystemAdmin;
    if (!isCoordinator) {
      const coordRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: { $in: ['admin_view', 'student_assistant'] },
        status: 'active'
      });
      isCoordinator = !!coordRole;
    }

    // Non-coordinator: block if round is not completed yet
    if (!isCoordinator && round.status !== 'completed') {
      return res.json({
        locked: true,
        message: 'Bảng xếp hạng sẽ được công bố sau khi điều phối viên chốt điểm và khóa vòng thi.',
        standings: []
      });
    }

    const leaderboard = await Ranking.find({ roundId: req.params.roundId })
      .sort({ rank: 1 })
      .populate({
        path: 'teamId',
        select: 'name status topicSubmission originalTrackId',
        populate: { path: 'originalTrackId', select: 'name topicName topicLink description' }
      })
      .populate('trackId', 'name');

    res.json({ locked: false, isCoordinator, standings: leaderboard });
  } catch (error) {
    console.error('Fetch Leaderboard Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving leaderboard.' });
  }
});

/**
 * @route   GET /api/grades/live-ranking/:roundId
 * @desc    Real-time ranking calculated from submitted scores (no lock required)
 * @access  Private (Coordinator / SystemAdmin only)
 */
router.get('/live-ranking/:roundId', authenticateToken, async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });

    // Auth: only coordinator or system admin
    let isCoordinator = req.user.isSystemAdmin;
    if (!isCoordinator) {
      const coordRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: { $in: ['admin_view', 'student_assistant'] },
        status: 'active'
      });
      isCoordinator = !!coordRole;
    }

    if (!isCoordinator) {
      return res.status(403).json({ message: 'Chỉ Điều phối viên mới có thể xem bảng xếp hạng thời gian thực.' });
    }

    // 1. Get all tracks in this round
    const tracks = await Track.find({ roundId: req.params.roundId });
    const trackIds = tracks.map(t => t._id);

    // 2. Get all confirmed teams in these tracks
    const teams = await Team.find({ eventId: round.eventId, trackId: { $in: trackIds }, status: 'confirmed' })
      .populate('topicSubmission')
      .populate('trackId', 'name');

    // Get all submitted/locked scores for this round
    const scores = await Score.find({
      roundId: req.params.roundId,
      status: { $in: ['submitted', 'locked'] }
    }).populate('judgeId', 'fullName email');

    // Calculate live average per team
    const rankingData = teams.map((team) => {
      const teamScores = scores.filter(s => s.teamId.toString() === team._id.toString());
      const judgeCount = teamScores.length;
      let averageScore = 0;
      if (judgeCount > 0) {
        const sum = teamScores.reduce((acc, s) => acc + s.totalWeightedScore, 0);
        averageScore = Math.round((sum / judgeCount) * 100) / 100;
      }
      return {
        teamId: { _id: team._id, name: team.name, topicSubmission: team.topicSubmission },
        trackId: team.trackId,
        averageScore,
        judgeCount,
        judges: teamScores.map(s => ({
          _id: s.judgeId?._id,
          fullName: s.judgeId?.fullName,
          score: s.totalWeightedScore
        })),
        isLive: true
      };
    });

    // Group by trackId and sort within each track to calculate trackRank
    const tracksMap = {};
    rankingData.forEach(item => {
      if (item.trackId) {
        const tId = item.trackId.toString();
        if (!tracksMap[tId]) {
          tracksMap[tId] = [];
        }
        tracksMap[tId].push(item);
      }
    });

    for (const tId in tracksMap) {
      const trackTeams = tracksMap[tId];
      trackTeams.sort((a, b) => b.averageScore - a.averageScore);
      trackTeams.forEach((item, idx) => {
        item.trackRank = idx + 1;
      });
    }

    // Sort overall by trackRank ascending, then averageScore descending
    rankingData.sort((a, b) => {
      const aTrackRank = a.trackRank || 999;
      const bTrackRank = b.trackRank || 999;
      if (aTrackRank !== bTrackRank) {
        return aTrackRank - bTrackRank;
      }
      return b.averageScore - a.averageScore;
    });

    const tracksCache = {};
    for (const t of tracks) {
      tracksCache[t._id.toString()] = t;
    }
    rankingData.forEach((item, idx) => {
      item.rank = idx + 1;
      const track = tracksCache[item.trackId.toString()];
      const trackLimit = (track && typeof track.advanceTopN === 'number') ? track.advanceTopN : 999;
      item.isAdvanced = (item.trackRank || 999) <= trackLimit;
    });

    res.json({ isLive: true, roundStatus: round.status, standings: rankingData });
  } catch (error) {
    console.error('Live Ranking Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving live ranking.' });
  }
});

/**
 * @route   GET /api/grades/judge-ranking/:roundId
 * @desc    Real-time ranking for judges (no individual judge score breakdown, but live average)
 * @access  Private (Judge / Coordinator / SystemAdmin)
 */
router.get('/judge-ranking/:roundId', authenticateToken, async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });

    // Verify user is a judge (or coordinator/admin) for this event
    let hasAccess = req.user.isSystemAdmin;
    let assignedTrackId = null;
    if (!hasAccess) {
      const roleRecord = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: { $in: ['judge', 'student_assistant'] },
        status: 'active'
      });
      hasAccess = !!roleRecord;
      if (roleRecord && roleRecord.role === 'judge') {
        assignedTrackId = roleRecord.trackId;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Bạn không có quyền xem bảng xếp hạng này.' });
    }

    // Get all teams in this round's track
    let teamsQuery = { eventId: round.eventId, status: 'confirmed' };
    if (assignedTrackId) {
      teamsQuery.trackId = assignedTrackId;
    } else {
      // Coordinator or SystemAdmin: get all tracks for this round
      const tracksObj = await Track.find({ roundId: round._id });
      const trackIds = tracksObj.map(t => t._id);
      teamsQuery.trackId = { $in: trackIds };
    }
    const teams = await Team.find(teamsQuery).populate('topicSubmission');

    // Get all submitted/locked scores for this round
    const scores = await Score.find({
      roundId: req.params.roundId,
      status: { $in: ['submitted', 'locked'] }
    });

    // Calculate live average per team (excluding detailed judge breakdown for judges' view)
    const rankingData = teams.map((team) => {
      const teamScores = scores.filter(s => s.teamId.toString() === team._id.toString());
      const judgeCount = teamScores.length;
      let averageScore = 0;
      if (judgeCount > 0) {
        const sum = teamScores.reduce((acc, s) => acc + s.totalWeightedScore, 0);
        averageScore = Math.round((sum / judgeCount) * 100) / 100;
      }
      return {
        teamId: { _id: team._id, name: team.name, topicSubmission: team.topicSubmission },
        trackId: team.trackId,
        averageScore,
        judgeCount,
        isLive: true
      };
    });

    // Load tracks configurations of this round to get advanceTopN
    const tracks = await Track.find({ roundId: req.params.roundId });
    const tracksCache = {};
    for (const t of tracks) {
      tracksCache[t._id.toString()] = t;
    }

    // Group by trackId and sort within each track to calculate trackRank
    const tracksMap = {};
    rankingData.forEach(item => {
      if (item.trackId) {
        const tId = item.trackId.toString();
        if (!tracksMap[tId]) {
          tracksMap[tId] = [];
        }
        tracksMap[tId].push(item);
      }
    });

    for (const tId in tracksMap) {
      const trackTeams = tracksMap[tId];
      trackTeams.sort((a, b) => b.averageScore - a.averageScore);
      trackTeams.forEach((item, idx) => {
        item.trackRank = idx + 1;
      });
    }

    // Sort overall by trackRank ascending, then averageScore descending
    rankingData.sort((a, b) => {
      const aTrackRank = a.trackRank || 999;
      const bTrackRank = b.trackRank || 999;
      if (aTrackRank !== bTrackRank) {
        return aTrackRank - bTrackRank;
      }
      return b.averageScore - a.averageScore;
    });

    rankingData.forEach((item, idx) => {
      item.rank = idx + 1;
      const track = tracksCache[item.trackId ? item.trackId.toString() : ''];
      const trackLimit = (track && typeof track.advanceTopN === 'number') ? track.advanceTopN : 999;
      item.isAdvanced = (item.trackRank || 999) <= trackLimit;
    });

    res.json({ isLive: true, roundStatus: round.status, standings: rankingData });
  } catch (error) {
    console.error('Judge Ranking Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving judge ranking.' });
  }
});

/**
 * @route   POST /api/grades/advance-round
 * @desc    Finalize the current round and advance qualified teams (isAdvanced: true) to the next round
 * @access  Private (Coordinator or Admin)
 */
router.post('/advance-round', authenticateToken, async (req, res) => {
  const { eventId, currentRoundId } = req.body;

  if (!eventId || !currentRoundId) {
    return res.status(400).json({ message: 'Event ID and Current Round ID are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({ userId: req.user._id, eventId, role: 'student_assistant' });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    const currentRound = await Round.findById(currentRoundId);
    if (!currentRound) return res.status(404).json({ message: 'Current round not found.' });

    // 1. Verify if all tracks in the current round are locked (only checking tracks with registered teams)
    const tracks = await Track.find({ roundId: currentRoundId });
    if (tracks.length === 0) {
      return res.status(400).json({ message: 'No tracks found in the current round.' });
    }

    const Team = mongoose.model('Team');
    const trackIds = tracks.map(t => t._id);
    for (const trackId of trackIds) {
      const trackHasTeams = await Team.exists({ eventId, trackId });
      if (trackHasTeams) {
        const rankingsExist = await Ranking.exists({ roundId: currentRoundId, trackId });
        if (!rankingsExist) {
          const track = tracks.find(t => t._id.toString() === trackId.toString());
          return res.status(400).json({
            message: `Bảng đấu "${track ? track.name : trackId}" chưa được khóa điểm. Vui lòng khóa điểm và công bố tất cả bảng đấu trước khi chốt vòng.`
          });
        }
      }
    }

    // 2. Find the next round in order
    const nextRound = await Round.findOne({ eventId, order: currentRound.order + 1 });

    // 3. Get all advanced teams in the current round
    const advancedRankings = await Ranking.find({ roundId: currentRoundId, isAdvanced: true });
    const advancedTeamIds = advancedRankings.map(r => r.teamId);

    if (advancedTeamIds.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy đội nào được thăng hạng (isAdvanced) trong vòng hiện tại.' });
    }

    const Event = mongoose.model('Event');

    if (nextRound) {
      // Find or create a consolidated track for the next round (e.g. "Chung kết")
      let nextRoundTrack = await Track.findOne({ roundId: nextRound._id });
      if (!nextRoundTrack) {
        nextRoundTrack = new Track({
          eventId,
          roundId: nextRound._id,
          name: nextRound.name === 'Chung kết' || nextRound.name.includes('Chung') ? 'Bảng Chung Kết' : `Bảng Đấu ${nextRound.name}`,
          description: `Bảng đấu tập trung dành cho các đội xuất sắc nhất vượt qua ${currentRound.name}`,
          maxTeams: advancedTeamIds.length,
          topicSubmissionOpen: true
        });
        await nextRoundTrack.save();
      }

      // Promote teams to next round and assign to the consolidated track while preserving originalTrackId
      const teamsToPromote = await Team.find({ _id: { $in: advancedTeamIds } });
      for (const t of teamsToPromote) {
        if (!t.originalTrackId && t.trackId) {
          t.originalTrackId = t.trackId;
        }
        t.currentRoundId = nextRound._id;
        t.trackId = nextRoundTrack._id;
        await t.save();
      }

      // Transition round statuses
      currentRound.status = 'completed';
      await currentRound.save();

      nextRound.status = 'pending';
      await nextRound.save();

      return res.json({
        message: `Đã chốt thành công vòng đấu "${currentRound.name}". Cả ${advancedTeamIds.length} đội xuất sắc đã được thăng hạng tiến vào "${nextRound.name}" thuộc "${nextRoundTrack.name}".`,
        nextRoundId: nextRound._id,
        nextTrackId: nextRoundTrack._id,
        advancedTeamsCount: advancedTeamIds.length
      });
    } else {
      // No next round - this is the final round!
      currentRound.status = 'completed';
      await currentRound.save();

      // Update Event status to completed
      const eventObj = await Event.findById(eventId);
      if (eventObj) {
        eventObj.status = 'completed';
        await eventObj.save();
      }

      res.json({
        message: `Đã chốt thành công Vòng Chung Kết "${currentRound.name}". Sự kiện đã kết thúc và toàn bộ kết quả xếp hạng chung cuộc đã được công bố!`,
        isEventCompleted: true,
        advancedTeamsCount: advancedTeamIds.length
      });
    }

  } catch (error) {
    console.error('Advance Round Error:', error.message);
    res.status(500).json({ message: 'Server error during round advancement.' });
  }
});

/**
 * @route   POST /api/grades/rollback-round
 * @desc    Rollback round promotion and return to previous round
 * @access  Private (System Admin or Coordinator)
 */
router.post('/rollback-round', authenticateToken, async (req, res) => {
  const { eventId, currentRoundId } = req.body;

  if (!eventId || !currentRoundId) {
    return res.status(400).json({ message: 'Event ID and Current Round ID are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({ userId: req.user._id, eventId, role: 'student_assistant', status: 'active' });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    const currentRound = await Round.findById(currentRoundId);
    if (!currentRound) return res.status(404).json({ message: 'Current round not found.' });

    // Find the previous round in order
    const previousRound = await Round.findOne({ eventId, order: currentRound.order - 1 });
    if (!previousRound) {
      return res.status(400).json({ message: 'Không tìm thấy vòng thi trước đó để thu hồi.' });
    }

    const Team = mongoose.model('Team');
    const Ranking = mongoose.model('Ranking');

    // Get all rankings in the previous round that were advanced
    const advancedRankings = await Ranking.find({ roundId: previousRound._id, isAdvanced: true });
    if (advancedRankings.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy dữ liệu thăng hạng ở vòng trước để thu hồi.' });
    }

    // Move each team back to their previous track in the previous round
    for (const ranking of advancedRankings) {
      await Team.findByIdAndUpdate(ranking.teamId, {
        currentRoundId: previousRound._id,
        trackId: ranking.trackId
      });
    }

    // Reset statuses
    currentRound.status = 'pending';
    currentRound.isExamManualOpen = false;
    await currentRound.save();

    previousRound.status = 'active';
    await previousRound.save();

    // Clean up empty tracks under the current round
    const Track = mongoose.model('Track');
    const currentRoundTracks = await Track.find({ roundId: currentRoundId });
    for (const track of currentRoundTracks) {
      const teamCount = await Team.countDocuments({ trackId: track._id });
      if (teamCount === 0) {
        await Track.findByIdAndDelete(track._id);
      }
    }

    // Also revert Event status back to ongoing if it was set to completed (e.g. final round rolled back)
    const Event = mongoose.model('Event');
    const eventObj = await Event.findById(eventId);
    if (eventObj && eventObj.status === 'completed') {
      eventObj.status = 'ongoing';
      await eventObj.save();
    }

    return res.json({
      message: `Đã thu hồi thành công vòng đấu. Trạng thái vòng "${previousRound.name}" đã được chuyển về "active" và đưa các đội quay về vòng trước.`,
      previousRoundId: previousRound._id
    });
  } catch (error) {
    console.error('Rollback Round Error:', error);
    return res.status(500).json({ message: 'Lỗi hệ thống khi thu hồi vòng đấu.' });
  }
});

/**
 * @route   GET /api/grades/export-grading-sheet/:roundId
 * @desc    Export scoring excel sheet for a judge or summary for coordinator
 * @access  Private (Coordinator/Admin/Judge)
 */
router.get('/export-grading-sheet/:roundId', authenticateToken, async (req, res) => {
  try {
    const { roundId } = req.params;
    const { trackId, judgeId } = req.query;

    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });

    const Event = mongoose.model('Event');
    const event = await Event.findById(round.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // 1. Determine Judge and Track
    let targetJudgeId = judgeId;
    if (!targetJudgeId) {
      const roleRecord = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: 'judge',
        status: 'active'
      });
      if (roleRecord) {
        if (!req.user.isSystemAdmin) {
          targetJudgeId = req.user._id.toString();
        }
      }
    }

    let track = null;
    if (trackId) {
      track = await Track.findById(trackId);
    } else if (targetJudgeId) {
      const judgeRole = await EventRole.findOne({
        userId: targetJudgeId,
        eventId: round.eventId,
        role: 'judge',
        status: 'active'
      });
      if (judgeRole && judgeRole.trackId) {
        track = await Track.findById(judgeRole.trackId);
      }
    }

    // 2. Rubric that applies to this track (track-specific, else round-wide) and its criteria
    const rubric = await findActiveRubric(round._id, track?._id);
    if (!rubric) {
      return res.status(400).json({ message: 'Vòng thi này chưa được cấu hình Rubric chấm điểm.' });
    }
    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });

    // 3. Get Teams
    const teamsQuery = { eventId: round.eventId, status: 'confirmed' };
    if (track) {
      teamsQuery.trackId = track._id;
    }
    const teams = await Team.find(teamsQuery).populate('topicSubmission');

    const wb = XLSX.utils.book_new();
    let wsData = [];
    let title = '';
    let subtitle = '';
    let metadataRow = '';
    let headerRowCount = 1;
    let extraMerges = [];
    let totalDataRows = 0;

    // Check if we are exporting for a specific judge or summary
    if (targetJudgeId) {
      // --- CASE 1: INDIVIDUAL JUDGE SCORING SHEET ---
      const judge = await User.findById(targetJudgeId);
      if (!judge) return res.status(404).json({ message: 'Judge not found.' });

      title = `PHIẾU CHẤM ĐIỂM CHI TIẾT - GIÁM KHẢO`;
      subtitle = event.name.toUpperCase();
      metadataRow = `Vòng thi: ${round.name} | Bảng đấu: ${track ? track.name : 'Tất cả'} | Giám khảo: ${judge.fullName}`;

      // Build table headers
      // Build table headers
      // STT | Tên Đội | Criteria 1 | ... | Criteria N | Tổng Điểm | Nhận Xét
      const headers = ["STT", "Tên Đội Thi"];
      criteria.forEach(c => {
        const weightPercent = c.weight > 1 ? c.weight : c.weight * 100;
        headers.push(`${c.code}\n(${weightPercent}%)`);
      });
      headers.push("Tổng Điểm\n", "Ý Kiến / Nhận Xét");

      wsData.push([title], [subtitle], [metadataRow], [], headers);

      // Fetch judge's scores
      const scores = await Score.find({
        roundId: round._id,
        judgeId: judge._id,
        teamId: { $in: teams.map(t => t._id) }
      });
      const scoreIds = scores.map(s => s._id);
      const scoreDetails = await ScoreDetail.find({ scoreId: { $in: scoreIds } });

      teams.forEach((team, idx) => {
        const row = [
          idx + 1,
          team.name
        ];

        const teamScore = scores.find(s => s.teamId.toString() === team._id.toString());

        criteria.forEach(c => {
          if (teamScore) {
            const detail = scoreDetails.find(d =>
              d.scoreId.toString() === teamScore._id.toString() &&
              d.criterionId.toString() === c._id.toString()
            );
            row.push(detail ? detail.scoreValue : 0);
          } else {
            row.push(0); // Not graded yet
          }
        });

        row.push(teamScore ? teamScore.totalWeightedScore : 0);
        row.push(teamScore ? (teamScore.overallComment || '') : '');
        wsData.push(row);
      });

      totalDataRows = teams.length;

      // Signature section
      const signRowStart = wsData.length + 2;
      wsData.push([]); // blank row
      wsData.push([]); // blank row

      // We will place signatures on columns: Column B (index 1) and Column G/H (index 2+N)
      const sigRow = [];
      sigRow[1] = "TRƯỞNG BAN TỔ CHỨC";
      sigRow[2 + criteria.length] = "GIÁM KHẢO XÁC NHẬN";
      wsData.push(sigRow);

      const subSigRow = [];
      subSigRow[1] = "(Ký và ghi rõ họ tên)";
      subSigRow[2 + criteria.length] = "(Ký và ghi rõ họ tên)";
      wsData.push(subSigRow);

      // Add 4 empty rows for space to sign
      wsData.push([], [], [], []);

      const nameSigRow = [];
      nameSigRow[1] = ".......................................";
      nameSigRow[2 + criteria.length] = judge.fullName;
      wsData.push(nameSigRow);

    } else {
      // --- CASE 2: SUMMARY GRADING SHEET (ALL JUDGES) ---
      title = `BẢNG TỔNG HỢP ĐIỂM ĐÁNH GIÁ`;
      subtitle = event.name.toUpperCase();
      metadataRow = `Vòng thi: ${round.name} | Bảng đấu: ${track ? track.name : 'Tất cả'}`;

      // Get all scores for this round and these teams
      const scores = await Score.find({
        roundId: round._id,
        teamId: { $in: teams.map(t => t._id) },
        status: { $in: ['submitted', 'locked'] }
      }).populate('judgeId', 'fullName email');

      // Fetch all score details for these scores to compute criteria averages
      const scoreIds = scores.map(s => s._id);
      const scoreDetails = await ScoreDetail.find({ scoreId: { $in: scoreIds } });

      // Unique judges who graded
      const uniqueJudgesMap = {};
      scores.forEach(s => {
        if (s.judgeId) {
          uniqueJudgesMap[s.judgeId._id.toString()] = s.judgeId;
        }
      });
      const judges = Object.values(uniqueJudgesMap);

      // Table Headers (single row, vertical layout):
      // STT | Tên Đội Thi | Giám Khảo | C1 (w%) | ... | CN (w%) | Tổng Điểm | Điểm TB | Thứ Hạng
      const headers = ["STT", "Tên Đội Thi", "Giám Khảo"];
      criteria.forEach(c => {
        const weightPercent = c.weight > 1 ? c.weight : c.weight * 100;
        headers.push(`${c.code}\n(${weightPercent}%)`);
      });
      headers.push("Tổng Điểm", "Điểm Trung Bình", "Thứ Hạng");
      wsData.push([title], [subtitle], [metadataRow], [], headers);

      // Build row data for each team (vertical: each judge = one row)
      const teamDataForSort = teams.map((team) => {
        const teamScores = scores.filter(s => s.teamId.toString() === team._id.toString());
        const judgeCount = teamScores.length;

        let averageScore = 0;
        if (judgeCount > 0) {
          const sum = teamScores.reduce((acc, s) => acc + s.totalWeightedScore, 0);
          averageScore = Math.round((sum / judgeCount) * 100) / 100;
        }

        return { team, teamScores, averageScore };
      });

      // Sort by averageScore descending to calculate rankings
      teamDataForSort.sort((a, b) => b.averageScore - a.averageScore);

      // Track data row start for merge calculations
      const dataRowStart = wsData.length; // row index where data begins (should be 5)
      let currentRow = dataRowStart;

      teamDataForSort.forEach((item, idx) => {
        const { team, teamScores, averageScore } = item;
        const judgeCount = judges.length;
        const rowsForTeam = judgeCount + 1; // N judge rows + 1 summary row

        // Judge rows: one row per judge
        judges.forEach(j => {
          const ts = teamScores.find(s => s.judgeId._id.toString() === j._id.toString());
          const row = ['', '', j.fullName];
          criteria.forEach(c => {
            if (!ts) { row.push('-'); return; }
            const detail = scoreDetails.find(d =>
              d.scoreId.toString() === ts._id.toString() &&
              d.criterionId.toString() === c._id.toString()
            );
            row.push(detail ? detail.scoreValue : '-');
          });
          row.push(ts ? ts.totalWeightedScore : '-'); // Tổng Điểm
          row.push(''); // Điểm TB (empty for judge rows)
          row.push(''); // Thứ Hạng (empty for judge rows)
          wsData.push(row);
        });

        // Summary row for this team
        const summaryRow = ['', '', ''];
        // Empty criteria cells for summary row
        criteria.forEach(() => summaryRow.push(''));
        summaryRow.push(''); // Tổng Điểm (empty)
        summaryRow.push(averageScore); // Điểm TB
        summaryRow.push(idx + 1); // Thứ Hạng
        wsData.push(summaryRow);

        // Set STT and Team Name in the first row of this team block
        const firstRowIdx = currentRow;
        wsData[firstRowIdx][0] = idx + 1; // STT
        wsData[firstRowIdx][1] = team.name; // Tên Đội

        // Merge STT, Tên Đội vertically across all rows for this team
        if (rowsForTeam > 1) {
          extraMerges.push({ s: { r: firstRowIdx, c: 0 }, e: { r: firstRowIdx + rowsForTeam - 1, c: 0 } });
          extraMerges.push({ s: { r: firstRowIdx, c: 1 }, e: { r: firstRowIdx + rowsForTeam - 1, c: 1 } });
        }

        currentRow += rowsForTeam;
      });

      totalDataRows = currentRow - dataRowStart;

      // Signature section
      wsData.push([]); // blank row
      wsData.push([]); // blank row

      const maxColCount = headers.length;
      const sigColRight = Math.min(Math.floor(maxColCount / 2) + 1, maxColCount - 1);
      const sigRow = [];
      sigRow[1] = "GIÁM KHẢO";
      sigRow[sigColRight] = "TRƯỞNG BAN TỔ CHỨC";
      wsData.push(sigRow);

      const subSigRow = [];
      subSigRow[1] = "(Ký và ghi rõ họ tên)";
      subSigRow[sigColRight] = "(Ký và ghi rõ họ tên)";
      wsData.push(subSigRow);

      // Add 4 empty rows for space to sign
      wsData.push([], [], [], []);

      const nameSigRow = [];
      nameSigRow[1] = ".......................................";
      nameSigRow[sigColRight] = ".......................................";
      nameSigRow[sigColRight] = ".......................................";
      wsData.push(nameSigRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge title cells
    const maxCols = Math.max(...wsData.map(r => r.length || 0), 7);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: maxCols - 1 } },
      ...extraMerges
    ];

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 28 }  // Tên Đội Thi
    ];
    for (let c = 2; c < maxCols; c++) {
      ws['!cols'].push({ wch: 18 });
    }
    if (targetJudgeId) {
      // Make comment/remark column wider for individual judge sheets
      ws['!cols'][maxCols - 1] = { wch: 40 };
    }

    // Apply beautiful styling
    const range = XLSX.utils.decode_range(ws['!ref']);
    const numDataRows = totalDataRows || teams.length;
    const headerRowIdx = 4;
    const dataStartRowIdx = headerRowIdx + headerRowCount;
    const dataEndRowIdx = dataStartRowIdx + numDataRows - 1;

    for (let r = range.s.r; r <= range.e.r; ++r) {
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;

        const cell = ws[cellRef];
        cell.s = cell.s || {};

        if (r === 0) {
          // Title
          cell.s.font = { bold: true, size: 14, name: 'Calibri', color: { rgb: '0F172A' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === 1) {
          // Subtitle
          cell.s.font = { bold: true, size: 11, name: 'Calibri', color: { rgb: '475569' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === 2) {
          // Metadata
          cell.s.font = { italic: true, size: 10, name: 'Calibri', color: { rgb: '475569' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r >= headerRowIdx && r < dataStartRowIdx) {
          // Table Header
          cell.s.font = { bold: true, name: 'Calibri', color: { rgb: 'FFFFFF' }, size: 10 };
          cell.s.fill = { patternType: 'solid', fgColor: { rgb: '1E293B' } }; // Dark blue slate
          cell.s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          cell.s.border = {
            top: { style: 'medium', color: { rgb: '475569' } },
            bottom: { style: 'medium', color: { rgb: '475569' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
          };
        } else if (r >= dataStartRowIdx && r <= dataEndRowIdx) {
          // Table Data
          cell.s.font = { name: 'Calibri', size: 10 };
          cell.s.alignment = {
            vertical: 'center',
            horizontal: c === 0 || c >= 3 ? 'center' : 'left',
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
        } else if (r > dataEndRowIdx) {
          // Signature Block
          cell.s.font = { name: 'Calibri', size: 10 };
          if (r === dataEndRowIdx + 3) {
            cell.s.font.bold = true;
          }
          if (r === dataEndRowIdx + 4) {
            cell.s.font.italic = true;
            cell.s.font.size = 9;
          }
          if (r === range.e.r && c !== 1) {
            cell.s.font.bold = true; // Bold name of judge/secretary at the end
          }
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        }
      }
    }

    // Set row heights
    ws['!rows'] = [];
    ws['!rows'][0] = { hpx: 30 }; // Title
    ws['!rows'][1] = { hpx: 20 }; // Subtitle
    ws['!rows'][2] = { hpx: 20 }; // Metadata
    for (let hr = headerRowIdx; hr < dataStartRowIdx; hr++) {
      ws['!rows'][hr] = { hpx: 28 }; // Table header(s)
    }
    for (let r = dataStartRowIdx; r <= dataEndRowIdx; r++) {
      ws['!rows'][r] = { hpx: 24 }; // Data rows
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Grading_Sheet');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const safeTitle = title.replace(/\s+/g, '_');
    const filename = `${safeTitle}_${round.name.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Export Grading Sheet Error:', error.message);
    res.status(500).json({ message: 'Server error exporting grading sheet.' });
  }
});

/**
 * @route   GET /api/grades/track/:trackId/round/:roundId/import-template
 * @desc    Generate a pre-populated Excel template for bulk score importing for an entire track, including all judges and criteria
 * @access  Private (Admins / Coords / Student Assistants / Judges)
 */
router.get('/track/:trackId/round/:roundId/import-template', authenticateToken, async (req, res) => {
  try {
    const { trackId, roundId } = req.params;

    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: 'Không tìm thấy vòng thi.' });

    const Event = mongoose.model('Event');
    const event = await Event.findById(round.eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });

    const track = await Track.findById(trackId);
    if (!track) return res.status(404).json({ message: 'Không tìm thấy bảng đấu.' });

    // Verify user permissions (admin, coordinator, student_assistant, judge)
    if (!req.user.isSystemAdmin) {
      const userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: { $in: ['coordinator', 'admin_view', 'student_assistant', 'judge'] },
        status: 'active'
      });
      if (!userRole) {
        return res.status(403).json({ message: 'Bạn không có quyền tải form mẫu chấm điểm.' });
      }
    }

    // 1. Get rubric and criteria for this round
    let rubric = await findActiveRubric(round._id, track._id);
    if (!rubric) {
      rubric = await Rubric.findOne({ roundId: round._id });
    }
    if (!rubric) {
      return res.status(400).json({ message: 'Vòng thi này chưa được cấu hình Rubric chấm điểm.' });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });
    if (criteria.length === 0) {
      return res.status(400).json({ message: 'Rubric chưa có tiêu chí chấm điểm nào.' });
    }

    // 2. Get teams in this track (or originalTrackId)
    let teams = await Team.find({
      eventId: round.eventId,
      $or: [{ trackId: track._id }, { originalTrackId: track._id }],
      status: 'confirmed'
    }).sort({ name: 1 });

    if (teams.length === 0) {
      teams = await Team.find({
        eventId: round.eventId,
        trackId: track._id
      }).sort({ name: 1 });
    }

    // 3. Get all active judges for this event / round / track
    const judgeRoles = await EventRole.find({
      eventId: round.eventId,
      role: 'judge',
      status: 'active',
      $or: [
        { roundId: round._id },
        { roundId: null },
        { roundId: { $exists: false } }
      ]
    }).populate('userId', 'fullName email code').lean();

    // Prioritize judges matching trackId, or round-level judges
    const judgeMap = new Map();
    judgeRoles.forEach(jr => {
      if (jr.userId && (!jr.trackId || jr.trackId.toString() === track._id.toString())) {
        judgeMap.set(jr.userId._id.toString(), jr.userId);
      }
    });
    // If no judges specific to track, add all judges in round
    if (judgeMap.size === 0) {
      judgeRoles.forEach(jr => {
        if (jr.userId) {
          judgeMap.set(jr.userId._id.toString(), jr.userId);
        }
      });
    }
    const judges = Array.from(judgeMap.values());

    // 4. Fetch existing scores for pre-filling
    const existingScores = await Score.find({
      roundId: round._id,
      teamId: { $in: teams.map(t => t._id) }
    }).lean();
    const scoreIds = existingScores.map(s => s._id);
    const existingDetails = await ScoreDetail.find({ scoreId: { $in: scoreIds } }).lean();

    // 5. Create Excel Workbook
    const wb = XLSX.utils.book_new();

    // ================= SHEET 1: FORM_CHAM_DIEM =================
    const wsData = [];
    const title = `PHIẾU NHẬP ĐIỂM HACKATHON - BẢNG ${track.name.toUpperCase()} - ${round.name.toUpperCase()}`;
    const subtitle = `${event.name.toUpperCase()} | RUBRIC: v${rubric.version || 1}`;
    const meta = `Bảng đấu: ${track.name} | Vòng thi: ${round.name} | Số đội: ${teams.length} | Số giám khảo: ${judges.length}`;
    const instruction = `HƯỚNG DẪN: Nhập điểm từng tiêu chí (từ 0 đến Điểm tối đa) và ý kiến nhận xét chung cho từng giám khảo.`;

    wsData.push([title]);
    wsData.push([subtitle]);
    wsData.push([meta]);
    wsData.push([instruction]);
    wsData.push([]); // blank row

    // Table Header Row (Row 5 - 0-indexed)
    const headerRow = [
      "STT",
      "Mã Đội",
      "Tên Đội Thi",
      "Email Giám Khảo",
      "Tên Giám Khảo"
    ];

    criteria.forEach(c => {
      const weightPercent = c.weight > 1 ? c.weight : Math.round(c.weight * 100);
      headerRow.push(`${c.code}\n(Max: ${c.maxScore}đ - ${weightPercent}%)`);
    });

    headerRow.push("Ý Kiến / Nhận Xét Chung");

    wsData.push(headerRow);

    // Data rows
    let stt = 1;
    teams.forEach(team => {
      // If there are judges, create a row for each judge
      if (judges.length > 0) {
        judges.forEach(judge => {
          const row = [
            stt++,
            team.name,
            team.name,
            judge.email || '',
            judge.fullName || ''
          ];

          // Find existing score
          const matchingScore = existingScores.find(s =>
            s.teamId.toString() === team._id.toString() &&
            s.judgeId.toString() === judge._id.toString()
          );

          criteria.forEach(c => {
            if (matchingScore) {
              const detail = existingDetails.find(d =>
                d.scoreId.toString() === matchingScore._id.toString() &&
                d.criterionId.toString() === c._id.toString()
              );
              row.push(detail && Number.isFinite(detail.scoreValue) ? detail.scoreValue : '');
            } else {
              row.push(''); // Empty for new entry
            }
          });

          row.push(matchingScore ? (matchingScore.overallComment || '') : '');

          wsData.push(row);
        });
      } else {
        // If no judges defined yet, create team row with blank judge
        const row = [
          stt++,
          team.name,
          team.name,
          '',
          ''
        ];
        criteria.forEach(() => row.push(''));
        row.push('');
        wsData.push(row);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Styling & Merges
    const totalCols = headerRow.length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } },
    ];

    // Set column widths
    const colWidths = [
      { wch: 6 },   // STT
      { wch: 16 },  // Mã Đội
      { wch: 28 },  // Tên Đội Thi
      { wch: 26 },  // Email GK
      { wch: 24 }   // Tên GK
    ];
    criteria.forEach(() => colWidths.push({ wch: 18 })); // Criteria
    colWidths.push({ wch: 35 }); // Nhận xét
    ws['!cols'] = colWidths;

    // Apply cell formatting
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) continue;

        if (R === 0) {
          ws[cellRef].s = {
            font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "F27024" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        } else if (R === 1) {
          ws[cellRef].s = {
            font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "EA580C" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        } else if (R === 2 || R === 3) {
          ws[cellRef].s = {
            font: { italic: true, sz: 9, color: { rgb: "334155" } },
            fill: { fgColor: { rgb: "F8FAFC" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        } else if (R === 5) {
          // Table Headers
          const isCrit = C >= 5 && C < 5 + criteria.length;
          ws[cellRef].s = {
            font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: isCrit ? "F27024" : "1E293B" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: "CBD5E1" } },
              bottom: { style: 'thin', color: { rgb: "CBD5E1" } },
              left: { style: 'thin', color: { rgb: "CBD5E1" } },
              right: { style: 'thin', color: { rgb: "CBD5E1" } }
            }
          };
        } else if (R > 5) {
          // Data Rows
          const isNumCol = C === 0 || (C >= 5 && C < 5 + criteria.length);
          ws[cellRef].s = {
            font: { sz: 10, color: { rgb: "0F172A" } },
            alignment: {
              horizontal: isNumCol ? "center" : "left",
              vertical: "center"
            },
            border: {
              top: { style: 'thin', color: { rgb: "E2E8F0" } },
              bottom: { style: 'thin', color: { rgb: "E2E8F0" } },
              left: { style: 'thin', color: { rgb: "E2E8F0" } },
              right: { style: 'thin', color: { rgb: "E2E8F0" } }
            }
          };
        }
      }
    }

    // Set row heights
    ws['!rows'] = [];
    ws['!rows'][0] = { hpx: 28 };
    ws['!rows'][1] = { hpx: 22 };
    ws['!rows'][2] = { hpx: 18 };
    ws['!rows'][3] = { hpx: 18 };
    ws['!rows'][5] = { hpx: 32 };
    for (let r = 6; r <= range.e.r; r++) {
      ws['!rows'][r] = { hpx: 22 };
    }

    XLSX.utils.book_append_sheet(wb, ws, "FORM_CHAM_DIEM");

    // ================= SHEET 2: DANH_SACH_TIEU_CHI =================
    const critData = [
      ["DANH SÁCH TIÊU CHÍ ĐÁNH GIÁ (RUBRIC)"],
      [`Vòng thi: ${round.name} | Phiên bản: v${rubric.version || 1}`],
      [],
      ["Mã Tiêu Chí", "Tên Tiêu Chí", "Điểm Tối Đa", "Trọng Số (%)", "Mô Tả Tiêu Chí"]
    ];

    criteria.forEach(c => {
      const weightPercent = c.weight > 1 ? c.weight : Math.round(c.weight * 100);
      critData.push([
        c.code,
        c.name,
        c.maxScore,
        `${weightPercent}%`,
        c.description || ''
      ]);
    });

    const critWs = XLSX.utils.aoa_to_sheet(critData);
    critWs['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, critWs, "DANH_SACH_TIEU_CHI");

    // ================= SHEET 3: DANH_SACH_GIAM_KHAO =================
    const judgeData = [
      ["DANH SÁCH GIÁM KHẢO PHỤ TRÁCH VÒNG THI"],
      [`Bảng đấu: ${track.name} | Vòng: ${round.name}`],
      [],
      ["STT", "Email Giám Khảo", "Họ và Tên", "Mã / Ghi Chú"]
    ];

    judges.forEach((j, i) => {
      judgeData.push([
        i + 1,
        j.email,
        j.fullName,
        j.code || 'Giám khảo'
      ]);
    });

    const judgeWs = XLSX.utils.aoa_to_sheet(judgeData);
    judgeWs['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, judgeWs, "DANH_SACH_GIAM_KHAO");

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const cleanTrackName = track.name.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    const cleanRoundName = round.name.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    const filename = `Form_Cham_Diem_${cleanTrackName}_${cleanRoundName}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Export Bulk Grading Template Error:', error.message);
    res.status(500).json({ message: `Lỗi xuất form mẫu: ${error.message}` });
  }
});

/**
 * @route   POST /api/grades/import-track-scores
 * @desc    Bulk import scores for teams in a track from uploaded Excel file
 * @access  Private (Admins / Coords / Student Assistants / Judges)
 */
router.post('/import-track-scores', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Vui lòng tải lên file Excel (.xlsx hoặc .xls).' });
  }

  const { roundId, trackId } = req.body;

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('FORM') || n.toUpperCase().includes('DIEM')) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(400).json({ message: 'Không tìm thấy sheet dữ liệu trong file Excel.' });
    }

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawRows || rawRows.length < 2) {
      return res.status(400).json({ message: 'File Excel không có dữ liệu để import.' });
    }

    // Find Header row (look for "Mã Đội" or "STT" or "_teamId" or "Tên Đội")
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (row.some(cell => typeof cell === 'string' && (cell.includes('Mã Đội') || cell.includes('_teamId') || cell.includes('Tên Đội Thi')))) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      return res.status(400).json({ message: 'Không tìm thấy dòng tiêu đề bảng điểm (cần có cột Mã Đội, Tên Đội Thi, Email Giám Khảo...).' });
    }

    const headers = rawRows[headerRowIdx].map(h => String(h || '').trim());

    // Map column indices
    let colTeamId = headers.indexOf('_teamId');
    let colJudgeId = headers.indexOf('_judgeId');
    let colRubricId = headers.indexOf('_rubricId');
    let colTrackId = headers.indexOf('_trackId');
    let colRoundId = headers.indexOf('_roundId');

    let colTeamCode = headers.findIndex(h => h.includes('Mã Đội'));
    let colTeamName = headers.findIndex(h => h.includes('Tên Đội'));
    let colJudgeEmail = headers.findIndex(h => h.includes('Email Giám Khảo') || h.includes('Email'));
    let colJudgeName = headers.findIndex(h => h.includes('Tên Giám Khảo'));
    let colComment = headers.findIndex(h => h.includes('Nhận Xét') || h.includes('Ý Kiến'));

    // Resolve Round and Rubric context
    let targetRoundId = roundId;
    let targetTrackId = trackId;
    let targetRubricId = null;

    // Peek first data row for hidden IDs if not provided in body
    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (colRoundId >= 0 && row[colRoundId] && !targetRoundId) targetRoundId = String(row[colRoundId]).trim();
      if (colTrackId >= 0 && row[colTrackId] && !targetTrackId) targetTrackId = String(row[colTrackId]).trim();
      if (colRubricId >= 0 && row[colRubricId] && !targetRubricId) targetRubricId = String(row[colRubricId]).trim();
      if (targetRoundId && targetRubricId) break;
    }

    if (!targetRoundId) {
      return res.status(400).json({ message: 'Thiếu thông tin vòng thi (roundId).' });
    }

    const round = await Round.findById(targetRoundId);
    if (!round) return res.status(404).json({ message: 'Không tìm thấy vòng thi tương ứng.' });
    if (round.status === 'completed') {
      return res.status(400).json({ message: 'Vòng thi này đã bị khoá. Không thể import điểm.' });
    }

    // Permission check
    if (!req.user.isSystemAdmin) {
      const userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: { $in: ['coordinator', 'admin_view', 'student_assistant', 'judge'] },
        status: 'active'
      });
      if (!userRole) {
        return res.status(403).json({ message: 'Bạn không có quyền import điểm cho vòng thi này.' });
      }
    }

    let rubric = targetRubricId ? await Rubric.findById(targetRubricId) : await findActiveRubric(round._id, targetTrackId);
    if (!rubric) rubric = await Rubric.findOne({ roundId: round._id });
    if (!rubric) {
      return res.status(400).json({ message: 'Chưa cấu hình Rubric cho vòng thi này.' });
    }

    const criteriaList = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });
    if (criteriaList.length === 0) {
      return res.status(400).json({ message: 'Rubric chưa có tiêu chí chấm điểm.' });
    }

    // Map criteria to column indices
    const criteriaColMap = [];
    criteriaList.forEach(crit => {
      const cCode = crit.code.toUpperCase();
      const colIdx = headers.findIndex((h, idx) => {
        if (idx === colTeamCode || idx === colTeamName || idx === colJudgeEmail || idx === colJudgeName || idx === colComment) return false;
        const cleanH = h.toUpperCase().split('\n')[0].trim();
        return cleanH === cCode || cleanH.startsWith(cCode + ' ') || cleanH.startsWith(cCode + '(');
      });
      if (colIdx >= 0) {
        criteriaColMap.push({ criterion: crit, colIdx });
      }
    });

    if (criteriaColMap.length === 0) {
      return res.status(400).json({ message: 'Không khớp được cột tiêu chí nào từ file Excel với Rubric hiện tại.' });
    }

    // Fetch caches for Teams and Judges to optimize lookups
    const allTeams = await Team.find({ eventId: round.eventId }).lean();
    const allJudges = await User.find({}).lean();

    let successCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    const dataRows = rawRows.slice(headerRowIdx + 1);

    for (let idx = 0; idx < dataRows.length; idx++) {
      const row = dataRows[idx];
      const rowNum = headerRowIdx + 2 + idx;

      // Skip completely empty row
      if (!row || row.every(cell => String(cell || '').trim() === '')) {
        continue;
      }

      // 1. Resolve Team
      let team = null;
      if (colTeamId >= 0 && row[colTeamId] && mongoose.Types.ObjectId.isValid(String(row[colTeamId]).trim())) {
        team = allTeams.find(t => t._id.toString() === String(row[colTeamId]).trim());
      }
      if (!team && colTeamCode >= 0 && row[colTeamCode]) {
        const codeVal = String(row[colTeamCode]).trim();
        team = allTeams.find(t =>
          t.name.toLowerCase() === codeVal.toLowerCase()
        );
      }
      if (!team && colTeamName >= 0 && row[colTeamName]) {
        const nameVal = String(row[colTeamName]).trim().toLowerCase();
        team = allTeams.find(t => t.name.toLowerCase() === nameVal);
      }

      if (!team) {
        errorCount++;
        errors.push(`Dòng ${rowNum}: Không tìm thấy đội thi "${row[colTeamCode] || row[colTeamName] || 'N/A'}".`);
        continue;
      }

      // 2. Resolve Judge
      let judge = null;
      if (colJudgeId >= 0 && row[colJudgeId] && mongoose.Types.ObjectId.isValid(String(row[colJudgeId]).trim())) {
        judge = allJudges.find(j => j._id.toString() === String(row[colJudgeId]).trim());
      }
      if (!judge && colJudgeEmail >= 0 && row[colJudgeEmail]) {
        const emailVal = String(row[colJudgeEmail]).trim().toLowerCase();
        judge = allJudges.find(j => j.email && j.email.toLowerCase() === emailVal);
      }
      if (!judge && colJudgeName >= 0 && row[colJudgeName]) {
        const nameVal = String(row[colJudgeName]).trim().toLowerCase();
        judge = allJudges.find(j => j.fullName && j.fullName.toLowerCase() === nameVal);
      }

      if (!judge) {
        errorCount++;
        errors.push(`Dòng ${rowNum}: Không tìm thấy giám khảo "${row[colJudgeEmail] || row[colJudgeName] || 'N/A'}".`);
        continue;
      }

      // 3. Extract and validate scores
      let totalRawScore = 0;
      let totalWeightedScore = 0;
      const detailsToSave = [];
      let hasAnyScore = false;
      let rowScoreError = null;

      for (const { criterion, colIdx } of criteriaColMap) {
        const rawVal = row[colIdx];
        if (rawVal !== '' && rawVal !== null && rawVal !== undefined) {
          const numVal = Number(String(rawVal).replace(',', '.'));
          if (isNaN(numVal)) {
            rowScoreError = `Điểm tiêu chí ${criterion.code} không phải là số hợp lệ (${rawVal}).`;
            break;
          }
          if (numVal < 0 || numVal > criterion.maxScore) {
            rowScoreError = `Điểm tiêu chí ${criterion.code} (${numVal}) vượt quá giới hạn [0 - ${criterion.maxScore}].`;
            break;
          }

          hasAnyScore = true;
          const wScore = numVal * (criterion.weight / (rubric.totalWeight || 100));
          totalRawScore += numVal;
          totalWeightedScore += wScore;

          detailsToSave.push({
            criterionId: criterion._id,
            scoreValue: Math.round(numVal * 100) / 100,
            weightedScore: Math.round(wScore * 100) / 100
          });
        }
      }

      if (rowScoreError) {
        errorCount++;
        errors.push(`Dòng ${rowNum} (${team.name} - ${judge.fullName}): ${rowScoreError}`);
        continue;
      }

      if (!hasAnyScore) {
        // Skip row if no scores were input for this judge/team
        continue;
      }

      const overallComment = colComment >= 0 ? String(row[colComment] || '').trim() : '';

      // 4. Find Repo & Snapshot
      const repo = await GithubRepository.findOne({ teamId: team._id });
      const snapshot = await RepositorySnapshot.findOne({ teamId: team._id, roundId: round._id });

      // 5. Upsert Score & ScoreDetail
      let score = await Score.findOne({ teamId: team._id, roundId: round._id, judgeId: judge._id });
      const isExisting = !!score;

      if (score) {
        score.totalRawScore = Math.round(totalRawScore * 100) / 100;
        score.totalWeightedScore = Math.round(totalWeightedScore * 100) / 100;
        if (overallComment) score.overallComment = overallComment;
        score.status = 'submitted';
        score.submittedAt = new Date();
        await score.save();
        updatedCount++;
      } else {
        score = new Score({
          teamId: team._id,
          repositoryId: repo ? repo._id : undefined,
          repositorySnapshotId: snapshot ? snapshot._id : undefined,
          eventId: round.eventId,
          trackId: team.trackId || targetTrackId,
          roundId: round._id,
          rubricId: rubric._id,
          judgeId: judge._id,
          totalRawScore: Math.round(totalRawScore * 100) / 100,
          totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
          overallComment,
          status: 'submitted',
          submittedAt: new Date()
        });
        await score.save();
      }

      // Recreate ScoreDetails
      await ScoreDetail.deleteMany({ scoreId: score._id });
      if (detailsToSave.length > 0) {
        await ScoreDetail.insertMany(
          detailsToSave.map(d => ({
            scoreId: score._id,
            ...d
          }))
        );
      }

      // Audit Log
      await ScoreAudit.create({
        scoreId: score._id,
        teamId: team._id,
        roundId: round._id,
        judgeId: judge._id,
        actorId: req.user._id,
        actorRole: req.user.isSystemAdmin ? 'admin' : 'coordinator',
        action: isExisting ? 'bulk_update' : 'bulk_import',
        summary: `Import điểm hàng loạt: ${totalWeightedScore.toFixed(2)} điểm (${detailsToSave.length} tiêu chí).`,
        reason: 'Bulk import from Excel spreadsheet'
      });

      successCount++;
    }

    // 6. Broadcast Realtime Socket.IO update
    try {
      const io = req.app.get('socketio') || global.io;
      if (io) {
        io.to(`live:${round.eventId}`).emit('score_updated', {
          roundId: round._id,
          trackId: targetTrackId,
          timestamp: new Date()
        });
      }
    } catch (socketErr) {
      console.warn('Socket emit in bulk import failed:', socketErr.message);
    }

    res.json({
      success: true,
      message: `Đã import thành công ${successCount} phiếu chấm điểm (${updatedCount} cập nhật mới).`,
      totalProcessed: successCount + errorCount,
      successCount,
      updatedCount,
      errorCount,
      errors
    });

  } catch (error) {
    console.error('Import Track Scores Error:', error.message);
    res.status(500).json({ message: `Lỗi import điểm: ${error.message}` });
  }
});

module.exports = router;
