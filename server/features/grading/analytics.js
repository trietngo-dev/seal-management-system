const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Commit = mongoose.model('Commit');
const CommitFile = mongoose.model('CommitFile');
const GithubRepository = mongoose.model('GithubRepository');
const AiAnalysis = mongoose.model('AiAnalysis');
const TeamMember = mongoose.model('TeamMember');

const cronService = require('../events/cronService');
const { parseAiResult } = require('../github-ai/aiService');
const { authenticateToken } = require('../auth/authMiddleware');
const { loadTeamForUser, isEventStaff } = require('../teams/teamAccess');

/**
 * @route   GET /api/analytics/team/:teamId/commits
 * @desc    Get all commits and their basic metadata for a team
 * @access  Private
 */
router.get('/team/:teamId/commits', authenticateToken, async (req, res) => {
  try {
    const team = await loadTeamForUser(req, res, req.params.teamId, ['judge', 'mentor', 'member']);
    if (!team) return;

    const commits = await Commit.find({ teamId: req.params.teamId, message: { $not: /initial commit/i } }).sort({ committedAt: -1 });
    res.json(commits);
  } catch (error) {
    console.error('Fetch Team Commits Error:', error.message);
    res.status(500).json({ message: 'Server error fetching commits.' });
  }
});

/**
 * @route   GET /api/analytics/commit/:commitId/ai-analysis
 * @desc    Get Gemini AI analysis for a specific commit
 * @access  Private
 */
router.get('/commit/:commitId/ai-analysis', authenticateToken, async (req, res) => {
  try {
    const analysis = await AiAnalysis.findOne({ commitId: req.params.commitId, analysisType: 'commit_review' });
    if (!analysis) {
      return res.status(404).json({ message: 'AI Analysis not found for this commit yet.' });
    }
    const team = await loadTeamForUser(req, res, analysis.teamId, ['judge']);
    if (!team) return;
    const obj = analysis.toObject();
    obj.result = parseAiResult(obj.result);
    res.json(obj);
  } catch (error) {
    console.error('Fetch Commit AI Analysis Error:', error.message);
    res.status(500).json({ message: 'Server error fetching AI analysis.' });
  }
});

/**
 * @route   GET /api/analytics/team/:teamId/summary
 * @desc    Aggregate statistics on commits (additions, deletions, frequency per author)
 * @access  Private
 */
router.get('/team/:teamId/summary', authenticateToken, async (req, res) => {
  const { teamId } = req.params;

  try {
    const team = await loadTeamForUser(req, res, teamId, ['judge', 'mentor', 'member']);
    if (!team) return;

    const commits = await Commit.find({ teamId, message: { $not: /initial commit/i } });

    // Aggregate contributions by authorName / authorGithubUsername
    const contributions = {};

    commits.forEach(c => {
      const authorKey = c.authorName || c.authorGithubUsername || 'Unknown';
      if (!contributions[authorKey]) {
        contributions[authorKey] = {
          commitsCount: 0,
          additions: 0,
          deletions: 0,
          username: c.authorGithubUsername || '',
          email: c.authorEmail || ''
        };
      }

      contributions[authorKey].commitsCount += 1;
      contributions[authorKey].additions += (c.additions || 0);
      contributions[authorKey].deletions += (c.deletions || 0);
    });

    // Get total files modified (unique filenames)
    const repo = await GithubRepository.findOne({ teamId });
    let uniqueFilesCount = 0;
    
    if (repo) {
      const fileCountAgg = await CommitFile.distinct('filename', { repositoryId: repo._id });
      uniqueFilesCount = fileCountAgg.length;
    }

    res.json({
      teamId,
      totalCommits: commits.length,
      totalFilesModified: uniqueFilesCount,
      contributorSummary: Object.entries(contributions).map(([authorName, data]) => ({
        authorName,
        ...data
      }))
    });

  } catch (error) {
    console.error('Fetch Team Analytics Summary Error:', error.message);
    res.status(500).json({ message: 'Server error compiling analytics.' });
  }
});

/**
 * @route   POST /api/analytics/repo/:repoId/sync
 * @desc    Manually trigger sync commits from GitHub immediately
 * @access  Private
 */
router.post('/repo/:repoId/sync', authenticateToken, async (req, res) => {
  try {
    const repo = await GithubRepository.findById(req.params.repoId);
    if (!repo) return res.status(404).json({ message: 'Repository not found.' });
    if (!(await isEventStaff(req.user, repo.eventId))) {
      return res.status(403).json({ message: 'Chỉ Ban tổ chức mới được kích hoạt đồng bộ thủ công.' });
    }

    const success = await cronService.syncRepo(req.params.repoId);
    if (success) {
      res.json({ message: 'Repository commits and code files synced successfully!' });
    } else {
      res.status(500).json({ message: 'Synchronization process failed. Check server logs.' });
    }
  } catch (error) {
    console.error('Manual Repo Sync Error:', error.message);
    res.status(500).json({ message: error.message || 'Server error syncing repository.' });
  }
});

module.exports = router;
