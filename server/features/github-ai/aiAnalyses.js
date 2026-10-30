const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const AiAnalysis = mongoose.model('AiAnalysis');
const Commit = mongoose.model('Commit');
const GithubRepository = mongoose.model('GithubRepository');
const Team = mongoose.model('Team');
const Rubric = mongoose.model('Rubric');
const Criterion = mongoose.model('Criterion');

const aiService = require('./aiService');
const { parseAiResult } = require('./aiService');
const { authenticateToken } = require('../auth/authMiddleware');
const { projectAnalysisForMentor } = require('./mentorAiProjection');
const { loadTeamForUser } = require('../teams/teamAccess');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @route   GET /api/ai-analyses/team/:teamId
 * @desc    Get all AI analyses (per-push and team aggregate reviews) for a team
 * @access  Private (Judges and organisers only — reviews contain suggested scores and judge questions)
 */
router.get('/team/:teamId', authenticateToken, async (req, res) => {
  try {
    const team = await loadTeamForUser(req, res, req.params.teamId, ['judge']);
    if (!team) return;

    const analyses = await AiAnalysis.find({ teamId: req.params.teamId })
      .populate('commitId', 'message commitSha committedAt authorGithubUsername authorName')
      .populate('teamId', 'name')
      .populate('repositoryId', 'repoName repoUrl')
      .sort({ createdAt: -1 });
      
    const cleanedAnalyses = analyses.map(a => {
      const obj = a.toObject();
      obj.result = parseAiResult(obj.result);
      return obj;
    });
    res.json(cleanedAnalyses);
  } catch (error) {
    console.error('Fetch AI analyses error:', error.message);
    res.status(500).json({ message: 'Server error fetching AI analyses.' });
  }
});

/**
 * @route   GET /api/ai-analyses/stats
 * @desc    Get aggregate stats of reviews for Hackathon Review Dashboard
 * @access  Private
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // 1. Total active teams with repository
    const activeTeamsCount = await GithubRepository.countDocuments({ isArchived: false });
    
    // 2. Count of per-push records
    const perPushCount = await AiAnalysis.countDocuments({ analysisType: 'commit_review', status: 'completed' });
    
    // 3. Count of total records
    const totalRecords = await AiAnalysis.countDocuments({ status: 'completed' });

    // 4. Latest sync time
    const latestReview = await AiAnalysis.findOne({ status: 'completed' }).sort({ completedAt: -1 });
    const lastSyncTime = latestReview ? latestReview.completedAt : new Date();

    res.json({
      activeTeamsCount,
      perPushCount,
      totalRecords,
      lastSyncTime
    });
  } catch (error) {
    console.error('Fetch review stats error:', error.message);
    res.status(500).json({ message: 'Server error fetching stats.' });
  }
});

/**
 * @route   GET /api/ai-analyses/mentor/team/:teamId
 * @desc    Read-only technical projection of completed Judge AI reviews for a mentor's track
 * @access  Private (mentor in the same event and track, or system admin)
 */
router.get('/mentor/team/:teamId', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.teamId)) {
      return res.status(400).json({ message: 'teamId không hợp lệ.' });
    }
    const team = await Team.findById(req.params.teamId).select('eventId trackId name').lean();
    if (!team) return res.status(404).json({ message: 'Không tìm thấy đội thi.' });

    if (!req.user.isSystemAdmin) {
      if (!team.trackId) return res.status(409).json({ message: 'Đội thi chưa được phân vào bảng đấu.' });
      const EventRole = mongoose.model('EventRole');
      const mentorRole = await EventRole.exists({
        userId: req.user._id,
        eventId: team.eventId,
        trackId: team.trackId,
        role: 'mentor',
        status: 'active'
      });
      if (!mentorRole) {
        return res.status(403).json({ message: 'Bạn không có quyền xem AI review của đội thuộc bảng đấu này.' });
      }
    }

    const analyses = await AiAnalysis.find({
      teamId: team._id,
      analysisType: { $in: ['commit_review', 'repository_review'] },
      status: 'completed'
    })
      .populate('commitId', 'message commitSha committedAt authorGithubUsername authorName')
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(30);

    res.json({
      team: { id: team._id, name: team.name },
      reviews: analyses.map(projectAnalysisForMentor)
    });
  } catch (error) {
    console.error('Fetch mentor AI review projection error:', error.message);
    res.status(500).json({ message: 'Không thể tải AI review kỹ thuật.' });
  }
});

/**
 * @route   GET /api/ai-analyses/:id
 * @desc    Get details of a specific AI analysis record
 * @access  Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const analysis = await AiAnalysis.findById(req.params.id)
      .populate('commitId')
      .populate('repositoryId')
      .populate('teamId');
      
    if (!analysis) {
      return res.status(404).json({ message: 'Không tìm thấy phân tích AI.' });
    }
    const team = await loadTeamForUser(req, res, analysis.teamId?._id || analysis.teamId, ['judge']);
    if (!team) return;

    const obj = analysis.toObject();
    obj.result = parseAiResult(obj.result);
    res.json(obj);
  } catch (error) {
    console.error('Get AI analysis detail error:', error.message);
    res.status(500).json({ message: 'Server error fetching AI analysis details.' });
  }
});

/**
 * @route   POST /api/ai-analyses/team/:teamId/aggregate
 * @desc    Manually trigger a team aggregate review
 * @access  Private
 */
router.post('/team/:teamId/aggregate', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { roundId, rubricId } = req.body;

  try {
    if (!roundId || !rubricId) {
      return res.status(400).json({ message: 'roundId and rubricId are required for Agent 2 analysis.' });
    }
    // Each run calls the LLM, so only judges and organisers may trigger it.
    const team = await loadTeamForUser(req, res, teamId, ['judge']);
    if (!team) return;

    const repo = await GithubRepository.findOne({ teamId });
    if (!repo) return res.status(400).json({ message: 'Đội thi này chưa được thiết lập GitHub repository.' });

    const rubric = await Rubric.findOne({ _id: rubricId, roundId, isActive: true });
    if (!rubric) return res.status(400).json({ message: 'Rubric is not active or is not assigned to the selected round.' });
    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });
    if (criteria.length === 0) return res.status(404).json({ message: 'No criteria found for this rubric.' });

    console.log(`[AI MANUAL] Running Agent 2 aggregate review for team: ${teamId}, round: ${roundId}...`);
    
    // Fetch up to 40 commits
    const commits = await Commit.find({ teamId, message: { $not: /initial commit/i } }).sort({ committedAt: 1 }).limit(40);
    // Fetch up to 10 prior reviews (if available)
    const priorReviews = await AiAnalysis.find({
      teamId,
      repositoryId: repo._id,
      analysisType: 'commit_review',
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(10);

    const aggResult = await aiService.analyzeTeamAggregate(
      teamId,
      commits,
      priorReviews,
      { roundId, rubricId, criteria }
    );

    const aggAnalysis = new AiAnalysis({
      repositoryId: repo._id,
      teamId: teamId,
      roundId,
      analysisType: 'repository_review', // maps to team_aggregate
      provider: aggResult._provider || 'Google Gemini',
      model: aggResult._model || 'gemini-3.1-flash-lite',
      inputSummary: {
        trigger: 'manual_ai_analysis',
        rubricId,
        rubricVersion: rubric.version,
        agent1AnalysisIds: priorReviews.map(review => review._id)
      },
      result: aggResult,
      status: 'completed',
      completedAt: new Date()
    });
    await aggAnalysis.save();

    res.json({
      message: 'Phân tích tổng hợp đội thi đã hoàn thành thành công!',
      analysis: aggAnalysis
    });

  } catch (error) {
    console.error('Manual aggregate review error:', error.message);
    res.status(500).json({ message: error.message || 'Server error running aggregate review.' });
  }
});

/**
 * @route   POST /api/ai-analyses/n8n-callback
 * @desc    Callback endpoint for n8n to asynchronously save AI analysis results
 * @access  Public (Secured via X-API-Key header)
 */
router.post('/n8n-callback', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.N8N_API_KEY;

  // No default key: a key published in the repo would let anyone overwrite AI reviews.
  if (!expectedApiKey) {
    return res.status(503).json({ message: 'n8n callback is disabled: N8N_API_KEY is not configured.' });
  }
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ message: 'Unauthorized callback. Invalid X-API-Key.' });
  }

  let { analysisId, repositoryId, teamId, commitId, commitSha, commit_sha, analysisType, review_kind, result, structured_output, output, status, provider, model } = req.body;

  // Map review_kind to standard analysisType
  let mappedType = analysisType || review_kind;
  if (mappedType === 'team_aggregate' || mappedType === 'aggregate_review') {
    mappedType = 'repository_review';
  } else if (mappedType === 'per_push' || mappedType === 'commit') {
    mappedType = 'commit_review';
  }

  const rawResult = result || structured_output || output || req.body.json || req.body.data;

  if (!mappedType || !rawResult) {
    return res.status(400).json({ message: 'Missing required fields: analysisType (or review_kind), result (or structured_output).' });
  }

  try {
    const parsedResult = parseAiResult(rawResult);

    // Resolve teamId if a team name is provided
    let resolvedTeamId = teamId || req.body.team_id || req.body.teamCode;
    if (resolvedTeamId && !mongoose.Types.ObjectId.isValid(resolvedTeamId)) {
      const foundTeam = await Team.findOne({ name: new RegExp(`^${escapeRegex(resolvedTeamId)}$`, 'i') });
      if (foundTeam) resolvedTeamId = foundTeam._id;
    }

    // Resolve repositoryId if repoName is provided or lookup by teamId
    let resolvedRepoId = repositoryId || req.body.repository_id || req.body.repoName;
    if (resolvedRepoId && !mongoose.Types.ObjectId.isValid(resolvedRepoId)) {
      const foundRepo = await GithubRepository.findOne({
        $or: [
          { repoName: resolvedRepoId },
          { teamId: resolvedTeamId }
        ]
      });
      if (foundRepo) resolvedRepoId = foundRepo._id;
    } else if (!resolvedRepoId && resolvedTeamId) {
      const foundRepo = await GithubRepository.findOne({ teamId: resolvedTeamId });
      if (foundRepo) resolvedRepoId = foundRepo._id;
    }

    // Resolve commitId if commitSha is provided
    const targetSha = commitSha || commit_sha;
    let resolvedCommitId = commitId || req.body.commit_id;
    if (!resolvedCommitId && targetSha && resolvedTeamId) {
      const foundCommit = await Commit.findOne({ teamId: resolvedTeamId, commitSha: targetSha });
      if (foundCommit) resolvedCommitId = foundCommit._id;
    }

    // Normalize status
    let normalizedStatus = status || 'completed';
    if (normalizedStatus === 'done' || normalizedStatus === 'success') normalizedStatus = 'completed';

    let aiAnalysis;
    if (analysisId) {
      aiAnalysis = await AiAnalysis.findById(analysisId);
    }

    if (!aiAnalysis && resolvedCommitId && mappedType === 'commit_review') {
      aiAnalysis = await AiAnalysis.findOne({ commitId: resolvedCommitId, analysisType: mappedType });
    }

    if (!aiAnalysis && resolvedTeamId && mappedType === 'repository_review') {
      aiAnalysis = await AiAnalysis.findOne({ teamId: resolvedTeamId, analysisType: mappedType }).sort({ createdAt: -1 });
    }

    if (aiAnalysis) {
      aiAnalysis.result = parsedResult;
      aiAnalysis.status = normalizedStatus;
      if (provider) aiAnalysis.provider = provider;
      if (model) aiAnalysis.model = model;
      aiAnalysis.completedAt = new Date();
      await aiAnalysis.save();
      console.log(`[N8N CALLBACK] Updated existing AiAnalysis record: ${aiAnalysis._id}`);
    } else if (resolvedRepoId && resolvedTeamId) {
      aiAnalysis = new AiAnalysis({
        repositoryId: resolvedRepoId,
        teamId: resolvedTeamId,
        commitId: resolvedCommitId,
        analysisType: mappedType,
        provider: provider || 'n8n-gemini',
        model: model || 'n8n-workflow',
        result: parsedResult,
        status: normalizedStatus,
        completedAt: new Date()
      });
      await aiAnalysis.save();
      console.log(`[N8N CALLBACK] Created new AiAnalysis record: ${aiAnalysis._id}`);
    }

    // If it's a commit review, update the commit message diff summary
    if (mappedType === 'commit_review' && resolvedCommitId) {
      const commit = await Commit.findById(resolvedCommitId);
      if (commit) {
        commit.diffSummary = parsedResult.overall_picture?.push_summary || parsedResult.summary || '';
        await commit.save();
      }
    }

    res.json({ message: 'Analysis saved successfully.', analysis: aiAnalysis });
  } catch (error) {
    console.error('n8n callback error:', error.message);
    res.status(500).json({ message: 'Server error saving callback analysis.' });
  }
});

module.exports = router;
