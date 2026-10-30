/**
 * System-Level Harness: Layer 04 - Context & State Store
 * Manages memory storage, session persistence, and aggregate history retrievals.
 * Supports full Evidence Map serialization from Agent 1 reviews to Agent 2.
 */

const dbTools = require('../../features/github-ai/tools/dbTools');
const mongoose = require('mongoose');
const { findActiveRubric } = require('../../features/grading/rubricResolver');

/**
 * Load team historical memory and rich context for AI analysis (Agent 2)
 */
async function loadTeamAggregateContext(teamId, commitsLimit = 40, reviewsLimit = 15) {
  let commits = [];
  let priorReviews = [];
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      commits = await dbTools.fetchTeamCommits(teamId, commitsLimit);
      priorReviews = await dbTools.fetchPriorReviews(teamId, reviewsLimit);
    }
  } catch (err) {
    console.warn('[CONTEXT STORE] Warning fetching commits/reviews:', err.message);
  }

  const commitSummaries = commits.map((c, idx) => 
    `[${idx + 1}] SHA: ${c.commitSha ? c.commitSha.substring(0, 7) : 'N/A'}, Msg: "${c.message || 'N/A'}", Author: ${c.authorName || 'N/A'}, Time: ${c.committedAt ? new Date(c.committedAt).toISOString() : 'N/A'}`
  ).join('\n');

  const detailedReviews = priorReviews.map((r, idx) => {
    let resultObj = r.result;
    if (typeof resultObj === 'string') {
      try {
        resultObj = JSON.parse(resultObj);
      } catch (err) {
        // ignore
      }
    }
    if (!resultObj) return `[Push ${idx + 1}] (Không có dữ liệu review)`;

    const pushSummary = resultObj.overall_picture?.push_summary || resultObj.summary || 'Không có tóm tắt';
    const focus = resultObj.overall_picture?.current_focus || resultObj.system_identity?.current_focus || 'Chưa rõ';
    const track = resultObj.system_identity?.detected_track || 'Chưa xác định';
    const agents = (resultObj.multi_agent_architecture?.agents_and_roles || []).join('; ') || 'Chưa quan sát';
    const handoff = resultObj.multi_agent_architecture?.handoff_mechanism || 'Chưa quan sát';
    const multiAgentSubstantive = resultObj.multi_agent_architecture?.is_multi_agent_substantive ? 'Có' : 'Chưa rõ/Không';
    const readTools = (resultObj.tools_and_verification?.read_tools || []).join(', ') || 'Không';
    const writeTools = (resultObj.tools_and_verification?.state_changing_tools || []).join(', ') || 'Không';
    const verification = resultObj.tools_and_verification?.verification_mechanism || 'Chưa có';
    const approval = resultObj.safety_transparency_and_ux?.human_approval || 'Chưa có';
    const audit = resultObj.safety_transparency_and_ux?.audit_trace || 'Chưa có';

    // Extract rubric evidence summary
    let rubricEvidenceStr = '';
    if (resultObj.rubric_evidence) {
      rubricEvidenceStr = Object.entries(resultObj.rubric_evidence)
        .map(([k, v]) => `  - ${k}: status=${v?.status || 'N/A'}, evidence=${(v?.evidence || []).join('; ') || 'None'}, gaps=${(v?.gaps || []).join('; ') || 'None'}`)
        .join('\n');
    }

    return `--- ĐỢT PUSH REVIEW #${idx + 1} (${r.completedAt ? new Date(r.completedAt).toISOString() : 'N/A'}) ---
Tóm tắt push: ${pushSummary}
Tiêu điểm: ${focus} | Track nhận diện: ${track}
Multi-Agent: ${agents} (Thực chất: ${multiAgentSubstantive}) | Handoff: ${handoff}
Tool đọc: ${readTools} | Tool ghi: ${writeTools} | Verification: ${verification}
Human Approval: ${approval} | Audit Trace: ${audit}
Bằng chứng Rubric:
${rubricEvidenceStr || '  (Chưa ghi nhận rubric evidence chi tiết)'}
`;
  }).join('\n\n');

  const {
    teamCode, repoName, repositoryId, roundId, trackId, trackName, contestBrief, roundCriteria, criteriaPrompt
  } = await loadTeamRubricContext(teamId);

  const aggregateContext = `
=========================================
LỊCH SỬ COMMIT (${commits.length} commits gần nhất):
=========================================
${commitSummaries || 'Không có commit nào.'}

=========================================
TỔNG HỢP REVIEW AGENT 1 QUA CÁC ĐỢT PUSH (${priorReviews.length} đợt review đã lưu):
=========================================
${detailedReviews || 'Chưa có review nào từ Agent 1.'}
`;

  return {
    teamId,
    teamCode,
    repoName,
    repositoryId,
    roundId,
    trackId,
    trackName,
    commits,
    priorReviews,
    commitSummaries,
    reviewSummaries: detailedReviews,
    aggregateContext,
    roundCriteria,
    criteriaPrompt,
    contestBrief
  };
}

/**
 * Load the team's track, round, active rubric and organiser-written contest brief.
 * Contest content lives in the database (Rubric/Criterion, Track.aiBrief), never in prompts,
 * so a new contest only needs data entry.
 */
async function loadTeamRubricContext(teamId) {
  const ctx = {
    teamCode: 'team-unknown',
    repoName: 'unknown-repo',
    repositoryId: null,
    roundId: null,
    trackId: null,
    trackName: 'Unknown Track',
    contestBrief: '',
    roundCriteria: [],
    criteriaPrompt: ''
  };

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const Team = mongoose.model('Team');
      const Criterion = mongoose.model('Criterion');
      const GithubRepository = mongoose.model('GithubRepository');

      const team = await Team.findById(teamId).populate({ path: 'trackId', select: '+aiBrief' });
      if (team) {
        ctx.teamCode = team.name || String(teamId);
        if (team.trackId) {
          ctx.trackName = team.trackId.name || 'Unknown Track';
          ctx.trackId = team.trackId._id;
          ctx.contestBrief = team.trackId.aiBrief || '';
        }
        ctx.roundId = team.currentRoundId;
        if (!ctx.roundId) {
          const Round = mongoose.model('Round');
          const round = await Round.findOne({ eventId: team.eventId, status: 'active' })
            || await Round.findOne({ eventId: team.eventId }).sort({ order: 1 });
          if (round) ctx.roundId = round._id;
        }

        if (ctx.roundId) {
          const rubric = await findActiveRubric(ctx.roundId, ctx.trackId);
          if (rubric) {
            ctx.roundCriteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });
          }
        }
      }

      const repo = await GithubRepository.findOne({ teamId });
      if (repo) {
        ctx.repoName = repo.repoName || 'unknown-repo';
        ctx.repositoryId = repo._id;
      }
    }
  } catch (err) {
    console.error('[CONTEXT STORE ERROR] Failed loading team/rubric metadata:', err.message);
  }

  ctx.criteriaPrompt = formatCriteriaPrompt(ctx.roundCriteria);
  return ctx;
}

function formatCriteriaPrompt(criteria) {
  return (criteria || []).map(c =>
    `- ${c.code}: ${c.name} (criterionId: ${c._id}, weight: ${c.weight || 0}%, maxScore: ${c.maxScore}đ, mô tả: ${c.description || 'Không có'}, gradingLevels: ${JSON.stringify(c.gradingLevels || [])})`
  ).join('\n');
}

module.exports = {
  loadTeamAggregateContext,
  loadTeamRubricContext,
  formatCriteriaPrompt
};
